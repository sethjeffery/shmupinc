import type { ModInstanceId } from "../../data/modInstances";
import type { MountAssignment, SaveData } from "../../data/save";
import type { ShipDefinition } from "../../data/shipTypes";
import type { WeaponInstanceId } from "../../data/weaponInstances";
import type { BuildNodeIconOptions } from "../../scenes/ShopScene";

import { clsx } from "clsx";
import { type ComponentChildren } from "preact";

import { MODS, type ModDefinition, type ModIconKind } from "../../data/mods";
import { canMountWeapon } from "../../data/weaponMounts";
import { WEAPONS, type WeaponDefinition } from "../../data/weapons";

import styles from "../../scenes/ShopScene.module.css";

type LoadoutNodeSelection =
  | { kind: "mod"; mountId: string; slotIndex: number }
  | { kind: "mount"; mountId: string };

export default function LoadoutPanel(props: {
  ship: ShipDefinition;
  assignments: MountAssignment[];
  selection: LoadoutNodeSelection | null;
  save: SaveData;
  onClearModSlot: (mountId: string, slotIndex: number) => void;
  onClearMountWeapon: (mountId: string) => void;
  onEquipMod: (
    mountId: string,
    slotIndex: number,
    instanceId: ModInstanceId,
  ) => void;
  onEquipWeapon: (mountId: string, instanceId: WeaponInstanceId) => void;
  buildNodeIcon: (
    kind: string,
    options: BuildNodeIconOptions,
  ) => ComponentChildren;
  describeWeaponNodeMeta: (
    weapon: WeaponDefinition,
    assignment: MountAssignment,
  ) => string;
  describeModEffects: (mod: ModDefinition) => string;
  getModAccentColor: (iconKind: ModIconKind) => number;
}) {
  const { assignments, save, selection, ship } = props;

  if (!selection) {
    return (
      <div className={styles["shop-node-panel"]}>
        <div className={styles["shop-node-panel-title"]}>Select a node</div>
        <div className={styles["shop-node-panel-hint"]}>
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
      <div className={styles["shop-node-panel"]}>
        <div className={styles["shop-node-panel-title"]}>Node unavailable</div>
        <div className={styles["shop-node-panel-hint"]}>
          Select another node.
        </div>
      </div>
    );
  }

  if (selection.kind === "mount") {
    const currentInstance = assignment.weaponInstanceId
      ? save.ownedWeapons.find(
          (item) => item.id === assignment.weaponInstanceId,
        )
      : null;

    const compatible = save.ownedWeapons
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
        <div className={styles["shop-empty"]}>
          No compatible weapons owned. Buy in Weapons.
        </div>
      ) : (
        compatible.map((instance) => {
          const weapon = WEAPONS[instance.weaponId];
          if (!weapon) return null;
          return (
            <button
              className={clsx(
                styles["shop-node-option"],
                currentInstance?.id === instance.id
                  ? styles["is-current"]
                  : undefined,
              )}
              key={`weapon-node-option-${instance.id}`}
              onClick={() => props.onEquipWeapon(mount.id, instance.id)}
              type="button"
            >
              {props.buildNodeIcon("gun", {
                accentColor: weapon.stats.bullet.color ?? 0x7df9ff,
                className: styles["shop-node-option-icon"],
                gunId: weapon.gunId,
                size: 100,
                weaponSize: weapon.size,
              })}
              <span className={styles["shop-node-option-label"]}>
                {weapon.name}
              </span>
              <span className={styles["shop-node-option-meta"]}>
                {props.describeWeaponNodeMeta(weapon, assignment)}
              </span>
            </button>
          );
        })
      );

    return (
      <div className={styles["shop-node-panel"]}>
        <div
          className={styles["shop-node-panel-title"]}
        >{`${mount.id.toUpperCase()} weapon`}</div>
        <div className={styles["shop-node-panel-options"]}>
          {optionsContent}
        </div>
        <div className={styles["shop-node-panel-footer"]}>
          <button
            className={styles["shop-node-clear"]}
            disabled={!currentInstance}
            onClick={() => props.onClearMountWeapon(mount.id)}
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
    ? save.ownedMods.find((item) => item.id === currentModId)
    : null;
  const currentMod = currentModInstance ? MODS[currentModInstance.modId] : null;

  if (!assignment.weaponInstanceId) {
    return (
      <div className={styles["shop-node-panel"]}>
        <div
          className={styles["shop-node-panel-title"]}
        >{`${mount.id.toUpperCase()} mod ${selection.slotIndex + 1}`}</div>
        <div className={styles["shop-node-panel-hint"]}>
          Mount a weapon first.
        </div>
      </div>
    );
  }

  const reservedKinds = new Set(
    assignment.modInstanceIds
      .filter((_instanceId, index) => index !== selection.slotIndex)
      .map((instanceId) =>
        save.ownedMods.find((entry) => entry.id === instanceId),
      )
      .map((instance) => (instance ? MODS[instance.modId] : null))
      .filter((mod): mod is ModDefinition => Boolean(mod))
      .map((mod) => mod.iconKind),
  );

  const candidates = save.ownedMods.filter((instance) => {
    if (instance.id === currentModId) return true;
    const mod = MODS[instance.modId];
    if (!mod) return false;
    return !reservedKinds.has(mod.iconKind);
  });

  const optionContent =
    candidates.length === 0 ? (
      <div className={styles["shop-empty"]}>No compatible mods available.</div>
    ) : (
      candidates.map((instance) => {
        const mod = MODS[instance.modId];
        if (!mod) return null;
        return (
          <button
            className={clsx(
              styles["shop-node-option"],
              currentModId === instance.id ? styles["is-current"] : undefined,
            )}
            key={`mod-node-option-${instance.id}`}
            onClick={() =>
              props.onEquipMod(mount.id, selection.slotIndex, instance.id)
            }
            type="button"
          >
            {props.buildNodeIcon("mod", {
              accentColor: props.getModAccentColor(mod.iconKind),
              className: styles["shop-node-option-icon"],
              iconKind: "mod",
              modVector: mod.icon,
              size: 100,
            })}
            <span className={styles["shop-node-option-label"]}>{mod.name}</span>
            <span className={styles["shop-node-option-meta"]}>
              {props.describeModEffects(mod)}
            </span>
          </button>
        );
      })
    );

  return (
    <div className={styles["shop-node-panel"]}>
      <div
        className={styles["shop-node-panel-title"]}
      >{`${mount.id.toUpperCase()} mod ${selection.slotIndex + 1}`}</div>
      <div className={styles["shop-node-panel-options"]}>{optionContent}</div>
      <div className={styles["shop-node-panel-footer"]}>
        <button
          className={styles["shop-node-clear"]}
          disabled={!currentMod}
          onClick={() => props.onClearModSlot(mount.id, selection.slotIndex)}
          type="button"
        >
          Unequip Mod
        </button>
      </div>
    </div>
  );
}
