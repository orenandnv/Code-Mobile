import type { Settings } from '../lib/types';
import { FONT_MAX, FONT_MIN } from '../lib/types';
import { THEME_DEFINITIONS } from '../lib/themes';
import { Icon } from './Icon';

function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="setting-row">
      <span className="setting-text">
        <span className="setting-label">{label}</span>
        {description ? <span className="setting-description">{description}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`switch${checked ? ' on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="switch-knob" />
      </button>
    </label>
  );
}

export default function SettingsPanel({
  settings,
  onChange,
  onClose,
  onReset,
  onCopyWorkspace,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
  onReset: () => void;
  onCopyWorkspace: () => void;
}) {
  const themes = THEME_DEFINITIONS.map((definition) => ({ id: definition.id, label: definition.label }));

  return (
    <div className="settings-page">
      <header className="settings-header">
        <button type="button" className="icon-btn" aria-label="Voltar" onClick={onClose}>
          <Icon name="arrow-left" size={20} />
        </button>
        <h2>Configurações</h2>
      </header>

      <div className="settings-body">
        <section className="settings-section">
          <h3>Aparência</h3>
          <div className="setting-row column">
            <span className="setting-label">Tema de cores</span>
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
          </div>
          <div className="setting-row">
            <div className="setting-text">
              <span className="setting-label">Tamanho da fonte</span>
              <span className="setting-description">{settings.fontSize}px</span>
            </div>
            <div className="stepper">
              <button
                type="button"
                aria-label="Diminuir fonte"
                disabled={settings.fontSize <= FONT_MIN}
                onClick={() => onChange({ fontSize: Math.max(FONT_MIN, settings.fontSize - 1) })}
              >
                A−
              </button>
              <button
                type="button"
                aria-label="Aumentar fonte"
                disabled={settings.fontSize >= FONT_MAX}
                onClick={() => onChange({ fontSize: Math.min(FONT_MAX, settings.fontSize + 1) })}
              >
                A+
              </button>
            </div>
          </div>
          <div className="setting-row column">
            <span className="setting-label">Tamanho da tabulação</span>
            <div className="chip-row">
              {[2, 4, 8].map((size) => (
                <button
                  type="button"
                  key={size}
                  className={`chip${settings.tabSize === size ? ' on' : ''}`}
                  onClick={() => onChange({ tabSize: size })}
                >
                  {size} espaços
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h3>Editor</h3>
          <Switch
            label="Quebra de linha automática"
            description="Ajusta o texto à largura da tela"
            checked={settings.wordWrap}
            onChange={(value) => onChange({ wordWrap: value })}
          />
          <Switch
            label="Números de linha"
            checked={settings.lineNumbers}
            onChange={(value) => onChange({ lineNumbers: value })}
          />
          <Switch
            label="Minimapa"
            description="Desligado por padrão em telas pequenas"
            checked={settings.minimap}
            onChange={(value) => onChange({ minimap: value })}
          />
          <Switch
            label="Mostrar espaços em branco"
            checked={settings.renderWhitespace}
            onChange={(value) => onChange({ renderWhitespace: value })}
          />
          <Switch
            label="Salvar automaticamente"
            description="Grava as alterações no dispositivo após cada edição"
            checked={settings.autoSave}
            onChange={(value) => onChange({ autoSave: value })}
          />
        </section>

        <section className="settings-section">
          <h3>Espaço de trabalho</h3>
          <button type="button" className="btn ghost wide" onClick={onCopyWorkspace}>
            <Icon name="copy" size={16} /> Copiar workspace como JSON
          </button>
          <button type="button" className="btn danger wide" onClick={onReset}>
            <Icon name="refresh" size={16} /> Restaurar workspace de exemplo
          </button>
          <p className="settings-note">
            Tudo é salvo localmente no dispositivo (localStorage). Os arquivos não saem do seu aparelho.
          </p>
        </section>

        <section className="settings-section about">
          <h3>Sobre</h3>
          <p className="settings-note">
            Code Mobile 1.0 — editor mobile construído sobre o Monaco, o componente de edição de código
            aberto que também alimenta o VS Code. Interface própria, adaptada para toque.
          </p>
        </section>
      </div>
    </div>
  );
}
