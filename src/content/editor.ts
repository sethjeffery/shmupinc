import type { EnemyDef } from "../game/data/enemies";
import type { GunDefinition } from "../game/data/gunTypes";
import type { ShipDefinition } from "../game/data/shipTypes";
import type { WaveDefinition } from "../game/data/waves";
import type { WeaponDefinition } from "../game/data/weaponTypes";
import type {
  ContentKind,
  EnemyContent,
  GunContent,
  ShipContent,
  WeaponContent,
} from "./schemas";
import type { ContentRegistry } from "./validation";

import "monaco-editor/esm/vs/editor/editor.main.js";

import {
  applyEdits,
  findNodeAtOffset,
  findNodeAtLocation,
  getNodePath,
  getNodeValue,
  modify,
  parseTree,
} from "jsonc-parser";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import Phaser from "phaser";

import { drawEnemyToCanvas } from "../game/render/enemyShapes";
import { drawGunToCanvas } from "../game/render/gunShapes";
import { drawShipToCanvas } from "../game/render/shipShapes";
import { ContentPreviewScene } from "../game/scenes/ContentPreviewScene";
import { getDebugFlags, setDebugFlags } from "../game/systems/DebugFlags";
import {
  PLAYFIELD_BASE_HEIGHT,
  PLAYFIELD_BASE_WIDTH,
} from "../game/util/playArea";
import { buildJsonSchemaForKind } from "./jsonSchema";
import { parseJsonWithLocation } from "./parseJson";
import { buildSchemaExplorer } from "./schemaExplorer";
import { CONTENT_KINDS, contentSchemas } from "./schemas";
import { buildContentRegistry } from "./validation";

interface ContentTreeNode {
  children?: ContentTreeNode[];
  name: string;
  path: string;
  type: "dir" | "file";
}

interface ContentRegistryResponse {
  errors: { kind: string; message: string; path: string }[];
  registry: ContentRegistry;
}

type ReferencePickerMode = "array" | "single";

type GunPreviewZone = "front" | "rear" | "side";

interface ReferencePicker {
  contentKind: ContentKind;
  key: string;
  label: string;
  mode: ReferencePickerMode;
  registryKey: keyof ContentRegistry;
}

const REFERENCE_PICKERS: ReferencePicker[] = [
  {
    contentKind: "waves",
    key: "waveIds",
    label: "Wave",
    mode: "array",
    registryKey: "wavesById",
  },
  {
    contentKind: "hazards",
    key: "hazardIds",
    label: "Hazard",
    mode: "array",
    registryKey: "hazardsById",
  },
  {
    contentKind: "shops",
    key: "shopId",
    label: "Shop",
    mode: "single",
    registryKey: "shopsById",
  },
  {
    contentKind: "beats",
    key: "preBeatId",
    label: "Pre-beat",
    mode: "single",
    registryKey: "beatsById",
  },
  {
    contentKind: "beats",
    key: "postBeatId",
    label: "Post-beat",
    mode: "single",
    registryKey: "beatsById",
  },
  {
    contentKind: "guns",
    key: "gunId",
    label: "Gun",
    mode: "single",
    registryKey: "gunsById",
  },
];

const getKindForPath = (filePath: string): ContentKind | null => {
  const [kind] = filePath.split("/");
  if (!kind) return null;
  return CONTENT_KINDS.includes(kind as ContentKind)
    ? (kind as ContentKind)
    : null;
};

const debounce = (callback: () => void, delayMs: number): (() => void) => {
  let handle = 0;
  return (): void => {
    window.clearTimeout(handle);
    handle = window.setTimeout(callback, delayMs);
  };
};

