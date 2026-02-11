import type Phaser from "phaser";

import { signal, type Signal } from "@preact/signals";
import { render } from "preact";

import {
  getFirstUnlockedLevelId,
  getLevelStarCap,
  getLevelStars,
  getStoryLevelOrder,
  isLevelUnlocked,
} from "../game/data/levelProgress";
import { getLevels } from "../game/data/levels";
import { clearActiveLevel, startLevelSession } from "../game/data/levelState";
import { loadSave } from "../game/data/save";
import { STORY_BEATS } from "../game/data/storyBeats";

export type UiRoute =
  | "gameover"
  | "hangar"
  | "menu"
  | "pause"
  | "play"
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

const UiRoot = (props: {
  onAction: (action: string, levelId?: string) => void;
  signals: UiViewSignals;
}) => {
  const route = props.signals.route.value;
  const uiOpen =
    route === "menu" ||
    route === "pause" ||
    route === "gameover" ||
    route === "story";
  const gameOverStats = props.signals.gameOver.value;
  const storyBeat = props.signals.storyBeat.value;

  return (
    <div className={`ui-root${uiOpen ? " is-active" : ""}`}>
      <div
        className={`ui-overlay ui-overlay--menu${route === "menu" ? " is-active" : ""}`}
      >
        <UiPanel
          actions={props.signals.menuActions.value}
          hint="How to play: Drag to move, auto-fire."
          onAction={props.onAction}
          title="Shmup Inc"
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

    this.refreshMenuActions();
    render(
      <UiRoot
        onAction={(action, levelId) => this.handleAction(action, levelId)}
        signals={{
          gameOver: this.gameOverSignal,
          menuActions: this.menuActionsSignal,
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

    if (route === "hangar") {
      this.stopPlayScene();
      void this.openHangar(token);
      return;
    }

    if (route === "menu") {
      this.stopPlayScene();
      this.stopShopScene();
      clearActiveLevel();
      this.refreshMenuActions();
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

  private startStoryLevel(levelId: string): void {
    const session = startLevelSession(levelId);
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
        const firstUnlocked = getFirstUnlockedLevelId();
        if (firstUnlocked) this.startStoryLevel(firstUnlocked);
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
      case "story-level": {
        if (!levelId) break;
        if (!isLevelUnlocked(levelId)) break;
        this.startStoryLevel(levelId);
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
      const firstUnlocked = getFirstUnlockedLevelId();
      if (firstUnlocked) this.startStoryLevel(firstUnlocked);
    }
  }

  private tryAutoStartLevel(): void {
    const params = new URLSearchParams(window.location.search);
    const levelId = params.get("level");
    if (levelId && isLevelUnlocked(levelId)) {
      this.startStoryLevel(levelId);
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    const firstUnlocked = getFirstUnlockedLevelId();
    if (levelId && firstUnlocked) {
      this.startStoryLevel(firstUnlocked);
    }
    window.history.replaceState({}, "", window.location.pathname);
  }

  private buildMenuActions(): PanelAction[] {
    const levels = getLevels();
    const save = loadSave();
    const firstUnlocked = getFirstUnlockedLevelId(save);
    const storyActions = getStoryLevelOrder().map((levelId) => {
      const title = levels[levelId]?.title ?? levelId;
      const unlocked = isLevelUnlocked(levelId, save);
      const stars = getLevelStars(levelId, save);
      const starCap = getLevelStarCap(levelId);
      return {
        action: "story-level",
        disabled: !unlocked,
        label: unlocked
          ? `Story: ${title} (★${stars}/${starCap})`
          : `Story: ${title} (★${stars}/${starCap}) (Locked · Need 1★ prev)`,
        levelId,
        primary: false,
      } satisfies PanelAction;
    });

    return [
      {
        action: "start",
        disabled: !firstUnlocked,
        label: "Start Mission",
        primary: true,
      },
      ...storyActions,
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
}
