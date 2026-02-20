import type { ShopRules } from "../../data/levels";
import type { ShipDefinition } from "../../data/ships";
import type { ShopCarouselItem as ShopCarouselItemModel } from "../../scenes/ShopScene";

import { useEffect, useMemo, useState } from "preact/hooks";

import { GUNS } from "../../data/guns";
import {
  buildMountedWeapons,
  createWeaponInstanceInSave,
  hasRequiredUnlocks,
  type SaveData,
} from "../../data/save";
import { canMountWeapon, resolveWeaponStats } from "../../data/weaponMounts";
import { WEAPONS, type WeaponDefinition } from "../../data/weapons";
import { useTypewriter } from "./hooks/useTypewriter";
import ShopCarouselItem from "./ShopCarouselItem";
import ShopTopCarousel from "./ShopTopCarousel";
import { formatCost } from "./utils/formatting";
import {
  canWeaponFitShip,
  ensureMountAssignments,
  getEmptyWeaponStats,
  getFilteredWeapons,
  getVisibleWeapons,
  getWeaponPreviewStats,
  getWeaponSizeLabel,
  isWeaponEquipped,
} from "./utils/weapons";
import WeaponPreviewStageView from "./WeaponPreviewStageView";

import styles from "./WeaponsAreaView.module.css";

function describeWeaponEffectTags(weapon: WeaponDefinition): string[] {
  const stats = resolveWeaponStats(weapon);
  const tags: string[] = [];
  if (stats.homing ?? stats.bullet.homing) tags.push("Homing");
  if (stats.aoe ?? stats.bullet.aoe) tags.push("Explosive");
  if ((stats.shots?.length ?? 1) > 1) tags.push("Multi-shot");
  return tags;
}

function buildWeaponCarouselItems(
  save: SaveData,
  ship: ShipDefinition,
  shopRules?: ShopRules,
): readonly ShopCarouselItemModel[] {
  const allowedWeaponIds = new Set(
    getFilteredWeapons(shopRules).map((item) => item.id),
  );
  return getVisibleWeapons(save.ownedWeapons, shopRules)
    .sort((a, b) => a.cost - b.cost)
    .filter((weapon) => {
      const owned = save.ownedWeapons.some(
        (instance) => instance.weaponId === weapon.id,
      );
      return owned || hasRequiredUnlocks(save, weapon.requiresUnlocks);
    })
    .map((weapon) => {
      const owned = save.ownedWeapons.some(
        (instance) => instance.weaponId === weapon.id,
      );
      const gun = GUNS[weapon.gunId];
      return {
        accentColor: weapon.stats.bullet.color ?? 0x7df9ff,
        cost: weapon.cost,
        costLabel: owned
          ? undefined
          : formatCost(weapon.cost ?? 0, weapon.costResource ?? "gold"),
        costResource: weapon.costResource ?? "gold",
        description: weapon.description,
        equipped: isWeaponEquipped(
          ship,
          weapon.id,
          save.mountedWeapons,
          save.ownedWeapons,
        ),
        id: weapon.id,
        kind: "weapon",
        name: weapon.name,
        owned,
        purchasable: !owned && allowedWeaponIds.has(weapon.id),
        shape: gun?.vector ?? { items: [], v: 2 },
      } satisfies ShopCarouselItemModel;
    });
}

const buildWeaponPreviewLoadout = (
  save: SaveData,
  ship: ShipDefinition,
  weaponId: null | string,
): {
  mountedWeapons: ReturnType<typeof buildMountedWeapons>;
  ship: ShipDefinition;
} => {
  const fallback = { mountedWeapons: buildMountedWeapons(save, ship), ship };
  if (!weaponId) return fallback;
  const weapon = WEAPONS[weaponId];
  if (!weapon) return fallback;
  if (!ship.mounts.some((mount) => canMountWeapon(weapon, mount))) {
    return fallback;
  }

  const previewSave = structuredClone(save);
  previewSave.selectedShipId = ship.id;
  const assignments = ensureMountAssignments(previewSave.mountedWeapons, ship);
  const instance =
    previewSave.ownedWeapons.find((entry) => entry.weaponId === weapon.id) ??
    createWeaponInstanceInSave(previewSave, weapon.id);

  const targetMount =
    ship.mounts.find((mount) => {
      const assignment = assignments.find(
        (entry) => entry.mountId === mount.id,
      );
      return (
        canMountWeapon(weapon, mount) &&
        (!assignment?.weaponInstanceId ||
          assignment.weaponInstanceId === instance.id)
      );
    }) ?? ship.mounts.find((mount) => canMountWeapon(weapon, mount));

  if (!targetMount) return fallback;

  for (const assignment of assignments) {
    if (assignment.mountId === targetMount.id) continue;
    if (assignment.weaponInstanceId !== instance.id) continue;
    assignment.weaponInstanceId = null;
    assignment.modInstanceIds = [];
  }
  const targetAssignment = assignments.find(
    (entry) => entry.mountId === targetMount.id,
  );
  if (targetAssignment) {
    targetAssignment.weaponInstanceId = instance.id;
  }

  return {
    mountedWeapons: buildMountedWeapons(previewSave, ship),
    ship,
  };
};

