import { basename } from '../lib/vfs';
import { Icon, type IconName } from './Icon';

export default function Welcome({
  files,
  onNewFile,
  onQuickOpen,
  onPalette,
  onExplorer,
  onTerminal,
  onSettings,
  onOpenFile,
  onInstall,
  canInstall,
}: {
  files: string[];
  onNewFile: () => void;
  onQuickOpen: () => void;
  onPalette: () => void;
  onExplorer: () => void;
  onTerminal: () => void;
  onSettings: () => void;
  onOpenFile: (path: string) => void;
  onInstall: () => void;
  canInstall: boolean;
}) {
  const actions: { label: string; icon: IconName; run: () => void }[] = [
    { label: 'Novo arquivo', icon: 'file-plus', run: onNewFile },
    { label: 'Abrir arquivo', icon: 'search', run: onQuickOpen },
    { label: 'Comandos', icon: 'palette', run: onPalette },
    { label: 'Explorador', icon: 'sidebar', run: onExplorer },
    { label: 'Terminal', icon: 'terminal', run: onTerminal },
    { label: 'Ajustes', icon: 'settings', run: onSettings },
  ];

  return (
    <div className="welcome">
      <div className="welcome-logo">
        <Icon name="code" size={34} />
      </div>
      <h1>Code Mobile</h1>
      <p className="welcome-sub">
        Editor de código no celular, com o motor do VS Code. Abra um arquivo para começar.
      </p>

      <div className="welcome-actions">
        {actions.map((action) => (
          <button type="button" key={action.label} className="welcome-action" onClick={action.run}>
            <Icon name={action.icon} size={18} />
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      {files.length ? (
        <div className="welcome-recent">
          <h2>Arquivos do projeto</h2>
          <div className="welcome-files">
            {files.slice(0, 8).map((path) => (
              <button type="button" key={path} className="welcome-file" onClick={() => onOpenFile(path)}>
                <Icon name="file" size={15} />
                <span className="welcome-file-name">{basename(path)}</span>
                <span className="welcome-file-path">{path}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {canInstall ? (
        <button type="button" className="install-banner" onClick={onInstall}>
          <Icon name="install" size={18} />
          <span>Instalar o Code Mobile na tela inicial</span>
        </button>
      ) : null}

      <p className="welcome-footnote">
        Dica: use a barra <strong>⌨</strong> acima do teclado para Tab, setas e símbolos.
      </p>
    </div>
  );
}
