# Code Mobile 2.0.0

Editor de código mobile-first para Android, construído sobre o **Monaco** (o motor do VS Code) dentro
de uma WebView nativa com origem `http://localhost/`, para que módulos ES, Web Workers e WebAssembly
funcionem sem servidor externo.

O APK assinado está versionado neste repositório:

- [`Code Mobile.apk`](Code%20Mobile.apk) — 5,0 MB, `versionCode 3`, `versionName 2.0.0`
- [`CodeMobile-codigo/CodeMobile.apk`](CodeMobile-codigo/CodeMobile.apk) — mesmo binário
- SHA-256: `81d7ca97fed3813d078803ec40222f44fecbeecc4931308f0c93eea5b301caa0`
- Assinatura: APK Signature Scheme v2 **e** v3, zipalign 4 OK (minSdk 26 / targetSdk 34)

**WebView exigida:** o app abre e funciona em WebView a partir do Chromium 66 (o do Android 9 de
fábrica), graças à camada de compatibilidade em `public/compat.js`. TypeScript, SQL (`sql.js`) e
Luau dependem de recursos posteriores (transpilação compatível, WebAssembly moderno e Module
Workers); numa WebView antiga o app informa isso no terminal em vez de falhar em silêncio.
Atualize o *Android System WebView* para usá-los no aparelho.

## O que roda de verdade

### No próprio aparelho (sem servidor)

| Recurso | Como executa |
| --- | --- |
| JavaScript / TypeScript / JSX / TSX | Babel (`@babel/standalone`) transpila em CommonJS e um Web Worker executa com `console`, `readLine` (stdin), timeout de 15 s e resolução de módulos relativa entre arquivos do projeto |
| Luau / Lua | runtime oficial `@luau-rs/luau` compilado para WebAssembly, em worker isolado (limite de 32 MB, interrupção de loop infinito, `arg`, `print`) |
| SQL | SQLite real via `sql.js` (WebAssembly), com tabelas formatadas no terminal |
| Shell | `ls`, `cd`, `pwd`, `cat`, `head`, `tail`, `wc`, `tree`, `find`, `grep`, `echo`, `touch`, `mkdir`, `rm`, `mv`, `cp`, `open`, `run`, `clear`, `date`, `uname`, `whoami`, redirecionamentos `>` e `>>` — tudo operando no VFS do projeto |

### Serviço externo (transparente)

Python, Java, Kotlin, C, C++, C#, Go, Rust, Swift, Dart, PHP, Ruby, Zig, Elixir, Erlang, Perl, R,
Scala, Haskell, Clojure e PowerShell usam a API pública **Piston**. A URL é configurável em
*Configurações → Runtimes*; sem URL o app informa em vez de fingir execução. Não há compilador
Android para essas linguagens embutido no APK.

### Apenas edição (realce, autocomplete, indentação, pares)

HTML (com IntelliSense do Monaco), CSS, SCSS/Sass (compilados pelo preview), Vue, Svelte, YAML, JSON,
XML, GraphQL, Markdown, Dockerfile, Makefile, GDScript, CSV e texto. O status bar marca
`LOCAL`/`Piston` só quando existe executor — nada aparece como executável se for apenas sintaxe.

**Limitação conhecida:** arquivos `.vue` e `.svelte` têm realce e edição completos, mas o preview
não compila SFC (não há `@vue/compiler-sfc`/`svelte` embutidos). React/JSX/TSX, TS e SCSS funcionam.

## Preview web

- HTML + CSS + JS + TS/JSX/TSX + SCSS em múltiplos arquivos, com resolução de `import`/`require`
  relativa e CSS `@import`.
- React 18 UMD embutido (entra no bundle só quando o projeto importa React) — funciona offline.
- Auto-reload ao digitar, recarregar manual, console embutido com `console.*`, erros de runtime e
  promessas rejeitadas, navegação entre páginas do projeto, tela cheia e tamanhos Celular/Tablet/Desktop.
