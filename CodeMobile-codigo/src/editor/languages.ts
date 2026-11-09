/**
 * Registro único de linguagens.
 *
 * `engine` diz como o arquivo pode ser executado de verdade:
 *  - js / ts / luau / lua / sql / shell → motores locais (no aparelho)
 *  - piston                          → serviço externo (Piston), transparente na interface
 *  - null                            → não executável (só edição/preview)
 */

export type EngineId = 'js' | 'ts' | 'luau' | 'lua' | 'sql' | 'shell' | 'piston';

export type LanguageGroup = 'web' | 'general' | 'data' | 'config';

export type LanguageDef = {
  id: string;
  label: string;
  monaco: string;
  extensions: string[];
  filenames?: string[];
  group: LanguageGroup;
  engine: EngineId | null;
  /** Nome do runtime no Piston, quando aplicável. */
  piston?: string;
  /** Pode ser renderizado no preview web. */
  preview?: boolean;
};

export const LANGUAGES: LanguageDef[] = [
  // ---------------------------------------------------------------- web
  { id: 'html', label: 'HTML', monaco: 'html', extensions: ['html', 'htm', 'xhtml'], group: 'web', engine: null, preview: true },
  { id: 'css', label: 'CSS', monaco: 'css', extensions: ['css'], group: 'web', engine: null, preview: true },
  { id: 'scss', label: 'SCSS', monaco: 'scss', extensions: ['scss'], group: 'web', engine: null, preview: true },
  { id: 'sass', label: 'Sass', monaco: 'scss', extensions: ['sass'], group: 'web', engine: null, preview: true },
  { id: 'less', label: 'Less', monaco: 'less', extensions: ['less'], group: 'web', engine: null, preview: true },
  { id: 'javascript', label: 'JavaScript', monaco: 'javascript', extensions: ['js', 'mjs', 'cjs'], group: 'web', engine: 'js', preview: true },
  { id: 'jsx', label: 'JavaScript React (JSX)', monaco: 'javascript', extensions: ['jsx'], group: 'web', engine: 'js', preview: true },
  { id: 'typescript', label: 'TypeScript', monaco: 'typescript', extensions: ['ts', 'mts', 'cts'], group: 'web', engine: 'ts', preview: true },
  { id: 'tsx', label: 'TypeScript React (TSX)', monaco: 'typescript', extensions: ['tsx'], group: 'web', engine: 'ts', preview: true },
  { id: 'vue', label: 'Vue', monaco: 'html', extensions: ['vue'], group: 'web', engine: null, preview: true },
  { id: 'svelte', label: 'Svelte', monaco: 'html', extensions: ['svelte'], group: 'web', engine: null, preview: true },

  // ------------------------------------------------------------ general
  { id: 'python', label: 'Python', monaco: 'python', extensions: ['py', 'pyw'], group: 'general', engine: 'piston', piston: 'python' },
  { id: 'java', label: 'Java', monaco: 'java', extensions: ['java'], group: 'general', engine: 'piston', piston: 'java' },
  { id: 'kotlin', label: 'Kotlin', monaco: 'kotlin', extensions: ['kt', 'kts'], group: 'general', engine: 'piston', piston: 'kotlin' },
  { id: 'c', label: 'C', monaco: 'c', extensions: ['c', 'h'], group: 'general', engine: 'piston', piston: 'c' },
  { id: 'cpp', label: 'C++', monaco: 'cpp', extensions: ['cpp', 'cc', 'cxx', 'hpp', 'hh'], group: 'general', engine: 'piston', piston: 'c++' },
  { id: 'csharp', label: 'C#', monaco: 'csharp', extensions: ['cs'], group: 'general', engine: 'piston', piston: 'csharp' },
  { id: 'go', label: 'Go', monaco: 'go', extensions: ['go'], group: 'general', engine: 'piston', piston: 'go' },
  { id: 'rust', label: 'Rust', monaco: 'rust', extensions: ['rs'], group: 'general', engine: 'piston', piston: 'rust' },
  { id: 'swift', label: 'Swift', monaco: 'swift', extensions: ['swift'], group: 'general', engine: 'piston', piston: 'swift' },
  { id: 'dart', label: 'Dart', monaco: 'dart', extensions: ['dart'], group: 'general', engine: 'piston', piston: 'dart' },
  { id: 'php', label: 'PHP', monaco: 'php', extensions: ['php', 'phtml'], group: 'general', engine: 'piston', piston: 'php' },
  { id: 'ruby', label: 'Ruby', monaco: 'ruby', extensions: ['rb'], group: 'general', engine: 'piston', piston: 'ruby' },
  { id: 'lua', label: 'Lua', monaco: 'lua', extensions: ['lua'], group: 'general', engine: 'lua' },
  { id: 'luau', label: 'Luau', monaco: 'luau', extensions: ['luau'], group: 'general', engine: 'luau' },
  { id: 'zig', label: 'Zig', monaco: 'zig', extensions: ['zig'], group: 'general', engine: 'piston', piston: 'zig' },
  { id: 'elixir', label: 'Elixir', monaco: 'elixir', extensions: ['ex', 'exs'], group: 'general', engine: 'piston', piston: 'elixir' },
  { id: 'erlang', label: 'Erlang', monaco: 'ini', extensions: ['erl', 'hrl'], group: 'general', engine: 'piston', piston: 'erlang' },
  { id: 'perl', label: 'Perl', monaco: 'perl', extensions: ['pl', 'pm'], group: 'general', engine: 'piston', piston: 'perl' },
  { id: 'r', label: 'R', monaco: 'r', extensions: ['r'], group: 'general', engine: 'piston', piston: 'rscript' },
  { id: 'scala', label: 'Scala', monaco: 'scala', extensions: ['scala', 'sc'], group: 'general', engine: 'piston', piston: 'scala' },
  { id: 'haskell', label: 'Haskell', monaco: 'ini', extensions: ['hs', 'lhs'], group: 'general', engine: 'piston', piston: 'haskell' },
  { id: 'clojure', label: 'Clojure', monaco: 'clojure', extensions: ['clj', 'cljs', 'cljc'], group: 'general', engine: 'piston', piston: 'clojure' },
  { id: 'gdscript', label: 'GDScript', monaco: 'python', extensions: ['gd'], group: 'general', engine: null },

  // --------------------------------------------------------------- data
  { id: 'sql', label: 'SQL', monaco: 'sql', extensions: ['sql'], group: 'data', engine: 'sql' },
  { id: 'shell', label: 'Shell Script', monaco: 'shell', extensions: ['sh', 'bash', 'zsh'], filenames: ['.bashrc', '.profile'], group: 'data', engine: 'shell' },
  { id: 'powershell', label: 'PowerShell', monaco: 'powershell', extensions: ['ps1', 'psm1'], group: 'data', engine: 'piston', piston: 'powershell' },
  { id: 'batch', label: 'Batch', monaco: 'bat', extensions: ['bat', 'cmd'], group: 'data', engine: null },
  { id: 'graphql', label: 'GraphQL', monaco: 'graphql', extensions: ['graphql', 'gql'], group: 'data', engine: null },

  // ------------------------------------------------------------- config
  { id: 'json', label: 'JSON', monaco: 'json', extensions: ['json', 'jsonc', 'webmanifest'], filenames: ['package.json', 'tsconfig.json'], group: 'config', engine: null },
  { id: 'yaml', label: 'YAML', monaco: 'yaml', extensions: ['yml', 'yaml'], group: 'config', engine: null },
  { id: 'xml', label: 'XML', monaco: 'xml', extensions: ['xml', 'svg', 'xsd'], group: 'config', engine: null },
  { id: 'markdown', label: 'Markdown', monaco: 'markdown', extensions: ['md', 'markdown', 'mdx'], group: 'config', engine: null },
  { id: 'dockerfile', label: 'Dockerfile', monaco: 'dockerfile', extensions: ['dockerfile'], filenames: ['Dockerfile', 'dockerfile'], group: 'config', engine: null },
  { id: 'makefile', label: 'Makefile', monaco: 'shell', extensions: ['mk', 'make'], filenames: ['Makefile', 'makefile'], group: 'config', engine: null },
  { id: 'ini', label: 'INI / TOML', monaco: 'ini', extensions: ['ini', 'toml', 'env', 'conf', 'cfg'], group: 'config', engine: null },
  { id: 'plaintext', label: 'Texto simples', monaco: 'plaintext', extensions: ['txt', 'log', 'csv', 'gitignore'], filenames: ['.gitignore', '.editorconfig'], group: 'config', engine: null },
];

