import type { BulletKind } from "../data/scripts";

import Phaser from "phaser";

import { loadSave, persistSave, type SaveData } from "../data/save";
import {
  SECONDARY_WEAPONS,
  type SecondaryWeaponId,
} from "../data/secondaryWeapons";
import { SHIPS, type ShipId, type ShipShape } from "../data/ships";
import { WEAPONS, type WeaponId } from "../data/weapons";
import { drawShipToCanvas } from "../render/shipShapes";
import { PreviewScene } from "./PreviewScene";

type ShopItemType = "primary" | "secondary" | "ship";

type ShopCategory = "primary" | "secondary" | "ships";

type ShopCardState = "equipped" | "locked" | "owned";

type TabIcon = "play" | "primary" | "secondary" | "ship";

const formatColor = (color: number): string =>
  `#${color.toString(16).padStart(6, "0")}`;

export class ShopScene extends Phaser.Scene {
  private save!: SaveData;
  private overlay?: HTMLDivElement;
  private goldText?: HTMLDivElement;
  private goldFooterText?: HTMLSpanElement;
  private catalogTitle?: HTMLDivElement;
  private catalogGrid?: HTMLDivElement;
  private previewRoot?: HTMLDivElement;
  private previewGame?: Phaser.Game;
  private previewScene?: PreviewScene;
  private resizeObserver?: ResizeObserver;
  private currentCategory: ShopCategory = "ships";
  private tabButtons: Partial<Record<ShopCategory, HTMLButtonElement>> = {};
  private statHull?: HTMLSpanElement;
  private statSpeed?: HTMLSpanElement;
  private statMagnet?: HTMLSpanElement;
  private handleClickBound = (event: MouseEvent) =>
    this.handleOverlayClick(event);

