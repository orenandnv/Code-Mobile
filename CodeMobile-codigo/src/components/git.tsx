import { useCallback, useEffect, useState } from 'react';
import { changedFiles, diffLines, gitConfigured, listCommits, pushProject, type CommitInfo, type GitConfig, type RemoteFile, getRemoteFile } from '../features/git';
import type { Vfs } from '../workspace/vfs';
import { useI18n } from '../i18n';
import { Icon } from './ui';

export function GitPanel({
  vfs,
  config,
  onClose,
  onOpenFile,
  onOpenSettings,
  onNotify,
  onError,
}: {
  vfs: Vfs;
  config: GitConfig;
  onClose: () => void;
  onOpenFile: (path: string) => void;
  onOpenSettings: () => void;
  onNotify: (message: string) => void;
  onError: (message: string) => void;
}) {
  const { t } = useI18n();
  const [changes, setChanges] = useState<{ path: string; status: 'new' | 'modified' | 'same' }[] | null>(null);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [diff, setDiff] = useState<{ path: string; lines: ReturnType<typeof diffLines> } | null>(null);
  const configured = gitConfigured(config);

  const refresh = useCallback(async () => {
    if (!configured) return;
    setBusy(true);
    try {
      const result = await changedFiles(config, vfs);
      setChanges(result.filter((item) => item.status !== 'same'));
      setCommits(await listCommits(config, 8).catch(() => []));
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }, [config, configured, vfs, onError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openDiff = async (path: string) => {
    try {
      const remote: RemoteFile | null = await getRemoteFile(config, path);
      setDiff({ path, lines: diffLines(vfs.files[path] ?? '', remote?.content ?? '') });
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  };

  const push = async () => {
    setBusy(true);
    try {
      const result = await pushProject(config, vfs, message || 'Code Mobile', (path, index, total) =>
        setProgress(`${index}/${total} · ${path}`),
      );
      if (result.errors.length) onError(result.errors.join('\n'));
      onNotify(`${t('git.success')} · ${result.updated.length}`);
      setMessage('');
      await refresh();
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <section className="settings-page" aria-label={t('git.title')}>
      <header className="settings-header">
        <button type="button" className="icon-btn" aria-label={t('common.close')} onClick={onClose}>
          <Icon name="arrow-left" size={19} />
        </button>
        <h2>{t('git.title')}</h2>
        <span className="status-spacer" />
        <button type="button" className="icon-btn small" aria-label={t('preview.reload')} onClick={() => void refresh()}>
          <Icon name="refresh" size={16} />
        </button>
      </header>

      <div className="settings-body">
        {!configured ? (
          <div className="git-empty">
            <p>{t('git.notConnected')}</p>
            <button type="button" className="btn primary" onClick={onOpenSettings}>
              {t('settings.title')}
            </button>
          </div>
        ) : (
          <>
            <div className="git-repo">
              <Icon name="git" size={15} />
              <span>{config.owner}/{config.repo}</span>
              <span className="chip">{config.branch}</span>
            </div>

            <div className="settings-section">
              <h3>{t('git.changes')}</h3>
              {changes === null ? <div className="empty-state">{t('common.loading')}</div> : null}
              {changes && changes.length === 0 ? <div className="empty-state">{t('git.noChanges')}</div> : null}
              {changes?.map((change) => (
                <div className="git-file" key={change.path}>
                  <span className={`git-status ${change.status}`}>{change.status === 'new' ? 'A' : 'M'}</span>
                  <button type="button" className="git-path" onClick={() => onOpenFile(change.path)}>
                    {change.path}
                  </button>
                  <button type="button" className="icon-btn small" aria-label={t('git.diff')} onClick={() => void openDiff(change.path)}>
                    <Icon name="layers" size={15} />
                  </button>
                </div>
              ))}
            </div>

            <div className="settings-section">
              <input
                className="text-input"
                value={message}
                placeholder={t('git.messagePlaceholder')}
                onChange={(event) => setMessage(event.target.value)}
              />
              <button type="button" className="btn primary wide" disabled={busy} onClick={() => void push()}>
                <Icon name="upload" size={15} />
                {busy ? t('common.loading') : t('git.push')}
              </button>
              {progress ? <p className="settings-note">{progress}</p> : null}
            </div>

            <div className="settings-section">
              <h3>{t('git.history')}</h3>
              {commits.map((commit) => (
                <div className="git-commit" key={commit.sha}>
                  <span className="git-sha">{commit.sha}</span>
                  <span className="git-message">{commit.message}</span>
                  <span className="git-date">{new Date(commit.date).toLocaleDateString()}</span>
                </div>
              ))}
              {commits.length === 0 ? <div className="empty-state">—</div> : null}
            </div>
          </>
        )}
      </div>

      {diff ? (
        <div className="overlay" role="presentation" onClick={() => setDiff(null)}>
          <div className="dialog diff-dialog" role="dialog" onClick={(event) => event.stopPropagation()}>
            <h3>{diff.path}</h3>
            <div className="diff-body">
              {diff.lines.map((line, index) => (
                <div key={index} className={`diff-line ${line.type}`}>
                  <span className="diff-sign">{line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}</span>
                  {line.text}
                </div>
              ))}
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn" onClick={() => setDiff(null)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
