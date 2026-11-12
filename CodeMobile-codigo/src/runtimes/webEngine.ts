/**
 * Motor local para JavaScript/TypeScript/JSX/TSX.
 *
 * O código é transpilado com Babel (ESM → CommonJS, tipos removidos, JSX
 * convertido) e executado em um Web Worker isolado, com console capturado,
 * entrada padrão e limite de tempo. Arquivos do projeto podem ser importados
 * entre si por caminho relativo.
 */

import * as Babel from '@babel/standalone';
import { basename, dirname, normalizePath } from '../workspace/vfs';
import { emit, type RunRequest, type RunResult } from './types';

const TIMEOUT_MS = 15000;
const MAX_MODULE_FILES = 60;
const SCRIPT_EXTENSIONS = /\.(js|mjs|cjs|ts|mts|cts|jsx|tsx)$/i;

const WORKER_SOURCE = `
const format = (value) => {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.stack || String(value);
  if (typeof value === 'function') return '[function ' + (value.name || 'anonymous') + ']';
  try {
    const json = JSON.stringify(value);
    return json === undefined ? String(value) : json;
  } catch (error) {
    return String(value);
  }
};

self.onmessage = async (event) => {
  const data = event.data || {};
  const modules = data.modules || {};
  const cache = {};
  const stdin = String(data.stdin || '').split('\\n');
  let cursor = 0;

  const send = (stream, text) => self.postMessage({ type: 'out', stream: stream, text: String(text) });
  const print = (...args) => send('stdout', args.map(format).join(' '));
  const consoleShim = {
    log: print,
    info: print,
    debug: print,
    table: print,
    trace: print,
    dir: print,
    warn: (...args) => send('stderr', args.map(format).join(' ')),
    error: (...args) => send('stderr', args.map(format).join(' ')),
  };
  const readLine = () => {
    if (cursor >= stdin.length) return null;
    const line = stdin[cursor];
    cursor += 1;
    return line;
  };

  const normal = (path) => {
    const parts = [];
    for (const part of String(path).split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') { parts.pop(); continue; }
      parts.push(part);
    }
    return parts.join('/');
  };

  const resolve = (fromId, spec) => {
    if (spec.charAt(0) !== '.') throw new Error('Módulo externo indisponível: ' + spec);
    const base = normal((fromId.indexOf('/') === -1 ? '' : fromId.slice(0, fromId.lastIndexOf('/'))) + '/' + spec);
    const candidates = [base, base + '.js', base + '.ts', base + '.jsx', base + '.tsx', base + '/index.js', base + '/index.ts'];
    for (const candidate of candidates) {
      if (Object.prototype.hasOwnProperty.call(modules, candidate)) return candidate;
    }
    throw new Error('Módulo não encontrado: ' + spec);
  };

  const load = (id) => {
    if (cache[id]) return cache[id].exports;
    const source = modules[id];
    if (source === undefined) throw new Error('Módulo não encontrado: ' + id);
    const module = { exports: {} };
    cache[id] = module;
    const localRequire = (spec) => load(resolve(id, spec));
    const fn = new Function('require', 'module', 'exports', 'console', 'print', 'readLine', source);
    fn(localRequire, module, module.exports, consoleShim, print, readLine);
    return module.exports;
  };

  let code = 0;
  try {
    load(data.entry);
  } catch (error) {
    send('stderr', error && error.stack ? error.stack : String(error));
    code = 1;
  }
  self.postMessage({ type: 'done', code: code });
};
`;

let workerUrl: string | null = null;

function getWorkerUrl(): string {
  if (!workerUrl) {
    workerUrl = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
  }
  return workerUrl;
}

