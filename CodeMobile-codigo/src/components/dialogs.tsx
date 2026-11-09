import { useEffect, useMemo, useRef, useState } from 'react';
import { LANGUAGES, defaultExtension, languageForPath, languagesSorted } from '../editor/languages';
import { basename, dirname, normalizePath } from '../workspace/vfs';
import { useI18n } from '../i18n';
import { Icon } from './ui';

export type Command = { id: string; label: string; hint?: string; run: () => void };

export function CommandPalette({
  commands,
  files,
  initialQuery,
  onClose,
  onOpenFile,
}: {
  commands: Command[];
  files: string[];
  initialQuery: string;
  onClose: () => void;
  onOpenFile: (path: string) => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const commandMode = query.startsWith('>');
  const term = (commandMode ? query.slice(1) : query).trim().toLowerCase();

  const results = useMemo(() => {
    if (commandMode) {
      return commands
        .filter((command) => !term || command.label.toLowerCase().includes(term))
        .slice(0, 60)
        .map((command) => ({
          key: command.id,
          label: command.label,
          detail: command.hint,
          icon: 'palette' as const,
          run: command.run,
        }));
    }
    return files
      .filter((path) => !term || path.toLowerCase().includes(term))
      .sort((a, b) => {
        const aName = basename(a).toLowerCase();
        const bName = basename(b).toLowerCase();
        if (term) {
          const aStarts = aName.startsWith(term) ? 0 : 1;
          const bStarts = bName.startsWith(term) ? 0 : 1;
          if (aStarts !== bStarts) return aStarts - bStarts;
        }
        return a.localeCompare(b);
      })
      .slice(0, 80)
      .map((path) => ({
        key: path,
        label: basename(path),
        detail: dirname(path) || '/',
        icon: 'file' as const,
        run: () => onOpenFile(path),
      }));
  }, [commands, files, term, commandMode, onOpenFile]);

  return (
    <div className="overlay palette-overlay" role="presentation" onClick={onClose}>
      <div className="palette" role="dialog" aria-label="Paleta" onClick={(event) => event.stopPropagation()}>
        <div className="palette-input-row">
          <span className="palette-prefix">{commandMode ? '>' : '⌕'}</span>
          <input
            ref={inputRef}
            className="palette-input"
            value={query}
            placeholder="arquivo ou > comando"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose();
              if (event.key === 'Enter' && results.length) {
                onClose();
                results[0].run();
              }
            }}
          />
        </div>
        <div className="palette-list">
          {results.length === 0 ? <div className="empty-state">—</div> : null}
          {results.map((result) => (
            <button
              type="button"
              key={result.key}
              className="palette-row"
              onClick={() => {
                onClose();
                result.run();
              }}
            >
              <Icon name={result.icon} size={15} />
              <span className="palette-label">{result.label}</span>
              {result.detail ? <span className="palette-detail">{result.detail}</span> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LanguagePicker({
  current,
  filePath,
  onPick,
  onClose,
}: {
  current: string | null;
  filePath: string;
  onPick: (languageId: string | null) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    const term = query.trim().toLowerCase();
    return languagesSorted().filter(
      (language) =>
        !term ||
        language.label.toLowerCase().includes(term) ||
        language.id.includes(term) ||
        language.extensions.some((extension) => extension.includes(term)),
    );
  }, [query]);

  return (
    <div className="overlay overlay-top" role="presentation" onClick={onClose}>
      <div className="newfile" role="dialog" aria-label={t('editor.pickLanguage')} onClick={(event) => event.stopPropagation()}>
        <div className="newfile-header">
          <button type="button" className="icon-btn" aria-label={t('common.close')} onClick={onClose}>
            <Icon name="arrow-left" size={18} />
          </button>
          <div className="language-title">
            <h2>{t('editor.pickLanguage')}</h2>
            <span>{filePath}</span>
          </div>
        </div>
        <div className="lang-search">
          <Icon name="search" size={16} />
          <input
            className="lang-search-input"
            value={query}
            placeholder={t('common.search')}
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="lang-rows">
          <button type="button" className={`lang-row${current === null ? ' selected' : ''}`} onClick={() => onPick(null)}>
            <span className="lang-badge">auto</span>
            <span className="lang-name">{t('editor.detected', { language: languageForPath(filePath).label })}</span>
          </button>
          {list.map((language) => (
            <button
              type="button"
              key={language.id}
              className={`lang-row${current === language.id ? ' selected' : ''}`}
              onClick={() => onPick(language.id)}
            >
              <span className="lang-badge">{language.extensions[0]}</span>
              <span className="lang-name">{language.label}</span>
              {language.engine ? <span className="lang-ext">▶</span> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function NewFileDialog({
  initialDir,
  onClose,
  onCreate,
}: {
  initialDir: string;
  onClose: () => void;
  onCreate: (path: string, language: string | null) => void;
}) {
  const { t } = useI18n();
  const [step, setStep] = useState<'language' | 'name'>('language');
  const [language, setLanguage] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (step === 'name') inputRef.current?.focus();
  }, [step]);

  const list = useMemo(() => {
    const term = query.trim().toLowerCase();
    return languagesSorted().filter(
      (item) =>
        !term ||
        item.label.toLowerCase().includes(term) ||
        item.id.includes(term) ||
        item.extensions.some((extension) => extension.includes(term)),
    );
  }, [query]);

  const chosen = language ? LANGUAGES.find((item) => item.id === language) : null;
  const extension = defaultExtension(language ?? 'plaintext');
  const finalName = name.trim() && !/\.\w+$/.test(name.trim()) ? `${name.trim()}.${extension}` : name.trim();

  return (
    <div className="overlay overlay-top" role="presentation" onClick={onClose}>
      <div className="newfile" role="dialog" aria-label={t('editor.newFileTitle')} onClick={(event) => event.stopPropagation()}>
        <div className="newfile-header">
          <button
            type="button"
            className="icon-btn"
            aria-label={t('common.back')}
            onClick={() => (step === 'name' ? setStep('language') : onClose())}
          >
            <Icon name="arrow-left" size={18} />
          </button>
          <div className="newfile-title">
            {t('editor.newFileTitle')}
            <span className="newfile-step">{step === 'language' ? '1/2' : '2/2'}</span>
          </div>
        </div>

        {step === 'language' ? (
          <>
            <p className="newfile-hint">{t('editor.chooseLanguage')}</p>
            <div className="lang-search">
              <Icon name="search" size={16} />
              <input
                className="lang-search-input"
                value={query}
                placeholder={t('common.search')}
                autoFocus
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="lang-rows">
              {list.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className="lang-row"
                  onClick={() => {
                    setLanguage(item.id);
                    setStep('name');
                  }}
                >
                  <span className="lang-badge">{item.extensions[0]}</span>
                  <span className="lang-name">{item.label}</span>
                  <span className="lang-ext">{item.group}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="newfile-form">
            <span className="field-label">{t('editor.nameLabel')}</span>
            <input
              ref={inputRef}
              className="text-input"
              value={name}
              placeholder={`${initialDir ? `${initialDir}/` : ''}exemplo.${extension}`}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && finalName) {
                  onClose();
                  onCreate(normalizePath(`${initialDir ? `${initialDir}/` : ''}${finalName}`), language);
                }
              }}
            />
            <button type="button" className="newfile-chosen" onClick={() => setStep('language')}>
              <span className="lang-badge">{chosen?.extensions[0] ?? 'txt'}</span>
              <span className="newfile-chosen-label">{chosen?.label ?? 'Texto simples'}</span>
              <span className="newfile-chosen-action">alterar</span>
            </button>
            <div className="newfile-actions">
              <button type="button" className="btn ghost" onClick={onClose}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={!finalName}
                onClick={() => {
                  onClose();
                  onCreate(normalizePath(`${initialDir ? `${initialDir}/` : ''}${finalName}`), language);
                }}
              >
                {t('editor.create')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
