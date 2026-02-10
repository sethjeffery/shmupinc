import Phaser from "phaser";

import { BootScene } from "./scenes/BootScene";
import { PLAYFIELD_BASE_HEIGHT, PLAYFIELD_BASE_WIDTH } from "./util/playArea";

const GAME_BACKGROUND = "#05060a";

export function createGame(): Phaser.Game {
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
      max: { height: PLAYFIELD_BASE_HEIGHT, width: PLAYFIELD_BASE_WIDTH },
      mode: Phaser.Scale.FIT,
      width: PLAYFIELD_BASE_WIDTH,
    },
    scene: [BootScene],
    type: Phaser.AUTO,
  };

  return new Phaser.Game(config);
}
