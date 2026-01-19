import type Phaser from "phaser";

export type UiRoute = "gameover" | "hangar" | "menu" | "pause" | "play";

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
  private gameOverStatsText: HTMLDivElement;
  private lastGameOver: GameOverStats = { gold: 0, wave: 0 };

  constructor(game: Phaser.Game) {
    this.game = game;
    this.root = document.createElement("div");
    this.root.className = "ui-root";
    this.menuOverlay = this.buildMenuOverlay();
    this.pauseOverlay = this.buildPauseOverlay();
    this.gameOverOverlay = this.buildGameOverOverlay();
    this.gameOverStatsText = this.gameOverOverlay.querySelector(
      ".ui-stats",
    )!;
    this.root.append(this.menuOverlay, this.pauseOverlay, this.gameOverOverlay);
    document.body.appendChild(this.root);

    this.root.addEventListener("click", (event) => this.handleClick(event));
    window.addEventListener("keydown", (event) => this.handleKeyDown(event));

    this.game.events.on("ui:route", (route: UiRoute) => this.setRoute(route));
    this.game.events.on("ui:gameover", (stats: GameOverStats) => {
      this.lastGameOver = stats;
      this.setRoute("gameover");
    });

    this.setRoute("menu", { force: true });
  }

  setRoute(route: UiRoute, options?: { restart?: boolean; force?: boolean }): void {
    if (this.route === route && !options?.force) return;
    const previous = this.route;
    this.route = route;

    const uiOpen = route === "menu" || route === "pause" || route === "gameover";
    document.body.classList.toggle("ui-open", uiOpen);
    this.root.classList.toggle("is-active", uiOpen);

    this.menuOverlay.classList.toggle("is-active", route === "menu");
    this.pauseOverlay.classList.toggle("is-active", route === "pause");
    this.gameOverOverlay.classList.toggle("is-active", route === "gameover");

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

    if (route === "hangar") {
      this.stopPlayScene();
      this.game.scene.start("ShopScene");
      return;
    }

    if (route === "menu") {
      this.stopPlayScene();
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
    const scene = this.game.scene.getScene("PlayScene");
    if (scene && scene.input) scene.input.enabled = enabled;
  }

  private updateGameOverStats(): void {
    this.gameOverStatsText.textContent = `Wave ${this.lastGameOver.wave}\nGold earned: ${this.lastGameOver.gold}`;
  }

  private handleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const action = target.closest<HTMLElement>("[data-action]");
    if (!action) return;
    switch (action.dataset.action) {
      case "start":
        this.setRoute("play");
        break;
      case "hangar":
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
      this.setRoute("play");
    }
  }

  private buildMenuOverlay(): HTMLDivElement {
    const overlay = document.createElement("div");
    overlay.className = "ui-overlay ui-overlay--menu";
    overlay.appendChild(
      this.buildPanel({
        actions: [
          { action: "start", label: "Start Mission", primary: true },
          { action: "hangar", label: "Hangar", primary: false },
        ],
        hint: "How to play: Drag to move, auto-fire.",
        title: "Shmup Inc",
      }),
    );
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
    actions: { action: string; label: string; primary: boolean }[];
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
}
