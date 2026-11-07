import type { ScriptRun } from './luauRuntime';
import { runLuau, LUAU_EXTENSIONS } from './luauRuntime';
import { languageForPath } from './languages';

const ENDPOINT_KEY = 'code-mobile:piston-endpoint';
const REQUEST_TIMEOUT_MS = 20000;
const OUTPUT_LIMIT = 12000;

const PISTON_LANGUAGE: Record<string, string> = {
  javascript: 'javascript', typescript: 'typescript', python: 'python',
  ruby: 'ruby', rust: 'rust', go: 'go', java: 'java', kotlin: 'kotlin',
  swift: 'swift', c: 'c', cpp: 'c++', csharp: 'csharp', php: 'php',
  shell: 'bash', lua: 'lua', perl: 'perl', r: 'rscript', dart: 'dart',
  powershell: 'powershell', zig: 'zig', elixir: 'elixir', sql: 'sqlite3',
};

const NOT_EXECUTABLE = new Set([
  'html', 'css', 'scss', 'less', 'json', 'markdown', 'yaml', 'ini',
  'xml', 'graphql', 'dockerfile', 'makefile', 'plaintext', 'bat',
]);

type PistonRuntime = { language: string; version: string; aliases?: string[] };
type PistonStream = { stdout?: string; stderr?: string; code?: number | null; signal?: string | null };
type PistonResponse = { language?: string; version?: string; run?: PistonStream; compile?: PistonStream };

let runtimesCache: { endpoint: string; expires: number; runtimes: PistonRuntime[] } | null = null;

export function getRuntimeEndpoint(): string {
  try { return localStorage.getItem(ENDPOINT_KEY)?.trim().replace(/\/+$/, '') ?? ''; }
  catch { return ''; }
}

export function setRuntimeEndpoint(value: string): void {
  const endpoint = value.trim().replace(/\/+$/, '');
  if (!endpoint) {
    localStorage.removeItem(ENDPOINT_KEY);
    runtimesCache = null;
    return;
  }
  const parsed = new URL(endpoint);
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw new Error('Use HTTPS; HTTP só é permitido em localhost.');
  }
  localStorage.setItem(ENDPOINT_KEY, endpoint);
  runtimesCache = null;
}

async function getRuntimes(endpoint: string, signal: AbortSignal): Promise<PistonRuntime[]> {
  if (runtimesCache?.endpoint === endpoint && runtimesCache.expires > Date.now()) return runtimesCache.runtimes;
  const response = await fetch(`${endpoint}/runtimes`, { signal });
  if (!response.ok) throw new Error(`Servidor de runtimes respondeu HTTP ${response.status}.`);
  const data = await response.json() as PistonRuntime[];
  if (!Array.isArray(data)) throw new Error('Resposta inválida ao consultar runtimes.');
  runtimesCache = { endpoint, expires: Date.now() + 5 * 60_000, runtimes: data };
  return data;
}

function appendStream(lines: string[], label: string, stream?: PistonStream): void {
  if (!stream) return;
  const stdout = stream.stdout?.trimEnd();
  const stderr = stream.stderr?.trimEnd();
  if (stdout) lines.push(...stdout.slice(0, OUTPUT_LIMIT).split('\n'));
  if (stderr) lines.push(...stderr.slice(0, OUTPUT_LIMIT).split('\n').map((line) => `[stderr] ${line}`));
  if (stream.code !== undefined && stream.code !== null && stream.code !== 0) lines.push(`${label}: processo terminou com código ${stream.code}`);
  if (stream.signal) lines.push(`${label}: sinal ${stream.signal}`);
}

export async function runCode(source: string, filename: string, language: string, args: string[] = []): Promise<ScriptRun> {
  const started = performance.now();
  if (LUAU_EXTENSIONS.includes(`.${filename.split('.').pop()?.toLowerCase() ?? ''}')) {
    return runLuau(source, filename, args);
  }

  const pistonLanguage = PISTON_LANGUAGE[language];
  if (!pistonLanguage) {
    const reason = NOT_EXECUTABLE.has(language)
      ? 'Este formato não é um programa executável. Use preview ou validação.'
      : `Ainda não há runtime configurado para ${language}.`;
    return { ok: false, lines: [`✖ ${reason}`], durationMs: 0 };
  }

  const endpoint = getRuntimeEndpoint();
  if (!endpoint) {
    return {
      ok: false,
      lines: [
        '✖ Runtime externo ainda não configurado.',
        'Configure um servidor Piston compatível no terminal:',
        '  runtime endpoint https://SEU-SERVIDOR/api/v2',
        'Veja CodeMobile-codigo/README.md para instalar o servidor.',
        'Atenção: o código-fonte será enviado ao servidor configurado.',
      ],
      durationMs: 0,
    };
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const runtimes = await getRuntimes(endpoint, controller.signal);
    const runtime = [...runtimes].reverse().find((item) =>
      item.language.toLowerCase() === pistonLanguage ||
      item.aliases?.some((alias) => alias.toLowerCase() === pistonLanguage),
    );
    if (!runtime) {
      return { ok: false, lines: [`✖ O servidor não oferece runtime para ${language} (${pistonLanguage}).`], durationMs: Math.round(performance.now() - started) };
    }

    const response = await fetch(`${endpoint}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        language: runtime.language,
        version: runtime.version,
        files: [{ name: filename, content: source }],
        args,
        stdin: '',
        compile_timeout: 10000,
        run_timeout: 10000,
        compile_memory_limit: 256000000,
        run_memory_limit: 256000000,
      }),
    });
    if (!response.ok) throw new Error(`Execução recusada: HTTP ${response.status}.`);
    const result = await response.json() as PistonResponse;
    const lines: string[] = [`Runtime: ${result.language ?? runtime.language} ${result.version ?? runtime.version}`];
    appendStream(lines, 'compilação', result.compile);
    appendStream(lines, 'execução', result.run);
    if (lines.length === 1) lines.push('(sem saída)');
    const ok = (result.compile?.code ?? 0) === 0 && (result.run?.code ?? 0) === 0 && !result.run?.signal;
    return { ok, lines, durationMs: Math.round(performance.now() - started) };
  } catch (error) {
    const message = controller.signal.aborted
      ? `tempo limite de ${REQUEST_TIMEOUT_MS / 1000}s excedido`
      : error instanceof Error ? error.message : String(error);
    return { ok: false, lines: [`✖ ${message}`, 'Verifique a URL, a conexão e a disponibilidade do servidor.'], durationMs: Math.round(performance.now() - started) };
  } finally {
    window.clearTimeout(timer);
  }
}

export function runtimeLanguageForPath(path: string): string {
  return languageForPath(path);
}
