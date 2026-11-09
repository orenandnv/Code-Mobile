/** Integração real com o GitHub (REST API v3) a partir do aparelho. */

import type { Vfs } from '../workspace/vfs';

const API = 'https://api.github.com';

export type GitConfig = { owner: string; repo: string; branch: string; token: string };

export type RemoteFile = { sha: string; content: string };

export type CommitInfo = { sha: string; message: string; date: string; author: string };

export type PushResult = { updated: string[]; errors: string[]; commitUrl?: string };

export function gitConfigured(config: GitConfig): boolean {
  return Boolean(config.owner && config.repo && config.token);
}

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value: string): string {
  const binary = atob(value.replace(/\n/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}

async function request<T>(config: GitConfig, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`GitHub HTTP ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ''}`);
  }
  return (await response.json()) as T;
}

export async function getRemoteFile(config: GitConfig, path: string): Promise<RemoteFile | null> {
  try {
    const data = await request<{ sha: string; content: string; encoding: string }>(
      config,
      `/repos/${config.owner}/${config.repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(config.branch)}`,
    );
    return { sha: data.sha, content: data.encoding === 'base64' ? decodeBase64(data.content) : data.content };
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) return null;
    throw error;
  }
}

export async function listCommits(config: GitConfig, limit = 10): Promise<CommitInfo[]> {
  const data = await request<
    { sha: string; commit: { message: string; author: { date: string; name: string } } }[]
  >(config, `/repos/${config.owner}/${config.repo}/commits?sha=${encodeURIComponent(config.branch)}&per_page=${limit}`);
  return data.map((item) => ({
    sha: item.sha.slice(0, 7),
    message: item.commit.message.split('\n')[0],
    date: item.commit.author.date,
    author: item.commit.author.name,
  }));
}

/**
 * Envia os arquivos alterados. Cada arquivo é comparado com o remoto antes de
 * escrever, então um push repetido não gera commits vazios.
 */
export async function pushProject(
  config: GitConfig,
  vfs: Vfs,
  message: string,
  onProgress?: (path: string, index: number, total: number) => void,
): Promise<PushResult> {
  const paths = Object.keys(vfs.files).sort();
  const updated: string[] = [];
  const errors: string[] = [];
  let index = 0;

  for (const path of paths) {
    index += 1;
    onProgress?.(path, index, paths.length);
    const content = vfs.files[path];
    try {
      const remote = await getRemoteFile(config, path);
      if (remote && remote.content === content) continue;
      await request(config, `/repos/${config.owner}/${config.repo}/contents/${encodeURI(path)}`, {
        method: 'PUT',
        body: JSON.stringify({
          message: message || `Atualiza ${path}`,
          content: encodeBase64(content),
          branch: config.branch,
          ...(remote ? { sha: remote.sha } : {}),
        }),
      });
      updated.push(path);
    } catch (error) {
      errors.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { updated, errors };
}

export type DiffLine = { type: 'same' | 'added' | 'removed'; text: string };

/** Diff linha a linha (LCS) para o visualizador. */
export function diffLines(local: string, remote: string): DiffLine[] {
  const left = local.split('\n');
  const right = remote.split('\n');
  const limit = 400;
  const table: number[][] = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));

  for (let row = left.length - 1; row >= 0; row -= 1) {
    for (let column = right.length - 1; column >= 0; column -= 1) {
      table[row][column] =
        left[row] === right[column] ? table[row + 1][column + 1] + 1 : Math.max(table[row + 1][column], table[row][column + 1]);
    }
  }

  const result: DiffLine[] = [];
  let row = 0;
  let column = 0;
  while (row < left.length && column < right.length && result.length < limit) {
    if (left[row] === right[column]) {
      result.push({ type: 'same', text: left[row] });
      row += 1;
      column += 1;
    } else if (table[row + 1][column] >= table[row][column + 1]) {
      result.push({ type: 'removed', text: left[row] });
      row += 1;
    } else {
      result.push({ type: 'added', text: right[column] });
      column += 1;
    }
  }
  while (row < left.length && result.length < limit) {
    result.push({ type: 'removed', text: left[row] });
    row += 1;
  }
  while (column < right.length && result.length < limit) {
    result.push({ type: 'added', text: right[column] });
    column += 1;
  }
  return result;
}

/** Arquivos locais que diferem do remoto (para a lista de alterações). */
export async function changedFiles(config: GitConfig, vfs: Vfs): Promise<{ path: string; status: 'new' | 'modified' | 'same' }[]> {
  const result: { path: string; status: 'new' | 'modified' | 'same' }[] = [];
  for (const [path, content] of Object.entries(vfs.files)) {
    try {
      const remote = await getRemoteFile(config, path);
      if (!remote) result.push({ path, status: 'new' });
      else if (remote.content !== content) result.push({ path, status: 'modified' });
      else result.push({ path, status: 'same' });
    } catch {
      result.push({ path, status: 'modified' });
    }
  }
  return result;
}
