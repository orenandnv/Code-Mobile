export type Workspace = {
  files: Record<string, string>;
  folders: string[];
};

export type EntryType = 'file' | 'folder';
export type Entry = { path: string; name: string; type: EntryType };

export function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const raw of path.replace(/\\/g, '/').split('/')) {
    if (!raw || raw === '.') continue;
    if (raw === '..') {
      parts.pop();
      continue;
    }
    parts.push(raw);
  }
  return parts.join('/');
}

export function dirname(path: string): string {
  const index = path.lastIndexOf('/');
  return index <= 0 ? (index === 0 ? '' : '') : path.slice(0, index);
}

export function basename(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? path : path.slice(index + 1);
}

export function extname(path: string): string {
  const name = basename(path);
  const index = name.lastIndexOf('.');
  if (index <= 0) return '';
  return name.slice(index + 1).toLowerCase();
}

export function stem(path: string): string {
  const name = basename(path);
  const index = name.lastIndexOf('.');
  return index <= 0 ? name : name.slice(0, index);
}

export function joinPath(dir: string, name: string): string {
  return normalizePath(dir ? `${dir}/${name}` : name);
}

export function resolvePath(cwd: string, input: string): string {
  if (!input) return normalizePath(cwd);
  if (input.startsWith('/')) return normalizePath(input);
  return normalizePath(cwd ? `${cwd}/${input}` : input);
}

export function isUnder(path: string, dir: string): boolean {
  return path === dir || path.startsWith(`${dir}/`);
}

export function replacePrefix(path: string, from: string, to: string): string {
  if (path === from) return to;
  if (path.startsWith(`${from}/`)) return `${to}${path.slice(from.length)}`;
  return path;
}

export function sortEntries(a: Entry, b: Entry): number {
  if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
  return a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' });
}

export function entriesIn(workspace: Workspace, dir: string): Entry[] {
  const folders: Entry[] = workspace.folders
    .filter((folder) => dirname(folder) === dir && folder !== dir)
    .map((folder) => ({ path: folder, name: basename(folder), type: 'folder' as const }));
  const files: Entry[] = Object.keys(workspace.files)
    .filter((file) => dirname(file) === dir)
    .map((file) => ({ path: file, name: basename(file), type: 'file' as const }));
  return [...folders, ...files].sort(sortEntries);
}

export function filePaths(workspace: Workspace): string[] {
  return Object.keys(workspace.files).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function allPaths(workspace: Workspace): string[] {
  return [...workspace.folders, ...Object.keys(workspace.files)];
}

const README = `# Bem-vindo ao Code Mobile

Um editor de código mobile-first montado sobre o **Monaco** — o mesmo motor de edição usado pelo VS Code.

## O que está incluído

- Editor completo: realce de sintaxe, autocomplete, formatação e localizar/substituir
- Explorador de arquivos com criar, renomear, duplicar e excluir
- Abas, paleta de comandos e busca global em todos os arquivos
- Terminal integrado que opera no espaço de trabalho local
- Barra de teclas extras para teclado de celular (Tab, setas, símbolos)
- Tema escuro, claro e alto contraste; tamanho de fonte e quebra de linha ajustáveis
- Instalável na tela inicial e funciona offline

## Atalhos (teclado físico)

| Ação | Atalho |
| --- | --- |
| Abrir arquivo rápido | Ctrl/Cmd + P |
| Paleta de comandos | Ctrl/Cmd + Shift + P |
| Salvar | Ctrl/Cmd + S |
| Explorador | Ctrl/Cmd + B |
| Terminal | Ctrl/Cmd + J |
| Localizar | Ctrl/Cmd + F |

> Dica: no celular, use o botão \`⌨\` acima do teclado para inserir Tab, setas e símbolos.
`;

const APP_JS = `// Demonstração: contador simples com estado local
const state = {
  count: 0,
  theme: 'dark',
};

function render() {
  const counter = document.querySelector('#counter');
  if (!counter) return;

  counter.textContent = String(state.count);
  counter.dataset.theme = state.theme;
}

export function increment(step = 1) {
  state.count += step;
  render();
  return state.count;
}

export function reset() {
  state.count = 0;
  render();
}

document.addEventListener('click', (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && target.matches('[data-action="increment"]')) {
    increment(Number(target.dataset.step ?? 1));
  }
});

render();

export default state;
`;

const STYLES_CSS = `:root {
  --bg: #101418;
  --fg: #e6edf3;
  --accent: #38bdf8;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  font-family: system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--fg);
}

.counter {
  font-size: 72px;
  font-variant-numeric: tabular-nums;
  color: var(--accent);
}

button {
  border: 1px solid var(--accent);
  background: transparent;
  color: inherit;
  border-radius: 999px;
  padding: 12px 20px;
  font-size: 16px;
}
`;

const INDEX_HTML = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Contador</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main>
      <h1 id="counter" class="counter">0</h1>
      <button data-action="increment" data-step="1">+1</button>
      <button data-action="increment" data-step="10">+10</button>
    </main>
    <script type="module" src="./app.js"></script>
  </body>
</html>
`;

const PACKAGE_JSON = `{
  "name": "contador-demo",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  }
}
`;

export function createDefaultWorkspace(): Workspace {
  return {
    folders: ['src', 'assets'],
    files: {
      'README.md': README,
      'src/app.js': APP_JS,
      'src/styles.css': STYLES_CSS,
      'index.html': INDEX_HTML,
      'package.json': PACKAGE_JSON,
    },
  };
}
