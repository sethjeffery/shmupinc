import type { ShopRules } from "../data/levels";
import type { ModInstanceId } from "../data/modInstances";
import type { ModIconKind, ModId } from "../data/mods";
import type { ModDefinition, ModIconVector } from "../data/modTypes";
import type { MountAssignment, MountedWeapon, SaveData } from "../data/save";
import type { ShipId } from "../data/ships";
import type { ShipDefinition, ShipVector } from "../data/shipTypes";
import type { WeaponInstanceId } from "../data/weaponInstances";
import type { WeaponDefinition, WeaponId } from "../data/weapons";
import type { WeaponSize } from "../data/weaponTypes";

import { signal } from "@preact/signals";
import clsx from "clsx";
import Phaser from "phaser";
import { render } from "preact";

import { getActiveLevelSession } from "../data/levelState";
import { MODS } from "../data/mods";
import {
  autoAttachWeaponsForShipInSave,
  buildMountedWeapons,
  createModInstanceInSave,
  createWeaponInstanceInSave,
  getResourceAmount,
  hasRequiredUnlocks,
  loadSave,
  mutateSave,
} from "../data/save";
import { SHIPS } from "../data/ships";
import { filterShopItems, pickAllowedId } from "../data/shopRules";
import { canMountWeapon } from "../data/weaponMounts";
import { WEAPONS } from "../data/weapons";
import { DEFAULT_SHIP_VECTOR } from "../render/shipShapes";
import * as DragPreview from "../ui/dragPreview";
import NodeGraphContainer, { NodeLink } from "../ui/loadout/NodeGraph";
import {
  createNodeGraphLayout,
  getVisibleMounts,
  MAX_RENDERED_MOD_SLOTS,
  type NodeGraphPoint,
} from "../ui/loadout/nodeGraphLayout";
import { drawShopIcon, type CardIconKind } from "../ui/shop/iconPainter";
import { DEFAULT_SHOP_CATEGORY, type ShopCategory } from "../ui/shop/shopTabs";
import ShopNodeIcon from "../ui/ShopNodeIcon";
import { ShopOverlayView } from "../ui/ShopOverlayView";
import { PreviewScene } from "./PreviewScene";
import { getEligibleMountIdsForDrag } from "./shop/dragEligibility";
import {
  assignModToMountInSave,
  assignModToSlotInSave,
  assignWeaponToMountInSave,
  clearModSlotInSave,
  detachModFromMountInSave,
  detachWeaponFromMountInSave,
  purchaseModInSave,
  purchaseWeaponInSave,
  selectOrPurchaseShipInSave,
} from "./shop/saveOps";

import styles from "./ShopScene.module.css";

export interface BuildNodeIconOptions {
  accentColor: number;
  className?: string;
  gunId?: string;
  modVector?: ModIconVector;
  iconKind?: CardIconKind;
  size?: number;
  shipShape?: ShipVector;
  weaponSize?: WeaponSize;
}

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

interface MountNodeSelection {
  kind: "mount";
  mountId: string;
}

interface ModNodeSelection {
  kind: "mod";
  mountId: string;
  slotIndex: number;
}

type LoadoutNodeSelection = ModNodeSelection | MountNodeSelection;

const PRIMARY_RESOURCE_ID = "gold";

const formatCost = (cost: number, resourceId: string): string =>
  resourceId === PRIMARY_RESOURCE_ID ? `${cost}g` : `${cost} ${resourceId}`;

const formatColor = (color: number): string =>
  `#${color.toString(16).padStart(6, "0")}`;

interface ShopStatsView {
  damage: {
    tierOne: number;
    tierThree: number;
    tierTwo: number;
  };
  hull: { fill: number };
  magnet: { fill: number };
  thrust: { fill: number };
}

interface ShopPreviewSelection {
  id: string;
  kind: "mod" | "ship" | "weapon";
}

interface ShopCarouselItem {
  accentColor: number;
  cost: number;
  costLabel: null | string;
  costResource: string;
  description: string;
  equipped: boolean;
  id: string;
  kind: "mod" | "ship" | "weapon";
  name: string;
  owned: boolean;
  purchasable: boolean;
  shipShape?: ShipVector;
  weaponSize?: WeaponSize;
  gunId?: string;
  modVector?: ModIconVector;
}

interface LoadoutCarouselItem {
  accentColor: number;
  id: string;
  instanceId: string;
  isCurrent: boolean;
  kind: "mod" | "weapon";
  meta: string;
  name: string;
  gunId?: string;
  modVector?: ModIconVector;
  weaponSize?: WeaponSize;
}

