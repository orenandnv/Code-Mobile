/**
 * Execução remota para linguagens compiladas que não rodam na WebView.
 * O app deixa explícito na interface que o código vai para um serviço externo.
 */

import { emit, type RunRequest, type RunResult } from './types';

const REQUEST_TIMEOUT_MS = 25000;

type PistonRuntime = { language: string; version: string; aliases?: string[] };
type PistonStream = {
  stdout?: string;
  stderr?: string;
  code?: number | null;
  signal?: string | null;
  status?: string | null;
  message?: string | null;
};
type PistonResponse = { language?: string; version?: string; run?: PistonStream; compile?: PistonStream };

let cache: { endpoint: string; expires: number; runtimes: PistonRuntime[] } | null = null;

async function fetchRuntimes(endpoint: string, signal: AbortSignal): Promise<PistonRuntime[]> {
  if (cache && cache.endpoint === endpoint && cache.expires > Date.now()) return cache.runtimes;
  const response = await fetch(`${endpoint}/runtimes`, { signal });
  if (!response.ok) throw new Error(`servidor respondeu HTTP ${response.status}`);
  const data = (await response.json()) as PistonRuntime[];
  if (!Array.isArray(data)) throw new Error('resposta inválida do servidor');
  cache = { endpoint, expires: Date.now() + 5 * 60_000, runtimes: data };
  return data;
}

function appendStream(request: RunRequest, label: string, stream?: PistonStream): void {
  if (!stream) return;
  const stdout = stream.stdout?.trimEnd();
  const stderr = stream.stderr?.trimEnd();
  if (stdout) emit(request, 'stdout', stdout.slice(0, 20000));
  if (stderr) emit(request, 'stderr', stderr.slice(0, 20000).split('\n').map((line) => `[${label}] ${line}`).join('\n'));
  if (stream.code !== undefined && stream.code !== null && stream.code !== 0) {
    emit(request, 'stderr', `${label}: terminou com código ${stream.code}`);
  }
  if (stream.signal) emit(request, 'stderr', `${label}: sinal ${stream.signal}`);
  if (stream.message) emit(request, 'stderr', `${label}: ${stream.message}`);
  if (stream.status && stream.status !== 'ok') emit(request, 'stderr', `${label}: status ${stream.status}`);
}

export async function runPistonRemote(
  request: RunRequest,
  options: { endpoint: string; pistonLanguage: string },
): Promise<RunResult> {
  const started = performance.now();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  if (request.signal) {
    if (request.signal.aborted) controller.abort();
    else request.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const runtimes = await fetchRuntimes(options.endpoint, controller.signal);
    const wanted = options.pistonLanguage.toLowerCase();
    const runtime = [...runtimes]
      .reverse()
      .find(
        (item) => item.language.toLowerCase() === wanted || item.aliases?.some((alias) => alias.toLowerCase() === wanted),
      );
    if (!runtime) {
      emit(request, 'stderr', `✖ o servidor não oferece o runtime "${options.pistonLanguage}"`);
      return {
        ok: false,
        exitCode: 1,
        durationMs: Math.round(performance.now() - started),
        engine: 'Piston',
        location: 'remote',
      };
    }

    emit(request, 'meta', `serviço externo: ${options.endpoint} · ${runtime.language} ${runtime.version}`);
    const response = await fetch(`${options.endpoint}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        language: runtime.language,
        version: runtime.version,
        files: [{ name: request.filename, content: request.source }],
        args: request.args ?? [],
        stdin: request.stdin ?? '',
        compile_timeout: 10000,
        run_timeout: 10000,
        compile_memory_limit: 256000000,
        run_memory_limit: 256000000,
      }),
    });
    if (!response.ok) throw new Error(`execução recusada: HTTP ${response.status}`);
    const result = (await response.json()) as PistonResponse;
    appendStream(request, 'compilação', result.compile);
    appendStream(request, 'execução', result.run);

    const compileOk = !result.compile || ((result.compile.code ?? 0) === 0 && !result.compile.status && !result.compile.message);
    const runOk = !result.run || ((result.run.code ?? 0) === 0 && !result.run.signal && !result.run.status && !result.run.message);
    return {
      ok: compileOk && runOk,
      exitCode: result.run?.code ?? (result.compile?.code ?? 0),
      durationMs: Math.round(performance.now() - started),
      engine: 'Piston',
      location: 'remote',
      cancelled: controller.signal.aborted,
    };
  } catch (error) {
    const aborted = controller.signal.aborted;
    emit(
      request,
      'stderr',
      `✖ ${aborted ? `tempo limite de ${REQUEST_TIMEOUT_MS / 1000}s excedido` : error instanceof Error ? error.message : String(error)}`,
    );
    emit(request, 'meta', 'verifique a URL, a conexão e a disponibilidade do servidor');
    return {
      ok: false,
      exitCode: 1,
      durationMs: Math.round(performance.now() - started),
      engine: 'Piston',
      location: 'remote',
      cancelled: aborted,
    };
  } finally {
    window.clearTimeout(timer);
  }
}
