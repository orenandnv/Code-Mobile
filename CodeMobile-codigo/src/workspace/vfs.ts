/** Utilitários de caminhos e árvore de arquivos do workspace virtual. */

export type Vfs = {
  files: Record<string, string>;
  folders: string[];
};

export type EntryType = 'file' | 'folder';
export type Entry = { path: string; name: string; type: EntryType; depth: number };

export function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const raw of path.replace(/\\/g, '/').split('/')) {
    if (!raw || raw === '.') continue;
    if (raw === '..') {
      parts.pop();
      continue;
    }
    parts.push(raw);
  }
  return parts.join('/');
}

export function dirname(path: string): string {
  const index = path.lastIndexOf('/');
  return index <= 0 ? '' : path.slice(0, index);
}

export function basename(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? path : path.slice(index + 1);
}

export function extname(path: string): string {
  const name = basename(path);
  const index = name.lastIndexOf('.');
  if (index <= 0) return '';
  return name.slice(index + 1).toLowerCase();
}

export function stem(path: string): string {
  const name = basename(path);
  const index = name.lastIndexOf('.');
  return index <= 0 ? name : name.slice(0, index);
}

export function joinPath(dir: string, name: string): string {
  return normalizePath(dir ? `${dir}/${name}` : name);
}

export function resolvePath(cwd: string, input: string): string {
  if (!input) return normalizePath(cwd);
  if (input.startsWith('/')) return normalizePath(input);
  return normalizePath(cwd ? `${cwd}/${input}` : input);
}

export function isUnder(path: string, dir: string): boolean {
  return path === dir || path.startsWith(`${dir}/`);
}

export function replacePrefix(path: string, from: string, to: string): string {
  if (path === from) return to;
  if (path.startsWith(`${from}/`)) return `${to}${path.slice(from.length)}`;
  return path;
}

export function sortEntries(a: Entry, b: Entry): number {
  if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
  return a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' });
}

export function entriesIn(vfs: Vfs, dir: string): Entry[] {
  const folders: Entry[] = vfs.folders
    .filter((folder) => dirname(folder) === dir && folder !== dir)
    .map((folder) => ({ path: folder, name: basename(folder), type: 'folder' as const, depth: 0 }));
  const files: Entry[] = Object.keys(vfs.files)
    .filter((file) => dirname(file) === dir)
    .map((file) => ({ path: file, name: basename(file), type: 'file' as const, depth: 0 }));
  return [...folders, ...files].sort(sortEntries);
}

/** Lista hierárquica completa (usada pelo explorador). */
export function treeEntries(vfs: Vfs, expanded: Record<string, boolean>): Entry[] {
  const result: Entry[] = [];
  const walk = (dir: string, depth: number) => {
    for (const entry of entriesIn(vfs, dir)) {
      result.push({ ...entry, depth });
      if (entry.type === 'folder' && expanded[entry.path]) walk(entry.path, depth + 1);
    }
  };
  walk('', 0);
  return result;
}

export function filePaths(vfs: Vfs): string[] {
  return Object.keys(vfs.files).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function allPaths(vfs: Vfs): string[] {
  return [...vfs.folders, ...Object.keys(vfs.files)];
}

export function ancestorsOf(path: string): string[] {
  const parents: string[] = [];
  let parent = dirname(path);
  while (parent) {
    parents.push(parent);
    parent = dirname(parent);
  }
  return parents;
}

export function withFolders(vfs: Vfs, folders: string[]): Vfs {
  return { ...vfs, folders: Array.from(new Set([...vfs.folders, ...folders])) };
}

export function writeFile(vfs: Vfs, path: string, content: string): Vfs {
  return withFolders({ ...vfs, files: { ...vfs.files, [path]: content } }, ancestorsOf(path));
}

export function removePath(vfs: Vfs, path: string): Vfs {
  const files: Record<string, string> = {};
  for (const [file, content] of Object.entries(vfs.files)) {
    if (!isUnder(file, path)) files[file] = content;
  }
  const folders = vfs.folders.filter((folder) => !isUnder(folder, path));
  return { files, folders };
}

export function movePath(vfs: Vfs, from: string, to: string): Vfs {
  const files: Record<string, string> = {};
  for (const [file, content] of Object.entries(vfs.files)) files[replacePrefix(file, from, to)] = content;
  const folders = vfs.folders.map((folder) => replacePrefix(folder, from, to));
  return { files, folders: Array.from(new Set(folders)) };
}

export function isFolder(vfs: Vfs, path: string): boolean {
  // A raiz do projeto sempre existe, mesmo sem pastas declaradas.
  return path === '' || vfs.folders.includes(path);
}

export function sizeOf(content: string): number {
  return new TextEncoder().encode(content).length;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
