import { useEffect, useMemo, useRef, useState } from 'react';
import { basename, type Vfs } from '../workspace/vfs';
import { executeCommand, executeScript, type ShellContext } from '../runtimes/shell';
import { useI18n } from '../i18n';
import { Icon } from './ui';

type Line = { id: number; kind: 'command' | 'output' | 'error' | 'meta'; text: string };

type Session = {
  id: number;
  name: string;
  cwd: string;
  lines: Line[];
  history: string[];
  input: string;
  busy: boolean;
  exitCode: number | null;
};

let lineId = 0;

function createSession(index: number): Session {
  return {
    id: index,
    name: `bash-${index}`,
    cwd: '',
    lines: [
      { id: (lineId += 1), kind: 'meta', text: 'Code Mobile shell · digite "help" para ver os comandos' },
    ],
    history: [],
    input: '',
    busy: false,
    exitCode: null,
  };
}

export function TerminalPanel({
  vfs,
  onOpenFile,
  onWriteFile,
  onDeletePath,
  onCreateFolder,
  onRunFile,
  onStop,
  runningPath,
  onClose,
  request,
  onRequestHandled,
  onError,
  runLog,
}: {
  vfs: Vfs;
  onOpenFile: (path: string) => void;
  onWriteFile: (path: string, content: string) => void;
  onDeletePath: (path: string) => void;
  onCreateFolder: (path: string) => void;
  onRunFile: (path: string, args: string[], stdin: string) => Promise<void>;
  onStop: () => void;
  runningPath: string | null;
  onClose: () => void;
  request: { command: string; token: number } | null;
  onRequestHandled: () => void;
  onError: (message: string) => void;
  runLog?: { id: number; stream: 'stdout' | 'stderr' | 'meta'; text: string }[];
}) {
  const { t } = useI18n();
  const [sessions, setSessions] = useState<Session[]>([createSession(1)]);
  const [activeId, setActiveId] = useState(1);
  const [stdin, setStdin] = useState('');
  const [showStdin, setShowStdin] = useState(false);
  const outputRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const vfsRef = useRef(vfs);
  vfsRef.current = vfs;
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  const active = sessions.find((session) => session.id === activeId) ?? sessions[0];

  const patch = (id: number, update: (session: Session) => Session) => {
    setSessions((previous) => previous.map((session) => (session.id === id ? update(session) : session)));
  };

  const push = (id: number, kind: Line['kind'], text: string) => {
    for (const chunk of String(text).split('\n')) {
      patch(id, (session) => ({
        ...session,
        lines: [...session.lines.slice(-600), { id: (lineId += 1), kind, text: chunk }],
      }));
    }
  };

  useEffect(() => {
    const node = outputRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [active?.lines.length, activeId]);

  const lastRunId = useRef(runLog && runLog.length ? runLog[runLog.length - 1].id : 0);

  useEffect(() => {
    if (!runLog || !runLog.length) return;
    const fresh = runLog.filter((event) => event.id > lastRunId.current);
    if (!fresh.length) return;
    lastRunId.current = fresh[fresh.length - 1].id;
    for (const event of fresh) {
      const kind = event.stream === 'stderr' ? 'error' : event.stream === 'meta' ? 'meta' : 'output';
      push(activeId, kind, event.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runLog, activeId]);

  const buildContext = (session: Session): ShellContext => ({
    vfs: vfsRef.current,
    cwd: session.cwd,
    print: (text, stream) => push(session.id, stream === 'err' ? 'error' : stream === 'meta' ? 'meta' : 'output', text),
    setCwd: (dir) => patch(session.id, (current) => ({ ...current, cwd: dir })),
    writeFile: onWriteFile,
    deletePath: onDeletePath,
    createFolder: onCreateFolder,
    openFile: onOpenFile,
    runFile: async (path, args) => {
      const source = vfsRef.current.files[path] ?? '';
      if (/\.(sh|bash)$/i.test(path)) {
        await executeScript(source, buildContext(session));
        return;
      }
      await onRunFile(path, args, stdin);
    },
    clear: () => patch(session.id, (current) => ({ ...current, lines: [] })),
    t,
  });

  const submit = async (raw?: string) => {
    const session = sessionsRef.current.find((item) => item.id === activeId) ?? sessions[0];
    const value = (raw ?? session.input).trim();
    if (!value || session.busy) return;
    patch(session.id, (current) => ({
      ...current,
      input: '',
      history: [...current.history.filter((item) => item !== value), value].slice(-60),
    }));
    push(session.id, 'command', `$ ${value}`);
    let contextCwd = session.cwd;
    const context: ShellContext = {
      ...buildContext(session),
      setCwd: (dir) => {
        contextCwd = dir;
        patch(session.id, (current) => ({ ...current, cwd: dir }));
      },
    };
    try {
      const code = await executeCommand(value, context);
      if (code !== null && code !== 0) push(session.id, 'meta', `exit ${code}`);
      if (code === null) push(session.id, 'meta', t('terminal.exit'));
      patch(session.id, (current) => ({ ...current, exitCode: code, cwd: contextCwd }));
    } catch (error) {
      push(session.id, 'error', error instanceof Error ? error.message : String(error));
      onError(error instanceof Error ? error.message : String(error));
    }
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (!request) return;
    void submit(request.command);
    onRequestHandled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.token]);

  const addSession = () => {
    const index = sessions.length + 1;
    const session = createSession(index);
    setSessions((previous) => [...previous, session]);
    setActiveId(session.id);
  };

  const closeSession = (id: number) => {
    if (sessions.length === 1) {
      patch(id, (current) => ({ ...createSession(current.id), cwd: current.cwd }));
      return;
    }
    setSessions((previous) => previous.filter((session) => session.id !== id));
    if (activeId === id) setActiveId(sessions.find((session) => session.id !== id)?.id ?? 1);
  };

  const prompt = useMemo(() => `/${active.cwd}`, [active.cwd]);

  return (
    <section className="terminal-panel" aria-label={t('terminal.title')}>
      <div className="terminal-header">
        <span className="terminal-title">
          <Icon name="terminal" size={14} />
          {t('terminal.title')}
        </span>
        <div className="terminal-sessions">
          {sessions.map((session) => (
            <button
              type="button"
              key={session.id}
              className={`terminal-session${session.id === activeId ? ' active' : ''}`}
              onClick={() => setActiveId(session.id)}
              onDoubleClick={() => closeSession(session.id)}
            >
              {session.name}
            </button>
          ))}
          <button type="button" className="icon-btn small" aria-label={t('terminal.new')} onClick={addSession}>
            <Icon name="plus" size={14} />
          </button>
        </div>
        <div className="terminal-actions">
          {runningPath ? (
            <button type="button" className="icon-btn small" aria-label={t('run.stop')} onClick={onStop}>
              <Icon name="stop" size={15} />
            </button>
          ) : null}
          <button
            type="button"
            className="icon-btn small"
            aria-label={t('terminal.clear')}
            onClick={() => patch(active.id, (current) => ({ ...current, lines: [] }))}
          >
            <Icon name="trash" size={15} />
          </button>
          <button type="button" className="icon-btn small" aria-label={t('common.close')} onClick={onClose}>
            <Icon name="close" size={15} />
          </button>
        </div>
      </div>

      <div className="terminal-output" ref={outputRef}>
        {active.lines.map((line) => (
          <div key={line.id} className={`terminal-line ${line.kind}`}>
            {line.text || '\u00a0'}
          </div>
        ))}
        {runningPath ? <div className="terminal-line running">▶ {basename(runningPath)} …</div> : null}
      </div>

      {showStdin ? (
        <div className="terminal-stdin">
          <span className="terminal-prompt">stdin</span>
          <textarea
            className="terminal-stdin-input"
            value={stdin}
            placeholder={t('run.stdin')}
            onChange={(event) => setStdin(event.target.value)}
            rows={2}
          />
        </div>
      ) : null}

      <div className="terminal-input-row">
        <span className="terminal-prompt">{prompt} $</span>
        <input
          ref={inputRef}
          className="terminal-input"
          value={active.input}
          placeholder={t('terminal.placeholder')}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => patch(active.id, (current) => ({ ...current, input: event.target.value }))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void submit();
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              const history = active.history;
              if (!history.length) return;
              const last = history[history.length - 1];
              patch(active.id, (current) => ({ ...current, input: last }));
            }
          }}
        />
        <button
          type="button"
          className="chip"
          aria-label={t('run.stdin')}
          onClick={() => setShowStdin((value) => !value)}
          title={t('run.stdin')}
        >
          in
        </button>
        <button type="button" className="terminal-send" aria-label="Executar" onClick={() => void submit()}>
          <Icon name="arrow-right" size={16} />
        </button>
      </div>
    </section>
  );
}
