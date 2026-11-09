/** Preferências do aplicativo (persistidas em localStorage por serem pequenas). */

export type ThemeId = 'dark' | 'light' | 'hc';

export type Settings = {
  theme: ThemeId;
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  autoSave: boolean;
  /** Intervalo do salvamento periódico (5 min por padrão). */
  autoSaveIntervalMs: number;
  keybar: boolean;
  previewAutoRefresh: boolean;
  /** Servidor Piston opcional para linguagens compiladas. */
  pistonEndpoint: string;
  gitOwner: string;
  gitRepo: string;
  gitBranch: string;
  /** 'system' segue o idioma do aparelho. */
  locale: 'system' | string;
  /** Preferências de layout guardadas como JSON livre. */
  extra: Record<string, string>;
};

export const FONT_MIN = 10;
export const FONT_MAX = 26;
export const FIVE_MINUTES = 5 * 60 * 1000;

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  fontSize: 13,
  tabSize: 2,
  wordWrap: false,
  minimap: false,
  lineNumbers: true,
  autoSave: true,
  autoSaveIntervalMs: FIVE_MINUTES,
  keybar: true,
  previewAutoRefresh: true,
  pistonEndpoint: '',
  gitOwner: '',
  gitRepo: '',
  gitBranch: 'main',
  locale: 'system',
  extra: {},
};
