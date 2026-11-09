import { useEffect, useState } from 'react';
import { FONT_MAX, FONT_MIN, type Settings, type ThemeId } from '../core/settings';
import { LOCALES, useI18n } from '../i18n';
import { Icon, SettingRow, Stepper, Switch } from './ui';

export function SettingsPanel({
  settings,
  onChange,
  onClose,
  onExport,
  onImport,
  onReset,
  onPistonSave,
  gitToken,
  onGitToken,
  version,
  runningCount,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
  onExport: () => void;
  onImport: () => void;
  onReset: () => void;
  onPistonSave: (endpoint: string) => void;
  gitToken: string;
  onGitToken: (value: string) => void;
  version: string;
  runningCount: number;
}) {
  const { t, locale, setLocale } = useI18n();
  const [endpoint, setEndpoint] = useState(settings.pistonEndpoint);
  const [token, setToken] = useState(gitToken);

  useEffect(() => setEndpoint(settings.pistonEndpoint), [settings.pistonEndpoint]);
  useEffect(() => setToken(gitToken), [gitToken]);

  const themes: { id: ThemeId; label: string }[] = [
    { id: 'dark', label: t('settings.themeDark') },
    { id: 'light', label: t('settings.themeLight') },
    { id: 'hc', label: t('settings.themeHC') },
  ];

  return (
    <section className="settings-page" aria-label={t('settings.title')}>
      <header className="settings-header">
        <button type="button" className="icon-btn" aria-label={t('common.close')} onClick={onClose}>
          <Icon name="arrow-left" size={19} />
        </button>
        <h2>{t('settings.title')}</h2>
      </header>

      <div className="settings-body">
        <div className="settings-section">
          <h3>{t('settings.appearance')}</h3>
          <SettingRow label={t('settings.theme')}>
            <div className="chip-row">
              {themes.map((theme) => (
                <button
                  type="button"
                  key={theme.id}
                  className={`chip${settings.theme === theme.id ? ' on' : ''}`}
                  onClick={() => onChange({ theme: theme.id })}
                >
                  {theme.label}
                </button>
              ))}
            </div>
          </SettingRow>
          <SettingRow label={t('settings.language')} description={LOCALES.find((item) => item.id === locale)?.label}>
            <select
              className="select"
              value={locale}
              onChange={(event) => setLocale(event.target.value)}
              aria-label={t('settings.language')}
            >
              {LOCALES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </SettingRow>
        </div>

        <div className="settings-section">
          <h3>{t('settings.editor')}</h3>
          <SettingRow label={t('settings.fontSize')}>
            <Stepper
              value={settings.fontSize}
              min={FONT_MIN}
              max={FONT_MAX}
              onChange={(fontSize) => onChange({ fontSize })}
              suffix="px"
            />
          </SettingRow>
          <SettingRow label={t('settings.tabSize')}>
            <Stepper value={settings.tabSize} min={1} max={8} onChange={(tabSize) => onChange({ tabSize })} />
          </SettingRow>
          <SettingRow label={t('settings.wordWrap')}>
            <Switch on={settings.wordWrap} onChange={(wordWrap) => onChange({ wordWrap })} label={t('settings.wordWrap')} />
          </SettingRow>
          <SettingRow label={t('settings.minimap')}>
            <Switch on={settings.minimap} onChange={(minimap) => onChange({ minimap })} label={t('settings.minimap')} />
          </SettingRow>
          <SettingRow label={t('settings.lineNumbers')}>
            <Switch
              on={settings.lineNumbers}
              onChange={(lineNumbers) => onChange({ lineNumbers })}
              label={t('settings.lineNumbers')}
            />
          </SettingRow>
          <SettingRow label={t('settings.keybar')}>
            <Switch on={settings.keybar} onChange={(keybar) => onChange({ keybar })} label={t('settings.keybar')} />
          </SettingRow>
          <SettingRow label={t('settings.autoSave')} description={t('settings.autoSaveDesc')}>
            <Switch on={settings.autoSave} onChange={(autoSave) => onChange({ autoSave })} label={t('settings.autoSave')} />
          </SettingRow>
        </div>

        <div className="settings-section">
          <h3>{t('settings.runtimes')}</h3>
          <p className="settings-note">{t('settings.pistonDesc')}</p>
          <div className="settings-inline">
            <input
              className="text-input"
              value={endpoint}
              placeholder="https://piston.example.com/api/v2"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => setEndpoint(event.target.value)}
            />
            <button type="button" className="btn primary" onClick={() => onPistonSave(endpoint.trim())}>
              {t('common.save')}
            </button>
          </div>
          <p className="settings-note">
            {settings.pistonEndpoint ? `✓ ${settings.pistonEndpoint}` : '—'}
            {runningCount ? ` · ${runningCount} processando` : ''}
          </p>
        </div>

        <div className="settings-section">
          <h3>GitHub</h3>
          <SettingRow label="Owner / usuário">
            <input
              className="text-input compact"
              value={settings.gitOwner}
              autoCapitalize="off"
              spellCheck={false}
              onChange={(event) => onChange({ gitOwner: event.target.value })}
            />
          </SettingRow>
          <SettingRow label="Repositório">
            <input
              className="text-input compact"
              value={settings.gitRepo}
              autoCapitalize="off"
              spellCheck={false}
              onChange={(event) => onChange({ gitRepo: event.target.value })}
            />
          </SettingRow>
          <SettingRow label={t('git.branch')}>
            <input
              className="text-input compact"
              value={settings.gitBranch}
              autoCapitalize="off"
              spellCheck={false}
              onChange={(event) => onChange({ gitBranch: event.target.value })}
            />
          </SettingRow>
          <div className="settings-inline">
            <input
              className="text-input"
              type="password"
              value={token}
              placeholder="ghp_…"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => setToken(event.target.value)}
            />
            <button type="button" className="btn" onClick={() => onGitToken(token.trim())}>
              {t('common.save')}
            </button>
          </div>
          <p className="settings-note">
            O token fica apenas neste aparelho (armazenamento local) e é usado direto na API do GitHub.
          </p>
        </div>

        <div className="settings-section">
          <h3>{t('settings.data')}</h3>
          <button type="button" className="btn wide" onClick={onExport}>
            <Icon name="download" size={15} />
            {t('settings.export')}
          </button>
          <button type="button" className="btn wide" onClick={onImport}>
            <Icon name="upload" size={15} />
            {t('settings.import')}
          </button>
          <button type="button" className="btn wide danger" onClick={onReset}>
            {t('settings.reset')}
          </button>
        </div>

        <div className="settings-section">
          <h3>{t('settings.about')}</h3>
          <p className="settings-note">
            Code Mobile · {t('settings.version', { version })}
            <br />
            Editor construído sobre o Monaco (motor do VS Code).
            <br />
            Runtimes locais: JavaScript/TypeScript (Babel + WebView), Luau/Lua (WebAssembly), SQL (sql.js).
            <br />
            Linguagens compiladas usam um servidor Piston configurado por você.
          </p>
        </div>
      </div>
    </section>
  );
}
