import type { ShopRules } from "../data/levels";
import type { ModInstanceId } from "../data/modInstances";
import type { MountAssignment, MountedWeapon, SaveData } from "../data/save";
import type { ShipId } from "../data/ships";
import type { ShipDefinition } from "../data/shipTypes";
import type { VectorShape } from "../data/vectorShape";
import type { WeaponInstanceId } from "../data/weaponInstances";
import type { WeaponSize } from "../data/weaponTypes";
import type { CardIconKind } from "../ui/shop/iconPainter";

import { signal } from "@preact/signals";
import Phaser from "phaser";
import { render } from "preact";

import { getActiveLevelSession } from "../data/levelState";
import { MODS } from "../data/mods";
import {
  buildMountedWeapons,
  getResourceAmount,
  loadSave,
  mutateSave,
} from "../data/save";
import { SHIPS } from "../data/ships";
import { pickAllowedId } from "../data/shopRules";
import { canMountWeapon } from "../data/weaponMounts";
import { WEAPONS } from "../data/weapons";
import LoadoutAreaView from "../ui/shop/LoadoutAreaView";
import { DEFAULT_SHOP_CATEGORY, type ShopCategory } from "../ui/shop/shopTabs";
import { getFilteredMods as getFilteredModsForShop } from "../ui/shop/utils/mods";
import { getFilteredShips as getFilteredShipsForShop } from "../ui/shop/utils/ships";
import {
  ensureMountAssignments,
  getFilteredWeapons as getFilteredWeaponsForShop,
} from "../ui/shop/utils/weapons";
import ShopOverlayView from "../ui/ShopOverlayView";
import { PreviewScene } from "./PreviewScene";
import {
  assignModToMountInSave,
  assignModToSlotInSave,
  assignWeaponToMountInSave,
  clearModSlotInSave,
  detachWeaponFromMountInSave,
  purchaseModInSave,
  purchaseWeaponInSave,
  selectOrPurchaseShipInSave,
} from "./shop/saveOps";

import styles from "./ShopScene.module.css";

const PRIMARY_RESOURCE_ID = "gold";

export interface ShopCarouselItem {
  accentColor: number;
  cost?: number;
  costLabel?: string;
  costResource?: string;
  description: string;
  equipped?: boolean;
  id: string;
  kind: CardIconKind;
  name: string;
  owned?: boolean;
  purchasable?: boolean;
  shape: VectorShape;
  size?: WeaponSize;
}

