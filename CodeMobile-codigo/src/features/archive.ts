/** Importação e exportação de projetos em .zip (fflate, sem servidor). */

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { Vfs } from '../workspace/vfs';
import { ancestorsOf, normalizePath } from '../workspace/vfs';

const IGNORE = /(^|\/)(node_modules|\.git|dist|build|\.DS_Store)(\/|$)/;

export function exportProjectZip(name: string, vfs: Vfs): Blob {
  const entries: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(vfs.files)) {
    if (IGNORE.test(path)) continue;
    entries[path] = strToU8(content);
  }
  const data = zipSync(entries, { level: 6 });
  const copy = new Uint8Array(data.length);
  copy.set(data);
  return new Blob([copy], { type: 'application/zip', endings: 'native' } as BlobPropertyBag);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export type ImportedArchive = { name: string; vfs: Vfs };

export async function readZip(file: File): Promise<ImportedArchive> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const entries = unzipSync(buffer, {
    filter: (entry) => !IGNORE.test(entry.name) && !entry.name.endsWith('/'),
  });

  const files: Record<string, string> = {};
  let prefix: string | null = null;
  const names = Object.keys(entries);
  const topLevel = new Set(names.map((name) => name.split('/')[0]));
  if (topLevel.size === 1) {
    const [only] = Array.from(topLevel);
    if (names.every((name) => name.startsWith(`${only}/`))) prefix = `${only}/`;
  }

  for (const [name, data] of Object.entries(entries)) {
    if (data.length > 4_000_000) continue;
    const raw = strFromU8(data);
    if (raw.includes('\u0000')) continue;
    const path = normalizePath(prefix ? name.slice(prefix.length) : name);
    if (path) files[path] = raw;
  }

  const folders = Array.from(new Set(Object.keys(files).flatMap((path) => ancestorsOf(path))));
  return { name: file.name.replace(/\.zip$/i, ''), vfs: { files, folders } };
}

export const composeProjectZip = exportProjectZip;

export function projectFileName(name: string): string {
  return `${name.trim().toLowerCase().replace(/[^a-z0-9-_]+/gi, '-') || 'projeto'}.zip`;
}
