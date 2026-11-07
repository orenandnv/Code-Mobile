import type { Theme } from './types';
import { basename, dirname, extname, joinPath, normalizePath, resolvePath } from './vfs';
import type { ScriptRun } from './luauRuntime';
import { getRuntimeEndpoint, setRuntimeEndpoint } from './codeRuntime';
import { languageForPath } from './languages';

export type ShellIO = {
  files: Record<string, string>;
  folders: string[];
  writeFile: (path: string, content: string) => void;
  deletePath: (path: string) => void;
  createFolder: (path: string) => void;
  openFile: (path: string) => void;
  setTheme: (theme: Theme) => void;
  /** Texto atual do editor (inclui alterações ainda não salvas). */
  readFile?: (path: string) => string | undefined;
  /** Arquivo aberto, usado por `run` sem argumentos. */
  activePath?: string | null;
  /** Executa um script usando o runtime local Luau ou o servidor configurado. */
  runScript?: (path: string, source: string, args: string[]) => Promise<ScriptRun>;
};

export type ShellResult = {
  cwd: string;
  lines: string[];
  clear?: boolean;
};

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: string | null = null;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

function childEntries(io: ShellIO, dir: string) {
  const folders = io.folders.filter((folder) => dirname(folder) === dir).map((folder) => `${basename(folder)}/`);
  const files = Object.keys(io.files)
    .filter((file) => dirname(file) === dir)
    .map((file) => basename(file));
  return [...folders.sort(), ...files.sort()];
}

function isFolder(io: ShellIO, path: string) {
  return io.folders.includes(path);
}

