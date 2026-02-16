import type Phaser from "phaser";

import { signal, type Signal } from "@preact/signals";
import { render } from "preact";

import {
  buildActiveGalaxyView,
  ensureActiveGalaxy,
  launchGalaxyNode,
  type GalaxyView,
} from "../game/data/galaxyProgress";
import { clearActiveLevel, startLevelSession } from "../game/data/levelState";
import { STORY_BEATS } from "../game/data/storyBeats";

export type UiRoute =
  | "gameover"
  | "hangar"
  | "menu"
  | "pause"
  | "play"
  | "progression"
  | "story";

export interface GameOverStats {
  gold: number;
  wave: number;
}

interface PanelAction {
  action: string;
  disabled?: boolean;
  label: string;
  levelId?: string;
  primary: boolean;
}

interface StoryBeatView {
  lines: string[];
  title: string;
}

interface UiViewSignals {
  gameOver: Signal<GameOverStats>;
  menuActions: Signal<PanelAction[]>;
  progression: Signal<GalaxyView | null>;
  route: Signal<UiRoute>;
  storyBeat: Signal<StoryBeatView>;
}

const isTextTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement && target.isContentEditable);

const panelButtonClass = (item: PanelAction): string =>
  `ui-button${item.primary ? " ui-button--primary" : ""}${
    item.disabled ? " ui-button--locked" : ""
  }`;

