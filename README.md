# Code Mobile

Editor de código mobile-first construído sobre o **Monaco** — o componente de edição de código
aberto que também alimenta o VS Code. Interface própria, desenhada para toque e telas pequenas.

O APK já assinado está em [`CodeMobile.apk`](CodeMobile.apk) (debug signing, instalação por sideload).

## O que está incluído

- **Novo arquivo em duas etapas**: escolha a linguagem primeiro, depois o nome — o editor já abre
  com o realce certo. Inclui JavaScript, TypeScript, **Luau**, Lua, Python, HTML, CSS, JSON,
  Markdown e todas as linguagens registradas no Monaco, com busca por nome ou extensão
- **Luau** com tokenizer próprio: anotações de tipo, genéricos, `continue`, atribuição composta,
  expressões `if/then/else`, interpolação de string, `::`, comentários `--` e `--[[ ]]`
- **Cores oficiais do VS Code**: Dark+ (padrão), Light+ e Alto Contraste, com os tokens extraídos
  de `theme-defaults/themes/*.json` do repositório do VS Code
- Editor Monaco completo: autocomplete, dobra de código, localizar/substituir, formatar documento,
  indentação, comentários e múltiplos cursores
- Explorador de arquivos: criar, renomear, duplicar, excluir e navegar em pastas
- Abas com indicador de alterações não salvas e salvamento automático local
- Paleta de comandos (`>`), abertura rápida de arquivos e busca global com expressões regulares
- Terminal integrado que opera no espaço de trabalho (ls, cd, cat, touch, mkdir, rm, mv, cp,
  grep, wc, tree, code, theme, help)
- **Executa scripts Luau de verdade** (`run arquivo.luau`): o runtime oficial do Luau compilado
  para WebAssembly roda em worker isolado, com saída do `print` no terminal, `arg` para os
  argumentos, limite de memória (32 MB), interrupção de loops infinitos e erros com `arquivo:linha`
- Barra de teclas extras acima do teclado: Tab, setas, Home/End, desfazer/refazer, comentar,
  localizar, salvar e símbolos
- Tamanho de fonte, tabulação, quebra de linha e minimapa ajustáveis
- Linguagem do arquivo trocável pelo botão na barra de status

## Desenvolvimento

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # tsc + vite build
npm run preview    # serve o build de produção
```

## Gerar o APK novamente

O build dispensa Gradle: usa `aapt2`, `javac`, `d8`, `zipalign` e `apksigner` do Android SDK.

Pré-requisitos: JDK 17 e Android SDK com `platforms;android-34` e `build-tools;34.0.0`
(por padrão o script procura em `.toolchain/`, ou use `ANDROID_SDK_ROOT` / `JAVA_HOME`).

```bash
./scripts/build-apk.sh
# saída: CodeMobile.apk
```

A keystore de debug é criada na primeira execução em `android/keystore.jks`. Para publicar na
Play Store, gere uma keystore própria e assine com ela.

## Estrutura

```
src/               app React + Monaco (interface, explorador, terminal, paleta, ajustes)
src/lib/themes.ts  Dark+ / Light+ / Alto Contraste com as cores e tokens do VS Code
src/lib/luau.ts    tokenizer Monarch e configuração da linguagem Luau
src/lib/luauRuntime.ts  execução de scripts Luau (runtime WASM em worker)
android/           shell nativo: WebView que serve o build em http://localhost/ via assets
scripts/           build-apk.sh
public/            manifest, service worker e ícones
```

O APK é um WebView com um `WebViewClient.shouldInterceptRequest` que responde `http://localhost/`
a partir de `assets/www`. Usar uma origem http (e não `file://`) mantém módulos ES, web workers do
Monaco e o service worker funcionando.
