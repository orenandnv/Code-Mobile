/**
 * Shell integrado.
 *
 * Executa comandos reais sobre o sistema de arquivos do projeto (criar, ler,
 * mover, executar). Não é um emulador de respostas prontas: cada comando
 * altera o workspace de verdade. Binários externos do Android não existem
 * dentro da WebView, e o app informa isso em `help`.
 */

import {
  basename,
  dirname,
  entriesIn,
  filePaths,
  isFolder,
  joinPath,
  normalizePath,
  resolvePath,
  type Vfs,
} from '../workspace/vfs';

export type ShellContext = {
  vfs: Vfs;
  cwd: string;
  print: (text: string, stream?: 'out' | 'err' | 'meta') => void;
  setCwd: (dir: string) => void;
  writeFile: (path: string, content: string) => void;
  deletePath: (path: string) => void;
  createFolder: (path: string) => void;
  openFile: (path: string) => void;
  runFile: (path: string, args: string[]) => Promise<void>;
  clear: () => void;
  t: (key: string) => string;
};

export class ShellError extends Error {}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let hasContent = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quote) {
      if (char === quote) quote = null;
      else if (char === '\\' && index + 1 < input.length) {
        index += 1;
        current += input[index];
      } else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      hasContent = true;
      continue;
    }
    if (char === ' ' || char === '\t') {
      if (hasContent) {
        tokens.push(current);
        current = '';
        hasContent = false;
      }
      continue;
    }
    current += char;
    hasContent = true;
  }
  if (hasContent) tokens.push(current);
  return tokens;
}

const HELP: [string, string][] = [
  ['ls [dir]', 'lista arquivos e pastas'],
  ['cd <dir>', 'muda o diretório atual'],
  ['pwd', 'mostra o diretório atual'],
  ['cat <arquivo…>', 'mostra o conteúdo'],
  ['head/tail <arquivo>', 'primeiras/últimas 10 linhas'],
  ['wc <arquivo>', 'conta linhas, palavras e bytes'],
  ['tree [dir]', 'árvore do projeto'],
  ['find <termo>', 'busca por nome de arquivo'],
  ['grep <termo> [dir]', 'busca em todo o conteúdo'],
  ['echo <texto>', 'imprime texto (aceita > e >>)'],
  ['touch <arquivo>', 'cria um arquivo vazio'],
  ['mkdir <dir>', 'cria pasta'],
  ['rm <caminho>', 'remove arquivo ou pasta'],
  ['mv/cp <origem> <destino>', 'move/copia'],
  ['open <arquivo>', 'abre no editor'],
  ['run <arquivo>', 'executa com o runtime da linguagem'],
  ['clear', 'limpa o terminal'],
  ['date / uname / whoami', 'informações do ambiente'],
  ['exit', 'encerra a sessão'],
];

