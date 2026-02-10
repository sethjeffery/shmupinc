import type { ShopRules } from "../data/levels";
import type { ModInstanceId } from "../data/modInstances";
import type { ModIconKind, ModId } from "../data/mods";
import type { ModDefinition } from "../data/modTypes";
import type { MountAssignment, SaveData } from "../data/save";
import type { BulletKind } from "../data/scripts";
import type { ShipId } from "../data/ships";
import type { ShipDefinition, ShipVector } from "../data/shipTypes";
import type { WeaponInstanceId } from "../data/weaponInstances";
import type { WeaponDefinition, WeaponId } from "../data/weapons";
import type { WeaponSize } from "../data/weaponTypes";

import Phaser from "phaser";

import { GUNS } from "../data/guns";
import { getActiveLevelSession } from "../data/levelState";
import { MODS } from "../data/mods";
import {
  addResourceInSave,
  buildMountedWeapons,
  createModInstanceInSave,
  createWeaponInstanceInSave,
  getMissingUnlocks,
  getResourceAmount,
  hasRequiredUnlocks,
  loadSave,
  mutateSave,
  spendResourceInSave,
} from "../data/save";
import { SHIPS } from "../data/ships";
import { filterShopItems, pickAllowedId } from "../data/shopRules";
import { canMountWeapon } from "../data/weaponMounts";
import { WEAPONS } from "../data/weapons";
import { drawGunToCanvas } from "../render/gunShapes";
import { DEFAULT_SHIP_VECTOR, drawShipToCanvas } from "../render/shipShapes";
import { PreviewScene } from "./PreviewScene";

type ShopItemType = "inventory" | "mod" | "mount" | "ship" | "weapon";

type ShopCategory = "armory" | "loadout" | "ships";

type ShopCardState = "equipped" | "locked" | "mounted" | "owned" | "restricted";

type TabIcon = "mount" | "play" | "ship" | "weapon";

type CardIconKind = "gun" | "mod" | "ship";

interface WeaponDragPayload {
  kind: "weapon";
  instanceId: WeaponInstanceId;
  sourceMountId?: string;
}

interface ModDragPayload {
  kind: "mod";
  instanceId: ModInstanceId;
  sourceMountId?: string;
}

type DragPayload = ModDragPayload | WeaponDragPayload;

const SELL_RATIO = 0.5;
const PRIMARY_RESOURCE_ID = "gold";

const formatCost = (cost: number, resourceId: string): string =>
  resourceId === PRIMARY_RESOURCE_ID ? `${cost}g` : `${cost} ${resourceId}`;

const formatColor = (color: number): string =>
  `#${color.toString(16).padStart(6, "0")}`;

