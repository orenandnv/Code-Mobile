/*
 * Luau (Roblox Lua) language support for Monaco: Monarch tokenizer + language configuration.
 * Covers Luau-specific syntax: type annotations, generics, `continue`, compound assignment,
 * `if ... then ... else` expressions, string interpolation and `::` type casts.
 */
import type * as Monaco from 'monaco-editor';

export const LUAU_ID = 'luau';

export const luauLanguage = {
  id: LUAU_ID,
  extensions: ['.luau'],
  aliases: ['Luau', 'luau'],
  mimetypes: ['text/x-luau'],
};

const CONTROL_KEYWORDS = [
  'if',
  'then',
  'else',
  'elseif',
  'end',
  'for',
  'while',
  'do',
  'repeat',
  'until',
  'return',
  'break',
  'continue',
  'in',
  'export',
];

const KEYWORDS = ['local', 'function', 'and', 'or', 'not', 'type', 'typeof', 'true', 'false', 'nil'];

const TYPES = [
  'string',
  'number',
  'boolean',
  'any',
  'never',
  'unknown',
  'thread',
  'buffer',
  'vector',
  'number?',
];

const BUILTIN_FUNCTIONS = [
  'print',
  'warn',
  'error',
  'assert',
  'require',
  'pcall',
  'xpcall',
  'tostring',
  'tonumber',
  'pairs',
  'ipairs',
  'next',
  'select',
  'rawget',
  'rawset',
  'rawequal',
  'getmetatable',
  'setmetatable',
  'unpack',
  'newproxy',
  'gcinfo',
  'collectgarbage',
  'loadstring',
  'getfenv',
  'setfenv',
];

const GLOBALS = [
  'self',
  'game',
  'workspace',
  'script',
  'shared',
  'plugin',
  'Instance',
  'Vector2',
  'Vector3',
  'CFrame',
  'Color3',
  'ColorSequence',
  'ColorSequenceKeypoint',
  'NumberRange',
  'NumberSequence',
  'NumberSequenceKeypoint',
  'UDim',
  'UDim2',
  'Ray',
  'Region3',
  'Rect',
  'TweenInfo',
  'Enum',
  'BrickColor',
  'Random',
  'DateTime',
  'task',
  'tick',
  'time',
  'wait',
  'spawn',
  'delay',
  'string',
  'table',
  'math',
  'os',
  'coroutine',
  'utf8',
  'bit32',
  'debug',
];

export const luauMonarch = {
  defaultToken: '',
  tokenPostfix: '.luau',
  keywords: KEYWORDS,
  control: CONTROL_KEYWORDS,
  types: TYPES,
  builtins: BUILTIN_FUNCTIONS,
  globals: GLOBALS,

  brackets: [
    { open: '{', close: '}', token: 'delimiter.curly' },
    { open: '[', close: ']', token: 'delimiter.square' },
    { open: '(', close: ')', token: 'delimiter.parenthesis' },
  ],

  tokenizer: {
    root: [
      [/--\[=*\[/, 'comment', '@blockComment'],
      [/--.*$/, 'comment'],

      [/\bfunction\s+([A-Za-z_]\w*)/, ['keyword', 'function']],
      [/\bfunction\b/, 'keyword'],

      [/"(?:[^"\\]|\\.)*"/, 'string'],
      [/'(?:[^'\\]|\\.)*'/, 'string'],
      [/"/, 'string', '@stringDouble'],
      [/'/, 'string', '@stringSingle'],
      [/`/, 'string', '@stringBacktick'],
      [/\[=*\[/, 'string', '@longString'],

      [/\b0[xX][0-9a-fA-F_]+\b/, 'number.hex'],
      [/\b0[bB][01_]+\b/, 'number.binary'],
      [/\b\d[\d_]*(\.\d[\d_]*)?([eE][-+]?\d+)?\b/, 'number'],

      [/([A-Za-z_]\w*)/, {
        cases: {
          '@control': 'keyword.control',
          '@keywords': 'keyword',
          '@types': 'type',
          '@builtins': 'function',
          '@globals': 'variable.predefined',
          '@default': 'identifier',
        },
      }],

      [/(?<=[.):])\s*([A-Za-z_]\w*)(?=\s*\()/, 'function'],
      [/::/, 'keyword.operator'],
      [/\.\.\./, 'operator'],
      [/\.\.=?/, 'operator'],
      [/[<>]=?/, 'operator'],
      [/[+\-*/%^]=?/, 'operator'],
      [/==|~=|<=|>=/, 'operator'],
      [/[=#]/, 'operator'],
      [/[{}()[\]]/, '@brackets'],
      [/[;,.?:]/, 'delimiter'],
    ],

    blockComment: [
      [/]=*\]/, 'comment', '@pop'],
      [/./, 'comment'],
    ],

    longString: [
      [/]=*\]/, 'string', '@pop'],
      [/./, 'string'],
    ],

    stringDouble: [
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, 'string', '@pop'],
    ],

    stringSingle: [
      [/[^\\']+/, 'string'],
      [/\\./, 'string.escape'],
      [/'/, 'string', '@pop'],
    ],

    stringBacktick: [
      [/[^\\`{]+/, 'string'],
      [/\\./, 'string.escape'],
      [/\{/, 'delimiter.bracket', '@interpolation'],
      [/`/, 'string', '@pop'],
    ],

    interpolation: [
      [/\}/, 'delimiter.bracket', '@pop'],
      { include: 'root' },
    ],
  },
};

export const luauConfiguration: Monaco.languages.LanguageConfiguration = {
  comments: {
    lineComment: '--',
    blockComment: ['--[[', ']]'],
  },
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
    increaseIndentPattern: /(\b(then|do|else|elseif|repeat)\b|\{|\{|\(|\[)\s*(--.*)?$/,
    decreaseIndentPattern: /^\s*((end|else|elseif|until)\b|\)|\]|\})/,
  },
  folding: {
    markers: {
      start: /^\s*--\s*#?region\b/,
      end: /^\s*--\s*#?endregion\b/,
    },
  },
};
