import { useMemo, useState } from 'react';
import { basename, dirname, entriesIn, filePaths, sizeOf, formatBytes, treeEntries, type Entry, type Vfs } from '../workspace/vfs';
import { languageForPath } from '../editor/languages';
import { useI18n } from '../i18n';
import { Icon } from './ui';
import type { Project } from '../workspace/project';

export function Explorer({
  vfs,
  activePath,
  project,
  onOpen,
  onMenu,
  onNewFile,
  onNewFolder,
  onProjects,
  onImport,
  onExport,
  onZip,
}: {
  vfs: Vfs;
  activePath: string | null;
  project: Project;
  onOpen: (path: string) => void;
  onMenu: (entry: Entry) => void;
  onNewFile: (dir: string) => void;
  onNewFolder: (dir: string) => void;
  onProjects: () => void;
  onImport: () => void;
  onExport: () => void;
  onZip: () => void;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(vfs.folders.map((folder) => [folder, true])),
  );

  const rows = useMemo(() => treeEntries(vfs, expanded), [vfs, expanded]);
  const fileCount = Object.keys(vfs.files).length;

  const toggle = (path: string) =>
    setExpanded((previous) => ({ ...previous, [path]: !previous[path] }));

  return (
    <div className="explorer">
      <div className="panel-toolbar">
        <button type="button" className="project-chip" onClick={onProjects}>
          <Icon name="layers" size={14} />
          <span>{project.name}</span>
          <Icon name="chevron-down" size={13} />
        </button>
        <div className="panel-actions">
          <button type="button" className="icon-btn small" aria-label={t('explorer.newFile')} onClick={() => onNewFile('')}>
            <Icon name="file-plus" size={17} />
          </button>
          <button type="button" className="icon-btn small" aria-label={t('explorer.newFolder')} onClick={() => onNewFolder('')}>
            <Icon name="folder-plus" size={17} />
          </button>
          <button type="button" className="icon-btn small" aria-label={t('settings.import')} onClick={onImport}>
            <Icon name="upload" size={17} />
          </button>
          <button type="button" className="icon-btn small" aria-label={t('settings.export')} onClick={onExport}>
            <Icon name="download" size={17} />
          </button>
        </div>
      </div>

      <div className="tree">
        {rows.length === 0 ? <div className="empty-state">{t('explorer.empty')}</div> : null}
        {rows.map((entry) => {
          const isFolder = entry.type === 'folder';
          const open = Boolean(expanded[entry.path]);
          return (
            <div
              key={entry.path}
              className={`tree-row${entry.path === activePath ? ' active' : ''}`}
              style={{ paddingLeft: 8 + entry.depth * 14 }}
            >
              <button
                type="button"
                className="tree-chevron"
                aria-label={open ? 'Recolher' : 'Expandir'}
                onClick={() => (isFolder ? toggle(entry.path) : onOpen(entry.path))}
              >
                {isFolder ? <Icon name={open ? 'chevron-down' : 'chevron-right'} size={13} /> : <span className="tree-file-dot" />}
              </button>
              <button type="button" className="tree-label-button" onClick={() => (isFolder ? toggle(entry.path) : onOpen(entry.path))}>
                <Icon
                  name={isFolder ? (open ? 'folder-open' : 'folder') : 'file'}
                  size={15}
                />
                <span className="tree-label">{entry.name}</span>
              </button>
              <button type="button" className="tree-more" aria-label="Ações" onClick={() => onMenu(entry)}>
                <Icon name="more" size={16} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="explorer-footnote">
        <span>{t('explorer.footnote', { files: fileCount, folders: vfs.folders.length })}</span>
        <button type="button" className="link-button" onClick={onZip}>
          .zip
        </button>
      </div>
    </div>
  );
}

export type SearchHit = { path: string; line: number; text: string };

export function searchInVfs(
  vfs: Vfs,
  query: string,
  options: { regex: boolean; caseSensitive: boolean; wholeWord: boolean },
): { hits: SearchHit[]; error: string | null; files: number } {
  if (!query) return { hits: [], error: null, files: 0 };
  let matcher: RegExp;
  try {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = options.regex ? query : escaped;
    const word = options.wholeWord ? `\\b(?:${pattern})\\b` : pattern;
    matcher = new RegExp(word, options.caseSensitive ? 'g' : 'gi');
  } catch (error) {
    return { hits: [], error: error instanceof Error ? error.message : 'expressão inválida', files: 0 };
  }

  const hits: SearchHit[] = [];
  const touched = new Set<string>();
  for (const path of filePaths(vfs)) {
    const content = vfs.files[path];
    if (content.length > 400_000) continue;
    const lines = content.split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      if (matcher.test(lines[index])) {
        hits.push({ path, line: index + 1, text: lines[index].trim().slice(0, 200) });
        touched.add(path);
        if (hits.length >= 400) break;
      }
      matcher.lastIndex = 0;
    }
    matcher.lastIndex = 0;
    if (hits.length >= 400) break;
  }
  return { hits, error: null, files: touched.size };
}

export function SearchPanel({ vfs, onOpen }: { vfs: Vfs; onOpen: (path: string, line?: number) => void }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [regex, setRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const result = useMemo(
    () => searchInVfs(vfs, query, { regex, caseSensitive, wholeWord }),
    [vfs, query, regex, caseSensitive, wholeWord],
  );

  const groups = useMemo(() => {
    const map = new Map<string, SearchHit[]>();
    for (const hit of result.hits) {
      const list = map.get(hit.path) ?? [];
      list.push(hit);
      map.set(hit.path, list);
    }
    return Array.from(map.entries());
  }, [result.hits]);

  return (
    <div className="search-panel">
      <div className="panel-toolbar">
        <span className="panel-title">{t('search.title')}</span>
      </div>
      <div className="search-box">
        <Icon name="search" size={16} />
        <input
          className="search-input"
          value={query}
          placeholder={t('search.placeholder')}
          onChange={(event) => setQuery(event.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
      <div className="search-toggles">
        <button type="button" className={`chip${regex ? ' on' : ''}`} onClick={() => setRegex((value) => !value)} title={t('search.regex')}>
          .*
        </button>
        <button type="button" className={`chip${caseSensitive ? ' on' : ''}`} onClick={() => setCaseSensitive((value) => !value)} title={t('search.case')}>
          Aa
        </button>
        <button type="button" className={`chip${wholeWord ? ' on' : ''}`} onClick={() => setWholeWord((value) => !value)} title={t('search.word')}>
          ab
        </button>
        <span className="search-count">
          {result.error ? '' : t('search.matches', { count: result.hits.length })}
        </span>
      </div>
      {result.error ? <div className="search-error">{result.error}</div> : null}
      <div className="search-results">
        {!result.error && query && groups.length === 0 ? <div className="empty-state">{t('search.noResults')}</div> : null}
        {groups.map(([path, hits]) => (
          <div className="search-group" key={path}>
            <div className="search-file">
              <Icon name="file" size={13} />
              <span className="search-text">{basename(path)}</span>
              <span className="search-path">{dirname(path)}</span>
              <span className="search-badge">{hits.length}</span>
            </div>
            {hits.map((hit) => (
              <button
                type="button"
                key={`${hit.path}:${hit.line}`}
                className="search-hit"
                onClick={() => onOpen(path, hit.line)}
              >
                <span className="search-line">{hit.line}</span>
                <span className="search-text">{hit.text}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function projectSummary(project: Project): string {
  const total = Object.values(project.files).reduce((sum, content) => sum + sizeOf(content), 0);
  return `${Object.keys(project.files).length} · ${formatBytes(total)}`;
}

export function fileLanguageLabel(path: string): string {
  return languageForPath(path).label;
}

export function entriesOf(vfs: Vfs, dir: string) {
  return entriesIn(vfs, dir);
}
