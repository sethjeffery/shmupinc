import Phaser from 'phaser';

import { BootScene } from './scenes/BootScene';
import { PlayScene } from './scenes/PlayScene';
import { ShopScene } from './scenes/ShopScene';

const GAME_BACKGROUND = '#05060a';

export function createGame(): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    backgroundColor: GAME_BACKGROUND,
    fps: {
      smoothStep: false,
    },
    parent: 'app',
    render: {
      antialias: true,
      pixelArt: true,
    },
    scale: {
      autoCenter: Phaser.Scale.CENTER_BOTH,
      height: window.innerHeight,
      mode: Phaser.Scale.RESIZE,
      width: window.innerWidth,
    },
    scene: [BootScene],
    type: Phaser.AUTO,
  };

  const game = new Phaser.Game(config);
  game.scene.add('PlayScene', PlayScene, false);
  game.scene.add('ShopScene', ShopScene, false);
  return game;
}
