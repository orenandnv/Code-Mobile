import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as Monaco from 'monaco-editor';
import { kvGet, kvSet, prefGet, prefSet } from './core/kv';
import { DEFAULT_SETTINGS, FONT_MAX, FONT_MIN, type Settings } from './core/settings';
import { createProject, uniqueProjectName, type Project } from './workspace/project';
import { defaultProjects } from './workspace/defaults';
import {
  ancestorsOf,
  basename,
  dirname,
  entriesIn,
  filePaths,
  isFolder,
  normalizePath,
  replacePrefix,
  type Entry,
  type Vfs,
} from './workspace/vfs';
import { languageForPath } from './editor/languages';
import { runFile, describeRuntime } from './runtimes/registry';
import {
  clearRecovery,
  isStructuralCompletion,
  loadProjectSession,
  readRecovery,
  saveProjectSession,
  writeRecovery,
  type RecoverySnapshot,
} from './features/autosave';
import { composeProjectZip, downloadBlob, readZip } from './features/archive';
import { EditorPane, KeyBar, StatusBar } from './components/editor';
import { Explorer, SearchPanel } from './components/explorer';
import { TerminalPanel } from './components/terminal';
import { PreviewPanel } from './components/preview';
import { SettingsPanel } from './components/settings';
import { GitPanel } from './components/git';
import { CommandPalette, LanguagePicker, NewFileDialog, type Command } from './components/dialogs';
import { Welcome } from './components/welcome';
import {
  ConfirmDialog,
  Icon,
  Prompt,
  Sheet,
  Splash,
  Tabs,
  Toast,
  type PromptOptions,
  type SheetItem,
} from './components/ui';
import { useI18n } from './i18n';

type Sidebar = 'explorer' | 'search' | null;
type Panel = 'terminal' | 'preview' | 'settings' | 'git' | null;
type RunMessage = { id: number; stream: 'stdout' | 'stderr' | 'meta'; text: string };
type ConfirmState = { title: string; message: string; confirmLabel?: string; onConfirm: () => void };

const APP_VERSION = '2.0.0';
const PROJECTS_KEY = 'projects:v2';
const ACTIVE_KEY = 'active-project';
const SETTINGS_KEY = 'settings';
const TOKEN_KEY = 'git-token';

