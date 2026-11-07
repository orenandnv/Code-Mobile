import { useEffect, useRef, useState } from 'react';
import { execCommand, type ShellIO, type ShellResult } from '../lib/shell';
import { Icon } from './Icon';

type LineKind = 'command' | 'output' | 'meta' | 'error';
type Line = { id: number; kind: LineKind; text: string };

const BANNER: Line = {
  id: 0,
  kind: 'output',
  text: 'Code Mobile shell — digite "help" para ver os comandos disponíveis.',
};

const CHIPS = ['run', 'help', 'ls', 'tree', 'clear'];

function kindOf(text: string): LineKind {
  if (text.startsWith('✖')) return 'error';
  if (text.startsWith('▶') || text.startsWith('✔')) return 'meta';
  return 'output';
}

type Props = {
  io: ShellIO;
  onClose: () => void;
  /** Comando disparado de fora do terminal (paleta, ações rápidas). */
  request?: { text: string; token: number } | null;
  onRequestHandled?: () => void;
};

export default function TerminalPanel({ io, onClose, request, onRequestHandled }: Props) {
  const [lines, setLines] = useState<Line[]>([BANNER]);
  const [cwd, setCwd] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const nextId = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [lines, busy]);

  const run = async (raw: string) => {
    const command = raw.trim();
    if (!command || busyRef.current) return;

    const prompt = `dev@mobile:/${cwd}$ ${command}`;
    busyRef.current = true;
    setBusy(true);
    setInput('');
    setHistory((previous) => (previous[previous.length - 1] === command ? previous : [...previous, command]));
    setHistoryIndex(-1);
    setLines((previous) => [...previous, { id: nextId.current++, kind: 'command', text: prompt }]);

    let result: ShellResult;
    try {
      result = await execCommand(command, cwd, io);
    } catch (error) {
      result = { cwd, lines: [`✖ erro inesperado: ${error instanceof Error ? error.message : String(error)}`] };
    } finally {
      busyRef.current = false;
      setBusy(false);
    }

    if (result.clear) {
      setLines([]);
      setCwd(result.cwd);
      return;
    }

    setLines((previous) => [
      ...previous,
      ...result.lines.map((text) => ({ id: nextId.current++, kind: kindOf(text), text })),
    ]);
    setCwd(result.cwd);
    inputRef.current?.focus();
  };

  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (!request) return;
    void runRef.current(request.text);
    onRequestHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.token]);

  return (
    <div className="terminal-panel">
      <div className="terminal-header">
        <span className="terminal-title">
          <Icon name="terminal" size={15} /> TERMINAL
        </span>
        <span className="terminal-cwd">/{cwd}</span>
        <div className="terminal-actions">
          <button
            type="button"
            className="icon-btn small"
            aria-label="Limpar terminal"
            onClick={() => setLines([])}
          >
            <Icon name="trash" size={16} />
          </button>
          <button type="button" className="icon-btn small" aria-label="Fechar terminal" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>

      <div className="terminal-output" ref={scrollRef} onClick={() => inputRef.current?.focus()}>
        {lines.map((line) => (
          <div key={line.id} className={`terminal-line ${line.kind}`}>
            {line.text || '\u00a0'}
          </div>
        ))}
        {busy ? (
          <div className="terminal-line output running">▸ executando…</div>
        ) : null}
      </div>

      <div className="terminal-quick">
        {CHIPS.map((command) => (
          <button type="button" key={command} className="chip" onClick={() => void run(command)}>
            {command}
          </button>
        ))}
      </div>

      <form
        className="terminal-input-row"
        onSubmit={(event) => {
          event.preventDefault();
          void run(input);
        }}
      >
        <span className="terminal-prompt">$</span>
        <input
          ref={inputRef}
          className="terminal-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={busy ? 'executando…' : 'comando'}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              if (!history.length) return;
              const next = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
              setHistoryIndex(next);
              setInput(history[next]);
            } else if (event.key === 'ArrowDown') {
              event.preventDefault();
              if (historyIndex === -1) return;
              const next = historyIndex + 1;
              if (next >= history.length) {
                setHistoryIndex(-1);
                setInput('');
              } else {
                setHistoryIndex(next);
                setInput(history[next]);
              }
            }
          }}
        />
        <button type="submit" className="terminal-send" aria-label="Executar comando" disabled={busy}>
          <Icon name="arrow-right" size={17} />
        </button>
      </form>
    </div>
  );
}
