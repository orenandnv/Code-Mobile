/** Configuração única do Monaco (o motor do VS Code) com workers, temas e Luau. */

import * as monaco from 'monaco-editor';
import 'monaco-editor/min/vs/editor/editor.main.css';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

declare global {
  interface Window {
    MonacoEnvironment?: monaco.Environment;
  }
}

let configured = false;

export function setupMonaco(): typeof monaco {
  if (configured) return monaco;
  configured = true;

  self.MonacoEnvironment = {
    getWorker(_workerId: string, label: string) {
      switch (label) {
        case 'json':
          return new JsonWorker();
        case 'css':
        case 'scss':
        case 'less':
          return new CssWorker();
        case 'html':
        case 'handlebars':
        case 'razor':
          return new HtmlWorker();
        case 'typescript':
        case 'javascript':
          return new TsWorker();
        default:
          return new EditorWorker();
      }
    },
  };

  /* ------------------------------------------------------------- tema */
  monaco.editor.defineTheme('codemobile-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6A9955' },
      { token: 'keyword', foreground: '569CD6' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'type', foreground: '4EC9B0' },
      { token: 'function', foreground: 'DCDCAA' },
      { token: 'variable', foreground: '9CDCFE' },
      { token: 'delimiter', foreground: 'D4D4D4' },
      { token: 'operator', foreground: 'D4D4D4' },
    ],
    colors: {
      'editor.background': '#1e1e1e',
      'editor.foreground': '#cccccc',
      'editorLineNumber.foreground': '#858585',
      'editorLineNumber.activeForeground': '#c6c6c6',
      'editor.selectionBackground': '#264f78',
      'editor.lineHighlightBackground': '#2a2d2e',
      'editorCursor.foreground': '#aeafad',
      'editorIndentGuide.background1': '#404040',
      'editorWidget.background': '#252526',
      'editorSuggestWidget.background': '#252526',
      'editorGutter.background': '#1e1e1e',
    },
  });

  monaco.editor.defineTheme('codemobile-light', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#333333',
      'editorLineNumber.foreground': '#999999',
    },
  });

  monaco.editor.defineTheme('codemobile-hc', {
    base: 'hc-black',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#000000',
    },
  });

  registerLuau();
  configureTypeScript();
  registerCompletions();

  return monaco;
}

/* ------------------------------------------------------------------ Luau */

