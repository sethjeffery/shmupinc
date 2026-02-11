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

import { signal, type Signal } from "@preact/signals";
import Phaser from "phaser";
import { render } from "preact";

import { GUNS } from "../data/guns";
import { getActiveLevelSession } from "../data/levelState";
import { MODS } from "../data/mods";
import {
  addResourceInSave,
  autoAttachWeaponsForShipInSave,
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

interface NodeOptionIcon {
  accentColor: number;
  gunId?: string;
  iconKind: CardIconKind;
  modIcon?: ModIconKind;
  weaponSize?: WeaponSize;
}

const SELL_RATIO = 0.5;
const PRIMARY_RESOURCE_ID = "gold";

const formatCost = (cost: number, resourceId: string): string =>
  resourceId === PRIMARY_RESOURCE_ID ? `${cost}g` : `${cost} ${resourceId}`;

const formatColor = (color: number): string =>
  `#${color.toString(16).padStart(6, "0")}`;

interface ShopStatsView {
  hull: string;
  magnet: string;
  speed: string;
}

interface ShopOverlaySignals {
  catalogNote: Signal<string>;
  catalogTitle: Signal<string>;
  category: Signal<ShopCategory>;
  gold: Signal<string>;
  missionActive: Signal<boolean>;
  missionText: Signal<string>;
  stats: Signal<ShopStatsView>;
}

const tabClass = (
  activeCategory: ShopCategory,
  tabCategory: ShopCategory,
): string => `shop-tab${activeCategory === tabCategory ? " is-active" : ""}`;

const ShopOverlayView = (props: {
  onCatalogGridRef: (element: HTMLDivElement | null) => void;
  onPreviewRootRef: (element: HTMLDivElement | null) => void;
  signals: ShopOverlaySignals;
}) => {
  const category = props.signals.category.value;
  const missionClass = `shop-mission${
    props.signals.missionActive.value ? " is-active" : ""
  }`;
  const deckClass = `shop-deck${
    category === "loadout" ? " is-loadout-focus" : ""
  }`;
  const stats = props.signals.stats.value;

  return (
    <div className="shop-panel">
      <div className="shop-header">
        <div className="shop-header-meta">
          <div className="shop-title">Hangar Exchange</div>
          <div className={missionClass}>{props.signals.missionText.value}</div>
        </div>
        <button
          className="shop-header-start"
          data-action="deploy"
          type="button"
        >
          Start
        </button>
        <div className="shop-gold">{props.signals.gold.value}</div>
      </div>

      <div className={deckClass}>
        <div className="shop-left">
          <div className="shop-preview-card">
            <div className="shop-preview-canvas" ref={props.onPreviewRootRef} />
          </div>

          <div className="shop-stats">
            <div className="shop-stat">
              <strong>Hull</strong>
              <span>{stats.hull}</span>
            </div>
            <div className="shop-stat">
              <strong>Thrust</strong>
              <span>{stats.speed}</span>
            </div>
            <div className="shop-stat">
              <strong>Magnet</strong>
              <span>{stats.magnet}</span>
            </div>
          </div>

          <div className="shop-cta">
            <button className="shop-play" data-action="deploy" type="button">
              <span className="shop-play-icon" />
              <span className="shop-play-label">Start Mission</span>
            </button>
            <div className="shop-cta-meta">
              <span className="shop-cta-gold">{props.signals.gold.value}</span>
              <span className="shop-cta-hint">
                Configure mounts before deploying.
              </span>
            </div>
          </div>
        </div>

        <div className="shop-right">
          <div className="shop-tabs">
            <button
              className={tabClass(category, "ships")}
              data-action="show-ships"
              type="button"
            >
              <span className="shop-tab-icon shop-tab-icon--ship">
                <svg className="shop-tab-icon-svg" viewBox="0 0 24 24">
                  <path d="M12 2 L17.5 8.5 L21 7.8 L21 18.8 L12 17 L3 18.8 L3 7.8 L6.5 8.5 Z" />
                </svg>
              </span>
              <span className="shop-tab-label">Ships</span>
            </button>
            <button
              className={tabClass(category, "armory")}
              data-action="show-armory"
              type="button"
            >
              <span className="shop-tab-icon shop-tab-icon--weapon" />
              <span className="shop-tab-label">Armory</span>
            </button>
            <button
              className={tabClass(category, "loadout")}
              data-action="show-loadout"
              type="button"
            >
              <span className="shop-tab-icon shop-tab-icon--mount" />
              <span className="shop-tab-label">Loadout</span>
            </button>
          </div>

          <div className="shop-content">
            <div className="shop-content-header">
              <div className="shop-section-title">
                {props.signals.catalogTitle.value}
              </div>
              <div className="shop-content-note">
                {props.signals.catalogNote.value}
              </div>
            </div>
            <div className="shop-grid" ref={props.onCatalogGridRef} />
          </div>
        </div>
      </div>
    </div>
  );
};

export class ShopScene extends Phaser.Scene {
  private save!: SaveData;
  private overlay?: HTMLDivElement;
  private catalogGrid?: HTMLDivElement;
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
  private currentCategory: ShopCategory = "loadout";
  private readonly categorySignal = signal<ShopCategory>("loadout");
  private readonly catalogNoteSignal = signal(
    "Equip anything you own at no cost.",
  );
  private readonly catalogTitleSignal = signal("Loadout");
  private readonly goldSignal = signal("Gold: 0");
  private readonly missionActiveSignal = signal(false);
  private readonly missionTextSignal = signal("");
  private readonly statsSignal = signal<ShopStatsView>({
    hull: "--",
    magnet: "--",
    speed: "--",
  });
  private shopRules: null | ShopRules = null;
  private dragPayload: DragPayload | null = null;
  private loadoutSelection: LoadoutNodeSelection | null = null;
  private activeEnergySurge: { mountId: string; slotIndex?: number } | null =
    null;
  private energySurgeTimeout: null | number = null;
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
    const overlayHost = document.getElementById("shop-overlay-root");
    if (!(overlayHost instanceof HTMLDivElement)) {
      throw new Error("Missing #shop-overlay-root host.");
    }
    this.overlay = overlayHost;
    this.overlay.className = "shop-overlay";
    this.renderOverlay(this.overlay);
    document.body.classList.add("shop-open");
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
    render(null, this.overlay);
    this.overlay.className = "";
    this.overlay = undefined;
    this.catalogGrid = undefined;
    this.previewRoot = undefined;
    this.shopRules = null;
    this.mountVisual = undefined;
    this.mountDots.clear();
    this.mountCallouts.clear();
    this.mountCalloutLines.clear();
    this.dragHoverMountId = null;
    this.clearDragPreview();
    if (this.energySurgeTimeout !== null) {
      window.clearTimeout(this.energySurgeTimeout);
      this.energySurgeTimeout = null;
    }
    this.activeEnergySurge = null;
    document.body.classList.remove("shop-open");
  }

  private renderOverlay(overlay: HTMLDivElement): void {
    render(
      <ShopOverlayView
        onCatalogGridRef={(element) => {
          this.catalogGrid = element ?? undefined;
        }}
        onPreviewRootRef={(element) => {
          this.previewRoot = element ?? undefined;
        }}
        signals={{
          catalogNote: this.catalogNoteSignal,
          catalogTitle: this.catalogTitleSignal,
          category: this.categorySignal,
          gold: this.goldSignal,
          missionActive: this.missionActiveSignal,
          missionText: this.missionTextSignal,
          stats: this.statsSignal,
        }}
      />,
      overlay,
    );
  }

  private refreshOverlay(): void {
    if (!this.overlay || !this.catalogGrid) return;
    this.syncShopRules();
    this.ensureAllowedSelections();
    const goldValue = `Gold: ${Math.round(
      getResourceAmount(this.save, PRIMARY_RESOURCE_ID),
    )}`;
    this.goldSignal.value = goldValue;
    this.categorySignal.value = this.currentCategory;

    const { content, title } = this.buildCategoryContent(this.currentCategory);
    this.catalogTitleSignal.value = title;
    render(<>{content}</>, this.catalogGrid);
    this.updateCatalogNote(this.currentCategory);
    this.updateStats();
    this.applyPreviewLoadout();
    if (this.currentCategory !== "loadout") {
      this.mountVisual = undefined;
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
    const magnet = Math.round((ship.magnetMultiplier ?? 1) * 100);
    this.statsSignal.value = {
      hull: `${ship.maxHp}`,
      magnet: `${magnet}%`,
      speed: `${ship.moveSpeed.toFixed(1)}`,
    };
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

  private updateCatalogNote(category: ShopCategory): void {
    const level = getActiveLevelSession()?.level;
    const restriction = level ? "Mission-approved gear for purchase." : "";
    if (category === "ships") {
      this.catalogNoteSignal.value = level
        ? "Mission-approved hulls for purchase. Owned ships stay available."
        : "Select a ship to equip.";
      return;
    }
    if (category === "armory") {
      this.catalogNoteSignal.value = [
        "Each weapon type is single-ownership. Buy once, equip anywhere.",
        restriction,
      ]
        .filter(Boolean)
        .join(" ");
      return;
    }
    this.catalogNoteSignal.value = "";
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

  private buildCategoryContent(category: ShopCategory) {
    switch (category) {
      case "armory":
        return {
          content: this.buildArmoryCards(),
          title: "Armory",
        };
      case "loadout":
        return {
          content: this.buildLoadoutView(),
          title: "Loadout",
        };
      case "ships":
      default:
        return { content: this.buildShipCards(), title: "Ships" };
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

  private buildShipCards() {
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
          gunId: undefined,
          iconKind: "ship",
          id: ship.id,
          key: `ship-${ship.id}`,
          modIcon: undefined,
          name: ship.name,
          shipShape: ship.vector,
          state,
          status,
          type: "ship",
          weaponSize: undefined,
        });
      });
  }

  private buildArmoryCards() {
    const weaponCards = this.getFilteredWeapons()
      .sort((a, b) => a.cost - b.cost)
      .map((weapon) => {
        const owned = this.save.ownedWeapons.some(
          (instance) => instance.weaponId === weapon.id,
        );
        const missingUnlocks = getMissingUnlocks(
          this.save,
          weapon.requiresUnlocks,
        );
        const unlockBlocked = !owned && missingUnlocks.length > 0;
        const status = unlockBlocked
          ? `Blueprint Required · ${formatCost(
              weapon.cost,
              weapon.costResource ?? PRIMARY_RESOURCE_ID,
            )}`
          : owned
            ? `Owned · ${formatCost(
                weapon.cost,
                weapon.costResource ?? PRIMARY_RESOURCE_ID,
              )}`
            : formatCost(
                weapon.cost,
                weapon.costResource ?? PRIMARY_RESOURCE_ID,
              );
        const state: ShopCardState = owned ? "owned" : "locked";
        return this.buildCard({
          accent: formatColor(weapon.stats.bullet.color ?? 0x7df9ff),
          accentColor: weapon.stats.bullet.color ?? 0x7df9ff,
          description: weapon.description,
          gunId: weapon.gunId,
          iconKind: "gun",
          id: weapon.id,
          key: `weapon-${weapon.id}`,
          modIcon: undefined,
          name: weapon.name,
          shipShape: undefined,
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
          gunId: undefined,
          iconKind: "mod",
          id: mod.id,
          key: `mod-${mod.id}`,
          modIcon: mod.iconKind,
          name: mod.name,
          shipShape: undefined,
          state,
          status,
          type: "mod",
          weaponSize: undefined,
        });
      });

    return [...weaponCards, ...modCards];
  }

  private buildCard(data: {
    accent: string;
    accentColor: number;
    description: string;
    gunId?: string;
    iconKind: CardIconKind;
    id: string;
    key: string;
    modIcon?: ModIconKind;
    name: string;
    shipShape?: ShipVector;
    state: ShopCardState;
    status: string;
    type: ShopItemType;
    weaponSize?: WeaponSize;
  }) {
    const cardStyle = { "--accent": data.accent } as Record<string, string>;
    return (
      <button
        className="shop-card"
        data-id={data.id}
        data-state={data.state}
        data-type={data.type}
        key={data.key}
        style={cardStyle}
        type="button"
      >
        <div className="shop-card-inner">
          <div className="card-icon">
            {this.buildNodeIcon(data.iconKind, {
              accentColor: data.accentColor,
              className: "card-icon-canvas",
              gunId: data.gunId,
              modIcon: data.modIcon,
              shipShape: data.shipShape ?? DEFAULT_SHIP_VECTOR,
              size: 52,
              weaponSize: data.weaponSize,
            })}
          </div>
          <div className="card-title">{data.name}</div>
          <div className="card-desc">{data.description}</div>
          <div className="card-status">{data.status}</div>
        </div>
      </button>
    );
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

    return (
      <div className="shop-loadout">
        <div className="shop-loadout-section">
          <div className="shop-section-title">Loadout Matrix</div>
          <div className="shop-loadout-workbench">
            {this.buildLoadoutNodeGraph(ship, assignments)}
            {this.buildLoadoutSelectionPanel(ship, assignments, selection)}
          </div>
        </div>
      </div>
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
    const center = { x: 50, y: 54 };
    const assignmentById = new Map(
      assignments.map((entry) => [entry.mountId, entry]),
    );
    const mountPositions = new Map<string, { x: number; y: number }>();

    for (const mount of ship.mounts) {
      const x = this.clampPercent(50 + mount.offset.x * 44, 8, 92);
      const y = this.clampPercent(54 + mount.offset.y * 38, 10, 92);
      mountPositions.set(mount.id, { x, y });
    }

    const nodes: ReturnType<typeof this.buildNodeIcon>[] = [];
    nodes.push(
      <div
        className="shop-node shop-node--hull"
        key="node-hull"
        style={{ left: `${center.x}%`, top: `${center.y}%` }}
      >
        {this.buildNodeIcon("ship", {
          accentColor: ship.color,
          className: "shop-node-icon shop-node-icon--hull",
          shipShape: ship.vector,
          size: 140,
        })}
      </div>,
    );

    for (const mount of ship.mounts) {
      const mountPos = mountPositions.get(mount.id);
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

      nodes.push(
        this.createNodeLink(
          mountPos,
          center,
          Boolean(weapon),
          selected,
          mountSurge,
          `link-hull-${mount.id}`,
        ),
      );

      const mountClass = `shop-node shop-node--weapon${
        weapon ? "" : " is-empty"
      }${selected ? " is-selected" : ""}${mountSurge ? " is-surge" : ""}`;

      nodes.push(
        <button
          className={mountClass}
          data-action="select-loadout-mount"
          data-drop="mount"
          data-mount-id={mount.id}
          data-type="mount"
          key={`node-mount-${mount.id}`}
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
          style={{ left: `${mountPos.x}%`, top: `${mountPos.y}%` }}
          type="button"
        >
          {this.buildNodeIcon("gun", {
            accentColor: weapon?.stats.bullet.color ?? 0x7df9ff,
            gunId: weapon?.gunId,
            weaponSize: weapon?.size,
          })}
          <div className="shop-node-name">{weapon?.name ?? "Select"}</div>
        </button>,
      );

      if (!weapon || mount.modSlots <= 0) continue;

      const mountVectorX = mountPos.x - center.x;
      const mountVectorY = mountPos.y - center.y;
      const vectorLength = Math.hypot(mountVectorX, mountVectorY) || 1;
      const dirX = mountVectorX / vectorLength;
      const dirY = mountVectorY / vectorLength;
      const tangentX = -dirY;
      const tangentY = dirX;

      for (let slotIndex = 0; slotIndex < mount.modSlots; slotIndex += 1) {
        const modDistance = 11 + slotIndex * 8;
        const lateral =
          mount.modSlots > 1 ? (slotIndex - (mount.modSlots - 1) / 2) * 4.4 : 0;
        const modPos = {
          x: this.clampPercent(
            mountPos.x + dirX * modDistance + tangentX * lateral,
            7,
            93,
          ),
          y: this.clampPercent(
            mountPos.y + dirY * modDistance + tangentY * lateral,
            9,
            92,
          ),
        };
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

        nodes.push(
          this.createNodeLink(
            modPos,
            mountPos,
            Boolean(mod),
            modSelected,
            modSurge,
            `link-mod-${mount.id}-${slotIndex}`,
          ),
        );

        const modClass = `shop-node shop-node--mod${mod ? "" : " is-empty"}${
          modSelected ? " is-selected" : ""
        }${modSurge ? " is-surge" : ""}`;

        nodes.push(
          <button
            className={modClass}
            data-action="select-loadout-mod"
            data-mount-id={mount.id}
            data-slot-index={slotIndex}
            key={`node-mod-${mount.id}-${slotIndex}`}
            style={{ left: `${modPos.x}%`, top: `${modPos.y}%` }}
            type="button"
          >
            {this.buildNodeIcon("mod", {
              accentColor: mod
                ? this.getModAccentColor(mod.iconKind)
                : 0x6a7a90,
              modIcon: mod?.iconKind,
            })}
            <div className="shop-node-slot">{`M${slotIndex + 1}`}</div>
            <div className="shop-node-name">{mod?.name ?? "Select"}</div>
          </button>,
        );
      }
    }

    return (
      <div
        className="shop-node-graph"
        ref={(element) => {
          this.mountVisual = element ?? undefined;
        }}
      >
        {nodes}
      </div>
    );
  }

  private buildNodeIcon(
    kind: CardIconKind,
    options: {
      accentColor: number;
      className?: string;
      gunId?: string;
      modIcon?: ModIconKind;
      size?: number;
      shipShape?: ShipVector;
      weaponSize?: WeaponSize;
    },
  ) {
    const size = Math.max(24, Math.round(options.size ?? 100));
    return (
      <canvas
        className={options.className ?? "shop-node-icon"}
        height={size}
        ref={(canvas) => {
          if (!canvas) return;
          this.drawIcon(
            canvas,
            kind,
            formatColor(options.accentColor),
            options.accentColor,
            options.shipShape ?? this.getSelectedShip().vector,
            options.gunId,
            options.modIcon,
            options.weaponSize,
          );
        }}
        width={size}
      />
    );
  }

  private buildLoadoutSelectionPanel(
    ship: ShipDefinition,
    assignments: MountAssignment[],
    selection: LoadoutNodeSelection | null,
  ) {
    if (!selection) {
      return (
        <div className="shop-node-panel">
          <div className="shop-node-panel-title">Select a node</div>
          <div className="shop-node-panel-hint">
            Tap any node to route gear.
          </div>
        </div>
      );
    }

    const assignment = assignments.find(
      (entry) => entry.mountId === selection.mountId,
    );
    const mount = ship.mounts.find((entry) => entry.id === selection.mountId);
    if (!assignment || !mount) {
      return (
        <div className="shop-node-panel">
          <div className="shop-node-panel-title">Node unavailable</div>
          <div className="shop-node-panel-hint">Select another node.</div>
        </div>
      );
    }

    if (selection.kind === "mount") {
      const currentInstance = assignment.weaponInstanceId
        ? this.save.ownedWeapons.find(
            (item) => item.id === assignment.weaponInstanceId,
          )
        : null;

      const compatible = this.save.ownedWeapons
        .filter((instance) => {
          const weapon = WEAPONS[instance.weaponId];
          return Boolean(weapon && canMountWeapon(weapon, mount));
        })
        .sort((a, b) => {
          const weaponA = WEAPONS[a.weaponId];
          const weaponB = WEAPONS[b.weaponId];
          if (!weaponA && !weaponB) return 0;
          if (!weaponA) return 1;
          if (!weaponB) return -1;
          if (weaponB.cost !== weaponA.cost) return weaponB.cost - weaponA.cost;
          return weaponA.name.localeCompare(weaponB.name);
        });

      const optionsContent =
        compatible.length === 0 ? (
          <div className="shop-empty">
            No compatible weapons owned. Buy in Armory.
          </div>
        ) : (
          compatible.map((instance) => {
            const weapon = WEAPONS[instance.weaponId];
            if (!weapon) return null;
            return this.buildNodeOptionButton({
              action: "equip-weapon-node",
              current: currentInstance?.id === instance.id,
              icon: {
                accentColor: weapon.stats.bullet.color ?? 0x7df9ff,
                gunId: weapon.gunId,
                iconKind: "gun",
                weaponSize: weapon.size,
              },
              instanceId: instance.id,
              key: `weapon-node-option-${instance.id}`,
              label: weapon.name,
              meta: this.describeWeaponNodeMeta(weapon, assignment),
              mountId: mount.id,
            });
          })
        );

      return (
        <div className="shop-node-panel">
          <div className="shop-node-panel-title">{`${mount.id.toUpperCase()} weapon`}</div>
          <div className="shop-node-panel-options">{optionsContent}</div>
          <div className="shop-node-panel-footer">
            <button
              className="shop-node-clear"
              data-action="clear-mount-weapon"
              data-mount-id={mount.id}
              disabled={!currentInstance}
              type="button"
            >
              Unequip Weapon
            </button>
          </div>
        </div>
      );
    }

    const currentModId = assignment.modInstanceIds[selection.slotIndex] ?? null;
    const currentModInstance = currentModId
      ? this.save.ownedMods.find((item) => item.id === currentModId)
      : null;
    const currentMod = currentModInstance
      ? MODS[currentModInstance.modId]
      : null;

    if (!assignment.weaponInstanceId) {
      return (
        <div className="shop-node-panel">
          <div className="shop-node-panel-title">{`${mount.id.toUpperCase()} mod ${
            selection.slotIndex + 1
          }`}</div>
          <div className="shop-node-panel-hint">Mount a weapon first.</div>
        </div>
      );
    }

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

    const candidates = this.save.ownedMods.filter((instance) => {
      if (instance.id === currentModId) return true;
      const mod = MODS[instance.modId];
      if (!mod) return false;
      return !reservedKinds.has(mod.iconKind);
    });

    const optionContent =
      candidates.length === 0 ? (
        <div className="shop-empty">No compatible mods available.</div>
      ) : (
        candidates.map((instance) => {
          const mod = MODS[instance.modId];
          if (!mod) return null;
          return this.buildNodeOptionButton({
            action: "equip-mod-node",
            current: currentModId === instance.id,
            icon: {
              accentColor: this.getModAccentColor(mod.iconKind),
              iconKind: "mod",
              modIcon: mod.iconKind,
            },
            instanceId: instance.id,
            key: `mod-node-option-${instance.id}`,
            label: mod.name,
            meta: this.describeModEffects(mod),
            mountId: mount.id,
            slotIndex: selection.slotIndex,
          });
        })
      );

    return (
      <div className="shop-node-panel">
        <div className="shop-node-panel-title">{`${mount.id.toUpperCase()} mod ${
          selection.slotIndex + 1
        }`}</div>
        <div className="shop-node-panel-options">{optionContent}</div>
        <div className="shop-node-panel-footer">
          <button
            className="shop-node-clear"
            data-action="clear-mod-slot"
            data-mount-id={mount.id}
            data-slot-index={selection.slotIndex}
            disabled={!currentMod}
            type="button"
          >
            Unequip Mod
          </button>
        </div>
      </div>
    );
  }

  private buildNodeOptionButton(data: {
    action: "equip-mod-node" | "equip-weapon-node";
    current: boolean;
    icon: NodeOptionIcon;
    instanceId: string;
    key: string;
    label: string;
    meta?: string;
    mountId: string;
    slotIndex?: number;
  }) {
    const className = `shop-node-option${data.current ? " is-current" : ""}`;
    return (
      <button
        className={className}
        data-action={data.action}
        data-instance-id={data.instanceId}
        data-mount-id={data.mountId}
        data-slot-index={
          Number.isInteger(data.slotIndex) ? data.slotIndex : undefined
        }
        key={data.key}
        type="button"
      >
        {this.buildNodeIcon(data.icon.iconKind, {
          accentColor: data.icon.accentColor,
          className: "shop-node-option-icon",
          gunId: data.icon.gunId,
          modIcon: data.icon.modIcon,
          size: 100,
          weaponSize: data.icon.weaponSize,
        })}
        <span className="shop-node-option-label">{data.label}</span>
        {data.meta ? (
          <span className="shop-node-option-meta">{data.meta}</span>
        ) : null}
      </button>
    );
  }

  private createNodeLink(
    from: { x: number; y: number },
    to: { x: number; y: number },
    active: boolean,
    selected: boolean,
    surge: boolean,
    key: string,
  ) {
    const className = `shop-node-link${active ? " is-active" : ""}${
      selected ? " is-selected" : ""
    }${surge ? " is-surge" : ""}`;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const width = Math.hypot(dx, dy);
    return (
      <div
        className={className}
        key={key}
        style={{
          left: `${from.x}%`,
          top: `${from.y}%`,
          transform: `rotate(${Math.atan2(dy, dx)}rad)`,
          width: `${width}%`,
        }}
      />
    );
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

  private clampPercent(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
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
    if (action?.dataset.action === "select-loadout-mount") {
      const mountId = action.dataset.mountId;
      if (!mountId) return;
      this.loadoutSelection = { kind: "mount", mountId };
      this.refreshOverlay();
      return;
    }
    if (action?.dataset.action === "select-loadout-mod") {
      const mountId = action.dataset.mountId;
      const slotIndex = Number.parseInt(action.dataset.slotIndex ?? "", 10);
      if (!mountId || Number.isNaN(slotIndex)) return;
      this.loadoutSelection = { kind: "mod", mountId, slotIndex };
      this.refreshOverlay();
      return;
    }
    if (action?.dataset.action === "clear-mount-weapon") {
      const mountId = action.dataset.mountId;
      if (!mountId) return;
      this.detachWeaponFromMount(mountId);
      this.loadoutSelection = { kind: "mount", mountId };
      return;
    }
    if (action?.dataset.action === "equip-weapon-node") {
      const mountId = action.dataset.mountId;
      const instanceId = action.dataset.instanceId;
      if (!mountId || !instanceId) return;
      this.assignWeaponToMount({ instanceId, kind: "weapon" }, mountId);
      this.loadoutSelection = { kind: "mount", mountId };
      return;
    }
    if (action?.dataset.action === "clear-mod-slot") {
      const mountId = action.dataset.mountId;
      const slotIndex = Number.parseInt(action.dataset.slotIndex ?? "", 10);
      if (!mountId || Number.isNaN(slotIndex)) return;
      this.clearModSlot(mountId, slotIndex);
      this.loadoutSelection = { kind: "mod", mountId, slotIndex };
      return;
    }
    if (action?.dataset.action === "equip-mod-node") {
      const mountId = action.dataset.mountId;
      const slotIndex = Number.parseInt(action.dataset.slotIndex ?? "", 10);
      const instanceId = action.dataset.instanceId;
      if (!mountId || Number.isNaN(slotIndex) || !instanceId) return;
      this.assignModToSlot(mountId, slotIndex, instanceId);
      this.loadoutSelection = { kind: "mod", mountId, slotIndex };
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
        const selectedShip = SHIPS[data.selectedShipId];
        const selectedAssignments = selectedShip
          ? this.ensureMountAssignments(data, selectedShip)
          : [];
        const preferredWeaponIds = selectedAssignments
          .map((entry) => entry.weaponInstanceId)
          .filter((instanceId): instanceId is WeaponInstanceId =>
            Boolean(instanceId),
          );
        if (!unlocked) {
          if (!hasRequiredUnlocks(data, ship.requiresUnlocks)) return;
          if (!canPurchase) return;
          const resourceId = ship.costResource ?? PRIMARY_RESOURCE_ID;
          if (!spendResourceInSave(data, resourceId, ship.cost)) return;
          data.unlockedShips = [...data.unlockedShips, id];
          autoAttachWeaponsForShipInSave(data, ship, preferredWeaponIds);
        }
        data.selectedShipId = id;
      });
      this.loadoutSelection = null;
      this.refreshOverlay();
      return;
    }

    if (type === "weapon") {
      const weapon = WEAPONS[id];
      if (!weapon) return;
      const alreadyOwned = this.save.ownedWeapons.some(
        (instance) => instance.weaponId === weapon.id,
      );
      if (alreadyOwned) return;
      if (!this.isWeaponAllowed(weapon)) return;
      if (!hasRequiredUnlocks(this.save, weapon.requiresUnlocks)) return;
      this.updateSave((data) => {
        const owned = data.ownedWeapons.some(
          (instance) => instance.weaponId === weapon.id,
        );
        if (owned) return;
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
    this.queueEnergySurge(mountId);
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
    let appliedSlotIndex: null | number = null;
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
        appliedSlotIndex = Math.max(0, target.modInstanceIds.length - 1);
      },
      { allowEmptyLoadout: true },
    );
    if (appliedSlotIndex !== null) {
      this.queueEnergySurge(mountId, appliedSlotIndex);
    }
    this.refreshOverlay();
  }

  private clearModSlot(mountId: string, slotIndex: number): void {
    this.updateSave(
      (data) => {
        const ship = SHIPS[data.selectedShipId];
        if (!ship) return;
        const mount = ship.mounts.find((entry) => entry.id === mountId);
        if (!mount) return;
        const assignments = this.ensureMountAssignments(data, ship);
        const entry = assignments.find((item) => item.mountId === mountId);
        if (!entry) return;
        if (slotIndex < 0 || slotIndex >= entry.modInstanceIds.length) return;
        entry.modInstanceIds.splice(slotIndex, 1);
        entry.modInstanceIds = entry.modInstanceIds.slice(0, mount.modSlots);
      },
      { allowEmptyLoadout: true },
    );
    this.refreshOverlay();
  }

  private assignModToSlot(
    mountId: string,
    slotIndex: number,
    modInstanceId: ModInstanceId,
  ): void {
    this.updateSave(
      (data) => {
        const ship = SHIPS[data.selectedShipId];
        if (!ship) return;
        const mount = ship.mounts.find((entry) => entry.id === mountId);
        if (!mount || mount.modSlots <= 0) return;
        const assignments = this.ensureMountAssignments(data, ship);
        const entry = assignments.find((item) => item.mountId === mountId);
        if (!entry?.weaponInstanceId) return;
        const modInstance = data.ownedMods.find(
          (item) => item.id === modInstanceId,
        );
        const mod = modInstance ? MODS[modInstance.modId] : null;
        if (!mod) return;

        for (const assignment of assignments) {
          assignment.modInstanceIds = assignment.modInstanceIds.filter(
            (instanceId) => instanceId !== modInstanceId,
          );
        }

        const maxSlots = Math.max(0, mount.modSlots);
        const targetIndex = Math.min(
          Math.max(0, slotIndex),
          Math.max(0, maxSlots - 1),
        );
        const current = [...entry.modInstanceIds].slice(0, maxSlots);
        if (targetIndex < current.length) {
          current.splice(targetIndex, 1);
        }
        const sameTypeIndex = current.findIndex((instanceId) => {
          const existing = data.ownedMods.find(
            (item) => item.id === instanceId,
          );
          const existingMod = existing ? MODS[existing.modId] : null;
          return existingMod?.iconKind === mod.iconKind;
        });
        if (sameTypeIndex >= 0) {
          current.splice(sameTypeIndex, 1);
        }
        const insertIndex = Math.min(targetIndex, current.length);
        current.splice(insertIndex, 0, modInstanceId);
        entry.modInstanceIds = current.slice(0, maxSlots);
      },
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

  private getDragPreviewHost(): HTMLDivElement | null {
    const host = document.getElementById("shop-drag-preview-root");
    return host instanceof HTMLDivElement ? host : null;
  }

  private clearDragPreview(): void {
    const host = this.getDragPreviewHost();
    if (host) {
      render(null, host);
    }
    this.dragPreviewEl = undefined;
  }

  private mountDragPreview(
    onCanvasReady: (canvas: HTMLCanvasElement) => void,
  ): HTMLDivElement | null {
    const host = this.getDragPreviewHost();
    if (!host) return null;
    let previewRef: HTMLDivElement | null = null;
    let canvasRef: HTMLCanvasElement | null = null;
    render(
      <div
        className="shop-drag-preview"
        ref={(element) => {
          previewRef = element;
        }}
      >
        <canvas
          className="shop-drag-preview-icon"
          height={36}
          ref={(element) => {
            canvasRef = element;
          }}
          width={36}
        />
      </div>,
      host,
    );
    if (!previewRef || !canvasRef) {
      render(null, host);
      return null;
    }
    onCanvasReady(canvasRef);
    this.dragPreviewEl = previewRef;
    return previewRef;
  }

  private setDragPreview(event: DragEvent, weapon: WeaponDefinition): void {
    const transfer = event.dataTransfer;
    if (!transfer) return;
    this.clearDragPreview();
    const color = formatColor(weapon.stats.bullet.color ?? 0x7df9ff);
    const preview = this.mountDragPreview((canvas) => {
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
    });
    if (!preview) return;
    transfer.setDragImage(preview, 22, 22);
  }

  private setModDragPreview(event: DragEvent, mod: ModDefinition): void {
    const transfer = event.dataTransfer;
    if (!transfer) return;
    this.clearDragPreview();
    const colorValue = this.getModAccentColor(mod.iconKind);
    const color = formatColor(colorValue);
    const preview = this.mountDragPreview((canvas) => {
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
