/// <reference types="vite/client" />

declare module '@babel/standalone' {
  export function transform(
    code: string,
    options?: {
      filename?: string;
      presets?: unknown[];
      plugins?: unknown[];
      sourceType?: 'script' | 'module' | 'unambiguous';
      comments?: boolean;
      compact?: boolean;
    },
  ): { code?: string | null };
}

declare module 'monaco-editor/esm/vs/editor/editor.worker?worker' {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}

declare module 'monaco-editor/esm/vs/language/json/json.worker?worker' {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}

declare module 'monaco-editor/esm/vs/language/css/css.worker?worker' {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}

declare module 'monaco-editor/esm/vs/language/html/html.worker?worker' {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}

declare module 'monaco-editor/esm/vs/language/typescript/ts.worker?worker' {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}

declare module 'monaco-editor/min/vs/editor/editor.main.css';
