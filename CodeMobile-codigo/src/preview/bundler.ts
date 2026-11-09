/**
 * Monta o preview executável do projeto.
 *
 * - HTML/CSS/JS/TS/JSX/TSX/SCSS em múltiplos arquivos;
 * - módulos resolvidos entre si (import/require relativo);
 * - React disponível sem rede (build UMD embutido);
 * - console, erros e navegação entre páginas reportados ao app.
 */

import reactUmd from './vendor/react.umd.js?raw';
import reactDomUmd from './vendor/react-dom.umd.js?raw';
import { transpile } from '../runtimes/webEngine';
import { basename, dirname, normalizePath, type Vfs } from '../workspace/vfs';
import { compileStyles } from './styles';

export type PreviewBuild = {
  html: string;
  entry: string;
  warnings: string[];
  error?: string;
};

const SCRIPT_EXTENSIONS = /\.(js|mjs|cjs|ts|mts|cts|jsx|tsx)$/i;

function findEntry(vfs: Vfs, requested?: string): string | null {
  if (requested && requested in vfs.files) return requested;
  if ('index.html' in vfs.files) return 'index.html';
  return Object.keys(vfs.files).find((path) => path.endsWith('.html')) ?? null;
}

function resolveImport(fromPath: string, spec: string, vfs: Vfs): string | null {
  if (!spec.startsWith('.')) return null;
  const base = normalizePath(`${dirname(fromPath)}/${spec}`);
  const candidates = [
    base,
    `${base}.js`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.tsx`,
    `${base}.mjs`,
    `${base}/index.js`,
    `${base}/index.ts`,
    `${base}/index.jsx`,
    `${base}/index.tsx`,
  ];
  return candidates.find((candidate) => candidate in vfs.files) ?? null;
}

function collectModules(entry: string, vfs: Vfs, warnings: string[]): Map<string, string> {
  const modules = new Map<string, string>();
  const queue: string[] = [entry];

  while (queue.length) {
    const path = queue.shift()!;
    if (modules.has(path)) continue;
    const source = vfs.files[path];
    if (source === undefined) continue;
    let code = source;
    try {
      code = transpile(source, basename(path));
    } catch (error) {
      warnings.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
    modules.set(path, code);

    const requires = code.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g);
    for (const match of requires) {
      const resolved = resolveImport(path, match[1], vfs);
      if (resolved && !modules.has(resolved)) queue.push(resolved);
      else if (!resolved && !match[1].startsWith('.')) {
        // Módulos externos ficam a cargo dos globais do preview.
      }
    }
  }
  return modules;
}

function buildRuntimeScript(modules: Map<string, string>, entry: string): string {
  const definitions = Array.from(modules.entries())
    .map(([path, code]) => `__mods[${JSON.stringify(path)}] = function(require, module, exports){\n${code}\n};`)
    .join('\n');

  return `
(function(){
  var __mods = {};
  var __cache = {};
  ${definitions}
  function normalize(path){
    var parts = [];
    path.split('/').forEach(function(part){
      if (!part || part === '.') return;
      if (part === '..') { parts.pop(); return; }
      parts.push(part);
    });
    return parts.join('/');
  }
  function resolve(from, spec){
    if (spec.charAt(0) !== '.') return spec;
    var base = normalize((from.indexOf('/') === -1 ? '' : from.slice(0, from.lastIndexOf('/'))) + '/' + spec);
    var candidates = [base, base + '.js', base + '.ts', base + '.jsx', base + '.tsx', base + '/index.js', base + '/index.ts'];
    for (var index = 0; index < candidates.length; index += 1) {
      if (Object.prototype.hasOwnProperty.call(__mods, candidates[index])) return candidates[index];
    }
    return base;
  }
  function load(id){
    if (!id) return {};
    if (__cache[id]) return __cache[id].exports;
    var factory = __mods[id];
    if (!factory) {
      if (id === 'react') { if (window.React) return window.React; throw new Error('React indisponível no preview'); }
      if (id === 'react-dom' || id === 'react-dom/client') { if (window.ReactDOM) return window.ReactDOM; throw new Error('ReactDOM indisponível no preview'); }
      throw new Error('Módulo não encontrado: ' + id);
    }
    var module = { exports: {} };
    __cache[id] = module;
    factory(function(spec){ return load(resolve(id, spec)); }, module, module.exports);
    return module.exports;
  }
  try {
    load(${JSON.stringify(entry)});
  } catch (error) {
    console.error(error && error.stack ? error.stack : String(error));
  }
})();
`;
}

const BRIDGE = `
<script>
(function(){
  function send(type, payload) {
    try {
      var message = { source: 'code-mobile-preview', type: type };
      if (payload) { for (var key in payload) { if (Object.prototype.hasOwnProperty.call(payload, key)) message[key] = payload[key]; } }
      parent.postMessage(message, '*');
    } catch (error) {}
  }
  ['log', 'info', 'warn', 'error', 'debug'].forEach(function(level){
    var original = console[level] ? console[level].bind(console) : function(){};
    console[level] = function(){
      var args = Array.prototype.slice.call(arguments);
      var text = args.map(function(value){
        if (typeof value === 'string') return value;
        try { var json = JSON.stringify(value); return json === undefined ? String(value) : json; } catch (error) { return String(value); }
      }).join(' ');
      send('console', { level: level, text: text });
      original.apply(console, args);
    };
  });
  window.addEventListener('error', function(event){
    send('console', { level: 'error', text: (event.message || 'Erro') + ' (' + (event.filename || 'preview') + ':' + event.lineno + ')' });
  });
  window.addEventListener('unhandledrejection', function(event){
    send('console', { level: 'error', text: 'Promise rejeitada: ' + String(event.reason) });
  });
  document.addEventListener('click', function(event){
    var anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!anchor) return;
    var href = anchor.getAttribute('href') || '';
    if (!href || /^(https?:|mailto:|#|javascript:)/i.test(href)) return;
    if (!/\\.html?($|[#?])/i.test(href)) return;
    event.preventDefault();
    send('navigate', { path: href });
  }, true);
  send('ready', {});
})();
</script>
`;

export function buildPreview(vfs: Vfs, requestedEntry?: string): PreviewBuild {
  const warnings: string[] = [];
  const entry = findEntry(vfs, requestedEntry);
  if (!entry) {
    return { html: '', entry: '', warnings, error: 'no-entry' };
  }

  let html = vfs.files[entry] ?? '';

  html = html.replace(
    /<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi,
    (match: string, href: string) => {
      if (!/rel=["']?stylesheet/i.test(match)) return match;
      if (/^(https?:|data:)/i.test(href)) return match;
      const path = normalizePath(`${dirname(entry)}/${href}`);
      const source = vfs.files[path];
      if (source === undefined) {
        warnings.push(`estilo não encontrado: ${path}`);
        return match;
      }
      const compiled = compileStyles(source, path);
      warnings.push(...compiled.warnings);
      return `<style data-file="${path}">\n${compiled.css}\n</style>`;
    },
  );

  const scriptTags: string[] = [];
  html = html.replace(/<script\b([^>]*)src=["']([^"']+)["']([^>]*)><\/script>/gi, (match, _a, src: string) => {
    if (/^(https?:|data:)/i.test(src)) return match;
    const path = normalizePath(`${dirname(entry)}/${src}`);
    if (!SCRIPT_EXTENSIONS.test(path)) return match;
    scriptTags.push(path);
    return '';
  });

  for (const tag of html.matchAll(/<script\b([^>]*)src=["']([^"']+)["'][^>]*>/gi)) {
    if (!/^(https?:|data:)/i.test(tag[2])) warnings.push(`script não encontrado: ${tag[2]}`);
  }

  let bundle = '';
  if (scriptTags.length) {
    const modules = new Map<string, string>();
    for (const script of scriptTags) {
      for (const [path, code] of collectModules(script, vfs, warnings)) modules.set(path, code);
    }
    const runtime = buildRuntimeScript(modules, scriptTags[scriptTags.length - 1]);
    // React UMD só entra quando o projeto realmente importa React.
    const needsReact = Array.from(modules.values()).some((code) =>
      /require\(\s*["']react(-dom)?(\/client)?["']\s*\)/.test(code),
    );
    const react = needsReact ? `${reactUmd}\n${reactDomUmd}\n` : '';
    bundle = `<script>\n${react}${runtime.replace(/<\/script/gi, '<\\/script')}\n</script>`;
  }

  html = html.replace(/<head\b[^>]*>/i, (match) => `${match}\n${BRIDGE}`);
  if (!/<head\b/i.test(html)) html = BRIDGE + html;

  if (bundle) {
    if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, `${bundle}\n</body>`);
    else html += bundle;
  }

  return { html, entry, warnings };
}
