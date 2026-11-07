import { useEffect, useRef, useState } from 'react';

const PREFIX = 'code-mobile:';

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable (private mode) — the app keeps working in memory */
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

export function usePersistentState<T>(
  key: string,
  initial: T | (() => T),
): [T, (value: T | ((previous: T) => T)) => void] {
  const [state, setState] = useState<T>(() => loadJSON(key, typeof initial === 'function' ? (initial as () => T)() : initial));
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
    }
    saveJSON(key, state);
  }, [key, state]);

  return [state, setState];
}
