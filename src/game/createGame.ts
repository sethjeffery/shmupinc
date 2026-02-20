import Phaser from "phaser";

import { BootScene } from "./scenes/BootScene";
import { PLAYFIELD_BASE_HEIGHT, PLAYFIELD_BASE_WIDTH } from "./util/playArea";

const GAME_BACKGROUND = "#05060a";
const MOBILE_COVER_QUERY = "(max-width: 900px) and (pointer: coarse)";

export const shouldUseMobileCoverScale = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia(MOBILE_COVER_QUERY).matches;

export function createGame(): Phaser.Game {
  const scaleMode = shouldUseMobileCoverScale()
    ? Phaser.Scale.ENVELOP
    : Phaser.Scale.FIT;
  const config: Phaser.Types.Core.GameConfig = {
    backgroundColor: GAME_BACKGROUND,
    fps: {
      smoothStep: false,
    },
    parent: "app",
    render: {
      antialias: true,
      pixelArt: true,
    },
    scale: {
      autoCenter: Phaser.Scale.CENTER_BOTH,
      height: PLAYFIELD_BASE_HEIGHT,
      mode: scaleMode,
      width: PLAYFIELD_BASE_WIDTH,
    },
    scene: [BootScene],
    type: Phaser.AUTO,
  };

  return new Phaser.Game(config);
}
