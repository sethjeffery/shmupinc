import type { EnemyDef } from "../game/data/enemies";
import type { GalaxyDefinition } from "../game/data/galaxyTypes";
import type { GunDefinition } from "../game/data/gunTypes";
import type { ModDefinition } from "../game/data/modTypes";
import type { ShipDefinition } from "../game/data/shipTypes";
import type { VectorShape } from "../game/data/vectorShape";
import type { WaveDefinition } from "../game/data/waves";
import type { WeaponDefinition } from "../game/data/weaponTypes";
import type {
  ContentKind,
  EnemyContent,
  GalaxyContent,
  GunContent,
  ModContent,
  SoundContent,
  ShipContent,
  WaveContent,
  WeaponContent,
} from "./schemas";
import type { ContentEntry, ContentRegistry } from "./validation";

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
import { type ComponentChildren, render } from "preact";

import { resolveShipHitbox, resolveShipRadius } from "../game/data/shipTypes";
import { canMountWeapon } from "../game/data/weaponMounts";
import { DEFAULT_ENEMY_VECTOR } from "../game/render/enemyShapes";
import { ContentPreviewScene } from "../game/scenes/ContentPreviewScene";
import { getDebugFlags, setDebugFlags } from "../game/systems/DebugFlags";
import {
  PLAYFIELD_BASE_HEIGHT,
  PLAYFIELD_BASE_WIDTH,
} from "../game/util/playArea";
import {
  fetchRegistry,
  listContentTree,
  readContentFile,
  type ContentRegistryResponse,
  type ContentTreeNode,
  writeContentFile,
} from "./apiClient";
import {
  CanvasPointEditor,
  type CanvasEditorGuide,
  type CanvasEditorPoint,
  type CanvasEditorScene,
  type CanvasPointUpdate,
} from "./canvasPointEditor";
import { debounce, getKindForPath, scaleColor, toRgba } from "./editorUtils";
import { buildJsonSchemaForKind } from "./jsonSchema";
import {
  CONTENT_EDITOR_MONACO_THEME,
  configureContentEditorTheme,
} from "./monacoTheme";
import { parseJsonWithLocation } from "./parseJson";
import { ProceduralSoundPreviewPlayer } from "./proceduralSoundPlayer";
import { REFERENCE_PICKERS, type ReferencePicker } from "./referencePickers";
import { buildSchemaExplorer } from "./schemaExplorer";
import { CONTENT_KINDS, contentSchemas } from "./schemas";
import { buildContentRegistry } from "./validation";
import {
  buildBezierScene,
  buildVectorScene,
  type EditablePointPath,
} from "./vectorEditorScenes";

type WeaponPreviewMountId = string;

interface EditorShellRefs {
  bezierCanvas: HTMLCanvasElement;
  bezierInfo: HTMLDivElement;
  bezierPanel: HTMLDivElement;
  bezierSection: HTMLElement;
  bezierStage: HTMLDivElement;
  editorContainer: HTMLDivElement;
  fileLabel: HTMLDivElement;
  hazardToggle: HTMLInputElement;
  modIconCanvasHost: HTMLDivElement;
  modIconSection: HTMLElement;
  playButton: HTMLButtonElement;
  previewCanvasHost: HTMLDivElement;
  previewPanel: HTMLDivElement;
  previewSection: HTMLElement;
  previewTabs: HTMLDivElement;
  previewText: HTMLDivElement;
  referencePanel: HTMLDivElement;
  referenceSection: HTMLElement;
  restartButton: HTMLButtonElement;
  saveButton: HTMLButtonElement;
  schemaPanel: HTMLDivElement;
  spawnToggle: HTMLInputElement;
  treeContainer: HTMLDivElement;
  validationStatus: HTMLDivElement;
}

const ContentEditorShell = (props: {
  setRef: <K extends keyof EditorShellRefs>(
    key: K,
    element: EditorShellRefs[K] | null,
  ) => void;
}) => (
  <>
    <aside className="content-editor__sidebar">
      <div className="content-editor__title">Content</div>
      <div
        className="content-editor__tree"
        ref={(element) => {
          props.setRef("treeContainer", element);
        }}
      />
    </aside>
    <main className="content-editor__main">
      <div className="content-editor__toolbar">
        <div
          className="content-editor__file"
          ref={(element) => {
            props.setRef("fileLabel", element);
          }}
        >
          No file selected
        </div>
        <div className="content-editor__toolbar-right">
          <div
            className="content-editor__status"
            data-status="validation"
            ref={(element) => {
              props.setRef("validationStatus", element);
            }}
            title="Waiting for validation."
          >
            <span aria-hidden="true">{"\u25cf"}</span>
          </div>
          <div className="content-editor__actions">
            <button
              className="content-editor__button"
              data-action="save"
              disabled
              ref={(element) => {
                props.setRef("saveButton", element);
              }}
              type="button"
            >
              Save
            </button>
            <button
              className="content-editor__button"
              data-action="play"
              disabled
              ref={(element) => {
                props.setRef("playButton", element);
              }}
              type="button"
            >
              Play Level
            </button>
            <button
              className="content-editor__button"
              data-action="restart"
              disabled
              ref={(element) => {
                props.setRef("restartButton", element);
              }}
              type="button"
            >
              Restart Level
            </button>
          </div>
        </div>
      </div>
      <div className="content-editor__body">
        <div
          className="content-editor__editor"
          ref={(element) => {
            props.setRef("editorContainer", element);
          }}
        />
        <div className="content-editor__side">
          <section
            className="content-editor__panel"
            ref={(element) => {
              props.setRef("modIconSection", element);
            }}
          >
            <div className="content-editor__panel-title">Mod Icon</div>
            <div className="content-editor__panel-body">
              <div
                className="content-editor__mod-icon-preview"
                ref={(element) => {
                  props.setRef("modIconCanvasHost", element);
                }}
              />
            </div>
          </section>
          <section
            className="content-editor__panel"
            ref={(element) => {
              props.setRef("previewSection", element);
            }}
          >
            <div className="content-editor__panel-title">Preview</div>
            <div
              className="content-editor__panel-body"
              data-panel="preview"
              ref={(element) => {
                props.setRef("previewPanel", element);
              }}
            >
              <div
                className="content-editor__preview-text"
                data-preview="text"
                ref={(element) => {
                  props.setRef("previewText", element);
                }}
              />
              <div
                className="content-editor__preview-tabs"
                data-preview="tabs"
                ref={(element) => {
                  props.setRef("previewTabs", element);
                }}
              />
              <div
                className="content-editor__preview-canvas"
                data-preview="canvas"
                ref={(element) => {
                  props.setRef("previewCanvasHost", element);
                }}
              />
            </div>
          </section>
          <section className="content-editor__panel content-editor__panel--schema">
            <div className="content-editor__panel-title">Schema</div>
            <div
              className="content-editor__panel-body content-editor__schema"
              data-panel="schema"
              ref={(element) => {
                props.setRef("schemaPanel", element);
              }}
            />
          </section>
          <section
            className="content-editor__panel"
            ref={(element) => {
              props.setRef("referenceSection", element);
            }}
          >
            <div className="content-editor__panel-title">References</div>
            <div
              className="content-editor__panel-body content-editor__references"
              data-panel="references"
              ref={(element) => {
                props.setRef("referencePanel", element);
              }}
            />
          </section>
          <section
            className="content-editor__panel content-editor__panel--bezier"
            ref={(element) => {
              props.setRef("bezierSection", element);
            }}
          >
            <div className="content-editor__panel-title">Bezier</div>
            <div
              className="content-editor__panel-body content-editor__bezier"
              data-panel="bezier"
              ref={(element) => {
                props.setRef("bezierPanel", element);
              }}
            >
              <div
                className="content-editor__bezier-stage"
                ref={(element) => {
                  props.setRef("bezierStage", element);
                }}
              >
                <canvas
                  className="content-editor__bezier-canvas"
                  ref={(element) => {
                    props.setRef("bezierCanvas", element);
                  }}
                />
              </div>
              <div
                className="content-editor__bezier-info"
                data-bezier="info"
                ref={(element) => {
                  props.setRef("bezierInfo", element);
                }}
              />
            </div>
          </section>
          <section className="content-editor__panel">
            <div className="content-editor__panel-title">Debug</div>
            <div className="content-editor__panel-body content-editor__debug">
              <label>
                <input
                  data-debug="hazards"
                  ref={(element) => {
                    props.setRef("hazardToggle", element);
                  }}
                  type="checkbox"
                />
                <span>Hazard bounds</span>
              </label>
              <label>
                <input
                  data-debug="spawns"
                  ref={(element) => {
                    props.setRef("spawnToggle", element);
                  }}
                  type="checkbox"
                />
                <span>Spawn points</span>
              </label>
            </div>
          </section>
        </div>
      </div>
    </main>
  </>
);

