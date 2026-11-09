/**
 * Salvamento inteligente.
 *
 * - grava a cada 5 minutos (configurável) e também quando uma estrutura
 *   sintática é concluída (end, }, ), endif, fi, done, dedent…);
 * - mantém um snapshot de recuperação com abas, arquivo ativo e buffers, para
 *   sobreviver a um fechamento inesperado do app;
 * - nunca apaga o conteúdo do disco antes de ter uma versão válida em mãos.
 */

import { kvDel, kvGet, kvSet } from '../core/kv';
import type { Settings } from '../core/settings';
import { kvGet as read } from '../core/kv';

export type RecoverySnapshot = {
  projectId: string;
  savedAt: number;
  tabs: string[];
  active: string | null;
  buffers: Record<string, string>;
  cursor?: { line: number; column: number };
};

const BLOCK_ENDINGS: Record<string, RegExp> = {
  luau: /(^|\n)\s*(end|until)\b\s*$/,
  lua: /(^|\n)\s*(end|until)\b\s*$/,
  python: /(^|\n)\s*(pass|return|break|continue|[A-Za-z_][\w.]*\(.*\))\s*$/,
  ruby: /(^|\n)\s*end\s*$/,
  elixir: /(^|\n)\s*end\s*$/,
  kotlin: /(^|\n)\s*}\s*$/,
  java: /(^|\n)\s*}\s*$/,
  c: /(^|\n)\s*}\s*$/,
  cpp: /(^|\n)\s*}\s*$/,
  csharp: /(^|\n)\s*}\s*$/,
  javascript: /(^|\n)\s*}\s*;?\s*$/,
  typescript: /(^|\n)\s*}\s*;?\s*$/,
  jsx: /(^|\n)\s*}\s*;?\s*$/,
  tsx: /(^|\n)\s*}\s*;?\s*$/,
  go: /(^|\n)\s*}\s*$/,
  rust: /(^|\n)\s*}\s*$/,
  swift: /(^|\n)\s*}\s*$/,
  dart: /(^|\n)\s*}\s*$/,
  php: /(^|\n)\s*}\s*$/,
  shell: /(^|\n)\s*(fi|done|esac)\s*$/,
  sql: /;\s*$/,
  yaml: /:\s*$/,
};

/** Detecta o fechamento de uma estrutura na última alteração. */
export function isStructuralCompletion(previous: string, next: string, language: string): boolean {
  if (next.length <= previous.length) return false;
  const pattern = BLOCK_ENDINGS[language];
  if (!pattern) {
    // Linguagens sem regra própria: salva ao fechar parênteses/colchetes de bloco.
    return /\}\s*$|\]\s*$|\)\s*$/m.test(next.slice(-3)) && /\n$/.test(next) === false;
  }
  return pattern.test(next.slice(Math.max(0, next.length - 120)));
}

export function autosaveInterval(settings: Settings): number {
  return Math.max(30_000, settings.autoSaveIntervalMs || 5 * 60_000);
}

export async function writeRecovery(snapshot: RecoverySnapshot): Promise<void> {
  await kvSet(`recovery:${snapshot.projectId}`, snapshot);
}

export async function readRecovery(projectId: string): Promise<RecoverySnapshot | null> {
  const snapshot = await kvGet<RecoverySnapshot>(`recovery:${projectId}`);
  if (!snapshot) return null;
  const hasContent = Object.values(snapshot.buffers ?? {}).some((value) => typeof value === 'string');
  return hasContent ? snapshot : null;
}

export async function clearRecovery(projectId: string): Promise<void> {
  await kvDel(`recovery:${projectId}`);
}

export async function loadProjectSession(projectId: string): Promise<{ tabs: string[]; active: string | null } | null> {
  return read(`session:${projectId}`);
}

export async function saveProjectSession(
  projectId: string,
  session: { tabs: string[]; active: string | null; cursor?: { line: number; column: number } },
): Promise<void> {
  await kvSet(`session:${projectId}`, session);
}
