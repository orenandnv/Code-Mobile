/** SQLite real no aparelho via sql.js (WebAssembly). */

import initSqlJs, { type Database } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { emit, type RunRequest, type RunResult } from './types';

type SqlJs = Awaited<ReturnType<typeof initSqlJs>>;

let sqlPromise: Promise<SqlJs> | null = null;

function loadSql(): Promise<SqlJs> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({ locateFile: () => wasmUrl });
  }
  return sqlPromise;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (value instanceof Uint8Array) return `<blob ${value.length}b>`;
  return String(value);
}

function formatTable(columns: string[], values: unknown[][]): string[] {
  const rows = values.map((row) => row.map(formatCell));
  const widths = columns.map((column, index) =>
    Math.max(column.length, ...rows.map((row) => (row[index] ?? '').length), 3),
  );
  const pad = (text: string, width: number) => text + ' '.repeat(Math.max(0, width - text.length));
  const line = (cells: string[]) => cells.map((cell, index) => pad(cell, widths[index])).join(' | ');
  const separator = widths.map((width) => '-'.repeat(width)).join('-+-');
  return [line(columns), separator, ...rows.map(line)];
}

export async function runSql(request: RunRequest): Promise<RunResult> {
  const started = performance.now();
  emit(request, 'meta', 'SQLite (sql.js, WebAssembly) — banco em memória');
  let db: Database | null = null;

  try {
    const SQL = await loadSql();
    db = new SQL.Database();
    const script = request.source;
    const statements = db.exec(script);

    if (!statements.length) {
      emit(request, 'stdout', 'Comando executado. Nenhum resultado retornado.');
    }
    for (const statement of statements) {
      emit(request, 'stdout', formatTable(statement.columns, statement.values).join('\n'));
      emit(request, 'meta', `${statement.values.length} linha(s)`);
    }
    return {
      ok: true,
      exitCode: 0,
      durationMs: Math.round(performance.now() - started),
      engine: 'SQLite (sql.js)',
      location: 'local',
    };
  } catch (error) {
    emit(request, 'stderr', `✖ ${error instanceof Error ? error.message : String(error)}`);
    return {
      ok: false,
      exitCode: 1,
      durationMs: Math.round(performance.now() - started),
      engine: 'SQLite (sql.js)',
      location: 'local',
    };
  } finally {
    try {
      db?.close();
    } catch {
      /* ignore */
    }
  }
}
