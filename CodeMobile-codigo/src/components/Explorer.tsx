import { useEffect, useState } from 'react';
import { basename, entriesIn, type Entry, type Workspace } from '../lib/vfs';
import { Icon } from './Icon';

type Props = {
  workspace: Workspace;
  activePath: string | null;
  onOpen: (path: string) => void;
  onMenu: (entry: Entry) => void;
  onNewFile: (dir: string) => void;
  onNewFolder: (dir: string) => void;
  onCollapseAll: () => void;
};

export default function Explorer({
  workspace,
  activePath,
  onOpen,
  onMenu,
  onNewFile,
  onNewFolder,
  onCollapseAll,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['src', 'assets']));

  useEffect(() => {
    setExpanded((previous) => {
      const next = new Set(previous);
      workspace.folders.forEach((folder) => {
        if (!folder.includes('/')) next.add(folder);
      });
      return next;
    });
  }, [workspace.folders]);

  const toggle = (path: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderLevel = (dir: string, depth: number): JSX.Element[] => {
    const entries = entriesIn(workspace, dir);
    return entries.flatMap((entry) => {
      const isOpen = expanded.has(entry.path);
      const isActive = entry.type === 'file' && entry.path === activePath;
      const row = (
        <div
          key={entry.path}
          className={`tree-row${isActive ? ' active' : ''}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => (entry.type === 'folder' ? toggle(entry.path) : onOpen(entry.path))}
        >
          <span className="tree-chevron">
            {entry.type === 'folder' ? (
              <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={14} />
            ) : (
              <span className="tree-file-dot" />
            )}
          </span>
          <Icon
            name={entry.type === 'folder' ? (isOpen ? 'folder-open' : 'folder') : 'file'}
            size={16}
            className="tree-icon"
          />
          <span className="tree-label">{basename(entry.path)}</span>
          <button
            type="button"
            className="tree-more"
            aria-label={`Ações para ${basename(entry.path)}`}
            onClick={(event) => {
              event.stopPropagation();
              onMenu(entry);
            }}
          >
            <Icon name="more" size={16} />
          </button>
        </div>
      );

      if (entry.type === 'folder' && isOpen) {
        return [row, ...renderLevel(entry.path, depth + 1)];
      }
      return [row];
    });
  };

  return (
    <div className="explorer">
      <div className="panel-toolbar">
        <span className="panel-title">Explorador</span>
        <div className="panel-actions">
          <button type="button" className="icon-btn" aria-label="Novo arquivo" onClick={() => onNewFile('')}>
            <Icon name="file-plus" size={18} />
          </button>
          <button type="button" className="icon-btn" aria-label="Nova pasta" onClick={() => onNewFolder('')}>
            <Icon name="folder-plus" size={18} />
          </button>
          <button type="button" className="icon-btn" aria-label="Recolher tudo" onClick={onCollapseAll}>
            <Icon name="layers" size={18} />
          </button>
        </div>
      </div>
      <div className="tree">{renderLevel('', 0)}</div>
      <div className="explorer-footnote">
        {Object.keys(workspace.files).length} arquivos · {workspace.folders.length} pastas · salvo no dispositivo
      </div>
    </div>
  );
}
