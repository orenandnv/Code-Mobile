import { useEffect, useRef, useState } from 'react';
import { defaultExtension, languageLabel } from '../lib/languages';
import { Icon } from './Icon';
import LanguageList from './LanguageList';

export default function NewFileDialog({
  initialDir,
  onClose,
  onCreate,
}: {
  initialDir: string;
  onClose: () => void;
  /** language is null when the user picked "detect from extension". */
  onCreate: (path: string, language: string | null) => void;
}) {
  const [step, setStep] = useState<'language' | 'name'>('language');
  const [language, setLanguage] = useState<string | null>('javascript');
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const chooseLanguage = (languageId: string | null) => {
    setLanguage(languageId);
    setName(`novo.${languageId ? defaultExtension(languageId) : 'txt'}`);
    setStep('name');
  };

  useEffect(() => {
    if (step !== 'name') return;
    const timer = window.setTimeout(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      const dot = input.value.lastIndexOf('.');
      if (dot > 0) input.setSelectionRange(0, dot);
      else input.select();
    }, 90);
    return () => window.clearTimeout(timer);
  }, [step]);

  const submit = () => {
    const clean = name.trim();
    if (!clean) return;
    const path = initialDir ? `${initialDir.replace(/\/+$/, '')}/${clean}` : clean;
    onCreate(path, language);
  };

  return (
    <div className="overlay overlay-top" role="presentation">
      <div className="newfile" role="dialog" aria-label="Novo arquivo">
        <header className="newfile-header">
          <button
            type="button"
            className="icon-btn"
            aria-label={step === 'name' ? 'Voltar para a escolha de linguagem' : 'Cancelar'}
            onClick={() => (step === 'name' ? setStep('language') : onClose())}
          >
            <Icon name={step === 'name' ? 'arrow-left' : 'close'} size={19} />
          </button>
          <div className="newfile-title">
            <span>Novo arquivo</span>
            <span className="newfile-step">etapa {step === 'language' ? '1' : '2'} de 2</span>
          </div>
        </header>

        {step === 'language' ? (
          <>
            <p className="newfile-hint">Escolha a linguagem antes de começar a codar.</p>
            <LanguageList current={language} autoOption onSelect={chooseLanguage} />
          </>
        ) : (
          <form
            className="newfile-form"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <button type="button" className="newfile-chosen" onClick={() => setStep('language')}>
              <span className="lang-badge">{language ? languageLabel(language).slice(0, 2) : 'Aa'}</span>
              <span className="newfile-chosen-label">
                {language ? languageLabel(language) : 'Detectar pela extensão'}
              </span>
              <span className="newfile-chosen-action">trocar</span>
            </button>

            <label className="field-label" htmlFor="newfile-name">
              Nome do arquivo
            </label>
            <input
              id="newfile-name"
              ref={inputRef}
              className="text-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="ex.: src/script.luau"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
            />
            <p className="newfile-hint">
              Pasta: <code>{initialDir || 'raiz do projeto'}</code>
              {language ? (
                <>
                  {' '}
                  · extensão sugerida: <code>.{defaultExtension(language)}</code>
                </>
              ) : null}
            </p>

            <div className="newfile-actions">
              <button type="button" className="btn ghost" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn primary" disabled={!name.trim()}>
                Criar e abrir
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
