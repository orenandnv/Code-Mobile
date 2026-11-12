// Baixa `?.`, `??` e afins do bundle final para ES2019.
//
// O `build.target` do Vite não pode ir abaixo de es2020 porque o worker do
// @luau-rs/luau usa literais BigInt (ES2020). O WebView do Android 9 (Chrome 66)
// também não entende BigInt, mas esse worker é isolado: se ele falhar, só a
// execução de Lua quebra. O bundle principal precisa parsear, então aqui ele é
// rebaixado arquivo por arquivo, pulando os que contêm BigInt.
//
// IMPORTANTE: `supported: { 'import-meta': true }` é obrigatório. Sem ele o
// esbuild troca `import.meta.url` por `{}.url` (undefined) e o helper de preload
// do Vite passa a chamar `new URL(dep, undefined)` — que lança
// "Failed to construct 'URL': Invalid URL" no carregamento. Chrome 66 já
// entende `import.meta` (desde o 64), então preservar é seguro.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { transform } from 'esbuild';

const dir = new URL('../dist/assets/', import.meta.url);
const files = (await readdir(dir)).filter((name) => name.endsWith('.js'));

let changed = 0;
const skipped = [];

// Literais BigInt (ES2020) também não parseiam no Chrome 66. Os únicos no
// projeto são limites de inteiro 64 bits do bridge do Luau; viram chamadas
// BigInt("..."), que parseiam em qualquer engine (só falham se executadas).
// O worker do Luau usa literais curtos (1n, -1n) além dos limites de 64 bits,
// então a regra precisa cobrir qualquer inteiro — sem tocar em texto dentro de
// strings, por isso a exigência de não vir logo depois de aspas ou identificador.
const BIGINT_LITERAL = /(?<![\w$.'"`])(-?)(\d+)n(?![\w$])/g;

for (const name of files) {
  const path = new URL(name, dir);
  let code = await readFile(path, 'utf8');

  const hasSyntax = code.includes('?.') || code.includes('??');
  const hasBigInt = BIGINT_LITERAL.test(code);
  if (!hasSyntax && !hasBigInt) continue;

  if (hasBigInt) {
    code = code.replace(BIGINT_LITERAL, (_, sign, digits) => `BigInt("${sign}${digits}")`);
  }

  try {
    const result = await transform(code, {
      target: 'es2019',
      loader: 'js',
      minify: true,
      supported: { 'import-meta': true },
    });
    await writeFile(path, result.code);
    changed += 1;
  } catch (error) {
    skipped.push(`${name} (${error.message.split('\n')[0]})`);
  }
}

// Falha ruidosa se o rebaixamento destruiu `import.meta.url` de novo: o app
// quebra no boot e o sintoma (URL inválida) não aponta para cá.
const mainEntry = files.find((name) => name.startsWith('index-'));
if (mainEntry) {
  const built = await readFile(new URL(mainEntry, dir), 'utf8');
  if (built.includes('import.meta') && built.includes('.url')) {
    const broken = /=\{\}\s*,\s*\w+\s*=\s*\w+\.url/.test(built);
    if (broken) throw new Error(`downlevel: import.meta.url foi destruído em ${mainEntry}`);
  }
}

console.log(`downlevel: ${changed} arquivo(s) rebaixado(s)`);
for (const item of skipped) console.log(`downlevel: mantido em es2020 -> ${item}`);
