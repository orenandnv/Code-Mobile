import { useEffect, useMemo, useRef } from 'react';
import monaco from '../monaco';
import type * as Monaco from 'monaco-editor';
import { monacoThemeName } from '../lib/themes';
import type { Settings } from '../lib/types';

type GoTo = { line: number; column?: number; token: number };

type Props = {
  activePath: string | null;
  language: string;
  buffer: string;
  settings: Settings;
  onChange: (value: string) => void;
  onCursor: (line: number, column: number) => void;
  onSave: () => void;
  onReady: (editor: Monaco.editor.IStandaloneCodeEditor | null) => void;
  goTo: GoTo | null;
};

export default function EditorPane({
  activePath,
  language,
  buffer,
  settings,
  onChange,
  onCursor,
  onSave,
  onReady,
  goTo,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const modelsRef = useRef(new Map<string, Monaco.editor.ITextModel>());

  const activePathRef = useRef(activePath);
  const onChangeRef = useRef(onChange);
  const onCursorRef = useRef(onCursor);
  const onSaveRef = useRef(onSave);
  const onReadyRef = useRef(onReady);
  const settingsRef = useRef(settings);

  activePathRef.current = activePath;
  onChangeRef.current = onChange;
  onCursorRef.current = onCursor;
  onSaveRef.current = onSave;
  onReadyRef.current = onReady;
  settingsRef.current = settings;

  useEffect(() => {
    if (!hostRef.current) return;

    const editor = monaco.editor.create(hostRef.current, {
      value: '',
      theme: monacoThemeName(settingsRef.current.theme),
      automaticLayout: true,
      fontFamily: '"SF Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
      fontSize: settingsRef.current.fontSize,
      lineNumbers: settingsRef.current.lineNumbers ? 'on' : 'off',
      lineNumbersMinChars: 3,
      lineDecorationsWidth: 6,
      wordWrap: settingsRef.current.wordWrap ? 'on' : 'off',
      minimap: { enabled: settingsRef.current.minimap },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      renderLineHighlight: 'all',
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      overviewRulerBorder: false,
      stickyScroll: { enabled: false },
      contextmenu: true,
      folding: true,
      bracketPairColorization: { enabled: true },
      guides: { indentation: true, bracketPairs: true },
      padding: { top: 10, bottom: 140 },
      scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6, useShadows: false },
      quickSuggestions: { other: true, comments: false, strings: false },
      suggestOnTriggerCharacters: true,
      snippetSuggestions: 'inline',
      tabCompletion: 'on',
      autoClosingBrackets: 'languageDefined',
      autoClosingQuotes: 'languageDefined',
      formatOnPaste: true,
      formatOnType: true,
      links: true,
      colorDecorators: true,
      unicodeHighlight: { ambiguousCharacters: false },
      mouseWheelZoom: true,
    });

    editorRef.current = editor;
    onReadyRef.current(editor);

    const changeSubscription = editor.onDidChangeModelContent(() => {
      if (!activePathRef.current) return;
      const model = editor.getModel();
      if (model) onChangeRef.current(model.getValue());
    });

    const cursorSubscription = editor.onDidChangeCursorPosition((event) => {
      if (!activePathRef.current) return;
      onCursorRef.current(event.position.lineNumber, event.position.column);
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => onSaveRef.current());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => {
      /* handled globally */
    });

    return () => {
      changeSubscription.dispose();
      cursorSubscription.dispose();
      onReadyRef.current(null);
      const models = modelsRef.current;
      editor.dispose();
      models.forEach((model) => model.dispose());
      models.clear();
      editorRef.current = null;
    };
    // The editor instance is created once; props are kept in sync by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Attach the right model for the active file, using the selected language.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    if (!activePath) {
      editor.setModel(null);
      return;
    }

    let model = modelsRef.current.get(activePath);
    if (!model) {
      model = monaco.editor.createModel(
        buffer,
        language,
        monaco.Uri.parse(`inmemory://model/${encodeURI(activePath)}`),
      );
      modelsRef.current.set(activePath, model);
    } else if (model.getValue() !== buffer) {
      model.setValue(buffer);
    }

    if (model.getLanguageId() !== language) {
      monaco.editor.setModelLanguage(model, language);
    }

    editor.setModel(model);
    editor.updateOptions({ tabSize: settingsRef.current.tabSize });
    model.updateOptions({ tabSize: settingsRef.current.tabSize, insertSpaces: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath, language]);

  // Keep the model text in sync when the buffer changes from outside the editor
  // (terminal writes, rename, import).
  useEffect(() => {
    if (!activePath) return;
    const model = modelsRef.current.get(activePath);
    if (model && model.getValue() !== buffer) {
      const position = editorRef.current?.getPosition();
      model.setValue(buffer);
      if (position) editorRef.current?.setPosition(position);
    }
  }, [activePath, buffer]);

  // Settings and theme are applied live.
  useEffect(() => {
    const editor = editorRef.current;
    monaco.editor.setTheme(monacoThemeName(settings.theme));
    if (!editor) return;
    editor.updateOptions({
      fontSize: settings.fontSize,
      wordWrap: settings.wordWrap ? 'on' : 'off',
      lineNumbers: settings.lineNumbers ? 'on' : 'off',
      minimap: { enabled: settings.minimap },
      renderWhitespace: settings.renderWhitespace ? 'all' : 'none',
    });
    const model = editor.getModel();
    if (model) model.updateOptions({ tabSize: settings.tabSize, insertSpaces: true });
  }, [settings]);

  // Reveal a position requested by search / "go to line".
  useEffect(() => {
    if (!goTo) return;
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;
    const line = Math.min(Math.max(1, goTo.line), model.getLineCount());
    editor.setPosition({ lineNumber: line, column: goTo.column ?? 1 });
    editor.revealLineInCenter(line);
    editor.focus();
  }, [goTo]);

  const visible = useMemo(() => activePath !== null, [activePath]);

  return <div className="editor-host" ref={hostRef} data-visible={visible ? 'true' : 'false'} />;
}