export default function App() {
  const { t } = useI18n();

  const [ready, setReady] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState('');
  const [session, setSession] = useState<{ tabs: string[]; active: string | null }>({ tabs: [], active: null });
  const [buffers, setBuffers] = useState<Record<string, string>>({});
  const [languageOverrides, setLanguageOverrides] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [gitToken, setGitToken] = useState('');
  const [recovery, setRecovery] = useState<RecoverySnapshot | null>(null);

  const [sidebar, setSidebar] = useState<Sidebar>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [palette, setPalette] = useState<{ prefix: string } | null>(null);
  const [prompt, setPrompt] = useState<PromptOptions | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [sheet, setSheet] = useState<{ title: string; items: SheetItem[] } | null>(null);
  const [newFileDir, setNewFileDir] = useState<string | null>(null);
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [goTo, setGoTo] = useState<{ line: number; column?: number; token: number } | null>(null);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [runningPath, setRunningPath] = useState<string | null>(null);
  const [runLog, setRunLog] = useState<RunMessage[]>([]);
  const [terminalRequest, setTerminalRequest] = useState<{ command: string; token: number } | null>(null);

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const saveTimers = useRef(new Map<string, number>());
  const buffersRef = useRef(buffers);
  const projectsRef = useRef(projects);
  const activeIdRef = useRef(activeId);
  const settingsRef = useRef(settings);
  const sessionRef = useRef(session);
  const abortRef = useRef<AbortController | null>(null);
  const runCounter = useRef(0);
  const importRef = useRef<HTMLInputElement | null>(null);
  const saveAllRef = useRef<() => void>(() => {});

  buffersRef.current = buffers;
  projectsRef.current = projects;
  activeIdRef.current = activeId;
  settingsRef.current = settings;
  sessionRef.current = session;

  const project = useMemo(
    () => projects.find((item) => item.id === activeId) ?? projects[0] ?? null,
    [projects, activeId],
  );
  const vfs: Vfs = useMemo(
    () => ({ files: project?.files ?? {}, folders: project?.folders ?? [] }),
    [project],
  );
  const vfsRef = useRef(vfs);
  vfsRef.current = vfs;

  const active = session.active && session.active in vfs.files ? session.active : null;
  const activeLanguage = active ? languageOverrides[active] ?? languageForPath(active).id : 'plaintext';
  const activeRuntime = describeRuntime(activeLanguage);
  const tabs = session.tabs.filter((path) => path in vfs.files);

  const pushRun = useCallback((stream: RunMessage['stream'], text: string) => {
    runCounter.current += 1;
    const entry: RunMessage = { id: runCounter.current, stream, text };
    // Update funcional: nunca perde eventos, mesmo com vários no mesmo tick.
    setRunLog((previous) => [...previous.slice(-400), entry]);
  }, []);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  /* ------------------------------------------------------------ bootstrap */

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const storedSettings = prefGet<Partial<Settings>>(SETTINGS_KEY, {});
      const merged = { ...DEFAULT_SETTINGS, ...storedSettings };
      setSettings(merged);
      setGitToken(prefGet<string>(TOKEN_KEY, ''));

      let list = await kvGet<Project[]>(PROJECTS_KEY);
      if (!list || !Array.isArray(list) || list.length === 0) {
        list = defaultProjects().map((item) => createProject(item.name, item.vfs));
        await kvSet(PROJECTS_KEY, list);
      }

      const remembered = prefGet<string>(ACTIVE_KEY, '');
      const current = list.find((item) => item.id === remembered) ?? list[0];
      const stored = await loadProjectSession(current.id);
      const firstFile = Object.keys(current.files)[0] ?? null;
      const nextSession = stored ?? {
        tabs: firstFile ? [firstFile] : [],
        active: firstFile,
      };

      if (cancelled) return;
      setProjects(list);
      setActiveId(current.id);
      setSession({
        tabs: nextSession.tabs.filter((path) => path in current.files),
        active: nextSession.active && nextSession.active in current.files ? nextSession.active : firstFile,
      });
      setBuffers({});
      const snapshot = await readRecovery(current.id);
      if (snapshot && !cancelled) setRecovery(snapshot);
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Mantém a altura do app sincronizada com a área visível (teclado virtual no Android).
  // Sem isso, a barra de teclas extras (KeyBar) fica coberta pelo teclado.
  useEffect(() => {
    const update = () => {
      const vv = window.visualViewport;
      const h = vv ? vv.height : window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${Math.round(h)}px`);
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
    }
    // Polling leve: alguns WebViews Android não disparam visualViewport.resize.
    const timer = window.setInterval(update, 400);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      if (vv) {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      }
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    prefSet(SETTINGS_KEY, settings);
    const color = settings.theme === 'light' ? '#ffffff' : settings.theme === 'hc' ? '#000000' : '#1e1e1e';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
  }, [settings, ready]);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => void kvSet(PROJECTS_KEY, projects), 400);
    return () => window.clearTimeout(timer);
  }, [projects, ready]);

  useEffect(() => {
    if (!ready || !activeId) return;
    prefSet(ACTIVE_KEY, activeId);
    void saveProjectSession(activeId, session);
  }, [session, activeId, ready]);

  // Snapshot de recuperação: protege contra fechamento inesperado.
  useEffect(() => {
    if (!ready || !activeId) return;
    const timer = window.setTimeout(() => {
      void writeRecovery({
        projectId: activeId,
        savedAt: Date.now(),
        tabs: session.tabs,
        active: session.active,
        buffers: buffersRef.current,
      });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [buffers, session, activeId, ready]);

  /* --------------------------------------------------------------- projeto */

  const updateProject = useCallback((id: string, updater: (project: Project) => Project) => {
    setProjects((previous) => previous.map((item) => (item.id === id ? updater(item) : item)));
  }, []);

  const setVfs = useCallback(
    (updater: (vfs: Vfs) => Vfs) => {
      const id = activeIdRef.current;
      updateProject(id, (current) => {
        const next = updater({ files: current.files, folders: current.folders });
        return { ...current, files: next.files, folders: Array.from(new Set(next.folders)), updatedAt: Date.now() };
      });
    },
    [updateProject],
  );

  const writeFile = useCallback(
    (path: string, content: string) => {
      setVfs((current) => ({
        files: { ...current.files, [path]: content },
        folders: Array.from(new Set([...current.folders, ...ancestorsOf(path)])),
      }));
      setBuffers((previous) => (path in previous ? { ...previous, [path]: content } : previous));
    },
    [setVfs],
  );

  const removePath = useCallback(
    (path: string) => {
      setVfs((current) => {
        const files: Record<string, string> = {};
        for (const [file, content] of Object.entries(current.files)) {
          if (!(file === path || file.startsWith(`${path}/`))) files[file] = content;
        }
        const folders = current.folders.filter((folder) => !(folder === path || folder.startsWith(`${path}/`)));
        return { files, folders };
      });
      setSession((previous) => {
        const nextTabs = previous.tabs.filter((tab) => !(tab === path || tab.startsWith(`${path}/`)));
        return {
          tabs: nextTabs,
          active: previous.active && nextTabs.includes(previous.active) ? previous.active : nextTabs[nextTabs.length - 1] ?? null,
        };
      });
      setBuffers((previous) => {
        const next = { ...previous };
        for (const key of Object.keys(next)) if (key === path || key.startsWith(`${path}/`)) delete next[key];
        return next;
      });
    },
    [setVfs],
  );

  const createFolderPath = useCallback(
    (path: string) => {
      setVfs((current) => ({
        files: current.files,
        folders: Array.from(new Set([...current.folders, path, ...ancestorsOf(path)])),
      }));
    },
    [setVfs],
  );

  const focusFile = useCallback((path: string, line?: number, force = false) => {
    setSession((previous) => ({
      tabs: previous.tabs.includes(path) ? previous.tabs : [...previous.tabs, path].slice(-24),
      active: path,
    }));
    if (force) {
      setBuffers((previous) => ({ ...previous, [path]: vfsRef.current.files[path] ?? '' }));
    }
    setSidebar(null);
    setPalette(null);
    if (line) setGoTo({ line, token: Date.now() });
  }, []);

  const openFile = useCallback(
    (path: string, line?: number) => {
      const current = vfsRef.current;
      if (!(path in current.files)) {
        notify(t('explorer.empty'));
        return;
      }
      if (panel === 'settings' || panel === 'git') setPanel(null);
      focusFile(path, line);
    },
    [focusFile, notify, panel, t],
  );

  const commitBuffer = useCallback(
    (path: string, value?: string) => {
      const content = value ?? buffersRef.current[path];
      if (content === undefined) return;
      setVfs((current) =>
        current.files[path] === content ? current : { files: { ...current.files, [path]: content }, folders: current.folders },
      );
    },
    [setVfs],
  );

  const saveAll = useCallback(() => {
    const entries = Object.entries(buffersRef.current);
    if (!entries.length) {
      notify(t('toast.saved'));
      return;
    }
    setVfs((current) => {
      const files = { ...current.files };
      for (const [path, value] of entries) if (path in files) files[path] = value;
      return { files, folders: current.folders };
    });
    notify(t('toast.saved'));
  }, [notify, setVfs, t]);
  saveAllRef.current = saveAll;

  /* ----------------------------------------------------------- salvamento */

  const scheduleSave = useCallback(
    (path: string, value: string, delay: number) => {
      const timers = saveTimers.current;
      const existing = timers.get(path);
      if (existing) window.clearTimeout(existing);
      timers.set(
        path,
        window.setTimeout(() => {
          timers.delete(path);
          commitBuffer(path, value);
        }, delay),
      );
    },
    [commitBuffer],
  );

  const onEdit = useCallback(
    (path: string, value: string) => {
      const previous = buffersRef.current[path] ?? '';
      setBuffers((current) => (current[path] === value ? current : { ...current, [path]: value }));
      if (!settingsRef.current.autoSave) return;
      const language = languageOverrides[path] ?? languageForPath(path).id;
      const structural = isStructuralCompletion(previous, value, language);
      scheduleSave(path, value, structural ? 350 : 2200);
    },
    [languageOverrides, scheduleSave],
  );

  useEffect(() => {
    if (!settings.autoSave) return;
    const timer = window.setInterval(() => saveAllRef.current(), Math.max(30_000, settings.autoSaveIntervalMs));
    return () => window.clearInterval(timer);
  }, [settings.autoSave, settings.autoSaveIntervalMs]);

  useEffect(() => {
    if (!runningPath) return;
    setPanel('terminal');
  }, [runningPath]);

  /* ------------------------------------------------------------ execução */

  const execute = useCallback(
    async (path: string, args: string[] = [], stdin = '') => {
      const currentVfs = vfsRef.current;
      if (!(path in currentVfs.files)) {
        notify(t('explorer.empty'));
        return;
      }
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setRunningPath(path);
      setPanel('terminal');
      const language = languageOverrides[path] ?? languageForPath(path).id;
      const source = buffersRef.current[path] ?? currentVfs.files[path];
      pushRun('meta', `▶ ${basename(path)} · ${t('run.running', { language: describeRuntime(language).label || language })}`);

      const result = await runFile(
        {
          language,
          filename: path,
          source,
          args,
          stdin,
          files: currentVfs.files,
          signal: controller.signal,
          onEvent: (event) => pushRun(event.stream, event.text),
        },
        { pistonEndpoint: settingsRef.current.pistonEndpoint },
      );

      pushRun(
        result.ok ? 'meta' : 'stderr',
        result.ok
          ? `✓ ${t('run.done', { ms: result.durationMs })} · ${result.engine}`
          : `✖ ${t('run.failed')} · ${result.engine}`,
      );
      setRunningPath(null);
      abortRef.current = null;
    },
    [languageOverrides, notify, pushRun, t],
  );

  const stopRun = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunningPath(null);
  }, []);

  /* ------------------------------------------------------------- arquivos */

  const createWithLanguage = useCallback(
    (rawPath: string, language: string | null) => {
      const path = normalizePath(rawPath);
      if (!path) return;
      const current = vfsRef.current;
      if (path in current.files || current.folders.includes(path)) {
        notify(t('toast.created'));
        return;
      }
      setVfs((previous) => ({
        files: { ...previous.files, [path]: '' },
        folders: Array.from(new Set([...previous.folders, ...ancestorsOf(path)])),
      }));
      if (language) setLanguageOverrides((previous) => ({ ...previous, [path]: language }));
      setNewFileDir(null);
      focusFile(path, undefined, true);
      notify(`${basename(path)} · ${language ?? languageForPath(path).label}`);
    },
    [focusFile, notify, setVfs, t],
  );

  const createFolder = useCallback(
    (dir: string) => {
      setPrompt({
        title: t('explorer.newFolder'),
        label: t('editor.nameLabel'),
        initial: dir ? `${dir}/` : '',
        placeholder: 'src/components',
        confirmLabel: t('common.create'),
        onSubmit: (value) => {
          const path = normalizePath(value);
          if (!path) return;
          if (path in vfsRef.current.files || vfsRef.current.folders.includes(path)) return;
          createFolderPath(path);
          notify(t('toast.folderCreated'));
        },
      });
    },
    [createFolderPath, notify, t],
  );

  const renameEntry = useCallback(
    (path: string) => {
      setPrompt({
        title: t('common.rename'),
        label: t('editor.nameLabel'),
        initial: basename(path),
        confirmLabel: t('common.rename'),
        onSubmit: (value) => {
          const clean = value.trim();
          if (!clean) return;
          const parent = dirname(path);
          const next = normalizePath(clean.includes('/') ? clean : parent ? `${parent}/${clean}` : clean);
          if (!next || next === path) return;
          const current = vfsRef.current;
          if (next in current.files || current.folders.includes(next)) return;
          const folder = current.folders.includes(path);
          setVfs((previous) => {
            const files: Record<string, string> = {};
            for (const [file, content] of Object.entries(previous.files)) files[replacePrefix(file, path, next)] = content;
            const folders = previous.folders.map((item) => replacePrefix(item, path, next));
            return { files, folders };
          });
          setSession((previous) => ({
            tabs: previous.tabs.map((tab) => replacePrefix(tab, path, next)),
            active: previous.active ? replacePrefix(previous.active, path, next) : null,
          }));
          setBuffers((previous) => {
            const nextBuffers: Record<string, string> = {};
            for (const [file, content] of Object.entries(previous)) nextBuffers[replacePrefix(file, path, next)] = content;
            return nextBuffers;
          });
          setLanguageOverrides((previous) => {
            const nextOverrides: Record<string, string> = {};
            for (const [file, language] of Object.entries(previous)) nextOverrides[replacePrefix(file, path, next)] = language;
            return nextOverrides;
          });
          notify(t('toast.renamed'));
          void folder;
        },
      });
    },
    [notify, setVfs, t],
  );

  const duplicateFile = useCallback(
    (path: string) => {
      const current = vfsRef.current;
      const dot = path.lastIndexOf('.');
      const base = dot > path.lastIndexOf('/') ? path.slice(0, dot) : path;
      const extension = dot > path.lastIndexOf('/') ? path.slice(dot) : '';
      let candidate = `${base}-copia${extension}`;
      let counter = 2;
      while (candidate in current.files) candidate = `${base}-copia-${counter++}${extension}`;
      writeFile(candidate, current.files[path] ?? '');
      focusFile(candidate);
      notify(t('toast.created'));
    },
    [focusFile, notify, t, writeFile],
  );

  const askDelete = useCallback(
    (path: string) => {
      const folder = vfsRef.current.folders.includes(path);
      setConfirm({
        title: `${t('common.delete')} ${basename(path)}?`,
        message: folder ? t('project.confirmDelete') : t('project.confirmDelete'),
        confirmLabel: t('common.delete'),
        onConfirm: () => {
          removePath(path);
          notify(t('toast.deleted'));
        },
      });
    },
    [notify, removePath, t],
  );

  const copyText = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        notify(t('common.copied'));
      } catch {
        notify(t('common.error'));
      }
    },
    [notify, t],
  );

  /* -------------------------------------------------------------- projetos */

  const switchProject = useCallback(
    async (id: string) => {
      const target = projectsRef.current.find((item) => item.id === id);
      if (!target) return;
      saveAllRef.current();
      const stored = await loadProjectSession(target.id);
      const firstFile = Object.keys(target.files)[0] ?? null;
      setActiveId(id);
      setBuffers({});
      setLanguageOverrides({});
      setSession({
        tabs: (stored?.tabs ?? (firstFile ? [firstFile] : [])).filter((path) => path in target.files),
        active: stored?.active && stored.active in target.files ? stored.active : firstFile,
      });
      setPanel(null);
      setSidebar(null);
      const snapshot = await readRecovery(id);
      setRecovery(snapshot);
    },
    [],
  );

  const createNewProject = useCallback(() => {
    setPrompt({
      title: t('project.new'),
      label: t('project.namePlaceholder'),
      confirmLabel: t('common.create'),
      onSubmit: (value) => {
        const name = uniqueProjectName(projectsRef.current, value.trim() || 'Projeto');
        const project = createProject(name, { files: { 'README.md': `# ${name}\n\n` }, folders: [] });
        setProjects((previous) => [...previous, project]);
        void switchProject(project.id);
        notify(t('toast.projectCreated'));
      },
    });
  }, [notify, switchProject, t]);

  const renameProject = useCallback(
    (id: string) => {
      const target = projectsRef.current.find((item) => item.id === id);
      if (!target) return;
      setPrompt({
        title: t('project.rename'),
        label: t('project.namePlaceholder'),
        initial: target.name,
        confirmLabel: t('common.save'),
        onSubmit: (value) => {
          const name = value.trim();
          if (!name) return;
          updateProject(id, (current) => ({ ...current, name }));
          notify(t('toast.renamed'));
        },
      });
    },
    [notify, t, updateProject],
  );

  const deleteProject = useCallback(
    (id: string) => {
      if (projectsRef.current.length <= 1) {
        notify(t('project.confirmDelete'));
        return;
      }
      setConfirm({
        title: t('project.delete'),
        message: t('project.confirmDelete'),
        confirmLabel: t('common.delete'),
        onConfirm: () => {
          const remaining = projectsRef.current.filter((item) => item.id !== id);
          setProjects(remaining);
          if (activeIdRef.current === id) void switchProject(remaining[0].id);
          notify(t('toast.projectDeleted'));
        },
      });
    },
    [notify, switchProject, t],
  );

  /* --------------------------------------------------------- import/export */

  const exportProject = useCallback(() => {
    const current = projectsRef.current.find((item) => item.id === activeIdRef.current);
    if (!current) return;
    downloadBlob(composeProjectZip(current.name, { files: current.files, folders: current.folders }), `${current.name.toLowerCase().replace(/\s+/g, '-')}.zip`);
    notify(t('toast.exported'));
  }, [notify, t]);

  const importProject = useCallback(
    async (file: File) => {
      try {
        const imported = await readZip(file);
        const name = uniqueProjectName(projectsRef.current, imported.name || 'Projeto');
        const project = createProject(name, imported.vfs);
        setProjects((previous) => [...previous, project]);
        await switchProject(project.id);
        notify(t('toast.imported'));
      } catch (error) {
        notify(`${t('common.error')}: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    [notify, switchProject, t],
  );

  /* -------------------------------------------------------------- recuperação */

  const restoreRecovery = useCallback(() => {
    if (!recovery) return;
    setBuffers(recovery.buffers ?? {});
    setSession({
      tabs: recovery.tabs.filter((path) => path in vfsRef.current.files),
      active: recovery.active && recovery.active in vfsRef.current.files ? recovery.active : null,
    });
    setVfs((current) => ({
      files: { ...current.files, ...recovery.buffers },
      folders: current.folders,
    }));
    setRecovery(null);
    notify(t('rec.restore'));
  }, [notify, recovery, setVfs, t]);

  const discardRecovery = useCallback(() => {
    if (recovery) void clearRecovery(recovery.projectId);
    setRecovery(null);
  }, [recovery]);

  /* ------------------------------------------------------------- interface */

  const patchSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((previous) => ({ ...previous, ...patch }));
  }, []);

  const toggleSidebar = (view: Exclude<Sidebar, null>) => setSidebar((previous) => (previous === view ? null : view));
  const togglePanel = (next: Exclude<Panel, null>) => setPanel((previous) => (previous === next ? null : next));

  const insertText = useCallback((text: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;
    editor.executeEdits('keybar', [{ range: selection, text, forceMoveInsertions: true } as never]);
    editor.focus();
  }, []);
  void insertText;

  const runEditorAction = useCallback((action: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const found = editor.getAction(action);
    if (found) void found.run();
    else editor.trigger('toolbar', action, null);
    editor.focus();
  }, []);

  const promptGoto = useCallback(() => {
    setPrompt({
      title: t('editor.goto'),
      label: 'Linha',
      initial: String(cursor.line),
      confirmLabel: t('common.open'),
      onSubmit: (value) => {
        const line = Number.parseInt(value, 10);
        if (!Number.isFinite(line) || line < 1) return;
        setGoTo({ line, token: Date.now() });
      },
    });
  }, [cursor.line, t]);

  const renameActiveLanguage = useCallback(
    (languageId: string | null) => {
      if (!active) return;
      setLanguageOverrides((previous) => {
        const next = { ...previous };
        if (languageId) next[active] = languageId;
        else delete next[active];
        return next;
      });
      setLanguagePickerOpen(false);
    },
    [active],
  );

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
        toggleSidebar('explorer');
      } else if (key === 'j') {
        event.preventDefault();
        togglePanel('terminal');
      } else if (key === 'g') {
        event.preventDefault();
        promptGoto();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [promptGoto, saveAll]);

  /* -------------------------------------------------------------- comandos */

  const commands: Command[] = [
    { id: 'new-file', label: `${t('welcome.newFile')}`, run: () => setNewFileDir('') },
    { id: 'new-folder', label: `${t('explorer.newFolder')}`, run: () => createFolder('') },
    { id: 'save', label: t('common.save'), hint: 'Ctrl+S', run: saveAll },
    { id: 'run', label: t('run.local'), run: () => (active ? void execute(active) : undefined) },
    {
      id: 'stop',
      label: t('run.stop'),
      run: stopRun,
    },
    { id: 'terminal', label: t('terminal.title'), run: () => togglePanel('terminal') },
    { id: 'preview', label: t('preview.title'), run: () => togglePanel('preview') },
    { id: 'git', label: t('git.title'), run: () => setPanel('git') },
    { id: 'settings', label: t('settings.title'), run: () => setPanel('settings') },
    { id: 'explorer', label: t('explorer.title'), run: () => toggleSidebar('explorer') },
    { id: 'search', label: t('search.title'), run: () => toggleSidebar('search') },
    { id: 'language', label: t('editor.pickLanguage'), run: () => setLanguagePickerOpen(true) },
    { id: 'goto', label: t('editor.goto'), hint: 'Ctrl+G', run: promptGoto },
    { id: 'find', label: t('editor.find'), run: () => runEditorAction('actions.find') },
    { id: 'replace', label: t('editor.replace'), run: () => runEditorAction('editor.action.startFindReplaceAction') },
    { id: 'format', label: t('editor.format'), run: () => runEditorAction('editor.action.formatDocument') },
    { id: 'comment', label: t('editor.comment'), run: () => runEditorAction('editor.action.commentLine') },
    { id: 'duplicate-line', label: t('editor.duplicate'), run: () => runEditorAction('editor.action.copyLinesDownAction') },
    { id: 'delete-line', label: t('editor.deleteLine'), run: () => runEditorAction('editor.action.deleteLines') },
    {
      id: 'wrap',
      label: `${t('editor.wrap')} (${settings.wordWrap ? 'on' : 'off'})`,
      run: () => patchSettings({ wordWrap: !settings.wordWrap }),
    },
    {
      id: 'theme',
      label: `${t('settings.theme')}: ${settings.theme}`,
      run: () => patchSettings({ theme: settings.theme === 'dark' ? 'light' : settings.theme === 'light' ? 'hc' : 'dark' }),
    },
    { id: 'export', label: t('settings.export'), run: exportProject },
    { id: 'import', label: t('settings.import'), run: () => importRef.current?.click() },
    { id: 'project', label: t('project.title'), run: () => setSheet({ title: t('project.title'), items: projectItems() }) },
  ];

  function projectItems(): SheetItem[] {
    return [
      ...projects.map((item) => ({
        label: `${item.name}${item.id === activeId ? ' ✓' : ''}`,
        icon: 'layers' as const,
        onSelect: () => void switchProject(item.id),
      })),
      { label: t('project.new'), icon: 'plus', onSelect: createNewProject },
      ...(project
        ? [
            { label: t('project.rename'), icon: 'edit' as const, onSelect: () => renameProject(project.id) },
            { label: t('project.delete'), icon: 'trash' as const, danger: true, onSelect: () => deleteProject(project.id) },
          ]
        : []),
    ];
  }

  const entryMenu = (entry: Entry) => {
    const items: SheetItem[] = [];
    if (entry.type === 'folder') {
      items.push({ label: t('explorer.newFile'), icon: 'file-plus', onSelect: () => setNewFileDir(entry.path) });
      items.push({ label: t('explorer.newFolder'), icon: 'folder-plus', onSelect: () => createFolder(entry.path) });
    } else {
      items.push({ label: t('common.open'), icon: 'file', onSelect: () => openFile(entry.path) });
      if (languageForPath(entry.path).engine) {
        items.push({ label: t('run.local'), icon: 'play', onSelect: () => void execute(entry.path) });
      }
      items.push({ label: t('editor.duplicate'), icon: 'copy', onSelect: () => duplicateFile(entry.path) });
      items.push({ label: t('common.copy'), icon: 'copy', onSelect: () => void copyText(entry.path) });
    }
    items.push({ label: t('common.rename'), icon: 'edit', onSelect: () => renameEntry(entry.path) });
    items.push({ label: t('common.delete'), icon: 'trash', danger: true, onSelect: () => askDelete(entry.path) });
    setSheet({ title: basename(entry.path), items });
  };

  const openMore = () => {
    setSheet({
      title: t('titlebar.more'),
      items: [
        { label: t('project.title'), icon: 'layers', onSelect: () => setSheet({ title: t('project.title'), items: projectItems() }) },
        { label: t('git.title'), icon: 'git', onSelect: () => setPanel('git') },
        { label: t('settings.title'), icon: 'settings', onSelect: () => setPanel('settings') },
        { label: t('preview.title'), icon: 'eye', onSelect: () => togglePanel('preview') },
        { label: t('common.save'), icon: 'save', onSelect: saveAll },
        { label: t('settings.export'), icon: 'download', onSelect: exportProject },
        { label: t('settings.import'), icon: 'upload', onSelect: () => importRef.current?.click() },
        { label: t('tabs.closeAll'), icon: 'close', onSelect: () => setSession({ tabs: [], active: null }) },
      ],
    });
  };

  const files = useMemo(() => filePaths(vfs), [vfs]);
  const dirty = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const [path, value] of Object.entries(buffers)) {
      if (path in vfs.files && vfs.files[path] !== value) map[path] = true;
    }
    return map;
  }, [buffers, vfs.files]);
  const activeDirty = active ? Boolean(dirty[active]) : false;
  const activeBuffer = active ? buffers[active] ?? vfs.files[active] ?? '' : '';

  if (!ready || !project) {
    return <Splash label={t('splash.loading')} />;
  }

  const navItems: { id: 'explorer' | 'search' | 'terminal' | 'preview'; label: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
    { id: 'explorer', label: t('explorer.title'), icon: 'folder' },
    { id: 'search', label: t('search.title'), icon: 'search' },
    { id: 'terminal', label: t('terminal.title'), icon: 'terminal' },
    { id: 'preview', label: t('preview.title'), icon: 'eye' },
  ];

  return (
    <div className="app" data-theme={settings.theme}>
      <header className="titlebar">
        <button type="button" className="icon-btn" aria-label={t('titlebar.explorer')} onClick={() => toggleSidebar('explorer')}>
          <Icon name="menu" size={21} />
        </button>
        <div className="titlebar-title">
          <span className="brand">{t('app.name')}</span>
          <span className="title-file">{active ? basename(active) : project.name}</span>
        </div>
        <div className="titlebar-actions">
          {activeDirty ? (
            <button type="button" className="icon-btn save-pulse" aria-label={t('titlebar.save')} onClick={saveAll}>
              <Icon name="save" size={19} />
            </button>
          ) : null}
          <button type="button" className="icon-btn" aria-label={t('titlebar.search')} onClick={() => setPalette({ prefix: '' })}>
            <Icon name="search" size={19} />
          </button>
          <button type="button" className="icon-btn" aria-label={t('titlebar.palette')} onClick={() => setPalette({ prefix: '>' })}>
            <Icon name="palette" size={19} />
          </button>
          <button type="button" className="icon-btn" aria-label={t('titlebar.more')} onClick={openMore}>
            <Icon name="more" size={19} />
          </button>
        </div>
      </header>

      <Tabs
        tabs={tabs.map((path) => ({ path, name: basename(path), dirty: Boolean(dirty[path]) }))}
        active={active}
        onSelect={(path) => openFile(path)}
        onClose={(path) => {
          commitBuffer(path);
          setSession((previous) => {
            const index = previous.tabs.indexOf(path);
            const nextTabs = previous.tabs.filter((tab) => tab !== path);
            return {
              tabs: nextTabs,
              active: previous.active === path ? nextTabs[Math.min(index, nextTabs.length - 1)] ?? null : previous.active,
            };
          });
        }}
        onNew={() => setNewFileDir('')}
      />

      <main className="editor-area">
        <div className="editor-slot">
          <EditorPane
            activePath={active}
            language={activeLanguage === 'luau' ? 'luau' : languageForPath(active ?? '').monaco}
            buffer={activeBuffer}
            settings={settings}
            theme={settings.theme}
            goTo={goTo}
            onChange={(value) => (active ? onEdit(active, value) : undefined)}
            onCursor={(line, column) => setCursor({ line, column })}
            onSave={saveAll}
            onReady={(editor) => {
              editorRef.current = editor;
            }}
          />
        </div>

        {!active ? (
          <Welcome
            files={files}
            projectName={project.name}
            onNewFile={() => setNewFileDir('')}
            onQuickOpen={() => setPalette({ prefix: '' })}
            onPalette={() => setPalette({ prefix: '>' })}
            onExplorer={() => setSidebar('explorer')}
            onTerminal={() => setPanel('terminal')}
            onPreview={() => setPanel('preview')}
            onSettings={() => setPanel('settings')}
            onOpenFile={openFile}
          />
        ) : null}

        {panel === 'terminal' ? (
          <TerminalPanel
            vfs={vfs}
            onOpenFile={openFile}
            onWriteFile={writeFile}
            onDeletePath={removePath}
            onCreateFolder={createFolderPath}
            onRunFile={(path, args, stdin) => execute(path, args, stdin)}
            onStop={stopRun}
            runningPath={runningPath}
            onClose={() => setPanel(null)}
            request={terminalRequest}
            onRequestHandled={() => setTerminalRequest(null)}
            onError={notify}
            runLog={runLog}
          />
        ) : null}

        {panel === 'preview' ? (
          <PreviewPanel
            vfs={vfs}
            onClose={() => setPanel(null)}
            autoRefresh={settings.previewAutoRefresh}
            onToggleAutoRefresh={() => patchSettings({ previewAutoRefresh: !settings.previewAutoRefresh })}
            onOpenFile={openFile}
          />
        ) : null}

        {panel === 'settings' ? (
          <SettingsPanel
            settings={settings}
            onChange={patchSettings}
            onClose={() => setPanel(null)}
            onExport={exportProject}
            onImport={() => importRef.current?.click()}
            onReset={() => {
              const seeded = defaultProjects().map((item) => createProject(item.name, item.vfs));
              setProjects(seeded);
              void switchProject(seeded[0].id);
              notify(t('toast.projectCreated'));
            }}
            onPistonSave={(endpoint) => {
              try {
                if (endpoint) {
                  const parsed = new URL(endpoint);
                  if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
                    notify('Use https:// (http só em localhost)');
                    return;
                  }
                }
                patchSettings({ pistonEndpoint: endpoint.replace(/\/+$/, '') });
                notify(t('toast.pistonSaved'));
              } catch {
                notify('URL inválida');
              }
            }}
            gitToken={gitToken}
            onGitToken={(value) => {
              setGitToken(value);
              prefSet(TOKEN_KEY, value);
            }}
            version={APP_VERSION}
            runningCount={runningPath ? 1 : 0}
          />
        ) : null}

        {panel === 'git' ? (
          <GitPanel
            vfs={vfs}
            config={{ owner: settings.gitOwner, repo: settings.gitRepo, branch: settings.gitBranch, token: gitToken }}
            onClose={() => setPanel(null)}
            onOpenFile={openFile}
            onOpenSettings={() => setPanel('settings')}
            onNotify={notify}
            onError={(message) => notify(`${t('git.error')}: ${message}`)}
          />
        ) : null}
      </main>

      {settings.keybar ? (
        <KeyBar editor={editorRef.current} fontSize={settings.fontSize} onSave={saveAll} onFontSize={(fontSize) => patchSettings({ fontSize })} />
      ) : null}

      <StatusBar
        languageLabel={activeLanguage === 'plaintext' && active ? languageForPath(active).label : languageForPath(active ?? '').label}
        line={cursor.line}
        column={cursor.column}
        dirty={activeDirty}
        runtime={activeRuntime}
        autoSave={settings.autoSave}
        isRunning={Boolean(runningPath)}
        onRun={() => (active ? void execute(active) : undefined)}
        onLanguages={() => setLanguagePickerOpen(true)}
      />

      <nav className="bottom-nav" aria-label="Navegação">
        {navItems.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`nav-item${
              item.id === 'explorer' || item.id === 'search' ? (sidebar === item.id ? ' active' : '') : panel === item.id ? ' active' : ''
            }`}
            onClick={() => (item.id === 'explorer' || item.id === 'search' ? toggleSidebar(item.id) : togglePanel(item.id))}
          >
            <Icon name={item.icon} size={21} />
            <span>{item.label}</span>
          </button>
        ))}
        <button
          type="button"
          className={`nav-item${panel === 'settings' || panel === 'git' ? ' active' : ''}`}
          onClick={openMore}
        >
          <Icon name="more" size={21} />
          <span>{t('titlebar.more')}</span>
        </button>
      </nav>

      {sidebar ? (
        <>
          <div className="drawer-backdrop" role="presentation" onClick={() => setSidebar(null)} />
          <aside className="drawer" aria-label={sidebar === 'explorer' ? t('explorer.title') : t('search.title')}>
            <div className="drawer-grip" />
            {sidebar === 'explorer' ? (
              <Explorer
                vfs={vfs}
                activePath={active}
                project={project}
                onOpen={(path) => openFile(path)}
                onMenu={entryMenu}
                onNewFile={(dir) => setNewFileDir(dir)}
                onNewFolder={createFolder}
                onProjects={() => setSheet({ title: t('project.title'), items: projectItems() })}
                onImport={() => importRef.current?.click()}
                onExport={exportProject}
                onZip={exportProject}
              />
            ) : (
              <SearchPanel vfs={vfs} onOpen={openFile} />
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
      {confirm ? (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          onConfirm={confirm.onConfirm}
          onClose={() => setConfirm(null)}
        />
      ) : null}
      {newFileDir !== null ? (
        <NewFileDialog initialDir={newFileDir} onClose={() => setNewFileDir(null)} onCreate={createWithLanguage} />
      ) : null}
      {languagePickerOpen && active ? (
        <LanguagePicker
          current={languageOverrides[active] ?? null}
          filePath={active}
          onPick={renameActiveLanguage}
          onClose={() => setLanguagePickerOpen(false)}
        />
      ) : null}
      {recovery ? (
        <Sheet
          title={t('rec.title')}
          items={[
            { label: t('rec.message'), icon: 'info', onSelect: () => undefined },
            { label: t('rec.restore'), icon: 'refresh', onSelect: restoreRecovery },
            { label: t('rec.discard'), icon: 'trash', danger: true, onSelect: discardRecovery },
          ]}
          onClose={discardRecovery}
        />
      ) : null}
      {toast ? <Toast message={toast} /> : null}

      <input
        ref={importRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importProject(file);
          event.target.value = '';
        }}
      />
    </div>
  );
}

export { isFolder, entriesIn, FONT_MIN, FONT_MAX };
