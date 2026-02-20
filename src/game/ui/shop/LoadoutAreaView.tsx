import type { ModInstanceId } from "../../data/modInstances";
import type { ModDefinition } from "../../data/modTypes";
import type { MountAssignment, SaveData } from "../../data/save";
import type { ShipId } from "../../data/ships";
import type { ShipDefinition } from "../../data/shipTypes";
import type { WeaponInstanceId } from "../../data/weaponInstances";
import type { WeaponDefinition } from "../../data/weapons";
import type {
  ReadyMountRowModel,
  ReadySelectionModel,
  ReadyShipChoiceModel,
} from "./readyModels";

import { useMemo, useState } from "preact/hooks";

import { GUNS } from "../../data/guns";
import { MODS } from "../../data/mods";
import { SHIPS } from "../../data/ships";
import { canMountWeapon } from "../../data/weaponMounts";
import { WEAPONS } from "../../data/weapons";
import ReadyAreaView from "./ReadyAreaView";
import ShopLoadoutDrawer, {
  type ShopLoadoutDrawerChoice,
} from "./ShopLoadoutDrawer";
import { describeModEffectTags, getModAccentColor } from "./utils/mods";

interface LoadoutCarouselItem {
  accentColor: number;
  id: string;
  instanceId: string;
  isCurrent: boolean;
  kind: "mod" | "weapon";
  meta: string;
  name: string;
}

const isSameSelection = (
  a: null | ReadySelectionModel,
  b: null | ReadySelectionModel,
): boolean => {
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  if (a.mountId !== b.mountId) return false;
  if (a.kind === "mod" && b.kind === "mod") {
    return a.slotIndex === b.slotIndex;
  }
  return true;
};

const resolveSelection = (
  ship: ShipDefinition,
  assignments: readonly MountAssignment[],
  selection: null | ReadySelectionModel,
): null | ReadySelectionModel => {
  if (ship.mounts.length === 0) return null;
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

  const assignment = assignments.find((entry) => entry.mountId === mount.id);
  if (!assignment?.weaponInstanceId) {
    return { kind: "mount", mountId: mount.id };
  }

  const slotIndex = Math.max(
    0,
    Math.min(selection.slotIndex, Math.max(0, mount.modSlots - 1)),
  );
  return { kind: "mod", mountId: mount.id, slotIndex };
};

const getLoadoutShips = (save: SaveData): ShipDefinition[] => {
  const ids = [...save.unlockedShips];
  if (!ids.includes(save.selectedShipId)) {
    ids.push(save.selectedShipId);
  }
  return ids
    .map((id) => SHIPS[id])
    .filter((entry): entry is ShipDefinition => Boolean(entry));
};

const describeWeaponMeta = (weapon: WeaponDefinition): string => {
  const fireRate = Math.max(0.05, weapon.stats.fireRate);
  const damage = Math.max(0, weapon.stats.bullet.damage);
  return `${fireRate.toFixed(1)}/s · ${damage.toFixed(1)} dmg`;
};

const describeModMeta = (mod: ModDefinition): string => {
  const effects = describeModEffectTags(mod);
  return effects.slice(0, 2).join(" · ") || "Passive";
};