export class ShopScene extends Phaser.Scene {
  private save!: SaveData;
  private overlay?: HTMLDivElement;
  private previewRoot?: HTMLDivElement;
  private previewGame?: Phaser.Game;
  private previewScene?: PreviewScene;
  private resizeObserver?: ResizeObserver;
  private currentCategory: ShopCategory = DEFAULT_SHOP_CATEGORY;
  private readonly categorySignal = signal<ShopCategory>(DEFAULT_SHOP_CATEGORY);
  private readonly contentSignal = signal<preact.ComponentChild>(null);
  private readonly goldSignal = signal("0");
  private readonly missionActiveSignal = signal(false);
  private readonly missionTextSignal = signal("");
  private shopRules: null | ShopRules = null;
  private previewCanvasSize = { height: 0, width: 0 };
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
    this.refreshOverlay();
    this.setupPreviewGame();
  }

  private hideOverlay(): void {
    if (!this.overlay) return;
    this.teardownPreviewGame();
    render(null, this.overlay);
    this.overlay.className = "";
    this.overlay = undefined;
    this.previewRoot = undefined;
    this.shopRules = null;
    this.previewCanvasSize = { height: 0, width: 0 };
    window.removeEventListener("resize", this.handleWindowResizeBound);
    document.body.classList.remove("shop-open");
  }

  private renderOverlay(overlay: HTMLDivElement): void {
    render(
      <ShopOverlayView
        content={this.contentSignal.value}
        onQuit={() => this.handleQuitToMenu()}
        onItemAction={(item) => {
          if (item.owned) {
            this.equipPreviewItem(item);
            return;
          }
          this.buyPreviewItem(item);
        }}
        onItemClick={(item) => void item}
        onTabSelect={(category) => this.setCategory(category)}
        category={this.categorySignal.value}
        gold={this.goldSignal.value}
        missionActive={this.missionActiveSignal.value}
        missionText={this.missionTextSignal.value}
        save={this.save}
        selectedShip={this.getSelectedShip()}
        shopRules={this.shopRules ?? undefined}
      />,
      overlay,
    );
  }

  private refreshOverlay(): void {
    if (!this.overlay) return;
    this.syncShopRules();
    this.ensureAllowedSelections();
    const goldValue = `${Math.round(getResourceAmount(this.save, PRIMARY_RESOURCE_ID))}`;
    this.goldSignal.value = goldValue;
    this.categorySignal.value = this.currentCategory;
    this.contentSignal.value = this.buildCategoryContent(this.currentCategory);
    this.renderOverlay(this.overlay);
    if (this.requiresPreviewScene(this.currentCategory)) {
      window.requestAnimationFrame(() => {
        this.setupPreviewGame();
        this.applyPreviewLoadout();
        this.syncPreviewCanvasSize();
      });
    } else {
      this.previewRoot = undefined;
      this.teardownPreviewGame();
    }
  }

  private setCategory(category: ShopCategory): void {
    if (this.currentCategory === category) return;
    this.currentCategory = category;
    this.refreshOverlay();
  }

  private requiresPreviewScene(category: ShopCategory): boolean {
    return category === "loadout";
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

        const assignments = ensureMountAssignments(data.mountedWeapons, ship);
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
      case "loadout":
        return this.buildLoadoutView();
      case "mods":
      case "ships":
      case "weapons":
      default:
        return null;
    }
  }

  private getSelectedShip(): ShipDefinition {
    return SHIPS[this.save.selectedShipId] ?? SHIPS.starter;
  }

  private buyPreviewItem(item: ShopCarouselItem): void {
    if (item.owned || !item.purchasable) return;
    if (item.kind === "ship") {
      this.updateSave((data) =>
        selectOrPurchaseShipInSave(
          data,
          item.id,
          this.shopRules
            ? getFilteredShipsForShop(this.shopRules).some(
                (ship) => ship.id === item.id,
              )
            : true,
        ),
      );
      this.refreshOverlay();
      return;
    }
    if (item.kind === "weapon") {
      const weapon = WEAPONS[item.id];
      if (
        !weapon ||
        (this.shopRules &&
          !getFilteredWeaponsForShop(this.shopRules).some(
            (candidate) => candidate.id === weapon.id,
          ))
      ) {
        return;
      }
      this.updateSave((data) => purchaseWeaponInSave(data, weapon.id));
      this.refreshOverlay();
      return;
    }
    const mod = MODS[item.id];
    if (
      !mod ||
      (this.shopRules &&
        !getFilteredModsForShop(this.shopRules).some(
          (candidate) => candidate.id === mod.id,
        ))
    ) {
      return;
    }
    this.updateSave((data) => purchaseModInSave(data, mod.id));
    this.refreshOverlay();
  }

  private equipPreviewItem(item: ShopCarouselItem): void {
    if (!item.owned) return;
    if (item.kind === "ship") {
      this.updateSave((data) =>
        selectOrPurchaseShipInSave(data, item.id, false),
      );
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
      this.assignWeaponToMount(mountId, instance.id);
      return;
    }

    const instance = this.save.ownedMods.find(
      (entry) => entry.modId === item.id,
    );
    const mod = MODS[item.id];
    if (!instance || !mod) return;
    const freeTarget = ship.mounts.find((mount) => {
      const assignment = assignments.find(
        (entry) => entry.mountId === mount.id,
      );
      if (!assignment?.weaponInstanceId) return false;
      if (assignment.modInstanceIds.length >= Math.max(0, mount.modSlots)) {
        return false;
      }
      const hasSameKind = assignment.modInstanceIds.some((instanceId) => {
        const mounted = this.save.ownedMods.find(
          (entry) => entry.id === instanceId,
        );
        const mountedMod = mounted ? MODS[mounted.modId] : null;
        return mountedMod?.iconKind === mod.iconKind;
      });
      return !hasSameKind;
    });
    const fallback = assignments.find(
      (assignment) => assignment.weaponInstanceId,
    );
    const mountId = freeTarget?.id ?? fallback?.mountId;
    if (!mountId) return;
    this.assignModToMount(mountId, instance.id);
  }

  private getAssignmentsForShip(ship: ShipDefinition): MountAssignment[] {
    if (!this.save.mountedWeapons[ship.id]) {
      this.updateSave((data) => {
        ensureMountAssignments(data.mountedWeapons, ship);
      });
    }
    return (
      this.save.mountedWeapons[ship.id] ??
      ensureMountAssignments(this.save.mountedWeapons, ship)
    );
  }

  private buildLoadoutView() {
    const ship = this.getSelectedShip();
    return (
      <LoadoutAreaView
        onAssignModToSlot={(mountId, slotIndex, modInstanceId) =>
          this.assignModToSlot(mountId, slotIndex, modInstanceId)
        }
        onAssignWeaponToMount={(mountId, weaponInstanceId) =>
          this.assignWeaponToMount(mountId, weaponInstanceId)
        }
        onClearModSlot={(mountId, slotIndex) =>
          this.clearModSlot(mountId, slotIndex)
        }
        onDetachWeaponFromMount={(mountId) =>
          this.detachWeaponFromMount(mountId)
        }
        onSelectShip={(shipId) => this.handleLoadoutShipSelect(shipId)}
        onStartMission={() => this.handleDeploy()}
        previewRootRef={this.handlePreviewRootRef}
        save={this.save}
        selectedShip={ship}
      />
    );
  }

  private handleLoadoutShipSelect(shipId: ShipId): void {
    if (this.save.selectedShipId === shipId) return;
    this.updateSave((data) => selectOrPurchaseShipInSave(data, shipId, false));
    this.refreshOverlay();
  }

  private detachWeaponFromMount(mountId: string): void {
    this.updateSave((data) => detachWeaponFromMountInSave(data, mountId), {
      allowEmptyLoadout: true,
    });
    this.refreshOverlay();
  }

  private assignWeaponToMount(
    mountId: string,
    weaponInstanceId: WeaponInstanceId,
  ): void {
    this.updateSave(
      (data) =>
        assignWeaponToMountInSave(
          data,
          { instanceId: weaponInstanceId },
          mountId,
        ),
      { allowEmptyLoadout: true },
    );
    this.refreshOverlay();
  }

  private assignModToMount(
    mountId: string,
    modInstanceId: ModInstanceId,
  ): void {
    this.updateSave(
      (data) => {
        assignModToMountInSave(data, { instanceId: modInstanceId }, mountId);
      },
      { allowEmptyLoadout: true },
    );
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
    this.refreshOverlay();
  }

  private setupPreviewGame(): void {
    if (!this.previewRoot) return;
    if (this.previewGame) {
      this.attachPreviewCanvasToRoot();
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
      }
      this.resizeObserver = new ResizeObserver(() =>
        this.syncPreviewCanvasSize(),
      );
      this.resizeObserver.observe(this.previewRoot);
      this.syncPreviewCanvasSize();
      return;
    }
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

  private attachPreviewCanvasToRoot(): void {
    if (!this.previewRoot || !this.previewGame) return;
    const canvas = this.previewGame.canvas;
    if (!canvas) return;
    if (canvas.parentElement === this.previewRoot) return;
    this.previewRoot.appendChild(canvas);
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
    return {
      mountedWeapons: buildMountedWeapons(this.save, selectedShip),
      ship: selectedShip,
    };
  }

  private applyPreviewLoadout(): void {
    if (!this.previewScene) return;
    const { mountedWeapons, ship } = this.resolvePreviewLoadout();
    const canFire = mountedWeapons.length > 0;
    this.previewScene.setPresentation(this.getPreviewPresentation(canFire));
    this.previewScene.setLoadout(mountedWeapons, ship);
  }

  private getPreviewPresentation(weaponFireEnabled: boolean): {
    fireEnabled: boolean;
    shipScale: number;
    shipX: number;
    shipY: number;
  } {
    const compactLayout =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 960px)").matches;

    return {
      fireEnabled: weaponFireEnabled,
      shipScale: 2.65,
      shipX: compactLayout ? 0.5 : 0.72,
      shipY: compactLayout ? 0.76 : 0.64,
    };
  }
}