export const initContentEditor = (): void => {
  const requireRef = <T extends HTMLElement>(
    element: null | T | undefined,
    name: string,
  ): T => {
    if (!element) {
      throw new Error(`Content editor missing required ref: ${name}`);
    }
    return element;
  };

  document.body.classList.add("content-editor-mode");
  const root = document.getElementById("content-root");
  if (!(root instanceof HTMLDivElement)) {
    throw new Error("Content editor missing #content-root host.");
  }
  root.className = "content-editor";
  const refs: Partial<EditorShellRefs> = {};
  const setRef = <K extends keyof EditorShellRefs>(
    key: K,
    element: EditorShellRefs[K] | null,
  ): void => {
    refs[key] = element ?? undefined;
  };
  render(<ContentEditorShell setRef={setRef} />, root);

  const treeContainer = requireRef(refs.treeContainer, "treeContainer");
  const editorContainer = requireRef(refs.editorContainer, "editorContainer");
  const validationStatus = requireRef(
    refs.validationStatus,
    "validationStatus",
  );
  const schemaPanel = requireRef(refs.schemaPanel, "schemaPanel");
  const referencePanel = requireRef(refs.referencePanel, "referencePanel");
  const referenceSection = requireRef(
    refs.referenceSection,
    "referenceSection",
  );
  const bezierSection = requireRef(refs.bezierSection, "bezierSection");
  const modIconSection = requireRef(refs.modIconSection, "modIconSection");
  const modIconCanvasHost = requireRef(
    refs.modIconCanvasHost,
    "modIconCanvasHost",
  );
  const bezierCanvas = requireRef(refs.bezierCanvas, "bezierCanvas");
  const bezierInfo = requireRef(refs.bezierInfo, "bezierInfo");
  const bezierStage = requireRef(refs.bezierStage, "bezierStage");
  const previewText = requireRef(refs.previewText, "previewText");
  const previewCanvasHost = requireRef(
    refs.previewCanvasHost,
    "previewCanvasHost",
  );
  const previewTabs = requireRef(refs.previewTabs, "previewTabs");
  const previewSection = requireRef(refs.previewSection, "previewSection");
  const fileLabel = requireRef(refs.fileLabel, "fileLabel");
  const saveButton = requireRef(refs.saveButton, "saveButton");
  const playButton = requireRef(refs.playButton, "playButton");
  const restartButton = requireRef(refs.restartButton, "restartButton");
  const hazardToggle = requireRef(refs.hazardToggle, "hazardToggle");
  const spawnToggle = requireRef(refs.spawnToggle, "spawnToggle");

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
  configureContentEditorTheme(monaco);
  const editor = monaco.editor.create(editorContainer, {
    automaticLayout: true,
    fontSize: 13,
    inlineSuggest: { enabled: true },
    minimap: { enabled: false },
    model,
    scrollBeyondLastLine: false,
    tabSize: 2,
    theme: CONTENT_EDITOR_MONACO_THEME,
  });

  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    allowComments: true,
    enableSchemaRequest: false,
    schemas: [],
    validate: true,
  });

  let currentPath: null | string = null;
  let currentText = "";
  let originalText = "";
  let currentLevelId: null | string = null;
  let currentEnemyDef: EnemyDef | null = null;
  let currentWaveDef: null | WaveDefinition = null;
  let currentWeaponDef: null | WeaponDefinition = null;
  let currentModDef: ModDefinition | null = null;
  let currentGunDef: GunDefinition | null = null;
  let currentGalaxyDef: GalaxyDefinition | null = null;
  let currentSoundDef: null | SoundContent = null;
  let currentShipDef: null | ShipDefinition = null;
  let currentKind: ContentKind | null = null;
  let registryCache: ContentRegistryResponse | null = null;
  let lastReferencePath: (number | string)[] | null = null;
  let contentPathIndex = new Map<string, string>();
  let lastBezierPath: (number | string)[] | null = null;
  let bezierActive = false;
  let previewPointCanvas: HTMLCanvasElement | null = null;
  let previewPointEditor: CanvasPointEditor | null = null;
  let previewPointEditorKey = "";
  let modIconPointCanvas: HTMLCanvasElement | null = null;
  let modIconPointEditor: CanvasPointEditor | null = null;
  let modIconPointEditorKey = "";
  const bezierPointEditor = new CanvasPointEditor(
    bezierCanvas,
    {
      background: "rgba(9, 15, 26, 0.9)",
      maxZoom: 980,
      minZoom: 80,
      snapStep: 0.1,
    },
    undefined,
  );
  let bezierPointEditorKey = "";
  let previewGame: null | Phaser.Game = null;
  let previewScene: ContentPreviewScene | null = null;
  let previewResizeObserver: null | ResizeObserver = null;
  let currentWeaponMountId: WeaponPreviewMountId = "";
  let currentWeaponPreviewModIds: string[] = [];
  let currentModPreviewShipId = "";
  let currentModPreviewWeaponId = "";
  let currentModPreviewMountId = "";
  let soundPreviewSemitoneOffset = 0;
  let soundPreviewGainScale = 1;
  const soundPreviewPlayer = new ProceduralSoundPreviewPlayer();
  let bezierPanelWasVisible = false;
  const loadTree = async (): Promise<void> => {
    try {
      const tree = await listContentTree();
      render(null, treeContainer);
      buildTree(tree);
      contentPathIndex = buildContentIndex(tree);
    } catch {
      renderValidation(["Failed to load content tree."]);
    }
  };

  const playfieldAspect = `${PLAYFIELD_BASE_WIDTH} / ${PLAYFIELD_BASE_HEIGHT}`;
  bezierStage.style.aspectRatio = playfieldAspect;
  previewCanvasHost.style.aspectRatio = playfieldAspect;

  const setPreviewAspect = (aspect: string): void => {
    previewCanvasHost.style.aspectRatio = aspect;
  };

  const hidePreviewCanvas = (): void => {
    previewCanvasHost.style.display = "none";
    previewPointEditorKey = "";
  };

  const hidePreviewTabs = (): void => {
    render(null, previewTabs);
    previewTabs.style.display = "none";
  };

  const renderPreviewTabs = (groups: ComponentChildren[]): void => {
    if (!groups.length) {
      hidePreviewTabs();
      return;
    }
    render(<>{groups}</>, previewTabs);
    previewTabs.style.display = "";
  };

  const destroyPreviewPointEditor = (): void => {
    previewPointEditor?.destroy();
    previewPointEditor = null;
    previewPointCanvas = null;
    previewPointEditorKey = "";
  };

  const destroyModIconPointEditor = (): void => {
    modIconPointEditor?.destroy();
    modIconPointEditor = null;
    modIconPointCanvas = null;
    modIconPointEditorKey = "";
  };

  const ensurePreviewPointEditor = (
    className: string,
    onPointUpdate?: (update: CanvasPointUpdate) => void,
  ): CanvasPointEditor | null => {
    const needsCanvas = !previewPointCanvas?.classList.contains(className);
    if (needsCanvas) {
      destroyPreviewPointEditor();
      let canvasRef: HTMLCanvasElement | null = null;
      render(
        <canvas
          className={className}
          ref={(element) => {
            canvasRef = element;
          }}
        />,
        previewCanvasHost,
      );
      if (!canvasRef) return null;
      previewPointCanvas = canvasRef;
      previewPointEditor = new CanvasPointEditor(
        canvasRef,
        {
          background: "rgba(8, 12, 20, 0.9)",
          maxZoom: 980,
          minZoom: 80,
          snapStep: 0.1,
        },
        onPointUpdate,
      );
      return previewPointEditor;
    }
    previewPointEditor?.setOnPointUpdate(onPointUpdate);
    return previewPointEditor;
  };

  const ensureModIconPointEditor = (
    onPointUpdate?: (update: CanvasPointUpdate) => void,
  ): CanvasPointEditor | null => {
    if (!modIconPointCanvas) {
      let canvasRef: HTMLCanvasElement | null = null;
      render(
        <canvas
          className="content-editor__mod-icon-canvas"
          ref={(element) => {
            canvasRef = element;
          }}
        />,
        modIconCanvasHost,
      );
      if (!canvasRef) return null;
      modIconPointCanvas = canvasRef;
      modIconPointEditor = new CanvasPointEditor(
        canvasRef,
        {
          background: "rgba(8, 12, 20, 0.9)",
          maxZoom: 980,
          minZoom: 80,
          snapStep: 0.1,
        },
        onPointUpdate,
      );
      return modIconPointEditor;
    }
    modIconPointEditor?.setOnPointUpdate(onPointUpdate);
    return modIconPointEditor;
  };

  const updatePointAtPath = (
    pointPath: EditablePointPath,
    localX: number,
    localY: number,
  ): void => {
    const formatOptions = { insertSpaces: true, tabSize: 2 };
    const round = (value: number): number => Math.round(value * 1000) / 1000;
    try {
      let next = currentText;
      const editsX = modify(next, pointPath.xPath, round(localX), {
        formattingOptions: formatOptions,
      });
      next = applyEdits(next, editsX);
      const editsY = modify(next, pointPath.yPath, round(localY), {
        formattingOptions: formatOptions,
      });
      next = applyEdits(next, editsY);
      if (next !== currentText) {
        model.setValue(next);
      }
    } catch {
      renderValidation([
        "Unable to update point value. Fix JSON errors first.",
      ]);
    }
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
      render(null, schemaPanel);
      schemaPanel.textContent = "Open a content file to see its schema.";
      return;
    }
    const docs = buildSchemaExplorer(
      buildJsonSchemaForKind(kind, registryCache?.registry),
    );
    if (!docs.length) {
      render(null, schemaPanel);
      schemaPanel.textContent = "No schema info available.";
      return;
    }
    render(
      <div className="content-editor__schema-list">
        {docs.map((doc) => {
          const description = doc.description ?? "No description.";
          const detail =
            doc.defaultValue !== undefined
              ? `${description} (default: ${doc.defaultValue})`
              : description;
          return (
            <div
              className="content-editor__schema-row"
              key={`${doc.path}:${doc.type}:${doc.defaultValue ?? "none"}`}
            >
              <div className="content-editor__schema-label">{`${doc.path} : ${doc.type}`}</div>
              <div className="content-editor__schema-desc">{detail}</div>
            </div>
          );
        })}
      </div>,
      schemaPanel,
    );
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
      render(null, referencePanel);
      referencePanel.textContent = "";
      setPanelVisible(referenceSection, false);
      return;
    }
    if (!registryCache) {
      render(null, referencePanel);
      referencePanel.textContent = "";
      setPanelVisible(referenceSection, false);
      return;
    }

    const picker = getReferencePicker(path);
    if (!picker) {
      render(null, referencePanel);
      referencePanel.textContent = "";
      setPanelVisible(referenceSection, false);
      return;
    }

    const registry = getRegistry();
    if (!registry) {
      render(null, referencePanel);
      referencePanel.textContent = "";
      setPanelVisible(referenceSection, false);
      return;
    }
    const ids = Object.keys(registry[picker.registryKey]);
    if (!ids.length) {
      render(null, referencePanel);
      referencePanel.textContent = "";
      setPanelVisible(referenceSection, false);
      return;
    }
    const initialValue = getReferenceValue(picker, path);
    let selectedId =
      initialValue && ids.includes(initialValue) ? initialValue : ids[0];

    const rerender = (): void => {
      const targetPath = resolveContentPath(picker.contentKind, selectedId);
      render(
        <div className="content-editor__reference-picker">
          <div className="content-editor__reference-label">{`Insert ${picker.label} id`}</div>
          <select
            className="content-editor__select"
            onChange={(event) => {
              selectedId = event.currentTarget.value;
              rerender();
            }}
            value={selectedId}
          >
            {ids.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
          <div className="content-editor__reference-actions">
            <button
              className="content-editor__button"
              onClick={() => applyReferenceSelection(picker, path, selectedId)}
              type="button"
            >
              {picker.mode === "array" ? "Add" : "Set"}
            </button>
            <button
              className="content-editor__button"
              disabled={!targetPath}
              onClick={() => {
                const nextPath = resolveContentPath(
                  picker.contentKind,
                  selectedId,
                );
                if (!nextPath) return;
                void requestOpenFile(nextPath);
              }}
              title={
                targetPath
                  ? `Open ${targetPath}`
                  : `No ${picker.label} file found for "${selectedId}".`
              }
              type="button"
            >
              Go to
            </button>
          </div>
        </div>,
        referencePanel,
      );
    };

    rerender();
    setPanelVisible(referenceSection, true);
  };

  const renderBezierPanel = (): void => {
    if (!currentPath) {
      setPanelVisible(bezierSection, false);
      lastBezierPath = null;
      bezierActive = false;
      bezierPointEditorKey = "";
      bezierPanelWasVisible = false;
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
      !bezierPointEditor.isDraggingPoint()
    ) {
      bezierActive = false;
    }

    if (!bezierActive) {
      setPanelVisible(bezierSection, false);
      bezierPointEditorKey = "";
      bezierPanelWasVisible = false;
      return;
    }

    const resolved = context ?? resolveBezierAtPath(lastBezierPath);
    if (!resolved || resolved.points.length < 2) {
      setPanelVisible(bezierSection, false);
      bezierPointEditorKey = "";
      bezierPanelWasVisible = false;
      return;
    }

    setPanelVisible(bezierSection, true);
    bezierInfo.textContent = `Points: ${resolved.points.length}. Origin: step start (0,0). Units are normalized (x=1 full width, y=1 full height).`;
    const { pointPathById, scene } = buildBezierScene(
      resolved.points,
      resolved.pointsPath,
    );
    const editorKey = `${currentPath}:${resolved.pointsPath.join(".")}`;
    bezierPointEditor.setOnPointUpdate((update) => {
      const pointPath = pointPathById.get(update.id);
      if (!pointPath) return;
      updatePointAtPath(pointPath, update.x, update.y);
    });
    const shouldFit =
      !bezierPanelWasVisible || bezierPointEditorKey !== editorKey;
    if (bezierPointEditor.isDraggingPoint()) {
      bezierPanelWasVisible = true;
      return;
    }
    bezierPointEditor.setScene(scene, { fit: shouldFit });
    bezierPointEditorKey = editorKey;
    bezierPanelWasVisible = true;
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
    destroyPreviewPointEditor();
    render(null, previewCanvasHost);
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
    destroyPreviewPointEditor();
    render(null, previewCanvasHost);
  };

  const renderVectorPreview = (
    className: string,
    editorKey: string,
    vector: VectorShape,
    pointPathPrefix: (number | string)[],
    style: { fill: string; helperStroke?: string; stroke: string },
    guides?: CanvasEditorGuide[],
    options?: {
      allowStyleFallback?: boolean;
    },
  ): void => {
    if (previewGame) {
      teardownPreviewGame();
    }
    setPreviewAspect("1 / 1");
    const { pointPathById, scene } = buildVectorScene(
      vector,
      pointPathPrefix,
      style,
      guides,
      options,
    );
    const editorInstance = ensurePreviewPointEditor(className, (update) => {
      const pointPath = pointPathById.get(update.id);
      if (!pointPath) return;
      updatePointAtPath(pointPath, update.x, update.y);
    });
    if (!editorInstance) return;
    if (editorInstance.isDraggingPoint()) return;
    editorInstance.setScene(scene, {
      fit: previewPointEditorKey !== editorKey,
    });
    previewPointEditorKey = editorKey;
  };

  const renderGunPreview = (gun: GunDefinition): void => {
    const accent = 0x7df9ff;
    const fill = toRgba(scaleColor(accent, 0.28), 0.9);
    const stroke = toRgba(accent, 0.95);
    renderVectorPreview(
      "content-editor__gun-preview",
      `gun:${currentPath ?? "none"}`,
      gun.vector,
      ["vector"],
      {
        fill,
        helperStroke: toRgba(accent, 0.5),
        stroke,
      },
      undefined,
      { allowStyleFallback: true },
    );
  };

  const getModAccentColor = (iconKind: ModDefinition["iconKind"]): number => {
    switch (iconKind) {
      case "aoe":
        return 0xff6b6b;
      case "bounce":
        return 0x9fb7ff;
      case "homing":
        return 0x7df9ff;
      case "multi":
        return 0xffd166;
      case "power":
      default:
        return 0xff8c42;
    }
  };

  const renderModIconPreview = (mod: ModDefinition): void => {
    const accent = getModAccentColor(mod.iconKind);
    const fill = toRgba(scaleColor(accent, 0.32), 0.9);
    const stroke = toRgba(accent, 0.95);
    const { pointPathById, scene } = buildVectorScene(
      mod.icon,
      ["icon"],
      {
        fill,
        helperStroke: toRgba(accent, 0.5),
        stroke,
      },
      undefined,
      { allowStyleFallback: true },
    );
    const editorInstance = ensureModIconPointEditor((update) => {
      const pointPath = pointPathById.get(update.id);
      if (!pointPath) return;
      updatePointAtPath(pointPath, update.x, update.y);
    });
    if (!editorInstance) return;
    const editorKey = `mod:${currentPath ?? "none"}`;
    if (editorInstance.isDraggingPoint()) return;
    editorInstance.setScene(scene, {
      fit: modIconPointEditorKey !== editorKey,
    });
    modIconPointEditorKey = editorKey;
  };

  const renderShipPreview = (ship: ShipDefinition): void => {
    const guides: CanvasEditorGuide[] = ship.mounts.map((mount) => ({
      kind: "circle",
      r: 0.085,
      stroke: "rgba(255, 219, 111, 0.9)",
      width: 1.75,
      x: mount.offset.x,
      y: mount.offset.y,
    }));
    const shipRadius = Math.max(resolveShipRadius(ship), 0.0001);
    const shipHitbox = resolveShipHitbox(ship);
    if (shipHitbox.kind === "circle") {
      guides.push({
        kind: "circle",
        r: shipHitbox.radius / shipRadius,
        stroke: "rgba(143, 166, 199, 0.5)",
        width: 1.5,
        x: 0,
        y: 0,
      });
    } else {
      guides.push({
        kind: "ellipse",
        rx: shipHitbox.radiusX / shipRadius,
        ry: shipHitbox.radiusY / shipRadius,
        stroke: "rgba(143, 166, 199, 0.5)",
        width: 1.5,
        x: 0,
        y: 0,
      });
    }
    renderVectorPreview(
      "content-editor__ship-preview",
      `ship:${currentPath ?? "none"}`,
      ship.vector,
      ["vector"],
      {
        fill: toRgba(scaleColor(ship.color, 0.25), 0.9),
        helperStroke: toRgba(ship.color, 0.45),
        stroke: toRgba(ship.color, 0.95),
      },
      guides,
      { allowStyleFallback: false },
    );
  };

  const renderGalaxyPreview = (galaxy: GalaxyDefinition): void => {
    if (previewGame) {
      teardownPreviewGame();
    }
    setPreviewAspect("16 / 10");
    const pointPathById = new Map<string, EditablePointPath>();
    const points: CanvasEditorPoint[] = galaxy.levels.map((entry, index) => {
      pointPathById.set(entry.levelId, {
        xPath: ["levels", index, "pos", "x"],
        yPath: ["levels", index, "pos", "y"],
      });
      return {
        id: entry.levelId,
        x: entry.pos.x * 2 - 1,
        y: entry.pos.y * 2 - 1,
      };
    });
    const scene: CanvasEditorScene = {
      axisX: 0,
      axisY: 0,
      paths: galaxy.levels.slice(0, -1).map((entry, index) => ({
        pointIds: [entry.levelId, galaxy.levels[index + 1].levelId],
        stroke: "rgba(125, 249, 255, 0.65)",
        width: 1.75,
      })),
      points,
    };
    const editorInstance = ensurePreviewPointEditor(
      "content-editor__ship-preview",
      (update) => {
        const pointPath = pointPathById.get(update.id);
        if (!pointPath) return;
        const nextX = Math.max(0, Math.min(1, (update.x + 1) * 0.5));
        const nextY = Math.max(0, Math.min(1, (update.y + 1) * 0.5));
        updatePointAtPath(pointPath, nextX, nextY);
      },
    );
    if (!editorInstance) return;
    const editorKey = `galaxy:${currentPath ?? "none"}`;
    if (editorInstance.isDraggingPoint()) return;
    editorInstance.setScene(scene, {
      fit: previewPointEditorKey !== editorKey,
    });
    previewPointEditorKey = editorKey;
  };

  const renderEnemyPreview = (enemy: EnemyDef): void => {
    const style = enemy.style ?? {};
    const vector = style.vector ?? DEFAULT_ENEMY_VECTOR;
    const hitboxGuides: CanvasEditorGuide[] = [];
    const radiusScale = enemy.radius > 0 ? 1 / enemy.radius : 1;
    if (enemy.hitbox.kind === "circle") {
      hitboxGuides.push({
        kind: "circle",
        r: enemy.hitbox.radius * radiusScale,
        stroke: "rgba(143, 166, 199, 0.45)",
        width: 1.5,
        x: 0,
        y: 0,
      });
    } else {
      hitboxGuides.push({
        kind: "ellipse",
        rx: enemy.hitbox.radiusX * radiusScale,
        ry: enemy.hitbox.radiusY * radiusScale,
        stroke: "rgba(143, 166, 199, 0.45)",
        width: 1.5,
        x: 0,
        y: 0,
      });
    }
    renderVectorPreview(
      "content-editor__enemy-preview",
      `enemy:${currentPath ?? "none"}`,
      vector,
      ["style", "vector"],
      {
        fill: toRgba(0xffffff, 0.9),
        helperStroke: toRgba(0xffffff, 0.45),
        stroke: toRgba(0xffffff, 0.95),
      },
      hitboxGuides,
      { allowStyleFallback: false },
    );
  };

  const getPreviewTabClassName = (
    isActive: boolean,
    isDisabled = false,
  ): string => {
    let className = "content-editor__preview-tab";
    if (isActive) className += " is-active";
    if (isDisabled) className += " is-disabled";
    return className;
  };

  const buildPreviewControlGroup = (
    label: string,
    controls: ComponentChildren,
  ): ComponentChildren => (
    <div className="content-editor__preview-group" key={label}>
      <span className="content-editor__preview-group-label">{label}</span>
      <div className="content-editor__preview-group-controls">{controls}</div>
    </div>
  );

  const buildMountTabsGroup = (
    mountIds: string[],
    activeMountId: string,
    onSelect: (mountId: string) => void,
  ): ComponentChildren =>
    buildPreviewControlGroup(
      "Mount",
      mountIds.map((mountId) => (
        <button
          type="button"
          className={getPreviewTabClassName(mountId === activeMountId)}
          key={mountId}
          onClick={() => {
            onSelect(mountId);
          }}
        >
          {mountId}
        </button>
      )),
    );

  const buildSelectControlGroup = (
    label: string,
    options: { id: string; label: string }[],
    selectedId: string,
    onSelect: (id: string) => void,
  ): ComponentChildren =>
    buildPreviewControlGroup(
      label,
      <select
        className="content-editor__preview-select"
        value={selectedId}
        onChange={(event) => {
          onSelect(event.currentTarget.value);
        }}
      >
        {options.map((option) => (
          <option value={option.id} key={option.id}>
            {option.label}
          </option>
        ))}
      </select>,
    );

  const normalizePreviewModSelection = (
    requestedModIds: string[],
    availableMods: ModDefinition[],
    maxSlots: number,
  ): string[] => {
    const byId = new Map(availableMods.map((mod) => [mod.id, mod]));
    const seenKinds = new Set<ModDefinition["iconKind"]>();
    const selected: string[] = [];
    for (const modId of requestedModIds) {
      const mod = byId.get(modId);
      if (!mod) continue;
      if (seenKinds.has(mod.iconKind)) continue;
      seenKinds.add(mod.iconKind);
      selected.push(modId);
      if (selected.length >= maxSlots) break;
    }
    return selected;
  };

  const buildModTabsGroup = (
    mods: ModDefinition[],
    selectedModIds: string[],
    maxSlots: number,
    onToggle: (modId: string) => void,
  ): ComponentChildren => {
    const label = `Mods (${selectedModIds.length}/${maxSlots})`;
    if (maxSlots <= 0) {
      return buildPreviewControlGroup(
        label,
        <span className="content-editor__preview-empty">
          This mount has no mod slots.
        </span>,
      );
    }
    const selectedKinds = new Set(
      selectedModIds
        .map((id) => mods.find((mod) => mod.id === id))
        .filter((mod): mod is ModDefinition => Boolean(mod))
        .map((mod) => mod.iconKind),
    );
    return buildPreviewControlGroup(
      label,
      mods.map((mod) => {
        const isSelected = selectedModIds.includes(mod.id);
        const hasTypeConflict = selectedKinds.has(mod.iconKind) && !isSelected;
        const limitReached = selectedModIds.length >= maxSlots && !isSelected;
        const isDisabled = hasTypeConflict || limitReached;
        return (
          <button
            type="button"
            className={getPreviewTabClassName(isSelected, isDisabled)}
            key={mod.id}
            disabled={isDisabled}
            onClick={() => {
              onToggle(mod.id);
            }}
          >
            {mod.id}
          </button>
        );
      }),
    );
  };

  const getSoundLayerDurationMs = (
    layer: SoundContent["layers"][number],
  ): number => {
    if (layer.type === "eventGroup") {
      const eventDurationMs = getSoundLayerDurationMs(layer.event);
      const count = Math.max(1, Math.floor(layer.count));
      const spacingMs = Math.max(0, layer.spacingMs);
      const jitterMs = Math.max(0, layer.jitterMs ?? 0);
      return (
        (layer.startOffsetMs ?? 0) +
        (count - 1) * spacingMs +
        jitterMs +
        eventDurationMs
      );
    }
    return (
      (layer.startOffsetMs ?? 0) +
      (layer.attackMs ?? 0) +
      (layer.holdMs ?? 0) +
      (layer.releaseMs ?? 0)
    );
  };

  const getSoundDurationMs = (sound: SoundContent): number =>
    sound.layers.reduce(
      (max, layer) => Math.max(max, getSoundLayerDurationMs(layer)),
      0,
    );

  const playSoundPreviewBurst = (sound: SoundContent, count = 1): void => {
    const safeCount = Math.max(1, Math.min(8, count));
    const durationMs = Math.max(80, getSoundDurationMs(sound));
    for (let i = 0; i < safeCount; i += 1) {
      window.setTimeout(
        () => {
          soundPreviewPlayer.play(sound, {
            gainScale: soundPreviewGainScale,
            semitoneOffset: soundPreviewSemitoneOffset,
          });
        },
        i * Math.round(durationMs * 0.5),
      );
    }
  };

  const renderPreview = (): void => {
    if (!currentPath) {
      soundPreviewPlayer.stop();
      previewText.textContent = "";
      hidePreviewCanvas();
      hidePreviewTabs();
      setPanelVisible(previewSection, false);
      setPanelVisible(modIconSection, false);
      destroyModIconPointEditor();
      render(null, modIconCanvasHost);
      teardownPreviewGame();
      return;
    }
    setPanelVisible(modIconSection, false);
    if (currentKind !== "sounds") {
      soundPreviewPlayer.stop();
    }

    if (currentKind === "levels") {
      setPreviewAspect(playfieldAspect);
      const registry = getRegistry();
      if (!registry) {
        previewText.textContent = "Preview unavailable.";
        hidePreviewCanvas();
        hidePreviewTabs();
        setPanelVisible(previewSection, true);
        return;
      }
      const level = currentLevelId ? registry.levelsById[currentLevelId] : null;
      if (!level) {
        previewText.textContent = currentLevelId
          ? `Level not found in registry: ${currentLevelId}`
          : "Level id missing.";
        hidePreviewCanvas();
        setPanelVisible(previewSection, true);
        return;
      }
      const lines = [
        `Waves: ${level.waves.length}`,
        `Hazards: ${level.hazards?.length ?? 0}`,
        `Win: ${level.winCondition.kind}`,
      ];
      previewText.textContent = lines.join("\n");
      hidePreviewCanvas();
      hidePreviewTabs();
      teardownPreviewGame();
      setPanelVisible(previewSection, true);
      return;
    }

    if (currentKind === "enemies") {
      if (bezierActive) {
        previewText.textContent = "";
        hidePreviewCanvas();
        previewScene?.setMode(null);
        hidePreviewTabs();
        setPanelVisible(previewSection, false);
        return;
      }
      if (!currentEnemyDef) {
        previewText.textContent = "Enemy preview unavailable.";
        hidePreviewCanvas();
        hidePreviewTabs();
        setPanelVisible(previewSection, true);
        return;
      }
      previewText.textContent = "";
      previewCanvasHost.style.display = "";
      setPanelVisible(previewSection, true);
      hidePreviewTabs();
      renderEnemyPreview(currentEnemyDef);
      return;
    }

    if (currentKind === "waves") {
      if (bezierActive) {
        previewText.textContent = "";
        hidePreviewCanvas();
        previewScene?.setMode(null);
        setPanelVisible(previewSection, false);
        hidePreviewTabs();
        return;
      }
      setPreviewAspect(playfieldAspect);
      const registry = getRegistry();
      if (!registry || !currentWaveDef) {
        previewText.textContent = "Wave preview unavailable.";
        hidePreviewCanvas();
        previewScene?.setMode(null);
        setPanelVisible(previewSection, true);
        return;
      }
      previewText.textContent = "";
      previewCanvasHost.style.display = "";
      setPanelVisible(previewSection, true);
      ensurePreviewGame();
      previewScene?.setWave(currentWaveDef, registry.enemiesById);
      hidePreviewTabs();
      return;
    }

    if (currentKind === "ships") {
      if (!currentShipDef) {
        previewText.textContent = "Ship preview unavailable.";
        hidePreviewCanvas();
        hidePreviewTabs();
        setPanelVisible(previewSection, true);
        return;
      }
      previewText.textContent = "";
      previewCanvasHost.style.display = "";
      setPanelVisible(previewSection, true);
      hidePreviewTabs();
      renderShipPreview(currentShipDef);
      return;
    }

    if (currentKind === "galaxies") {
      if (!currentGalaxyDef) {
        previewText.textContent = "Galaxy preview unavailable.";
        hidePreviewCanvas();
        hidePreviewTabs();
        setPanelVisible(previewSection, true);
        return;
      }
      previewText.textContent = `Levels: ${currentGalaxyDef.levels.length}`;
      previewCanvasHost.style.display = "";
      setPanelVisible(previewSection, true);
      hidePreviewTabs();
      renderGalaxyPreview(currentGalaxyDef);
      return;
    }

    if (currentKind === "guns") {
      if (!currentGunDef) {
        previewText.textContent = "Gun preview unavailable.";
        hidePreviewCanvas();
        hidePreviewTabs();
        setPanelVisible(previewSection, true);
        return;
      }
      previewText.textContent = "";
      previewCanvasHost.style.display = "";
      setPanelVisible(previewSection, true);
      hidePreviewTabs();
      renderGunPreview(currentGunDef);
      return;
    }

    if (currentKind === "weapons") {
      setPreviewAspect(playfieldAspect);
      const registry = getRegistry();
      const ship = getPreviewShip();
      if (!registry || !currentWeaponDef || !ship) {
        previewText.textContent = "Weapon preview unavailable.";
        hidePreviewCanvas();
        hidePreviewTabs();
        previewScene?.setMode(null);
        setPanelVisible(previewSection, true);
        return;
      }
      const weaponDef = currentWeaponDef;
      const compatibleMounts = ship.mounts.filter((mount) =>
        canMountWeapon(weaponDef, mount),
      );
      const mountIds =
        compatibleMounts.length > 0
          ? compatibleMounts.map((mount) => mount.id)
          : ship.mounts.map((mount) => mount.id);
      if (!mountIds.includes(currentWeaponMountId)) {
        currentWeaponMountId = mountIds[0] ?? "";
      }
      const selectedMount =
        ship.mounts.find((mount) => mount.id === currentWeaponMountId) ?? null;
      const maxModSlots = selectedMount?.modSlots ?? 0;
      const availableMods = Object.values(registry.modsById).sort((a, b) =>
        a.id.localeCompare(b.id),
      );
      currentWeaponPreviewModIds = normalizePreviewModSelection(
        currentWeaponPreviewModIds,
        availableMods,
        maxModSlots,
      );
      const selectedMods = currentWeaponPreviewModIds
        .map((modId) => registry.modsById[modId])
        .filter((mod): mod is ModDefinition => Boolean(mod));
      previewText.textContent = "";
      previewCanvasHost.style.display = "";
      setPanelVisible(previewSection, true);
      ensurePreviewGame();
      renderPreviewTabs([
        buildMountTabsGroup(mountIds, currentWeaponMountId, (mountId) => {
          currentWeaponMountId = mountId;
          currentWeaponPreviewModIds = [];
          renderPreview();
        }),
        buildModTabsGroup(
          availableMods,
          currentWeaponPreviewModIds,
          maxModSlots,
          (modId) => {
            if (currentWeaponPreviewModIds.includes(modId)) {
              currentWeaponPreviewModIds = currentWeaponPreviewModIds.filter(
                (id) => id !== modId,
              );
            } else {
              currentWeaponPreviewModIds = [
                ...currentWeaponPreviewModIds,
                modId,
              ];
            }
            renderPreview();
          },
        ),
      ]);
      previewScene?.setWeapon(
        weaponDef,
        ship,
        currentWeaponMountId,
        selectedMods,
      );
      return;
    }

    if (currentKind === "mods") {
      setPreviewAspect(playfieldAspect);
      const registry = getRegistry();
      if (!registry || !currentModDef) {
        previewText.textContent = "Mod preview unavailable.";
        hidePreviewCanvas();
        hidePreviewTabs();
        previewScene?.setMode(null);
        setPanelVisible(previewSection, true);
        setPanelVisible(modIconSection, false);
        destroyModIconPointEditor();
        render(null, modIconCanvasHost);
        return;
      }
      const ships = Object.values(registry.shipsById).sort((a, b) =>
        a.id.localeCompare(b.id),
      );
      const weapons = Object.values(registry.weaponsById).sort((a, b) =>
        a.id.localeCompare(b.id),
      );
      if (ships.length === 0 || weapons.length === 0) {
        previewText.textContent = "Mod preview unavailable.";
        hidePreviewCanvas();
        hidePreviewTabs();
        previewScene?.setMode(null);
        setPanelVisible(previewSection, true);
        setPanelVisible(modIconSection, false);
        destroyModIconPointEditor();
        render(null, modIconCanvasHost);
        return;
      }

      if (!registry.shipsById[currentModPreviewShipId]) {
        currentModPreviewShipId =
          registry.shipsById.starter?.id ?? ships[0]?.id ?? "";
      }
      if (!registry.weaponsById[currentModPreviewWeaponId]) {
        currentModPreviewWeaponId = weapons[0]?.id ?? "";
      }

      const ship = registry.shipsById[currentModPreviewShipId];
      const weapon = registry.weaponsById[currentModPreviewWeaponId];
      if (!ship || !weapon) {
        previewText.textContent = "Mod preview unavailable.";
        hidePreviewCanvas();
        hidePreviewTabs();
        previewScene?.setMode(null);
        setPanelVisible(previewSection, true);
        setPanelVisible(modIconSection, false);
        destroyModIconPointEditor();
        render(null, modIconCanvasHost);
        return;
      }

      const compatibleMounts = ship.mounts.filter((mount) =>
        canMountWeapon(weapon, mount),
      );
      const mountIds =
        compatibleMounts.length > 0
          ? compatibleMounts.map((mount) => mount.id)
          : ship.mounts.map((mount) => mount.id);
      if (!mountIds.includes(currentModPreviewMountId)) {
        currentModPreviewMountId = mountIds[0] ?? "";
      }

      previewText.textContent = "";
      previewCanvasHost.style.display = "";
      setPanelVisible(previewSection, true);
      ensurePreviewGame();
      renderPreviewTabs([
        buildSelectControlGroup(
          "Ship",
          ships.map((entry) => ({ id: entry.id, label: entry.name })),
          currentModPreviewShipId,
          (shipId) => {
            currentModPreviewShipId = shipId;
            currentModPreviewMountId = "";
            renderPreview();
          },
        ),
        buildSelectControlGroup(
          "Weapon",
          weapons.map((entry) => ({ id: entry.id, label: entry.name })),
          currentModPreviewWeaponId,
          (weaponId) => {
            currentModPreviewWeaponId = weaponId;
            currentModPreviewMountId = "";
            renderPreview();
          },
        ),
        buildMountTabsGroup(mountIds, currentModPreviewMountId, (mountId) => {
          currentModPreviewMountId = mountId;
          renderPreview();
        }),
      ]);
      previewScene?.setWeapon(weapon, ship, currentModPreviewMountId, [
        currentModDef,
      ]);
      setPanelVisible(modIconSection, true);
      renderModIconPreview(currentModDef);
      return;
    }

    if (currentKind === "sounds") {
      if (!currentSoundDef) {
        previewText.textContent = "Sound preview unavailable.";
        hidePreviewCanvas();
        hidePreviewTabs();
        setPanelVisible(previewSection, true);
        return;
      }
      const soundDef = currentSoundDef;
      const layerCount = soundDef.layers.length;
      const approxDurationMs = Math.round(getSoundDurationMs(soundDef));
      previewText.textContent = [
        `${soundDef.name ?? soundDef.id}`,
        `Category: ${soundDef.category}`,
        `Layers: ${layerCount}`,
        `Approx length: ${approxDurationMs} ms`,
      ].join("\n");
      hidePreviewCanvas();
      setPanelVisible(previewSection, true);
      renderPreviewTabs([
        buildPreviewControlGroup(
          "Playback",
          <>
            <button
              type="button"
              className="content-editor__preview-tab"
              onClick={() => {
                playSoundPreviewBurst(soundDef, 1);
              }}
            >
              Play
            </button>
            <button
              type="button"
              className="content-editor__preview-tab"
              onClick={() => {
                playSoundPreviewBurst(soundDef, 3);
              }}
            >
              Burst x3
            </button>
            <button
              type="button"
              className="content-editor__preview-tab"
              onClick={() => {
                soundPreviewPlayer.stop();
              }}
            >
              Stop
            </button>
          </>,
        ),
        buildPreviewControlGroup(
          "Pitch",
          <>
            <input
              type="range"
              min={-24}
              max={24}
              step={1}
              value={soundPreviewSemitoneOffset}
              onInput={(event) => {
                soundPreviewSemitoneOffset = Number(event.currentTarget.value);
                renderPreview();
              }}
            />
            <span className="content-editor__preview-empty">
              {soundPreviewSemitoneOffset > 0
                ? `+${soundPreviewSemitoneOffset}`
                : soundPreviewSemitoneOffset}{" "}
              st
            </span>
          </>,
        ),
        buildPreviewControlGroup(
          "Preview Gain",
          <>
            <input
              type="range"
              min={0.2}
              max={2}
              step={0.05}
              value={soundPreviewGainScale}
              onInput={(event) => {
                soundPreviewGainScale = Number(event.currentTarget.value);
                renderPreview();
              }}
            />
            <span className="content-editor__preview-empty">
              {soundPreviewGainScale.toFixed(2)}x
            </span>
          </>,
        ),
      ]);
      return;
    }

    previewText.textContent = "";
    hidePreviewCanvas();
    hidePreviewTabs();
    setPanelVisible(previewSection, false);
    setPanelVisible(modIconSection, false);
    destroyModIconPointEditor();
    render(null, modIconCanvasHost);
    teardownPreviewGame();
  };

  const refreshRegistry = async (): Promise<void> => {
    try {
      registryCache = await fetchRegistry();
      renderPreview();
      applySchema(currentKind);
      renderSchemaDocs(currentKind);
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
    currentModDef = null;
    currentGunDef = null;
    currentGalaxyDef = null;
    currentSoundDef = null;
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
      const entries: ContentEntry[] = [
        {
          data: result.data as WaveContent,
          kind: "waves",
          path: currentPath,
        },
      ];
      const registry = getRegistry();
      if (registry) {
        for (const bullet of Object.values(registry.bulletsById)) {
          entries.push({
            data: bullet,
            kind: "bullets",
            path: `bullets/${bullet.id}.json5`,
          });
        }
      }
      const build = buildContentRegistry(entries);
      currentWaveDef =
        build.registry.wavesById[result.data.id] ??
        (result.data as WaveDefinition);
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
    } else if (kind === "mods") {
      const build = buildContentRegistry([
        {
          data: result.data as ModContent,
          kind: "mods",
          path: currentPath,
        },
      ]);
      currentModDef = build.registry.modsById[result.data.id] ?? null;
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
    } else if (kind === "galaxies") {
      const build = buildContentRegistry([
        {
          data: result.data as GalaxyContent,
          kind: "galaxies",
          path: currentPath,
        },
      ]);
      currentGalaxyDef = build.registry.galaxiesById[result.data.id] ?? null;
      setLevelButtonsEnabled(false);
    } else if (kind === "sounds") {
      currentSoundDef = result.data as SoundContent;
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

  const openFile = async (path: string): Promise<void> => {
    let contents = "";
    try {
      contents = await readContentFile(path);
    } catch {
      renderValidation([`Failed to load ${path}.`]);
      return;
    }
    currentPath = path;
    currentText = contents;
    originalText = contents;
    lastReferencePath = null;
    lastBezierPath = null;
    bezierActive = false;
    referenceSection.style.display = "none";
    modIconSection.style.display = "none";
    fileLabel.textContent = path;
    model.setValue(contents);
    updateDirtyState();
    validateCurrent();
    renderReferencePanel(getActiveReferencePath());
    void refreshRegistry();
  };

  const buildTree = (nodes: ContentTreeNode[], depth = 0): void => {
    const rows: { depth: number; node: ContentTreeNode }[] = [];
    const visit = (entries: ContentTreeNode[], level: number): void => {
      for (const node of entries) {
        rows.push({ depth: level, node });
        if (node.type === "dir" && node.children?.length) {
          visit(node.children, level + 1);
        }
      }
    };
    visit(nodes, depth);
    render(
      <>
        {rows.map((entry) => {
          const className =
            entry.node.type === "file"
              ? "content-editor__tree-row is-file"
              : "content-editor__tree-row";
          return (
            <div
              className={className}
              key={entry.node.path}
              onClick={
                entry.node.type === "file"
                  ? () => void requestOpenFile(entry.node.path)
                  : undefined
              }
              style={{ paddingLeft: `${entry.depth * 12}px` }}
            >
              {entry.node.name}
            </div>
          );
        })}
      </>,
      treeContainer,
    );
  };

  const handleSave = async (): Promise<boolean> => {
    if (!currentPath) return false;
    const contents = editor.getValue();
    currentText = contents;
    try {
      await writeContentFile(currentPath, contents);
    } catch {
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