function registerLuau(): void {
  if (monaco.languages.getLanguages().some((language) => language.id === 'luau')) return;

  monaco.languages.register({ id: 'luau', extensions: ['.luau'], aliases: ['Luau', 'luau'] });
  monaco.languages.setLanguageConfiguration('luau', {
    comments: { lineComment: '--', blockComment: ['--[[', ']]'] },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '`', close: '`' },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    indentationRules: {
      increaseIndentPattern:
        /^\s*(local\s+)?(function|if|for|while|repeat|do|else|elseif|then|return\s+function)\b.*$/,
      decreaseIndentPattern: /^\s*(end|else|elseif|until|\}|\)|\])\b/,
    },
  });

  monaco.languages.setMonarchTokensProvider('luau', {
    defaultToken: '',
    tokenPostfix: '.luau',
    keywords: [
      'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function', 'if', 'in',
      'local', 'nil', 'not', 'or', 'repeat', 'return', 'then', 'true', 'until', 'while', 'continue',
      'export', 'type', 'declare', 'typeof',
    ],
    typeKeywords: ['string', 'number', 'boolean', 'any', 'never', 'unknown', 'nil', 'thread', 'buffer', 'vector'],
    operators: ['=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '~=', '!=', '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%', '..', '...', '+=', '-=', '*=', '/=', '%=', '^=', '..=', '->'],
    symbols: /[=><!~?:&|+\-*/^%]+/,
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{2}|u\{[0-9A-Fa-f]+\}|\d+)/,
    tokenizer: {
      root: [
        [/(--\[\[)/, 'comment', '@blockComment'],
        [/--.*$/, 'comment'],
        [/\b[a-zA-Z_]\w*(?=\s*\()/, { cases: { '@keywords': 'keyword', '@default': 'function' } }],
        [/[a-zA-Z_]\w*/, { cases: { '@keywords': 'keyword', '@typeKeywords': 'type', '@default': 'variable' } }],
        { include: '@whitespace' },
        [/[{}()[\]]/, '@brackets'],
        [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } }],
        [/\d*\.\d+([eE][-+]?\d+)?/, 'number.float'],
        [/0[xX][0-9a-fA-F_]+/, 'number.hex'],
        [/\d+/, 'number'],
        [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
        [/'/, { token: 'string.quote', bracket: '@open', next: '@stringSingle' }],
        [/`/, { token: 'string.quote', bracket: '@open', next: '@stringInterp' }],
      ],
      blockComment: [
        [/[^\]-]+/, 'comment'],
        [/\]\]/, 'comment', '@pop'],
        [/[-[\]]/, 'comment'],
      ],
      string: [
        [/[^\\"]+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
      ],
      stringSingle: [
        [/[^\\']+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/'/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
      ],
      stringInterp: [
        [/\{[^}]*\}/, 'variable.interpolation'],
        [/[^\\`{]+/, 'string'],
        [/`/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
      ],
      whitespace: [[/[ \t\r\n]+/, '']],
    },
  });

  monaco.languages.registerCompletionItemProvider('luau', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
      const snippet = (label: string, body: string, detail: string): monaco.languages.CompletionItem => ({
        label,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: body,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: detail,
        detail,
        range,
      });
      return {
        suggestions: [
          snippet('função', 'local function ${1:nome}(${2:args})\n\t${3:-- corpo}\nend', 'Declaração de função local'),
          snippet('para cada', 'for ${1:i}, ${2:valor} in ipairs(${3:lista}) do\n\t${4:print(valor)}\nend', 'Loop com ipairs'),
          snippet('para numérico', 'for ${1:i} = 1, ${2:10} do\n\t${3:print(i)}\nend', 'Loop numérico'),
          snippet('se', 'if ${1:condição} then\n\t${2:-- bloco}\nend', 'Condicional'),
          snippet('enquanto', 'while ${1:condição} do\n\t${2:-- bloco}\nend', 'Loop while'),
          snippet('tabela', 'local ${1:tabela} = {\n\t${2:chave} = ${3:valor},\n}', 'Tabela'),
          snippet('imprimir', 'print(${1:valor})', 'print'),
        ],
      };
    },
  });
}

/* ---------------------------------------------------------- TypeScript */

function configureTypeScript(): void {
  const options: monaco.languages.typescript.CompilerOptions = {
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    jsx: monaco.languages.typescript.JsxEmit.React,
    allowNonTsExtensions: true,
    allowJs: true,
    checkJs: false,
    strict: false,
    noEmit: true,
    esModuleInterop: true,
    skipLibCheck: true,
  };
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions(options);
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions(options);
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    diagnosticCodesToIgnore: [2307, 2792, 1375, 1378, 6133, 6192],
  });
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: false,
  });
}

/* -------------------------------------------------------------- snippets */

function registerCompletions(): void {
  const snippets: Record<string, { label: string; insert: string; detail: string }[]> = {
    python: [
      { label: 'def', insert: 'def ${1:nome}(${2:args}):\n\t${3:pass}', detail: 'Função' },
      { label: 'ifmain', insert: "if __name__ == '__main__':\n\t${1:main()}", detail: 'Ponto de entrada' },
      { label: 'for', insert: 'for ${1:item} in ${2:itens}:\n\t${3:print(item)}', detail: 'Loop for' },
    ],
    rust: [
      { label: 'fn', insert: 'fn ${1:main}() {\n\t${2:println!("Olá");}\n}', detail: 'Função' },
      { label: 'match', insert: 'match ${1:valor} {\n\t${2:_} => {},\n}', detail: 'Match' },
    ],
    go: [
      { label: 'func', insert: 'func ${1:nome}(${2:}) ${3:string} {\n\t${4:return ""}\n}', detail: 'Função' },
      { label: 'iferr', insert: 'if err != nil {\n\t${1:return err}\n}', detail: 'Tratamento de erro' },
    ],
    java: [
      { label: 'main', insert: 'public static void main(String[] args) {\n\t${1}\n}', detail: 'Método main' },
      { label: 'sout', insert: 'System.out.println(${1});', detail: 'Imprimir' },
    ],
    kotlin: [{ label: 'fun', insert: 'fun ${1:main}() {\n\t${2:println("Olá")}\n}', detail: 'Função' }],
    csharp: [{ label: 'main', insert: 'static void Main() {\n\t${1:Console.WriteLine("Olá");}\n}', detail: 'Método main' }],
    cpp: [{ label: 'main', insert: 'int main() {\n\t${1:return 0;}\n}', detail: 'Função main' }],
    php: [{ label: 'php', insert: '<?php\n${1}\n', detail: 'Abrir PHP' }],
    ruby: [{ label: 'def', insert: 'def ${1:nome}(${2})\n\t${3}\nend', detail: 'Método' }],
    sql: [
      { label: 'select', insert: 'SELECT ${1:*}\nFROM ${2:tabela}\nWHERE ${3:condição};', detail: 'Consulta' },
      { label: 'create', insert: 'CREATE TABLE ${1:nome} (\n\t${2:id} INTEGER PRIMARY KEY,\n\t${3:campo} TEXT\n);', detail: 'Tabela' },
    ],
  };

  for (const [language, items] of Object.entries(snippets)) {
    monaco.languages.registerCompletionItemProvider(language, {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
        return {
          suggestions: items.map((item) => ({
            label: item.label,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: item.insert,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: item.detail,
            detail: item.detail,
            range,
          })),
        };
      },
    });
  }
}

export type ThemeName = 'codemobile-dark' | 'codemobile-light' | 'codemobile-hc';

export function monacoTheme(theme: 'dark' | 'light' | 'hc'): ThemeName {
  if (theme === 'light') return 'codemobile-light';
  if (theme === 'hc') return 'codemobile-hc';
  return 'codemobile-dark';
}

export { monaco };