const BY_ID = new Map(LANGUAGES.map((language) => [language.id, language]));
const BY_EXTENSION = new Map<string, LanguageDef>();
const BY_FILENAME = new Map<string, LanguageDef>();

for (const language of LANGUAGES) {
  for (const extension of language.extensions) {
    if (!BY_EXTENSION.has(extension)) BY_EXTENSION.set(extension, language);
  }
  for (const filename of language.filenames ?? []) {
    if (!BY_FILENAME.has(filename.toLowerCase())) BY_FILENAME.set(filename.toLowerCase(), language);
  }
}

export function languageById(id: string): LanguageDef | undefined {
  return BY_ID.get(id);
}

export function languageForPath(path: string): LanguageDef {
  const name = (path.split('/').pop() ?? '').toLowerCase();
  const byName = BY_FILENAME.get(name);
  if (byName) return byName;
  const dot = name.lastIndexOf('.');
  const extension = dot > 0 ? name.slice(dot + 1) : '';
  if (!extension) return BY_ID.get('plaintext')!;
  return BY_EXTENSION.get(extension) ?? BY_ID.get('plaintext')!;
}

export function defaultExtension(languageId: string): string {
  return languageById(languageId)?.extensions[0] ?? 'txt';
}

export function languagesSorted(): LanguageDef[] {
  const order: LanguageGroup[] = ['web', 'general', 'data', 'config'];
  return [...LANGUAGES].sort((a, b) => {
    const groupDiff = order.indexOf(a.group) - order.indexOf(b.group);
    if (groupDiff !== 0) return groupDiff;
    return a.label.localeCompare(b.label);
  });
}

/** Linguagens que realmente executam código, com a origem do runtime. */
export function runnableLanguages(): LanguageDef[] {
  return LANGUAGES.filter((language) => language.engine !== null);
}

export function engineKind(language: LanguageDef): 'local' | 'remote' | null {
  if (!language.engine) return null;
  return language.engine === 'piston' ? 'remote' : 'local';
}
