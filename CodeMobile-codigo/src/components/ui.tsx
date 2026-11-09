import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/* ------------------------------------------------------------------- ícones */

export type IconName =
  | 'menu' | 'search' | 'palette' | 'more' | 'save' | 'close' | 'plus' | 'folder' | 'folder-plus'
  | 'file' | 'file-plus' | 'terminal' | 'settings' | 'code' | 'play' | 'stop' | 'refresh' | 'eye'
  | 'git' | 'trash' | 'edit' | 'copy' | 'chevron-down' | 'chevron-right' | 'check' | 'globe'
  | 'download' | 'upload' | 'layers' | 'keyboard' | 'arrow-left' | 'arrow-right' | 'arrow-up'
  | 'arrow-down' | 'sparkle' | 'bug' | 'extensions' | 'monitor' | 'list' | 'folder-open' | 'info';

const PATHS: Record<IconName, ReactNode> = {
  menu: <><path d="M3 6h18M3 12h18M3 18h18" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  palette: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M7 9h6M7 13h10M7 17h4" /></>,
  more: <><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></>,
  save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  folder: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></>,
  'folder-plus': <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M12 11v6M9 14h6" /></>,
  'folder-open': <><path d="M3 8a2 2 0 0 1 2-2h4l2 2h5a2 2 0 0 1 2 2v1" /><path d="M3 8v9a2 2 0 0 0 2 2h12l3-8H6l-3 8" /></>,
  file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5" /></>,
  'file-plus': <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5M12 12v6M9 15h6" /></>,
  terminal: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m7 9 3 3-3 3M13 15h4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
  code: <><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" /></>,
  play: <><path d="M7 4l13 8-13 8Z" /></>,
  stop: <><rect x="6" y="6" width="12" height="12" rx="2" /></>,
  refresh: <><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  git: <><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="8" r="3" /><path d="M6 9v6M18 11v3a4 4 0 0 1-4 4H9" /></>,
  trash: <><path d="M4 7h16M10 4h4M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>,
  'chevron-down': <><path d="m6 9 6 6 6-6" /></>,
  'chevron-right': <><path d="m9 6 6 6-6 6" /></>,
  check: <><path d="m5 13 4 4L19 7" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18-2.5-3-2.5-15.5 0-18Z" /></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5M4 20h16" /></>,
  upload: <><path d="M12 21V9M7 14l5-5 5 5M4 4h16" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5Z" /><path d="m3 13 9 5 9-5" /></>,
  keyboard: <><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M10 14h4" /></>,
  'arrow-left': <><path d="M19 12H5M11 6l-6 6 6 6" /></>,
  'arrow-right': <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  'arrow-up': <><path d="M12 19V5M6 11l6-6 6 6" /></>,
  'arrow-down': <><path d="M12 5v14M6 13l6 6 6-6" /></>,
  sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></>,
  bug: <><circle cx="12" cy="13" r="5" /><path d="M12 8V5M8 9 5 6M16 9l3-3M6 13H3M21 13h-3M7 17l-2 2M17 17l2 2" /></>,
  extensions: <><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4z" /><path d="M15 15h4v4h-4z" /></>,
  monitor: <><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 10v7M12 7h.01" /></>,
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

/* ------------------------------------------------------------------ splash */

export function Splash({ label }: { label: string }) {
  const icon = `${import.meta.env.BASE_URL}icon.svg`;
  return (
    <div className="splash" role="status" aria-live="polite">
      <div className="splash-center">
        <img src={icon} alt="" className="splash-icon" />
        <h1 className="splash-name">Code Mobile</h1>
        <p className="splash-label">{label}</p>
      </div>
      <span className="splash-credit">@orenandnv - dev</span>
    </div>
  );
}

/* -------------------------------------------------------------------- tabs */

export type TabItem = { path: string; name: string; dirty: boolean };

export function Tabs({
  tabs,
  active,
  onSelect,
  onClose,
  onNew,
}: {
  tabs: TabItem[];
  active: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onNew: () => void;
}) {
  const activeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [active]);

  return (
    <div className="tabs">
      <div className="tabs-scroll">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.path}
            ref={tab.path === active ? activeRef : undefined}
            className={`tab${tab.path === active ? ' active' : ''}${tab.dirty ? ' dirty' : ''}`}
            onClick={() => onSelect(tab.path)}
          >
            <span className="tab-name">{tab.name}</span>
            {tab.dirty ? <span className="tab-lang">●</span> : null}
            <span
              className="tab-close"
              role="button"
              tabIndex={-1}
              aria-label={`Fechar ${tab.name}`}
              onClick={(event) => {
                event.stopPropagation();
                onClose(tab.path);
              }}
            >
              <Icon name="close" size={13} />
            </span>
          </button>
        ))}
      </div>
      <button type="button" className="tabs-new" aria-label="Novo arquivo" onClick={onNew}>
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- overlays */

export type SheetItem = {
  label: string;
  icon?: IconName;
  danger?: boolean;
  detail?: string;
  onSelect: () => void;
};

export function Sheet({ title, items, onClose }: { title: string; items: SheetItem[]; onClose: () => void }) {
  return (
    <div className="overlay overlay-bottom" role="presentation" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">{title}</div>
        <div className="sheet-items">
          {items.map((item) => (
            <button
              type="button"
              key={item.label}
              className={`sheet-item${item.danger ? ' danger' : ''}`}
              onClick={() => {
                onClose();
                item.onSelect();
              }}
            >
              {item.icon ? <Icon name={item.icon} size={18} /> : <span className="sheet-dot" />}
              <span>{item.label}</span>
              {item.detail ? <span className="sheet-detail">{item.detail}</span> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export type PromptOptions = {
  title: string;
  label?: string;
  initial?: string;
  placeholder?: string;
  confirmLabel?: string;
  onSubmit: (value: string) => void;
};

export function Prompt({ options, onClose }: { options: PromptOptions; onClose: () => void }) {
  const [value, setValue] = useState(options.initial ?? '');
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = () => {
    onClose();
    options.onSubmit(value);
  };

  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <div className="dialog" role="dialog" aria-label={options.title} onClick={(event) => event.stopPropagation()}>
        <h3>{options.title}</h3>
        {options.label ? <span className="field-label">{options.label}</span> : null}
        <input
          ref={inputRef}
          className="text-input"
          value={value}
          placeholder={options.placeholder}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit();
            if (event.key === 'Escape') onClose();
          }}
        />
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn primary" onClick={submit}>
            {options.confirmLabel ?? 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <div className="dialog" role="dialog" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              onClose();
              onConfirm();
            }}
          >
            {confirmLabel ?? 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Toast({ message }: { message: string }) {
  return <div className="toast">{message}</div>;
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`switch${on ? ' on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <span className="switch-knob" />
    </button>
  );
}

export function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="setting-row">
      <div className="setting-text">
        <span className="setting-label">{label}</span>
        {description ? <span className="setting-description">{description}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function Stepper({
  value,
  min,
  max,
  onChange,
  suffix,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <div className="stepper">
      <button type="button" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        −
      </button>
      <span className="stepper-value">
        {value}
        {suffix ?? ''}
      </span>
      <button type="button" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        +
      </button>
    </div>
  );
}

export function useLatest<T>(value: T): React.MutableRefObject<T> {
  const ref = useMemo(() => ({ current: value }), []);
  ref.current = value;
  return ref;
}
