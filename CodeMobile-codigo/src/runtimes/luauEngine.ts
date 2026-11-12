/**
 * Luau real no aparelho: runtime oficial compilado para WebAssembly.
 * Também executa Lua (o Luau é compatível com a sintaxe de Lua 5.1).
 *
 * Compatibilidade: até aqui o worker era criado com a URL crua do pacote e
 * `{ type: 'module' }`. Em WebView sem module workers (Chrome < 80, caso do
 * Android 9 de fábrica) a opção é ignorada, o arquivo é parseado como script
 * clássico e quebra em `import.meta`/`?.`; o worker nunca respondia e a
 * execução só terminava no limite de 15 s, sem mensagem alguma. Agora o entry
 * é empacotado como script clássico (luauWorker.entry.ts) e a URL do wasm é
 * passada explicitamente, porque `import.meta.url` não existe nesse formato.
 */

import { LuaWorker, type DetachedLuaValue } from '@luau-rs/luau/worker';
import luauWasmUrl from '../../node_modules/@luau-rs/luau/dist/luau_wasm_bg.wasm?url';
import luauWorkerUrl from './luauWorker.entry.js?worker&url';
import { emit, type RunRequest, type RunResult } from './types';

const MAX_LINES = 400;
/** Tempo do script em si. Começa a contar só depois do runtime pronto. */
const EXEC_TIMEOUT_MS = 15000;
/** Carregar o worker e instanciar o wasm pode ser lento em aparelho modesto. */
const INIT_TIMEOUT_MS = 30000;

let client: LuaWorker | null = null;
let ready = false;
let supportCheck: Promise<string | null> | null = null;
let sink: string[] | null = null;

function absolute(url: string): URL {
  return new URL(url, window.location.href);
}

function workerEndpoint(): URL {
  const endpoint = absolute(luauWorkerUrl);
  endpoint.searchParams.set('wasm', absolute(luauWasmUrl).href);
  return endpoint;
}

function dispose(): void {
  if (!client) return;
  try {
    client.terminate();
  } catch {
    /* worker já encerrado */
  }
  client = null;
  ready = false;
}

/**
 * O wasm do Luau usa retornos múltiplos, bulk memory e reference types. O
 * Chromium 66 nem decodifica o binário ("return count of 3 exceeds internal
 * limit of 1") — e isso só aparecia como timeout, 15 s depois. Compilar uma vez
 * aqui troca o silêncio por um diagnóstico imediato e acionável.
 */
function checkWebAssemblySupport(): Promise<string | null> {
  if (supportCheck) return supportCheck;
  supportCheck = (async () => {
    if (typeof WebAssembly !== 'object') return 'este WebView não oferece WebAssembly';
    try {
      const response = await fetch(absolute(luauWasmUrl).href);
      if (!response.ok) return `não foi possível carregar o wasm do Luau (HTTP ${response.status})`;
      await WebAssembly.compile(await response.arrayBuffer());
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/internal limit|decoding failed|compile/i.test(message)) {
        return `este WebView não decodifica o wasm do Luau (${message}). O runtime usa retornos múltiplos e bulk memory, que exigem Chrome 75+ — atualize o Android System WebView para executar Luau no aparelho.`;
      }
      return message;
    }
  })();
  return supportCheck;
}

function connect(): LuaWorker {
  if (client) return client;
  const endpoint = workerEndpoint();
  const worker = new LuaWorker({
    workerUrl: endpoint.href,
    // Script clássico de propósito: sem `type: 'module'`.
    worker: (kind) => new Worker(endpoint.href, { name: `luau-rs-${kind}` }),
  });
  worker.addEventListener('print', (event) => {
    if (!sink || sink.length >= MAX_LINES) return;
    sink.push(event.text);
  });
  client = worker;
  ready = false;
  return worker;
}

/**
 * Garante o runtime pronto antes de contar o tempo do script. Sem isso, a
 * primeira execução (que carrega 2,4 MB de wasm e instancia a VM) competia com
 * o limite de execução e um `print` trivial podia estourar o prazo.
 */
async function warmUp(worker: LuaWorker, request: RunRequest, external?: AbortSignal): Promise<void> {
  if (ready) return;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), INIT_TIMEOUT_MS);
  const started = performance.now();
  const onCancel = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener('abort', onCancel, { once: true });
  }
  try {
    await worker.execute('-- aquecimento do runtime', { timing: false, signal: controller.signal });
    ready = true;
    const elapsed = Math.round(performance.now() - started);
    if (elapsed > 1500) emit(request, 'meta', `runtime do Luau carregado em ${elapsed} ms`);
  } finally {
    window.clearTimeout(timer);
    external?.removeEventListener('abort', onCancel);
  }
}

