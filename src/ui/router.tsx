import type Phaser from "phaser";

import { signal, type Signal } from "@preact/signals";
import { render } from "preact";

import { getAudioDirector } from "../game/audio/audioDirector";
import {
  buildActiveGalaxyView,
  ensureActiveGalaxy,
  launchGalaxyNode,
  type GalaxyView,
} from "../game/data/galaxyProgress";
import { clearActiveLevel, startLevelSession } from "../game/data/levelState";
import { STORY_BEATS } from "../game/data/storyBeats";
import ProgressionOverlay from "./overlays/ProgressionOverlay";
import {
  openHangarScene,
  pausePlayScene,
  startOrResumePlayScene,
  stopPlayScene,
  stopShopScene,
} from "./router/sceneEffects";

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

const UI_OPEN_ROUTES = new Set<UiRoute>([
  "menu",
  "pause",
  "gameover",
  "progression",
  "story",
]);

const GAME_LOCK_ROUTES = new Set<UiRoute>(["play", "pause"]);

const isUiOpenRoute = (route: UiRoute): boolean => UI_OPEN_ROUTES.has(route);
const isGameLockRoute = (route: UiRoute): boolean => GAME_LOCK_ROUTES.has(route);

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
      Push through hostile sectors, unlock loadouts, and keep the run clean.
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

const UiRoot = (props: {
  onAction: (action: string, levelId?: string) => void;
  signals: UiViewSignals;
}) => {
  const route = props.signals.route.value;
  const uiOpen = isUiOpenRoute(route);
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
  private readonly audio = getAudioDirector();
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
    this.audio.attachUnlockHandlers();
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
    this.audio.setMusicMode(
      route === "play" || route === "pause" ? "game" : "menu",
    );
    this.audio.setPauseLowPass(route === "pause");

    const uiOpen = isUiOpenRoute(route);
    document.body.classList.toggle("ui-open", uiOpen);
    document.body.classList.toggle("game-locked", isGameLockRoute(route));

    if (route === "play") {
      void startOrResumePlayScene({
        game: this.game,
        previous,
        restart: options?.restart ?? false,
        shouldAbort: () =>
          token !== this.transitionToken || this.route !== "play",
      });
      return;
    }

    if (route === "pause") {
      pausePlayScene(this.game);
      return;
    }

    if (route === "story") {
      stopPlayScene(this.game);
      stopShopScene(this.game);
      return;
    }

    if (route === "progression") {
      stopPlayScene(this.game);
      stopShopScene(this.game);
      this.refreshProgressionView();
      return;
    }

    if (route === "hangar") {
      void openHangarScene({
        game: this.game,
        shouldAbort: () =>
          token !== this.transitionToken || this.route !== "hangar",
      });
      return;
    }

    if (route === "menu") {
      stopPlayScene(this.game);
      stopShopScene(this.game);
      clearActiveLevel();
      this.refreshProgressionView();
    }
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
      (node) => node.id === progression.currentLevelId,
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
