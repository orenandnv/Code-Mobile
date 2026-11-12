import type { Vfs } from './vfs';

/** Projetos de exemplo criados no primeiro uso. */

const SITE_HTML = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Code Mobile · Preview</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main class="card">
      <h1>Olá, Code Mobile</h1>
      <p>Edite os arquivos e veja o preview atualizar.</p>
      <button id="action">Contador: <span id="count">0</span></button>
      <ul id="list"></ul>
    </main>
    <script type="module" src="./src/app.js"></script>
  </body>
</html>
`;

const SITE_CSS = `:root {
  --bg: #0b1220;
  --card: #111c2e;
  --fg: #e6edf3;
  --accent: #37a7ff;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at 30% 10%, #12314f, var(--bg) 60%);
  color: var(--fg);
  font-family: system-ui, -apple-system, sans-serif;
}

.card {
  width: min(92vw, 420px);
  padding: 28px;
  border-radius: 18px;
  background: var(--card);
  border: 1px solid #1e3550;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
}

h1 { margin: 0 0 6px; font-size: 22px; }
p { margin: 0 0 18px; color: #9fb3c8; font-size: 14px; }

button {
  width: 100%;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid var(--accent);
  background: rgba(55, 167, 255, 0.14);
  color: inherit;
  font-size: 15px;
}

#count { font-variant-numeric: tabular-nums; font-weight: 700; }

ul { margin: 16px 0 0; padding-left: 18px; color: #9fb3c8; font-size: 13px; }
`;

const SITE_JS = `const state = { count: 0, history: [] };

const count = document.querySelector('#count');
const list = document.querySelector('#list');

function render() {
  if (count) count.textContent = String(state.count);
  if (list) {
    list.innerHTML = state.history
      .slice(-4)
      .reverse()
      .map((value) => '<li>valor ' + value + '</li>')
      .join('');
  }
}

(document.querySelector('#action')||{addEventListener(){}}).addEventListener('click', () => {
  state.count += 1;
  state.history.push(state.count);
  render();
  console.log('contador', state.count);
});

render();
`;

const SITE_README = `# Site de exemplo

Projeto mínimo com HTML, CSS e JavaScript.

- Abra o painel **Preview** para ver o resultado.
- O preview recarrega sozinho ao salvar uma alteração.
- O console do preview mostra os \`console.log\` da página.
`;

const LAB_TS = `type Task = { title: string; done: boolean };

const tasks: Task[] = [
  { title: 'Estudar TypeScript', done: true },
  { title: 'Escrever testes', done: false },
  { title: 'Publicar o app', done: false },
];

function summary(list: Task[]): string {
  const done = list.filter((task) => task.done).length;
  return \`\${done}/\${list.length} concluídas\`;
}

console.log('Tarefas:', tasks.length);
console.log('Progresso:', summary(tasks));

for (const task of tasks) {
  console.log(task.done ? '[x]' : '[ ]', task.title);
}
`;

const LAB_LUAU = `-- Luau roda localmente no aparelho (WebAssembly)
local function fib(n: number): number
    if n < 2 then
        return n
    end
    return fib(n - 1) + fib(n - 2)
end

for i = 1, 10 do
    print(("fib(%d) = %d"):format(i, fib(i)))
end

local total = 0
for _, value in ipairs({ 4, 8, 15, 16, 23, 42 }) do
    total += value
end
print("soma:", total)
`;

const LAB_SQL = `-- SQLite real, executando no aparelho (sql.js / WASM)
CREATE TABLE linguagens (
  nome TEXT PRIMARY KEY,
  runtime TEXT NOT NULL,
  local INTEGER NOT NULL
);

INSERT INTO linguagens (nome, runtime, local) VALUES
  ('Luau', 'WASM', 1),
  ('JavaScript', 'WebView', 1),
  ('SQL', 'sql.js', 1),
  ('Python', 'Piston', 0);

SELECT nome, runtime, CASE local WHEN 1 THEN 'sim' ELSE 'não' END AS executa_no_aparelho
FROM linguagens
ORDER BY nome;
`;

const LAB_TEXT = `Tabuleiro inicial de exemplo (arquivo não executável).

first name,last name,age
Ada,Lovelace,36
Grace,Hopper,85
`;

const LAB_README = `# Scripts locais

Arquivos para testar os runtimes que rodam **no próprio aparelho**:

- \`app.ts\` — JavaScript/TypeScript (motor da WebView, transpilado com Babel)
- \`fib.luau\` — Luau (runtime oficial em WebAssembly)
- \`consultas.sql\` — SQLite (sql.js em WebAssembly)
- \`dados.csv\` — apenas texto: não aparece como executável

Abra o **Terminal** e use \`run\` para executar o arquivo ativo, ou toque em ▶ no editor.
`;

export function defaultProjects(): { name: string; vfs: Vfs }[] {
  return [
    {
      name: 'Site de exemplo',
      vfs: {
        folders: ['src'],
        files: {
          'index.html': SITE_HTML,
          'styles.css': SITE_CSS,
          'src/app.js': SITE_JS,
          'README.md': SITE_README,
        },
      },
    },
    {
      name: 'Scripts locais',
      vfs: {
        folders: [],
        files: {
          'app.ts': LAB_TS,
          'fib.luau': LAB_LUAU,
          'consultas.sql': LAB_SQL,
          'dados.csv': LAB_TEXT,
          'README.md': LAB_README,
        },
      },
    },
  ];
}
