import type * as monaco from "monaco-editor";

export const CONTENT_EDITOR_MONACO_THEME = "shmupinc-dark";

export const configureContentEditorTheme = (monacoApi: typeof monaco): void => {
  monacoApi.editor.defineTheme(CONTENT_EDITOR_MONACO_THEME, {
    base: "vs-dark",
    colors: {
      "editor.background": "#050b14",
      "editor.foreground": "#d7e4f7",
      "editor.inactiveSelectionBackground": "#1a2c4a66",
      "editor.lineHighlightBackground": "#0b1628",
      "editor.selectionBackground": "#25406f66",
      "editorCursor.foreground": "#7df9ff",
      "editorIndentGuide.activeBackground1": "#2a3f60",
      "editorIndentGuide.background1": "#1a273c",
      "editorLineNumber.activeForeground": "#a5bcdf",
      "editorLineNumber.foreground": "#5b6f90",
      "editorWhitespace.foreground": "#22314a",
      "editorWidget.background": "#08101c",
      "editorWidget.border": "#1f3452",
    },
    inherit: true,
    rules: [
      { foreground: "6ea6ff", token: "property" },
      { foreground: "7df9ff", token: "string.key.json" },
      { foreground: "9fb7ff", token: "number" },
      { foreground: "ffd37a", token: "string.value.json" },
      { foreground: "8fa6c7", token: "delimiter" },
      { foreground: "4c5d78", token: "comment" },
    ],
  });
};