  constructor() {
    super("ShopScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#05060a");
    this.save = loadSave();
    this.showOverlay();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.hideOverlay());
  }

  private showOverlay(): void {
    if (this.overlay) return;
    this.overlay = this.buildOverlay();
    document.body.classList.add("shop-open");
    document.body.appendChild(this.overlay);
    this.overlay.addEventListener("click", this.handleClickBound);
    this.refreshOverlay();
    this.setupPreviewGame();
  }

  private hideOverlay(): void {
    if (!this.overlay) return;
    this.teardownPreviewGame();
    this.overlay.removeEventListener("click", this.handleClickBound);
    this.overlay.remove();
    this.overlay = undefined;
    this.goldText = undefined;
    this.goldFooterText = undefined;
    this.catalogTitle = undefined;
    this.catalogGrid = undefined;
    this.previewRoot = undefined;
    this.tabButtons = {};
    this.statHull = undefined;
    this.statSpeed = undefined;
    this.statMagnet = undefined;
    document.body.classList.remove("shop-open");
  }

  private buildOverlay(): HTMLDivElement {
    const overlay = document.createElement("div");
    overlay.className = "shop-overlay";

    const panel = document.createElement("div");
    panel.className = "shop-panel";

    const header = document.createElement("div");
    header.className = "shop-header";

    const title = document.createElement("div");
    title.className = "shop-title";
    title.textContent = "Hangar Exchange";

    const gold = document.createElement("div");
    gold.className = "shop-gold";
    gold.textContent = "Gold: 0";

    header.appendChild(title);
    header.appendChild(gold);

    const deck = document.createElement("div");
    deck.className = "shop-deck";

    const left = document.createElement("div");
    left.className = "shop-left";

    const previewCard = document.createElement("div");
    previewCard.className = "shop-preview-card";
    const previewRoot = document.createElement("div");
    previewRoot.className = "shop-preview-canvas";
    previewCard.appendChild(previewRoot);

    const stats = document.createElement("div");
    stats.className = "shop-stats";
    const { stat: hullStat, value: hullValue } = this.createStat("Hull");
    const { stat: speedStat, value: speedValue } = this.createStat("Thrust");
    const { stat: magnetStat, value: magnetValue } = this.createStat("Magnet");
    stats.appendChild(hullStat);
    stats.appendChild(speedStat);
    stats.appendChild(magnetStat);

    const cta = document.createElement("div");
    cta.className = "shop-cta";
    const playButton = document.createElement("button");
    playButton.className = "shop-play";
    playButton.type = "button";
    playButton.dataset.action = "deploy";
    const playIcon = document.createElement("span");
    playIcon.className = "shop-play-icon";
    const playLabel = document.createElement("span");
    playLabel.className = "shop-play-label";
    playLabel.textContent = "Start Mission";
    playButton.appendChild(playIcon);
    playButton.appendChild(playLabel);

    const ctaMeta = document.createElement("div");
    ctaMeta.className = "shop-cta-meta";
    const goldFooter = document.createElement("span");
    goldFooter.className = "shop-cta-gold";
    goldFooter.textContent = "Gold: 0";
    const hint = document.createElement("span");
    hint.className = "shop-cta-hint";
    hint.textContent = "Select items to equip for free.";
    ctaMeta.appendChild(goldFooter);
    ctaMeta.appendChild(hint);

    cta.appendChild(playButton);
    cta.appendChild(ctaMeta);

    left.appendChild(previewCard);
    left.appendChild(stats);
    left.appendChild(cta);

    const right = document.createElement("div");
    right.className = "shop-right";

    const tabs = document.createElement("div");
    tabs.className = "shop-tabs";
    const shipsTab = this.createTabButton("Ships", "show-ships", "ship");
    const primaryTab = this.createTabButton(
      "Primary",
      "show-primary",
      "primary",
    );
    const secondaryTab = this.createTabButton(
      "Secondary",
      "show-secondary",
      "secondary",
    );
    tabs.appendChild(shipsTab);
    tabs.appendChild(primaryTab);
    tabs.appendChild(secondaryTab);

    const content = document.createElement("div");
    content.className = "shop-content";
    const contentHeader = document.createElement("div");
    contentHeader.className = "shop-content-header";
    const catalogTitle = document.createElement("div");
    catalogTitle.className = "shop-section-title";
    const contentNote = document.createElement("div");
    contentNote.className = "shop-content-note";
    contentNote.textContent = "Equip anything you own at no cost.";
    contentHeader.appendChild(catalogTitle);
    contentHeader.appendChild(contentNote);

    const catalogGrid = document.createElement("div");
    catalogGrid.className = "shop-grid";

    content.appendChild(contentHeader);
    content.appendChild(catalogGrid);

    right.appendChild(tabs);
    right.appendChild(content);

    deck.appendChild(left);
    deck.appendChild(right);

    panel.appendChild(header);
    panel.appendChild(deck);

    overlay.appendChild(panel);

    this.goldText = gold;
    this.goldFooterText = goldFooter;
    this.catalogTitle = catalogTitle;
    this.catalogGrid = catalogGrid;
    this.previewRoot = previewRoot;
    this.tabButtons = {
      primary: primaryTab,
      secondary: secondaryTab,
      ships: shipsTab,
    };
    this.statHull = hullValue;
    this.statSpeed = speedValue;
    this.statMagnet = magnetValue;

    return overlay;
  }

  private createStat(label: string): {
    stat: HTMLDivElement;
    value: HTMLSpanElement;
  } {
    const stat = document.createElement("div");
    stat.className = "shop-stat";
    const strong = document.createElement("strong");
    strong.textContent = label;
    const value = document.createElement("span");
    value.textContent = "--";
    stat.appendChild(strong);
    stat.appendChild(value);
    return { stat, value };
  }

  private createTabButton(
    label: string,
    action: string,
    icon: TabIcon,
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = "shop-tab";
    button.type = "button";
    button.dataset.action = action;

    const iconSpan = document.createElement("span");
    iconSpan.className = `shop-tab-icon shop-tab-icon--${icon}`;
    if (icon === "ship") {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.classList.add("shop-tab-icon-svg");
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      path.setAttribute(
        "d",
        "M12 2 L17.5 8.5 L21 7.8 L21 18.8 L12 17 L3 18.8 L3 7.8 L6.5 8.5 Z",
      );
      svg.appendChild(path);
      iconSpan.appendChild(svg);
    }

    const labelSpan = document.createElement("span");
    labelSpan.className = "shop-tab-label";
    labelSpan.textContent = label;

    button.appendChild(iconSpan);
    button.appendChild(labelSpan);
    return button;
  }

  private refreshOverlay(): void {
    if (
      !this.overlay ||
      !this.catalogGrid ||
      !this.catalogTitle ||
      !this.goldText
    )
      return;
    const goldValue = `Gold: ${this.save.gold}`;
    this.goldText.textContent = goldValue;
    if (this.goldFooterText) this.goldFooterText.textContent = goldValue;

    for (const [key, button] of Object.entries(this.tabButtons)) {
      button?.classList.toggle("is-active", key === this.currentCategory);
    }

    const { cards, title } = this.buildCategoryCards(this.currentCategory);
    this.catalogTitle.textContent = title;
    this.catalogGrid.replaceChildren(...cards);
    this.updateStats();
    this.applyPreviewLoadout();
  }

  private updateStats(): void {
    const ship = SHIPS[this.save.selectedShipId];
    if (this.statHull) this.statHull.textContent = `${ship.maxHp}`;
    if (this.statSpeed)
      this.statSpeed.textContent = `${ship.moveSpeed.toFixed(1)}`;
    if (this.statMagnet) {
      const magnet = Math.round((ship.magnetMultiplier ?? 1) * 100);
      this.statMagnet.textContent = `${magnet}%`;
    }
  }

  private buildCategoryCards(category: ShopCategory): {
    cards: HTMLElement[];
    title: string;
  } {
    switch (category) {
      case "primary":
        return {
          cards: this.buildPrimaryWeaponCards(),
          title: "Primary Weapons",
        };
      case "secondary":
        return {
          cards: this.buildSecondaryWeaponCards(),
          title: "Secondary Weapons",
        };
      case "ships":
      default:
        return { cards: this.buildShipCards(), title: "Ships" };
    }
  }

  private buildShipCards(): HTMLElement[] {
    return Object.values(SHIPS)
      .sort((a, b) => a.cost - b.cost)
      .map((ship) => {
        const owned = this.save.unlockedShips.includes(ship.id);
        const selected = this.save.selectedShipId === ship.id;
        const state: ShopCardState = selected
          ? "equipped"
          : owned
            ? "owned"
            : "locked";
        const status = selected
          ? "Equipped"
          : owned
            ? "Owned"
            : `${ship.cost}g`;
        return this.buildCard({
          accent: formatColor(ship.color),
          description: ship.description,
          iconKind: "ship",
          id: ship.id,
          name: ship.name,
          shipShape: ship.shape,
          state,
          status,
          type: "ship",
        });
      });
  }

  private buildPrimaryWeaponCards(): HTMLElement[] {
    return Object.values(WEAPONS)
      .sort((a, b) => a.cost - b.cost)
      .map((weapon) => {
        const owned = this.save.unlockedWeapons.includes(weapon.id);
        const selected = this.save.selectedWeaponId === weapon.id;
        const state: ShopCardState = selected
          ? "equipped"
          : owned
            ? "owned"
            : "locked";
        const status = selected
          ? "Equipped"
          : owned
            ? "Owned"
            : `${weapon.cost}g`;
        return this.buildCard({
          accent: formatColor(weapon.bullet.color ?? 0x7df9ff),
          description: weapon.description,
          iconKind: weapon.bullet.kind,
          id: weapon.id,
          name: weapon.name,
          state,
          status,
          type: "primary",
        });
      });
  }

  private buildSecondaryWeaponCards(): HTMLElement[] {
    return Object.values(SECONDARY_WEAPONS)
      .sort((a, b) => a.cost - b.cost)
      .map((weapon) => {
        const owned = this.save.unlockedSecondaryWeapons.includes(weapon.id);
        const selected = this.save.selectedSecondaryWeaponId === weapon.id;
        const state: ShopCardState = selected
          ? "equipped"
          : owned
            ? "owned"
            : "locked";
        const status = selected
          ? "Equipped"
          : owned
            ? "Owned"
            : `${weapon.cost}g`;
        return this.buildCard({
          accent: formatColor(weapon.bullet.color ?? 0x7df9ff),
          description: weapon.description,
          iconKind: weapon.bullet.kind,
          id: weapon.id,
          name: weapon.name,
          state,
          status,
          type: "secondary",
        });
      });
  }

  private buildCard(data: {
    accent: string;
    description: string;
    iconKind: "ship" | BulletKind;
    id: SecondaryWeaponId | ShipId | WeaponId;
    name: string;
    shipShape?: ShipShape;
    state: ShopCardState;
    status: string;
    type: ShopItemType;
  }): HTMLElement {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "shop-card";
    card.dataset.type = data.type;
    card.dataset.id = data.id;
    card.dataset.state = data.state;
    card.style.setProperty("--accent", data.accent);

    const inner = document.createElement("div");
    inner.className = "shop-card-inner";

    const iconWrap = document.createElement("div");
    iconWrap.className = "card-icon";
    const iconCanvas = document.createElement("canvas");
    iconCanvas.className = "card-icon-canvas";
    iconCanvas.width = 52;
    iconCanvas.height = 52;
    iconWrap.appendChild(iconCanvas);
    this.drawIcon(
      iconCanvas,
      data.iconKind,
      data.accent,
      data.shipShape ?? "starling",
    );

    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = data.name;

    const desc = document.createElement("div");
    desc.className = "card-desc";
    desc.textContent = data.description;

    const status = document.createElement("div");
    status.className = "card-status";
    status.textContent = data.status;

    inner.appendChild(iconWrap);
    inner.appendChild(title);
    inner.appendChild(desc);
    inner.appendChild(status);

    card.appendChild(inner);
    return card;
  }

  private handleOverlayClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target || !this.overlay) return;

    const action = target.closest<HTMLElement>("[data-action]");
    if (action?.dataset.action === "deploy") {
      this.game.events.emit("ui:route", "play");
      return;
    }
    if (action?.dataset.action === "show-ships") {
      this.currentCategory = "ships";
      this.refreshOverlay();
      return;
    }
    if (action?.dataset.action === "show-primary") {
      this.currentCategory = "primary";
      this.refreshOverlay();
      return;
    }
    if (action?.dataset.action === "show-secondary") {
      this.currentCategory = "secondary";
      this.refreshOverlay();
      return;
    }

    const card = target.closest<HTMLElement>("[data-type][data-id]");
    if (!card) return;
    const type = card.dataset.type as ShopItemType | undefined;
    const id = card.dataset.id as
      | SecondaryWeaponId
      | ShipId
      | undefined
      | WeaponId;
    if (!type || !id) return;

    if (type === "ship") {
      const shipId = id as ShipId;
      const ship = SHIPS[shipId];
      if (!ship) return;
      const unlocked = this.save.unlockedShips.includes(shipId);
      if (!unlocked) {
        if (this.save.gold < ship.cost) return;
        this.save.gold -= ship.cost;
        this.save.unlockedShips = [...this.save.unlockedShips, shipId];
      }
      this.save.selectedShipId = shipId;
    } else if (type === "primary") {
      const weaponId = id as WeaponId;
      const weapon = WEAPONS[weaponId];
      if (!weapon) return;
      const unlocked = this.save.unlockedWeapons.includes(weaponId);
      if (!unlocked) {
        if (this.save.gold < weapon.cost) return;
        this.save.gold -= weapon.cost;
        this.save.unlockedWeapons = [...this.save.unlockedWeapons, weaponId];
      }
      this.save.selectedWeaponId = weaponId;
    } else {
      const weaponId = id as SecondaryWeaponId;
      const weapon = SECONDARY_WEAPONS[weaponId];
      if (!weapon) return;
      const unlocked = this.save.unlockedSecondaryWeapons.includes(weaponId);
      if (!unlocked) {
        if (this.save.gold < weapon.cost) return;
        this.save.gold -= weapon.cost;
        this.save.unlockedSecondaryWeapons = [
          ...this.save.unlockedSecondaryWeapons,
          weaponId,
        ];
      }
      this.save.selectedSecondaryWeaponId = weaponId;
    }

    persistSave(this.save);
    this.refreshOverlay();
  }

  private setupPreviewGame(): void {
    if (!this.previewRoot || this.previewGame) return;
    const rect = this.previewRoot.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.round(rect.width));
    const cssHeight = Math.max(1, Math.round(rect.height));
    const previewScene = new PreviewScene();
    this.previewScene = previewScene;
    const resolution = Math.min(window.devicePixelRatio || 1, 2);
    const previewConfig: Phaser.Types.Core.GameConfig & {
      resolution?: number;
    } = {
      audio: { noAudio: true },
      backgroundColor: "#05060a",
      fps: { smoothStep: false },
      parent: this.previewRoot,
      render: { antialias: true },
      resolution,
      scale: {
        height: cssHeight || 2,
        mode: Phaser.Scale.RESIZE,
        width: cssWidth || 2,
      },
      scene: [previewScene],
      type: Phaser.CANVAS,
    };
    this.previewGame = new Phaser.Game(previewConfig);
    this.applyPreviewLoadout();
    this.resizeObserver = new ResizeObserver(() =>
      this.syncPreviewCanvasSize(),
    );
    this.resizeObserver.observe(this.previewRoot);
    if (this.previewRoot.parentElement) {
      this.resizeObserver.observe(this.previewRoot.parentElement);
    }
    window.requestAnimationFrame(() => this.syncPreviewCanvasSize());
  }

  private teardownPreviewGame(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }
    if (!this.previewGame) return;
    this.previewGame.destroy(false);
    this.previewGame = undefined;
    this.previewScene = undefined;
  }

  private syncPreviewCanvasSize(): void {
    if (!this.previewRoot) return;
    const rect = this.previewRoot.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.round(rect.width));
    const cssHeight = Math.max(1, Math.round(rect.height));
    if (cssWidth <= 1 || cssHeight <= 1) return;
    if (this.previewGame) {
      this.previewGame.scale.resize(cssWidth, cssHeight);
    }
    this.previewScene?.resize(cssWidth, cssHeight);
  }

  private applyPreviewLoadout(): void {
    if (!this.previewScene) return;
    const primary = WEAPONS[this.save.selectedWeaponId];
    const secondary = this.save.selectedSecondaryWeaponId
      ? SECONDARY_WEAPONS[this.save.selectedSecondaryWeaponId]
      : null;
    const ship = SHIPS[this.save.selectedShipId];
    this.previewScene.setLoadout(primary, secondary, ship);
  }

  private drawIcon(
    canvas: HTMLCanvasElement,
    kind: "ship" | BulletKind,
    color: string,
    shipShape: ShipShape,
  ): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { height, width } = canvas;
    ctx.clearRect(0, 0, width, height);
    if (kind === "ship") {
      const fill = this.toRgba(color, 0.9, 0.25);
      this.drawShip(
        ctx,
        width / 2,
        height / 2,
        width * 0.28,
        color,
        fill,
        shipShape,
      );
      return;
    }
    this.drawBullet(ctx, kind, width / 2, height / 2, width * 0.38, color);
  }

  private drawShip(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    stroke: string,
    fill: string,
    shape: ShipShape,
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    drawShipToCanvas(ctx, shape, r);
    ctx.restore();
  }

  private drawBullet(
    ctx: CanvasRenderingContext2D,
    kind: BulletKind,
    x: number,
    y: number,
    size: number,
    color: string,
    angleRad: number = -Math.PI / 2,
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angleRad + Math.PI / 2);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    switch (kind) {
      case "dart":
        ctx.lineWidth = Math.max(2, size * 0.12);
        ctx.beginPath();
        ctx.moveTo(0, size * 0.45);
        ctx.lineTo(0, -size * 0.45);
        ctx.stroke();
        break;
      case "missile":
        ctx.lineWidth = 2;
        ctx.fillRect(-size * 0.18, -size * 0.45, size * 0.36, size * 0.9);
        ctx.strokeRect(-size * 0.18, -size * 0.45, size * 0.36, size * 0.9);
        ctx.fillStyle = this.toRgba(color, 1, 1.1);
        ctx.fillRect(-size * 0.12, size * 0.3, size * 0.24, size * 0.18);
        break;
      case "bomb":
        ctx.lineWidth = Math.max(2, size * 0.12);
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      case "orb":
      default:
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
    ctx.restore();
  }

  private toRgba(hex: string, alpha: number, factor: number): string {
    const { b, g, r } = this.hexToRgb(hex);
    return `rgba(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)}, ${alpha})`;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const raw = hex.replace("#", "").padStart(6, "0");
    const value = parseInt(raw, 16);
    return {
      b: value & 255,
      g: (value >> 8) & 255,
      r: (value >> 16) & 255,
    };
  }
}