const UiPanel = (props: {
  actions: PanelAction[];
  hint?: string;
  onAction: (action: string, levelId?: string) => void;
  statsText?: string;
  title: string;
}) => (
  <div className="ui-panel">
    <div className="ui-title">{props.title}</div>
    {props.statsText ? <div className="ui-stats">{props.statsText}</div> : null}
    <div className="ui-actions">
      {props.actions.map((item) => (
        <button
          className={panelButtonClass(item)}
          disabled={Boolean(item.disabled)}
          onClick={() => props.onAction(item.action, item.levelId)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
    {props.hint ? <div className="ui-hint">{props.hint}</div> : null}
  </div>
);

const MenuOverlay = (props: {
  actions: PanelAction[];
  onAction: (action: string, levelId?: string) => void;
}) => (
  <div className="menu-shell">
    <div className="menu-shell__halo" />
    <div className="menu-shell__grid" />
    <div className="menu-shell__badge">Vector Combat Campaign</div>
    <div className="menu-shell__title">Shmup Inc</div>
    <div className="menu-shell__subtitle">
      Push through branching sectors, unlock loadouts, and keep the run clean.
    </div>
    <div className="menu-shell__divider" />
    <div className="ui-actions menu-shell__actions">
      {props.actions.map((item) => (
        <button
          className={panelButtonClass(item)}
          disabled={Boolean(item.disabled)}
          onClick={() => props.onAction(item.action, item.levelId)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
    <div className="menu-shell__hint">
      Drag to move. Auto-fire engages on hold.
    </div>
  </div>
);

const PROGRESSION_MAP_WIDTH = 1000;
const PROGRESSION_MAP_HEIGHT = 640;

interface AmbientStar {
  cx: number;
  cy: number;
  delaySec: number;
  durationSec: number;
  opacity: number;
  r: number;
}

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createRng = (seedValue: number): (() => number) => {
  let seed = seedValue >>> 0;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const sanitizeSvgId = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_-]/g, "-");

const buildAmbientStars = (galaxyId: string): AmbientStar[] => {
  const rand = createRng(hashString(`stars:${galaxyId}`));
  const stars: AmbientStar[] = [];
  for (let index = 0; index < 92; index += 1) {
    stars.push({
      cx: rand() * PROGRESSION_MAP_WIDTH,
      cy: rand() * PROGRESSION_MAP_HEIGHT,
      delaySec: rand() * 8,
      durationSec: 2.8 + rand() * 8.6,
      opacity: 0.2 + rand() * 0.7,
      r: rand() > 0.88 ? 2 + rand() * 2 : 0.7 + rand() * 1.4,
    });
  }
  return stars;
};

const ProgressionOverlay = (props: {
  onAction: (action: string, levelId?: string) => void;
  view: GalaxyView;
}) => {
  const svgPrefix = `progression-${sanitizeSvgId(props.view.id)}`;
  const ambientStars = buildAmbientStars(props.view.id);
  const nodeById = new Map(props.view.nodes.map((node) => [node.id, node]));
  return (
    <div className="progression-shell">
      <div className="progression-map-frame">
        <svg
          className="progression-map"
          viewBox={`0 0 ${PROGRESSION_MAP_WIDTH} ${PROGRESSION_MAP_HEIGHT}`}
        >
          <defs>
            <linearGradient id={`${svgPrefix}-edge-active`} x1="0%" x2="100%">
              <stop offset="0%" stopColor="rgba(125, 249, 255, 0.25)" />
              <stop offset="100%" stopColor="rgba(125, 249, 255, 0.8)" />
            </linearGradient>
          </defs>

          <g className="progression-ambient" aria-hidden="true">
            {ambientStars.map((star, index) => (
              <circle
                className="progression-ambient-star"
                cx={star.cx}
                cy={star.cy}
                key={`ambient-star-${index}`}
                r={star.r}
                style={{
                  animationDelay: `${star.delaySec.toFixed(2)}s`,
                  animationDuration: `${star.durationSec.toFixed(2)}s`,
                  opacity: star.opacity,
                }}
              />
            ))}
          </g>

          {props.view.edges.map((edge) => {
            const from = nodeById.get(edge.from);
            const to = nodeById.get(edge.to);
            if (!from || !to) return null;
            const x1 = from.pos.x * PROGRESSION_MAP_WIDTH;
            const y1 = from.pos.y * PROGRESSION_MAP_HEIGHT;
            const x2 = to.pos.x * PROGRESSION_MAP_WIDTH;
            const y2 = to.pos.y * PROGRESSION_MAP_HEIGHT;
            const className = `progression-edge${
              edge.isCompleted
                ? " is-complete"
                : edge.isUnlocked
                  ? " is-unlocked"
                  : ""
            }`;
            return (
              <line
                className={className}
                key={`${edge.from}-${edge.to}`}
                stroke={
                  edge.isCompleted
                    ? undefined
                    : edge.isUnlocked
                      ? `url(#${svgPrefix}-edge-active)`
                      : undefined
                }
                x1={x1}
                x2={x2}
                y1={y1}
                y2={y2}
              />
            );
          })}
          {props.view.nodes.map((node) => {
            const x = node.pos.x * PROGRESSION_MAP_WIDTH;
            const y = node.pos.y * PROGRESSION_MAP_HEIGHT;
            const className = `progression-node${
              node.isCompleted ? " is-complete" : ""
            }${node.isCurrent ? " is-current" : ""}${
              node.isBranchChoice ? " is-branch-choice" : ""
            }${node.isUnlocked ? " is-unlocked" : " is-locked"}${
              node.isSelectable || node.isReplayable ? " is-actionable" : ""
            }`;
            return (
              <g
                className={className}
                key={node.id}
                onClick={() => {
                  if (!node.isSelectable && !node.isReplayable) return;
                  props.onAction("galaxy-node", node.id);
                }}
                role="button"
                tabIndex={0}
              >
                <circle cx={x} cy={y} r={20} />
                <text className="progression-node-label" x={x} y={y + 40}>
                  {node.name}
                </text>
                <text className="progression-node-stars" x={x} y={y + 58}>
                  {`★${node.stars}/${node.starCap}`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="progression-side">
        <div className="progression-title">{props.view.name}</div>
        {props.view.description ? (
          <div className="progression-description">
            {props.view.description}
          </div>
        ) : null}
        <div className="progression-status">
          {props.view.isComplete
            ? "Galaxy Complete"
            : props.view.currentNodeId
              ? "Current node selected. Clear it to advance."
              : props.view.branchChoiceNodeIds.length > 0
                ? "Branch point reached. Choose your next route."
                : "Campaign state ready."}
        </div>
        <div className="ui-actions">
          {props.view.nodes
            .filter((node) => node.isCurrent || node.isBranchChoice)
            .map((node, index) => (
              <button
                key={`launch-${node.id}`}
                className={`ui-button${index === 0 ? " ui-button--primary" : ""}`}
                onClick={() => props.onAction("galaxy-node", node.id)}
                type="button"
              >
                {node.isCurrent ? `Launch ${node.name}` : `Choose ${node.name}`}
              </button>
            ))}
          <button
            className="ui-button"
            onClick={() => props.onAction("menu")}
            type="button"
          >
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
};

const UiRoot = (props: {
  onAction: (action: string, levelId?: string) => void;
  signals: UiViewSignals;
}) => {
  const route = props.signals.route.value;
  const uiOpen =
    route === "menu" ||
    route === "pause" ||
    route === "gameover" ||
    route === "progression" ||
    route === "story";
  const gameOverStats = props.signals.gameOver.value;
  const progression = props.signals.progression.value;
  const storyBeat = props.signals.storyBeat.value;

  return (
    <div className={`ui-root${uiOpen ? " is-active" : ""}`}>
      <div
        className={`ui-overlay ui-overlay--menu${route === "menu" ? " is-active" : ""}`}
      >
        <MenuOverlay
          actions={props.signals.menuActions.value}
          onAction={props.onAction}
        />
      </div>

      <div
        className={`ui-overlay ui-overlay--pause${route === "pause" ? " is-active" : ""}`}
      >
        <UiPanel
          actions={[
            { action: "resume", label: "Resume", primary: true },
            { action: "restart", label: "Restart", primary: false },
            { action: "hangar", label: "Hangar", primary: false },
            { action: "quit", label: "Quit to Menu", primary: false },
          ]}
          onAction={props.onAction}
          title="Paused"
        />
      </div>

      <div
        className={`ui-overlay ui-overlay--gameover${route === "gameover" ? " is-active" : ""}`}
      >
        <UiPanel
          actions={[
            { action: "retry", label: "Retry", primary: true },
            { action: "hangar", label: "Hangar", primary: false },
            { action: "menu", label: "Main Menu", primary: false },
          ]}
          onAction={props.onAction}
          statsText={`Wave ${gameOverStats.wave}\nGold earned: ${gameOverStats.gold}`}
          title="Game Over"
        />
      </div>

      <div
        className={`ui-overlay ui-overlay--progression${route === "progression" ? " is-active" : ""}`}
      >
        {progression ? (
          <ProgressionOverlay onAction={props.onAction} view={progression} />
        ) : (
          <UiPanel
            actions={[{ action: "menu", label: "Main Menu", primary: false }]}
            onAction={props.onAction}
            title="No Galaxy Data"
          />
        )}
      </div>

      <div
        className={`ui-overlay ui-overlay--story${route === "story" ? " is-active" : ""}`}
      >
        <div className="story-panel">
          <div className="story-title">{storyBeat.title}</div>
          <div className="story-lines">
            {storyBeat.lines.map((line, index) => (
              <p key={`${index}-${line}`}>{line}</p>
            ))}
          </div>
          <div className="story-actions">
            <button
              className="story-button"
              onClick={() => props.onAction("story-continue")}
              type="button"
            >
              Continue
            </button>
            <button
              className="story-skip"
              onClick={() => props.onAction("story-skip")}
              type="button"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export class UiRouter {
  private game: Phaser.Game;
  private route: UiRoute = "menu";
  private root: HTMLElement;
  private storyNextRoute: UiRoute = "menu";
  private storyClearLevelOnExit = false;
  private transitionToken = 0;
  private readonly routeSignal = signal<UiRoute>("menu");
  private readonly menuActionsSignal = signal<PanelAction[]>([]);
  private readonly progressionSignal = signal<GalaxyView | null>(null);
  private readonly gameOverSignal = signal<GameOverStats>({ gold: 0, wave: 0 });
  private readonly storyBeatSignal = signal<StoryBeatView>({
    lines: ["Awaiting mission data."],
    title: "Mission Brief",
  });

  constructor(game: Phaser.Game) {
    this.game = game;
    const root = document.getElementById("ui-root");
    if (!root) {
      throw new Error("Missing #ui-root host.");
    }
    this.root = root;

    this.refreshProgressionView();
    render(
      <UiRoot
        onAction={(action, levelId) => this.handleAction(action, levelId)}
        signals={{
          gameOver: this.gameOverSignal,
          menuActions: this.menuActionsSignal,
          progression: this.progressionSignal,
          route: this.routeSignal,
          storyBeat: this.storyBeatSignal,
        }}
      />,
      this.root,
    );

    window.addEventListener("keydown", (event) => this.handleKeyDown(event));

    this.game.events.on("ui:route", (route: UiRoute) => this.setRoute(route));
    this.game.events.on("ui:gameover", (stats: GameOverStats) => {
      this.gameOverSignal.value = stats;
      this.setRoute("gameover");
    });
    this.game.events.on(
      "ui:story",
      (payload: {
        beatId: string;
        clearLevelOnExit?: boolean;
        nextRoute?: UiRoute;
      }) => {
        this.openStoryBeat(payload.beatId, payload.nextRoute ?? "menu", {
          clearLevelOnExit: payload.clearLevelOnExit,
        });
      },
    );

    this.setRoute("menu", { force: true });
    this.tryAutoStartLevel();
  }

  setRoute(
    route: UiRoute,
    options?: { force?: boolean; restart?: boolean },
  ): void {
    if (this.route === route && !options?.force) return;
    const token = ++this.transitionToken;
    const previous = this.route;
    this.route = route;
    this.routeSignal.value = route;

    const uiOpen =
      route === "menu" ||
      route === "pause" ||
      route === "gameover" ||
      route === "progression" ||
      route === "story";
    document.body.classList.toggle("ui-open", uiOpen);
    document.body.classList.toggle(
      "game-locked",
      route === "play" || route === "pause",
    );

    if (route === "play") {
      void this.startOrResume(previous, options?.restart ?? false, token);
      return;
    }

    if (route === "pause") {
      this.pausePlayScene();
      return;
    }

    if (route === "story") {
      this.stopPlayScene();
      this.stopShopScene();
      return;
    }

    if (route === "progression") {
      this.stopPlayScene();
      this.stopShopScene();
      this.refreshProgressionView();
      return;
    }

    if (route === "hangar") {
      this.stopPlayScene();
      void this.openHangar(token);
      return;
    }

    if (route === "menu") {
      this.stopPlayScene();
      this.stopShopScene();
      clearActiveLevel();
      this.refreshProgressionView();
    }
  }

  private async startOrResume(
    previous: UiRoute,
    restart: boolean,
    token: number,
  ): Promise<void> {
    await this.ensureSceneLoaded("PlayScene");
    await this.ensureSceneLoaded("ShopScene");
    if (token !== this.transitionToken || this.route !== "play") return;
    this.game.scene.stop("ShopScene");
    if (this.game.scene.isActive("BootScene")) {
      this.game.scene.stop("BootScene");
    }
    if (
      !restart &&
      previous === "pause" &&
      this.game.scene.isPaused("PlayScene")
    ) {
      this.game.scene.resume("PlayScene");
      this.setPlayInputEnabled(true);
      return;
    }
    this.game.scene.start("PlayScene");
    this.setPlayInputEnabled(true);
  }

  private async openHangar(token: number): Promise<void> {
    await this.ensureSceneLoaded("ShopScene");
    if (token !== this.transitionToken || this.route !== "hangar") return;
    this.stopPlayScene();
    this.game.scene.start("ShopScene");
  }

  private async ensureSceneLoaded(
    sceneKey: "PlayScene" | "ShopScene",
  ): Promise<void> {
    if (this.sceneExists(sceneKey)) return;
    if (sceneKey === "PlayScene") {
      const { PlayScene } = await import("../game/scenes/PlayScene");
      if (!this.sceneExists(sceneKey)) {
        this.game.scene.add(sceneKey, PlayScene, false);
      }
      return;
    }
    const { ShopScene } = await import("../game/scenes/ShopScene");
    if (!this.sceneExists(sceneKey)) {
      this.game.scene.add(sceneKey, ShopScene, false);
    }
  }

  private sceneExists(sceneKey: string): boolean {
    const manager = this.game.scene as Phaser.Scenes.SceneManager & {
      keys?: Record<string, Phaser.Scene | undefined>;
    };
    return Boolean(manager.keys?.[sceneKey]);
  }

  private pausePlayScene(): void {
    if (this.game.scene.isActive("PlayScene")) {
      this.game.scene.pause("PlayScene");
      this.setPlayInputEnabled(false);
    }
  }

  private stopPlayScene(): void {
    if (
      this.sceneExists("PlayScene") &&
      this.game.scene.isActive("PlayScene")
    ) {
      this.game.scene.stop("PlayScene");
    }
  }

  private stopShopScene(): void {
    if (
      this.sceneExists("ShopScene") &&
      this.game.scene.isActive("ShopScene")
    ) {
      this.game.scene.stop("ShopScene");
    }
  }

  private setPlayInputEnabled(enabled: boolean): void {
    if (!this.sceneExists("PlayScene")) return;
    const input = this.game.scene.getScene("PlayScene")?.input;
    if (input) input.enabled = enabled;
  }

  private startStoryLevel(
    levelId: string,
    options?: {
      returnRoute?: UiRoute;
      source?: { galaxyId?: string; nodeId?: string };
    },
  ): void {
    const returnRoute =
      options?.returnRoute === "progression" ? "progression" : "menu";
    const session = startLevelSession(levelId, {
      returnRoute,
      source: options?.source,
    });
    const level = session?.level;
    if (!level) {
      this.setRoute("menu");
      return;
    }
    if (level.preBeatId) {
      this.openStoryBeat(level.preBeatId, "hangar");
    } else {
      this.setRoute("hangar");
    }
  }

  private handleAction(action: string, levelId?: string): void {
    switch (action) {
      case "start": {
        this.setRoute("progression");
        break;
      }
      case "progression": {
        this.setRoute("progression");
        break;
      }
      case "hangar":
        clearActiveLevel();
        this.setRoute("hangar");
        break;
      case "resume":
        this.setRoute("play");
        break;
      case "restart":
        this.setRoute("play", { restart: true });
        break;
      case "quit":
        this.setRoute("menu");
        break;
      case "retry":
        this.setRoute("play", { restart: true });
        break;
      case "menu":
        this.setRoute("menu");
        break;
      case "galaxy-node": {
        if (!levelId) break;
        const launch = launchGalaxyNode(levelId);
        if (!launch) break;
        this.startStoryLevel(launch.levelId, {
          returnRoute: "progression",
          source: {
            galaxyId: launch.galaxyId,
            nodeId: launch.nodeId,
          },
        });
        break;
      }
      case "story-continue":
      case "story-skip":
        this.resolveStory();
        break;
      default:
        break;
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (isTextTarget(event.target)) return;
    if (event.key === "Escape") {
      if (this.route === "play") {
        this.setRoute("pause");
        return;
      }
      if (this.route === "pause") {
        this.setRoute("play");
        return;
      }
    }
    if (event.key === "Enter" && this.route === "menu") {
      this.setRoute("progression");
    }
  }

  private tryAutoStartLevel(): void {
    const params = new URLSearchParams(window.location.search);
    const levelId = params.get("level");
    if (levelId) {
      this.startStoryLevel(levelId);
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    ensureActiveGalaxy();
    this.refreshProgressionView();
    window.history.replaceState({}, "", window.location.pathname);
  }

  private buildMenuActions(): PanelAction[] {
    const progression = buildActiveGalaxyView();
    const currentNode = progression?.nodes.find(
      (node) => node.id === progression.currentNodeId,
    );
    return [
      {
        action: currentNode ? "galaxy-node" : "progression",
        disabled: !progression,
        label: currentNode ? `Continue: ${currentNode.name}` : "Open Star Map",
        levelId: currentNode?.id,
        primary: true,
      },
      { action: "progression", label: "Campaign Map", primary: false },
      { action: "hangar", label: "Hangar", primary: false },
    ];
  }

  private openStoryBeat(
    beatId: string,
    nextRoute: UiRoute,
    options?: { clearLevelOnExit?: boolean },
  ): void {
    const beat = STORY_BEATS[beatId];
    this.storyBeatSignal.value = {
      lines: beat?.lines?.length ? beat.lines : ["Awaiting mission data."],
      title: beat?.title ?? "Mission Brief",
    };
    this.storyNextRoute = nextRoute;
    this.storyClearLevelOnExit = options?.clearLevelOnExit ?? false;
    this.setRoute("story", { force: true });
  }

  private resolveStory(): void {
    if (this.storyClearLevelOnExit) {
      clearActiveLevel();
    }
    this.setRoute(this.storyNextRoute, { force: true });
  }

  private refreshMenuActions(): void {
    this.menuActionsSignal.value = this.buildMenuActions();
  }

  private refreshProgressionView(): void {
    ensureActiveGalaxy();
    this.progressionSignal.value = buildActiveGalaxyView();
    this.refreshMenuActions();
  }
}
