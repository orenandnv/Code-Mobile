// Compatibilidade de CSS para o WebView do Android 9 (Chrome 66).
//
// Duas features usadas no projeto não existem nessa engine:
//   * `gap` em container flex — só a partir do Chrome 84. Sem ele os itens
//     ficam colados (toolbar, tabs, listas). A engine de grid aceita `gap`
//     desde o 66, então o problema é exclusivo de flex.
//   * `inset` (Chrome 87) e a unidade `dvh` (Chrome 108).
//
// Este passo roda depois do `vite build`, direto no CSS gerado. Nada é removido:
// as regras originais continuam valendo para engines novas e o fallback entra
// com escopo `html.legacy-gap`, classe que o public/compat.js adiciona só
// quando detecta que o `gap` de flex não funciona.
import { readdir, readFile, writeFile } from 'node:fs/promises';

const dir = new URL('../dist/assets/', import.meta.url);

const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').trim();

/** Expande `inset: a b c d` em longhands (Chrome 87+). */
function expandInset(body) {
  return body.replace(/(^|[;{\s])inset\s*:\s*([^;}]+);?/g, (match, lead, value) => {
    const parts = value.trim().split(/\s+/);
    const [top, right = top, bottom = top, left = right] = parts;
    return `${lead}top:${top};right:${right};bottom:${bottom};left:${left};inset:${value.trim()};`;
  });
}

/** Duplica declarações com `dvh`/`svh`/`lvh` usando `vh` antes (Chrome 108+). */
function fallbackViewportUnits(body) {
  return body.replace(/(^|[;{\s])([-\w]+)\s*:\s*([^;}]+)/g, (match, lead, property, value) => {
    if (!/[0-9.](d|s|l)vh/.test(value)) return match;
    const plain = value.replace(/([0-9.])[dsl]vh/g, '$1vh');
    return `${lead}${property}:${plain.trim()};${property}:${value.trim()};`;
  });
}

/** Converte as regras flex + gap em margens equivalentes. */
function gapFallbacks(selector, body) {
  const isFlex = /display\s*:\s*(inline-)?flex\b/.test(body);
  if (!isFlex) return [];

  const wrap = /flex-wrap\s*:\s*wrap\b/.test(body);
  const column = /flex-direction\s*:\s*column(-reverse)?\b/.test(body);

  const gapMatch = body.match(/(^|[;{\s])gap\s*:\s*([^;}]+)/);
  const rowMatch = body.match(/(^|[;{\s])row-gap\s*:\s*([^;}]+)/);
  const columnMatch = body.match(/(^|[;{\s])column-gap\s*:\s*([^;}]+)/);

  let rowGap = '0px';
  let columnGap = '0px';
  if (gapMatch) {
    const [first, second = first] = gapMatch[2].trim().split(/\s+/);
    rowGap = first;
    columnGap = second;
  }
  if (rowMatch) rowGap = rowMatch[2].trim();
  if (columnMatch) columnGap = columnMatch[2].trim();

  const isZero = (value) => /^0(px|em|rem|%)?$/.test(value);
  const selectors = stripComments(selector)
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith('@') && !part.includes('{'));

  const rules = [];
  for (const base of selectors) {
    const scoped = `html.legacy-gap ${base.replace(/^html\s+/, '')}`;
    if (column) {
      if (!isZero(rowGap)) rules.push(`${scoped} > * + *{margin-top:${rowGap};}`);
    } else {
      if (!isZero(columnGap)) rules.push(`${scoped} > * + *{margin-left:${columnGap};}`);
      if (wrap && !isZero(rowGap)) rules.push(`${scoped} > * + *{margin-bottom:${rowGap};}`);
    }
  }
  return rules;
}

const files = (await readdir(dir)).filter((name) => name.endsWith('.css'));
let patchedFiles = 0;
let generated = 0;

for (const name of files) {
  const path = new URL(name, dir);
  const css = await readFile(path, 'utf8');

  const edits = [];
  const fallbacks = [];
  const blockPattern = /([^{}]*)\{([^{}]*)\}/g;
  let match = blockPattern.exec(css);
  while (match !== null) {
    const selector = match[1];
    const body = match[2];
    let next = body;

    if (/\binset\s*:/.test(next)) next = expandInset(next);
    if (/[0-9.](d|s|l)vh/.test(next)) next = fallbackViewportUnits(next);

    if (next !== body) {
      const bodyStart = match.index + match[0].length - body.length - 1;
      edits.push({ start: bodyStart, end: bodyStart + body.length, text: next });
    }

    fallbacks.push(...gapFallbacks(selector, body));
    match = blockPattern.exec(css);
  }

  let output = css;
  for (const edit of edits.reverse()) {
    output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
  }

  if (fallbacks.length) {
    output += `\n/* Fallback de flex gap/inset para WebView Chrome 66 (html.legacy-gap). */\n${fallbacks.join('\n')}\n`;
    generated += fallbacks.length;
  }

  if (output !== css) {
    await writeFile(path, output);
    patchedFiles += 1;
  }
}

console.log(`css-compat: ${patchedFiles} arquivo(s) ajustado(s), ${generated} regra(s) de fallback de gap`);
