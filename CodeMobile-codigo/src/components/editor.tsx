import { useEffect, useMemo, useRef } from 'react';
import type * as Monaco from 'monaco-editor';
import { monaco, monacoTheme, setupMonaco } from '../editor/monaco';
import type { Settings, ThemeId } from '../core/settings';
import { FONT_MAX, FONT_MIN } from '../core/settings';
import type { RuntimeBadge } from '../runtimes/registry';
import { Icon } from './ui';
import { useI18n } from '../i18n';

setupMonaco();

type EditorPaneProps = {
  activePath: string | null;
  language: string;
  buffer: string;
  settings: Settings;
  theme: ThemeId;
  goTo: { line: number; column?: number; token: number } | null;
  onChange: (value: string) => void;
  onCursor: (line: number, column: number) => void;
  onSave: () => void;
  onReady: (editor: Monaco.editor.IStandaloneCodeEditor | null) => void;
};

export function EditorPane({
  activePath,
  language,
  buffer,
  settings,
  theme,
  goTo,
  onChange,
  onCursor,
  onSave,
  onReady,
}: EditorPaneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const models = useRef(new Map<string, Monaco.editor.ITextModel>());
  const currentPath = useRef<string | null>(null);
  const applying = useRef(false);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  useEffect(() => {
    if (!hostRef.current) return;
    const editor = monaco.editor.create(hostRef.current, {
      value: '',
      theme: monacoTheme(theme),
      automaticLayout: true,
      fontSize: settings.fontSize,
      lineNumbers: settings.lineNumbers ? 'on' : 'off',
      wordWrap: settings.wordWrap ? 'on' : 'off',
      minimap: { enabled: settings.minimap },
      tabSize: settings.tabSize,
      insertSpaces: true,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, 'Roboto Mono', monospace",
      fontLigatures: true,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      renderLineHighlight: 'line',
      scrollBeyondLastLine: false,
      // Sticky scroll é um recurso de desktop: numa tela de 540px ele come
      // 5 linhas do código e, no WebView do Android 9, o provider de folding
      // lança uma exceção não tratada a cada recálculo.
      stickyScroll: { enabled: false },
      padding: { top: 8, bottom: 120 },
      overviewRulerLanes: 0,
      scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, alwaysConsumeMouseWheel: false },
      quickSuggestions: { other: true, comments: false, strings: true },
      suggestOnTriggerCharacters: true,
      snippetSuggestions: 'inline',
      wordBasedSuggestions: 'currentDocument',
      bracketPairColorization: { enabled: true },
      guides: { indentation: true, bracketPairs: false },
      fixedOverflowWidgets: true,
      contextmenu: false,
      ariaLabel: 'Editor de código',
    });
    editorRef.current = editor;
    onReady(editor);

    const contentChange = editor.onDidChangeModelContent(() => {
      if (applying.current) return;
      const path = currentPath.current;
      if (!path) return;
      onChange(editor.getValue());
    });
    const cursorChange = editor.onDidChangeCursorPosition((event) => {
      onCursor(event.position.lineNumber, event.position.column);
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveRef.current());

    return () => {
      contentChange.dispose();
      cursorChange.dispose();
      editor.dispose();
      editorRef.current = null;
      for (const model of models.current.values()) model.dispose();
      models.current.clear();
      onReady(null);
    };
    // O editor é criado uma única vez; as demais opções são atualizadas abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    monaco.editor.setTheme(monacoTheme(theme));
  }, [theme]);

  useEffect(() => {
    editorRef.current?.updateOptions({
      fontSize: settings.fontSize,
      lineNumbers: settings.lineNumbers ? 'on' : 'off',
      wordWrap: settings.wordWrap ? 'on' : 'off',
      minimap: { enabled: settings.minimap },
      tabSize: settings.tabSize,
    });
  }, [settings.fontSize, settings.lineNumbers, settings.wordWrap, settings.minimap, settings.tabSize]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    if (!activePath) {
      currentPath.current = null;
      editor.setValue('');
      editor.updateOptions({ readOnly: true });
      return;
    }

    let model = models.current.get(activePath);
    if (!model) {
      model = monaco.editor.createModel(buffer, language, monaco.Uri.parse(`inmemory://model/${activePath}`));
      models.current.set(activePath, model);
    } else if (model.getLanguageId() !== language) {
      monaco.editor.setModelLanguage(model, language);
    }

    if (editor.getModel() !== model) {
      const state = editor.saveViewState();
      editor.setModel(model);
      if (state) editor.restoreViewState(state);
    }
    currentPath.current = activePath;
    editor.updateOptions({ readOnly: false });

    if (model.getValue() !== buffer) {
      applying.current = true;
      model.pushEditOperations([], [{ range: model.getFullModelRange(), text: buffer }], () => null);
      applying.current = false;
    }

    editor.focus();
  }, [activePath, buffer, language]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !goTo) return;
    const model = editor.getModel();
    if (!model) return;
    const line = Math.min(Math.max(1, goTo.line), model.getLineCount());
    editor.revealLineInCenterIfOutsideViewport(line);
    editor.setPosition({ lineNumber: line, column: goTo.column ?? 1 });
    editor.focus();
  }, [goTo]);

  return <div className="editor-host" ref={hostRef} data-visible={activePath ? 'true' : 'false'} />;
}