export async function execCommand(raw: string, cwd: string, io: ShellIO): Promise<ShellResult> {
  const input = raw.trim();
  const lines: string[] = [];
  if (!input) return { cwd, lines };

  const tokens = tokenize(input);
  let command = tokens[0];
  let args = tokens.slice(1);

  // `./script.luau arg` executa o script diretamente.
  if (/^\\.\\.?\\/.+\\.[a-z0-9]+$/i.test(command)) {
    args = [command, ...args];
    command = 'run';
  }

  const pathOf = (value: string) => resolvePath(cwd, value);

  switch (command) {
    case 'help':
      lines.push(
        'Comandos disponíveis:',
        '  ls [dir]          lista arquivos e pastas',
        '  cd [dir]          muda de diretório',
        '  pwd               diretório atual',
        '  cat <arquivo>     mostra o conteúdo',
        '  touch <arquivo>   cria um arquivo vazio',
        '  mkdir <dir>       cria uma pasta',
        '  rm <caminho>      remove arquivo ou pasta',
        '  cp <origem> <destino>',
        '  mv <origem> <destino>',
        '  echo <texto> [> arquivo]',
        '  grep <termo> [dir] busca no conteúdo',
        '  wc <arquivo>      linhas, palavras e caracteres',
        '  tree              árvore do projeto',
        '  code <arquivo>    abre o arquivo no editor',
        '  run [arquivo] [args] executa um programa compatível',
        '  runtime endpoint <url> configura servidor Piston compatível',
        '  runtime status mostra o servidor configurado',
        '  theme <dark|light|hc>',
        '  clear             limpa o terminal',
        '  date, whoami, about',
      );
      break;

    case 'clear':
      return { cwd, lines, clear: true };

    case 'pwd':
      lines.push(`/${cwd}`);
      break;

    case 'whoami':
      lines.push('dev');
      break;

    case 'date':
      lines.push(new Date().toLocaleString('pt-BR'));
      break;

    case 'about':
      lines.push('Code Mobile 1.0 — editor mobile baseado no Monaco (motor do VS Code).');
      break;

    case 'ls': {
      const target = args[0] ? pathOf(args[0]) : cwd;
      if (target && !isFolder(io, target)) {
        if (target in io.files) {
          lines.push(basename(target));
        } else {
          lines.push(`ls: ${args[0]}: não encontrado`);
        }
        break;
      }
      const entries = childEntries(io, target);
      if (!entries.length) lines.push('(vazio)');
      else lines.push(...entries);
      break;
    }

    case 'cd': {
      const target = args[0] ? pathOf(args[0]) : '';
      if (target !== '' && !isFolder(io, target)) {
        lines.push(`cd: ${args[0]}: diretório não encontrado`);
        break;
      }
      cwd = target;
      break;
    }

    case 'cat': {
      if (!args[0]) {
        lines.push('uso: cat <arquivo>');
        break;
      }
      const target = pathOf(args[0]);
      if (!(target in io.files)) {
        lines.push(`cat: ${args[0]}: arquivo não encontrado`);
        break;
      }
      lines.push(...(io.files[target] || '(arquivo vazio)').split('\n'));
      break;
    }

    case 'touch': {
      if (!args[0]) {
        lines.push('uso: touch <arquivo>');
        break;
      }
      const target = pathOf(args[0]);
      if (isFolder(io, target)) {
        lines.push(`touch: ${args[0]} já existe como pasta`);
        break;
      }
      io.writeFile(target, io.files[target] ?? '');
      lines.push(`criado ${target}`);
      break;
    }

    case 'mkdir': {
      if (!args[0]) {
        lines.push('uso: mkdir <pasta>');
        break;
      }
      const target = pathOf(args[0]);
      if (isFolder(io, target)) {
        lines.push(`mkdir: ${args[0]} já existe`);
        break;
      }
      io.createFolder(target);
      lines.push(`pasta criada ${target}`);
      break;
    }

    case 'rm': {
      if (!args[0]) {
        lines.push('uso: rm <caminho>');
        break;
      }
      const target = pathOf(args[0].replace(/^-r$/, '') || '');
      if (!(target in io.files) && !isFolder(io, target)) {
        lines.push(`rm: ${args[0]}: não encontrado`);
        break;
      }
      io.deletePath(target);
      lines.push(`removido ${target}`);
      break;
    }

    case 'cp':
    case 'mv': {
      const source = args[0] ? pathOf(args[0]) : '';
      const destination = args[1] ? pathOf(args[1]) : '';
      if (!source || !destination) {
        lines.push(`uso: ${command} <origem> <destino>`);
        break;
      }
      if (!(source in io.files)) {
        lines.push(`${command}: ${args[0]}: arquivo não encontrado`);
        break;
      }
      const target = isFolder(io, destination) ? joinPath(destination, basename(source)) : destination;
      io.writeFile(target, io.files[source]);
      if (command === 'mv') io.deletePath(source);
      lines.push(`${command === 'mv' ? 'movido' : 'copiado'} ${source} → ${target}`);
      break;
    }

    case 'echo': {
      const redirect = args.indexOf('>');
      if (redirect !== -1) {
        const text = args.slice(0, redirect).join(' ');
        const target = args[redirect + 1] ? pathOf(args[redirect + 1]) : '';
        if (!target) {
          lines.push('uso: echo <texto> > <arquivo>');
          break;
        }
        io.writeFile(target, text);
        lines.push(`${text.length} bytes escritos em ${target}`);
        break;
      }
      lines.push(args.join(' '));
      break;
    }

    case 'grep': {
      if (!args[0]) {
        lines.push('uso: grep <termo> [dir]');
        break;
      }
      const term = args[0].toLowerCase();
      const scope = args[1] ? pathOf(args[1]) : cwd;
      let matches = 0;
      for (const [file, content] of Object.entries(io.files)) {
        if (scope && !(file === scope || file.startsWith(`${scope}/`))) continue;
        content.split('\n').forEach((line, index) => {
          if (line.toLowerCase().includes(term)) {
            matches += 1;
            if (matches <= 200) lines.push(`${file}:${index + 1}: ${line.trim()}`);
          }
        });
      }
      if (!matches) lines.push(`grep: nenhuma ocorrência de "${args[0]}"`);
      break;
    }

    case 'wc': {
      if (!args[0]) {
        lines.push('uso: wc <arquivo>');
        break;
      }
      const target = pathOf(args[0]);
      if (!(target in io.files)) {
        lines.push(`wc: ${args[0]}: arquivo não encontrado`);
        break;
      }
      const content = io.files[target];
      const lineCount = content ? content.split('\n').length : 0;
      const words = content ? content.split(/\s+/).filter(Boolean).length : 0;
      lines.push(`${lineCount} linhas  ${words} palavras  ${content.length} caracteres  ${target}`);
      break;
    }

    case 'tree': {
      const walk = (dir: string, prefix: string, depth: number) => {
        if (depth > 6) return;
        const entries = childEntries(io, dir);
        entries.forEach((entry, index) => {
          const last = index === entries.length - 1;
          lines.push(`${prefix}${last ? '└── ' : '├── '}${entry}`);
          if (entry.endsWith('/')) {
            walk(joinPath(dir, entry.slice(0, -1)), `${prefix}${last ? '    ' : '│   '}`, depth + 1);
          }
        });
      };
      lines.push(normalizePath(cwd) || '.');
      walk(cwd, '', 0);
      break;
    }

    case 'code':
    case 'open': {
      if (!args[0]) {
        lines.push('uso: code <arquivo>');
        break;
      }
      const target = pathOf(args[0]);
      if (!(target in io.files) && !isFolder(io, target)) {
        lines.push(`code: ${args[0]}: não encontrado`);
        break;
      }
      io.openFile(target);
      lines.push(`abrindo ${target}`);
      break;
    }

    case 'runtime': {
      const subcommand = args[0];
      if (subcommand === 'status') {
        lines.push(getRuntimeEndpoint() || 'Nenhum servidor Piston configurado.');
      } else if (subcommand === 'endpoint' && args[1]) {
        try {
          const endpoint = args.slice(1).join(' ');
          setRuntimeEndpoint(endpoint);
          lines.push(`Servidor configurado: ${getRuntimeEndpoint()}`);
        } catch (error) {
          lines.push(`runtime: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else if (subcommand === 'endpoint' && !args[1]) {
        setRuntimeEndpoint('');
        lines.push('Servidor externo removido.');
      } else {
        lines.push('uso: runtime endpoint <https://host/api/v2> | runtime status | runtime endpoint');
      }
      break;
    }

    case 'run':
    case 'luau': {
      const target = args[0] ? pathOf(args[0]) : (io.activePath ?? '');
      if (!target) {
        lines.push('uso: run <arquivo> [argumentos]  (ou abra um arquivo e digite "run")');
        break;
      }
      const source = io.readFile?.(target) ?? io.files[target];
      if (source === undefined) {
        lines.push(`run: ${args[0] ?? target}: arquivo não encontrado`);
        break;
      }
      if (!io.runScript) {
        lines.push('run: nenhum executor disponível neste dispositivo');
        break;
      }
      const scriptArgs = args.slice(1);
      const language = languageForPath(target);
      lines.push(`▶ ${basename(target)} · ${language}${scriptArgs.length ? ` ${scriptArgs.join(' ')}` : ''}`);
      const result = await io.runScript(target, source, scriptArgs);
      lines.push(...result.lines);
      if (result.ok) lines.push(`✔ concluído em ${Math.max(1, Math.round(result.durationMs))} ms`);
      break;
    }

    case 'theme': {
      const value = args[0];
      if (value !== 'dark' && value !== 'light' && value !== 'hc') {
        lines.push('uso: theme <dark|light|hc>');
        break;
      }
      io.setTheme(value);
      lines.push(`tema alterado para ${value}`);
      break;
    }

    default:
      lines.push(`${command}: comando não encontrado. Digite "help".`);
  }

  return { cwd, lines };
}
