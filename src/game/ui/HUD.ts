import Phaser from "phaser";

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
  private hpBar: Phaser.GameObjects.Graphics;
  private hpRatio = 1;
  private hpBarX = 0;
  private hpBarY = 0;
  private hpBarWidth = 0;
  private hpBarHeight = 0;
  private shopButton: Phaser.GameObjects.Text;
  private pauseButton: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    onShop: () => void,
    onPause: () => void,
    bounds: Phaser.Geom.Rectangle,
  ) {
    this.hpBar = scene.add.graphics();
    this.hpBar.setDepth(20);
    this.shopButton = scene.add
      .text(0, 0, "Shop", {
        backgroundColor: "#0f1624",
        color: "#ffd166",
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0);
    this.shopButton
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        const nativeEvent = pointer.event as PointerEvent | TouchEvent;
        if (nativeEvent instanceof TouchEvent) nativeEvent.preventDefault();
        onShop();
      });

    this.pauseButton = scene.add
      .text(0, 0, "Pause", {
        backgroundColor: "#0f1624",
        color: "#7df9ff",
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0, 0);
    this.pauseButton
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        const nativeEvent = pointer.event as PointerEvent | TouchEvent;
        if (nativeEvent instanceof TouchEvent) nativeEvent.preventDefault();
        onPause();
      });

    this.setBounds(bounds);
  }

  setBounds(bounds: Phaser.Geom.Rectangle): void {
    const padding = 12;
    const barInset = 12;
    const left = bounds.x + padding;
    const right = bounds.x + bounds.width - padding;
    const top = bounds.y + padding;
    this.hpBarX = bounds.x + barInset;
    this.hpBarY = top + 2;
    this.hpBarWidth = bounds.width - barInset * 2;
    this.hpBarHeight = 4;
    this.redrawHpBar();
    this.shopButton.setPosition(right, top + 14);
    this.pauseButton.setPosition(left, top + 14);
  }

  setStatus(status: HudStatus): void {
    const ratio = Phaser.Math.Clamp(
      status.hp / Math.max(status.maxHp, 1),
      0,
      1,
    );
    if (Math.abs(ratio - this.hpRatio) > 0.002) {
      this.hpRatio = ratio;
      this.redrawHpBar();
    }
  }

  private redrawHpBar(): void {
    const radius = this.hpBarHeight / 2;
    this.hpBar.clear();
    this.hpBar.lineStyle(1, 0x2b415f, 0.8);
    this.hpBar.fillStyle(0x121926, 0.85);
    this.hpBar.fillRoundedRect(
      this.hpBarX,
      this.hpBarY,
      this.hpBarWidth,
      this.hpBarHeight,
      radius,
    );
    this.hpBar.strokeRoundedRect(
      this.hpBarX,
      this.hpBarY,
      this.hpBarWidth,
      this.hpBarHeight,
      radius,
    );
    const fillWidth = this.hpBarWidth * this.hpRatio;
    if (fillWidth > 0.5) {
      this.hpBar.fillStyle(0x5df5a8, 1);
      this.hpBar.fillRoundedRect(
        this.hpBarX,
        this.hpBarY,
        Math.max(fillWidth, radius * 2),
        this.hpBarHeight,
        radius,
      );
    }
  }
}
