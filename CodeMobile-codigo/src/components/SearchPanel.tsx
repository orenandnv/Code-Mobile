import { useMemo, useState } from 'react';
import type { Workspace } from '../lib/vfs';
import { Icon } from './Icon';

type Result = { path: string; line: number; text: string; start: number; length: number };

export default function SearchPanel({
  workspace,
  onOpen,
}: {
  workspace: Workspace;
  onOpen: (path: string, line: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);

  const { results, error } = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return { results: [] as Result[], error: '' };

    let matcher: RegExp;
    try {
      const flags = caseSensitive ? 'g' : 'gi';
      matcher = useRegex
        ? new RegExp(trimmed, flags)
        : new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    } catch {
      return { results: [] as Result[], error: 'Expressão regular inválida' };
    }

    const found: Result[] = [];
    for (const [path, content] of Object.entries(workspace.files)) {
      const lines = content.split('\n');
      for (let index = 0; index < lines.length; index += 1) {
        matcher.lastIndex = 0;
        const match = matcher.exec(lines[index]);
        if (match) {
          found.push({
            path,
            line: index + 1,
            text: lines[index],
            start: match.index,
            length: Math.max(match[0].length, 1),
          });
          if (found.length >= 400) return { results: found, error: '' };
        }
      }
    }
    return { results: found, error: '' };
  }, [query, workspace.files, caseSensitive, useRegex]);

  const grouped = useMemo(() => {
    const map = new Map<string, Result[]>();
    results.forEach((result) => {
      const list = map.get(result.path) ?? [];
      list.push(result);
      map.set(result.path, list);
    });
    return [...map.entries()];
  }, [results]);

  return (
    <div className="search-panel">
      <div className="panel-toolbar">
        <span className="panel-title">Pesquisar</span>
      </div>
      <div className="search-box">
        <Icon name="search" size={17} />
        <input
          className="search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Pesquisar em todos os arquivos"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {query ? (
          <button type="button" className="icon-btn small" aria-label="Limpar" onClick={() => setQuery('')}>
            <Icon name="close" size={15} />
          </button>
        ) : null}
      </div>
      <div className="search-toggles">
        <button
          type="button"
          className={`chip${caseSensitive ? ' on' : ''}`}
          onClick={() => setCaseSensitive((value) => !value)}
        >
          Aa
        </button>
        <button type="button" className={`chip${useRegex ? ' on' : ''}`} onClick={() => setUseRegex((value) => !value)}>
          .*
        </button>
        <span className="search-count">
          {query ? `${results.length}${results.length >= 400 ? '+' : ''} resultado(s)` : 'Digite para buscar'}
        </span>
      </div>
      {error ? <div className="search-error">{error}</div> : null}
      <div className="search-results">
        {grouped.map(([path, items]) => (
          <div key={path} className="search-group">
            <div className="search-file">
              <Icon name="file" size={14} />
              <span>{path}</span>
              <span className="search-badge">{items.length}</span>
            </div>
            {items.map((item) => (
              <button
                type="button"
                key={`${item.path}:${item.line}`}
                className="search-hit"
                onClick={() => onOpen(item.path, item.line)}
              >
                <span className="search-line">{item.line}</span>
                <span className="search-text">
                  {item.text.slice(Math.max(0, item.start - 18), item.start)}
                  <mark>{item.text.slice(item.start, item.start + item.length)}</mark>
                  {item.text.slice(item.start + item.length, item.start + item.length + 60)}
                </span>
              </button>
            ))}
          </div>
        ))}
        {query && !results.length && !error ? <div className="empty-state">Nenhum resultado.</div> : null}
      </div>
    </div>
  );
}
