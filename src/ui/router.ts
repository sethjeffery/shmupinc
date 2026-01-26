import type Phaser from "phaser";

import {
  clearActiveLevel,
  startLevelSession,
} from "../game/data/levelState";
import { STORY_BEATS } from "../game/data/storyBeats";

export type UiRoute = "gameover" | "hangar" | "menu" | "pause" | "play" | "story";

const DEFAULT_LEVEL_ID = "L1_INTRO";

export interface GameOverStats {
  gold: number;
  wave: number;
}

const isTextTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement
  || target instanceof HTMLTextAreaElement
  || target instanceof HTMLSelectElement
  || (target instanceof HTMLElement && target.isContentEditable);

export class UiRouter {
  private game: Phaser.Game;
  private route: UiRoute = "menu";
  private root: HTMLDivElement;
  private menuOverlay: HTMLDivElement;
  private pauseOverlay: HTMLDivElement;
  private gameOverOverlay: HTMLDivElement;
  private storyOverlay: HTMLDivElement;
  private storyTitle!: HTMLDivElement;
  private storyLines!: HTMLDivElement;
  private storyNextRoute: UiRoute = "menu";
  private storyClearLevelOnExit = false;
  private gameOverStatsText: HTMLDivElement;
  private lastGameOver: GameOverStats = { gold: 0, wave: 0 };

  constructor(game: Phaser.Game) {
    this.game = game;
    this.root = document.createElement("div");
    this.root.className = "ui-root";
    this.menuOverlay = this.buildMenuOverlay();
    this.pauseOverlay = this.buildPauseOverlay();
    this.gameOverOverlay = this.buildGameOverOverlay();
    this.storyOverlay = this.buildStoryOverlay();
    this.gameOverStatsText = this.gameOverOverlay.querySelector(
      ".ui-stats",
    )!;
    this.root.append(
      this.menuOverlay,
      this.pauseOverlay,
      this.gameOverOverlay,
      this.storyOverlay,
    );
    document.body.appendChild(this.root);

    this.root.addEventListener("click", (event) => this.handleClick(event));
    window.addEventListener("keydown", (event) => this.handleKeyDown(event));

    this.game.events.on("ui:route", (route: UiRoute) => this.setRoute(route));
    this.game.events.on("ui:gameover", (stats: GameOverStats) => {
      this.lastGameOver = stats;
      this.setRoute("gameover");
    });
    this.game.events.on(
      "ui:story",
      (payload: {
        beatId: string;
        nextRoute?: UiRoute;
        clearLevelOnExit?: boolean;
      }) => {
        this.openStoryBeat(payload.beatId, payload.nextRoute ?? "menu", {
          clearLevelOnExit: payload.clearLevelOnExit,
        });
      },
    );

    this.setRoute("menu", { force: true });
    this.tryAutoStartLevel();
  }

  setRoute(route: UiRoute, options?: { restart?: boolean; force?: boolean }): void {
    if (this.route === route && !options?.force) return;
    const previous = this.route;
    this.route = route;

    const uiOpen =
      route === "menu"
      || route === "pause"
      || route === "gameover"
      || route === "story";
    document.body.classList.toggle("ui-open", uiOpen);
    document.body.classList.toggle("game-locked", route === "play" || route === "pause");
    this.root.classList.toggle("is-active", uiOpen);

    this.menuOverlay.classList.toggle("is-active", route === "menu");
    this.pauseOverlay.classList.toggle("is-active", route === "pause");
    this.gameOverOverlay.classList.toggle("is-active", route === "gameover");
    this.storyOverlay.classList.toggle("is-active", route === "story");

    if (route === "gameover") {
      this.updateGameOverStats();
    }

    if (route === "play") {
      this.startOrResume(previous, options?.restart ?? false);
      return;
    }

    if (route === "pause") {
      this.pausePlayScene();
      return;
    }

    if (route === "story") {
      this.stopPlayScene();
      this.game.scene.stop("ShopScene");
      return;
    }

    if (route === "hangar") {
      this.stopPlayScene();
      this.game.scene.start("ShopScene");
      return;
    }

    if (route === "menu") {
      this.stopPlayScene();
      clearActiveLevel();
    }
  }

  private startOrResume(previous: UiRoute, restart: boolean): void {
    this.game.scene.stop("ShopScene");
    if (this.game.scene.isActive("BootScene")) {
      this.game.scene.stop("BootScene");
    }
    if (!restart && previous === "pause" && this.game.scene.isPaused("PlayScene")) {
      this.game.scene.resume("PlayScene");
      this.setPlayInputEnabled(true);
      return;
    }
    this.game.scene.start("PlayScene");
    this.setPlayInputEnabled(true);
  }

  private pausePlayScene(): void {
    if (this.game.scene.isActive("PlayScene")) {
      this.game.scene.pause("PlayScene");
      this.setPlayInputEnabled(false);
    }
  }

  private stopPlayScene(): void {
    if (this.game.scene.isActive("PlayScene")) {
      this.game.scene.stop("PlayScene");
    }
  }

  private setPlayInputEnabled(enabled: boolean): void {
    const input = this.game.scene.getScene("PlayScene")?.input;
    if (input) input.enabled = enabled;
  }

  private updateGameOverStats(): void {
    this.gameOverStatsText.textContent = `Wave ${this.lastGameOver.wave}\nGold earned: ${this.lastGameOver.gold}`;
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

  private handleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const action = target.closest<HTMLElement>("[data-action]");
    if (!action) return;
    switch (action.dataset.action) {
      case "start":
        this.startStoryLevel(DEFAULT_LEVEL_ID);
        break;
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
        const levelId = action.dataset.level;
        if (!levelId) break;
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
      this.startStoryLevel(DEFAULT_LEVEL_ID);
    }
  }

