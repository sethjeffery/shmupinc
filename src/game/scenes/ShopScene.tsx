import type { ShopRules } from "../data/levels";
import type { ModInstanceId } from "../data/modInstances";
import type { ModIconKind, ModId } from "../data/mods";
import type { ModDefinition, ModIconVector } from "../data/modTypes";
import type { MountAssignment, SaveData } from "../data/save";
import type { ShipId } from "../data/ships";
import type { ShipDefinition, ShipVector } from "../data/shipTypes";
import type { WeaponInstanceId } from "../data/weaponInstances";
import type { WeaponDefinition, WeaponId } from "../data/weapons";
import type { WeaponSize } from "../data/weaponTypes";

import { signal } from "@preact/signals";
import Phaser from "phaser";
import { render } from "preact";

import { getActiveLevelSession } from "../data/levelState";
import { MODS } from "../data/mods";
import {
  buildMountedWeapons,
  getMissingUnlocks,
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
import LoadoutPanel from "../ui/loadout/LoadoutPanel";
import NodeGraphContainer, { NodeLink } from "../ui/loadout/NodeGraph";
import {
  createNodeGraphLayout,
  getVisibleMounts,
  MAX_RENDERED_MOD_SLOTS,
  type NodeGraphPoint,
} from "../ui/loadout/nodeGraphLayout";
import ArmoryTab from "../ui/shop/ArmoryTab";
import { drawShopIcon, type CardIconKind } from "../ui/shop/iconPainter";
import LoadoutTab from "../ui/shop/LoadoutTab";
import ShipsTab from "../ui/shop/ShipsTab";
import { DEFAULT_SHOP_CATEGORY, type ShopCategory } from "../ui/shop/shopTabs";
import ShopCard from "../ui/ShopCard";
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

type ShopItemType = "inventory" | "mod" | "mount" | "ship" | "weapon";

type ShopCardState = "equipped" | "locked" | "mounted" | "owned" | "restricted";

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
  hull: string;
  magnet: string;
  speed: string;
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
    document.body.classList.remove("shop-open");
  }

  private renderOverlay(overlay: HTMLDivElement): void {
    render(
      <ShopOverlayView
        onDeploy={() => this.handleDeploy()}
        onPreviewRootRef={(element) => {
          this.previewRoot = element ?? undefined;
        }}
        onTabSelect={(category) => this.setCategory(category)}
        signals={{
          category: this.categorySignal,
          content: this.contentSignal,
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
    if (!this.overlay) return;
    this.syncShopRules();
    this.ensureAllowedSelections();
    const goldValue = `Gold: ${Math.round(
      getResourceAmount(this.save, PRIMARY_RESOURCE_ID),
    )}`;
    this.goldSignal.value = goldValue;
    this.categorySignal.value = this.currentCategory;
    this.contentSignal.value = this.buildCategoryContent(this.currentCategory);
    this.updateStats();
    this.applyPreviewLoadout();
    if (this.currentCategory !== "loadout") {
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
    } else {
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
        return <ArmoryTab cards={this.buildArmoryCards()} />;
      case "loadout":
        return <LoadoutTab content={this.buildLoadoutView()} />;
      case "ships":
      default:
        return <ShipsTab cards={this.buildShipCards()} />;
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
          modVector: undefined,
          name: ship.name,
          onClick: () => this.handleCardClick("ship", ship.id),
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
          modVector: undefined,
          name: weapon.name,
          onClick: () => this.handleCardClick("weapon", weapon.id),
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
        const owned = this.save.ownedMods.some(
          (instance) => instance.modId === mod.id,
        );
        const missingUnlocks = getMissingUnlocks(
          this.save,
          mod.requiresUnlocks,
        );
        const unlockBlocked = !owned && missingUnlocks.length > 0;
        const status = unlockBlocked
          ? `Blueprint Required · ${formatCost(
              mod.cost,
              mod.costResource ?? PRIMARY_RESOURCE_ID,
            )}`
          : owned
            ? `Owned · ${formatCost(
                mod.cost,
                mod.costResource ?? PRIMARY_RESOURCE_ID,
              )}`
            : formatCost(mod.cost, mod.costResource ?? PRIMARY_RESOURCE_ID);
        const state: ShopCardState = owned ? "owned" : "locked";
        const accentColor = this.getModAccentColor(mod.iconKind);
        return this.buildCard({
          accent: formatColor(accentColor),
          accentColor,
          description: mod.description,
          gunId: undefined,
          iconKind: "mod",
          id: mod.id,
          key: `mod-${mod.id}`,
          modVector: mod.icon,
          name: mod.name,
          onClick: () => this.handleCardClick("mod", mod.id),
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
    modVector?: ModIconVector;
    name: string;
    shipShape?: ShipVector;
    state: ShopCardState;
    status: string;
    type: ShopItemType;
    onClick?: () => void;
    weaponSize?: WeaponSize;
  }) {
    const cardStyle = { "--accent": data.accent } as Record<string, string>;
    return (
      <ShopCard
        id={data.id}
        state={data.state}
        type={data.type}
        key={data.key}
        style={cardStyle}
        onClick={data.onClick}
        renderIcon={() =>
          this.buildNodeIcon(data.iconKind, {
            accentColor: data.accentColor,
            className: "card-icon-canvas",
            gunId: data.gunId,
            modVector: data.modVector,
            shipShape: data.shipShape ?? DEFAULT_SHIP_VECTOR,
            size: 52,
            weaponSize: data.weaponSize,
          })
        }
        name={data.name}
        description={data.description}
        status={data.status}
      />
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
          <div className="shop-loadout-workbench">
            {this.buildLoadoutNodeGraph(ship, assignments)}
            <LoadoutPanel
              ship={ship}
              assignments={assignments}
              selection={selection}
              save={this.save}
              onClearModSlot={(mountId, slotIndex) => {
                this.clearModSlot(mountId, slotIndex);
                this.loadoutSelection = { kind: "mod", mountId, slotIndex };
              }}
              onClearMountWeapon={(mountId) => {
                this.detachWeaponFromMount(mountId);
                this.loadoutSelection = { kind: "mount", mountId };
              }}
              onEquipMod={(mountId, slotIndex, instanceId) => {
                this.assignModToSlot(mountId, slotIndex, instanceId);
                this.loadoutSelection = { kind: "mod", mountId, slotIndex };
              }}
              onEquipWeapon={(mountId, instanceId) => {
                this.assignWeaponToMount({ instanceId, kind: "weapon" }, mountId);
                this.loadoutSelection = { kind: "mount", mountId };
              }}
              buildNodeIcon={(kind, options) =>
                this.buildNodeIcon(kind as CardIconKind, options)
              }
              describeWeaponNodeMeta={(w, a) =>
                this.describeWeaponNodeMeta(w, a)
              }
              describeModEffects={(m) => this.describeModEffects(m)}
              getModAccentColor={(k) => this.getModAccentColor(k)}
            />
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
    const visibleMounts = getVisibleMounts(ship);
    const assignmentById = new Map(
      assignments.map((entry) => [entry.mountId, entry]),
    );
    const layout = createNodeGraphLayout(ship, assignments);

    const links: preact.ComponentChildren[] = [];
    const nodes: ReturnType<typeof this.buildNodeIcon>[] = [];
    nodes.push(
      <div
        className="shop-node shop-node--hull"
        key="node-hull"
        style={{
          left: `${layout.shipPoint.x}px`,
          top: `${layout.shipPoint.y}px`,
        }}
      >
        {this.buildNodeIcon("ship", {
          accentColor: ship.color,
          className: "shop-node-icon shop-node-icon--hull",
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

      const mountClass = `shop-node shop-node--weapon${
        weapon ? "" : " is-empty"
      }${selected ? " is-selected" : ""}${mountSurge ? " is-surge" : ""}`;

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
          <div className="shop-node-name">{weapon?.name ?? "EMPTY"}</div>
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

        const modClass = `shop-node shop-node--mod${mod ? "" : " is-empty"}${
          modSelected ? " is-selected" : ""
        }${modSurge ? " is-surge" : ""}`;

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
            <div className="shop-node-name">{mod?.name ?? "Select"}</div>
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
        className={options.className ?? "shop-node-icon"}
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
    if (target.closest(".shop-node")) return;
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
      this.mountVisual.classList.toggle("is-dragging", Boolean(payload));
    }
    const eligibleMounts = getEligibleMountIdsForDrag(
      this.save,
      ship,
      assignments,
      payload,
    );
    for (const [mountId, dot] of this.mountDots.entries()) {
      const eligible = eligibleMounts.has(mountId);
      dot.classList.toggle("is-eligible", eligible);
      const isDrop = eligible && this.dragHoverMountId === mountId;
      dot.classList.toggle("is-drop", isDrop);
    }
  }

  private handleCardClick(type: "mod" | "ship" | "weapon", id: string): void {
    if (type === "ship") {
      const ship = SHIPS[id];
      if (!ship) return;
      const owned = this.save.unlockedShips.includes(id);
      const canPurchase = this.isShipAllowedForPurchase(id);
      const canUnlock = hasRequiredUnlocks(this.save, ship.requiresUnlocks);
      if (!owned && (!canPurchase || !canUnlock)) return;
      this.updateSave((data) =>
        selectOrPurchaseShipInSave(data, id, canPurchase),
      );
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
      this.updateSave((data) => purchaseWeaponInSave(data, weapon.id));
      this.refreshOverlay();
      return;
    }

    const mod = MODS[id];
    if (!mod) return;
    const alreadyOwned = this.save.ownedMods.some(
      (instance) => instance.modId === mod.id,
    );
    if (alreadyOwned) return;
    if (!this.isModAllowed(mod)) return;
    if (!hasRequiredUnlocks(this.save, mod.requiresUnlocks)) return;
    this.updateSave((data) => purchaseModInSave(data, mod.id));
    this.refreshOverlay();
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
