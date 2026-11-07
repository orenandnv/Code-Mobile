import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import { THEME_DEFINITIONS } from './lib/themes';
import { LUAU_ID, luauConfiguration, luauLanguage, luauMonarch } from './lib/luau';

const globalScope = self as unknown as {
  MonacoEnvironment?: { getWorker: (moduleId: string, label: string) => Worker };
};

globalScope.MonacoEnvironment = {
  getWorker(_moduleId: string, label: string) {
    switch (label) {
      case 'json':
        return new JsonWorker();
      case 'css':
      case 'scss':
      case 'less':
        return new CssWorker();
      case 'html':
      case 'handlebars':
      case 'razor':
        return new HtmlWorker();
      case 'typescript':
      case 'javascript':
        return new TsWorker();
      default:
        return new EditorWorker();
    }
  },
};

// Disable the diagnostics that require a full project setup; keeps mobile light and avoids
// false positives inside a virtual workspace.
monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: true,
  noSyntaxValidation: false,
});
monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: true,
  noSyntaxValidation: false,
});

// Luau: register before any model requests the language.
monaco.languages.register(luauLanguage);
monaco.languages.setMonarchTokensProvider(
  LUAU_ID,
  luauMonarch as unknown as Parameters<typeof monaco.languages.setMonarchTokensProvider>[1],
);
monaco.languages.setLanguageConfiguration(LUAU_ID, luauConfiguration);

// VS Code's own default themes (Dark+, Light+, High Contrast Black).
THEME_DEFINITIONS.forEach((definition) => {
  monaco.editor.defineTheme(definition.monacoName, definition.data);
});

export default monaco;
