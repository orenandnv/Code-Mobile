import { useState, type ReactNode } from 'react';
import type * as Monaco from 'monaco-editor';
import { Icon } from './Icon';

const SYMBOLS = [
  '{', '}', '[', ']', '(', ')', '<', '>',
  '"', "'", '`', ',', '.', ':', ';',
  '=', '+', '-', '*', '/', '_', '$', '#',
  '@', '!', '&', '|', '~', '\\',
];

export default function KeyBar({
  editor,
  tabSize,
  onSave,
  onCommand,
}: {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  tabSize: number;
  onSave: () => void;
  onCommand: (actionId: string) => void;
}) {
  const [showSymbols, setShowSymbols] = useState(false);

  const focusEditor = () => editor?.focus();

  const insert = (text: string) => {
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) {
      editor.focus();
      return;
    }
    editor.executeEdits('keybar', [{ range: selection, text, forceMoveMarkers: true }]);
    editor.focus();
  };

  const trigger = (command: string) => {
    if (!editor) return;
    editor.trigger('keybar', command, null);
    editor.focus();
  };

  const dismiss = () => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
    editor?.trigger('keybar', 'hideSuggestWidget', null);
  };

  const key = (label: ReactNode, onPress: () => void, aria: string, wide = false) => (
    <button
      type="button"
      key={aria}
      className={`kbtn${wide ? ' wide' : ''}`}
      aria-label={aria}
      onMouseDown={(event) => event.preventDefault()}
      onTouchStart={(event) => event.preventDefault()}
      onClick={onPress}
    >
      {label}
    </button>
  );

  return (
    <div className="keybar">
      <div className="keybar-row">
        {key('Tab', () => insert(' '.repeat(tabSize)), 'Inserir tabulação')}
        {key('⇧Tab', () => trigger('editor.action.outdentLines'), 'Remover indentação')}
        {key(<Icon name="arrow-left" size={16} />, () => trigger('cursorLeft'), 'Cursor à esquerda')}
        {key(<Icon name="arrow-up" size={16} />, () => trigger('cursorUp'), 'Cursor acima')}
        {key(<Icon name="arrow-down" size={16} />, () => trigger('cursorDown'), 'Cursor abaixo')}
        {key(<Icon name="arrow-right" size={16} />, () => trigger('cursorRight'), 'Cursor à direita')}
        {key('Home', () => trigger('cursorHome'), 'Início da linha')}
        {key('End', () => trigger('cursorEnd'), 'Fim da linha')}
        {key(<Icon name="undo" size={16} />, () => trigger('undo'), 'Desfazer', true)}
        {key(<Icon name="redo" size={16} />, () => trigger('redo'), 'Refazer')}
        {key(<Icon name="comment" size={16} />, () => onCommand('editor.action.commentLine'), 'Comentar linha')}
        {key(<Icon name="search" size={16} />, () => onCommand('actions.find'), 'Localizar')}
        {key(<Icon name="save" size={16} />, onSave, 'Salvar')}
        {key(
          <Icon name="braces" size={16} />,
          () => setShowSymbols((value) => !value),
          'Símbolos',
        )}
        {key('⌄', dismiss, 'Fechar teclado')}
      </div>
      {showSymbols ? (
        <div className="keybar-row symbols">
          {SYMBOLS.map((symbol) => (
            <button
              type="button"
              key={symbol}
              className="kbtn"
              aria-label={`Inserir ${symbol}`}
              onMouseDown={(event) => event.preventDefault()}
              onTouchStart={(event) => event.preventDefault()}
              onClick={() => {
                insert(symbol);
                focusEditor();
              }}
            >
              {symbol}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
