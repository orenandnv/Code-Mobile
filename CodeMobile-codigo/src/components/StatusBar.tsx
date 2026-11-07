import { languageLabel } from '../lib/languages';
import type { Settings } from '../lib/types';
import { Icon } from './Icon';

export default function StatusBar({
  language,
  line,
  column,
  settings,
  dirty,
  hasFile,
  onPickLanguage,
}: {
  language: string;
  line: number;
  column: number;
  settings: Settings;
  dirty: boolean;
  hasFile: boolean;
  onPickLanguage: () => void;
}) {
  return (
    <div className="statusbar">
      <span className={`status-item status-dirty${dirty ? ' on' : ''}`}>
        {hasFile ? (dirty ? '● não salvo' : '✓ salvo') : '—'}
      </span>
      <span className="status-spacer" />
      {hasFile ? (
        <>
          <span className="status-item">
            Ln {line}, Col {column}
          </span>
          <span className="status-item">
            {settings.tabSize === 1 ? 'Tab' : `Espaços: ${settings.tabSize}`}
          </span>
          <button type="button" className="status-item status-button" onClick={onPickLanguage}>
            <Icon name="code" size={13} />
            {languageLabel(language)}
            <Icon name="chevron-down" size={10} />
          </button>
          <span className="status-item">UTF-8</span>
        </>
      ) : null}
    </div>
  );
}
