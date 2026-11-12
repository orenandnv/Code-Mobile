/**
 * Luau real no aparelho: runtime oficial compilado para WebAssembly.
 * Também executa Lua (o Luau é compatível com a sintaxe de Lua 5.1).
 */

import { LuaWorker, type DetachedLuaValue } from '@luau-rs/luau/worker';
// O pacote resolve o worker por URL crua, o que não funciona depois do bundle.
// ?worker&url faz o Vite empacotar o entry do worker (com o WASM embutido).
import luauWorkerUrl from '../../node_modules/@luau-rs/luau/dist/worker.js?worker&url';
import { emit, type RunRequest, type RunResult } from './types';

const MAX_LINES = 400;
const TIMEOUT_MS = 15000;

let client: LuaWorker | null = null;
let sink: string[] | null = null;

function dispose(): void {
  if (!client) return;
  try {
    client.terminate();
  } catch {
    /* worker já encerrado */
  }
  client = null;
}

function connect(): LuaWorker {
  if (client) return client;
  const worker = new LuaWorker({ workerUrl: luauWorkerUrl });
  worker.addEventListener('print', (event) => {
    if (!sink || sink.length >= MAX_LINES) return;
    sink.push(event.text);
  });
  client = worker;
  return worker;
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  sink = lines;
  const flush = () => {
    if (!lines.length) return;
    emit(request, 'stdout', lines.join('\n'));
    lines.length = 0;
  };

  if (request.signal) {
    if (request.signal.aborted) controller.abort();
    else request.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const worker = connect();
    const { result, durationMs } = await worker.execute(withArguments(request.source, request.args ?? []), {
      entryName: request.filename,
      timing: true,
      signal: controller.signal,
    });
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
    flush();
    dispose();
    const aborted = controller.signal.aborted;
    const message = error instanceof Error ? error.message : String(error);
    emit(
      request,
      'stderr',
      `✖ ${aborted ? `tempo limite de ${TIMEOUT_MS / 1000}s excedido` : message}`,
    );
    // O worker do Luau é um módulo ES com WebAssembly; o WebView de fábrica do
    // Android 9 (Chromium 66) não cria module workers.
    if (!aborted && /worker|module|wasm|webassembly/i.test(message)) {
      emit(
        request,
        'meta',
        'O runtime Luau precisa de module workers + WebAssembly, que este WebView (Chromium 66) não oferece. Atualize o System WebView/Chrome do aparelho.',
      );
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
    clearTimeout(timer);
    sink = null;
  }
}
