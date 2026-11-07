import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as Monaco from 'monaco-editor';
import EditorPane from './components/EditorPane';
import Explorer from './components/Explorer';
import SearchPanel from './components/SearchPanel';
import TerminalPanel from './components/TerminalPanel';
import CommandPalette, { type Command } from './components/CommandPalette';
import SettingsPanel from './components/SettingsPanel';
import KeyBar from './components/KeyBar';
import StatusBar from './components/StatusBar';
import Tabs from './components/Tabs';
import Welcome from './components/Welcome';
import NewFileDialog from './components/NewFileDialog';
import LanguagePicker from './components/LanguagePicker';
import { ConfirmDialog, Prompt, Sheet, type PromptOptions, type SheetItem } from './components/Overlays';
import { Icon, type IconName } from './components/Icon';
import { usePersistentState } from './lib/store';
import {
  basename,
  createDefaultWorkspace,
  dirname,
  extname,
  filePaths,
  joinPath,
  normalizePath,
  replacePrefix,
  type Entry,
  type Workspace,
} from './lib/vfs';
import { languageForPath, languageLabel } from './lib/languages';
import { DEFAULT_SETTINGS, FONT_MAX, FONT_MIN, type Session, type Settings } from './lib/types';
import type { ShellIO } from './lib/shell';
import { runCode } from './lib/codeRuntime';

type Sidebar = 'explorer' | 'search' | null;
type GoTo = { line: number; column?: number; token: number };
type ConfirmState = { title: string; message: string; confirmLabel?: string; onConfirm: () => void };
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const SIDEBAR_ITEMS: { id: 'explorer' | 'search'; label: string; icon: IconName }[] = [
  { id: 'explorer', label: 'Explorador', icon: 'sidebar' },
  { id: 'search', label: 'Buscar', icon: 'search' },
];

