import type Phaser from "phaser";

export type DialogMomentPlacement = "bottom" | "top";
export type DialogMomentTransition = "smooth" | "urgent" | "wham";

export interface DialogMomentRequest {
  characterId?: string;
  durationMs?: number;
  expression?: string;
  placement?: DialogMomentPlacement;
  text: string;
  transition?: DialogMomentTransition;
}

export type DialogMomentInput = DialogMomentRequest | DialogMomentRequest[];

export interface DialogMomentPayload {
  characterId?: string;
  durationMs: number;
  expression?: string;
  placement: DialogMomentPlacement;
  text: string;
  transition: DialogMomentTransition;
}

export const UI_DIALOG_MOMENT_EVENT = "ui:dialog-moment";
export const UI_DIALOG_MOMENT_WINDOW_EVENT = "ui:dialog-moment:window";
export const UI_DIALOG_MOMENT_DEFAULT_DURATION_MS = 2600;
export const UI_DIALOG_MOMENT_EXIT_MS = 220;

export const normalizeDialogMomentPayload = (
  request: DialogMomentRequest,
): DialogMomentPayload => ({
  ...request,
  durationMs:
    request.durationMs ?? Math.max(request.text.length * 100 + 500, 2000),
  placement: request.placement ?? "top",
  transition: request.transition ?? "smooth",
});

export const normalizeDialogMomentPayloads = (
  request: DialogMomentInput,
): DialogMomentPayload[] => {
  const source = Array.isArray(request) ? request : [request];
  return source
    .map((entry) => normalizeDialogMomentPayload(entry))
    .map((entry) => ({
      ...entry,
      text: entry.text.trim(),
    }))
    .filter((entry) => entry.text.length > 0);
};

export const showDialogMoment = (
  request: DialogMomentInput,
  game?: Phaser.Game,
): void => {
  if (game) {
    game.events.emit(UI_DIALOG_MOMENT_EVENT, request);
    return;
  }
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<DialogMomentInput>(UI_DIALOG_MOMENT_WINDOW_EVENT, {
      detail: request,
    }),
  );
};
