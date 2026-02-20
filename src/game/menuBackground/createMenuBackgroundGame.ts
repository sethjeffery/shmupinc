import Phaser from "phaser";

import { MenuAttractBootScene } from "../scenes/MenuAttractBootScene";
import { MenuAttractScene } from "../scenes/MenuAttractScene";

export const createMenuBackgroundGame = (
  parent: string | HTMLElement,
): Phaser.Game => {
  const initialWidth =
    typeof window === "undefined" ? 1280 : Math.max(1, window.innerWidth);
  const initialHeight =
    typeof window === "undefined" ? 720 : Math.max(1, window.innerHeight);

  const config: Phaser.Types.Core.GameConfig = {
    backgroundColor: "#04060a",
    fps: {
      smoothStep: false,
    },
    parent,
    render: {
      antialias: true,
      pixelArt: true,
    },
    scale: {
      autoCenter: Phaser.Scale.CENTER_BOTH,
      height: initialHeight,
      mode: Phaser.Scale.RESIZE,
      width: initialWidth,
    },
    scene: [MenuAttractBootScene, MenuAttractScene],
    type: Phaser.AUTO,
  };

  return new Phaser.Game(config);
};