export function transpile(source: string, filename: string): string {
  const isTypeScript = /\.(ts|mts|cts|tsx)$/i.test(filename);
  const isTsx = /\.tsx$/i.test(filename);
  const isJsx = /\.(jsx|tsx)$/i.test(filename);
  // O preset-typescript só entra em arquivos TS. Aplicado a .js ele passa a
  // interpretar o arquivo como TypeScript e, no WebView do Android 9
  // (Chrome 66), o Babel 7 lança "Identifier 'X' has already been declared"
  // para código JavaScript válido. .js/.jsx não precisam de strip de tipos.
  const presets: unknown[] = [
    ['env', { modules: 'commonjs', targets: { chrome: '100' } }],
    ['react', { runtime: 'classic' }],
  ];
  if (isTypeScript) presets.push(['typescript', { allExtensions: true, isTSX: isTsx || isJsx }]);
  try {
    const result = Babel.transform(source, {
      filename,
      presets: presets as never,
      sourceType: 'unambiguous',
      comments: false,
    });
    return result.code ?? source;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message);
  }
}

type Modules = Record<string, string>;

function buildModules(request: RunRequest): { modules: Modules; entry: string } {
  const entry = normalizePath(request.filename);
  const modules: Modules = {};
  const files = request.files ?? {};
  let count = 0;

  for (const [path, content] of Object.entries(files)) {
    if (!SCRIPT_EXTENSIONS.test(path)) continue;
    if (count >= MAX_MODULE_FILES) break;
    count += 1;
    try {
      modules[normalizePath(path)] = transpile(content, basename(path));
    } catch {
      // Arquivos com erro de sintaxe só falham se forem realmente importados.
      modules[normalizePath(path)] = content;
    }
  }

  try {
    modules[entry] = transpile(request.source, basename(entry));
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
  return { modules, entry };
}

export async function runWebScript(request: RunRequest): Promise<RunResult> {
  const started = performance.now();
  let built: { modules: Modules; entry: string };
  try {
    built = buildModules(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // O Babel 7 não transpila TypeScript no WebView de fábrica do Android 9
    // (Chromium 66): qualquer declaração de tipo quebra com "already declared"
    // dentro do preset-typescript. Melhor dizer o motivo do que fingir que
    // o arquivo tem erro de sintaxe.
    const isTypeScriptFile = /\.(ts|tsx|mts|cts)$/i.test(request.filename);
    const hint =
      isTypeScriptFile && /already been declared/i.test(message)
        ? '\nO transpilador de TypeScript não funciona neste WebView (Chromium 66). Atualize o System WebView/Chrome do aparelho para executar .ts.'
        : '';
    emit(request, 'stderr', `✖ ${message}${hint}`);
    return {
      ok: false,
      exitCode: 1,
      durationMs: Math.round(performance.now() - started),
      engine: 'WebView + Babel',
      location: 'local',
    };
  }

  const worker = new Worker(getWorkerUrl());
  let cancelled = false;

  const result = await new Promise<{ code: number | null; okay: boolean }>((resolve) => {
    const finish = (code: number | null) => {
      window.clearTimeout(timer);
      worker.terminate();
      resolve({ code, okay: code === 0 });
    };

    const timer = window.setTimeout(() => {
      emit(request, 'stderr', `✖ tempo limite de ${TIMEOUT_MS / 1000}s excedido (processo interrompido)`);
      finish(null);
    }, TIMEOUT_MS);

    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as
        | { type: 'out'; stream: 'stdout' | 'stderr'; text: string }
        | { type: 'done'; code: number };
      if (data.type === 'out') {
        emit(request, data.stream, data.text);
        return;
      }
      finish(data.code);
    };

    worker.onerror = (event: ErrorEvent) => {
      emit(request, 'stderr', `✖ ${event.message || 'erro no worker'}`);
      finish(1);
    };

    const onAbort = () => {
      cancelled = true;
      emit(request, 'meta', 'processo interrompido');
      finish(null);
    };
    if (request.signal) {
      if (request.signal.aborted) onAbort();
      else request.signal.addEventListener('abort', onAbort, { once: true });
    }

    worker.postMessage({
      modules: built.modules,
      entry: built.entry,
      stdin: request.stdin ?? '',
    });
  });

  return {
    ok: result.okay && !cancelled,
    exitCode: result.code,
    durationMs: Math.round(performance.now() - started),
    engine: 'WebView + Babel',
    location: 'local',
    cancelled,
  };
}

export function supportsModule(path: string): boolean {
  return SCRIPT_EXTENSIONS.test(path);
}

export function moduleDir(path: string): string {
  return dirname(normalizePath(path));
}
