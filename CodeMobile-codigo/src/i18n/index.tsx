import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { prefGet, prefSet } from '../core/kv';
import ptBR from './locales/pt-BR';
import en from './locales/en';
import es from './locales/es';
import fr from './locales/fr';
import de from './locales/de';
import it from './locales/it';
import ja from './locales/ja';
import zhCN from './locales/zh-CN';
import ko from './locales/ko';
import ru from './locales/ru';

export type Dict = Record<string, string>;

export const LOCALES = [
  { id: 'pt-BR', label: 'Português (Brasil)', short: 'PT' },
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'es', label: 'Español', short: 'ES' },
  { id: 'fr', label: 'Français', short: 'FR' },
  { id: 'de', label: 'Deutsch', short: 'DE' },
  { id: 'it', label: 'Italiano', short: 'IT' },
  { id: 'ja', label: '日本語', short: 'JA' },
  { id: 'zh-CN', label: '简体中文', short: 'ZH' },
  { id: 'ko', label: '한국어', short: 'KO' },
  { id: 'ru', label: 'Русский', short: 'RU' },
] as const;

const DICTS: Record<string, Dict> = {
  'pt-BR': ptBR,
  en,
  es,
  fr,
  de,
  it,
  ja,
  'zh-CN': zhCN,
  ko,
  ru,
};

const FALLBACK = 'pt-BR';
const PREF_KEY = 'locale';

/** Mapeia o idioma do sistema para um idioma suportado. */
export function matchLocale(input: string | undefined): string | null {
  if (!input) return null;
  const raw = input.replace('_', '-').toLowerCase();
  const exact = LOCALES.find((locale) => locale.id.toLowerCase() === raw);
  if (exact) return exact.id;
  const base = raw.split('-')[0];
  const byBase = LOCALES.find((locale) => locale.id.toLowerCase().split('-')[0] === base);
  if (byBase) return byBase.id;
  // Chinês tradicional e variantes caem no simplificado.
  if (base === 'zh') return 'zh-CN';
  if (base === 'pt') return 'pt-BR';
  return null;
}

export function detectSystemLocale(): string {
  const candidates =
    typeof navigator !== 'undefined'
      ? [...(navigator.languages ?? []), navigator.language]
      : [];
  for (const candidate of candidates) {
    const matched = matchLocale(candidate);
    if (matched) return matched;
  }
  return FALLBACK;
}

export function initialLocale(): string {
  const stored = prefGet<string | null>(PREF_KEY, null);
  if (stored && DICTS[stored]) return stored;
  return detectSystemLocale();
}

type I18nValue = {
  locale: string;
  setLocale: (locale: string) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  formatDate: (value: number | Date) => string;
  formatNumber: (value: number) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<string>(() => initialLocale());

  const setLocale = useCallback((next: string) => {
    if (!DICTS[next]) return;
    setLocaleState(next);
    prefSet(PREF_KEY, next);
    try {
      document.documentElement.lang = next;
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dict = DICTS[locale] ?? DICTS[FALLBACK];
    const fallback = DICTS[FALLBACK];
    const t = (key: string, vars?: Record<string, string | number>) => {
      const template = dict[key] ?? fallback[key] ?? key;
      if (!vars) return template;
      return template.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in vars ? String(vars[name]) : match,
      );
    };
    const formatDate = (value: number | Date) => {
      try {
        return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(value);
      } catch {
        return new Date(value).toLocaleString();
      }
    };
    const formatNumber = (value: number) => {
      try {
        return new Intl.NumberFormat(locale).format(value);
      } catch {
        return String(value);
      }
    };
    return { locale, setLocale, t, formatDate, formatNumber };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n precisa estar dentro de <I18nProvider>');
  return context;
}

export function localeLabel(id: string): string {
  return LOCALES.find((locale) => locale.id === id)?.label ?? id;
}
