import type Phaser from "phaser";

import { signal, type Signal } from "@preact/signals";
import clsx from "clsx";
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
import { MenuOverlay } from "../game/ui/title/MenuOverlay";
import ProgressionOverlay from "./overlays/ProgressionOverlay";
import {
  openHangarScene,
  pausePlayScene,
  startOrResumePlayScene,
  stopPlayScene,
  stopShopScene,
} from "./router/sceneEffects";

import styles from "./router.module.css";

export type UiRoute =
  | "gameover"
  | "hangar"
  | "menu"
  | "pause"
  | "play"
  | "progression"
  | "story";

interface GameOverStats {
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
  musicEnabled: Signal<boolean>;
  progression: Signal<GalaxyView | null>;
  route: Signal<UiRoute>;
  soundEnabled: Signal<boolean>;
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
const PRIMARY_GAME_ROUTES = new Set<UiRoute>(["hangar", "pause", "play"]);

const isUiOpenRoute = (route: UiRoute): boolean => UI_OPEN_ROUTES.has(route);
const isGameLockRoute = (route: UiRoute): boolean =>
  GAME_LOCK_ROUTES.has(route);
const isPrimaryGameRoute = (route: UiRoute): boolean =>
  PRIMARY_GAME_ROUTES.has(route);

const isTextTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement && target.isContentEditable);

const panelButtonClass = (item: PanelAction): string =>
  clsx(
    styles.uiButton,
    item.primary ? styles.uiButtonPrimary : undefined,
    item.disabled ? styles.uiButtonLocked : undefined,
  );

const UiPanel = (props: {
  actions: PanelAction[];
  hint?: string;
  onAction: (action: string, levelId?: string) => void;
  statsText?: string;
  title: string;
}) => (
  <div className={styles.uiPanel}>
    <div className={styles.uiTitle}>{props.title}</div>
    {props.statsText ? (
      <div className={styles.uiStats}>{props.statsText}</div>
    ) : null}
    <div className={styles.uiActions}>
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
    {props.hint ? <div className={styles.uiHint}>{props.hint}</div> : null}
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
    <div className={clsx(styles.uiRoot, uiOpen ? styles.isActive : undefined)}>
      <div
        className={clsx(
          styles.uiOverlay,
          styles.uiOverlayMenu,
          route === "menu" ? styles.isActive : undefined,
        )}
      >
        {route === "menu" ? (
          <MenuOverlay
            musicEnabled={props.signals.musicEnabled.value}
            onAction={props.onAction}
            soundEnabled={props.signals.soundEnabled.value}
          />
        ) : null}
      </div>

      <div
        className={clsx(
          styles.uiOverlay,
          styles.uiOverlayPause,
          route === "pause" ? styles.isActive : undefined,
        )}
      >
        <UiPanel
          actions={[
            { action: "resume", label: "Resume", primary: true },
            { action: "restart", label: "Restart", primary: false },
            { action: "quit", label: "Quit to Menu", primary: false },
          ]}
          onAction={props.onAction}
          title="Paused"
        />
      </div>

      <div
        className={clsx(
          styles.uiOverlay,
          styles.uiOverlayGameOver,
          route === "gameover" ? styles.isActive : undefined,
        )}
      >
        <UiPanel
          actions={[
            { action: "retry", label: "Retry", primary: true },
            { action: "menu", label: "Main Menu", primary: false },
          ]}
          onAction={props.onAction}
          statsText={`Wave ${gameOverStats.wave}\nGold earned: ${gameOverStats.gold}`}
          title="Game Over"
        />
      </div>

      <div
        className={clsx(
          styles.uiOverlay,
          styles.uiOverlayProgression,
          route === "progression" ? styles.isActive : undefined,
        )}
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
        className={clsx(
          styles.uiOverlay,
          styles.uiOverlayStory,
          route === "story" ? styles.isActive : undefined,
        )}
      >
        <div className={styles.storyPanel}>
          <div className={styles.storyTitle}>{storyBeat.title}</div>
          <div className={styles.storyLines}>
            {storyBeat.lines.map((line, index) => (
              <p key={`${index}-${line}`}>{line}</p>
            ))}
          </div>
          <div className={styles.storyActions}>
            <button
              className={styles.storyButton}
              onClick={() => props.onAction("story-continue")}
              type="button"
            >
              Continue
            </button>
            <button
              className={styles.storySkip}
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
  private readonly musicEnabledSignal = signal<boolean>(
    this.audio.getMusicEnabled(),
  );
  private readonly progressionSignal = signal<GalaxyView | null>(null);
  private readonly gameOverSignal = signal<GameOverStats>({ gold: 0, wave: 0 });
  private readonly soundEnabledSignal = signal<boolean>(
    this.audio.getSoundEnabled(),
  );
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
          musicEnabled: this.musicEnabledSignal,
          progression: this.progressionSignal,
          route: this.routeSignal,
          soundEnabled: this.soundEnabledSignal,
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
    this.setPrimaryGameRendering(isPrimaryGameRoute(route));

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

    if (route === "gameover") {
      stopPlayScene(this.game);
      stopShopScene(this.game);
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
      case "toggle-music": {
        const next = !this.musicEnabledSignal.value;
        this.audio.setMusicEnabled(next);
        this.musicEnabledSignal.value = this.audio.getMusicEnabled();
        break;
      }
      case "toggle-sound": {
        const next = !this.soundEnabledSignal.value;
        this.audio.setSoundEnabled(next);
        this.soundEnabledSignal.value = this.audio.getSoundEnabled();
        break;
      }
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

  private setPrimaryGameRendering(enabled: boolean): void {
    document.body.classList.toggle("play-engine-active", enabled);
    if (enabled) {
      this.game.loop.wake();
      return;
    }
    this.game.loop.sleep();
  }

  private refreshProgressionView(): void {
    ensureActiveGalaxy();
    this.progressionSignal.value = buildActiveGalaxyView();
  }
}