export async function executeCommand(input: string, ctx: ShellContext): Promise<number | null> {
  const trimmed = input.trim();
  if (!trimmed) return 0;

  let tokens = tokenize(trimmed);
  let redirect: { append: boolean; path: string } | null = null;
  const redirectIndex = tokens.findIndex((token) => token === '>' || token === '>>');
  if (redirectIndex >= 0 && tokens[redirectIndex + 1]) {
    redirect = { append: tokens[redirectIndex] === '>>', path: tokens[redirectIndex + 1] };
    tokens = tokens.slice(0, redirectIndex);
  }

  const [command, ...args] = tokens;
  const collected: string[] = [];
  const print = (text: string, stream: 'out' | 'err' | 'meta' = 'out') => {
    if (redirect && stream === 'out') collected.push(text);
    else ctx.print(text, stream);
  };
  const fail = (message: string) => {
    print(message, 'err');
    return 1;
  };

  const target = (value: string | undefined) => resolvePath(ctx.cwd, value ?? '');

  try {
    switch (command) {
      case 'help': {
        print('Comandos disponíveis:');
        for (const [usage, description] of HELP) print(`  ${usage.padEnd(24)} ${description}`);
        print('Compilação externa: use "run" com o Piston configurado em Ajustes → Runtimes.');
        return 0;
      }
      case 'pwd':
        print(`/${ctx.cwd}`);
        return 0;
      case 'ls': {
        const dir = target(args[0]);
        if (isFolder(ctx.vfs, dir)) {
          const entries = entriesIn(ctx.vfs, dir);
          if (!entries.length) {
            print('(vazio)');
            return 0;
          }
          for (const entry of entries) print(`${entry.type === 'folder' ? '📁' : '📄'} ${entry.name}`);
          return 0;
        }
        if (dir in ctx.vfs.files) {
          print(basename(dir));
          return 0;
        }
        return fail(`ls: ${args[0] ?? '.'}: não encontrado`);
      }
      case 'cd': {
        const dir = target(args[0] ?? '');
        if (!dir) {
          ctx.setCwd('');
          return 0;
        }
        if (isFolder(ctx.vfs, dir)) {
          ctx.setCwd(dir);
          return 0;
        }
        return fail(`cd: ${args[0]}: não é uma pasta`);
      }
      case 'cat': {
        if (!args.length) return fail('cat: informe um arquivo');
        let code = 0;
        for (const arg of args) {
          const path = target(arg);
          if (path in ctx.vfs.files) print(ctx.vfs.files[path]);
          else {
            print(`cat: ${arg}: não encontrado`, 'err');
            code = 1;
          }
        }
        return code;
      }
      case 'head':
      case 'tail': {
        const path = target(args[0]);
        if (!(path in ctx.vfs.files)) return fail(`${command}: arquivo não encontrado`);
        const lines = ctx.vfs.files[path].split('\n');
        const slice = command === 'head' ? lines.slice(0, 10) : lines.slice(-10);
        print(slice.join('\n'));
        return 0;
      }
      case 'wc': {
        const path = target(args[0]);
        if (!(path in ctx.vfs.files)) return fail('wc: arquivo não encontrado');
        const content = ctx.vfs.files[path];
        const lines = content ? content.split('\n').length : 0;
        const words = content.split(/\s+/).filter(Boolean).length;
        print(`${lines} linhas, ${words} palavras, ${new TextEncoder().encode(content).length} bytes`);
        return 0;
      }
      case 'tree': {
        const root = target(args[0]);
        const walk = (dir: string, prefix: string) => {
          for (const entry of entriesIn(ctx.vfs, dir)) {
            print(`${prefix}${entry.type === 'folder' ? '📁' : '📄'} ${entry.name}`);
            if (entry.type === 'folder') walk(entry.path, `${prefix}  `);
          }
        };
        print(`/${root || ''}`);
        walk(root, '');
        return 0;
      }
      case 'find': {
        const term = (args[0] ?? '').toLowerCase();
        if (!term) return fail('find: informe um termo');
        const matches = filePaths(ctx.vfs).filter((path) => path.toLowerCase().includes(term));
        if (!matches.length) print('nenhum arquivo encontrado');
        for (const path of matches) print(path);
        return 0;
      }
      case 'grep': {
        const term = args[0];
        if (!term) return fail('grep: informe um termo');
        let found = 0;
        const scope = args[1] ? target(args[1]) : '';
        for (const [path, content] of Object.entries(ctx.vfs.files)) {
          if (scope && !path.startsWith(scope)) continue;
          const lines = content.split('\n');
          lines.forEach((line, index) => {
            if (line.includes(term)) {
              found += 1;
              print(`${path}:${index + 1}: ${line.trim().slice(0, 160)}`);
            }
          });
        }
        if (!found) print('sem ocorrências');
        return found ? 0 : 1;
      }
      case 'echo': {
        print(args.join(' '));
        return 0;
      }
      case 'touch': {
        if (!args[0]) return fail('touch: informe um arquivo');
        const path = target(args[0]);
        if (!(path in ctx.vfs.files)) ctx.writeFile(path, '');
        return 0;
      }
      case 'mkdir': {
        if (!args[0]) return fail('mkdir: informe uma pasta');
        ctx.createFolder(target(args[0]));
        return 0;
      }
      case 'rm': {
        if (!args[0]) return fail('rm: informe um caminho');
        const path = target(args[0]);
        if (!(path in ctx.vfs.files) && !isFolder(ctx.vfs, path)) return fail(`rm: ${args[0]}: não encontrado`);
        ctx.deletePath(path);
        return 0;
      }
      case 'mv':
      case 'cp': {
        if (args.length < 2) return fail(`${command}: origem e destino`);
        const from = target(args[0]);
        const to = target(args[1]);
        if (!(from in ctx.vfs.files)) return fail(`${command}: ${args[0]}: não encontrado`);
        ctx.writeFile(to, ctx.vfs.files[from]);
        if (command === 'mv') ctx.deletePath(from);
        return 0;
      }
      case 'open': {
        const path = target(args[0]);
        if (!(path in ctx.vfs.files)) return fail('open: arquivo não encontrado');
        ctx.openFile(path);
        return 0;
      }
      case 'run':
      case 'node':
      case 'python3': {
        if (!args[0]) return fail('run: informe um arquivo');
        const path = target(args[0]);
        if (!(path in ctx.vfs.files)) return fail(`run: ${args[0]}: não encontrado`);
        await ctx.runFile(path, args.slice(1));
        return 0;
      }
      case 'clear':
        ctx.clear();
        return 0;
      case 'date':
        print(new Date().toLocaleString());
        return 0;
      case 'whoami':
        print('codemobile');
        return 0;
      case 'uname':
        print(`Code Mobile · ${navigator.userAgent.includes('Android') ? 'Android' : 'WebView'} · WebAssembly`);
        return 0;
      case 'exit':
        return null;
      case 'git':
        print('Para Git use o painel Git (controle de versão com GitHub).', 'meta');
        return 0;
      default:
        return fail(`${command}: comando não encontrado (use help)`);
    }
  } catch (error) {
    return fail(`${command}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (redirect) {
      const path = normalizePath(resolvePath(ctx.cwd, redirect.path));
      const previous = redirect.append ? ctx.vfs.files[path] ?? '' : '';
      const next = previous ? `${previous}\n${collected.join('\n')}` : collected.join('\n');
      ctx.writeFile(path, next);
    }
  }
}

/** Executa um script .sh linha a linha, com o mesmo contexto do terminal. */
export async function executeScript(source: string, ctx: ShellContext): Promise<void> {
  const lines = source.split('\n');
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    index += 1;
    if (!line || line.startsWith('#')) continue;
    ctx.print(`$ ${line}`, 'meta');
    const code = await executeCommand(line, ctx);
    if (code === null) return;
  }
}

export function completions(vfs: Vfs, cwd: string): string[] {
  const commands = HELP.map(([usage]) => usage.split(' ')[0]);
  const files = filePaths(vfs).map((path) => path.slice(dirname(path) ? dirname(path).length + 1 : 0));
  return Array.from(new Set([...commands, ...files, 'clear', 'exit'])).sort();
}

export function resolveInCwd(cwd: string, value: string): string {
  return joinPath(cwd, value);
}
