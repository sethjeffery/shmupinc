import type { SoundContent } from "./schemas";

import { getAudioDirector } from "../game/audio/audioDirector";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

interface SoundPreviewPlayOptions {
  gainScale?: number;
  semitoneOffset?: number;
}

export class ProceduralSoundPreviewPlayer {
  private activeStops: (() => void)[] = [];

  play(sound: SoundContent, options?: SoundPreviewPlayOptions): void {
    this.stop();
    const stop = getAudioDirector().playPreviewSound(sound, {
      gainScale: clamp(options?.gainScale ?? 1, 0, 2.5),
      pitchSemitones: options?.semitoneOffset ?? 0,
    });
    this.activeStops.push(stop);
  }

  stop(): void {
    for (const stop of this.activeStops) {
      stop();
    }
    this.activeStops = [];
  }
}
