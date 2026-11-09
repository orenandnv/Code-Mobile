/** Contratos comuns a todos os motores de execução. */

import type { Vfs } from '../workspace/vfs';

export type RunStream = 'stdout' | 'stderr' | 'meta';

export type RunEvent = { stream: RunStream; text: string };

export type RunRequest = {
  language: string;
  filename: string;
  source: string;
  stdin?: string;
  args?: string[];
  /** Arquivos do projeto, para resolução de módulos e scripts multiarquivo. */
  files?: Vfs['files'];
  onEvent?: (event: RunEvent) => void;
  signal?: AbortSignal;
};

export type RunResult = {
  ok: boolean;
  exitCode: number | null;
  durationMs: number;
  engine: string;
  location: 'local' | 'remote';
  cancelled?: boolean;
};

export type Engine = (request: RunRequest) => Promise<RunResult>;

export function emit(request: RunRequest, stream: RunStream, text: string): void {
  request.onEvent?.({ stream, text });
}
