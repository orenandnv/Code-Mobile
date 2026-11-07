import type * as Monaco from 'monaco-editor';

const definitions: Array<{ id: string; extensions: string[]; aliases: string[]; keywords: string[]; operators: string[] }> = [
  {
    id: 'gdscript', extensions: ['.gd'], aliases: ['GDScript', 'gdscript'],
    keywords: ['and','as','assert','await','break','class','class_name','const','continue','elif','else','enum','extends','for','func','if','in','is','match','not','or','pass','preload','return','self','signal','static','super','var','while','yield'],
    operators: ['=', '+=', '-=', '*=', '/=', '==', '!=', '<=', '>=', '->'],
  },
  {
    id: 'zig', extensions: ['.zig'], aliases: ['Zig', 'zig'],
    keywords: ['addrspace','align','allowzero','and','anyframe','anytype','asm','async','await','break','callconv','catch','comptime','const','continue','defer','else','enum','errdefer','error','export','extern','false','fn','for','if','inline','linksection','noalias','nosuspend','opaque','or','orelse','packed','pub','resume','return',' struct','suspend','switch','test','threadlocal','true','try','undefined','union','unreachable','usingnamespace','var','volatile','while'],
    operators: ['=', '+=', '-=', '*=', '/=', '==', '!=', '<=', '>=', '=>'],
  },
  {
    id: 'elixir', extensions: ['.ex', '.exs'], aliases: ['Elixir', 'elixir'],
    keywords: ['after','alias','and','case','catch','cond','def','defdelegate','defguard','defimpl','defmacro','defmodule','defp','defprotocol','do','else','end','fn','for','if','import','in','not','or','quote','raise','receive','require','rescue','throw','try','unless','use','when'],
    operators: ['=', '==', '!=', '<=', '>=', '->', '=>', '<-', '++', '--', '|>'],
  },
];

export function registerExtraLanguages(monaco: typeof Monaco): void {
  for (const definition of definitions) {
    if (!monaco.languages.getLanguages().some((language) => language.id === definition.id)) {
      monaco.languages.register({ id: definition.id, extensions: definition.extensions, aliases: definition.aliases });
    }
    monaco.languages.setMonarchTokensProvider(definition.id, {
      defaultToken: '',
      tokenPostfix: `.${definition.id}`,
      keywords: definition.keywords,
      operators: definition.operators,
      symbols: /[=><!~?:&|+\-*\/%^]+/,
      tokenizer: {
        root: [
          [/#.*$/, 'comment'],
          [/\/\/.*$/, 'comment'],
          [/\b[A-Z][A-Z0-9_]*\b/, 'type.identifier'],
          [/[a-zA-Z_][\w]*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }],
          [/\d+(\.\d+)?([eE][+-]?\d+)?/, 'number'],
          [/[{}()[\]]/, '@brackets'],
          [/[;,.]/, 'delimiter'],
          [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } }],
          [/"([^"\\]|\\.)*$/, 'string.invalid'],
          [/"/, 'string', '@string'],
          [/'([^'\\]|\\.)*$/, 'string.invalid'],
          [/'/, 'string', '@singleString'],
        ],
        string: [[/[^\\"]+/, 'string'], [/\\./, 'string.escape'], [/"/, 'string', '@pop']],
        singleString: [[/[^\\']+/, 'string'], [/\\./, 'string.escape'], [/'/, 'string', '@pop']],
      },
    });
    monaco.languages.setLanguageConfiguration(definition.id, {
      comments: { lineComment: definition.id === 'gdscript' ? '#' : definition.id === 'elixir' ? '#' : '//' },
      brackets: [['{', '}'], ['[', ']'], ['(', ')']],
      autoClosingPairs: [{ open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' }, { open: '"', close: '"' }, { open: "'", close: "'" }],
      surroundingPairs: [{ open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' }, { open: '"', close: '"' }, { open: "'", close: "'" }],
    });
  }
}
