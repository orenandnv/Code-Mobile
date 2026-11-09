/**
 * Compilador de estilos do preview.
 *
 * CSS passa direto. SCSS/Sass recebem um compilador embutido com variáveis,
 * aninhamento, `&`, mixins (`@mixin`/`@include`) e `@media` aninhado — o
 * suficiente para os componentes do projeto, sem depender de rede.
 */

type Block = { selector: string; body: string };

const VARIABLE = /^\s*\$([\w-]+)\s*:\s*(.+?);?\s*$/;
const MIXIN_DEF = /^\s*@mixin\s+([\w-]+)\s*(?:\(([^)]*)\))?\s*\{/;
const INCLUDE = /^\s*@include\s+([\w-]+)\s*(?:\(([^)]*)\))?\s*;?\s*$/;

export type StyleResult = { css: string; warnings: string[] };

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function splitTopLevel(source: string): { text: string; block?: string }[] {
  const parts: { text: string; block?: string }[] = [];
  let buffer = '';
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') {
      depth += 1;
      if (depth === 1) {
        parts.push({ text: buffer.trim() });
        buffer = '';
        continue;
      }
    }
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        const last = parts[parts.length - 1];
        if (last) last.block = buffer;
        buffer = '';
        continue;
      }
    }
    if (depth === 0 && char === ';') {
      buffer += char;
      parts.push({ text: buffer.trim() });
      buffer = '';
      continue;
    }
    buffer += char;
  }
  if (buffer.trim()) parts.push({ text: buffer.trim() });
  return parts.filter((part) => part.text || part.block);
}

function substitute(value: string, variables: Record<string, string>): string {
  let result = value;
  for (let pass = 0; pass < 5; pass += 1) {
    const next = result.replace(/\$([\w-]+)/g, (match, name: string) =>
      name in variables ? variables[name] : match,
    );
    if (next === result) break;
    result = next;
  }
  return result;
}

export function compileScss(source: string, filename = 'styles.scss'): StyleResult {
  const warnings: string[] = [];
  const variables: Record<string, string> = {};
  const mixins = new Map<string, { params: string[]; body: string }>();
  let css = '';

  const combined = new Map<string, string>();
  const preprocess = (input: string) => {
    const clean = stripComments(input);
    for (const part of splitTopLevel(clean)) {
      const variable = VARIABLE.exec(part.text);
      if (variable && !part.block) {
        variables[variable[1]] = substitute(variable[2].replace(/;$/, ''), variables);
        continue;
      }
      const mixin = MIXIN_DEF.exec(part.text);
      if (mixin && part.block !== undefined) {
        const params = (mixin[2] ?? '')
          .split(',')
          .map((param) => param.trim().replace(/^[\w-]+\s*/, '').replace(/^\$/, ''))
          .map((param) => param.replace(/^[\w-]*\$/, ''))
          .filter(Boolean);
        mixins.set(mixin[1], { params, body: part.block });
        continue;
      }
      combined.set(`${part.text}|${combined.size}`, part.block ?? '');
    }
  };

  preprocess(source);

  const emitBlock = (selectorParts: string[], body: string, indent: string) => {
    const declarations: string[] = [];
    const children: Block[] = [];
    for (const part of splitTopLevel(body)) {
      if (part.block !== undefined) {
        children.push({ selector: part.text, body: part.block });
        continue;
      }
      const include = INCLUDE.exec(part.text);
      if (include) {
        const mixin = mixins.get(include[1]);
        if (mixin) {
          const args = (include[2] ?? '').split(',').map((arg) => arg.trim()).filter(Boolean);
          let expanded = mixin.body;
          mixin.params.forEach((param, index) => {
            const value = args[index] ?? '';
            expanded = expanded.replace(new RegExp(`\\$${param}\\b`, 'g'), value);
          });
          declarations.push(...splitTopLevel(expanded).filter((item) => !item.block && item.text).map((item) => item.text));
        } else warnings.push(`@include ${include[1]} não encontrado`);
        continue;
      }
      if (part.text.trim()) declarations.push(part.text.trim());
    }

    const selector = selectorParts.join(' ').replace(/\s+/g, ' ').trim();
    if (selector && declarations.length) {
      css += `${indent}${selector} {\n`;
      for (const declaration of declarations) {
        const text = substitute(declaration, variables).replace(/;?$/, ';');
        css += `${indent}  ${text}\n`;
      }
      css += `${indent}}\n`;
    }

    for (const child of children) {
      const childSelector = child.selector.trim();
      if (childSelector.startsWith('@media')) {
        css += `${indent}${substitute(childSelector, variables)} {\n`;
        emitBlock(selectorParts, child.body, `${indent}  `);
        css += `${indent}}\n`;
        continue;
      }
      const parts = childSelector.split(',').map((piece) => piece.trim());
      let nested: string[];
      if (selectorParts.length === 0) nested = parts;
      else if (parts.some((piece) => piece.includes('&'))) {
        nested = selectorParts.flatMap((parent) => parts.map((piece) => piece.replace(/&/g, parent)));
      } else {
        nested = selectorParts.flatMap((parent) => parts.map((piece) => `${parent} ${piece}`));
      }
      emitBlock(nested, child.body, indent);
    }
  };

  for (const [key, body] of combined) {
    const selector = key.slice(0, key.lastIndexOf('|'));
    if (selector.startsWith('@media') || selector.startsWith('@supports')) {
      css += `${substitute(selector, variables)} {\n`;
      emitBlock([], body, '  ');
      css += '}\n';
      continue;
    }
    emitBlock([selector], body, '');
  }

  if (!css.trim() && source.trim() && !variables) {
    warnings.push(`não foi possível compilar ${filename}`);
  }
  return { css, warnings };
}

export function compileStyles(source: string, filename: string): StyleResult {
  if (/\.s[ac]ss$/i.test(filename)) {
    try {
      return compileScss(source, filename);
    } catch (error) {
      return {
        css: source,
        warnings: [`falha ao compilar ${filename}: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }
  return { css: source, warnings: [] };
}