export default function WeaponsAreaView(props: {
  onAction?: (item: ShopCarouselItemModel) => void;
  onItemClick?: (item: ShopCarouselItemModel) => void;
  selectedShip: ShipDefinition;
  save: SaveData;
  shopRules?: ShopRules;
}) {
  const items = useMemo(
    () =>
      buildWeaponCarouselItems(props.save, props.selectedShip, props.shopRules),
    [props.save, props.selectedShip, props.shopRules],
  );

  const mountedWeaponId = useMemo((): null | string => {
    const mountedInstanceId =
      props.save.mountedWeapons[props.selectedShip.id]?.[0]?.weaponInstanceId ??
      null;
    if (!mountedInstanceId) return null;
    return (
      props.save.ownedWeapons.find((entry) => entry.id === mountedInstanceId)
        ?.weaponId ?? null
    );
  }, [
    props.save.mountedWeapons,
    props.save.ownedWeapons,
    props.selectedShip.id,
  ]);

  const [selectedItemId, setSelectedItemId] = useState<null | string>(() => {
    return (
      (items.find((item) => item.id === mountedWeaponId) ?? items[0])?.id ??
      null
    );
  });

  useEffect(() => {
    if (items.length === 0) {
      if (selectedItemId !== null) setSelectedItemId(null);
      return;
    }
    if (selectedItemId && items.some((item) => item.id === selectedItemId)) {
      return;
    }
    setSelectedItemId(
      (items.find((item) => item.id === mountedWeaponId) ?? items[0])?.id ??
        null,
    );
  }, [items, mountedWeaponId, selectedItemId]);

  const handleItemClick = (item: ShopCarouselItemModel) => {
    setSelectedItemId(item.id);
    props.onItemClick?.(item);
  };

  const selectedItem =
    (selectedItemId
      ? items.find((item) => item.id === selectedItemId)
      : undefined) ??
    items.find((item) => item.id === mountedWeaponId) ??
    items[0] ??
    null;

  const weapon = selectedItem ? WEAPONS[selectedItem.id] : undefined;
  const title = useTypewriter(weapon?.name ?? "", 25, {
    restartKey: weapon?.id ?? "none",
  });
  const description = useTypewriter(weapon?.description ?? "", 15, {
    offset: 500,
    restartKey: weapon?.id ?? "none",
  });
  const weaponFits = weapon
    ? canWeaponFitShip(weapon, props.selectedShip)
    : true;
  const previewLoadout = useMemo(
    () =>
      buildWeaponPreviewLoadout(
        props.save,
        props.selectedShip,
        selectedItem?.id ?? null,
      ),
    [props.save, props.selectedShip, selectedItem?.id],
  );

  if (!selectedItem) {
    return null;
  }

  const action = !selectedItem.owned
    ? "Buy"
    : selectedItem.equipped
      ? "Equipped"
      : "Equip";
  const actionDisabled = Boolean(selectedItem.owned && selectedItem.equipped);

  return (
    <div className={styles["weapons-area"]}>
      <ShopTopCarousel>
        {items.map((item) => {
          return (
            <ShopCarouselItem
              accentColor={item.accentColor}
              equipped={item.equipped}
              kind="weapon"
              key={`${item.kind}-${item.id}`}
              meta={item.owned ? "Owned" : item.costLabel}
              name={item.name}
              onClick={() => handleItemClick(item)}
              owned={item.owned}
              selected={item.id === selectedItem.id}
              shape={item.shape}
            />
          );
        })}
      </ShopTopCarousel>
      <WeaponPreviewStageView
        action={action}
        actionDisabled={actionDisabled}
        description={weapon?.description ?? ""}
        effects={weapon ? describeWeaponEffectTags(weapon) : []}
        fitsCurrentShip={weapon ? weaponFits : true}
        onAction={() => props.onAction?.(selectedItem)}
        previewLoadout={previewLoadout}
        sizeLabel={weapon ? getWeaponSizeLabel(weapon) : "-"}
        stats={weapon ? getWeaponPreviewStats(weapon) : getEmptyWeaponStats()}
        title={title}
        visibleDescription={description}
      />
    </div>
  );
}
