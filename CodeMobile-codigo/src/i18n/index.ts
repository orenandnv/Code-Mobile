import { useCallback, useEffect, useState } from 'react';
import ptBR from './pt-BR.json';
import en from './en.json';

type Locale = 'pt-BR' | 'en';
type Translations = typeof ptBR;

const STORAGE_KEY = 'codemobile.locale.v1';
const DEFAULT_LOCALE: Locale = 'pt-BR';

const locales: Record<Locale, Translations> = { 'pt-BR': ptBR, en };

export function getTranslations(locale: Locale): Translations {
  return locales[locale] ?? locales[DEFAULT_LOCALE];
}

export function getStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'pt-BR' || stored === 'en') return stored;
  } catch {
    // ignore
  }
  return DEFAULT_LOCALE;
}

export function setStoredLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // ignore
  }
}

export function useLocale(): [Locale, (locale: Locale) => void] {
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale);

  const setLocale = useCallback((next: Locale) => {
    setStoredLocale(next);
    setLocaleState(next);
  }, []);

  useEffect(() => {
    const handle = () => setLocaleState(getStoredLocale());
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) handle();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [setLocale]);

  return [locale, setLocale];
}

export type { Locale, Translations };
