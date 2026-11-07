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
- **Execução local de Luau**: runtime oficial compilado para WebAssembly em worker isolado, com saída do `print`, argumentos e interrupção de execução
- **Execução multilíngue**: JavaScript, TypeScript, Python, Ruby, Rust, Go, Java, Kotlin, Swift, C, C++, C#, PHP, Shell, Lua, Dart, Perl, R, PowerShell, SQL, Zig e Elixir via servidor Piston compatível configurado pelo usuário
- **Novas linguagens de edição**: GDScript, Zig e Elixir, com extensões, realce de sintaxe e configuração do Monaco
- Barra de teclas extras acima do teclado: Tab, setas, Home/End, desfazer/refazer, comentar,
  localizar, salvar e símbolos
- Tamanho de fonte, tabulação, quebra de linha e minimapa ajustáveis
- Linguagem do arquivo trocável pelo botão na barra de status

## Execução de outras linguagens

Luau continua sendo executado localmente no WebAssembly. Para as demais linguagens compiladas ou interpretadas, o aplicativo usa um servidor Piston compatível, que executa cada envio em sandbox. O código-fonte é enviado ao servidor configurado; não envie segredos ou código privado a servidores que você não controla.

O Piston público oficial exige autorização desde 15/02/2026. Para manter o projeto independente, hospede sua própria instância. Consulte a documentação oficial: https://github.com/engineer-man/piston

Em uma máquina Linux com Docker, a instalação mínima documentada pelo Piston é:

```bash
docker run --privileged -v "$PWD:/piston" -dit -p 2000:2000 --name piston_api ghcr.io/engineer-man/piston
```

A API inicia sem runtimes de linguagem. Instale os pacotes desejados conforme a documentação do Piston. Publique a API somente atrás de HTTPS e com controles de acesso adequados; não exponha uma instância de execução de código irrestritamente à internet.

No Code Mobile, configure o endereço HTTPS da API (incluindo `/api/v2`) no terminal:

```text
runtime endpoint https://SEU-SERVIDOR/api/v2
runtime status
run arquivo.py
```

Para remover o endereço salvo, use `runtime endpoint` sem URL. A configuração fica no armazenamento local do navegador/WebView.

**Limites de formato:** HTML, CSS/SCSS, JSON, Markdown, YAML, XML, GraphQL, INI, Dockerfile e Makefile são formatos de marcação, dados ou configuração, não programas autônomos. Eles precisam de preview, validação ou de uma ferramenta de build própria. GDScript já tem edição e realce; para executar scripts GDScript é necessário instalar um runtime compatível adicional no servidor, pois ele não faz parte da lista padrão do Piston.

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
src/lib/luauRuntime.ts  execução local de scripts Luau (runtime WASM em worker)
src/lib/codeRuntime.ts  despacho para runtimes locais e servidor Piston
src/lib/extraLanguages.ts  tokenizers de GDScript, Zig e Elixir
android/           shell nativo: WebView que serve o build em http://localhost/ via assets
scripts/           build-apk.sh
public/            manifest, service worker e ícones
```

O APK é um WebView com um `WebViewClient.shouldInterceptRequest` que responde `http://localhost/`
a partir de `assets/www`. Usar uma origem http (e não `file://`) mantém módulos ES, web workers do
Monaco e o service worker funcionando.
