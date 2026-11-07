import { LuaWorker, type DetachedLuaValue } from '@luau-rs/luau/worker';

/** Executa scripts Luau de verdade (runtime oficial compilado para WebAssembly). */

const MAX_LINES = 400;
const TIMEOUT_MS = 15000;

export type ScriptRun = {
  ok: boolean;
  lines: string[];
  durationMs: number;
};

export const LUAU_EXTENSIONS = ['.luau', '.lua'];

let client: LuaWorker | null = null;
let sink: string[] | null = null;

function dispose() {
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
  const worker = new LuaWorker();
  worker.addEventListener('print', (event) => {
    if (!sink || sink.length >= MAX_LINES) return;
    sink.push(event.text);
  });
  client = worker;
  return worker;
}

function formatValue(value: DetachedLuaValue): string {
  if (value === null) return 'nil';
  if (typeof value === 'string') return `"${value}"`;
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

/** Expõe os argumentos da linha de comando como tabela `arg`, sem deslocar as linhas do script. */
function withArguments(source: string, args: string[]): string {
  if (!args.length) return source;
  const table = args.map((value) => JSON.stringify(value)).join(', ');
  return `local arg = {${table}}; ${source}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function runLuau(source: string, filename: string, args: string[] = []): Promise<ScriptRun> {
  const lines: string[] = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  sink = lines;

  try {
    const worker = connect();
    const { result, durationMs } = await worker.execute(withArguments(source, args), {
      entryName: filename,
      timing: true,
      signal: controller.signal,
    });

    if (!result.ok) {
      const message = result.error?.message ?? 'erro desconhecido';
      lines.push(`✖ ${message}`);
      if (result.error?.kind === 'interrupted') {
        lines.push('  execução interrompida (loop infinito ou limite de instruções atingido)');
      } else if (result.error?.kind === 'memory') {
        lines.push('  memória do script esgotada (limite de 32 MB)');
      } else if (result.error?.kind === 'syntax' || result.error?.kind === 'compile') {
        lines.push('  corrija o erro de sintaxe e execute novamente');
      }
      return { ok: false, lines, durationMs };
    }

    if (result.values.length) {
      lines.push(`→ ${result.values.map(formatValue).join('  ')}`);
    }
    if (result.outputTruncated) {
      lines.push(`  (saída truncada em ${MAX_LINES} linhas)`);
    }
    return { ok: true, lines, durationMs };
  } catch (error) {
    dispose();
    const aborted = controller.signal.aborted;
    lines.push(`✖ ${aborted ? `tempo limite de ${TIMEOUT_MS / 1000}s excedido` : errorMessage(error)}`);
    if (!aborted) lines.push('  não foi possível executar o interpretador Luau');
    return { ok: false, lines, durationMs: 0 };
  } finally {
    clearTimeout(timer);
    sink = null;
  }
}