  private tryAutoStartLevel(): void {
    const params = new URLSearchParams(window.location.search);
    const levelId = params.get("level");
    if (!levelId) return;
    this.startStoryLevel(levelId);
    window.history.replaceState({}, "", window.location.pathname);
  }

  private buildMenuOverlay(): HTMLDivElement {
    const overlay = document.createElement("div");
    overlay.className = "ui-overlay ui-overlay--menu";
    overlay.appendChild(
      this.buildPanel({
        actions: [
          { action: "start", label: "Start Mission", primary: true },
          { action: "story-level", label: "Story: L1 Intro", levelId: "L1_INTRO", primary: false },
          { action: "story-level", label: "Story: L2 The Squeeze", levelId: "L2_SQUEEZE", primary: false },
          { action: "story-level", label: "Story: L3 Breakthrough", levelId: "L3_BREAKTHROUGH", primary: false },
          { action: "story-level", label: "Story: L4 Deadline", levelId: "L4_DEADLINE", primary: false },
          { action: "story-level", label: "Story: L5 Midboss", levelId: "L5_MIDBOSS", primary: false },
          { action: "story-level", label: "Story: L6 Remix", levelId: "L6_REMIX", primary: false },
          { action: "story-level", label: "Story: L7 Boss", levelId: "L7_BOSS", primary: false },
          { action: "hangar", label: "Hangar", primary: false },
        ],
        hint: "How to play: Drag to move, auto-fire.",
        title: "Shmup Inc",
      }),
    );
    return overlay;
  }

  private buildStoryOverlay(): HTMLDivElement {
    const overlay = document.createElement("div");
    overlay.className = "ui-overlay ui-overlay--story";

    const panel = document.createElement("div");
    panel.className = "story-panel";

    const title = document.createElement("div");
    title.className = "story-title";
    title.textContent = "Mission Brief";

    const lines = document.createElement("div");
    lines.className = "story-lines";

    const actions = document.createElement("div");
    actions.className = "story-actions";
    const continueButton = document.createElement("button");
    continueButton.className = "story-button";
    continueButton.dataset.action = "story-continue";
    continueButton.type = "button";
    continueButton.textContent = "Continue";
    const skipButton = document.createElement("button");
    skipButton.className = "story-skip";
    skipButton.dataset.action = "story-skip";
    skipButton.type = "button";
    skipButton.textContent = "Skip";
    actions.appendChild(continueButton);
    actions.appendChild(skipButton);

    panel.appendChild(title);
    panel.appendChild(lines);
    panel.appendChild(actions);
    overlay.appendChild(panel);

    this.storyTitle = title;
    this.storyLines = lines;
    return overlay;
  }

  private buildPauseOverlay(): HTMLDivElement {
    const overlay = document.createElement("div");
    overlay.className = "ui-overlay ui-overlay--pause";
    overlay.appendChild(
      this.buildPanel({
        actions: [
          { action: "resume", label: "Resume", primary: true },
          { action: "restart", label: "Restart", primary: false },
          { action: "hangar", label: "Hangar", primary: false },
          { action: "quit", label: "Quit to Menu", primary: false },
        ],
        title: "Paused",
      }),
    );
    return overlay;
  }

  private buildGameOverOverlay(): HTMLDivElement {
    const overlay = document.createElement("div");
    overlay.className = "ui-overlay ui-overlay--gameover";
    const panel = this.buildPanel({
      actions: [
        { action: "retry", label: "Retry", primary: true },
        { action: "hangar", label: "Hangar", primary: false },
        { action: "menu", label: "Main Menu", primary: false },
      ],
      title: "Game Over",
    });
    const stats = panel.querySelector(".ui-stats");
    if (stats) stats.textContent = "Wave 0\nGold earned: 0";
    overlay.appendChild(panel);
    return overlay;
  }

  private buildPanel(config: {
    title: string;
    hint?: string;
    actions: { action: string; label: string; levelId?: string; primary: boolean }[];
  }): HTMLDivElement {
    const panel = document.createElement("div");
    panel.className = "ui-panel";

    const title = document.createElement("div");
    title.className = "ui-title";
    title.textContent = config.title;

    const actions = document.createElement("div");
    actions.className = "ui-actions";

    for (const item of config.actions) {
      const button = document.createElement("button");
      button.className = `ui-button${item.primary ? " ui-button--primary" : ""}`;
      button.type = "button";
      button.dataset.action = item.action;
      if (item.levelId) button.dataset.level = item.levelId;
      button.textContent = item.label;
      actions.appendChild(button);
    }

    const stats = document.createElement("div");
    stats.className = "ui-stats";
    stats.textContent = "";

    panel.appendChild(title);
    if (config.title === "Game Over") panel.appendChild(stats);
    panel.appendChild(actions);

    if (config.hint) {
      const hint = document.createElement("div");
      hint.className = "ui-hint";
      hint.textContent = config.hint;
      panel.appendChild(hint);
    }

    return panel;
  }

  private openStoryBeat(
    beatId: string,
    nextRoute: UiRoute,
    options?: { clearLevelOnExit?: boolean },
  ): void {
    const beat = STORY_BEATS[beatId];
    this.storyTitle.textContent = beat?.title ?? "Mission Brief";
    const lines = beat?.lines?.length ? beat.lines : ["Awaiting mission data."];
    const children = lines.map((line) => {
      const node = document.createElement("p");
      node.textContent = line;
      return node;
    });
    this.storyLines.replaceChildren(...children);
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
}
