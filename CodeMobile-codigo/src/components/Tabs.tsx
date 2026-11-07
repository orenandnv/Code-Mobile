import { basename } from '../lib/vfs';
import { languageForPath } from '../lib/languages';
import { Icon } from './Icon';

export default function Tabs({
  tabs,
  active,
  dirty,
  onSelect,
  onClose,
  onNew,
}: {
  tabs: string[];
  active: string | null;
  dirty: Record<string, boolean>;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="tabs" role="tablist" aria-label="Arquivos abertos">
      <div className="tabs-scroll">
        {tabs.map((path) => {
          const isActive = path === active;
          const language = languageForPath(path);
          return (
            <div
              key={path}
              role="tab"
              aria-selected={isActive}
              className={`tab${isActive ? ' active' : ''}${dirty[path] ? ' dirty' : ''}`}
              onClick={() => onSelect(path)}
            >
              <span className={`tab-lang lang-${language}`} aria-hidden="true">
                {dirty[path] ? '●' : language === 'plaintext' ? '≡' : '◆'}
              </span>
              <span className="tab-name">{basename(path)}</span>
              <button
                type="button"
                className="tab-close"
                aria-label={`Fechar ${basename(path)}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onClose(path);
                }}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          );
        })}
      </div>
      <button type="button" className="tabs-new" aria-label="Novo arquivo" onClick={onNew}>
        <Icon name="plus" size={17} />
      </button>
    </div>
  );
}
