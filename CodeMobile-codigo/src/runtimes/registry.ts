/** Ponto único que resolve qual motor executa cada linguagem. */

import { languageById } from '../editor/languages';
import { runLuau } from './luauEngine';
import { runPistonRemote } from './piston';
import { runSql } from './sqlEngine';
import { emit, type RunRequest, type RunResult } from './types';
import { runWebScript } from './webEngine';

export type RuntimeBadge = {
  runnable: boolean;
  location: 'local' | 'remote' | null;
  label: string;
};

export function describeRuntime(languageId: string): RuntimeBadge {
  const language = languageById(languageId);
  if (!language || !language.engine) {
    return { runnable: false, location: null, label: '' };
  }
  switch (language.engine) {
    case 'js':
      return { runnable: true, location: 'local', label: 'JavaScript · WebView' };
    case 'ts':
      return { runnable: true, location: 'local', label: 'TypeScript · Babel + WebView' };
    case 'luau':
      return { runnable: true, location: 'local', label: 'Luau · WebAssembly' };
    case 'lua':
      return { runnable: true, location: 'local', label: 'Lua · Luau WebAssembly' };
    case 'sql':
      return { runnable: true, location: 'local', label: 'SQL · SQLite (WASM)' };
    case 'shell':
      return { runnable: true, location: 'local', label: 'Shell · terminal integrado' };
    case 'piston':
      return { runnable: true, location: 'remote', label: `${languageLabel(languageId)} · Piston` };
    default:
      return { runnable: false, location: null, label: '' };
  }
}

function languageLabel(id: string): string {
  return languageById(id)?.label ?? id;
}

export type RunOptions = {
  pistonEndpoint: string;
};

export async function runFile(request: RunRequest, options: RunOptions): Promise<RunResult> {
  const language = languageById(request.language);
  if (!language) {
    emit(request, 'stderr', '✖ linguagem desconhecida');
    return { ok: false, exitCode: 1, durationMs: 0, engine: 'none', location: 'local' };
  }

  switch (language.engine) {
    case 'js':
    case 'ts':
    case null:
      if (language.engine === null) {
        emit(request, 'stderr', `✖ ${language.label} não é um programa executável neste ambiente.`);
        if (language.preview) emit(request, 'meta', 'use o painel Preview para ver o resultado');
        return { ok: false, exitCode: 1, durationMs: 0, engine: 'none', location: 'local' };
      }
      return runWebScript(request);
    case 'luau':
    case 'lua':
      return runLuau(request);
    case 'sql':
      return runSql(request);
    case 'shell':
      emit(request, 'meta', 'scripts .sh são executados pelo terminal (comando: run arquivo.sh)');
      return { ok: false, exitCode: 1, durationMs: 0, engine: 'shell', location: 'local' };
    case 'piston': {
      if (!options.pistonEndpoint) {
        emit(request, 'stderr', '✖ serviço externo não configurado');
        emit(request, 'meta', 'Abra Ajustes → Runtimes e informe a URL do servidor Piston.');
        return { ok: false, exitCode: 1, durationMs: 0, engine: 'Piston', location: 'remote' };
      }
      return runPistonRemote(request, {
        endpoint: options.pistonEndpoint,
        pistonLanguage: language.piston ?? language.id,
      });
    }
    default:
      return { ok: false, exitCode: 1, durationMs: 0, engine: 'none', location: 'local' };
  }
}