const registerSnippetProvider = (): void => {
  monaco.languages.registerCompletionItemProvider("json", {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        endColumn: word.endColumn,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        startLineNumber: position.lineNumber,
      };

      const items: monaco.languages.CompletionItem[] = [];

      items.push({
        detail: "Hazard",
        insertText: [
          "{",
          '  "id": "$1",',
          '  "type": "laneWall",',
          '  "rect": { "x": 0.1, "y": 0.5, "w": 0.2, "h": 0.9 },',
          '  "motion": { "kind": "sine", "axis": "x", "amplitude": 0.1, "periodMs": 12000, "phase": 0 },',
          '  "damageOnTouch": true,',
          '  "fillColor": "#0b1220",',
          '  "lineColor": "#1b3149"',
          "}",
        ].join("\n"),
        insertTextRules:
          monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        kind: monaco.languages.CompletionItemKind.Snippet,
        label: "Insert laneWall",
        range,
      });

      items.push({
        detail: "Wave",
        insertText: [
          "{",
          '  "atMs": 0,',
          '  "enemyId": "$1",',
          '  "x": 0.5,',
          '  "y": -0.1',
          "}",
        ].join("\n"),
        insertTextRules:
          monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        kind: monaco.languages.CompletionItemKind.Snippet,
        label: "Insert spawn",
        range,
      });

      items.push({
        detail: "Level",
        insertText: [
          "{",
          '  "kind": "survive",',
          '  "durationMs": 45000',
          "}",
        ].join("\n"),
        insertTextRules:
          monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        kind: monaco.languages.CompletionItemKind.Snippet,
        label: "Insert winCondition: survive",
        range,
      });

      return { suggestions: items };
    },
  });
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
        <div class="content-editor__toolbar-right">
          <div class="content-editor__status" data-status="validation" title="Waiting for validation.">
            <span aria-hidden="true">●</span>
          </div>
          <div class="content-editor__actions">
            <button class="content-editor__button" data-action="save" type="button" disabled>Save</button>
            <button class="content-editor__button" data-action="play" type="button" disabled>Play Level</button>
            <button class="content-editor__button" data-action="restart" type="button" disabled>Restart Level</button>
          </div>
        </div>
      </div>
      <div class="content-editor__body">
        <div class="content-editor__editor"></div>
        <div class="content-editor__side">
          <section class="content-editor__panel">
            <div class="content-editor__panel-title">Preview</div>
            <div class="content-editor__panel-body" data-panel="preview">
            <div class="content-editor__preview-text" data-preview="text"></div>
            <div class="content-editor__preview-tabs" data-preview="tabs"></div>
            <div class="content-editor__preview-canvas" data-preview="canvas"></div>
            </div>
          </section>
          <section class="content-editor__panel content-editor__panel--schema">
            <div class="content-editor__panel-title">Schema</div>
            <div class="content-editor__panel-body content-editor__schema" data-panel="schema"></div>
          </section>
          <section class="content-editor__panel">
            <div class="content-editor__panel-title">References</div>
            <div class="content-editor__panel-body content-editor__references" data-panel="references"></div>
          </section>
          <section class="content-editor__panel content-editor__panel--bezier">
            <div class="content-editor__panel-title">Bezier</div>
            <div class="content-editor__panel-body content-editor__bezier" data-panel="bezier">
              <div class="content-editor__bezier-stage">
                <canvas class="content-editor__bezier-canvas"></canvas>
              </div>
              <div class="content-editor__bezier-info" data-bezier="info"></div>
            </div>
          </section>
          <section class="content-editor__panel">
            <div class="content-editor__panel-title">Debug</div>
            <div class="content-editor__panel-body content-editor__debug">
              <label>
                <input type="checkbox" data-debug="hazards" />
                <span>Hazard bounds</span>
              </label>
              <label>
                <input type="checkbox" data-debug="spawns" />
                <span>Spawn points</span>
              </label>
            </div>
          </section>
        </div>
      </div>
    </main>
  `;
  document.body.appendChild(root);

  const treeContainer = root.querySelector<HTMLDivElement>(
    ".content-editor__tree",
  )!;
  const editorContainer = root.querySelector<HTMLDivElement>(
    ".content-editor__editor",
  )!;
  const validationStatus = root.querySelector<HTMLDivElement>(
    '[data-status="validation"]',
  )!;
  const schemaPanel = root.querySelector<HTMLDivElement>(
    '[data-panel="schema"]',
  )!;
  const referencePanel = root.querySelector<HTMLDivElement>(
    '[data-panel="references"]',
  )!;
  const referenceSection = referencePanel.closest<HTMLElement>(
    ".content-editor__panel",
  )!;
  const bezierPanel = root.querySelector<HTMLDivElement>(
    '[data-panel="bezier"]',
  )!;
  const bezierSection = bezierPanel.closest<HTMLElement>(
    ".content-editor__panel",
  )!;
  const bezierCanvas = bezierPanel.querySelector<HTMLCanvasElement>(
    ".content-editor__bezier-canvas",
  )!;
  const bezierInfo = bezierPanel.querySelector<HTMLDivElement>(
    '[data-bezier="info"]',
  )!;
  const bezierStage = bezierPanel.querySelector<HTMLDivElement>(
    ".content-editor__bezier-stage",
  )!;
  const previewPanel = root.querySelector<HTMLDivElement>(
    '[data-panel="preview"]',
  )!;
  const previewText = previewPanel.querySelector<HTMLDivElement>(
    '[data-preview="text"]',
  )!;
  const previewCanvasHost = previewPanel.querySelector<HTMLDivElement>(
    '[data-preview="canvas"]',
  )!;
  const previewTabs = previewPanel.querySelector<HTMLDivElement>(
    '[data-preview="tabs"]',
  )!;
  const previewSection = previewPanel.closest<HTMLElement>(
    ".content-editor__panel",
  )!;
  const fileLabel = root.querySelector<HTMLDivElement>(
    ".content-editor__file",
  )!;
  const saveButton = root.querySelector<HTMLButtonElement>(
    '[data-action="save"]',
  )!;
  const playButton = root.querySelector<HTMLButtonElement>(
    '[data-action="play"]',
  )!;
  const restartButton = root.querySelector<HTMLButtonElement>(
    '[data-action="restart"]',
  )!;
  const hazardToggle = root.querySelector<HTMLInputElement>(
    '[data-debug="hazards"]',
  )!;
  const spawnToggle = root.querySelector<HTMLInputElement>(
    '[data-debug="spawns"]',
  )!;

  (
    self as {
      MonacoEnvironment?: {
        getWorker: (moduleId: string, label: string) => Worker;
      };
    }
  ).MonacoEnvironment = {
    getWorker: (_moduleId: string, label: string) => {
      if (label === "json") {
        return new JsonWorker();
      }
      return new EditorWorker();
    },
  };

  const modelUri = monaco.Uri.parse("inmemory://model/content.json");
  const model = monaco.editor.createModel("", "json", modelUri);
  const editor = monaco.editor.create(editorContainer, {
    automaticLayout: true,
    fontSize: 13,
    inlineSuggest: { enabled: true },
    minimap: { enabled: false },
    model,
    scrollBeyondLastLine: false,
    tabSize: 2,
  });

  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    allowComments: true,
    enableSchemaRequest: false,
    schemas: [],
    validate: true,
  });

  registerSnippetProvider();

  let currentPath: null | string = null;
  let currentText = "";
  let originalText = "";
  let currentLevelId: null | string = null;
  let currentEnemyDef: EnemyDef | null = null;
  let currentWaveDef: null | WaveDefinition = null;
  let currentWeaponDef: null | WeaponDefinition = null;
  let currentGunDef: GunDefinition | null = null;
  let currentShipDef: null | ShipDefinition = null;
  let currentKind: ContentKind | null = null;
  let registryCache: ContentRegistryResponse | null = null;
  let lastReferencePath: (number | string)[] | null = null;
  let contentPathIndex = new Map<string, string>();
  let lastBezierPath: (number | string)[] | null = null;
  let bezierActive = false;
  let bezierState: {
    points: { x: number; y: number }[];
    pointsPath: (number | string)[];
  } | null = null;
  const bezierAnchor = "spawn" as const;
  let draggingPointIndex: null | number = null;
  let draggingPointerId: null | number = null;
  let previewGame: null | Phaser.Game = null;
  let previewScene: ContentPreviewScene | null = null;
  let previewResizeObserver: null | ResizeObserver = null;
  let gunPreviewCanvas: HTMLCanvasElement | null = null;
  let shipPreviewCanvas: HTMLCanvasElement | null = null;
  let enemyPreviewCanvas: HTMLCanvasElement | null = null;
  let currentWeaponZone: GunPreviewZone = "front";
  const loadTree = async (): Promise<void> => {
    const response = await fetch("/__content/list");
    if (!response.ok) return;
    const payload = (await response.json()) as { tree: ContentTreeNode[] };
    treeContainer.innerHTML = "";
    buildTree(payload.tree);
    contentPathIndex = buildContentIndex(payload.tree);
  };

  const playfieldAspect = `${PLAYFIELD_BASE_WIDTH} / ${PLAYFIELD_BASE_HEIGHT}`;
  bezierStage.style.aspectRatio = playfieldAspect;
  previewCanvasHost.style.aspectRatio = playfieldAspect;

  const setPreviewAspect = (aspect: string): void => {
    previewCanvasHost.style.aspectRatio = aspect;
  };

  const hasUnsavedChanges = (): boolean =>
    Boolean(currentPath) && currentText !== originalText;

  const updateDirtyState = (): void => {
    saveButton.disabled = !hasUnsavedChanges();
  };

  const setLevelButtonsEnabled = (enabled: boolean): void => {
    playButton.disabled = !enabled;
    restartButton.disabled = !enabled;
  };

  const setPanelVisible = (section: HTMLElement, visible: boolean): void => {
    section.style.display = visible ? "" : "none";
  };

  const syncDebugToggles = (): void => {
    const flags = getDebugFlags();
    hazardToggle.checked = flags.showHazardBounds;
    spawnToggle.checked = flags.showSpawnPoints;
  };

  const renderValidation = (lines: string[]): void => {
    const message = lines.length ? lines.join("\n") : "No issues.";
    validationStatus.title = message;
    validationStatus.classList.remove("is-valid", "is-invalid", "is-neutral");
    if (!currentPath) {
      validationStatus.classList.add("is-neutral");
      validationStatus.textContent = "●";
      return;
    }
    if (!lines.length || (lines.length === 1 && lines[0] === "Valid.")) {
      validationStatus.classList.add("is-valid");
      validationStatus.textContent = "✓";
      return;
    }
    validationStatus.classList.add("is-invalid");
    validationStatus.textContent = "✕";
  };

  const renderSchemaDocs = (kind: ContentKind | null): void => {
    if (!kind) {
      schemaPanel.textContent = "Open a content file to see its schema.";
      return;
    }
    const docs = buildSchemaExplorer(contentSchemas[kind]);
    if (!docs.length) {
      schemaPanel.textContent = "No schema info available.";
      return;
    }
    const list = document.createElement("div");
    list.className = "content-editor__schema-list";
    for (const doc of docs) {
      const row = document.createElement("div");
      row.className = "content-editor__schema-row";

      const label = document.createElement("div");
      label.className = "content-editor__schema-label";
      label.textContent = `${doc.path} : ${doc.type}`;

      const desc = document.createElement("div");
      desc.className = "content-editor__schema-desc";
      const description = doc.description ?? "No description.";
      if (doc.defaultValue !== undefined) {
        desc.textContent = `${description} (default: ${doc.defaultValue})`;
      } else {
        desc.textContent = description;
      }

      row.append(label, desc);
      list.appendChild(row);
    }
    schemaPanel.replaceChildren(list);
  };

  const getCursorPath = (): (number | string)[] | null => {
    const position = editor.getPosition();
    if (!position) return null;
    const offset = model.getOffsetAt(position);
    const tree = parseTree(currentText);
    if (!tree) return null;
    const node = findNodeAtOffset(tree, offset);
    if (!node) return null;
    return getNodePath(node);
  };

  const getActiveReferencePath = (): (number | string)[] | null => {
    const path = getCursorPath();
    if (!path) return lastReferencePath;
    const picker = getReferencePicker(path);
    if (picker) {
      lastReferencePath = path;
      return path;
    }
    return lastReferencePath;
  };

  const getReferencePicker = (
    path: (number | string)[] | null,
  ): null | ReferencePicker => {
    if (!path?.length) return null;
    const key = path[0];
    if (typeof key !== "string") return null;
    return REFERENCE_PICKERS.find((picker) => picker.key === key) ?? null;
  };

  const isPathWithin = (
    path: (number | string)[] | null,
    prefix: (number | string)[] | null,
  ): boolean => {
    if (!path || !prefix || path.length < prefix.length) return false;
    return prefix.every((segment, index) => path[index] === segment);
  };

  const getObjectPropertyValue = (
    node: ReturnType<typeof parseTree>,
    key: string,
  ): null | ReturnType<typeof parseTree> => {
    if (node?.type !== "object") return null;
    for (const child of node.children ?? []) {
      if (child.type !== "property") continue;
      const keyNode = child.children?.[0];
      if (keyNode?.value !== key) continue;
      return child.children?.[1] ?? null;
    }
    return null;
  };

  const isPoint = (value: unknown): value is { x: number; y: number } => {
    if (!value || typeof value !== "object") return false;
    const record = value as { x?: unknown; y?: unknown };
    return typeof record.x === "number" && typeof record.y === "number";
  };

  const findBezierContext = (): {
    points: { x: number; y: number }[];
    pointsPath: (number | string)[];
  } | null => {
    const position = editor.getPosition();
    if (!position) return null;
    const offset = model.getOffsetAt(position);
    const tree = parseTree(currentText);
    if (!tree) return null;
    let node = findNodeAtOffset(tree, offset);
    while (node) {
      if (node.type === "object") {
        const kindNode = getObjectPropertyValue(node, "kind");
        if (kindNode && getNodeValue(kindNode) === "bezier") {
          const pointsNode = getObjectPropertyValue(node, "points");
          if (pointsNode?.type !== "array") return null;
          const points = getNodeValue(pointsNode) as unknown;
          if (Array.isArray(points) && points.every(isPoint)) {
            return {
              points: points.map((point) => ({
                x: point.x,
                y: point.y,
              })),
              pointsPath: getNodePath(pointsNode),
            };
          }
          return null;
        }
      }
      node = node.parent;
    }
    return null;
  };

  const resolveBezierAtPath = (
    pointsPath: (number | string)[] | null,
  ): {
    points: { x: number; y: number }[];
    pointsPath: (number | string)[];
  } | null => {
    if (!pointsPath?.length) return null;
    const tree = parseTree(currentText);
    if (!tree) return null;
    const node = findNodeAtLocation(tree, pointsPath);
    if (node?.type !== "array") return null;
    const points = getNodeValue(node) as unknown;
    if (Array.isArray(points) && points.every(isPoint)) {
      return {
        points: points.map((point) => ({ x: point.x, y: point.y })),
        pointsPath,
      };
    }
    return null;
  };

  const buildContentIndex = (nodes: ContentTreeNode[]): Map<string, string> => {
    const map = new Map<string, string>();
    const visit = (entries: ContentTreeNode[]): void => {
      for (const entry of entries) {
        if (entry.type === "dir" && entry.children?.length) {
          visit(entry.children);
          continue;
        }
        if (entry.type !== "file") continue;
        const parts = entry.path.split("/");
        const kind = parts[0] as ContentKind;
        if (!CONTENT_KINDS.includes(kind)) continue;
        const match = /^(.*)\.(json5|json)$/i.exec(entry.name);
        if (!match) continue;
        const id = match[1];
        if (!id) continue;
        map.set(`${kind}:${id}`, entry.path);
      }
    };
    visit(nodes);
    return map;
  };

  const resolveContentPath = (kind: ContentKind, id: string): null | string =>
    contentPathIndex.get(`${kind}:${id}`) ?? null;

  const getReferenceValue = (
    picker: ReferencePicker,
    path: (number | string)[] | null,
  ): null | string => {
    if (!path) return null;
    const tree = parseTree(currentText);
    if (!tree) return null;
    const targetPath =
      picker.mode === "array"
        ? [picker.key, typeof path?.[1] === "number" ? path[1] : -1]
        : [picker.key];
    if (targetPath.includes(-1)) return null;
    const node = findNodeAtLocation(tree, targetPath);
    if (!node) return null;
    const value = getNodeValue(node) as unknown;
    return typeof value === "string" ? value : null;
  };

  const applyReferenceSelection = (
    picker: ReferencePicker,
    path: (number | string)[] | null,
    value: string,
  ): void => {
    const formatOptions = { insertSpaces: true, tabSize: 2 };
    const targetPath =
      picker.mode === "array"
        ? [picker.key, typeof path?.[1] === "number" ? path[1] : -1]
        : [picker.key];
    try {
      const edits = modify(currentText, targetPath, value, {
        formattingOptions: formatOptions,
      });
      if (!edits.length) return;
      const next = applyEdits(currentText, edits);
      if (next !== currentText) {
        model.setValue(next);
      }
    } catch {
      renderValidation(["Unable to insert reference. Fix JSON errors first."]);
    }
  };

  const renderReferencePanel = (path: (number | string)[] | null): void => {
    if (!currentPath) {
      referencePanel.textContent = "";
      setPanelVisible(referenceSection, false);
      return;
    }
    if (!registryCache) {
      referencePanel.textContent = "";
      setPanelVisible(referenceSection, false);
      return;
    }

    const picker = getReferencePicker(path);
    if (!picker) {
      referencePanel.textContent = "";
      setPanelVisible(referenceSection, false);
      return;
    }

    const registry = getRegistry();
    if (!registry) {
      referencePanel.textContent = "";
      setPanelVisible(referenceSection, false);
      return;
    }
    const ids = Object.keys(registry[picker.registryKey]);
    if (!ids.length) {
      referencePanel.textContent = "";
      setPanelVisible(referenceSection, false);
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "content-editor__reference-picker";

    const label = document.createElement("div");
    label.className = "content-editor__reference-label";
    label.textContent = `Insert ${picker.label} id`;

    const select = document.createElement("select");
    select.className = "content-editor__select";
    for (const id of ids) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = id;
      select.appendChild(option);
    }

    const initialValue = getReferenceValue(picker, path);
    if (initialValue && ids.includes(initialValue)) {
      select.value = initialValue;
    }

    const button = document.createElement("button");
    button.className = "content-editor__button";
    button.textContent = picker.mode === "array" ? "Add" : "Set";
    button.addEventListener("click", () =>
      applyReferenceSelection(picker, path, select.value),
    );

    const gotoButton = document.createElement("button");
    gotoButton.className = "content-editor__button";
    gotoButton.textContent = "Go to";

    const updateGotoState = (): void => {
      const targetPath = resolveContentPath(picker.contentKind, select.value);
      gotoButton.disabled = !targetPath;
      gotoButton.title = targetPath
        ? `Open ${targetPath}`
        : `No ${picker.label} file found for "${select.value}".`;
    };

    gotoButton.addEventListener("click", () => {
      const targetPath = resolveContentPath(picker.contentKind, select.value);
      if (!targetPath) return;
      void requestOpenFile(targetPath);
    });

    select.addEventListener("change", updateGotoState);
    updateGotoState();

    const actions = document.createElement("div");
    actions.className = "content-editor__reference-actions";
    actions.append(button, gotoButton);

    wrapper.append(label, select, actions);
    referencePanel.replaceChildren(wrapper);
    setPanelVisible(referenceSection, true);
  };

  const getBezierMetrics = (): {
    height: number;
    playHeight: number;
    playLeft: number;
    playTop: number;
    playWidth: number;
    scale: number;
    width: number;
  } | null => {
    const bounds = bezierCanvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(bounds.width * dpr));
    const height = Math.max(1, Math.floor(bounds.height * dpr));
    if (bezierCanvas.width !== width || bezierCanvas.height !== height) {
      bezierCanvas.width = width;
      bezierCanvas.height = height;
    }
    const scale = Math.min(
      width / PLAYFIELD_BASE_WIDTH,
      height / PLAYFIELD_BASE_HEIGHT,
    );
    const playWidth = PLAYFIELD_BASE_WIDTH * scale;
    const playHeight = PLAYFIELD_BASE_HEIGHT * scale;
    return {
      height,
      playHeight,
      playLeft: (width - playWidth) / 2,
      playTop: (height - playHeight) / 2,
      playWidth,
      scale,
      width,
    };
  };

  const getBezierOrigin = (
    metrics: ReturnType<typeof getBezierMetrics>,
    anchor: "playfield" | "spawn",
  ): { x: number; y: number } => {
    if (!metrics) return { x: 0, y: 0 };
    if (anchor === "playfield") {
      return { x: metrics.playLeft, y: metrics.playTop };
    }
    return { x: metrics.playLeft + metrics.playWidth / 2, y: metrics.playTop };
  };

  const toScreen = (
    point: { x: number; y: number },
    metrics: ReturnType<typeof getBezierMetrics>,
    anchor: "playfield" | "spawn",
  ): { x: number; y: number } => {
    if (!metrics) return { x: 0, y: 0 };
    const origin = getBezierOrigin(metrics, anchor);
    return {
      x: origin.x + point.x * metrics.scale,
      y: origin.y + point.y * metrics.scale,
    };
  };

  const toLocal = (
    x: number,
    y: number,
    metrics: ReturnType<typeof getBezierMetrics>,
    anchor: "playfield" | "spawn",
  ): { x: number; y: number } => {
    if (!metrics) return { x: 0, y: 0 };
    const origin = getBezierOrigin(metrics, anchor);
    return {
      x: (x - origin.x) / metrics.scale,
      y: (y - origin.y) / metrics.scale,
    };
  };

  const evaluateBezier = (
    points: { x: number; y: number }[],
    t: number,
  ): { x: number; y: number } => {
    const temp = points.map((point) => ({ x: point.x, y: point.y }));
    for (let level = temp.length - 1; level > 0; level -= 1) {
      for (let i = 0; i < level; i += 1) {
        temp[i].x += (temp[i + 1].x - temp[i].x) * t;
        temp[i].y += (temp[i + 1].y - temp[i].y) * t;
      }
    }
    return temp[0] ?? { x: 0, y: 0 };
  };

  const drawBezierPreview = (activeIndex: null | number): void => {
    if (!bezierState) return;
    const metrics = getBezierMetrics();
    if (!metrics) return;
    const ctx = bezierCanvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, metrics.width, metrics.height);

    const playWidth = metrics.playWidth;
    const playHeight = metrics.playHeight;
    const playLeft = metrics.playLeft;
    const playTop = metrics.playTop;
    const origin = getBezierOrigin(metrics, bezierAnchor);

    ctx.fillStyle = "rgba(9, 15, 26, 0.9)";
    ctx.fillRect(playLeft, playTop, playWidth, playHeight);
    ctx.strokeStyle = "rgba(125, 214, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(playLeft, playTop, playWidth, playHeight);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.beginPath();
    ctx.moveTo(playLeft + playWidth / 2, playTop);
    ctx.lineTo(playLeft + playWidth / 2, playTop + playHeight);
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.rect(playLeft, playTop, playWidth, playHeight);
    ctx.clip();

    ctx.strokeStyle = "rgba(125, 214, 255, 0.25)";
    ctx.beginPath();
    const points = bezierState.points;
    for (let i = 0; i < points.length; i += 1) {
      const pos = toScreen(points[i], metrics, bezierAnchor);
      if (i === 0) {
        ctx.moveTo(pos.x, pos.y);
      } else {
        ctx.lineTo(pos.x, pos.y);
      }
    }
    ctx.stroke();

    if (points.length >= 2) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i <= 64; i += 1) {
        const t = i / 64;
        const local = evaluateBezier(points, t);
        const pos = toScreen(local, metrics, bezierAnchor);
        if (i === 0) {
          ctx.moveTo(pos.x, pos.y);
        } else {
          ctx.lineTo(pos.x, pos.y);
        }
      }
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(125, 214, 255, 0.4)";
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, 4, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < points.length; i += 1) {
      const pos = toScreen(points[i], metrics, bezierAnchor);
      ctx.fillStyle =
        i === activeIndex
          ? "rgba(125, 255, 200, 0.9)"
          : "rgba(255, 255, 255, 0.8)";
      ctx.strokeStyle = "rgba(15, 20, 30, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  };

  const renderBezierPanel = (): void => {
    if (!currentPath) {
      setPanelVisible(bezierSection, false);
      bezierState = null;
      lastBezierPath = null;
      bezierActive = false;
      return;
    }
    const cursorPath = getCursorPath();
    const context = findBezierContext();
    if (context) {
      lastBezierPath = context.pointsPath;
      bezierActive = true;
    } else if (
      cursorPath &&
      lastBezierPath &&
      !isPathWithin(cursorPath, lastBezierPath) &&
      draggingPointIndex === null
    ) {
      bezierActive = false;
    }

    if (!bezierActive) {
      setPanelVisible(bezierSection, false);
      bezierState = null;
      return;
    }

    const resolved = context ?? resolveBezierAtPath(lastBezierPath);
    if (!resolved || resolved.points.length < 2) {
      if (bezierState) {
        setPanelVisible(bezierSection, true);
        drawBezierPreview(draggingPointIndex);
        return;
      }
      setPanelVisible(bezierSection, false);
      bezierState = null;
      return;
    }
    bezierState = resolved;
    setPanelVisible(bezierSection, true);
    const activePoint = draggingPointIndex ?? resolved.points.length - 1;
    bezierInfo.textContent = `Points: ${resolved.points.length}. Origin: step start (0,0). X is centered.`;
    drawBezierPreview(activePoint);
  };

  const applySchema = (kind: ContentKind | null): void => {
    if (!kind) return;
    const schema = buildJsonSchemaForKind(kind, registryCache?.registry);
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      allowComments: true,
      enableSchemaRequest: false,
      schemas: [
        {
          fileMatch: [modelUri.toString()],
          schema,
          uri: `content-schema://${kind}`,
        },
      ],
      validate: true,
    });
  };

  const getRegistry = (): ContentRegistry | null =>
    registryCache?.registry ?? null;

  const getPreviewShip = (): null | ShipDefinition => {
    const registry = getRegistry();
    if (!registry) return null;
    return (
      registry.shipsById.starter ?? Object.values(registry.shipsById)[0] ?? null
    );
  };

  const ensurePreviewGame = (): void => {
    if (previewGame || !previewCanvasHost) return;
    previewCanvasHost.textContent = "";
    const rect = previewCanvasHost.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    previewScene = new ContentPreviewScene();
    const config: Phaser.Types.Core.GameConfig = {
      backgroundColor: "#05060a",
      fps: { smoothStep: false },
      parent: previewCanvasHost,
      render: { antialias: true, pixelArt: true },
      scale: {
        autoCenter: Phaser.Scale.CENTER_BOTH,
        height: PLAYFIELD_BASE_HEIGHT,
        mode: Phaser.Scale.FIT,
        width: PLAYFIELD_BASE_WIDTH,
      },
      type: Phaser.CANVAS,
    };
    previewGame = new Phaser.Game(config);
    previewGame.scene.add("ContentPreviewScene", previewScene, true);
    previewScene.setParentSize(width, height);
    previewResizeObserver = new ResizeObserver(() => {
      const bounds = previewCanvasHost.getBoundingClientRect();
      previewScene?.setParentSize(bounds.width, bounds.height);
    });
    previewResizeObserver.observe(previewCanvasHost);
  };

  const teardownPreviewGame = (): void => {
    if (previewResizeObserver) {
      previewResizeObserver.disconnect();
      previewResizeObserver = null;
    }
    if (previewGame) {
      previewGame.destroy(true);
      previewGame = null;
      previewScene = null;
    }
    previewCanvasHost.textContent = "";
  };

  const renderGunPreview = (
    gun: GunDefinition,
    zone: GunPreviewZone,
    ship: null | ShipDefinition,
  ): void => {
    teardownPreviewGame();
    setPreviewAspect("1 / 1");
    if (!gunPreviewCanvas) {
      gunPreviewCanvas = document.createElement("canvas");
      gunPreviewCanvas.className = "content-editor__gun-preview";
    }
    previewCanvasHost.replaceChildren(gunPreviewCanvas);
    const rect = previewCanvasHost.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = window.devicePixelRatio || 1;
    gunPreviewCanvas.width = Math.floor(width * dpr);
    gunPreviewCanvas.height = Math.floor(height * dpr);
    gunPreviewCanvas.style.width = `${width}px`;
    gunPreviewCanvas.style.height = `${height}px`;
    const ctx = gunPreviewCanvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const axisX = width * 0.5;
    const axisY = height * 0.5;
    ctx.save();
    ctx.strokeStyle = "rgba(143, 166, 199, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, axisY);
    ctx.lineTo(width, axisY);
    ctx.moveTo(axisX, 0);
    ctx.lineTo(axisX, height);
    ctx.stroke();
    ctx.restore();
    if (!ship) {
      const accent = gun.lineColor ?? 0x7df9ff;
      const size = Math.min(width, height) * 0.36;
      drawGunToCanvas(ctx, gun, axisX, axisY, size, accent);
      return;
    }

    const color = ship.color;
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    const fill = `rgba(${Math.round(r * 0.25)}, ${Math.round(
      g * 0.25,
    )}, ${Math.round(b * 0.25)}, 0.9)`;
    const stroke = `rgba(${r}, ${g}, ${b}, 0.9)`;
    const radius = Math.min(width, height) * 0.26;
    const centerX = axisX;
    const centerY = axisY;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    drawShipToCanvas(ctx, ship.vector ?? ship.shape, radius);
    ctx.restore();

    const mounts = ship.mounts.filter((mount) => mount.zone === zone);
    const gunAccent = gun.lineColor ?? 0x7df9ff;
    const sizeForMount = (_size: "large" | "small"): number => radius;
    for (const mount of mounts) {
      const x = centerX + mount.offset.x * radius;
      const y = centerY + mount.offset.y * radius;
      drawGunToCanvas(
        ctx,
        gun,
        x,
        y,
        sizeForMount(mount.size),
        gunAccent,
        mount.offset.x < 0,
      );
    }
  };

  const renderShipPreview = (ship: ShipDefinition): void => {
    teardownPreviewGame();
    setPreviewAspect("1 / 1");
    if (!shipPreviewCanvas) {
      shipPreviewCanvas = document.createElement("canvas");
      shipPreviewCanvas.className = "content-editor__ship-preview";
    }
    previewCanvasHost.replaceChildren(shipPreviewCanvas);
    const rect = previewCanvasHost.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = window.devicePixelRatio || 1;
    shipPreviewCanvas.width = Math.floor(width * dpr);
    shipPreviewCanvas.height = Math.floor(height * dpr);
    shipPreviewCanvas.style.width = `${width}px`;
    shipPreviewCanvas.style.height = `${height}px`;
    const ctx = shipPreviewCanvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const baseRadius = Math.min(width, height) * 0.26;
    const radius = baseRadius * (ship.radiusMultiplier ?? 1);
    const vectorShape = ship.vector ?? ship.shape;

    const color = ship.color;
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    const fill = `rgba(${Math.round(r * 0.25)}, ${Math.round(
      g * 0.25,
    )}, ${Math.round(b * 0.25)}, 0.9)`;
    const stroke = `rgba(${r}, ${g}, ${b}, 0.9)`;

    ctx.save();
    ctx.strokeStyle = "rgba(143, 166, 199, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    drawShipToCanvas(ctx, vectorShape, radius);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(143, 166, 199, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    const zoneColors: Record<string, string> = {
      front: "#7df9ff",
      rear: "#ff6b6b",
      side: "#ffd166",
    };
    for (const mount of ship.mounts) {
      const colorHex = zoneColors[mount.zone] ?? "#8fa6c7";
      const marker =
        Math.max(4, radius * 0.08) * (mount.size === "large" ? 1.1 : 0.85);
      const x = centerX + mount.offset.x * radius;
      const y = centerY + mount.offset.y * radius;
      ctx.save();
      ctx.fillStyle = `${colorHex}cc`;
      ctx.strokeStyle = colorHex;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, marker, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  };

  const renderEnemyPreview = (enemy: EnemyDef): void => {
    teardownPreviewGame();
    setPreviewAspect("1 / 1");
    if (!enemyPreviewCanvas) {
      enemyPreviewCanvas = document.createElement("canvas");
      enemyPreviewCanvas.className = "content-editor__enemy-preview";
    }
    previewCanvasHost.replaceChildren(enemyPreviewCanvas);
    const rect = previewCanvasHost.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = window.devicePixelRatio || 1;
    enemyPreviewCanvas.width = Math.floor(width * dpr);
    enemyPreviewCanvas.height = Math.floor(height * dpr);
    enemyPreviewCanvas.style.width = `${width}px`;
    enemyPreviewCanvas.style.height = `${height}px`;
    const ctx = enemyPreviewCanvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const minSize = Math.min(width, height);
    const baseRadius = minSize * 0.26;
    const rawRadius = baseRadius * (enemy.radius / 16);
    const maxRadius = minSize * 0.38;
    const radius = Math.min(rawRadius, maxRadius);

    ctx.save();
    ctx.strokeStyle = "rgba(143, 166, 199, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.stroke();
    ctx.restore();

    const style = enemy.style ?? {};
    const fill = style.fillColor ?? 0x1c0f1a;
    const line = style.lineColor ?? 0xff6b6b;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(Math.PI);
    ctx.fillStyle = `#${fill.toString(16).padStart(6, "0")}`;
    ctx.strokeStyle = `#${line.toString(16).padStart(6, "0")}`;
    ctx.lineWidth = 2;
    drawEnemyToCanvas(ctx, style.vector ?? style.shape ?? "swooper", radius);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(143, 166, 199, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  const renderZoneTabs = (
    supportedZones: GunPreviewZone[],
    activeZone: GunPreviewZone,
    onSelect: (zone: GunPreviewZone) => void,
  ): void => {
    const supported = new Set(supportedZones);
    previewTabs.replaceChildren();
    const zoneLabels: Record<GunPreviewZone, string> = {
      front: "Front",
      rear: "Rear",
      side: "Side",
    };
    (["front", "side", "rear"] as const).forEach((zone) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "content-editor__preview-tab";
      button.textContent = zoneLabels[zone];
      const enabled = supported.has(zone);
      button.disabled = !enabled;
      if (zone === activeZone) {
        button.classList.add("is-active");
      }
      if (!enabled) {
        button.classList.add("is-disabled");
      }
      button.addEventListener("click", () => {
        if (!enabled) return;
        onSelect(zone);
      });
      previewTabs.appendChild(button);
    });
    previewTabs.style.display = "";
  };

  const renderPreview = (): void => {
    if (!currentPath) {
      previewText.textContent = "";
      previewTabs.style.display = "none";
      setPanelVisible(previewSection, false);
      teardownPreviewGame();
      return;
    }

    if (currentKind === "levels") {
      setPreviewAspect(playfieldAspect);
      const registry = getRegistry();
      if (!registry) {
        previewText.textContent = "Preview unavailable.";
        previewCanvasHost.style.display = "none";
        previewTabs.style.display = "none";
        setPanelVisible(previewSection, true);
        return;
      }
      const level = currentLevelId ? registry.levelsById[currentLevelId] : null;
      if (!level) {
        previewText.textContent = currentLevelId
          ? `Level not found in registry: ${currentLevelId}`
          : "Level id missing.";
        previewCanvasHost.style.display = "none";
        setPanelVisible(previewSection, true);
        return;
      }
      const lines = [
        `Waves: ${level.waves.length}`,
        `Hazards: ${level.hazards?.length ?? 0}`,
        `Win: ${level.winCondition.kind}`,
      ];
      previewText.textContent = lines.join("\n");
      previewCanvasHost.style.display = "none";
      previewTabs.style.display = "none";
      teardownPreviewGame();
      setPanelVisible(previewSection, true);
      return;
    }

    if (currentKind === "enemies") {
      if (bezierActive) {
        previewText.textContent = "";
        previewCanvasHost.style.display = "none";
        previewScene?.setMode(null);
        previewTabs.style.display = "none";
        setPanelVisible(previewSection, false);
        return;
      }
      if (!currentEnemyDef) {
        previewText.textContent = "Enemy preview unavailable.";
        previewCanvasHost.style.display = "none";
        previewTabs.style.display = "none";
        setPanelVisible(previewSection, true);
        return;
      }
      previewText.textContent = "";
      previewCanvasHost.style.display = "";
      setPanelVisible(previewSection, true);
      previewTabs.style.display = "none";
      renderEnemyPreview(currentEnemyDef);
      return;
    }

    if (currentKind === "waves") {
      if (bezierActive) {
        previewText.textContent = "";
        previewCanvasHost.style.display = "none";
        previewScene?.setMode(null);
        setPanelVisible(previewSection, false);
        previewTabs.style.display = "none";
        return;
      }
      setPreviewAspect(playfieldAspect);
      const registry = getRegistry();
      if (!registry || !currentWaveDef) {
        previewText.textContent = "Wave preview unavailable.";
        previewCanvasHost.style.display = "none";
        previewScene?.setMode(null);
        setPanelVisible(previewSection, true);
        return;
      }
      previewText.textContent = "";
      previewCanvasHost.style.display = "";
      setPanelVisible(previewSection, true);
      ensurePreviewGame();
      previewScene?.setWave(currentWaveDef, registry.enemiesById);
      previewTabs.style.display = "none";
      return;
    }

    if (currentKind === "ships") {
      if (!currentShipDef) {
        previewText.textContent = "Ship preview unavailable.";
        previewCanvasHost.style.display = "none";
        previewTabs.style.display = "none";
        setPanelVisible(previewSection, true);
        return;
      }
      previewText.textContent = "";
      previewCanvasHost.style.display = "";
      setPanelVisible(previewSection, true);
      previewTabs.style.display = "none";
      renderShipPreview(currentShipDef);
      return;
    }

    if (currentKind === "guns") {
      if (!currentGunDef) {
        previewText.textContent = "Gun preview unavailable.";
        previewCanvasHost.style.display = "none";
        previewTabs.style.display = "none";
        setPanelVisible(previewSection, true);
        return;
      }
      previewText.textContent = "";
      previewCanvasHost.style.display = "";
      setPanelVisible(previewSection, true);
      previewTabs.style.display = "none";
      renderGunPreview(currentGunDef, "front", null);
      return;
    }

    if (currentKind === "weapons") {
      setPreviewAspect(playfieldAspect);
      const ship = getPreviewShip();
      if (!currentWeaponDef || !ship) {
        previewText.textContent = "Weapon preview unavailable.";
        previewCanvasHost.style.display = "none";
        previewTabs.style.display = "none";
        previewScene?.setMode(null);
        setPanelVisible(previewSection, true);
        return;
      }
      const shipZones = new Set(ship.mounts.map((mount) => mount.zone));
      const uniqueZones = Array.from(new Set(currentWeaponDef.zones));
      const supportedZones = uniqueZones.filter((zone) => shipZones.has(zone));
      const fallbackZones =
        supportedZones.length > 0
          ? supportedZones
          : uniqueZones.length
            ? uniqueZones
            : (["front", "side", "rear"] as GunPreviewZone[]);
      if (!fallbackZones.includes(currentWeaponZone)) {
        currentWeaponZone = fallbackZones[0] ?? "front";
      }
      previewText.textContent = "";
      previewCanvasHost.style.display = "";
      setPanelVisible(previewSection, true);
      ensurePreviewGame();
      renderZoneTabs(fallbackZones, currentWeaponZone, (zone) => {
        currentWeaponZone = zone;
        renderPreview();
      });
      previewScene?.setWeapon(currentWeaponDef, ship, currentWeaponZone);
      return;
    }

    previewText.textContent = "";
    previewCanvasHost.style.display = "none";
    previewTabs.style.display = "none";
    setPanelVisible(previewSection, false);
    teardownPreviewGame();
  };

  const refreshRegistry = async (): Promise<void> => {
    try {
      const response = await fetch("/__content/registry");
      if (!response.ok) return;
      registryCache = (await response.json()) as ContentRegistryResponse;
      renderPreview();
      applySchema(currentKind);
      renderReferencePanel(getActiveReferencePath());
    } catch {
      registryCache = null;
    }
  };

  const validateCurrent = (): void => {
    currentLevelId = null;
    currentEnemyDef = null;
    currentWaveDef = null;
    currentWeaponDef = null;
    currentGunDef = null;
    currentShipDef = null;
    if (!currentPath) {
      renderValidation(["No file selected."]);
      setLevelButtonsEnabled(false);
      return;
    }
    const kind = getKindForPath(currentPath);
    if (!kind) {
      renderValidation(["Unknown content kind."]);
      setLevelButtonsEnabled(false);
      return;
    }
    currentKind = kind;
    renderSchemaDocs(kind);
    applySchema(kind);

    const parsed = parseJsonWithLocation(currentText);
    if (parsed.error) {
      renderValidation([
        `${parsed.error.message} (line ${parsed.error.line}, col ${parsed.error.column})`,
      ]);
      setLevelButtonsEnabled(false);
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
      setLevelButtonsEnabled(false);
      return;
    }

    renderValidation(["Valid."]);

    if (kind === "levels") {
      currentLevelId = result.data.id;
      setLevelButtonsEnabled(true);
      void refreshRegistry();
    } else if (kind === "enemies") {
      const build = buildContentRegistry([
        {
          data: result.data as EnemyContent,
          kind: "enemies",
          path: currentPath,
        },
      ]);
      currentEnemyDef = build.registry.enemiesById[result.data.id] ?? null;
      setLevelButtonsEnabled(false);
    } else if (kind === "waves") {
      currentWaveDef = result.data as WaveDefinition;
      setLevelButtonsEnabled(false);
    } else if (kind === "weapons") {
      const build = buildContentRegistry([
        {
          data: result.data as WeaponContent,
          kind: "weapons",
          path: currentPath,
        },
      ]);
      currentWeaponDef = build.registry.weaponsById[result.data.id] ?? null;
      setLevelButtonsEnabled(false);
    } else if (kind === "guns") {
      const build = buildContentRegistry([
        {
          data: result.data as GunContent,
          kind: "guns",
          path: currentPath,
        },
      ]);
      currentGunDef = build.registry.gunsById[result.data.id] ?? null;
      setLevelButtonsEnabled(false);
    } else if (kind === "ships") {
      const build = buildContentRegistry([
        {
          data: result.data as ShipContent,
          kind: "ships",
          path: currentPath,
        },
      ]);
      currentShipDef = build.registry.shipsById[result.data.id] ?? null;
      setLevelButtonsEnabled(false);
    } else {
      setLevelButtonsEnabled(false);
    }

    renderPreview();
  };

  const scheduleValidate = debounce(validateCurrent, 250);
  const scheduleReferenceUpdate = debounce(
    () => renderReferencePanel(getActiveReferencePath()),
    150,
  );
  const scheduleSidePanelUpdate = debounce(() => {
    renderBezierPanel();
    renderPreview();
  }, 150);

  editor.onDidChangeModelContent(() => {
    currentText = editor.getValue();
    updateDirtyState();
    scheduleValidate();
    scheduleReferenceUpdate();
    scheduleSidePanelUpdate();
  });

  editor.onDidChangeCursorPosition(() => {
    scheduleReferenceUpdate();
    scheduleSidePanelUpdate();
  });

  editor.onMouseDown((event) => {
    if (!event.event.ctrlKey && !event.event.metaKey) return;
    const position = event.target.position;
    if (!position) return;
    const offset = model.getOffsetAt(position);
    const tree = parseTree(currentText);
    if (!tree) return;
    const node = findNodeAtOffset(tree, offset);
    if (!node) return;
    const path = getNodePath(node);
    const picker = getReferencePicker(path);
    if (!picker) return;
    const valueNode = findNodeAtLocation(tree, path);
    const value = valueNode ? (getNodeValue(valueNode) as unknown) : null;
    if (typeof value !== "string") return;
    const targetPath = resolveContentPath(picker.contentKind, value);
    if (!targetPath) return;
    void requestOpenFile(targetPath);
  });

  const updateBezierPoint = (
    index: number,
    localX: number,
    localY: number,
  ): void => {
    if (!bezierState) return;
    const targetPath = [...bezierState.pointsPath, index];
    const formatOptions = { insertSpaces: true, tabSize: 2 };
    const round = (value: number): number => Math.round(value * 10) / 10;
    try {
      let next = currentText;
      const editsX = modify(next, [...targetPath, "x"], round(localX), {
        formattingOptions: formatOptions,
      });
      next = applyEdits(next, editsX);
      const editsY = modify(next, [...targetPath, "y"], round(localY), {
        formattingOptions: formatOptions,
      });
      next = applyEdits(next, editsY);
      if (next !== currentText) {
        model.setValue(next);
      }
    } catch {
      renderValidation([
        "Unable to update bezier point. Fix JSON errors first.",
      ]);
    }
  };

  bezierCanvas.addEventListener("pointerdown", (event) => {
    if (!bezierState) return;
    const metrics = getBezierMetrics();
    if (!metrics) return;
    const rect = bezierCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const cursorX = (event.clientX - rect.left) * dpr;
    const cursorY = (event.clientY - rect.top) * dpr;
    const hitRadius = 10 * dpr;
    let hitIndex: null | number = null;
    for (let i = 0; i < bezierState.points.length; i += 1) {
      const pos = toScreen(bezierState.points[i], metrics, bezierAnchor);
      const dx = pos.x - cursorX;
      const dy = pos.y - cursorY;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        hitIndex = i;
        break;
      }
    }
    if (hitIndex === null) return;
    draggingPointIndex = hitIndex;
    draggingPointerId = event.pointerId;
    bezierCanvas.setPointerCapture(event.pointerId);
    drawBezierPreview(hitIndex);
  });

  bezierCanvas.addEventListener("pointermove", (event) => {
    if (draggingPointIndex === null || draggingPointerId !== event.pointerId)
      return;
    if (!bezierState) return;
    const metrics = getBezierMetrics();
    if (!metrics) return;
    const rect = bezierCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const cursorX = (event.clientX - rect.left) * dpr;
    const cursorY = (event.clientY - rect.top) * dpr;
    const local = toLocal(cursorX, cursorY, metrics, bezierAnchor);
    updateBezierPoint(draggingPointIndex, local.x, local.y);
    if (bezierState.points[draggingPointIndex]) {
      bezierState.points[draggingPointIndex] = {
        x: local.x,
        y: local.y,
      };
      drawBezierPreview(draggingPointIndex);
    }
  });

  const stopBezierDrag = (event: PointerEvent): void => {
    if (draggingPointerId !== event.pointerId) return;
    draggingPointIndex = null;
    draggingPointerId = null;
    bezierCanvas.releasePointerCapture(event.pointerId);
    drawBezierPreview(null);
  };

  bezierCanvas.addEventListener("pointerup", stopBezierDrag);
  bezierCanvas.addEventListener("pointercancel", stopBezierDrag);

  const openFile = async (path: string): Promise<void> => {
    const response = await fetch(
      `/__content/read?path=${encodeURIComponent(path)}`,
    );
    if (!response.ok) {
      renderValidation([`Failed to load ${path}.`]);
      return;
    }
    const payload = (await response.json()) as { contents: string };
    currentPath = path;
    currentText = payload.contents;
    originalText = payload.contents;
    lastReferencePath = null;
    lastBezierPath = null;
    bezierActive = false;
    referenceSection.style.display = "none";
    fileLabel.textContent = path;
    model.setValue(payload.contents);
    updateDirtyState();
    validateCurrent();
    renderReferencePanel(getActiveReferencePath());
    void refreshRegistry();
  };

  const buildTree = (nodes: ContentTreeNode[], depth = 0): void => {
    for (const node of nodes) {
      const row = document.createElement("div");
      row.className = "content-editor__tree-row";
      row.style.paddingLeft = `${depth * 12}px`;
      row.textContent = node.name;
      if (node.type === "file") {
        row.classList.add("is-file");
        row.addEventListener("click", () => void requestOpenFile(node.path));
      }
      treeContainer.appendChild(row);
      if (node.type === "dir" && node.children?.length) {
        buildTree(node.children, depth + 1);
      }
    }
  };

  const handleSave = async (): Promise<boolean> => {
    if (!currentPath) return false;
    const contents = editor.getValue();
    currentText = contents;
    const response = await fetch("/__content/write", {
      body: JSON.stringify({ contents, path: currentPath }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      renderValidation([`Failed to save ${currentPath}.`]);
      return false;
    }
    originalText = currentText;
    updateDirtyState();
    validateCurrent();
    void refreshRegistry();
    return true;
  };

  const confirmUnsavedChanges = async (): Promise<boolean> => {
    if (!hasUnsavedChanges()) return true;
    const shouldSave = window.confirm(
      "You have unsaved changes. Save before switching files?",
    );
    if (shouldSave) {
      return await handleSave();
    }
    return window.confirm("Discard unsaved changes?");
  };

  const requestOpenFile = async (path: string): Promise<void> => {
    if (path === currentPath) return;
    const ok = await confirmUnsavedChanges();
    if (!ok) return;
    await openFile(path);
  };

  saveButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void handleSave();
  });

  const navigateToLevel = (): void => {
    if (!currentLevelId) return;
    window.location.assign(`/?level=${encodeURIComponent(currentLevelId)}`);
  };

  const restartLevel = (): void => {
    if (!currentLevelId) return;
    const cacheBust = Date.now();
    window.location.assign(
      `/?level=${encodeURIComponent(currentLevelId)}&restart=1&t=${cacheBust}`,
    );
  };

  playButton.addEventListener("click", navigateToLevel);
  restartButton.addEventListener("click", restartLevel);

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
  renderSchemaDocs(null);
  renderReferencePanel(null);
  renderBezierPanel();
  renderPreview();

  window.addEventListener("resize", () => {
    renderBezierPanel();
    renderPreview();
  });
};
