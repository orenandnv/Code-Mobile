/** Modelo de projeto: um workspace independente com nome e metadados. */

import type { Vfs } from './vfs';

export type Project = Vfs & {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

export type ProjectMeta = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  files: number;
};

export function createId(prefix = 'p'): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${random}`;
}

export function createProject(name: string, vfs: Vfs = { files: {}, folders: [] }): Project {
  const now = Date.now();
  return {
    id: createId(),
    name: name.trim() || 'Projeto',
    createdAt: now,
    updatedAt: now,
    files: { ...vfs.files },
    folders: [...vfs.folders],
  };
}

export function touch(project: Project): Project {
  return { ...project, updatedAt: Date.now() };
}

export function projectMeta(project: Project): ProjectMeta {
  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    files: Object.keys(project.files).length,
  };
}

export function uniqueProjectName(existing: Project[], base: string): string {
  const taken = new Set(existing.map((project) => project.name));
  if (!taken.has(base)) return base;
  let index = 2;
  while (taken.has(`${base} ${index}`)) index += 1;
  return `${base} ${index}`;
}
