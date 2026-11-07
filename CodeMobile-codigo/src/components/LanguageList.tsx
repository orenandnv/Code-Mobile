import { useMemo, useState } from 'react';
import monaco from '../monaco';
import {
  LANGUAGE_EXTENSIONS,
  LANGUAGE_LABELS,
  POPULAR_LANGUAGES,
  languageLabel,
} from '../lib/languages';
import { Icon } from './Icon';

export type LanguageOption = {
  id: string;
  label: string;
  extensions: string[];
};

let cachedOptions: LanguageOption[] | null = null;

function buildOptions(): LanguageOption[] {
  if (cachedOptions) return cachedOptions;

  const options: LanguageOption[] = [];
  const seen = new Set<string>();

  for (const language of monaco.languages.getLanguages()) {
    if (!language.id || seen.has(language.id) || language.id === 'plaintext') continue;
    seen.add(language.id);
    options.push({
      id: language.id,
      label: LANGUAGE_LABELS[language.id] ?? language.aliases?.[0] ?? language.id,
      extensions: (language.extensions ?? []).map((extension) => extension.replace(/^\./, '')).filter(Boolean),
    });
  }

  for (const [id, label] of Object.entries(LANGUAGE_LABELS)) {
    if (seen.has(id) || id === 'plaintext') continue;
    seen.add(id);
    options.push({
      id,
      label,
      extensions: LANGUAGE_EXTENSIONS[id] ? [LANGUAGE_EXTENSIONS[id]] : [],
    });
  }

  options.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' }));
  cachedOptions = options;
  return options;
}

export default function LanguageList({
  current,
  autoOption = false,
  onSelect,
}: {
  current: string | null;
  autoOption?: boolean;
  onSelect: (languageId: string | null) => void;
}) {
  const [query, setQuery] = useState('');
  const options = buildOptions();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      const popular = POPULAR_LANGUAGES.map((id) => options.find((option) => option.id === id)).filter(
        (option): option is LanguageOption => Boolean(option),
      );
      const rest = options.filter((option) => !POPULAR_LANGUAGES.includes(option.id));
      return [...popular, ...rest];
    }
    return options.filter((option) => {
      if (option.label.toLowerCase().includes(needle)) return true;
      if (option.id.toLowerCase().includes(needle)) return true;
      return option.extensions.some((extension) => extension.toLowerCase().includes(needle));
    });
  }, [options, query]);

  return (
    <div className="language-list">
      <div className="lang-search">
        <Icon name="search" size={16} />
        <input
          className="lang-search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar linguagem (ex.: luau, python, css)"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {query ? (
          <button type="button" className="icon-btn small" aria-label="Limpar busca" onClick={() => setQuery('')}>
            <Icon name="close" size={15} />
          </button>
        ) : null}
      </div>

      <div className="lang-rows">
        {autoOption && !query ? (
          <button
            type="button"
            className={`lang-row${current === null ? ' selected' : ''}`}
            onClick={() => onSelect(null)}
          >
            <span className="lang-badge">Aa</span>
            <span className="lang-name">Detectar pela extensão do arquivo</span>
            <span className="lang-ext">auto</span>
            {current === null ? <Icon name="check" size={16} /> : null}
          </button>
        ) : null}

        {filtered.map((option) => {
          const selected = option.id === current;
          return (
            <button
              type="button"
              key={option.id}
              className={`lang-row${selected ? ' selected' : ''}`}
              onClick={() => onSelect(option.id)}
            >
              <span className="lang-badge">{option.label.slice(0, 2)}</span>
              <span className="lang-name">{languageLabel(option.id)}</span>
              <span className="lang-ext">
                {option.extensions
                  .slice(0, 2)
                  .map((extension) => `.${extension}`)
                  .join(' ')}
              </span>
              {selected ? <Icon name="check" size={16} /> : null}
            </button>
          );
        })}

        {!filtered.length ? <div className="empty-state">Nenhuma linguagem encontrada.</div> : null}
      </div>
    </div>
  );
}
