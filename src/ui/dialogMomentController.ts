import type { DialogMomentView } from "./dialogMomentState";
import type Phaser from "phaser";

import { signal } from "@preact/signals";

import {
  normalizeDialogMomentPayloads,
  type DialogMomentInput,
  type DialogMomentPayload,
  UI_DIALOG_MOMENT_EVENT,
  UI_DIALOG_MOMENT_WINDOW_EVENT,
} from "./dialogMoment";

export class DialogMomentController {
  private readonly game: Phaser.Game;
  private queue: DialogMomentPayload[] = [];
  private sequence = 0;
  private transitionSequence = 0;
  readonly signal = signal<DialogMomentView | null>(null);

  constructor(game: Phaser.Game) {
    this.game = game;
    this.game.events.on(UI_DIALOG_MOMENT_EVENT, this.handleGameDialogMoment);
    if (typeof window !== "undefined") {
      window.addEventListener(
        UI_DIALOG_MOMENT_WINDOW_EVENT,
        this.handleWindowDialogMoment as EventListener,
      );
    }
  }

  dispose(): void {
    this.game.events.off(UI_DIALOG_MOMENT_EVENT, this.handleGameDialogMoment);
    this.queue.length = 0;
    this.signal.value = null;
    if (typeof window !== "undefined") {
      window.removeEventListener(
        UI_DIALOG_MOMENT_WINDOW_EVENT,
        this.handleWindowDialogMoment as EventListener,
      );
    }
  }

  show(request: DialogMomentInput): void {
    this.queue = normalizeDialogMomentPayloads(request);
    this.showNext();
  }

  complete(momentKey: string): void {
    const current = this.signal.value;
    if (current?.key !== momentKey) return;
    this.showNext();
  }

  shouldTransitionOut(momentKey: string): boolean {
    const current = this.signal.value;
    if (current?.key !== momentKey) return false;
    const next = this.queue[0];
    if (!next) return true;
    return !(
      current.characterId &&
      next.characterId &&
      current.characterId === next.characterId
    );
  }

  private showNext(): void {
    const current = this.signal.value;
    const next = this.queue.shift();
    if (!next) {
      this.signal.value = null;
      return;
    }
    const sameCharacter =
      Boolean(current?.characterId) &&
      Boolean(next.characterId) &&
      current?.characterId === next.characterId;
    this.sequence += 1;
    const transitionKey =
      sameCharacter && current
        ? current.transitionKey
        : String(++this.transitionSequence);
    this.signal.value = {
      characterId: next.characterId,
      durationMs: next.durationMs,
      expression: next.expression,
      key: String(this.sequence),
      placement: next.placement,
      text: next.text,
      transition: next.transition,
      transitionKey,
    };
  }

  private handleGameDialogMoment = (payload: DialogMomentInput): void => {
    this.show(payload);
  };

  private handleWindowDialogMoment = (event: Event): void => {
    const customEvent = event as CustomEvent<DialogMomentInput | undefined>;
    if (!customEvent.detail) return;
    this.show(customEvent.detail);
  };
}
