import { Icon } from './Icon';
import LanguageList from './LanguageList';

export default function LanguagePicker({
  current,
  filePath,
  onPick,
  onClose,
}: {
  /** Current effective language id, or null when it comes from the file extension. */
  current: string | null;
  filePath: string;
  onPick: (languageId: string | null) => void;
  onClose: () => void;
}) {
  return (
    <div className="language-page" role="dialog" aria-label="Linguagem do arquivo">
      <header className="settings-header">
        <button type="button" className="icon-btn" aria-label="Voltar" onClick={onClose}>
          <Icon name="arrow-left" size={20} />
        </button>
        <div className="language-title">
          <h2>Linguagem</h2>
          <span>{filePath}</span>
        </div>
      </header>
      <LanguageList current={current} autoOption onSelect={onPick} />
    </div>
  );
}
