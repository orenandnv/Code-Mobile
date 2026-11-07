export type Theme = 'dark' | 'light' | 'hc';

export type Settings = {
  theme: Theme;
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  autoSave: boolean;
  renderWhitespace: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  fontSize: 14,
  tabSize: 2,
  wordWrap: true,
  minimap: false,
  lineNumbers: true,
  autoSave: true,
  renderWhitespace: false,
};

export const FONT_MIN = 10;
export const FONT_MAX = 26;

export type Session = {
  tabs: string[];
  active: string | null;
};
