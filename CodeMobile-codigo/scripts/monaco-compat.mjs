// Compatibilidade do Monaco com o WebView do Android 9 (Chrome 66).
//
// `vs/editor/common/services/findSectionHeaders.js` cria, no topo do módulo,
// `new RegExp('\\bMARK:\\s*(.*)$', 'd')`. O flag `d` (hasIndices) só existe a
// partir do Chrome 90: no 66 a construção lança
// "SyntaxError: Invalid flags supplied to RegExp constructor 'd'" durante o
// import e derruba o bundle inteiro (tela preta).
//
// Aqui o regex é recriado sem o flag e as colunas que o Monaco lia de
// `match.indices` são calculadas a partir de `match.index`. O comportamento é
// idêntico em qualquer engine — em engines novas o patch também é aplicado,
// então não existe caminho divergente entre dev e produção.
const TARGET = 'vs/editor/common/services/findSectionHeaders.js';

export function monacoCompat() {
  return {
    name: 'monaco-chrome66-compat',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes(TARGET)) return null;

      let patched = code.replace("', 'd');", "');");
      patched = patched.replace(
        'const column = match.indices[1][0] + 1;',
        'const groupStart = match.index + (match[0].length - match[1].length);\n        const column = groupStart + 1;',
      );
      patched = patched.replace(
        'const endColumn = match.indices[1][1] + 1;',
        'const endColumn = groupStart + match[1].length + 1;',
      );

      if (patched.includes("'d')") || patched.includes('match.indices')) {
        throw new Error(`monaco-chrome66-compat: patch incompleto em ${id}`);
      }
      return { code: patched, map: null };
    },
  };
}
