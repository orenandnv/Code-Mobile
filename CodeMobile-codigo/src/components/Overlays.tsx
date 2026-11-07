import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';

export type SheetItem = {
  label: string;
  icon?: IconName;
  danger?: boolean;
  onSelect: () => void;
};

export function Sheet({
  title,
  items,
  onClose,
}: {
  title: string;
  items: SheetItem[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay overlay-bottom" role="presentation" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">{title}</div>
        <div className="sheet-items">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`sheet-item${item.danger ? ' danger' : ''}`}
              onClick={() => {
                onClose();
                item.onSelect();
              }}
            >
              {item.icon ? <Icon name={item.icon} size={19} /> : <span className="sheet-dot" />}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Excluir',
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
      <div className="dialog" role="alertdialog" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              onClose();
              onConfirm();
            }}
          >
            {confirmLabel}
          </button>
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 60);
    return () => window.clearTimeout(timer);
  }, []);

  const submit = () => {
    if (!value.trim()) return;
    onClose();
    options.onSubmit(value.trim());
  };

  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <form
        className="dialog"
        role="dialog"
        aria-label={options.title}
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <h3>{options.title}</h3>
        {options.label ? <label className="field-label">{options.label}</label> : null}
        <input
          ref={inputRef}
          className="text-input"
          value={value}
          placeholder={options.placeholder}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => setValue(event.target.value)}
        />
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn primary">
            {options.confirmLabel ?? 'Criar'}
          </button>
        </div>
      </form>
    </div>
  );
}