export default function LoadoutAreaView(props: {
  onAssignModToSlot: (
    mountId: string,
    slotIndex: number,
    modInstanceId: ModInstanceId,
  ) => void;
  onAssignWeaponToMount: (
    mountId: string,
    weaponInstanceId: WeaponInstanceId,
  ) => void;
  onClearModSlot: (mountId: string, slotIndex: number) => void;
  onDetachWeaponFromMount: (mountId: string) => void;
  onSelectShip: (shipId: ShipId) => void;
  onStartMission: () => void;
  previewRootRef: (element: HTMLDivElement | null) => void;
  save: SaveData;
  selectedShip: ShipDefinition;
}) {
  const assignments =
    props.save.mountedWeapons[props.selectedShip.id] ??
    props.selectedShip.mounts.map((mount) => ({
      modInstanceIds: [],
      mountId: mount.id,
      weaponInstanceId: null,
    }));

  const [selection, setSelection] = useState<null | ReadySelectionModel>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const activeSelection = resolveSelection(
    props.selectedShip,
    assignments,
    selection,
  );
  const drawerSelection = drawerOpen ? activeSelection : null;

  const assignmentById = useMemo(
    () => new Map(assignments.map((entry) => [entry.mountId, entry])),
    [assignments],
  );
  const ownedWeaponById = useMemo(
    () => new Map(props.save.ownedWeapons.map((entry) => [entry.id, entry])),
    [props.save.ownedWeapons],
  );
  const ownedModById = useMemo(
    () => new Map(props.save.ownedMods.map((entry) => [entry.id, entry])),
    [props.save.ownedMods],
  );

  const selectedAssignment = drawerSelection
    ? (assignmentById.get(drawerSelection.mountId) ?? null)
    : null;
  const selectedMount = drawerSelection
    ? (props.selectedShip.mounts.find(
        (entry) => entry.id === drawerSelection.mountId,
      ) ?? null)
    : null;

  const toggleDrawer = (next: ReadySelectionModel): void => {
    if (isSameSelection(activeSelection, next) && drawerOpen) {
      setDrawerOpen(false);
      return;
    }
    setSelection(next);
    setDrawerOpen(true);
  };

  const closeDrawer = (): void => {
    setDrawerOpen(false);
  };

  const shipChoices: ReadyShipChoiceModel[] = getLoadoutShips(props.save).map(
    (ship) => ({
      accentColor: ship.color,
      id: ship.id,
      isActive: ship.id === props.selectedShip.id,
      name: ship.name,
      shape: ship.vector,
    }),
  );

  const mountRows: ReadyMountRowModel[] = props.selectedShip.mounts.map(
    (mount) => {
      const assignment = assignmentById.get(mount.id);
      const weaponInstance = assignment?.weaponInstanceId
        ? ownedWeaponById.get(assignment.weaponInstanceId)
        : null;
      const weapon = weaponInstance ? WEAPONS[weaponInstance.weaponId] : null;

      const weaponSelection: ReadySelectionModel = {
        kind: "mount",
        mountId: mount.id,
      };

      const weaponShape = weapon
        ? (GUNS[weapon.gunId]?.vector ?? props.selectedShip.vector)
        : props.selectedShip.vector;

      const modSlots = Array.from(
        { length: Math.max(0, mount.modSlots) },
        (_unused, slotIndex) => {
          const modSelection: ReadySelectionModel = {
            kind: "mod",
            mountId: mount.id,
            slotIndex,
          };
          const modInstanceId = assignment?.modInstanceIds[slotIndex] ?? null;
          const modInstance = modInstanceId
            ? ownedModById.get(modInstanceId)
            : null;
          const mod = modInstance ? MODS[modInstance.modId] : null;

          return {
            accentColor: mod ? getModAccentColor(mod.iconKind) : 0x6a7a90,
            disabled: !weapon,
            id: `${mount.id}-mod-${slotIndex}`,
            isActive: isSameSelection(drawerSelection, modSelection),
            isEmpty: !mod,
            kind: "mod" as const,
            label: mod?.name ?? `Mod ${slotIndex + 1}`,
            selection: modSelection,
            shape: mod?.icon ?? props.selectedShip.vector,
          };
        },
      );

      return {
        id: mount.id,
        label: mount.id.toUpperCase(),
        modSlots,
        weaponSlot: {
          accentColor: weapon?.stats.bullet.color ?? 0x6a7a90,
          id: `${mount.id}-weapon`,
          isActive: isSameSelection(drawerSelection, weaponSelection),
          isEmpty: !weapon,
          kind: "weapon" as const,
          label: weapon?.name ?? "Empty",
          selection: weaponSelection,
          shape: weaponShape,
        },
      };
    },
  );

  const choices: LoadoutCarouselItem[] = useMemo(() => {
    if (!drawerSelection) return [];
    const assignment = assignments.find(
      (entry) => entry.mountId === drawerSelection.mountId,
    );
    const mount = props.selectedShip.mounts.find(
      (entry) => entry.id === drawerSelection.mountId,
    );
    if (!assignment || !mount) return [];

    if (drawerSelection.kind === "mount") {
      return props.save.ownedWeapons
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
              id: weapon.id,
              instanceId: instance.id,
              isCurrent: assignment.weaponInstanceId === instance.id,
              kind: "weapon" as const,
              meta: describeWeaponMeta(weapon),
              name: weapon.name,
            },
          ];
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    if (!assignment.weaponInstanceId) return [];

    const currentModId =
      assignment.modInstanceIds[drawerSelection.slotIndex] ?? null;
    const reservedKinds = new Set(
      assignment.modInstanceIds
        .filter((_instanceId, index) => index !== drawerSelection.slotIndex)
        .map((instanceId) =>
          props.save.ownedMods.find((entry) => entry.id === instanceId),
        )
        .map((instance) => (instance ? MODS[instance.modId] : null))
        .filter((mod): mod is ModDefinition => Boolean(mod))
        .map((mod) => mod.iconKind),
    );

    return props.save.ownedMods
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
            accentColor: getModAccentColor(mod.iconKind),
            id: mod.id,
            instanceId: instance.id,
            isCurrent: currentModId === instance.id,
            kind: "mod" as const,
            meta: describeModMeta(mod),
            name: mod.name,
          },
        ];
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [
    assignments,
    drawerSelection,
    props.save.ownedMods,
    props.save.ownedWeapons,
    props.selectedShip,
  ]);

  const { onAssignModToSlot, onAssignWeaponToMount, selectedShip } = props;
  const drawerChoices: ShopLoadoutDrawerChoice[] = useMemo(
    () =>
      choices.map((choice) => {
        const weapon = choice.kind === "weapon" ? WEAPONS[choice.id] : null;
        const mod = choice.kind === "mod" ? MODS[choice.id] : null;

        return {
          accentColor: choice.accentColor,
          iconKind: choice.kind,
          id: `${choice.kind}-${choice.instanceId}`,
          isCurrent: choice.isCurrent,
          label: choice.name,
          meta: choice.meta,
          onSelect: () => {
            if (!drawerSelection) return;
            setDrawerOpen(false);
            if (drawerSelection.kind === "mount") {
              setSelection({
                kind: "mount",
                mountId: drawerSelection.mountId,
              });
              onAssignWeaponToMount(drawerSelection.mountId, choice.instanceId);
              return;
            }
            setSelection({
              kind: "mod",
              mountId: drawerSelection.mountId,
              slotIndex: drawerSelection.slotIndex,
            });
            onAssignModToSlot(
              drawerSelection.mountId,
              drawerSelection.slotIndex,
              choice.instanceId,
            );
          },
          shape:
            choice.kind === "weapon"
              ? weapon
                ? (GUNS[weapon.gunId]?.vector ?? selectedShip.vector)
                : selectedShip.vector
              : (mod?.icon ?? selectedShip.vector),
        };
      }),
    [
      choices,
      drawerSelection,
      onAssignModToSlot,
      onAssignWeaponToMount,
      selectedShip,
    ],
  );

  const canClear = Boolean(
    drawerSelection &&
    selectedAssignment &&
    (drawerSelection.kind === "mount"
      ? selectedAssignment.weaponInstanceId
      : selectedAssignment.modInstanceIds[drawerSelection.slotIndex]),
  );

  const drawerTitle = selectedMount
    ? drawerSelection?.kind === "mount"
      ? `${selectedMount.id.toUpperCase()} weapon`
      : drawerSelection
        ? `${selectedMount.id.toUpperCase()} mod ${drawerSelection.slotIndex + 1}`
        : "Mount configuration"
    : "Mount configuration";

  return (
    <ReadyAreaView
      drawer={
        <ShopLoadoutDrawer
          blockedMessage={
            drawerSelection?.kind === "mod" &&
            !selectedAssignment?.weaponInstanceId
              ? "Equip a weapon on this mount before adding mods."
              : null
          }
          canClear={canClear}
          choices={drawerChoices}
          clearLabel={
            drawerSelection?.kind === "mount"
              ? "Unequip weapon"
              : "Clear mod slot"
          }
          emptyMessage="No compatible items available."
          onClear={() => {
            if (!drawerSelection) return;
            setDrawerOpen(false);
            if (drawerSelection.kind === "mount") {
              props.onDetachWeaponFromMount(drawerSelection.mountId);
              return;
            }
            props.onClearModSlot(
              drawerSelection.mountId,
              drawerSelection.slotIndex,
            );
          }}
          onClose={closeDrawer}
          open={Boolean(drawerSelection && drawerOpen)}
          title={drawerTitle}
        />
      }
      mountRows={mountRows}
      onSelectShip={props.onSelectShip}
      onSelectSlot={(slot) => toggleDrawer(slot.selection)}
      onStartMission={props.onStartMission}
      previewRootRef={props.previewRootRef}
      shipChoices={shipChoices}
      shipName={props.selectedShip.name}
    />
  );
}