/* ------------------------------------------------------------------ keybar */

const SYMBOLS = ['{', '}', '(', ')', '[', ']', '<', '>', '=', '+', '-', '*', '/', ';', ':', '"', "'", '`', '.', ',', '|', '&', '_', '$', '#', '@'];

export function KeyBar({
  editor,
  fontSize,
  onSave,
  onFontSize,
}: {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  fontSize: number;
  onSave: () => void;
  onFontSize: (value: number) => void;
}) {
  const insert = (text: string) => {
    if (!editor) return;
    editor.trigger('keybar', 'type', { text });
    editor.focus();
  };
  const command = (id: string) => {
    if (!editor) return;
    const action = editor.getAction(id);
    if (action) void action.run();
    else editor.trigger('keybar', id, null);
    editor.focus();
  };

  return (
    <div className="keybar">
      <div className="keybar-row">
        <button type="button" className="kbtn" onClick={() => command('tab')} aria-label="Tab">
          Tab
        </button>
        <button type="button" className="kbtn" onClick={() => command('undo')} aria-label="Desfazer">
          ↶
        </button>
        <button type="button" className="kbtn" onClick={() => command('redo')} aria-label="Refazer">
          ↷
        </button>
        <button type="button" className="kbtn" onClick={() => command('editor.action.triggerSuggest')} aria-label="Sugestões">
          {'{}'}
        </button>
        <button type="button" className="kbtn" onClick={() => command('actions.find')} aria-label="Localizar">
          <Icon name="search" size={15} />
        </button>
        <button type="button" className="kbtn" onClick={() => command('editor.action.formatDocument')} aria-label="Formatar">
          <Icon name="code" size={15} />
        </button>
        <button type="button" className="kbtn" onClick={() => command('editor.action.commentLine')} aria-label="Comentar">
          //
        </button>
        <button type="button" className="kbtn" onClick={() => command('cursorUp')} aria-label="Acima">
          ↑
        </button>
        <button type="button" className="kbtn" onClick={() => command('cursorDown')} aria-label="Abaixo">
          ↓
        </button>
        <button type="button" className="kbtn" onClick={() => command('cursorLeft')} aria-label="Esquerda">
          ←
        </button>
        <button type="button" className="kbtn" onClick={() => command('cursorRight')} aria-label="Direita">
          →
        </button>
        <button type="button" className="kbtn" onClick={() => onFontSize(Math.max(FONT_MIN, fontSize - 1))} aria-label="Diminuir fonte">
          A−
        </button>
        <button type="button" className="kbtn" onClick={() => onFontSize(Math.min(FONT_MAX, fontSize + 1))} aria-label="Aumentar fonte">
          A+
        </button>
        <button type="button" className="kbtn" onClick={onSave} aria-label="Salvar">
          <Icon name="save" size={15} />
        </button>
      </div>
      <div className="keybar-row symbols">
        {SYMBOLS.map((symbol) => (
          <button type="button" key={symbol} className="kbtn" onClick={() => insert(symbol)}>
            {symbol}
          </button>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- statusbar */

export function StatusBar({
  languageLabel,
  line,
  column,
  dirty,
  runtime,
  autoSave,
  isRunning,
  onRun,
  onLanguages,
}: {
  languageLabel: string;
  line: number;
  column: number;
  dirty: boolean;
  runtime: RuntimeBadge;
  autoSave: boolean;
  isRunning: boolean;
  onRun: () => void;
  onLanguages: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="statusbar">
      <button type="button" className="status-item status-button" onClick={onLanguages}>
        <Icon name="code" size={12} />
        {languageLabel}
        {runtime.runnable ? (
          <span className={`status-runtime ${runtime.location}`}>
            {runtime.location === 'remote' ? t('run.remote') : t('run.local')}
          </span>
        ) : null}
      </button>
      <span className="status-spacer" />
      <span className={`status-item status-dirty${dirty ? ' on' : ''}`}>{dirty ? '●' : autoSave ? '✓' : '—'}</span>
      <span className="status-item">
        Ln {line}, Col {column}
      </span>
      {runtime.runnable ? (
        <button type="button" className="status-item status-button" onClick={onRun} disabled={isRunning}>
          <Icon name={isRunning ? 'stop' : 'play'} size={11} />
          {isRunning ? 'stop' : 'run'}
        </button>
      ) : null}
    </div>
  );
}

export function EditorBuffer({ value }: { value: string }) {
  const lines = useMemo(() => value.split('\n').length, [value]);
  return <span className="sr-only">{lines} linhas</span>;
}
