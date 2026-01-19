import Phaser from 'phaser';

export interface HudStatus {
  hp: number;
  maxHp: number;
  gold: number;
  wave: number;
  boss?: {
    hp: number;
    maxHp: number;
    timeSec: number;
  };
}

export class HUD {
  private shopButton: Phaser.GameObjects.Text;
  private pauseButton: Phaser.GameObjects.Text;
  private bounds: Phaser.Geom.Rectangle;

  constructor(
    scene: Phaser.Scene,
    onShop: () => void,
    onPause: () => void,
    bounds: Phaser.Geom.Rectangle,
  ) {
    this.bounds = bounds;

    this.shopButton = scene.add.text(0, 0, 'Shop', {
      backgroundColor: '#0f1624',
      color: '#ffd166',
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      padding: { x: 8, y: 4 },
    }).setOrigin(1, 0);
    this.shopButton.setInteractive({ useHandCursor: true }).on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const nativeEvent = pointer.event as PointerEvent | TouchEvent;
      if (nativeEvent instanceof TouchEvent) nativeEvent.preventDefault();
      onShop();
    });

    this.pauseButton = scene.add.text(0, 0, 'Pause', {
      backgroundColor: '#0f1624',
      color: '#7df9ff',
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      padding: { x: 8, y: 4 },
    }).setOrigin(0, 0);
    this.pauseButton.setInteractive({ useHandCursor: true }).on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const nativeEvent = pointer.event as PointerEvent | TouchEvent;
      if (nativeEvent instanceof TouchEvent) nativeEvent.preventDefault();
      onPause();
    });

    this.setBounds(bounds);
  }

  setBounds(bounds: Phaser.Geom.Rectangle): void {
    this.bounds = bounds;
    const padding = 12;
    const left = bounds.x + padding;
    const right = bounds.x + bounds.width - padding;
    const top = bounds.y + padding;
    this.shopButton.setPosition(right, top + 6);
    this.pauseButton.setPosition(left, top + 6);
  }

  setStatus(status: HudStatus): void {
    void status;
  }
}