export default function App() {
  const [workspace, setWorkspace] = usePersistentState<Workspace>('workspace:v1', createDefaultWorkspace);
  const [settings, setSettings] = usePersistentState<Settings>('settings:v1', DEFAULT_SETTINGS);
  const [session, setSession] = usePersistentState<Session>('session:v1', {
    tabs: ['README.md'],
    active: 'README.md',
  });

  const [buffers, setBuffers] = useState<Record<string, string>>({});
  const [languageOverrides, setLanguageOverrides] = usePersistentState<Record<string, string>>('languages:v1', {});
  const [sidebar, setSidebar] = useState<Sidebar>(null);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [palette, setPalette] = useState<{ prefix: string } | null>(null);
  const [prompt, setPrompt] = useState<PromptOptions | null>(null);
  const [newFileDir, setNewFileDir] = useState<string | null>(null);
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const [terminalRequest, setTerminalRequest] = useState<{ text: string; token: number } | null>(null);
  const [sheet, setSheet] = useState<{ title: string; items: SheetItem[] } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [goTo, setGoTo] = useState<GoTo | null>(null);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [editorTick, setEditorTick] = useState(0);

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const workspaceRef = useRef(workspace);
  const buffersRef = useRef(buffers);
  const toastTimer = useRef<number | undefined>(undefined);
  const saveTimers = useRef(new Map<string, number>());

  workspaceRef.current = workspace;
  buffersRef.current = buffers;

  const active = session.active && session.active in workspace.files ? session.active : null;
  const activeLanguage = active ? languageOverrides[active] ?? languageForPath(active) : 'plaintext';
  const tabs = session.tabs.filter((tab) => tab in workspace.files);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const patchSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((previous) => ({ ...previous, ...patch }));
    },
    [setSettings],
  );

  /* ---------------------------------------------------------------- files */

  const focusFile = useCallback(
    (path: string, content: string, line?: number, force = false) => {
      setSession((previous) => ({
        tabs: previous.tabs.includes(path) ? previous.tabs : [...previous.tabs, path],
        active: path,
      }));
      setBuffers((previous) => {
        if (!force && path in previous) return previous;
        return { ...previous, [path]: content };
      });
      setSidebar(null);
      setPalette(null);
      setSettingsOpen(false);
      if (line) setGoTo({ line, token: Date.now() });
    },
    [setSession],
  );

  const openFile = useCallback(
    (path: string, line?: number) => {
      const current = workspaceRef.current;
      if (!(path in current.files)) {
        notify('Este arquivo não existe mais');
        return;
      }
      focusFile(path, current.files[path], line);
    },
    [focusFile, notify],
  );

  const commitBuffer = useCallback(
    (path: string, value?: string) => {
      setWorkspace((previous) => {
        const nextValue = value ?? buffersRef.current[path];
        if (nextValue === undefined || previous.files[path] === nextValue) return previous;
        return { ...previous, files: { ...previous.files, [path]: nextValue } };
      });
    },
    [setWorkspace],
  );

  const saveAll = useCallback(() => {
    setWorkspace((previous) => {
      let changed = false;
      const files = { ...previous.files };
      for (const [path, value] of Object.entries(buffersRef.current)) {
        if (files[path] !== undefined && files[path] !== value) {
          files[path] = value;
          changed = true;
        }
      }
      return changed ? { ...previous, files } : previous;
    });
    notify('Alterações salvas');
  }, [notify, setWorkspace]);

  const onEdit = useCallback(
    (path: string, value: string) => {
      setBuffers((previous) => (previous[path] === value ? previous : { ...previous, [path]: value }));
      if (!settings.autoSave) return;

      const timers = saveTimers.current;
      const existing = timers.get(path);
      if (existing) window.clearTimeout(existing);
      timers.set(
        path,
        window.setTimeout(() => {
          timers.delete(path);
          setWorkspace((previous) =>
            previous.files[path] === value ? previous : { ...previous, files: { ...previous.files, [path]: value } },
          );
        }, 650),
      );
    },
    [settings.autoSave, setWorkspace],
  );

  const closeTab = useCallback(
    (path: string) => {
      commitBuffer(path);
      setSession((previous) => {
        const index = previous.tabs.indexOf(path);
        if (index === -1) return previous;
        const nextTabs = previous.tabs.filter((tab) => tab !== path);
        const nextActive =
          previous.active === path ? nextTabs[Math.min(index, nextTabs.length - 1)] ?? null : previous.active;
        return { tabs: nextTabs, active: nextActive };
      });
    },
    [commitBuffer, setSession],
  );

  const closeAllTabs = useCallback(() => {
    saveAll();
    setSession({ tabs: [], active: null });
  }, [saveAll, setSession]);

  const removePath = useCallback(
    (path: string) => {
      setWorkspace((previous) => {
        const files: Record<string, string> = {};
        for (const [file, content] of Object.entries(previous.files)) {
          if (!(file === path || file.startsWith(`${path}/`))) files[file] = content;
        }
        const folders = previous.folders.filter((folder) => !(folder === path || folder.startsWith(`${path}/`)));
        return { files, folders };
      });
      setSession((previous) => {
        const nextTabs = previous.tabs.filter((tab) => !(tab === path || tab.startsWith(`${path}/`)));
        const nextActive =
          previous.active && nextTabs.includes(previous.active)
            ? previous.active
            : nextTabs[nextTabs.length - 1] ?? null;
        return { tabs: nextTabs, active: nextActive };
      });
      setBuffers((previous) => {
        const next = { ...previous };
        for (const key of Object.keys(next)) {
          if (key === path || key.startsWith(`${path}/`)) delete next[key];
        }
        return next;
      });
      setLanguageOverrides((previous) => {
        const next = { ...previous };
        for (const key of Object.keys(next)) {
          if (key === path || key.startsWith(`${path}/`)) delete next[key];
        }
        return next;
      });
    },
    [setLanguageOverrides, setSession, setWorkspace],
  );

  const askDelete = useCallback(
    (path: string) => {
      const isFolder = workspaceRef.current.folders.includes(path);
      setConfirm({
        title: `Excluir ${basename(path)}?`,
        message: isFolder
          ? 'A pasta e todo o seu conteúdo serão removidos. Essa ação não pode ser desfeita.'
          : 'O arquivo será removido. Essa ação não pode ser desfeita.',
        confirmLabel: 'Excluir',
        onConfirm: () => {
          removePath(path);
          notify('Excluído');
        },
      });
    },
    [notify, removePath],
  );

  // New files always start with a language choice, so highlighting is right before typing.
  const startNewFile = useCallback((dir: string) => {
    setNewFileDir(dir);
  }, []);

  const createFileWithLanguage = useCallback(
    (rawPath: string, language: string | null) => {
      const path = normalizePath(rawPath);
      const current = workspaceRef.current;
      if (!path) return;
      if (path in current.files || current.folders.includes(path)) {
        notify('Já existe um arquivo ou pasta com esse nome');
        return;
      }

      const parents: string[] = [];
      let parent = dirname(path);
      while (parent) {
        parents.push(parent);
        parent = dirname(parent);
      }

      const resolvedLanguage = language ?? languageForPath(path);

      setWorkspace((previous) => ({
        files: { ...previous.files, [path]: '' },
        folders: Array.from(new Set([...previous.folders, ...parents])),
      }));
      setLanguageOverrides((previous) => {
        const next = { ...previous };
        if (language) next[path] = language;
        else delete next[path];
        return next;
      });
      setNewFileDir(null);
      focusFile(path, '', undefined, true);
      notify(`${basename(path)} · ${languageLabel(resolvedLanguage)}`);
    },
    [focusFile, notify, setLanguageOverrides, setWorkspace],
  );

  const applyLanguage = useCallback(
    (languageId: string | null) => {
      if (!active) return;
      setLanguageOverrides((previous) => {
        const next = { ...previous };
        if (languageId) next[active] = languageId;
        else delete next[active];
        return next;
      });
      setLanguagePickerOpen(false);
      notify(languageId ? `Linguagem: ${languageLabel(languageId)}` : 'Detecção automática pela extensão');
    },
    [active, notify, setLanguageOverrides],
  );

  const createFolder = useCallback(
    (dir: string) => {
      setPrompt({
        title: 'Nova pasta',
        label: 'Nome ou caminho da pasta',
        initial: dir ? `${dir}/` : '',
        placeholder: 'ex.: src/components',
        confirmLabel: 'Criar',
        onSubmit: (value) => {
          const path = normalizePath(value);
          const current = workspaceRef.current;
          if (!path) return;
          if (path in current.files || current.folders.includes(path)) {
            notify('Já existe um arquivo ou pasta com esse nome');
            return;
          }
          const parents: string[] = [];
          let parent = dirname(path);
          while (parent) {
            parents.push(parent);
            parent = dirname(parent);
          }
          setWorkspace((previous) => ({
            ...previous,
            folders: Array.from(new Set([...previous.folders, path, ...parents])),
          }));
          notify('Pasta criada');
        },
      });
    },
    [notify, setWorkspace],
  );

  const renameEntry = useCallback(
    (path: string) => {
      setPrompt({
        title: 'Renomear',
        label: 'Novo nome (ou caminho completo)',
        initial: basename(path),
        confirmLabel: 'Renomear',
        onSubmit: (value) => {
          const current = workspaceRef.current;
          const clean = value.trim();
          if (!clean) return;
          const next = clean.includes('/') ? normalizePath(clean) : joinPath(dirname(path), clean.replace(/\//g, '-'));
          if (!next || next === path) return;
          if (next in current.files || current.folders.includes(next)) {
            notify('Já existe um arquivo ou pasta com esse nome');
            return;
          }
          const isFolder = current.folders.includes(path);
          setWorkspace((previous) => {
            const files: Record<string, string> = {};
            for (const [file, content] of Object.entries(previous.files)) {
              const key = isFolder ? replacePrefix(file, path, next) : file === path ? next : file;
              files[key] = content;
            }
            const folders = previous.folders.map((folder) => {
              if (isFolder) return replacePrefix(folder, path, next);
              return folder;
            });
            return { files, folders };
          });
          setSession((previous) => ({
            tabs: previous.tabs.map((tab) => replacePrefix(tab, path, next)),
            active: previous.active ? replacePrefix(previous.active, path, next) : null,
          }));
          setBuffers((previous) => {
            const nextBuffers: Record<string, string> = {};
            for (const [file, content] of Object.entries(previous)) {
              nextBuffers[replacePrefix(file, path, next)] = content;
            }
            return nextBuffers;
          });
          setLanguageOverrides((previous) => {
            const nextOverrides: Record<string, string> = {};
            for (const [file, language] of Object.entries(previous)) {
              nextOverrides[replacePrefix(file, path, next)] = language;
            }
            return nextOverrides;
          });
          setGoTo({ line: 1, token: Date.now() });
          notify('Renomeado');
        },
      });
    },
    [notify, setBuffers, setLanguageOverrides, setSession, setWorkspace],
  );

  const duplicateFile = useCallback(
    (path: string) => {
      const current = workspaceRef.current;
      const extension = extname(path);
      const base = extension ? path.slice(0, path.length - extension.length - 1) : path;
      const suffix = extension ? `.${extension}` : '';
      let candidate = `${base}-copia${suffix}`;
      let counter = 2;
      while (candidate in current.files || current.folders.includes(candidate)) {
        candidate = `${base}-copia-${counter}${suffix}`;
        counter += 1;
      }
      setWorkspace((previous) => ({
        ...previous,
        files: { ...previous.files, [candidate]: previous.files[path] ?? '' },
      }));
      focusFile(candidate, current.files[path] ?? '', undefined, true);
      notify('Arquivo duplicado');
    },
    [focusFile, notify, setWorkspace],
  );

  const copyText = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        notify('Copiado');
      } catch {
        notify('Não foi possível copiar');
      }
    },
    [notify],
  );

  const askReset = useCallback(() => {
    setConfirm({
      title: 'Restaurar workspace?',
      message: 'Os arquivos atuais serão substituídos pelo projeto de exemplo. Essa ação não pode ser desfeita.',
      confirmLabel: 'Restaurar',
      onConfirm: () => {
        setWorkspace(createDefaultWorkspace());
        setBuffers({});
        setSession({ tabs: ['README.md'], active: 'README.md' });
        notify('Workspace restaurado');
      },
    });
  }, [notify, setSession, setWorkspace]);

  /* -------------------------------------------------------------- editor */

  const handleEditorReady = useCallback((editor: Monaco.editor.IStandaloneCodeEditor | null) => {
    editorRef.current = editor;
    setEditorTick((value) => value + 1);
  }, []);

  const runEditorAction = useCallback(
    (actionId: string) => {
      const editor = editorRef.current;
      if (!editor || !active) {
        notify('Abra um arquivo primeiro');
        return;
      }
      const action = editor.getAction(actionId);
      if (!action) {
        notify('Ação indisponível para este arquivo');
        return;
      }
      void action.run();
      editor.focus();
    },
    [active, notify],
  );

  const promptGoto = useCallback(() => {
    setPrompt({
      title: 'Ir para linha',
      label: 'Número da linha',
      initial: '1',
      confirmLabel: 'Ir',
      onSubmit: (value) => {
        const line = Number.parseInt(value, 10);
        if (!Number.isFinite(line) || line < 1) {
          notify('Número de linha inválido');
          return;
        }
        if (!editorRef.current) {
          notify('Abra um arquivo primeiro');
          return;
        }
        setGoTo({ line, token: Date.now() });
      },
    });
  }, [notify]);

  const insertText = useCallback((text: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;
    editor.executeEdits('keybar', [{ range: selection, text, forceMoveMarkers: true }]);
    editor.focus();
  }, []);

  const triggerEditor = useCallback((command: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.trigger('keybar', command, null);
    editor.focus();
  }, []);

  /* ------------------------------------------------------------- install */

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const installApp = useCallback(async () => {
    if (!installEvent) {
      notify('Use o menu do navegador → "Adicionar à tela inicial"');
      return;
    }
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    if (choice.outcome === 'accepted') notify('App instalado');
  }, [installEvent, notify]);

  /* ------------------------------------------------------------ behaviour */

  // Drop tabs/buffers that point at files removed elsewhere.
  useEffect(() => {
    const validTabs = session.tabs.filter((tab) => tab in workspace.files).slice(0, 24);
    const sameLength = validTabs.length === session.tabs.length;
    const nextActive =
      session.active && validTabs.includes(session.active) ? session.active : validTabs[validTabs.length - 1] ?? null;
    if (sameLength && nextActive === session.active) return;
    setSession({ tabs: validTabs, active: nextActive });
  }, [session, setSession, workspace.files]);

  useEffect(() => {
    setCursor({ line: 1, column: 1 });
  }, [active]);

  useEffect(() => {
    const color = settings.theme === 'light' ? '#f3f3f3' : settings.theme === 'hc' ? '#000000' : '#1e1e1e';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
  }, [settings.theme]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === 's') {
        event.preventDefault();
        saveAll();
      } else if (key === 'p') {
        event.preventDefault();
        setPalette({ prefix: event.shiftKey ? '>' : '' });
      } else if (key === 'b') {
        event.preventDefault();
        setSidebar((previous) => (previous === 'explorer' ? null : 'explorer'));
      } else if (key === 'j') {
        event.preventDefault();
        setTerminalOpen((previous) => !previous);
      } else if (key === 'f') {
        event.preventDefault();
        runEditorAction('actions.find');
      } else if (key === 'g') {
        event.preventDefault();
        promptGoto();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [promptGoto, runEditorAction, saveAll]);

  /* -------------------------------------------------------------- commands */

  const commands: Command[] = [
    { id: 'new-file', label: 'Arquivo: novo arquivo', hint: 'Ctrl+N', run: () => startNewFile('') },
    { id: 'new-folder', label: 'Arquivo: nova pasta', run: () => createFolder('') },
    { id: 'save', label: 'Arquivo: salvar tudo', hint: 'Ctrl+S', run: saveAll },
    { id: 'close-tab', label: 'Arquivo: fechar aba atual', run: () => (active ? closeTab(active) : notify('Nenhuma aba aberta')) },
    { id: 'close-all', label: 'Arquivo: fechar todas as abas', run: closeAllTabs },
    {
      id: 'language',
      label: 'Alterar linguagem do arquivo…',
      run: () => (active ? setLanguagePickerOpen(true) : notify('Abra um arquivo primeiro')),
    },
    {
      id: 'run-file',
      label: 'Executar arquivo Luau atual',
      hint: 'no terminal: run',
      run: () => {
        if (!active) {
          notify('Abra um arquivo .luau primeiro');
          return;
        }
        setTerminalOpen(true);
        setTerminalRequest({ text: 'run', token: Date.now() });
      },
    },
    { id: 'find', label: 'Localizar no arquivo', hint: 'Ctrl+F', run: () => runEditorAction('actions.find') },
    {
      id: 'replace',
      label: 'Substituir no arquivo',
      hint: 'Ctrl+H',
      run: () => runEditorAction('editor.action.startFindReplaceAction'),
    },
    {
      id: 'format',
      label: 'Formatar documento',
      hint: 'Shift+Alt+F',
      run: () => runEditorAction('editor.action.formatDocument'),
    },
    {
      id: 'comment',
      label: 'Alternar comentário de linha',
      hint: 'Ctrl+/',
      run: () => runEditorAction('editor.action.commentLine'),
    },
    { id: 'duplicate-line', label: 'Duplicar linha', run: () => runEditorAction('editor.action.copyLinesDownAction') },
    { id: 'delete-line', label: 'Excluir linha', run: () => runEditorAction('editor.action.deleteLines') },
    { id: 'goto', label: 'Ir para linha…', hint: 'Ctrl+G', run: promptGoto },
    {
      id: 'wrap',
      label: `Exibir: quebra de linha (${settings.wordWrap ? 'ligada' : 'desligada'})`,
      run: () => patchSettings({ wordWrap: !settings.wordWrap }),
    },
    {
      id: 'minimap',
      label: `Exibir: minimapa (${settings.minimap ? 'ligado' : 'desligado'})`,
      run: () => patchSettings({ minimap: !settings.minimap }),
    },
    {
      id: 'line-numbers',
      label: `Exibir: números de linha (${settings.lineNumbers ? 'ligados' : 'desligados'})`,
      run: () => patchSettings({ lineNumbers: !settings.lineNumbers }),
    },
    {
      id: 'font-up',
      label: 'Exibir: aumentar fonte',
      run: () => patchSettings({ fontSize: Math.min(FONT_MAX, settings.fontSize + 1) }),
    },
    {
      id: 'font-down',
      label: 'Exibir: diminuir fonte',
      run: () => patchSettings({ fontSize: Math.max(FONT_MIN, settings.fontSize - 1) }),
    },
    { id: 'theme-dark', label: 'Tema: escuro', run: () => patchSettings({ theme: 'dark' }) },
    { id: 'theme-light', label: 'Tema: claro', run: () => patchSettings({ theme: 'light' }) },
    { id: 'theme-hc', label: 'Tema: alto contraste', run: () => patchSettings({ theme: 'hc' }) },
    { id: 'explorer', label: 'Exibir: explorador', hint: 'Ctrl+B', run: () => setSidebar('explorer') },
    { id: 'search', label: 'Buscar: em todos os arquivos', run: () => setSidebar('search') },
    {
      id: 'terminal',
      label: 'Exibir: terminal integrado',
      hint: 'Ctrl+J',
      run: () => setTerminalOpen((previous) => !previous),
    },
    { id: 'settings', label: 'Preferências: configurações', run: () => setSettingsOpen(true) },
    { id: 'reset', label: 'Preferências: restaurar workspace de exemplo', run: askReset },
  ];

  if (installEvent) {
    commands.push({ id: 'install', label: 'App: instalar na tela inicial', run: () => void installApp() });
  }

  /* ------------------------------------------------------------------- IO */

  const shellIO: ShellIO = useMemo(
    () => ({
      files: workspace.files,
      folders: workspace.folders,
      writeFile: (path, content) => {
        const parents: string[] = [];
        let parent = dirname(path);
        while (parent) {
          parents.push(parent);
          parent = dirname(parent);
        }
        setWorkspace((previous) => ({
          files: { ...previous.files, [path]: content },
          folders: Array.from(new Set([...previous.folders, ...parents])),
        }));
        setBuffers((previous) => (path in previous ? { ...previous, [path]: content } : previous));
      },
      deletePath: removePath,
      createFolder: (path) => {
        const parents: string[] = [];
        let parent = dirname(path);
        while (parent) {
          parents.push(parent);
          parent = dirname(parent);
        }
        setWorkspace((previous) => ({
          ...previous,
          folders: Array.from(new Set([...previous.folders, path, ...parents])),
        }));
      },
      openFile: (path) => {
        const current = workspaceRef.current;
        if (path in current.files) focusFile(path, current.files[path]);
        else notify('Arquivo não encontrado');
      },
      setTheme: (theme) => setSettings((previous) => ({ ...previous, theme })),
      readFile: (path) => buffersRef.current[path] ?? workspaceRef.current.files[path],
      activePath: active,
      runScript: (path, source, args) => runCode(source, basename(path), languageForPath(path), args),
    }),
    [active, focusFile, notify, removePath, setBuffers, setSettings, setWorkspace, workspace.files, workspace.folders],
  );

  /* ------------------------------------------------------------------ view */

  const dirty = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const [path, value] of Object.entries(buffers)) {
      if (path in workspace.files && workspace.files[path] !== value) map[path] = true;
    }
    return map;
  }, [buffers, workspace.files]);

  const activeBuffer = active ? buffers[active] ?? workspace.files[active] ?? '' : '';
  const activeDirty = active ? Boolean(dirty[active]) : false;
  const files = useMemo(() => filePaths(workspace), [workspace]);

  const toggleSidebar = (view: Exclude<Sidebar, null>) => {
    setSidebar((previous) => (previous === view ? null : view));
  };

  const openMoreMenu = () => {
    const items: SheetItem[] = [
      { label: 'Salvar tudo', icon: 'save', onSelect: saveAll },
      {
        label: 'Linguagem do arquivo…',
        icon: 'code',
        onSelect: () => (active ? setLanguagePickerOpen(true) : notify('Abra um arquivo primeiro')),
      },
      { label: 'Ir para linha…', icon: 'code', onSelect: promptGoto },
      { label: 'Localizar', icon: 'search', onSelect: () => runEditorAction('actions.find') },
      {
        label: 'Substituir',
        icon: 'edit',
        onSelect: () => runEditorAction('editor.action.startFindReplaceAction'),
      },
      { label: 'Formatar documento', icon: 'sparkle', onSelect: () => runEditorAction('editor.action.formatDocument') },
      { label: 'Fechar aba', icon: 'close', onSelect: () => (active ? closeTab(active) : notify('Nenhuma aba aberta')) },
      { label: 'Configurações', icon: 'settings', onSelect: () => setSettingsOpen(true) },
    ];
    if (installEvent) items.push({ label: 'Instalar app', icon: 'install', onSelect: () => void installApp() });
    setSheet({ title: 'Ações', items });
  };

  const openEntryMenu = (entry: Entry) => {
    const items: SheetItem[] = [];
    if (entry.type === 'folder') {
      items.push({ label: 'Novo arquivo aqui', icon: 'file-plus', onSelect: () => startNewFile(entry.path) });
      items.push({ label: 'Nova pasta aqui', icon: 'folder-plus', onSelect: () => createFolder(entry.path) });
    } else {
      items.push({ label: 'Abrir', icon: 'file', onSelect: () => openFile(entry.path) });
      items.push({ label: 'Duplicar', icon: 'copy', onSelect: () => duplicateFile(entry.path) });
      items.push({ label: 'Copiar caminho', icon: 'copy', onSelect: () => void copyText(entry.path) });
    }
    items.push({ label: 'Renomear', icon: 'edit', onSelect: () => renameEntry(entry.path) });
    items.push({ label: 'Excluir', icon: 'trash', danger: true, onSelect: () => askDelete(entry.path) });
    setSheet({ title: basename(entry.path), items });
  };

  return (
    <div className="app" data-theme={settings.theme}>
      <header className="titlebar">
        <button
          type="button"
          className="icon-btn"
          aria-label="Abrir explorador"
          onClick={() => toggleSidebar('explorer')}
        >
          <Icon name="menu" size={21} />
        </button>
        <div className="titlebar-title">
          <span className="brand">Code Mobile</span>
          <span className="title-file">{active ? basename(active) : 'bem-vindo'}</span>
        </div>
        <div className="titlebar-actions">
          {activeDirty ? (
            <button type="button" className="icon-btn save-pulse" aria-label="Salvar alterações" onClick={saveAll}>
              <Icon name="save" size={19} />
            </button>
          ) : null}
          <button
            type="button"
            className="icon-btn"
            aria-label="Abrir arquivo"
            onClick={() => setPalette({ prefix: '' })}
          >
            <Icon name="search" size={19} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Paleta de comandos"
            onClick={() => setPalette({ prefix: '>' })}
          >
            <Icon name="palette" size={19} />
          </button>
          <button type="button" className="icon-btn" aria-label="Mais ações" onClick={openMoreMenu}>
            <Icon name="more" size={19} />
          </button>
        </div>
      </header>

      <Tabs
        tabs={tabs}
        active={active}
        dirty={dirty}
        onSelect={openFile}
        onClose={closeTab}
        onNew={() => startNewFile('')}
      />

      <main className="editor-area">
        <div className="editor-slot">
          <EditorPane
            activePath={active}
            language={activeLanguage}
            buffer={activeBuffer}
            settings={settings}
            onChange={(value) => (active ? onEdit(active, value) : undefined)}
            onCursor={(line, column) => setCursor({ line, column })}
            onSave={saveAll}
            onReady={handleEditorReady}
            goTo={goTo}
          />
        </div>

        {!active ? (
          <Welcome
            files={files}
            onNewFile={() => startNewFile('')}
            onQuickOpen={() => setPalette({ prefix: '' })}
            onPalette={() => setPalette({ prefix: '>' })}
            onExplorer={() => setSidebar('explorer')}
            onTerminal={() => setTerminalOpen(true)}
            onSettings={() => setSettingsOpen(true)}
            onOpenFile={openFile}
            onInstall={() => void installApp()}
            canInstall={Boolean(installEvent)}
          />
        ) : null}

        {terminalOpen ? (
          <TerminalPanel
            io={shellIO}
            request={terminalRequest}
            onRequestHandled={() => setTerminalRequest(null)}
            onClose={() => setTerminalOpen(false)}
          />
        ) : null}

        {settingsOpen ? (
          <SettingsPanel
            settings={settings}
            onChange={patchSettings}
            onClose={() => setSettingsOpen(false)}
            onReset={askReset}
            onCopyWorkspace={() => void copyText(JSON.stringify(workspace, null, 2))}
          />
        ) : null}
      </main>

      <KeyBar
        editor={editorRef.current}
        tabSize={settings.tabSize}
        onSave={saveAll}
        onCommand={runEditorAction}
        key={editorTick}
      />

      <StatusBar
        language={activeLanguage}
        line={cursor.line}
        column={cursor.column}
        settings={settings}
        dirty={activeDirty}
        hasFile={Boolean(active)}
        onPickLanguage={() => (active ? setLanguagePickerOpen(true) : notify('Abra um arquivo primeiro'))}
      />

      <nav className="bottom-nav" aria-label="Navegação principal">
        {SIDEBAR_ITEMS.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`nav-item${sidebar === item.id ? ' active' : ''}`}
            onClick={() => toggleSidebar(item.id)}
          >
            <Icon name={item.icon} size={21} />
            <span>{item.label}</span>
          </button>
        ))}
        <button
          type="button"
          className={`nav-item${terminalOpen ? ' active' : ''}`}
          onClick={() => setTerminalOpen((previous) => !previous)}
        >
          <Icon name="terminal" size={21} />
          <span>Terminal</span>
        </button>
        <button
          type="button"
          className={`nav-item${settingsOpen ? ' active' : ''}`}
          onClick={() => setSettingsOpen(true)}
        >
          <Icon name="settings" size={21} />
          <span>Ajustes</span>
        </button>
      </nav>

      {sidebar ? (
        <>
          <div className="drawer-backdrop" role="presentation" onClick={() => setSidebar(null)} />
          <aside className="drawer" aria-label={sidebar === 'explorer' ? 'Explorador' : 'Pesquisar'}>
            <div className="drawer-grip" />
            {sidebar === 'explorer' ? (
              <Explorer
                workspace={workspace}
                activePath={active}
                onOpen={openFile}
                onMenu={openEntryMenu}
                onNewFile={startNewFile}
                onNewFolder={createFolder}
                onCollapseAll={() => setSidebar(null)}
              />
            ) : (
              <SearchPanel workspace={workspace} onOpen={openFile} />
            )}
          </aside>
        </>
      ) : null}

      {palette ? (
        <CommandPalette
          commands={commands}
          files={files}
          initialQuery={palette.prefix}
          onClose={() => setPalette(null)}
          onOpenFile={openFile}
        />
      ) : null}

      {sheet ? <Sheet title={sheet.title} items={sheet.items} onClose={() => setSheet(null)} /> : null}
      {prompt ? <Prompt options={prompt} onClose={() => setPrompt(null)} /> : null}
      {newFileDir !== null ? (
        <NewFileDialog
          initialDir={newFileDir}
          onClose={() => setNewFileDir(null)}
          onCreate={createFileWithLanguage}
        />
      ) : null}
      {languagePickerOpen && active ? (
        <LanguagePicker
          current={languageOverrides[active] ?? null}
          filePath={active}
          onPick={applyLanguage}
          onClose={() => setLanguagePickerOpen(false)}
        />
      ) : null}
      {confirm ? (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          onConfirm={confirm.onConfirm}
          onClose={() => setConfirm(null)}
        />
      ) : null}
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
