import { useEffect, useMemo, useRef, useState } from 'react';
import { buildPreview } from '../preview/bundler';
import type { Vfs } from '../workspace/vfs';
import { useI18n } from '../i18n';
import { Icon } from './ui';

type ConsoleEntry = { id: number; level: string; text: string };

const DEVICES: { id: string; labelKey: string; width: number | null }[] = [
  { id: 'phone', labelKey: 'preview.phone', width: 390 },
  { id: 'tablet', labelKey: 'preview.tablet', width: 768 },
  { id: 'desktop', labelKey: 'preview.desktop', width: null },
];

let consoleId = 0;

export function PreviewPanel({
  vfs,
  onClose,
  autoRefresh,
  onToggleAutoRefresh,
  onOpenFile,
}: {
  vfs: Vfs;
  onClose: () => void;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  onOpenFile: (path: string) => void;
}) {
  const { t } = useI18n();
  const [device, setDevice] = useState('phone');
  const [showConsole, setShowConsole] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [entry, setEntry] = useState<string | undefined>(undefined);
  const [logs, setLogs] = useState<ConsoleEntry[]>([]);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const vfsRef = useRef(vfs);
  vfsRef.current = vfs;

  const build = useMemo(() => buildPreview(vfs, entry), [vfs, entry]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as { source?: string; type?: string; level?: string; text?: string; path?: string };
      if (!data || data.source !== 'code-mobile-preview') return;
      if (data.type === 'console' && data.text !== undefined) {
        setLogs((previous) => [...previous.slice(-120), { id: (consoleId += 1), level: data.level ?? 'log', text: data.text ?? '' }]);
      }
      if (data.type === 'navigate' && data.path) {
        const cleaned = data.path.replace(/^\.\//, '').split('#')[0].split('?')[0];
        if (cleaned in vfsRef.current.files) setEntry(cleaned);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    if (autoRefresh) setNonce((value) => value + 1);
  }, [build.html, autoRefresh]);

  useEffect(() => {
    setLogs([]);
  }, [build.entry]);

  const deviceWidth = DEVICES.find((item) => item.id === device)?.width ?? null;
  const error = build.error === 'no-entry' ? t('preview.noEntry') : build.error;

  return (
    <section className={`preview-panel${fullscreen ? ' fullscreen' : ''}`} aria-label={t('preview.title')}>
      <div className="preview-header">
        <span className="terminal-title">
          <Icon name="eye" size={14} />
          {t('preview.title')}
        </span>
        <span className="preview-entry">{build.entry || '—'}</span>
        <div className="terminal-actions">
          <button
            type="button"
            className="icon-btn small"
            aria-label={t('preview.reload')}
            onClick={() => setNonce((value) => value + 1)}
          >
            <Icon name="refresh" size={15} />
          </button>
          <button
            type="button"
            className={`icon-btn small${autoRefresh ? ' on' : ''}`}
            aria-label={t('preview.autoRefresh')}
            onClick={onToggleAutoRefresh}
            title={t('preview.autoRefresh')}
          >
            <Icon name="loop" size={15} />
          </button>
          <button
            type="button"
            className="icon-btn small"
            aria-label={t('preview.console')}
            onClick={() => setShowConsole((value) => !value)}
          >
            <Icon name="bug" size={15} />
          </button>
          <button
            type="button"
            className="icon-btn small"
            aria-label={t('preview.fullscreen')}
            onClick={() => setFullscreen((value) => !value)}
          >
            <Icon name="monitor" size={15} />
          </button>
          <button type="button" className="icon-btn small" aria-label={t('common.close')} onClick={onClose}>
            <Icon name="close" size={15} />
          </button>
        </div>
      </div>

      <div className="preview-devices">
        {DEVICES.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`chip${device === item.id ? ' on' : ''}`}
            onClick={() => setDevice(item.id)}
          >
            {t(item.labelKey)}
          </button>
        ))}
        <span className="preview-status">
          {error ? t('preview.error') : logs.some((log) => log.level === 'error') ? 'console' : t('preview.ready')}
        </span>
      </div>

      {build.warnings.length ? (
        <div className="preview-warnings">
          {build.warnings.slice(0, 4).map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      ) : null}

      <div className="preview-stage">
        {error ? (
          <div className="empty-state">
            <p>{error}</p>
            <button type="button" className="btn" onClick={() => onOpenFile('index.html')}>
              index.html
            </button>
          </div>
        ) : (
          <div className="preview-frame-wrap" style={deviceWidth ? { maxWidth: deviceWidth } : undefined}>
            <iframe
              key={`${nonce}-${build.entry}`}
              ref={frameRef}
              className="preview-frame"
              title="preview"
              sandbox="allow-scripts allow-forms allow-modals allow-popups"
              srcDoc={build.html}
            />
          </div>
        )}
      </div>

      {showConsole ? (
        <div className="preview-console">
          <div className="preview-console-head">
            <span>{t('preview.console')}</span>
            <button type="button" className="chip" onClick={() => setLogs([])}>
              {t('terminal.clear')}
            </button>
          </div>
          <div className="preview-console-body">
            {logs.length === 0 ? <div className="empty-state">—</div> : null}
            {logs.map((log) => (
              <div key={log.id} className={`preview-log ${log.level}`}>
                {log.text}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
