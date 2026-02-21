import type {
  DialogMomentPlacement,
  DialogMomentTransition,
} from "./dialogMoment";

export interface DialogMomentView {
  characterId?: string;
  durationMs: number;
  expression?: string;
  isTutorial: boolean;
  key: string;
  placement: DialogMomentPlacement;
  text: string;
  transition: DialogMomentTransition;
  transitionKey: string;
}
