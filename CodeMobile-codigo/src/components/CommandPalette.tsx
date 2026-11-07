import { useEffect, useMemo, useRef, useState } from 'react';
import { basename } from '../lib/vfs';
import { Icon } from './Icon';

export type Command = {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
};

type Row =
  | { kind: 'file'; key: string; label: string; detail: string; run: () => void }
  | { kind: 'command'; key: string; label: string; detail: string; run: () => void };

function score(text: string, query: string): number {
  if (!query) return 0;
  const target = text.toLowerCase();
  const needle = query.toLowerCase();
  const direct = target.indexOf(needle);
  if (direct !== -1) return 1000 - direct + (target.startsWith(needle) ? 500 : 0);

  let cursor = 0;
  let matched = 0;
  for (const char of needle) {
    const found = target.indexOf(char, cursor);
    if (found === -1) return -1;
    cursor = found + 1;
    matched += 1;
  }
  return matched;
}

export default function CommandPalette({
  commands,
  files,
  initialQuery,
  onClose,
  onOpenFile,
}: {
  commands: Command[];
  files: string[];
  initialQuery: string;
  onClose: () => void;
  onOpenFile: (path: string) => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const isCommandMode = query.startsWith('>');
  const search = isCommandMode ? query.slice(1).trim() : query.trim();

  const rows = useMemo<Row[]>(() => {
    if (isCommandMode) {
      return commands
        .map((command) => ({ command, rank: score(command.label, search) }))
        .filter((item) => item.rank >= 0)
        .sort((a, b) => b.rank - a.rank)
        .map(({ command }) => ({
          kind: 'command' as const,
          key: `command:${command.id}`,
          label: command.label,
          detail: command.hint ?? '',
          run: command.run,
        }));
    }

    const fileRows = files
      .map((path) => ({ path, rank: score(path, search) }))
      .filter((item) => item.rank >= 0)
      .sort((a, b) => b.rank - a.rank || a.path.localeCompare(b.path))
      .slice(0, 80)
      .map(({ path }) => ({
        kind: 'file' as const,
        key: `file:${path}`,
        label: basename(path),
        detail: path,
        run: () => onOpenFile(path),
      }));

    if (fileRows.length) return fileRows;

    return commands
      .map((command) => ({ command, rank: score(command.label, search) }))
      .filter((item) => item.rank >= 0)
      .slice(0, 30)
      .map(({ command }) => ({
        kind: 'command' as const,
        key: `command:${command.id}`,
        label: command.label,
        detail: command.hint ?? '',
        run: command.run,
      }));
  }, [commands, files, isCommandMode, onOpenFile, search]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  const execute = (row: Row | undefined) => {
    if (!row) return;
    onClose();
    row.run();
  };

  return (
    <div className="overlay palette-overlay" onClick={onClose} role="presentation">
      <div className="palette" role="dialog" aria-label="Paleta de comandos" onClick={(event) => event.stopPropagation()}>
        <div className="palette-input-row">
          <span className="palette-prefix">{isCommandMode ? '>' : '⌕'}</span>
          <input
            ref={inputRef}
            className="palette-input"
            value={query}
            placeholder="Digite um arquivo ou > para comandos"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setIndex((value) => Math.min(value + 1, rows.length - 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setIndex((value) => Math.max(value - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                execute(rows[index]);
              } else if (event.key === 'Escape') {
                onClose();
              }
            }}
          />
          <button type="button" className="icon-btn small" aria-label="Fechar" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="palette-list">
          {rows.map((row, rowIndex) => (
            <button
              type="button"
              key={row.key}
              ref={rowIndex === index ? activeRef : null}
              className={`palette-row${rowIndex === index ? ' active' : ''}`}
              onMouseEnter={() => setIndex(rowIndex)}
              onClick={() => execute(row)}
            >
              <Icon name={row.kind === 'file' ? 'file' : 'sparkle'} size={16} />
              <span className="palette-label">{row.label}</span>
              <span className="palette-detail">{row.detail}</span>
            </button>
          ))}
          {!rows.length ? <div className="empty-state">Nada encontrado.</div> : null}
        </div>
        <div className="palette-hint">
          <span>
            <kbd>&gt;</kbd> comandos
          </span>
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navegar
          </span>
          <span>
            <kbd>⏎</kbd> abrir
          </span>
        </div>
      </div>
    </div>
  );
}
