import { basename, dirname } from '../workspace/vfs';
import { useI18n } from '../i18n';
import { Icon, type IconName } from './ui';

export function Welcome({
  files,
  projectName,
  onNewFile,
  onQuickOpen,
  onPalette,
  onExplorer,
  onTerminal,
  onPreview,
  onSettings,
  onOpenFile,
}: {
  files: string[];
  projectName: string;
  onNewFile: () => void;
  onQuickOpen: () => void;
  onPalette: () => void;
  onExplorer: () => void;
  onTerminal: () => void;
  onPreview: () => void;
  onSettings: () => void;
  onOpenFile: (path: string) => void;
}) {
  const { t } = useI18n();
  const actions: { label: string; icon: IconName; run: () => void }[] = [
    { label: t('welcome.newFile'), icon: 'file-plus', run: onNewFile },
    { label: t('welcome.quickOpen'), icon: 'search', run: onQuickOpen },
    { label: t('welcome.palette'), icon: 'palette', run: onPalette },
    { label: t('welcome.explorer'), icon: 'folder', run: onExplorer },
    { label: t('welcome.terminal'), icon: 'terminal', run: onTerminal },
    { label: t('preview.title'), icon: 'eye', run: onPreview },
    { label: t('welcome.settings'), icon: 'settings', run: onSettings },
  ];

  return (
    <div className="welcome">
      <img className="welcome-logo" src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />
      <h1>{t('welcome.title')}</h1>
      <p className="welcome-sub">{t('welcome.subtitle')}</p>

      <div className="welcome-project">
        <Icon name="layers" size={14} />
        {projectName}
      </div>

      <div className="welcome-actions">
        {actions.map((action) => (
          <button type="button" key={action.label} className="welcome-action" onClick={action.run}>
            <Icon name={action.icon} size={17} />
            {action.label}
          </button>
        ))}
      </div>

      <div className="welcome-recent">
        <h2>{t('welcome.recent')}</h2>
        <div className="welcome-files">
          {files.slice(0, 12).map((path) => (
            <button type="button" key={path} className="welcome-file" onClick={() => onOpenFile(path)}>
              <Icon name="file" size={15} />
              <span className="welcome-file-name">{basename(path)}</span>
              <span className="welcome-file-path">{dirname(path) || '/'}</span>
            </button>
          ))}
          {files.length === 0 ? <div className="empty-state">{t('explorer.empty')}</div> : null}
        </div>
      </div>

      <p className="welcome-footnote">{t('welcome.tip')}</p>
    </div>
  );
}
