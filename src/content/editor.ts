import type { ContentKind } from "./schemas";

import "jsoneditor/dist/jsoneditor.css";

import JSONEditor from "jsoneditor";

import { getDebugFlags, setDebugFlags } from "../game/systems/DebugFlags";
import { parseJsonWithLocation } from "./parseJson";
import { CONTENT_KINDS, contentSchemas } from "./schemas";

interface ContentTreeNode {
  children?: ContentTreeNode[];
  name: string;
  path: string;
  type: "dir" | "file";
}

interface ContentRegistryResponse {
  errors: { kind: string; message: string; path: string }[];
  registry: {
    levelsById: Record<string, { hazards?: { type: string }[]; id: string; shopRules?: unknown; waves: { id: string }[]; winCondition: { kind: string } }>;
  };
}

const getKindForPath = (filePath: string): ContentKind | null => {
  const [kind] = filePath.split("/");
  if (!kind) return null;
  return CONTENT_KINDS.includes(kind as ContentKind) ? (kind as ContentKind) : null;
};

const debounce = (callback: () => void, delayMs: number): (() => void) => {
  let handle = 0;
  return (): void => {
    window.clearTimeout(handle);
    handle = window.setTimeout(callback, delayMs);
  };
};

export const initContentEditor = (): void => {
  document.body.classList.add("content-editor-mode");
  const root = document.createElement("div");
  root.className = "content-editor";
  root.innerHTML = `
    <aside class="content-editor__sidebar">
      <div class="content-editor__title">Content</div>
      <div class="content-editor__tree"></div>
    </aside>
    <main class="content-editor__main">
      <div class="content-editor__toolbar">
        <div class="content-editor__file">No file selected</div>
        <div class="content-editor__actions">
          <button class="content-editor__button" data-action="save" disabled>Save</button>
          <button class="content-editor__button" data-action="play" disabled>Play Level</button>
          <button class="content-editor__button" data-action="restart" disabled>Restart Level</button>
        </div>
      </div>
      <div class="content-editor__editor"></div>
      <div class="content-editor__panels">
        <section class="content-editor__panel">
          <div class="content-editor__panel-title">Validation</div>
          <div class="content-editor__panel-body" data-panel="validation"></div>
        </section>
        <section class="content-editor__panel">
          <div class="content-editor__panel-title">Preview</div>
          <div class="content-editor__panel-body" data-panel="preview"></div>
        </section>
        <section class="content-editor__panel">
          <div class="content-editor__panel-title">Debug</div>
          <div class="content-editor__panel-body content-editor__debug">
            <label>
              <input type="checkbox" data-debug="hazards" />
              Hazard bounds
            </label>
            <label>
              <input type="checkbox" data-debug="spawns" />
              Spawn points
            </label>
          </div>
        </section>
      </div>
    </main>
  `;
  document.body.appendChild(root);

  const treeContainer = root.querySelector<HTMLDivElement>(".content-editor__tree")!;
  const editorContainer = root.querySelector<HTMLDivElement>(".content-editor__editor")!;
  const validationPanel = root.querySelector<HTMLDivElement>('[data-panel="validation"]')!;
  const previewPanel = root.querySelector<HTMLDivElement>('[data-panel="preview"]')!;
  const fileLabel = root.querySelector<HTMLDivElement>(".content-editor__file")!;
  const saveButton = root.querySelector<HTMLButtonElement>('[data-action="save"]')!;
  const playButton = root.querySelector<HTMLButtonElement>('[data-action="play"]')!;
  const restartButton = root.querySelector<HTMLButtonElement>('[data-action="restart"]')!;
  const hazardToggle = root.querySelector<HTMLInputElement>('[data-debug="hazards"]')!;
  const spawnToggle = root.querySelector<HTMLInputElement>('[data-debug="spawns"]')!;

  const editor = new JSONEditor(editorContainer, {
    mainMenuBar: false,
    mode: "code",
    onChangeText: () => scheduleValidate(),
    statusBar: false,
  });

  let currentPath: null | string = null;
  let currentText = "";
  let currentLevelId: null | string = null;
  let registryCache: ContentRegistryResponse | null = null;

  const syncDebugToggles = (): void => {
    const flags = getDebugFlags();
    hazardToggle.checked = flags.showHazardBounds;
    spawnToggle.checked = flags.showSpawnPoints;
  };

  const renderValidation = (lines: string[]): void => {
    if (!lines.length) {
      validationPanel.textContent = "No issues.";
      return;
    }
    const list = document.createElement("ul");
    for (const line of lines) {
      const item = document.createElement("li");
      item.textContent = line;
      list.appendChild(item);
    }
    validationPanel.replaceChildren(list);
  };

  const renderPreview = (): void => {
    if (!currentLevelId) {
      previewPanel.textContent = "Open a level to preview details.";
      return;
    }
    if (!registryCache) {
      previewPanel.textContent = "Preview unavailable.";
      return;
    }
    const level = registryCache.registry.levelsById[currentLevelId];
    if (!level) {
      previewPanel.textContent = `Level not found in registry: ${currentLevelId}`;
      return;
    }
    const lines = [
      `Waves: ${level.waves.length}`,
      `Hazards: ${level.hazards?.length ?? 0}`,
      `Win: ${level.winCondition.kind}`,
    ];
    previewPanel.textContent = lines.join("\n");
  };

  const refreshRegistry = async (): Promise<void> => {
    try {
      const response = await fetch("/__content/registry");
      if (!response.ok) return;
      registryCache = (await response.json()) as ContentRegistryResponse;
      renderPreview();
    } catch {
      registryCache = null;
    }
  };

  const validateCurrent = (): void => {
    currentLevelId = null;
    if (!currentPath) {
      renderValidation(["No file selected."]);
      playButton.disabled = true;
      restartButton.disabled = true;
      return;
    }
    const kind = getKindForPath(currentPath);
    if (!kind) {
      renderValidation(["Unknown content kind."]);
      playButton.disabled = true;
      restartButton.disabled = true;
      return;
    }
    const parsed = parseJsonWithLocation(currentText);
    if (parsed.error) {
      renderValidation([
        `${parsed.error.message} (line ${parsed.error.line}, col ${parsed.error.column})`,
      ]);
      playButton.disabled = true;
      restartButton.disabled = true;
      return;
    }

    const schema = contentSchemas[kind];
    const result = schema.safeParse(parsed.data);
    if (!result.success) {
      renderValidation(
        result.error.issues.map(
          (issue) => `${issue.path.join(".") || "root"}: ${issue.message}`,
        ),
      );
      playButton.disabled = true;
      restartButton.disabled = true;
      return;
    }

    renderValidation(["Valid."]);

    if (kind === "levels") {
      currentLevelId = result.data.id;
      playButton.disabled = false;
      restartButton.disabled = false;
      void refreshRegistry();
    } else {
      playButton.disabled = true;
      restartButton.disabled = true;
    }
  };

  const scheduleValidate = debounce(validateCurrent, 250);

  const openFile = async (path: string): Promise<void> => {
    const response = await fetch(`/__content/read?path=${encodeURIComponent(path)}`);
    if (!response.ok) {
      renderValidation([`Failed to load ${path}.`]);
      return;
    }
    const payload = (await response.json()) as { contents: string };
    currentPath = path;
    currentText = payload.contents;
    fileLabel.textContent = path;
    saveButton.disabled = false;
    editor.setText(payload.contents);
    validateCurrent();
  };

  const buildTree = (nodes: ContentTreeNode[], depth = 0): void => {
    for (const node of nodes) {
      const row = document.createElement("div");
      row.className = "content-editor__tree-row";
      row.style.paddingLeft = `${depth * 12}px`;
      row.textContent = node.name;
      if (node.type === "file") {
        row.classList.add("is-file");
        row.addEventListener("click", () => void openFile(node.path));
      }
      treeContainer.appendChild(row);
      if (node.type === "dir" && node.children?.length) {
        buildTree(node.children, depth + 1);
      }
    }
  };

  const loadTree = async (): Promise<void> => {
    const response = await fetch("/__content/list");
    if (!response.ok) return;
    const payload = (await response.json()) as { tree: ContentTreeNode[] };
    treeContainer.innerHTML = "";
    buildTree(payload.tree);
  };

  const handleSave = async (): Promise<void> => {
    if (!currentPath) return;
    const contents = editor.getText();
    currentText = contents;
    const response = await fetch("/__content/write", {
      body: JSON.stringify({ contents, path: currentPath }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      renderValidation([`Failed to save ${currentPath}.`]);
      return;
    }
    validateCurrent();
  };

  saveButton.addEventListener("click", () => void handleSave());

  const navigateToLevel = (): void => {
    if (!currentLevelId) return;
    window.location.assign(`/?level=${encodeURIComponent(currentLevelId)}`);
  };

  playButton.addEventListener("click", navigateToLevel);
  restartButton.addEventListener("click", navigateToLevel);

  const handleDebugChange = (): void => {
    setDebugFlags({
      showHazardBounds: hazardToggle.checked,
      showSpawnPoints: spawnToggle.checked,
    });
  };

  hazardToggle.addEventListener("change", handleDebugChange);
  spawnToggle.addEventListener("change", handleDebugChange);

  void loadTree();
  syncDebugToggles();
  renderValidation(["Select a file to begin."]);
  renderPreview();
};