export class ShopScene extends Phaser.Scene {
  private save!: SaveData;
  private overlay?: HTMLDivElement;
  private goldText?: HTMLDivElement;
  private goldFooterText?: HTMLSpanElement;
  private catalogTitle?: HTMLDivElement;
  private catalogNote?: HTMLDivElement;
  private catalogGrid?: HTMLDivElement;
  private missionText?: HTMLDivElement;
  private previewRoot?: HTMLDivElement;
  private previewGame?: Phaser.Game;
  private previewScene?: PreviewScene;
  private resizeObserver?: ResizeObserver;
  private mountVisual?: HTMLDivElement;
  private mountCanvas?: HTMLCanvasElement;
  private mountDots = new Map<string, HTMLDivElement>();
  private mountCallouts = new Map<string, HTMLDivElement>();
  private mountCalloutLines = new Map<string, HTMLDivElement>();
  private dragHoverMountId: null | string = null;
  private dragPreviewEl?: HTMLDivElement;
  private currentCategory: ShopCategory = "loadout";
  private tabButtons: Partial<Record<ShopCategory, HTMLButtonElement>> = {};
  private statHull?: HTMLSpanElement;
  private statSpeed?: HTMLSpanElement;
  private statMagnet?: HTMLSpanElement;
  private shopRules: null | ShopRules = null;
  private dragPayload: DragPayload | null = null;
  private handleClickBound = (event: MouseEvent) =>
    this.handleOverlayClick(event);
  private handleDragStartBound = (event: DragEvent) =>
    this.handleDragStart(event);
  private handleDragOverBound = (event: DragEvent) =>
    this.handleDragOver(event);
  private handleDropBound = (event: DragEvent) => this.handleDrop(event);
  private handleDragEndBound = () => this.handleDragEnd();

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
    this.overlay.addEventListener("dragstart", this.handleDragStartBound);
    this.overlay.addEventListener("dragover", this.handleDragOverBound);
    this.overlay.addEventListener("drop", this.handleDropBound);
    this.overlay.addEventListener("dragend", this.handleDragEndBound);
    this.refreshOverlay();
    this.setupPreviewGame();
  }

  private hideOverlay(): void {
    if (!this.overlay) return;
    this.teardownPreviewGame();
    this.overlay.removeEventListener("click", this.handleClickBound);
    this.overlay.removeEventListener("dragstart", this.handleDragStartBound);
    this.overlay.removeEventListener("dragover", this.handleDragOverBound);
    this.overlay.removeEventListener("drop", this.handleDropBound);
    this.overlay.removeEventListener("dragend", this.handleDragEndBound);
    this.overlay.remove();
    this.overlay = undefined;
    this.goldText = undefined;
    this.goldFooterText = undefined;
    this.catalogTitle = undefined;
    this.catalogNote = undefined;
    this.catalogGrid = undefined;
    this.missionText = undefined;
    this.previewRoot = undefined;
    this.tabButtons = {};
    this.statHull = undefined;
    this.statSpeed = undefined;
    this.statMagnet = undefined;
    this.shopRules = null;
    this.mountVisual = undefined;
    this.mountCanvas = undefined;
    this.mountDots.clear();
    this.mountCallouts.clear();
    this.mountCalloutLines.clear();
    this.dragHoverMountId = null;
    this.dragPreviewEl?.remove();
    this.dragPreviewEl = undefined;
    document.body.classList.remove("shop-open");
  }

  private buildOverlay(): HTMLDivElement {
    const overlay = document.createElement("div");
    overlay.className = "shop-overlay";

    const panel = document.createElement("div");
    panel.className = "shop-panel";

    const header = document.createElement("div");
    header.className = "shop-header";

    const headerMeta = document.createElement("div");
    headerMeta.className = "shop-header-meta";

    const title = document.createElement("div");
    title.className = "shop-title";
    title.textContent = "Hangar Exchange";

    const mission = document.createElement("div");
    mission.className = "shop-mission";
    mission.textContent = "";

    const gold = document.createElement("div");
    gold.className = "shop-gold";
    gold.textContent = "Gold: 0";

    headerMeta.appendChild(title);
    headerMeta.appendChild(mission);
    header.appendChild(headerMeta);
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
    hint.textContent = "Configure mounts before deploying.";
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
    const armoryTab = this.createTabButton("Armory", "show-armory", "weapon");
    const loadoutTab = this.createTabButton("Loadout", "show-loadout", "mount");
    tabs.appendChild(shipsTab);
    tabs.appendChild(armoryTab);
    tabs.appendChild(loadoutTab);

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
    this.catalogNote = contentNote;
    this.catalogGrid = catalogGrid;
    this.missionText = mission;
    this.previewRoot = previewRoot;
    this.tabButtons = {
      armory: armoryTab,
      loadout: loadoutTab,
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
    this.syncShopRules();
    this.ensureAllowedSelections();
    const goldValue = `Gold: ${Math.round(
      getResourceAmount(this.save, PRIMARY_RESOURCE_ID),
    )}`;
    this.goldText.textContent = goldValue;
    if (this.goldFooterText) this.goldFooterText.textContent = goldValue;

    for (const [key, button] of Object.entries(this.tabButtons)) {
      button?.classList.toggle("is-active", key === this.currentCategory);
    }

    const { cards, title } = this.buildCategoryCards(this.currentCategory);
    this.catalogTitle.textContent = title;
    this.catalogGrid.replaceChildren(...cards);
    this.updateCatalogNote(this.currentCategory);
    this.updateStats();
    this.applyPreviewLoadout();
    if (this.currentCategory !== "loadout") {
      this.mountVisual = undefined;
      this.mountCanvas = undefined;
      this.mountDots.clear();
      this.mountCallouts.clear();
      this.mountCalloutLines.clear();
      this.dragHoverMountId = null;
    }
  }

  private updateSave(
    mutator: (data: SaveData) => void,
    options?: { allowEmptyLoadout?: boolean },
  ): void {
    const allowEmptyLoadout = options?.allowEmptyLoadout ?? true;
    this.save = mutateSave(mutator, { allowEmptyLoadout });
  }

  private updateStats(): void {
    const ship = this.getSelectedShip();
    if (this.statHull) this.statHull.textContent = `${ship.maxHp}`;
    if (this.statSpeed)
      this.statSpeed.textContent = `${ship.moveSpeed.toFixed(1)}`;
    if (this.statMagnet) {
      const magnet = Math.round((ship.magnetMultiplier ?? 1) * 100);
      this.statMagnet.textContent = `${magnet}%`;
    }
  }

  private syncShopRules(): void {
    const session = getActiveLevelSession();
    const level = session?.level;
    this.shopRules = level?.shopRules ?? null;
    if (this.missionText) {
      if (level) {
        this.missionText.textContent = `Mission: ${level.title}`;
        this.missionText.classList.add("is-active");
      } else {
        this.missionText.textContent = "";
        this.missionText.classList.remove("is-active");
      }
    }
  }

  private updateCatalogNote(category: ShopCategory): void {
    if (!this.catalogNote) return;
    const level = getActiveLevelSession()?.level;
    const restriction = level ? "Mission-approved gear for purchase." : "";
    if (category === "ships") {
      this.catalogNote.textContent = level
        ? "Mission-approved hulls for purchase. Owned ships stay available."
        : "Select a ship to equip.";
      return;
    }
    if (category === "armory") {
      this.catalogNote.textContent = [
        "Click a weapon to purchase another copy.",
        restriction,
      ]
        .filter(Boolean)
        .join(" ");
      return;
    }
    this.catalogNote.textContent = [
      "Drag weapons onto mounts to equip. Drop back to inventory to detach.",
      level ? "Owned gear is always available." : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  private ensureAllowedSelections(): void {
    if (!this.shopRules) return;
    const availableShips = Object.values(SHIPS);

    this.updateSave(
      (data) => {
        const nextShipId = pickAllowedId(data.selectedShipId, availableShips);
        if (nextShipId && nextShipId !== data.selectedShipId) {
          data.selectedShipId = nextShipId;
        }

        const ship = SHIPS[data.selectedShipId];
        if (!ship) return;

        const assignments = this.ensureMountAssignments(data, ship);
        for (const assignment of assignments) {
          if (!assignment.weaponInstanceId) continue;
          const instance = data.ownedWeapons.find(
            (item) => item.id === assignment.weaponInstanceId,
          );
          const weapon = instance ? WEAPONS[instance.weaponId] : null;
          const mount = ship.mounts.find(
            (entry) => entry.id === assignment.mountId,
          );
          if (!weapon || !mount) {
            assignment.weaponInstanceId = null;
            continue;
          }
          if (!canMountWeapon(weapon, mount)) {
            assignment.weaponInstanceId = null;
          }
        }

        if (assignments.some((entry) => entry.weaponInstanceId)) return;
      },
      { allowEmptyLoadout: true },
    );
  }

  private buildCategoryCards(category: ShopCategory): {
    cards: HTMLElement[];
    title: string;
  } {
    switch (category) {
      case "armory":
        return {
          cards: this.buildArmoryCards(),
          title: "Armory",
        };
      case "loadout":
        return {
          cards: [this.buildLoadoutView()],
          title: "Loadout",
        };
      case "ships":
      default:
        return { cards: this.buildShipCards(), title: "Ships" };
    }
  }

  private ensureMountAssignments(
    save: SaveData,
    ship: ShipDefinition,
  ): MountAssignment[] {
    if (!save.mountedWeapons[ship.id]) {
      save.mountedWeapons[ship.id] = ship.mounts.map((mount) => ({
        modInstanceIds: [],
        mountId: mount.id,
        weaponInstanceId: null,
      }));
    }
    return save.mountedWeapons[ship.id];
  }

  private getSelectedShip(): ShipDefinition {
    return SHIPS[this.save.selectedShipId] ?? SHIPS.starter;
  }

  private isWeaponAllowed(weapon: WeaponDefinition): boolean {
    if (!this.shopRules) return true;
    const filtered = this.getFilteredWeapons();
    return filtered.some((item) => item.id === weapon.id);
  }

  private isModAllowed(mod: ModDefinition): boolean {
    if (!this.shopRules) return true;
    const filtered = this.getFilteredMods();
    return filtered.some((item) => item.id === mod.id);
  }

  private isShipAllowedForPurchase(id: ShipId): boolean {
    if (!this.shopRules) return true;
    return this.getFilteredShips().some((ship) => ship.id === id);
  }

  private getVisibleShips(): (typeof SHIPS)[ShipId][] {
    const ships = Object.values(SHIPS);
    if (!this.shopRules) return ships;
    const allowedIds = new Set(this.getFilteredShips().map((ship) => ship.id));
    const ownedIds = new Set(this.save.unlockedShips);
    const selectedId = this.save.selectedShipId;
    return ships.filter(
      (ship) =>
        allowedIds.has(ship.id) ||
        ownedIds.has(ship.id) ||
        ship.id === selectedId,
    );
  }

  private getFilteredShips(): (typeof SHIPS)[ShipId][] {
    const ships = Object.values(SHIPS);
    return filterShopItems(
      ships,
      this.shopRules,
      this.shopRules?.allowedShips,
      this.shopRules?.caps?.shipCost,
    );
  }

  private getFilteredWeapons(): (typeof WEAPONS)[WeaponId][] {
    const weapons = Object.values(WEAPONS);
    return filterShopItems(
      weapons,
      this.shopRules,
      this.shopRules?.allowedWeapons,
      this.shopRules?.caps?.weaponCost,
    );
  }

  private getFilteredMods(): (typeof MODS)[ModId][] {
    const mods = Object.values(MODS);
    return filterShopItems(
      mods,
      this.shopRules,
      this.shopRules?.allowedMods,
      this.shopRules?.caps?.modCost,
    );
  }

  private buildShipCards(): HTMLElement[] {
    const allowedIds = new Set(this.getFilteredShips().map((ship) => ship.id));
    return this.getVisibleShips()
      .sort((a, b) => a.cost - b.cost)
      .map((ship) => {
        const owned = this.save.unlockedShips.includes(ship.id);
        const selected = this.save.selectedShipId === ship.id;
        const missingUnlocks = getMissingUnlocks(
          this.save,
          ship.requiresUnlocks,
        );
        const unlockBlocked = !owned && missingUnlocks.length > 0;
        const purchasable = allowedIds.has(ship.id);
        const state: ShopCardState = selected
          ? "equipped"
          : owned
            ? "owned"
            : "locked";
        const status = selected
          ? "Equipped"
          : owned
            ? "Owned"
            : unlockBlocked
              ? "Blueprint Required"
              : purchasable
                ? formatCost(
                    ship.cost,
                    ship.costResource ?? PRIMARY_RESOURCE_ID,
                  )
                : "Restricted";
        return this.buildCard({
          accent: formatColor(ship.color),
          accentColor: ship.color,
          description: ship.description,
          iconKind: "ship",
          id: ship.id,
          name: ship.name,
          shipShape: ship.vector,
          state,
          status,
          type: "ship",
        });
      });
  }

  private buildArmoryCards(): HTMLElement[] {
    const weaponCards = this.getFilteredWeapons()
      .sort((a, b) => a.cost - b.cost)
      .map((weapon) => {
        const ownedCount = this.save.ownedWeapons.filter(
          (instance) => instance.weaponId === weapon.id,
        ).length;
        const missingUnlocks = getMissingUnlocks(
          this.save,
          weapon.requiresUnlocks,
        );
        const unlockBlocked = ownedCount === 0 && missingUnlocks.length > 0;
        const status = unlockBlocked
          ? `Blueprint Required · ${formatCost(
              weapon.cost,
              weapon.costResource ?? PRIMARY_RESOURCE_ID,
            )}`
          : ownedCount > 0
            ? `Owned x${ownedCount} · ${formatCost(
                weapon.cost,
                weapon.costResource ?? PRIMARY_RESOURCE_ID,
              )}`
            : formatCost(
                weapon.cost,
                weapon.costResource ?? PRIMARY_RESOURCE_ID,
              );
        const state: ShopCardState = ownedCount > 0 ? "owned" : "locked";
        return this.buildCard({
          accent: formatColor(weapon.stats.bullet.color ?? 0x7df9ff),
          accentColor: weapon.stats.bullet.color ?? 0x7df9ff,
          description: weapon.description,
          gunId: weapon.gunId,
          iconKind: "gun",
          id: weapon.id,
          name: weapon.name,
          state,
          status,
          type: "weapon",
          weaponSize: weapon.size,
        });
      });
    const modCards = this.getFilteredMods()
      .sort((a, b) => a.cost - b.cost)
      .map((mod) => {
        const ownedCount = this.save.ownedMods.filter(
          (instance) => instance.modId === mod.id,
        ).length;
        const missingUnlocks = getMissingUnlocks(
          this.save,
          mod.requiresUnlocks,
        );
        const unlockBlocked = ownedCount === 0 && missingUnlocks.length > 0;
        const status = unlockBlocked
          ? `Blueprint Required · ${formatCost(
              mod.cost,
              mod.costResource ?? PRIMARY_RESOURCE_ID,
            )}`
          : ownedCount > 0
            ? `Owned x${ownedCount} · ${formatCost(
                mod.cost,
                mod.costResource ?? PRIMARY_RESOURCE_ID,
              )}`
            : formatCost(mod.cost, mod.costResource ?? PRIMARY_RESOURCE_ID);
        const state: ShopCardState = ownedCount > 0 ? "owned" : "locked";
        const accentColor = this.getModAccentColor(mod.iconKind);
        return this.buildCard({
          accent: formatColor(accentColor),
          accentColor,
          description: mod.description,
          iconKind: "mod",
          id: mod.id,
          modIcon: mod.iconKind,
          name: mod.name,
          state,
          status,
          type: "mod",
        });
      });
    return [...weaponCards, ...modCards];
  }

  private createCardBase(data: {
    accent: string;
    accentColor: number;
    description: string;
    gunId?: string;
    iconKind: CardIconKind;
    modIcon?: ModIconKind;
    name: string;
    shipShape?: ShipVector;
    weaponSize?: WeaponSize;
    state: ShopCardState;
    status: string;
    tag: "button" | "div";
  }): { card: HTMLElement; inner: HTMLDivElement } {
    const card = document.createElement(data.tag);
    if (data.tag === "button") {
      (card as HTMLButtonElement).type = "button";
    }
    card.className = "shop-card";
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
      data.accentColor,
      data.shipShape ?? DEFAULT_SHIP_VECTOR,
      data.gunId,
      data.modIcon,
      data.weaponSize,
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
    return { card, inner };
  }

  private buildCard(data: {
    accent: string;
    accentColor: number;
    description: string;
    gunId?: string;
    iconKind: CardIconKind;
    id: string;
    modIcon?: ModIconKind;
    name: string;
    shipShape?: ShipVector;
    weaponSize?: WeaponSize;
    state: ShopCardState;
    status: string;
    type: ShopItemType;
  }): HTMLElement {
    const { card } = this.createCardBase({ ...data, tag: "button" });
    card.dataset.type = data.type;
    card.dataset.id = data.id;
    return card;
  }

  private getAssignmentsForShip(ship: ShipDefinition): MountAssignment[] {
    if (!this.save.mountedWeapons[ship.id]) {
      this.updateSave((data) => {
        this.ensureMountAssignments(data, ship);
      });
    }
    return (
      this.save.mountedWeapons[ship.id] ??
      this.ensureMountAssignments(this.save, ship)
    );
  }

  private buildLoadoutView(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "shop-loadout";

    const ship = this.getSelectedShip();
    const assignments = this.getAssignmentsForShip(ship);
    const mountedWeaponIds = new Set<WeaponInstanceId>();
    const mountedModIds = new Set<ModInstanceId>();
    for (const entry of assignments) {
      if (entry.weaponInstanceId) mountedWeaponIds.add(entry.weaponInstanceId);
      for (const modId of entry.modInstanceIds) {
        mountedModIds.add(modId);
      }
    }

    const mountSection = document.createElement("div");
    mountSection.className = "shop-loadout-section";
    const mountTitle = document.createElement("div");
    mountTitle.className = "shop-section-title";
    mountTitle.textContent = "Mounts";
    mountSection.appendChild(mountTitle);
    mountSection.appendChild(this.buildMountVisual(ship, assignments));

    const weaponInventorySection = document.createElement("div");
    weaponInventorySection.className = "shop-loadout-section";
    const weaponInventoryTitle = document.createElement("div");
    weaponInventoryTitle.className = "shop-section-title";
    weaponInventoryTitle.textContent = "Weapon Inventory";
    const weaponInventoryGrid = document.createElement("div");
    weaponInventoryGrid.className = "shop-inventory-grid";
    weaponInventoryGrid.dataset.drop = "inventory";
    weaponInventoryGrid.dataset.dropKind = "weapon";

    const weaponInventory = this.save.ownedWeapons.filter(
      (instance) => !mountedWeaponIds.has(instance.id),
    );
    if (weaponInventory.length === 0) {
      const empty = document.createElement("div");
      empty.className = "shop-empty";
      empty.textContent = "No spare weapons. Buy more in the Armory.";
      weaponInventoryGrid.appendChild(empty);
    } else {
      for (const instance of weaponInventory) {
        const weapon = WEAPONS[instance.weaponId];
        if (!weapon) continue;
        weaponInventoryGrid.appendChild(
          this.buildInventoryCard(instance.id, weapon),
        );
      }
    }

    weaponInventorySection.appendChild(weaponInventoryTitle);
    weaponInventorySection.appendChild(weaponInventoryGrid);

    const modInventorySection = document.createElement("div");
    modInventorySection.className = "shop-loadout-section";
    const modInventoryTitle = document.createElement("div");
    modInventoryTitle.className = "shop-section-title";
    modInventoryTitle.textContent = "Mod Inventory";
    const modInventoryGrid = document.createElement("div");
    modInventoryGrid.className = "shop-inventory-grid";
    modInventoryGrid.dataset.drop = "inventory";
    modInventoryGrid.dataset.dropKind = "mod";

    const modInventory = this.save.ownedMods.filter(
      (instance) => !mountedModIds.has(instance.id),
    );
    if (modInventory.length === 0) {
      const empty = document.createElement("div");
      empty.className = "shop-empty";
      empty.textContent = "No spare mods. Buy more in the Armory.";
      modInventoryGrid.appendChild(empty);
    } else {
      for (const instance of modInventory) {
        const mod = MODS[instance.modId];
        if (!mod) continue;
        modInventoryGrid.appendChild(
          this.buildModInventoryCard(instance.id, mod),
        );
      }
    }

    modInventorySection.appendChild(modInventoryTitle);
    modInventorySection.appendChild(modInventoryGrid);

    wrapper.appendChild(mountSection);
    wrapper.appendChild(weaponInventorySection);
    wrapper.appendChild(modInventorySection);
    return wrapper;
  }

  private buildMountVisual(
    ship: ShipDefinition,
    assignments: MountAssignment[],
  ): HTMLDivElement {
    const wrapper = document.createElement("div");
    wrapper.className = "shop-mount-visual";

    const canvas = document.createElement("canvas");

    const points = document.createElement("div");
    points.className = "shop-mount-points";

    const callouts = document.createElement("div");
    callouts.className = "shop-mount-callouts";

    const detachZone = document.createElement("div");
    detachZone.className = "shop-mount-detach";
    detachZone.dataset.drop = "detach";
    detachZone.title = "Detach";

    wrapper.appendChild(canvas);
    wrapper.appendChild(points);
    wrapper.appendChild(callouts);
    wrapper.appendChild(detachZone);

    this.mountVisual = wrapper;
    this.mountCanvas = canvas;
    this.mountDots.clear();
    this.mountCallouts.clear();
    this.mountCalloutLines.clear();

    const assignmentById = new Map(
      assignments.map((entry) => [entry.mountId, entry]),
    );

    for (const mount of ship.mounts) {
      const dot = document.createElement("div");
      dot.className = `shop-mount-dot shop-mount-dot--${mount.size}`;
      dot.dataset.drop = "mount";
      dot.dataset.mountId = mount.id;
      dot.title = `${mount.size} · ${mount.modSlots} mod`;
      const assignment = assignmentById.get(mount.id);
      const instanceId = assignment?.weaponInstanceId ?? null;
      const instance = instanceId
        ? (this.save.ownedWeapons.find((item) => item.id === instanceId) ??
          null)
        : null;
      const weapon = instance ? WEAPONS[instance.weaponId] : null;
      const mountedMods = (assignment?.modInstanceIds ?? [])
        .map((modInstanceId) =>
          this.save.ownedMods.find((entry) => entry.id === modInstanceId),
        )
        .filter((modInstance): modInstance is { id: string; modId: string } =>
          Boolean(modInstance),
        )
        .map((modInstance) => ({
          definition: MODS[modInstance.modId],
          instanceId: modInstance.id,
        }))
        .filter(
          (
            entry,
          ): entry is {
            definition: ModDefinition;
            instanceId: ModInstanceId;
          } => Boolean(entry.definition),
        );
      if (assignment?.weaponInstanceId) {
        dot.classList.add("is-occupied");
      }
      points.appendChild(dot);
      this.mountDots.set(mount.id, dot);

      if (weapon) {
        const callout = document.createElement("div");
        callout.className = "shop-mount-callout";
        const side =
          mount.offset.y > 0.35
            ? "down"
            : mount.offset.x < -0.15
              ? "left"
              : mount.offset.x > 0.15
                ? "right"
                : "center";
        callout.dataset.side = side;
        callout.dataset.instanceId = instance?.id;
        callout.dataset.mountId = mount.id;
        callout.dataset.kind = "weapon";
        callout.setAttribute("draggable", "true");
        callout.addEventListener("dragstart", this.handleDragStartBound);
        callout.addEventListener("dragend", this.handleDragEndBound);
        const weaponName = document.createElement("div");
        weaponName.textContent = weapon.name;
        callout.appendChild(weaponName);
        if (mountedMods.length > 0) {
          const modRow = document.createElement("div");
          modRow.className = "shop-mount-mod-row";
          for (const mod of mountedMods) {
            const chip = document.createElement("div");
            chip.className = "shop-mount-mod-chip";
            chip.dataset.instanceId = mod.instanceId;
            chip.dataset.kind = "mod";
            chip.dataset.modId = mod.definition.id;
            chip.dataset.mountId = mount.id;
            chip.setAttribute("draggable", "true");
            chip.addEventListener("dragstart", this.handleDragStartBound);
            chip.addEventListener("dragend", this.handleDragEndBound);
            chip.textContent = mod.definition.name;
            modRow.appendChild(chip);
          }
          callout.appendChild(modRow);
        }
        const line = document.createElement("div");
        line.className = "shop-mount-callout-line";
        callouts.appendChild(line);
        callouts.appendChild(callout);
        this.mountCallouts.set(mount.id, callout);
        this.mountCalloutLines.set(mount.id, line);
      }
    }

    window.requestAnimationFrame(() => {
      this.renderMountVisual(ship);
      this.updateMountVisualHighlights();
    });

    return wrapper;
  }

  private renderMountVisual(ship: ShipDefinition): void {
    if (!this.mountVisual || !this.mountCanvas) return;
    const rect = this.mountVisual.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.round(rect.width));
    const cssHeight = Math.max(1, Math.round(rect.height));
    const resolution = Math.min(window.devicePixelRatio || 1, 2);
    this.mountCanvas.width = Math.floor(cssWidth * resolution);
    this.mountCanvas.height = Math.floor(cssHeight * resolution);
    this.mountCanvas.style.width = `${cssWidth}px`;
    this.mountCanvas.style.height = `${cssHeight}px`;

    const ctx = this.mountCanvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(resolution, 0, 0, resolution, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const centerX = cssWidth * 0.5;
    const centerY = cssHeight * 0.55;
    const minDim = Math.min(cssWidth, cssHeight);
    const baseRadius = minDim * 0.32;
    const radiusMultiplier = ship.radiusMultiplier ?? 1;
    const radius = Math.min(baseRadius * radiusMultiplier, minDim * 0.42);

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.fillStyle = "rgba(15, 24, 38, 0.9)";
    ctx.strokeStyle = "rgba(125, 249, 255, 0.6)";
    ctx.lineWidth = Math.max(1.5, minDim * 0.008);
    drawShipToCanvas(ctx, ship.vector, radius);
    ctx.restore();

    for (const mount of ship.mounts) {
      const dot = this.mountDots.get(mount.id);
      if (!dot) continue;
      const x = centerX + mount.offset.x * radius;
      const y = centerY + mount.offset.y * radius;
      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
      const callout = this.mountCallouts.get(mount.id);
      const line = this.mountCalloutLines.get(mount.id);
      if (!callout || !line) continue;
      const side = callout.dataset.side ?? "center";
      const lineLength = side === "down" ? 24 : 34;
      const angle = Math.PI / 6;
      let anchorX = x;
      let anchorY = y;
      if (side === "left") {
        anchorX = x - Math.cos(angle) * lineLength;
        anchorY = y - Math.sin(angle) * lineLength;
      } else if (side === "right") {
        anchorX = x + Math.cos(angle) * lineLength;
        anchorY = y - Math.sin(angle) * lineLength;
      } else if (side === "down") {
        anchorY = y + lineLength;
      } else {
        anchorY = y - lineLength;
      }

      const calloutWidth = callout.offsetWidth || 0;
      const calloutHeight = callout.offsetHeight || 0;
      if (side === "left") {
        callout.style.left = `${anchorX - calloutWidth}px`;
        callout.style.top = `${anchorY - calloutHeight / 2}px`;
      } else if (side === "right") {
        callout.style.left = `${anchorX}px`;
        callout.style.top = `${anchorY - calloutHeight / 2}px`;
      } else if (side === "down") {
        callout.style.left = `${anchorX - calloutWidth / 2}px`;
        callout.style.top = `${anchorY}px`;
      } else {
        callout.style.left = `${anchorX - calloutWidth / 2}px`;
        callout.style.top = `${anchorY - calloutHeight}px`;
      }

      const lineDx = anchorX - x;
      const lineDy = anchorY - y;
      const lineWidth = Math.hypot(lineDx, lineDy);
      line.style.left = `${x}px`;
      line.style.top = `${y}px`;
      line.style.width = `${lineWidth}px`;
      line.style.transform = `rotate(${Math.atan2(lineDy, lineDx)}rad)`;
    }
  }

  private updateMountVisualHighlights(): void {
    if (this.mountDots.size === 0) return;
    const ship = this.getSelectedShip();
    const assignments = this.getAssignmentsForShip(ship);
    const assignmentById = new Map(
      assignments.map((entry) => [entry.mountId, entry]),
    );
    const payload = this.dragPayload;
    if (this.mountVisual) {
      this.mountVisual.classList.toggle("is-dragging", Boolean(payload));
    }
    const eligibleMounts = new Set<string>();
    if (payload) {
      if (payload.kind === "weapon") {
        const instance = this.save.ownedWeapons.find(
          (item) => item.id === payload.instanceId,
        );
        const weapon = instance ? WEAPONS[instance.weaponId] : null;
        if (weapon) {
          for (const mount of ship.mounts) {
            if (canMountWeapon(weapon, mount)) {
              eligibleMounts.add(mount.id);
            }
          }
        }
      } else {
        const modInstance = this.save.ownedMods.find(
          (item) => item.id === payload.instanceId,
        );
        const mod = modInstance ? MODS[modInstance.modId] : null;
        if (mod) {
          for (const mount of ship.mounts) {
            const assignment = assignmentById.get(mount.id);
            if (!assignment?.weaponInstanceId) continue;
            if (assignment.modInstanceIds.includes(payload.instanceId)) {
              eligibleMounts.add(mount.id);
              continue;
            }
            if (assignment.modInstanceIds.length >= (mount.modSlots ?? 0))
              continue;
            const hasSameType = assignment.modInstanceIds.some(
              (modInstanceId) => {
                const existingInstance = this.save.ownedMods.find(
                  (item) => item.id === modInstanceId,
                );
                const existing = existingInstance
                  ? MODS[existingInstance.modId]
                  : null;
                return existing?.iconKind === mod.iconKind;
              },
            );
            if (!hasSameType) {
              eligibleMounts.add(mount.id);
            }
          }
        }
      }
    }
    for (const [mountId, dot] of this.mountDots.entries()) {
      const eligible = eligibleMounts.has(mountId);
      dot.classList.toggle("is-eligible", eligible);
      const isDrop = eligible && this.dragHoverMountId === mountId;
      dot.classList.toggle("is-drop", isDrop);
    }
  }

  private buildInventoryCard(
    instanceId: WeaponInstanceId,
    weapon: WeaponDefinition,
  ): HTMLElement {
    const accentColor = weapon.stats.bullet.color ?? 0x7df9ff;
    const accent = formatColor(accentColor);
    const status = "Drag to mount";
    const state: ShopCardState = "owned";
    const { card, inner } = this.createCardBase({
      accent,
      accentColor,
      description: weapon.description,
      gunId: weapon.gunId,
      iconKind: "gun",
      name: weapon.name,
      state,
      status,
      tag: "div",
      weaponSize: weapon.size,
    });

    card.dataset.type = "inventory";
    card.dataset.kind = "weapon";
    card.dataset.instanceId = instanceId;
    card.dataset.weaponId = weapon.id;
    card.setAttribute("draggable", "true");
    card.addEventListener("dragstart", this.handleDragStartBound);
    card.addEventListener("dragend", this.handleDragEndBound);

    const actions = document.createElement("div");
    actions.className = "shop-card-actions";
    const sell = document.createElement("button");
    sell.type = "button";
    sell.className = "shop-card-action";
    sell.dataset.action = "sell-weapon";
    sell.dataset.instanceId = instanceId;
    const payout = Math.max(0, Math.round(weapon.cost * SELL_RATIO));
    sell.textContent = `Sell +${formatCost(
      payout,
      weapon.costResource ?? PRIMARY_RESOURCE_ID,
    )}`;
    actions.appendChild(sell);
    inner.appendChild(actions);
    return card;
  }

  private buildModInventoryCard(
    instanceId: ModInstanceId,
    mod: ModDefinition,
  ): HTMLElement {
    const accentColor = this.getModAccentColor(mod.iconKind);
    const accent = formatColor(accentColor);
    const status = "Drag to mount";
    const state: ShopCardState = "owned";
    const { card, inner } = this.createCardBase({
      accent,
      accentColor,
      description: mod.description,
      iconKind: "mod",
      modIcon: mod.iconKind,
      name: mod.name,
      state,
      status,
      tag: "div",
    });

    card.dataset.type = "inventory";
    card.dataset.kind = "mod";
    card.dataset.instanceId = instanceId;
    card.dataset.modId = mod.id;
    card.setAttribute("draggable", "true");
    card.addEventListener("dragstart", this.handleDragStartBound);
    card.addEventListener("dragend", this.handleDragEndBound);

    const actions = document.createElement("div");
    actions.className = "shop-card-actions";
    const sell = document.createElement("button");
    sell.type = "button";
    sell.className = "shop-card-action";
    sell.dataset.action = "sell-mod";
    sell.dataset.instanceId = instanceId;
    const payout = Math.max(0, Math.round(mod.cost * SELL_RATIO));
    sell.textContent = `Sell +${formatCost(
      payout,
      mod.costResource ?? PRIMARY_RESOURCE_ID,
    )}`;
    actions.appendChild(sell);
    inner.appendChild(actions);
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
    if (action?.dataset.action === "show-armory") {
      this.currentCategory = "armory";
      this.refreshOverlay();
      return;
    }
    if (action?.dataset.action === "show-loadout") {
      this.currentCategory = "loadout";
      this.refreshOverlay();
      return;
    }
    if (action?.dataset.action === "sell-weapon") {
      const instanceId = action.dataset.instanceId;
      if (instanceId) this.sellWeaponInstance(instanceId);
      return;
    }
    if (action?.dataset.action === "sell-mod") {
      const instanceId = action.dataset.instanceId;
      if (instanceId) this.sellModInstance(instanceId);
      return;
    }
    if (action?.dataset.action === "detach-weapon") {
      const mountId = action.dataset.mountId;
      if (mountId) this.detachWeaponFromMount(mountId);
      return;
    }

    const card = target.closest<HTMLElement>("[data-type][data-id]");
    if (!card) return;
    const type = card.dataset.type as ShopItemType | undefined;
    const id = card.dataset.id;
    if (!type || !id) return;

    if (type === "ship") {
      const ship = SHIPS[id];
      if (!ship) return;
      const owned = this.save.unlockedShips.includes(id);
      const canPurchase = this.isShipAllowedForPurchase(id);
      const canUnlock = hasRequiredUnlocks(this.save, ship.requiresUnlocks);
      if (!owned && (!canPurchase || !canUnlock)) return;
      this.updateSave((data) => {
        const unlocked = data.unlockedShips.includes(id);
        if (!unlocked) {
          if (!hasRequiredUnlocks(data, ship.requiresUnlocks)) return;
          if (!canPurchase) return;
          const resourceId = ship.costResource ?? PRIMARY_RESOURCE_ID;
          if (!spendResourceInSave(data, resourceId, ship.cost)) return;
          data.unlockedShips = [...data.unlockedShips, id];
        }
        data.selectedShipId = id;
      });
      this.refreshOverlay();
      return;
    }

    if (type === "weapon") {
      const weapon = WEAPONS[id];
      if (!weapon) return;
      if (!this.isWeaponAllowed(weapon)) return;
      if (!hasRequiredUnlocks(this.save, weapon.requiresUnlocks)) return;
      this.updateSave((data) => {
        if (!hasRequiredUnlocks(data, weapon.requiresUnlocks)) return;
        const resourceId = weapon.costResource ?? PRIMARY_RESOURCE_ID;
        if (!spendResourceInSave(data, resourceId, weapon.cost)) return;
        createWeaponInstanceInSave(data, weapon.id);
      });
      this.refreshOverlay();
      return;
    }

    if (type === "mod") {
      const mod = MODS[id];
      if (!mod) return;
      if (!this.isModAllowed(mod)) return;
      if (!hasRequiredUnlocks(this.save, mod.requiresUnlocks)) return;
      this.updateSave((data) => {
        if (!hasRequiredUnlocks(data, mod.requiresUnlocks)) return;
        const resourceId = mod.costResource ?? PRIMARY_RESOURCE_ID;
        if (!spendResourceInSave(data, resourceId, mod.cost)) return;
        createModInstanceInSave(data, mod.id);
      });
      this.refreshOverlay();
    }
  }

  private sellWeaponInstance(instanceId: WeaponInstanceId): void {
    this.updateSave(
      (data) => {
        const index = data.ownedWeapons.findIndex(
          (item) => item.id === instanceId,
        );
        if (index < 0) return;
        const weaponId = data.ownedWeapons[index].weaponId;
        const weapon = WEAPONS[weaponId];
        if (!weapon) return;
        for (const assignments of Object.values(data.mountedWeapons)) {
          for (const entry of assignments) {
            if (entry.weaponInstanceId === instanceId) {
              entry.weaponInstanceId = null;
              entry.modInstanceIds = [];
            }
          }
        }
        data.ownedWeapons.splice(index, 1);
        const payout = Math.max(0, Math.round(weapon.cost * SELL_RATIO));
        addResourceInSave(
          data,
          weapon.costResource ?? PRIMARY_RESOURCE_ID,
          payout,
        );
      },
      { allowEmptyLoadout: true },
    );
    this.refreshOverlay();
  }

  private sellModInstance(instanceId: ModInstanceId): void {
    this.updateSave(
      (data) => {
        const index = data.ownedMods.findIndex(
          (item) => item.id === instanceId,
        );
        if (index < 0) return;
        const modId = data.ownedMods[index].modId;
        const mod = MODS[modId];
        if (!mod) return;
        for (const assignments of Object.values(data.mountedWeapons)) {
          for (const entry of assignments) {
            entry.modInstanceIds = entry.modInstanceIds.filter(
              (mountedModId) => mountedModId !== instanceId,
            );
          }
        }
        data.ownedMods.splice(index, 1);
        const payout = Math.max(0, Math.round(mod.cost * SELL_RATIO));
        addResourceInSave(
          data,
          mod.costResource ?? PRIMARY_RESOURCE_ID,
          payout,
        );
      },
      { allowEmptyLoadout: true },
    );
    this.refreshOverlay();
  }

  private detachWeaponFromMount(mountId: string): void {
    this.updateSave(
      (data) => {
        const ship = SHIPS[data.selectedShipId];
        if (!ship) return;
        const assignments = this.ensureMountAssignments(data, ship);
        const entry = assignments.find((item) => item.mountId === mountId);
        if (entry) {
          entry.weaponInstanceId = null;
          entry.modInstanceIds = [];
        }
      },
      { allowEmptyLoadout: true },
    );
    this.refreshOverlay();
  }

  private assignWeaponToMount(payload: DragPayload, mountId: string): void {
    if (payload.kind !== "weapon") return;
    if (payload.sourceMountId && payload.sourceMountId === mountId) return;
    this.updateSave(
      (data) => {
        const ship = SHIPS[data.selectedShipId];
        if (!ship) return;
        const assignments = this.ensureMountAssignments(data, ship);
        const target = assignments.find((item) => item.mountId === mountId);
        if (!target) return;
        const instance = data.ownedWeapons.find(
          (item) => item.id === payload.instanceId,
        );
        if (!instance) return;
        const weapon = WEAPONS[instance.weaponId];
        const mount = ship.mounts.find((entry) => entry.id === mountId);
        if (!weapon || !mount) return;
        if (!canMountWeapon(weapon, mount)) return;

        for (const entry of assignments) {
          if (entry.weaponInstanceId === payload.instanceId) {
            entry.weaponInstanceId = null;
          }
        }

        if (payload.sourceMountId) {
          const source = assignments.find(
            (item) => item.mountId === payload.sourceMountId,
          );
          const swapped = target.weaponInstanceId;
          target.weaponInstanceId = payload.instanceId;
          if (source) {
            source.weaponInstanceId = swapped ?? null;
          }
        } else {
          target.weaponInstanceId = payload.instanceId;
        }
      },
      { allowEmptyLoadout: true },
    );
    this.refreshOverlay();
  }

  private detachModFromMount(
    mountId: string,
    modInstanceId: ModInstanceId,
  ): void {
    this.updateSave(
      (data) => {
        const ship = SHIPS[data.selectedShipId];
        if (!ship) return;
        const assignments = this.ensureMountAssignments(data, ship);
        const entry = assignments.find((item) => item.mountId === mountId);
        if (!entry) return;
        entry.modInstanceIds = entry.modInstanceIds.filter(
          (id) => id !== modInstanceId,
        );
      },
      { allowEmptyLoadout: true },
    );
    this.refreshOverlay();
  }

  private assignModToMount(payload: DragPayload, mountId: string): void {
    if (payload.kind !== "mod") return;
    this.updateSave(
      (data) => {
        const ship = SHIPS[data.selectedShipId];
        if (!ship) return;
        const assignments = this.ensureMountAssignments(data, ship);
        const target = assignments.find((item) => item.mountId === mountId);
        const mount = ship.mounts.find((entry) => entry.id === mountId);
        if (!target || !mount || !target.weaponInstanceId) return;

        const modInstance = data.ownedMods.find(
          (item) => item.id === payload.instanceId,
        );
        const mod = modInstance ? MODS[modInstance.modId] : null;
        if (!mod) return;

        if (target.modInstanceIds.includes(payload.instanceId)) return;

        const hasSameType = target.modInstanceIds.some((instanceId) => {
          const existing = data.ownedMods.find(
            (item) => item.id === instanceId,
          );
          const existingMod = existing ? MODS[existing.modId] : null;
          return existingMod?.iconKind === mod.iconKind;
        });
        if (hasSameType) return;
        if (target.modInstanceIds.length >= (mount.modSlots ?? 0)) return;

        for (const entry of assignments) {
          entry.modInstanceIds = entry.modInstanceIds.filter(
            (instanceId) => instanceId !== payload.instanceId,
          );
        }
        target.modInstanceIds = [...target.modInstanceIds, payload.instanceId];
      },
      { allowEmptyLoadout: true },
    );
    this.refreshOverlay();
  }

  private handleDragStart(event: DragEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const card = target.closest<HTMLElement>("[data-instance-id]");
    if (card?.getAttribute("draggable") !== "true") return;
    if (!card) return;
    const instanceId = card.dataset.instanceId;
    if (!instanceId) return;
    const kind = card.dataset.kind === "mod" ? "mod" : "weapon";
    if (
      this.dragPayload?.instanceId === instanceId &&
      this.dragPayload.kind === kind
    ) {
      return;
    }
    const payload: DragPayload =
      kind === "mod"
        ? {
            instanceId,
            kind,
            sourceMountId: card.dataset.mountId,
          }
        : {
            instanceId,
            kind,
            sourceMountId: card.dataset.mountId,
          };
    this.dragPayload = payload;
    this.dragHoverMountId = null;
    this.updateMountVisualHighlights();
    event.dataTransfer?.setData("text/plain", JSON.stringify(payload));
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
    }
    if (payload.kind === "weapon") {
      const weapon =
        this.resolveWeaponForDrag(card) ?? this.resolveWeaponForDrag(target);
      if (weapon) {
        this.setDragPreview(event, weapon);
      }
    } else {
      const mod =
        this.resolveModForDrag(card) ?? this.resolveModForDrag(target);
      if (mod) {
        this.setModDragPreview(event, mod);
      }
    }
  }

  private handleDragOver(event: DragEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const overMount = target.closest<HTMLElement>(
      "[data-type='mount'][data-mount-id], [data-drop='mount'][data-mount-id]",
    );
    const overInventory = target.closest<HTMLElement>(
      "[data-drop='inventory']",
    );
    const overDetach = target.closest<HTMLElement>("[data-drop='detach']");
    if (overMount || overInventory || overDetach) {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
    }
    this.dragPreviewEl?.classList.toggle(
      "is-droppable",
      Boolean(overMount ?? overInventory ?? overDetach),
    );
    const payload = this.dragPayload ?? this.readDragPayload(event);
    if (payload && !this.dragPayload) {
      this.dragPayload = payload;
    }
    const nextHover = overMount?.dataset.mountId ?? null;
    if (nextHover !== this.dragHoverMountId) {
      this.dragHoverMountId = nextHover;
      this.updateMountVisualHighlights();
    }
  }

  private handleDrop(event: DragEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    event.preventDefault();
    const payload = this.dragPayload ?? this.readDragPayload(event);
    if (!payload) return;
    const mountTarget = target.closest<HTMLElement>(
      "[data-type='mount'][data-mount-id], [data-drop='mount'][data-mount-id]",
    );
    if (mountTarget) {
      const mountId = mountTarget.dataset.mountId;
      if (mountId) {
        if (payload.kind === "weapon") {
          this.assignWeaponToMount(payload, mountId);
        } else {
          this.assignModToMount(payload, mountId);
        }
      }
      this.dragPayload = null;
      this.dragHoverMountId = null;
      this.updateMountVisualHighlights();
      return;
    }
    const inventoryTarget = target.closest<HTMLElement>(
      "[data-drop='inventory']",
    );
    const detachTarget = target.closest<HTMLElement>("[data-drop='detach']");
    if ((inventoryTarget || detachTarget) && payload.sourceMountId) {
      if (payload.kind === "weapon") {
        this.detachWeaponFromMount(payload.sourceMountId);
      } else {
        this.detachModFromMount(payload.sourceMountId, payload.instanceId);
      }
    }
    this.dragPayload = null;
    this.dragHoverMountId = null;
    this.updateMountVisualHighlights();
  }

  private handleDragEnd(): void {
    this.dragPayload = null;
    this.dragHoverMountId = null;
    this.dragPreviewEl?.remove();
    this.dragPreviewEl = undefined;
    this.updateMountVisualHighlights();
  }

  private resolveWeaponForDrag(element: HTMLElement): null | WeaponDefinition {
    const weaponId = element.dataset.weaponId;
    if (weaponId && WEAPONS[weaponId]) return WEAPONS[weaponId];
    const instanceId = element.dataset.instanceId;
    if (!instanceId) return null;
    const instance = this.save.ownedWeapons.find(
      (item) => item.id === instanceId,
    );
    if (!instance) return null;
    return WEAPONS[instance.weaponId] ?? null;
  }

  private resolveModForDrag(element: HTMLElement): ModDefinition | null {
    const modId = element.dataset.modId;
    if (modId && MODS[modId]) return MODS[modId];
    const instanceId = element.dataset.instanceId;
    if (!instanceId) return null;
    const instance = this.save.ownedMods.find((item) => item.id === instanceId);
    if (!instance) return null;
    return MODS[instance.modId] ?? null;
  }

  private setDragPreview(event: DragEvent, weapon: WeaponDefinition): void {
    const transfer = event.dataTransfer;
    if (!transfer) return;
    this.dragPreviewEl?.remove();
    const preview = document.createElement("div");
    preview.className = "shop-drag-preview";
    const canvas = document.createElement("canvas");
    canvas.className = "shop-drag-preview-icon";
    canvas.width = 36;
    canvas.height = 36;
    preview.appendChild(canvas);
    const color = formatColor(weapon.stats.bullet.color ?? 0x7df9ff);
    this.drawIcon(
      canvas,
      "gun",
      color,
      weapon.stats.bullet.color ?? 0x7df9ff,
      this.getSelectedShip().vector,
      weapon.gunId,
      undefined,
      weapon.size,
    );
    document.body.appendChild(preview);
    transfer.setDragImage(preview, 22, 22);
    this.dragPreviewEl = preview;
  }

  private setModDragPreview(event: DragEvent, mod: ModDefinition): void {
    const transfer = event.dataTransfer;
    if (!transfer) return;
    this.dragPreviewEl?.remove();
    const preview = document.createElement("div");
    preview.className = "shop-drag-preview";
    const canvas = document.createElement("canvas");
    canvas.className = "shop-drag-preview-icon";
    canvas.width = 36;
    canvas.height = 36;
    preview.appendChild(canvas);
    const colorValue = this.getModAccentColor(mod.iconKind);
    const color = formatColor(colorValue);
    this.drawIcon(
      canvas,
      "mod",
      color,
      colorValue,
      this.getSelectedShip().vector,
      undefined,
      mod.iconKind,
      undefined,
    );
    document.body.appendChild(preview);
    transfer.setDragImage(preview, 22, 22);
    this.dragPreviewEl = preview;
  }

  private readDragPayload(event: DragEvent): DragPayload | null {
    const raw = event.dataTransfer?.getData("text/plain");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<DragPayload>;
      if (!parsed.instanceId) return null;
      const kind = parsed.kind === "mod" ? "mod" : "weapon";
      return {
        instanceId: parsed.instanceId,
        kind,
        sourceMountId: parsed.sourceMountId,
      };
    } catch {
      return null;
    }
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
    const ship = this.getSelectedShip();
    const mountedWeapons = buildMountedWeapons(this.save, ship);
    this.previewScene.setLoadout(mountedWeapons, ship);
  }

  private drawIcon(
    canvas: HTMLCanvasElement,
    kind: CardIconKind,
    color: string,
    colorValue: number,
    shipShape: ShipVector,
    gunId?: string,
    modIcon?: ModIconKind,
    weaponSize?: WeaponSize,
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
    if (kind === "mod") {
      this.drawModIcon(
        ctx,
        modIcon ?? "power",
        width / 2,
        height / 2,
        width * 0.3,
        color,
      );
      return;
    }
    const gun = gunId ? GUNS[gunId] : null;
    if (gun) {
      const scale = weaponSize === "large" ? 0.34 : 0.26;
      drawGunToCanvas(
        ctx,
        gun,
        width / 2,
        height / 2,
        width * scale,
        colorValue,
      );
      return;
    }
    this.drawBullet(ctx, "orb", width / 2, height / 2, width * 0.32, color);
  }

  private getModAccentColor(icon: ModIconKind): number {
    switch (icon) {
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
  }

  private drawModIcon(
    ctx: CanvasRenderingContext2D,
    icon: ModIconKind,
    x: number,
    y: number,
    size: number,
    color: string,
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    switch (icon) {
      case "power":
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.5);
        ctx.lineTo(size * 0.2, -size * 0.1);
        ctx.lineTo(-size * 0.05, -size * 0.1);
        ctx.lineTo(size * 0.18, size * 0.45);
        ctx.lineTo(-size * 0.2, size * 0.02);
        ctx.lineTo(size * 0.02, size * 0.02);
        ctx.closePath();
        ctx.fill();
        break;
      case "homing":
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.45, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case "aoe":
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.45, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.22, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "multi":
        for (const dx of [-0.35, 0, 0.35]) {
          ctx.beginPath();
          ctx.arc(size * dx, 0, size * 0.14, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case "bounce":
        ctx.beginPath();
        ctx.arc(-size * 0.18, -size * 0.12, size * 0.14, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-size * 0.06, -size * 0.22);
        ctx.lineTo(size * 0.3, -size * 0.22);
        ctx.lineTo(size * 0.18, -size * 0.36);
        ctx.moveTo(size * 0.3, -size * 0.22);
        ctx.lineTo(size * 0.18, -size * 0.08);
        ctx.stroke();
        break;
    }
    ctx.restore();
  }

  private drawShip(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    stroke: string,
    fill: string,
    vector: ShipVector,
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    drawShipToCanvas(ctx, vector, r);
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