export class ShopScene extends Phaser.Scene {
  private save!: SaveData;
  private overlay?: HTMLDivElement;
  private previewRoot?: HTMLDivElement;
  private previewGame?: Phaser.Game;
  private previewScene?: PreviewScene;
  private resizeObserver?: ResizeObserver;
  private mountVisual?: HTMLElement;
  private mountDots = new Map<string, HTMLElement>();
  private mountCallouts = new Map<string, HTMLDivElement>();
  private mountCalloutLines = new Map<string, HTMLDivElement>();
  private dragHoverMountId: null | string = null;
  private dragPreviewEl?: HTMLDivElement;
  private currentCategory: ShopCategory = DEFAULT_SHOP_CATEGORY;
  private readonly categorySignal = signal<ShopCategory>(DEFAULT_SHOP_CATEGORY);
  private readonly contentSignal = signal<preact.ComponentChild>(null);
  private readonly goldSignal = signal("0");
  private readonly missionActiveSignal = signal(false);
  private readonly missionTextSignal = signal("");
  private shopRules: null | ShopRules = null;
  private dragPayload: DragPayload | null = null;
  private loadoutSelection: LoadoutNodeSelection | null = null;
  private previewSelection: null | ShopPreviewSelection = null;
  private loadoutPreviewChoice: {
    instanceId: string;
    kind: "mod" | "weapon";
  } | null = null;
  private nodeGraphDrag: {
    pointerId: number;
    startX: number;
    startY: number;
  } | null = null;
  private nodeGraphPinchStart: { distance: number; scale: number } | null =
    null;
  private nodeGraphPointers = new Map<number, NodeGraphPoint>();
  private nodeGraphOffset = { x: 0, y: 0 };
  private nodeGraphScale = 1;
  private nodeGraphTransformReady = false;
  private nodeGraphViewport?: HTMLDivElement;
  private nodeGraphWorld?: HTMLDivElement;
  private activeEnergySurge: { mountId: string; slotIndex?: number } | null =
    null;
  private energySurgeTimeout: null | number = null;
  private previewCanvasSize = { height: 0, width: 0 };
  private handleDragStartBound = (event: DragEvent) =>
    this.handleDragStart(event);
  private handleDragOverBound = (event: DragEvent) =>
    this.handleDragOver(event);
  private handleDropBound = (event: DragEvent) => this.handleDrop(event);
  private handleDragEndBound = () => this.handleDragEnd();
  private handleWindowResizeBound = () => this.syncPreviewCanvasSize();
  private handlePreviewRootRef = (element: HTMLDivElement | null) => {
    this.previewRoot = element ?? undefined;
    this.previewCanvasSize = { height: 0, width: 0 };
    if (element) {
      this.setupPreviewGame();
      this.applyPreviewLoadout();
      this.syncPreviewCanvasSize();
    }
  };

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
    const overlayHost = document.getElementById("shop-overlay-root");
    if (!(overlayHost instanceof HTMLDivElement)) {
      throw new Error("Missing #shop-overlay-root host.");
    }
    this.overlay = overlayHost;
    this.overlay.className = styles["shop-overlay"];
    this.renderOverlay(this.overlay);
    document.body.classList.add("shop-open");
    window.addEventListener("resize", this.handleWindowResizeBound);
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
    this.overlay.removeEventListener("dragstart", this.handleDragStartBound);
    this.overlay.removeEventListener("dragover", this.handleDragOverBound);
    this.overlay.removeEventListener("drop", this.handleDropBound);
    this.overlay.removeEventListener("dragend", this.handleDragEndBound);
    render(null, this.overlay);
    this.overlay.className = "";
    this.overlay = undefined;
    this.previewRoot = undefined;
    this.shopRules = null;
    this.previewSelection = null;
    this.loadoutPreviewChoice = null;
    this.previewCanvasSize = { height: 0, width: 0 };
    this.mountVisual = undefined;
    this.mountDots.clear();
    this.mountCallouts.clear();
    this.mountCalloutLines.clear();
    this.dragHoverMountId = null;
    this.nodeGraphDrag = null;
    this.nodeGraphPinchStart = null;
    this.nodeGraphPointers.clear();
    this.nodeGraphTransformReady = false;
    this.nodeGraphViewport = undefined;
    this.nodeGraphWorld = undefined;
    this.clearDragPreview();
    if (this.energySurgeTimeout !== null) {
      window.clearTimeout(this.energySurgeTimeout);
      this.energySurgeTimeout = null;
    }
    this.activeEnergySurge = null;
    window.removeEventListener("resize", this.handleWindowResizeBound);
    document.body.classList.remove("shop-open");
  }

  private renderOverlay(overlay: HTMLDivElement): void {
    render(
      <ShopOverlayView
        onDeploy={() => this.handleDeploy()}
        onQuit={() => this.handleQuitToMenu()}
        onTabSelect={(category) => this.setCategory(category)}
        signals={{
          category: this.categorySignal,
          content: this.contentSignal,
          gold: this.goldSignal,
          missionActive: this.missionActiveSignal,
          missionText: this.missionTextSignal,
        }}
      />,
      overlay,
    );
  }

  private refreshOverlay(): void {
    if (!this.overlay) return;
    this.syncShopRules();
    this.ensureAllowedSelections();
    this.ensurePreviewSelection();
    const goldValue = `${Math.round(getResourceAmount(this.save, PRIMARY_RESOURCE_ID))}`;
    this.goldSignal.value = goldValue;
    this.categorySignal.value = this.currentCategory;
    this.contentSignal.value = this.buildCategoryContent(this.currentCategory);
    if (this.currentCategory !== "loadout") {
      this.loadoutPreviewChoice = null;
      window.requestAnimationFrame(() => {
        this.setupPreviewGame();
        this.applyPreviewLoadout();
        this.syncPreviewCanvasSize();
      });
    } else {
      this.previewRoot = undefined;
      this.teardownPreviewGame();
      this.mountVisual = undefined;
      this.mountDots.clear();
      this.mountCallouts.clear();
      this.mountCalloutLines.clear();
      this.dragHoverMountId = null;
      this.nodeGraphDrag = null;
      this.nodeGraphPinchStart = null;
      this.nodeGraphPointers.clear();
      this.nodeGraphTransformReady = false;
      this.nodeGraphViewport = undefined;
      this.nodeGraphWorld = undefined;
      window.requestAnimationFrame(() => this.syncNodeGraphTransform());
    }
  }

  private setCategory(category: ShopCategory): void {
    if (this.currentCategory === category) return;
    this.currentCategory = category;
    this.refreshOverlay();
  }

  private handleDeploy(): void {
    this.game.events.emit("ui:route", "play");
  }

  private handleQuitToMenu(): void {
    this.game.events.emit("ui:route", "menu");
  }

  private updateSave(
    mutator: (data: SaveData) => void,
    options?: { allowEmptyLoadout?: boolean },
  ): void {
    const allowEmptyLoadout = options?.allowEmptyLoadout ?? true;
    this.save = mutateSave(mutator, { allowEmptyLoadout });
  }

  private syncShopRules(): void {
    const session = getActiveLevelSession();
    const level = session?.level;
    this.shopRules = level?.shopRules ?? null;
    if (level) {
      this.missionTextSignal.value = `Mission: ${level.title}`;
      this.missionActiveSignal.value = true;
    } else {
      this.missionTextSignal.value = "";
      this.missionActiveSignal.value = false;
    }
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

  private buildCategoryContent(category: ShopCategory): preact.ComponentChild {
    switch (category) {
      case "armory":
        return this.buildMarketView("armory");
      case "loadout":
        return this.buildLoadoutView();
      case "ships":
      default:
        return this.buildMarketView("ships");
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

  private getVisibleWeapons(): WeaponDefinition[] {
    if (!this.shopRules) return Object.values(WEAPONS);
    const byId = new Map<string, WeaponDefinition>();
    for (const weapon of this.getFilteredWeapons()) {
      byId.set(weapon.id, weapon);
    }
    for (const instance of this.save.ownedWeapons) {
      const weapon = WEAPONS[instance.weaponId];
      if (weapon) byId.set(weapon.id, weapon);
    }
    return [...byId.values()];
  }

  private getVisibleMods(): ModDefinition[] {
    if (!this.shopRules) return Object.values(MODS);
    const byId = new Map<string, ModDefinition>();
    for (const mod of this.getFilteredMods()) {
      byId.set(mod.id, mod);
    }
    for (const instance of this.save.ownedMods) {
      const mod = MODS[instance.modId];
      if (mod) byId.set(mod.id, mod);
    }
    return [...byId.values()];
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

  private ensurePreviewSelection(): void {
    if (this.currentCategory === "loadout") {
      this.previewSelection = null;
      return;
    }
    const items = this.getCarouselItems(this.currentCategory);
    if (items.length === 0) {
      this.previewSelection = null;
      return;
    }
    if (
      this.previewSelection &&
      items.some(
        (item) =>
          item.id === this.previewSelection?.id &&
          item.kind === this.previewSelection?.kind,
      )
    ) {
      return;
    }
    const preferred = items.find((item) => item.equipped) ?? items[0];
    this.previewSelection = { id: preferred.id, kind: preferred.kind };
  }

  private getCarouselItems(category: ShopCategory): ShopCarouselItem[] {
    if (category === "ships") return this.buildShipCarouselItems();
    if (category === "armory") return this.buildArmoryCarouselItems();
    return [];
  }

  private buildShipCarouselItems(): ShopCarouselItem[] {
    const allowedIds = new Set(this.getFilteredShips().map((ship) => ship.id));
    return [...this.getVisibleShips()]
      .sort((a, b) => a.cost - b.cost)
      .filter((ship) => {
        const owned = this.save.unlockedShips.includes(ship.id);
        return owned || hasRequiredUnlocks(this.save, ship.requiresUnlocks);
      })
      .map((ship) => {
        const owned = this.save.unlockedShips.includes(ship.id);
        return {
          accentColor: ship.color,
          cost: ship.cost,
          costLabel: owned
            ? null
            : formatCost(ship.cost, ship.costResource ?? PRIMARY_RESOURCE_ID),
          costResource: ship.costResource ?? PRIMARY_RESOURCE_ID,
          description: ship.description,
          equipped: this.save.selectedShipId === ship.id,
          id: ship.id,
          kind: "ship",
          name: ship.name,
          owned,
          purchasable: !owned && allowedIds.has(ship.id),
          shipShape: ship.vector,
        } satisfies ShopCarouselItem;
      });
  }

  private buildArmoryCarouselItems(): ShopCarouselItem[] {
    const allowedWeaponIds = new Set(
      this.getFilteredWeapons().map((item) => item.id),
    );
    const allowedModIds = new Set(
      this.getFilteredMods().map((item) => item.id),
    );
    const weaponCards = this.getVisibleWeapons()
      .sort((a, b) => a.cost - b.cost)
      .filter((weapon) => {
        const owned = this.save.ownedWeapons.some(
          (instance) => instance.weaponId === weapon.id,
        );
        return owned || hasRequiredUnlocks(this.save, weapon.requiresUnlocks);
      })
      .map((weapon) => {
        const owned = this.save.ownedWeapons.some(
          (instance) => instance.weaponId === weapon.id,
        );
        return {
          accentColor: weapon.stats.bullet.color ?? 0x7df9ff,
          cost: weapon.cost,
          costLabel: owned
            ? null
            : formatCost(
                weapon.cost,
                weapon.costResource ?? PRIMARY_RESOURCE_ID,
              ),
          costResource: weapon.costResource ?? PRIMARY_RESOURCE_ID,
          description: weapon.description,
          equipped: this.isWeaponEquipped(weapon.id),
          gunId: weapon.gunId,
          id: weapon.id,
          kind: "weapon",
          name: weapon.name,
          owned,
          purchasable: !owned && allowedWeaponIds.has(weapon.id),
          weaponSize: weapon.size,
        } satisfies ShopCarouselItem;
      });

    const modCards = this.getVisibleMods()
      .sort((a, b) => a.cost - b.cost)
      .filter((mod) => {
        const owned = this.save.ownedMods.some(
          (instance) => instance.modId === mod.id,
        );
        return owned || hasRequiredUnlocks(this.save, mod.requiresUnlocks);
      })
      .map((mod) => {
        const owned = this.save.ownedMods.some(
          (instance) => instance.modId === mod.id,
        );
        const accentColor = this.getModAccentColor(mod.iconKind);
        return {
          accentColor,
          cost: mod.cost,
          costLabel: owned
            ? null
            : formatCost(mod.cost, mod.costResource ?? PRIMARY_RESOURCE_ID),
          costResource: mod.costResource ?? PRIMARY_RESOURCE_ID,
          description: mod.description,
          equipped: this.isModEquipped(mod.id),
          id: mod.id,
          kind: "mod",
          modVector: mod.icon,
          name: mod.name,
          owned,
          purchasable: !owned && allowedModIds.has(mod.id),
        } satisfies ShopCarouselItem;
      });

    return [...weaponCards, ...modCards].sort((a, b) => a.cost - b.cost);
  }

  private buildMarketView(category: "armory" | "ships"): preact.ComponentChild {
    const items = this.getCarouselItems(category);
    const selected =
      this.previewSelection &&
      items.find(
        (item) =>
          item.id === this.previewSelection?.id &&
          item.kind === this.previewSelection?.kind,
      );

    return (
      <div className={styles["shop-market"]}>
        <div className={styles["shop-carousel-outer"]}>
          <div className={styles["shop-carousel"]} data-kind={category}>
            {items.map((item) => {
              const selectedItem =
                item.id === this.previewSelection?.id &&
                item.kind === this.previewSelection?.kind;
              const className = clsx(
                styles["shop-carousel-item"],
                selectedItem ? styles["is-selected"] : undefined,
                item.owned ? styles["is-owned"] : undefined,
                item.kind === "mod"
                  ? styles["is-mod"]
                  : item.kind === "weapon"
                    ? styles["is-weapon"]
                    : styles["is-ship"],
                item.equipped ? styles["is-equipped"] : undefined,
              );
              return (
                <button
                  className={className}
                  key={`${item.kind}-${item.id}`}
                  onClick={() => this.handleMarketTileClick(item)}
                  style={
                    {
                      "--accent": formatColor(item.accentColor),
                    } as Record<string, string>
                  }
                  type="button"
                >
                  <span className={styles["shop-carousel-item-icon"]}>
                    {this.buildNodeIcon(
                      item.kind === "weapon"
                        ? "gun"
                        : item.kind === "mod"
                          ? "mod"
                          : "ship",
                      {
                        accentColor: item.accentColor,
                        className: styles["shop-carousel-icon-canvas"],
                        gunId: item.gunId,
                        modVector: item.modVector,
                        shipShape: item.shipShape ?? DEFAULT_SHIP_VECTOR,
                        size: 52,
                        weaponSize: item.weaponSize,
                      },
                    )}
                  </span>
                  <span className={styles["shop-carousel-item-name"]}>
                    {item.name}
                  </span>
                  <span className={styles["shop-carousel-item-cost"]}>
                    {item.owned ? "Owned" : item.costLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {this.buildPreviewStage({
          action: selected ? this.buildPreviewAction(selected) : null,
          description:
            selected?.description ??
            "Select a ship, weapon, or mod from the carousel to preview it.",
          statusLabel: selected
            ? selected.owned
              ? selected.equipped
                ? "Equipped"
                : "Owned"
              : (selected.costLabel ?? "Unavailable")
            : "No Selection",
          title: selected?.name ?? "No Selection",
        })}
      </div>
    );
  }

  private buildPreviewStage(data: {
    action: preact.ComponentChild;
    description: string;
    statusLabel: string;
    title: string;
  }): preact.ComponentChild {
    const stats = this.getPreviewStats();
    return (
      <div className={styles["shop-preview-stage"]}>
        <div
          className={styles["shop-preview-canvas"]}
          ref={this.handlePreviewRootRef}
        />
        <div
          className={clsx(
            styles["shop-preview-corner"],
            styles["shop-preview-corner--top-left"],
          )}
        >
          <div className={styles["shop-preview-title"]}>{data.title}</div>
          <div className={styles["shop-preview-status"]}>
            {data.statusLabel}
          </div>
        </div>
        <div
          className={clsx(
            styles["shop-preview-corner"],
            styles["shop-preview-corner--top-right"],
          )}
        >
          {data.action}
        </div>
        <div
          className={clsx(
            styles["shop-preview-corner"],
            styles["shop-preview-corner--bottom-left"],
          )}
        >
          <div className={styles["shop-preview-description"]}>
            {data.description}
          </div>
        </div>
        {this.renderPreviewStatBars(stats)}
      </div>
    );
  }

  private renderPreviewStatBars(stats: ShopStatsView): preact.ComponentChild {
    return (
      <div className={styles["shop-preview-vbars"]} aria-label="Preview stats">
        <div className={styles["shop-preview-vbar"]} aria-label="Hull">
          <span
            className={clsx(
              styles["shop-preview-vbar-icon"],
              styles["is-hull"],
            )}
          />
          <span className={styles["shop-preview-vbar-rail"]}>
            <span
              className={styles["shop-preview-vbar-fill"]}
              style={{ height: `${Math.round(stats.hull.fill * 100)}%` }}
            />
          </span>
        </div>
        <div className={styles["shop-preview-vbar"]} aria-label="Thrust">
          <span
            className={clsx(
              styles["shop-preview-vbar-icon"],
              styles["is-thrust"],
            )}
          />
          <span className={styles["shop-preview-vbar-rail"]}>
            <span
              className={styles["shop-preview-vbar-fill"]}
              style={{ height: `${Math.round(stats.thrust.fill * 100)}%` }}
            />
          </span>
        </div>
        <div className={styles["shop-preview-vbar"]} aria-label="Magnet">
          <span
            className={clsx(
              styles["shop-preview-vbar-icon"],
              styles["is-magnet"],
            )}
          />
          <span className={styles["shop-preview-vbar-rail"]}>
            <span
              className={styles["shop-preview-vbar-fill"]}
              style={{ height: `${Math.round(stats.magnet.fill * 100)}%` }}
            />
          </span>
        </div>
        <div className={styles["shop-preview-vbar"]} aria-label="Damage">
          <span
            className={clsx(
              styles["shop-preview-vbar-icon"],
              styles["is-damage"],
            )}
          />
          <span
            className={clsx(
              styles["shop-preview-vbar-rail"],
              styles["is-damage"],
            )}
          >
            <span
              className={clsx(
                styles["shop-preview-vbar-fill"],
                styles["is-one"],
              )}
              style={{ height: `${Math.round(stats.damage.tierOne * 100)}%` }}
            />
            <span
              className={clsx(
                styles["shop-preview-vbar-fill"],
                styles["is-two"],
              )}
              style={{ height: `${Math.round(stats.damage.tierTwo * 100)}%` }}
            />
            <span
              className={clsx(
                styles["shop-preview-vbar-fill"],
                styles["is-three"],
              )}
              style={{ height: `${Math.round(stats.damage.tierThree * 100)}%` }}
            />
          </span>
        </div>
      </div>
    );
  }

  private handleMarketTileClick(item: ShopCarouselItem): void {
    const selected =
      this.previewSelection?.id === item.id &&
      this.previewSelection?.kind === item.kind;
    if (!selected) {
      this.previewSelection = { id: item.id, kind: item.kind };
      this.refreshOverlay();
      return;
    }
    if (item.owned) {
      this.equipPreviewItem(item);
      return;
    }
    this.buyPreviewItem(item);
  }

  private buildPreviewAction(item: ShopCarouselItem): preact.ComponentChild {
    const affordable =
      getResourceAmount(this.save, item.costResource) >= Math.max(0, item.cost);
    if (!item.owned) {
      const disabled = !item.purchasable || !affordable;
      return (
        <button
          className={styles["shop-preview-buy"]}
          disabled={disabled}
          onClick={() => this.buyPreviewItem(item)}
          type="button"
        >
          Buy
        </button>
      );
    }

    const equipLabel = item.kind === "ship" ? "Select Ship" : "Equip";
    return (
      <button
        className={styles["shop-preview-equip"]}
        disabled={item.equipped}
        onClick={() => this.equipPreviewItem(item)}
        type="button"
      >
        {item.equipped ? "Equipped" : equipLabel}
      </button>
    );
  }

  private buyPreviewItem(item: ShopCarouselItem): void {
    if (item.owned || !item.purchasable) return;
    if (item.kind === "ship") {
      this.updateSave((data) =>
        selectOrPurchaseShipInSave(
          data,
          item.id,
          this.isShipAllowedForPurchase(item.id),
        ),
      );
      this.loadoutSelection = null;
      this.previewSelection = { id: item.id, kind: "ship" };
      this.refreshOverlay();
      return;
    }
    if (item.kind === "weapon") {
      const weapon = WEAPONS[item.id];
      if (!weapon || !this.isWeaponAllowed(weapon)) return;
      this.updateSave((data) => purchaseWeaponInSave(data, weapon.id));
      this.previewSelection = { id: item.id, kind: "weapon" };
      this.refreshOverlay();
      return;
    }
    const mod = MODS[item.id];
    if (!mod || !this.isModAllowed(mod)) return;
    this.updateSave((data) => purchaseModInSave(data, mod.id));
    this.previewSelection = { id: item.id, kind: "mod" };
    this.refreshOverlay();
  }

  private equipPreviewItem(item: ShopCarouselItem): void {
    if (!item.owned) return;
    if (item.kind === "ship") {
      this.updateSave((data) =>
        selectOrPurchaseShipInSave(data, item.id, false),
      );
      this.loadoutSelection = null;
      this.refreshOverlay();
      return;
    }

    const ship = this.getSelectedShip();
    const assignments = this.getAssignmentsForShip(ship);
    if (item.kind === "weapon") {
      const instance = this.save.ownedWeapons.find(
        (entry) => entry.weaponId === item.id,
      );
      const weapon = WEAPONS[item.id];
      if (!instance || !weapon) return;
      const target = ship.mounts.find((mount) => {
        const assignment = assignments.find(
          (entry) => entry.mountId === mount.id,
        );
        return Boolean(
          assignment &&
          canMountWeapon(weapon, mount) &&
          (!assignment.weaponInstanceId ||
            assignment.weaponInstanceId === instance.id),
        );
      });
      const fallback = ship.mounts.find((mount) =>
        canMountWeapon(weapon, mount),
      );
      const mountId = target?.id ?? fallback?.id;
      if (!mountId) return;
      this.assignWeaponToMount(
        { instanceId: instance.id, kind: "weapon" },
        mountId,
      );
      return;
    }

    const instance = this.save.ownedMods.find(
      (entry) => entry.modId === item.id,
    );
    if (!instance) return;
    for (const assignment of assignments) {
      if (!assignment.weaponInstanceId) continue;
      this.assignModToMount(
        { instanceId: instance.id, kind: "mod" },
        assignment.mountId,
      );
      return;
    }
  }

  private isWeaponEquipped(weaponId: string): boolean {
    const ship = this.getSelectedShip();
    const assignments = this.getAssignmentsForShip(ship);
    return assignments.some((assignment) => {
      if (!assignment.weaponInstanceId) return false;
      const instance = this.save.ownedWeapons.find(
        (entry) => entry.id === assignment.weaponInstanceId,
      );
      return instance?.weaponId === weaponId;
    });
  }

  private isModEquipped(modId: string): boolean {
    const ship = this.getSelectedShip();
    const assignments = this.getAssignmentsForShip(ship);
    return assignments.some((assignment) =>
      assignment.modInstanceIds.some((instanceId) => {
        const instance = this.save.ownedMods.find(
          (entry) => entry.id === instanceId,
        );
        return instance?.modId === modId;
      }),
    );
  }

  private getPreviewStats(): ShopStatsView {
    const { mountedWeapons, ship } = this.resolvePreviewLoadout();
    const allShips = Object.values(SHIPS);
    const hpValues = allShips.map((entry) => entry.maxHp);
    const thrustValues = allShips.map((entry) => entry.moveSpeed);
    const magnetValues = allShips.map((entry) => entry.magnetMultiplier ?? 1);
    const dps = mountedWeapons.reduce((sum, entry) => {
      const fireRate = Math.max(0.05, entry.stats.fireRate);
      const shots = Math.max(1, entry.stats.shots?.length ?? 1);
      const damage = Math.max(0, entry.stats.bullet.damage);
      return sum + fireRate * shots * damage;
    }, 0);

    const normalize = (value: number, min: number, max: number): number => {
      if (max <= min) return 1;
      return Math.max(0, Math.min(1, (value - min) / (max - min)));
    };

    return {
      damage: {
        tierOne: Math.max(0, Math.min(1, dps / 10)),
        tierThree: Math.max(0, Math.min(1, (dps - 25) / 25)),
        tierTwo: Math.max(0, Math.min(1, (dps - 10) / 15)),
      },
      hull: {
        fill: normalize(
          ship.maxHp,
          Math.min(...hpValues),
          Math.max(...hpValues),
        ),
      },
      magnet: {
        fill: normalize(
          ship.magnetMultiplier ?? 1,
          Math.min(...magnetValues),
          Math.max(...magnetValues),
        ),
      },
      thrust: {
        fill: normalize(
          ship.moveSpeed,
          Math.min(...thrustValues),
          Math.max(...thrustValues),
        ),
      },
    };
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

  private buildLoadoutView() {
    const ship = this.getSelectedShip();
    const assignments = this.getAssignmentsForShip(ship);
    const selection = this.resolveLoadoutSelection(ship, assignments);
    this.loadoutSelection = selection;
    const choices = this.buildLoadoutCarouselItems(
      ship,
      assignments,
      selection,
    );
    this.ensureLoadoutChoice(choices);
    const clearAction = this.buildLoadoutClearAction(
      ship,
      assignments,
      selection,
    );
    const equipAction = this.buildLoadoutEquipAction(choices);

    return (
      <div className={styles["shop-loadout"]}>
        <div
          className={clsx(
            styles["shop-carousel"],
            styles["shop-carousel--loadout"],
          )}
        >
          {choices.length === 0 ? (
            <div className={styles["shop-empty"]}>
              Select a mount or mod node.
            </div>
          ) : (
            choices.map((choice) => {
              const selected =
                this.loadoutPreviewChoice?.instanceId === choice.instanceId;
              const className = clsx(
                styles["shop-carousel-item"],
                selected ? styles["is-selected"] : undefined,
                choice.isCurrent ? styles["is-equipped"] : undefined,
                choice.kind === "mod" ? styles["is-mod"] : styles["is-weapon"],
              );
              return (
                <button
                  className={className}
                  key={`${choice.kind}-${choice.instanceId}`}
                  onClick={() =>
                    this.handleLoadoutChoiceClick(choice, selection)
                  }
                  style={
                    {
                      "--accent": formatColor(choice.accentColor),
                    } as Record<string, string>
                  }
                  type="button"
                >
                  <span className={styles["shop-carousel-item-icon"]}>
                    {this.buildNodeIcon(
                      choice.kind === "weapon" ? "gun" : "mod",
                      {
                        accentColor: choice.accentColor,
                        className: styles["shop-carousel-icon-canvas"],
                        gunId: choice.gunId,
                        modVector: choice.modVector,
                        shipShape: ship.vector,
                        size: 52,
                        weaponSize: choice.weaponSize,
                      },
                    )}
                  </span>
                  <span className={styles["shop-carousel-item-name"]}>
                    {choice.name}
                  </span>
                  <span className={styles["shop-carousel-item-cost"]}>
                    {choice.meta}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div
          className={clsx(
            styles["shop-preview-stage"],
            styles["shop-preview-stage--loadout"],
          )}
        >
          {this.buildLoadoutNodeGraph(ship, assignments)}
          {clearAction ? (
            <div
              className={clsx(
                styles["shop-preview-corner"],
                styles["shop-preview-corner--top-left"],
              )}
            >
              {clearAction}
            </div>
          ) : null}
          {equipAction ? (
            <div
              className={clsx(
                styles["shop-preview-corner"],
                styles["shop-preview-corner--top-right"],
              )}
            >
              {equipAction}
            </div>
          ) : null}
          {this.renderPreviewStatBars(this.getPreviewStats())}
          <div
            className={clsx(
              styles["shop-preview-corner"],
              styles["shop-preview-corner--bottom-left"],
            )}
          >
            <div className={styles["shop-preview-description"]}>
              Drag directly on the graph or tap a tile once to preview and twice
              to equip.
            </div>
          </div>
        </div>
      </div>
    );
  }

  private buildLoadoutCarouselItems(
    ship: ShipDefinition,
    assignments: MountAssignment[],
    selection: LoadoutNodeSelection | null,
  ): LoadoutCarouselItem[] {
    if (!selection) return [];
    const assignment = assignments.find(
      (entry) => entry.mountId === selection.mountId,
    );
    const mount = ship.mounts.find((entry) => entry.id === selection.mountId);
    if (!assignment || !mount) return [];
    if (selection.kind === "mount") {
      return this.save.ownedWeapons
        .filter((instance) => {
          const weapon = WEAPONS[instance.weaponId];
          return Boolean(weapon && canMountWeapon(weapon, mount));
        })
        .flatMap((instance) => {
          const weapon = WEAPONS[instance.weaponId];
          if (!weapon) return [];
          return [
            {
              accentColor: weapon.stats.bullet.color ?? 0x7df9ff,
              gunId: weapon.gunId,
              id: weapon.id,
              instanceId: instance.id,
              isCurrent: assignment.weaponInstanceId === instance.id,
              kind: "weapon",
              meta: this.describeWeaponNodeMeta(weapon, assignment),
              name: weapon.name,
              weaponSize: weapon.size,
            } satisfies LoadoutCarouselItem,
          ];
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    if (!assignment.weaponInstanceId) return [];
    const currentModId = assignment.modInstanceIds[selection.slotIndex] ?? null;
    const reservedKinds = new Set(
      assignment.modInstanceIds
        .filter((_instanceId, index) => index !== selection.slotIndex)
        .map((instanceId) =>
          this.save.ownedMods.find((entry) => entry.id === instanceId),
        )
        .map((instance) => (instance ? MODS[instance.modId] : null))
        .filter((mod): mod is ModDefinition => Boolean(mod))
        .map((mod) => mod.iconKind),
    );
    return this.save.ownedMods
      .filter((instance) => {
        if (instance.id === currentModId) return true;
        const mod = MODS[instance.modId];
        if (!mod) return false;
        return !reservedKinds.has(mod.iconKind);
      })
      .flatMap((instance) => {
        const mod = MODS[instance.modId];
        if (!mod) return [];
        return [
          {
            accentColor: this.getModAccentColor(mod.iconKind),
            id: mod.id,
            instanceId: instance.id,
            isCurrent: currentModId === instance.id,
            kind: "mod",
            meta: this.describeModEffects(mod),
            modVector: mod.icon,
            name: mod.name,
          } satisfies LoadoutCarouselItem,
        ];
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private ensureLoadoutChoice(choices: LoadoutCarouselItem[]): void {
    if (
      this.loadoutPreviewChoice &&
      choices.some(
        (choice) =>
          choice.instanceId === this.loadoutPreviewChoice?.instanceId &&
          choice.kind === this.loadoutPreviewChoice?.kind,
      )
    ) {
      return;
    }
    this.loadoutPreviewChoice = null;
  }

  private handleLoadoutChoiceClick(
    choice: LoadoutCarouselItem,
    selection: LoadoutNodeSelection | null,
  ): void {
    if (!selection) return;
    const selected =
      this.loadoutPreviewChoice?.instanceId === choice.instanceId;
    if (!selected) {
      this.loadoutPreviewChoice = {
        instanceId: choice.instanceId,
        kind: choice.kind,
      };
      this.refreshOverlay();
      return;
    }
    if (selection.kind === "mount") {
      this.loadoutSelection = { kind: "mount", mountId: selection.mountId };
      this.assignWeaponToMount(
        { instanceId: choice.instanceId, kind: "weapon" },
        selection.mountId,
      );
      this.loadoutPreviewChoice = null;
      return;
    }
    this.loadoutSelection = {
      kind: "mod",
      mountId: selection.mountId,
      slotIndex: selection.slotIndex,
    };
    this.assignModToSlot(
      selection.mountId,
      selection.slotIndex,
      choice.instanceId,
    );
    this.loadoutPreviewChoice = null;
  }

  private buildLoadoutEquipAction(
    choices: LoadoutCarouselItem[],
  ): preact.ComponentChild {
    if (!this.loadoutPreviewChoice) return null;
    const choice = choices.find(
      (entry) => entry.instanceId === this.loadoutPreviewChoice?.instanceId,
    );
    if (!choice) return null;
    return (
      <button
        className={styles["shop-preview-equip"]}
        disabled={choice.isCurrent}
        onClick={() => this.handleLoadoutCornerEquip()}
        type="button"
      >
        {choice.isCurrent ? "Equipped" : "Equip"}
      </button>
    );
  }

  private handleLoadoutCornerEquip(): void {
    const selection = this.loadoutSelection;
    const choice = this.loadoutPreviewChoice;
    if (!selection || !choice) return;
    if (selection.kind === "mount") {
      this.loadoutSelection = { kind: "mount", mountId: selection.mountId };
      this.assignWeaponToMount(
        { instanceId: choice.instanceId, kind: "weapon" },
        selection.mountId,
      );
      this.loadoutPreviewChoice = null;
      return;
    }
    this.loadoutSelection = {
      kind: "mod",
      mountId: selection.mountId,
      slotIndex: selection.slotIndex,
    };
    this.assignModToSlot(
      selection.mountId,
      selection.slotIndex,
      choice.instanceId,
    );
    this.loadoutPreviewChoice = null;
  }

  private buildLoadoutClearAction(
    ship: ShipDefinition,
    assignments: MountAssignment[],
    selection: LoadoutNodeSelection | null,
  ): preact.ComponentChild {
    if (!selection) return null;
    const assignment = assignments.find(
      (entry) => entry.mountId === selection.mountId,
    );
    const mount = ship.mounts.find((entry) => entry.id === selection.mountId);
    if (!assignment || !mount) return null;
    if (selection.kind === "mount") {
      if (!assignment.weaponInstanceId) return null;
      return (
        <button
          className={styles["shop-preview-clear"]}
          onClick={() => {
            this.loadoutSelection = { kind: "mount", mountId: mount.id };
            this.detachWeaponFromMount(mount.id);
          }}
          type="button"
        >
          Unequip
        </button>
      );
    }
    const modInstanceId = assignment.modInstanceIds[selection.slotIndex];
    if (!modInstanceId) return null;
    return (
      <button
        className={styles["shop-preview-clear"]}
        onClick={() => {
          this.loadoutSelection = {
            kind: "mod",
            mountId: mount.id,
            slotIndex: selection.slotIndex,
          };
          this.clearModSlot(mount.id, selection.slotIndex);
        }}
        type="button"
      >
        Unequip
      </button>
    );
  }

  private resolveLoadoutSelection(
    ship: ShipDefinition,
    assignments: MountAssignment[],
  ): LoadoutNodeSelection | null {
    if (ship.mounts.length === 0) return null;
    const selection = this.loadoutSelection;
    if (!selection) {
      return { kind: "mount", mountId: ship.mounts[0].id };
    }
    const mount = ship.mounts.find((entry) => entry.id === selection.mountId);
    if (!mount) {
      return { kind: "mount", mountId: ship.mounts[0].id };
    }
    if (selection.kind === "mount") {
      return selection;
    }
    const assignment = assignments.find(
      (entry) => entry.mountId === selection.mountId,
    );
    if (!assignment?.weaponInstanceId) {
      return { kind: "mount", mountId: selection.mountId };
    }
    const slotIndex = Math.max(
      0,
      Math.min(selection.slotIndex, Math.max(0, mount.modSlots - 1)),
    );
    return {
      kind: "mod",
      mountId: selection.mountId,
      slotIndex,
    };
  }

  private buildLoadoutNodeGraph(
    ship: ShipDefinition,
    assignments: MountAssignment[],
  ) {
    const visibleMounts = getVisibleMounts(ship);
    const assignmentById = new Map(
      assignments.map((entry) => [entry.mountId, entry]),
    );
    const layout = createNodeGraphLayout(ship, assignments);

    const links: preact.ComponentChildren[] = [];
    const nodes: ReturnType<typeof this.buildNodeIcon>[] = [];
    nodes.push(
      <div
        className={clsx(styles["shop-node"], styles["shop-node--hull"])}
        key="node-hull"
        style={{
          left: `${layout.shipPoint.x}px`,
          top: `${layout.shipPoint.y}px`,
        }}
      >
        {this.buildNodeIcon("ship", {
          accentColor: ship.color,
          className: clsx(
            styles["shop-node-icon"],
            styles["shop-node-icon--hull"],
          ),
          shipShape: ship.vector,
          size: 140,
        })}
      </div>,
    );

    for (const mount of visibleMounts) {
      const mountPos = layout.mountPoints.get(mount.id);
      if (!mountPos) continue;
      const assignment = assignmentById.get(mount.id);
      const instance = assignment?.weaponInstanceId
        ? this.save.ownedWeapons.find(
            (entry) => entry.id === assignment.weaponInstanceId,
          )
        : null;
      const weapon = instance ? WEAPONS[instance.weaponId] : null;
      const selected =
        this.loadoutSelection?.kind === "mount" &&
        this.loadoutSelection.mountId === mount.id;
      const mountSurge = this.activeEnergySurge?.mountId === mount.id;

      links.push(
        <NodeLink
          id={`link-hull-${mount.id}`}
          from={layout.shipPoint}
          to={mountPos}
          active={Boolean(weapon)}
          selected={selected}
          surge={mountSurge}
        />,
      );

      const mountClass = clsx(
        styles["shop-node"],
        styles["shop-node--weapon"],
        weapon ? undefined : styles["is-empty"],
        selected ? styles["is-selected"] : undefined,
        mountSurge ? styles["is-surge"] : undefined,
      );

      nodes.push(
        <button
          className={mountClass}
          data-drop="mount"
          data-mount-id={mount.id}
          data-type="mount"
          key={`node-mount-${mount.id}`}
          onClick={() => {
            this.loadoutSelection = { kind: "mount", mountId: mount.id };
            this.refreshOverlay();
          }}
          onMouseEnter={() => {
            this.dragHoverMountId = mount.id;
            this.updateMountVisualHighlights();
          }}
          onMouseLeave={() => {
            if (this.dragHoverMountId === mount.id) {
              this.dragHoverMountId = null;
              this.updateMountVisualHighlights();
            }
          }}
          ref={(element) => {
            if (element) {
              this.mountDots.set(mount.id, element);
            } else {
              this.mountDots.delete(mount.id);
            }
          }}
          style={{ left: `${mountPos.x}px`, top: `${mountPos.y}px` }}
          type="button"
        >
          {this.buildNodeIcon("gun", {
            accentColor: weapon?.stats.bullet.color ?? 0x7df9ff,
            gunId: weapon?.gunId,
            weaponSize: weapon?.size,
          })}
          <div className={styles["shop-node-name"]}>
            {weapon?.name ?? "EMPTY"}
          </div>
        </button>,
      );

      const modSlotCount = Math.min(mount.modSlots, MAX_RENDERED_MOD_SLOTS);
      if (!weapon || modSlotCount <= 0) continue;

      for (let slotIndex = 0; slotIndex < modSlotCount; slotIndex += 1) {
        const modPos = layout.modPoints.get(mount.id)?.[slotIndex];
        if (!modPos) continue;
        const modInstanceId = assignment?.modInstanceIds[slotIndex] ?? null;
        const modInstance = modInstanceId
          ? this.save.ownedMods.find((entry) => entry.id === modInstanceId)
          : null;
        const mod = modInstance ? MODS[modInstance.modId] : null;
        const modSelected =
          this.loadoutSelection?.kind === "mod" &&
          this.loadoutSelection.mountId === mount.id &&
          this.loadoutSelection.slotIndex === slotIndex;
        const modSurge =
          this.activeEnergySurge?.mountId === mount.id &&
          this.activeEnergySurge.slotIndex === slotIndex;

        links.push(
          <NodeLink
            id={`link-mod-${mount.id}-${slotIndex}`}
            from={modPos}
            to={mountPos}
            active={Boolean(mod)}
            selected={modSelected}
            surge={modSurge}
          />,
        );

        const modClass = clsx(
          styles["shop-node"],
          styles["shop-node--mod"],
          mod ? undefined : styles["is-empty"],
          modSelected ? styles["is-selected"] : undefined,
          modSurge ? styles["is-surge"] : undefined,
        );

        nodes.push(
          <button
            className={modClass}
            data-mount-id={mount.id}
            data-slot-index={slotIndex}
            key={`node-mod-${mount.id}-${slotIndex}`}
            onClick={() => {
              this.loadoutSelection = {
                kind: "mod",
                mountId: mount.id,
                slotIndex,
              };
              this.refreshOverlay();
            }}
            style={{ left: `${modPos.x}px`, top: `${modPos.y}px` }}
            type="button"
          >
            {this.buildNodeIcon("mod", {
              accentColor: mod
                ? this.getModAccentColor(mod.iconKind)
                : 0x6a7a90,
              modVector: mod?.icon,
            })}
            <div className={styles["shop-node-name"]}>
              {mod?.name ?? "Select"}
            </div>
          </button>,
        );
      }
    }

    return (
      <NodeGraphContainer
        worldStyle={{ height: layout.worldHeight, width: layout.worldWidth }}
        onMountVisualRef={(el) => {
          this.mountVisual = el ?? undefined;
        }}
        onViewportRef={(el) => {
          this.nodeGraphViewport = el ?? undefined;
        }}
        onWorldRef={(el) => {
          this.nodeGraphWorld = el ?? undefined;
        }}
        onWheel={(e) => this.handleNodeGraphWheel(e)}
        onPointerCancel={(e) => this.stopNodeGraphDrag(e)}
        onPointerDown={(e) => this.startNodeGraphDrag(e)}
        onPointerMove={(e) => this.updateNodeGraphDrag(e)}
        onPointerUp={(e) => this.stopNodeGraphDrag(e)}
      >
        {links}
        {nodes}
      </NodeGraphContainer>
    );
  }

  private buildNodeIcon(kind: CardIconKind, options: BuildNodeIconOptions) {
    const size = Math.max(24, Math.round(options.size ?? 100));
    return (
      <ShopNodeIcon
        className={options.className ?? styles["shop-node-icon"]}
        size={size}
        onDraw={(canvas) =>
          drawShopIcon({
            canvas,
            colorHex: formatColor(options.accentColor),
            colorValue: options.accentColor,
            gunId: options.gunId,
            kind,
            modVector: options.modVector,
            shipShape: options.shipShape ?? this.getSelectedShip().vector,
            weaponSize: options.weaponSize,
          })
        }
      />
    );
  }

  private clampNodeGraphScale(value: number): number {
    return Math.max(0.5, Math.min(1, value));
  }

  private getNodeGraphBounds(scale: number): {
    viewportHeight: number;
    viewportWidth: number;
    worldHeight: number;
    worldWidth: number;
  } | null {
    if (!this.nodeGraphViewport || !this.nodeGraphWorld) return null;
    return {
      viewportHeight: this.nodeGraphViewport.clientHeight,
      viewportWidth: this.nodeGraphViewport.clientWidth,
      worldHeight: this.nodeGraphWorld.offsetHeight * scale,
      worldWidth: this.nodeGraphWorld.offsetWidth * scale,
    };
  }

  private clampNodeGraphOffset(
    x: number,
    y: number,
    scale = this.nodeGraphScale,
  ): { x: number; y: number } {
    const bounds = this.getNodeGraphBounds(scale);
    if (!bounds) return { x, y };
    const centerX = (bounds.viewportWidth - bounds.worldWidth) * 0.5;
    const centerY = (bounds.viewportHeight - bounds.worldHeight) * 0.5;
    if (bounds.worldWidth <= bounds.viewportWidth) {
      x = centerX;
    } else {
      x = Math.min(0, Math.max(bounds.viewportWidth - bounds.worldWidth, x));
    }
    if (bounds.worldHeight <= bounds.viewportHeight) {
      y = centerY;
    } else {
      y = Math.min(0, Math.max(bounds.viewportHeight - bounds.worldHeight, y));
    }
    return { x, y };
  }

  private getNodeGraphCenteredOffset(scale = this.nodeGraphScale): {
    x: number;
    y: number;
  } {
    const bounds = this.getNodeGraphBounds(scale);
    if (!bounds) return { x: 0, y: 0 };
    return {
      x: (bounds.viewportWidth - bounds.worldWidth) * 0.5,
      y: (bounds.viewportHeight - bounds.worldHeight) * 0.5,
    };
  }

  private applyNodeGraphTransform(): void {
    if (!this.nodeGraphWorld) return;
    const { x, y } = this.nodeGraphOffset;
    this.nodeGraphWorld.style.transform = `translate(${x}px, ${y}px) scale(${this.nodeGraphScale})`;
  }

  private syncNodeGraphTransform(): void {
    if (!this.nodeGraphViewport || !this.nodeGraphWorld) return;
    if (!this.nodeGraphTransformReady) {
      this.nodeGraphScale = 1;
      const centered = this.getNodeGraphCenteredOffset(1);
      this.nodeGraphOffset = this.clampNodeGraphOffset(
        centered.x,
        centered.y,
        1,
      );
      this.nodeGraphTransformReady = true;
    } else {
      this.nodeGraphOffset = this.clampNodeGraphOffset(
        this.nodeGraphOffset.x,
        this.nodeGraphOffset.y,
      );
    }
    this.applyNodeGraphTransform();
  }

  private setNodeGraphScale(nextScale: number, anchor?: NodeGraphPoint): void {
    const clampedScale = this.clampNodeGraphScale(nextScale);
    if (clampedScale === this.nodeGraphScale) return;
    let nextX = this.nodeGraphOffset.x;
    let nextY = this.nodeGraphOffset.y;
    if (anchor) {
      const ratio = clampedScale / this.nodeGraphScale;
      nextX = anchor.x - (anchor.x - nextX) * ratio;
      nextY = anchor.y - (anchor.y - nextY) * ratio;
    }
    this.nodeGraphScale = clampedScale;
    this.nodeGraphOffset = this.clampNodeGraphOffset(
      nextX,
      nextY,
      clampedScale,
    );
    this.applyNodeGraphTransform();
  }

  private adjustNodeGraphZoom(delta: number, anchor?: NodeGraphPoint): void {
    this.setNodeGraphScale(this.nodeGraphScale + delta, anchor);
  }

  private setNodeGraphPointer(event: PointerEvent): void {
    this.nodeGraphPointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
  }

  private clearNodeGraphPointer(pointerId: number): void {
    this.nodeGraphPointers.delete(pointerId);
    if (this.nodeGraphPointers.size < 2) {
      this.nodeGraphPinchStart = null;
    }
  }

  private getNodeGraphPinchMetrics(): {
    center: NodeGraphPoint;
    distance: number;
  } | null {
    if (this.nodeGraphPointers.size < 2) return null;
    const [a, b] = Array.from(this.nodeGraphPointers.values());
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    return {
      center: {
        x: (a.x + b.x) * 0.5,
        y: (a.y + b.y) * 0.5,
      },
      distance,
    };
  }

  private handleNodeGraphWheel(event: WheelEvent): void {
    if (!this.nodeGraphViewport) return;
    event.preventDefault();
    const rect = this.nodeGraphViewport.getBoundingClientRect();
    const anchor = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const delta = Math.max(-0.075, Math.min(0.075, -event.deltaY * 0.0015));
    if (delta === 0) return;
    this.adjustNodeGraphZoom(delta, anchor);
  }

  private startNodeGraphDrag(event: PointerEvent): void {
    if (!this.nodeGraphViewport) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest(`.${styles["shop-node"]}`)) return;
    this.setNodeGraphPointer(event);
    this.nodeGraphViewport.setPointerCapture(event.pointerId);
    const pinch = this.getNodeGraphPinchMetrics();
    if (pinch) {
      this.nodeGraphDrag = null;
      this.nodeGraphPinchStart = {
        distance: Math.max(1, pinch.distance),
        scale: this.nodeGraphScale,
      };
      return;
    }
    this.nodeGraphDrag = {
      pointerId: event.pointerId,
      startX: event.clientX - this.nodeGraphOffset.x,
      startY: event.clientY - this.nodeGraphOffset.y,
    };
  }

  private updateNodeGraphDrag(event: PointerEvent): void {
    if (!this.nodeGraphViewport) return;
    if (!this.nodeGraphPointers.has(event.pointerId)) return;
    this.setNodeGraphPointer(event);
    const pinch = this.getNodeGraphPinchMetrics();
    if (pinch) {
      this.nodeGraphPinchStart ??= {
        distance: Math.max(1, pinch.distance),
        scale: this.nodeGraphScale,
      };
      const rect = this.nodeGraphViewport.getBoundingClientRect();
      const anchor = {
        x: pinch.center.x - rect.left,
        y: pinch.center.y - rect.top,
      };
      const pinchRatio = pinch.distance / this.nodeGraphPinchStart.distance;
      const dampedRatio = 1 + (pinchRatio - 1) * 0.75;
      this.setNodeGraphScale(
        this.nodeGraphPinchStart.scale * dampedRatio,
        anchor,
      );
      return;
    }
    if (!this.nodeGraphDrag) return;
    if (event.pointerId !== this.nodeGraphDrag.pointerId) return;
    this.nodeGraphOffset = this.clampNodeGraphOffset(
      event.clientX - this.nodeGraphDrag.startX,
      event.clientY - this.nodeGraphDrag.startY,
    );
    this.applyNodeGraphTransform();
  }

  private stopNodeGraphDrag(event: PointerEvent): void {
    if (!this.nodeGraphViewport) return;
    if (this.nodeGraphViewport.hasPointerCapture(event.pointerId)) {
      this.nodeGraphViewport.releasePointerCapture(event.pointerId);
    }
    this.clearNodeGraphPointer(event.pointerId);
    if (this.nodeGraphDrag?.pointerId === event.pointerId) {
      this.nodeGraphDrag = null;
    }
  }

  private queueEnergySurge(mountId: string, slotIndex?: number): void {
    this.activeEnergySurge = { mountId, slotIndex };
    if (this.energySurgeTimeout !== null) {
      window.clearTimeout(this.energySurgeTimeout);
    }
    this.energySurgeTimeout = window.setTimeout(() => {
      this.activeEnergySurge = null;
      this.energySurgeTimeout = null;
      if (this.currentCategory === "loadout") {
        this.refreshOverlay();
      }
    }, 420);
  }

  private describeWeaponNodeMeta(
    weapon: WeaponDefinition,
    assignment: MountAssignment | undefined,
  ): string {
    const fireRate = Math.max(0.05, weapon.stats.fireRate);
    const damage = Math.max(0, weapon.stats.bullet.damage);
    const core = `${fireRate.toFixed(1)}/s · ${damage.toFixed(1)} dmg`;
    const modEffects = (assignment?.modInstanceIds ?? [])
      .map((instanceId) =>
        this.save.ownedMods.find((entry) => entry.id === instanceId),
      )
      .map((instance) => (instance ? MODS[instance.modId] : null))
      .filter((mod): mod is ModDefinition => Boolean(mod))
      .map((mod) => this.describeModEffects(mod))
      .filter(Boolean);
    const overlay = modEffects[0];
    return overlay ? `${core} | ${overlay}` : core;
  }

  private describeModEffects(mod: ModDefinition): string {
    const pieces: string[] = [];
    if (mod.effects.multi) {
      const extra = Math.max(0, mod.effects.multi.count - 1);
      const damageDelta = Math.round(
        (mod.effects.multi.projectileDamageMultiplier - 1) * 100,
      );
      const damageLabel =
        damageDelta >= 0 ? `+${damageDelta}% dmg` : `${damageDelta}% dmg`;
      pieces.push(`+${extra} proj`, damageLabel);
    }
    if (mod.effects.damageMultiplier) {
      const delta = Math.round((mod.effects.damageMultiplier - 1) * 100);
      const label = delta >= 0 ? `+${delta}% dmg` : `${delta}% dmg`;
      pieces.push(label);
    }
    if (mod.effects.homing) pieces.push("+homing");
    if (mod.effects.aoe) pieces.push("+aoe");
    if (mod.effects.bounce) pieces.push("+ricochet");
    return pieces.slice(0, 2).join(" | ") || "No stat shift";
  }

  private updateMountVisualHighlights(): void {
    if (this.mountDots.size === 0) return;
    const ship = this.getSelectedShip();
    const assignments = this.getAssignmentsForShip(ship);
    const payload = this.dragPayload;
    if (this.mountVisual) {
      this.mountVisual.classList.toggle(
        styles["is-dragging"],
        Boolean(payload),
      );
    }
    const eligibleMounts = getEligibleMountIdsForDrag(
      this.save,
      ship,
      assignments,
      payload,
    );
    for (const [mountId, dot] of this.mountDots.entries()) {
      const eligible = eligibleMounts.has(mountId);
      dot.classList.toggle(styles["is-eligible"], eligible);
      const isDrop = eligible && this.dragHoverMountId === mountId;
      dot.classList.toggle(styles["is-drop"], isDrop);
    }
  }

  private detachWeaponFromMount(mountId: string): void {
    this.updateSave((data) => detachWeaponFromMountInSave(data, mountId), {
      allowEmptyLoadout: true,
    });
    this.refreshOverlay();
  }

  private assignWeaponToMount(payload: DragPayload, mountId: string): void {
    if (payload.kind !== "weapon") return;
    this.updateSave(
      (data) => assignWeaponToMountInSave(data, payload, mountId),
      { allowEmptyLoadout: true },
    );
    this.queueEnergySurge(mountId);
    this.refreshOverlay();
  }

  private detachModFromMount(
    mountId: string,
    modInstanceId: ModInstanceId,
  ): void {
    this.updateSave(
      (data) => detachModFromMountInSave(data, mountId, modInstanceId),
      { allowEmptyLoadout: true },
    );
    this.refreshOverlay();
  }

  private assignModToMount(payload: DragPayload, mountId: string): void {
    if (payload.kind !== "mod") return;
    let appliedSlotIndex: null | number = null;
    this.updateSave(
      (data) => {
        appliedSlotIndex = assignModToMountInSave(data, payload, mountId);
      },
      { allowEmptyLoadout: true },
    );
    if (appliedSlotIndex !== null) {
      this.queueEnergySurge(mountId, appliedSlotIndex);
    }
    this.refreshOverlay();
  }

  private clearModSlot(mountId: string, slotIndex: number): void {
    this.updateSave((data) => clearModSlotInSave(data, mountId, slotIndex), {
      allowEmptyLoadout: true,
    });
    this.refreshOverlay();
  }

  private assignModToSlot(
    mountId: string,
    slotIndex: number,
    modInstanceId: ModInstanceId,
  ): void {
    this.updateSave(
      (data) => assignModToSlotInSave(data, mountId, slotIndex, modInstanceId),
      { allowEmptyLoadout: true },
    );
    this.queueEnergySurge(mountId, slotIndex);
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
      styles["is-droppable"],
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
    this.clearDragPreview();
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

  private clearDragPreview(): void {
    DragPreview.clearDragPreview();
    this.dragPreviewEl = undefined;
  }

  private mountDragPreview(
    onCanvasReady: (canvas: HTMLCanvasElement) => void,
  ): HTMLDivElement | null {
    const preview = DragPreview.mountDragPreview(onCanvasReady);
    if (preview) this.dragPreviewEl = preview;
    return preview;
  }

  private setDragPreview(event: DragEvent, weapon: WeaponDefinition): void {
    const transfer = event.dataTransfer;
    if (!transfer) return;
    this.clearDragPreview();
    const preview = this.mountDragPreview((canvas) => {
      drawShopIcon({
        canvas,
        colorHex: formatColor(weapon.stats.bullet.color ?? 0x7df9ff),
        colorValue: weapon.stats.bullet.color ?? 0x7df9ff,
        gunId: weapon.gunId,
        kind: "gun",
        shipShape: this.getSelectedShip().vector,
        weaponSize: weapon.size,
      });
    });
    if (!preview) return;
    transfer.setDragImage(preview, 22, 22);
  }

  private setModDragPreview(event: DragEvent, mod: ModDefinition): void {
    const transfer = event.dataTransfer;
    if (!transfer) return;
    this.clearDragPreview();
    const colorValue = this.getModAccentColor(mod.iconKind);
    const preview = this.mountDragPreview((canvas) => {
      drawShopIcon({
        canvas,
        colorHex: formatColor(colorValue),
        colorValue,
        kind: "mod",
        modVector: mod.icon,
        shipShape: this.getSelectedShip().vector,
      });
    });
    if (!preview) return;
    transfer.setDragImage(preview, 22, 22);
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
        height: Math.max(2, cssHeight),
        mode: Phaser.Scale.NONE,
        width: Math.max(2, cssWidth),
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
    this.previewCanvasSize = { height: 0, width: 0 };
  }

  private syncPreviewCanvasSize(): void {
    if (!this.previewRoot) return;
    const cssWidth = Math.max(0, Math.round(this.previewRoot.clientWidth));
    const cssHeight = Math.max(0, Math.round(this.previewRoot.clientHeight));
    if (cssWidth < 2 || cssHeight < 2) return;
    if (
      this.previewCanvasSize.width === cssWidth &&
      this.previewCanvasSize.height === cssHeight
    ) {
      return;
    }
    this.previewCanvasSize = { height: cssHeight, width: cssWidth };
    if (this.previewGame) {
      this.previewGame.scale.resize(cssWidth, cssHeight);
    }
    this.previewScene?.resize(cssWidth, cssHeight);
  }

  private resolvePreviewLoadout(): {
    mountedWeapons: MountedWeapon[];
    ship: ShipDefinition;
  } {
    const selectedShip = this.getSelectedShip();
    if (this.currentCategory === "loadout" || !this.previewSelection) {
      return {
        mountedWeapons: buildMountedWeapons(this.save, selectedShip),
        ship: selectedShip,
      };
    }

    const previewSave = structuredClone(this.save);
    let previewShip = selectedShip;
    if (this.previewSelection.kind === "ship") {
      previewShip = SHIPS[this.previewSelection.id] ?? selectedShip;
      const currentAssignments = this.getAssignmentsForShip(selectedShip);
      const preferredWeaponIds = currentAssignments
        .map((entry) => entry.weaponInstanceId)
        .filter((instanceId): instanceId is WeaponInstanceId =>
          Boolean(instanceId),
        );
      if (buildMountedWeapons(previewSave, previewShip).length === 0) {
        autoAttachWeaponsForShipInSave(
          previewSave,
          previewShip,
          preferredWeaponIds,
        );
      }
    }
    previewSave.selectedShipId = previewShip.id;
    this.ensureMountAssignments(previewSave, previewShip);

    if (this.previewSelection.kind === "weapon") {
      const weapon = WEAPONS[this.previewSelection.id];
      if (weapon) {
        const instance =
          previewSave.ownedWeapons.find(
            (entry) => entry.weaponId === weapon.id,
          ) ?? createWeaponInstanceInSave(previewSave, weapon.id);
        const mount = previewShip.mounts.find((entry) =>
          canMountWeapon(weapon, entry),
        );
        if (mount) {
          assignWeaponToMountInSave(
            previewSave,
            { instanceId: instance.id },
            mount.id,
          );
        }
      }
    }

    if (this.previewSelection.kind === "mod") {
      const mod = MODS[this.previewSelection.id];
      if (mod) {
        const instance =
          previewSave.ownedMods.find((entry) => entry.modId === mod.id) ??
          createModInstanceInSave(previewSave, mod.id);
        const assignments = this.ensureMountAssignments(
          previewSave,
          previewShip,
        );
        if (!assignments.some((entry) => entry.weaponInstanceId)) {
          autoAttachWeaponsForShipInSave(previewSave, previewShip);
        }
        for (const mount of previewShip.mounts) {
          if (mount.modSlots <= 0) continue;
          const applied = assignModToMountInSave(
            previewSave,
            { instanceId: instance.id },
            mount.id,
          );
          if (applied !== null) break;
        }
      }
    }

    return {
      mountedWeapons: buildMountedWeapons(previewSave, previewShip),
      ship: previewShip,
    };
  }

  private applyPreviewLoadout(): void {
    if (!this.previewScene) return;
    const { mountedWeapons, ship } = this.resolvePreviewLoadout();
    this.previewScene.setLoadout(mountedWeapons, ship);
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
}