- Executa em iframe `sandbox` sem `allow-same-origin`, isolado do armazenamento do app.

## Interface e ferramentas

- Monaco: autocomplete, IntelliSense, dobra de código, minimapa, multi-cursor, localizar/substituir
  com regex, ir para linha, formatar, comentar, indentação, undo/redo.
- Abas com indicador de alteração pendente; barra de teclas extras (Tab, setas, símbolos, desfazer,
  comentar, buscar, salvar, tamanho da fonte).
- Explorador com criar/renomear/duplicar/excluir arquivos e pastas, importar/exportar `.zip`,
  múltiplos projetos, busca global e paleta de comandos.
- Terminal com múltiplas sessões, histórico, stdin, interrupção e saída dos runtimes.
- Painel Git (GitHub REST): alterações, diff por linha, histórico de commits e push.
- Temas VS Code Dark+/Light+/Alto Contraste, intensidade de realce, fonte, tabulação, quebra de linha.
- i18n com 10 idiomas (pt-BR, en, es, fr, de, it, ja, zh-CN, ko, ru), detecção do sistema na primeira
  abertura, troca imediata sem reiniciar e preferência persistida.
- Salvamento automático: a cada 5 minutos (configurável), 2,2 s após a digitação parar e 350 ms
  quando a edição fecha uma estrutura (`end`, `}`, `</...>`); snapshot de recuperação gravado a cada
  1,2 s permite restaurar abas, arquivo ativo e buffers após fechamento inesperado.

## Estrutura

```
CodeMobile-codigo/
├── android/                 projeto Android (manifest, resources, MainActivity, build script)
├── public/                  ícones e manifesto web
├── scripts/build-apk.sh     build sem Gradle: aapt2 → javac → d8 → zipalign → apksigner
└── src/
    ├── core/                armazenamento (IndexedDB + fallback) e configurações
    ├── workspace/           VFS, projetos e conteúdo inicial
    ├── editor/              registro de linguagens e setup do Monaco
    ├── runtimes/            web (Babel/worker), Luau/WASM, SQL/WASM, shell, Piston
    ├── preview/             bundler do preview, compilador SCSS, React UMD vendorizado
    ├── features/            autosave/recuperação, zip, GitHub/Git
    ├── i18n/                10 dicionários + provider
    ├── components/          editor, explorador, terminal, preview, configurações, git, diálogos
    ├── App.tsx              orquestração de estado e comandos
    └── styles/              identidade visual existente + estilos novos
```

## Desenvolvimento

```bash
cd CodeMobile-codigo
npm install --legacy-peer-deps   # peer typescript@^6 do @luau-rs/luau
npm run dev                      # http://localhost:3000
npm run typecheck
npm run build                    # tsc --noEmit + vite build
```

## Gerar o APK

Requer JDK 17 e Android SDK (platform 34, build-tools 34.0.0):

```bash
cd CodeMobile-codigo
ANDROID_SDK_ROOT=/caminho/sdk JAVA_HOME=/caminho/jdk-17 bash scripts/build-apk.sh
# saída: CodeMobile.apk (assinado v2/v3 com a keystore do projeto)
```

O `build-apk.sh` compila a web app, copia `dist/` para `android/assets/www`, compila recursos com
`aapt2`, monta o dex com `d8`, alinha e assina. O `AndroidManifest.xml` declara `versionCode` e
`versionName` usados no nome do pacote.

## Testes desta versão

Executados no navegador cloud com o app real (dev server + build de produção) e no APK montado:
boot sem splash presa, troca de idioma em tempo real, execução JS/TS (stdout e stderr), Luau (fib 1–10
e soma 108), SQL (tabela formatada), shell (`ls`, `wc`, `cat`, redirecionamento), preview HTML/CSS/JS e
preview React, criar pasta/arquivo pelo shell, APK assinado v2/v3 e alinhado. O relatório completo,
com aprovados/reprovados e percentual, está no histórico do projeto e no resumo da entrega.
