import type { VectorShape } from "../../data/vectorShape";
import type { CardIconKind } from "./iconPainter";

export interface ReadyShipChoiceModel {
  accentColor: number;
  id: string;
  isActive: boolean;
  name: string;
  shape: VectorShape;
}

export interface ReadyMountSelectionModel {
  kind: "mount";
  mountId: string;
}

export interface ReadyModSelectionModel {
  kind: "mod";
  mountId: string;
  slotIndex: number;
}

export type ReadySelectionModel =
  | ReadyModSelectionModel
  | ReadyMountSelectionModel;

export interface ReadySlotModel {
  accentColor: number;
  disabled?: boolean;
  id: string;
  isActive: boolean;
  isEmpty: boolean;
  kind: CardIconKind;
  label: string;
  selection: ReadySelectionModel;
  shape: VectorShape;
}

export interface ReadyMountRowModel {
  id: string;
  label: string;
  modSlots: readonly ReadySlotModel[];
  weaponSlot: ReadySlotModel;
}