function formatValue(value: DetachedLuaValue): string {
  if (value === null) return 'nil';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') return String(value);
  if (value instanceof Uint8Array) return `buffer(${value.length})`;
  if (Array.isArray(value)) return `{${value.map(formatValue).join(', ')}}`;
  if (value instanceof Map) {
    const entries = Array.from(value.entries()).map(([key, item]) => `[${formatValue(key)}] = ${formatValue(item)}`);
    return `{${entries.join(', ')}}`;
  }
  if (typeof value === 'object' && 'x' in value && 'y' in value && 'z' in value) {
    return `${value.x}, ${value.y}, ${value.z}`;
  }
  const record = value as Record<string, DetachedLuaValue>;
  return `{${Object.entries(record)
    .map(([key, item]) => `${key} = ${formatValue(item)}`)
    .join(', ')}}`;
}

function withArguments(source: string, args: string[]): string {
  if (!args.length) return source;
  const table = args.map((value) => JSON.stringify(value)).join(', ');
  return `local arg = {${table}}; ${source}`;
}

export async function runLuau(request: RunRequest): Promise<RunResult> {
  const started = performance.now();
  const lines: string[] = [];
  sink = lines;
  const flush = () => {
    if (!lines.length) return;
    emit(request, 'stdout', lines.join('\n'));
    lines.length = 0;
  };

  const unsupported = await checkWebAssemblySupport();
  if (unsupported) {
    emit(request, 'stderr', `✖ ${unsupported}`);
    return {
      ok: false,
      exitCode: 1,
      durationMs: Math.round(performance.now() - started),
      engine: 'Luau (WASM)',
      location: 'local',
    };
  }

  const controller = new AbortController();
  const cancel = () => controller.abort();
  let timer = 0;

  if (request.signal) {
    if (request.signal.aborted) controller.abort();
    else request.signal.addEventListener('abort', cancel, { once: true });
  }

  try {
    const worker = connect();
    await warmUp(worker, request, request.signal);

    if (controller.signal.aborted) throw new Error('execução cancelada');

    timer = window.setTimeout(cancel, EXEC_TIMEOUT_MS);
    const { result, durationMs } = await worker.execute(withArguments(request.source, request.args ?? []), {
      entryName: request.filename,
      timing: true,
      signal: controller.signal,
    });
    window.clearTimeout(timer);
    flush();

    if (!result.ok) {
      const message = result.error?.message ?? 'erro desconhecido';
      emit(request, 'stderr', `✖ ${message}`);
      if (result.error?.kind === 'interrupted') {
        emit(request, 'stderr', '  execução interrompida (loop infinito ou limite de instruções atingido)');
      } else if (result.error?.kind === 'memory') {
        emit(request, 'stderr', '  memória do script esgotada (limite de 32 MB)');
      } else if (result.error?.kind === 'syntax' || result.error?.kind === 'compile') {
        emit(request, 'stderr', '  corrija o erro de sintaxe e execute novamente');
      }
      return {
        ok: false,
        exitCode: 1,
        durationMs: Math.round(durationMs),
        engine: 'Luau (WASM)',
        location: 'local',
        cancelled: controller.signal.aborted,
      };
    }

    if (result.values.length) {
      emit(request, 'stdout', `→ ${result.values.map(formatValue).join('  ')}`);
    }
    if (result.outputTruncated) {
      emit(request, 'meta', `saída truncada em ${MAX_LINES} linhas`);
    }
    return {
      ok: true,
      exitCode: 0,
      durationMs: Math.round(durationMs),
      engine: 'Luau (WASM)',
      location: 'local',
    };
  } catch (error) {
    window.clearTimeout(timer);
    flush();
    dispose();
    const aborted = controller.signal.aborted;
    const message = error instanceof Error ? error.message : String(error);
    if (aborted) {
      emit(request, 'stderr', `✖ tempo limite de ${EXEC_TIMEOUT_MS / 1000}s excedido (execução interrompida)`);
      emit(request, 'meta', 'o runtime continuou disponível; ajuste o script e execute de novo');
    } else {
      emit(request, 'stderr', `✖ ${message}`);
      if (/worker|module|import|wasm|webassembly|syntax/i.test(message)) {
        emit(
          request,
          'meta',
          'o worker do Luau não iniciou neste WebView. Atualize o Android System WebView/Chrome e tente novamente.',
        );
      }
    }
    return {
      ok: false,
      exitCode: 1,
      durationMs: Math.round(performance.now() - started),
      engine: 'Luau (WASM)',
      location: 'local',
      cancelled: aborted,
    };
  } finally {
    sink = null;
  }
}
