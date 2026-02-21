import type { DialogMomentView } from "./dialogMomentState";
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
import ProgressionOverlay from "../game/ui/progression/ProgressionOverlay";
import { MenuOverlay } from "../game/ui/title/MenuOverlay";
import { DialogMomentController } from "./dialogMomentController";
import { DialogMomentOverlay } from "./DialogMomentOverlay";
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
  | "progression";

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

interface UiViewSignals {
  dialogMomentComplete: (momentKey: string) => void;
  dialogMomentShouldTransitionOut: (momentKey: string) => boolean;
  dialogMoment: Signal<DialogMomentView | null>;
  gameOver: Signal<GameOverStats>;
  musicEnabled: Signal<boolean>;
  progression: Signal<GalaxyView | null>;
  route: Signal<UiRoute>;
  soundEnabled: Signal<boolean>;
}

const UI_OPEN_ROUTES = new Set<UiRoute>([
  "menu",
  "pause",
  "gameover",
  "progression",
]);

const GAME_LOCK_ROUTES = new Set<UiRoute>(["play", "pause"]);
const APP_VISIBLE_ROUTES = new Set<UiRoute>(["gameover", "pause", "play"]);
const ENGINE_ACTIVE_ROUTES = new Set<UiRoute>(["hangar", "pause", "play"]);

const isUiOpenRoute = (route: UiRoute): boolean => UI_OPEN_ROUTES.has(route);
const isGameLockRoute = (route: UiRoute): boolean =>
  GAME_LOCK_ROUTES.has(route);
const isAppVisibleRoute = (route: UiRoute): boolean =>
  APP_VISIBLE_ROUTES.has(route);
const isEngineActiveRoute = (route: UiRoute): boolean =>
  ENGINE_ACTIVE_ROUTES.has(route);

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
  const dialogMoment = props.signals.dialogMoment.value;

  const renderActiveOverlay = () => {
    switch (route) {
      case "menu":
        return (
          <div
            className={clsx(
              styles.uiOverlay,
              styles.uiOverlayMenu,
              styles.isActive,
            )}
          >
            <MenuOverlay
              musicEnabled={props.signals.musicEnabled.value}
              onAction={props.onAction}
              soundEnabled={props.signals.soundEnabled.value}
            />
          </div>
        );
      case "pause":
        return (
          <div
            className={clsx(
              styles.uiOverlay,
              styles.uiOverlayPause,
              styles.isActive,
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
        );
      case "gameover": {
        const gameOverStats = props.signals.gameOver.value;
        return (
          <div
            className={clsx(
              styles.uiOverlay,
              styles.uiOverlayGameOver,
              styles.isActive,
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
        );
      }
      case "progression": {
        const progression = props.signals.progression.value;
        return (
          <div
            className={clsx(
              styles.uiOverlay,
              styles.uiOverlayProgression,
              styles.isActive,
            )}
          >
            {progression ? (
              <ProgressionOverlay
                onAction={props.onAction}
                view={progression}
              />
            ) : (
              <UiPanel
                actions={[
                  { action: "menu", label: "Main Menu", primary: false },
                ]}
                onAction={props.onAction}
                title="No Galaxy Data"
              />
            )}
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className={clsx(styles.uiRoot, uiOpen ? styles.isActive : undefined)}>
      {renderActiveOverlay()}
      {dialogMoment ? (
        <DialogMomentOverlay
          key={dialogMoment.transitionKey}
          moment={dialogMoment}
          onComplete={(momentKey) => props.signals.dialogMomentComplete(momentKey)}
          shouldTransitionOut={(momentKey) =>
            props.signals.dialogMomentShouldTransitionOut(momentKey)
          }
        />
      ) : null}
    </div>
  );
};

export class UiRouter {
  private readonly audio = getAudioDirector();
  private readonly dialogMomentController: DialogMomentController;
  private disposed = false;
  private game: Phaser.Game;
  private route: UiRoute = "menu";
  private root: HTMLElement;
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
  private readonly handleRouteEvent = (route: UiRoute): void => {
    this.setRoute(route);
  };
  private readonly handleGameOverEvent = (stats: GameOverStats): void => {
    this.gameOverSignal.value = stats;
    this.setRoute("gameover");
  };
  private readonly handleWindowKeyDown = (event: KeyboardEvent): void => {
    this.handleKeyDown(event);
  };

  constructor(game: Phaser.Game) {
    this.game = game;
    this.audio.attachUnlockHandlers();
    const root = document.getElementById("ui-root");
    if (!root) {
      throw new Error("Missing #ui-root host.");
    }
    this.root = root;
    this.dialogMomentController = new DialogMomentController(game);

    this.refreshProgressionView();
    render(
      <UiRoot
        onAction={(action, levelId) => this.handleAction(action, levelId)}
        signals={{
          dialogMoment: this.dialogMomentController.signal,
          dialogMomentComplete: (momentKey) =>
            this.dialogMomentController.complete(momentKey),
          dialogMomentShouldTransitionOut: (momentKey) =>
            this.dialogMomentController.shouldTransitionOut(momentKey),
          gameOver: this.gameOverSignal,
          musicEnabled: this.musicEnabledSignal,
          progression: this.progressionSignal,
          route: this.routeSignal,
          soundEnabled: this.soundEnabledSignal,
        }}
      />,
      this.root,
    );

    window.addEventListener("keydown", this.handleWindowKeyDown);

    this.game.events.on("ui:route", this.handleRouteEvent);
    this.game.events.on("ui:gameover", this.handleGameOverEvent);
    this.game.events.once("destroy", () => this.dispose());

    this.setRoute("menu", { force: true });
    this.tryAutoStartLevel();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener("keydown", this.handleWindowKeyDown);
    this.game.events.off("ui:route", this.handleRouteEvent);
    this.game.events.off("ui:gameover", this.handleGameOverEvent);
    this.dialogMomentController.dispose();
    render(null, this.root);
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
    document.body.classList.toggle("game-active", isAppVisibleRoute(route));
    this.setEngineLoopActive(isEngineActiveRoute(route));

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

  private startLevel(
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
    this.setRoute("hangar");
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
        this.startLevel(launch.levelId, {
          returnRoute: "progression",
          source: {
            galaxyId: launch.galaxyId,
            nodeId: launch.nodeId,
          },
        });
        break;
      }
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
      this.startLevel(levelId);
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    ensureActiveGalaxy();
    this.refreshProgressionView();
    window.history.replaceState({}, "", window.location.pathname);
  }

  private setEngineLoopActive(enabled: boolean): void {
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
