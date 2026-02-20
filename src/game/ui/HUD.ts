import Phaser from "phaser";

interface HudStatus {
  hp: number;
  maxHp: number;
  gold: number;
  wave: number;
  lowHealthState?: "critical" | "warning";
  boss?: {
    hp: number;
    maxHp: number;
    timeSec: number;
  };
}

const CHIP_FONT = "Orbitron, Arial, sans-serif";
const HUD_DEPTH = 20;
const BOSS_DEPTH = 21;
const BUTTON_DEPTH = 22;

export class HUD {
  private scene: Phaser.Scene;
  private gfx: Phaser.GameObjects.Graphics;
  private bossGfx: Phaser.GameObjects.Graphics;
  private pauseButton: Phaser.GameObjects.Text;
  private goldValue: Phaser.GameObjects.Text;
  private bossLabel: Phaser.GameObjects.Text;
  private status: HudStatus = {
    gold: 0,
    hp: 1,
    maxHp: 1,
    wave: 0,
  };
  private bounds = new Phaser.Geom.Rectangle();

  constructor(
    scene: Phaser.Scene,
    _onShop: () => void,
    onPause: () => void,
    bounds: Phaser.Geom.Rectangle,
  ) {
    this.scene = scene;
    this.gfx = scene.add.graphics();
    this.gfx.setDepth(HUD_DEPTH);
    this.bossGfx = scene.add.graphics();
    this.bossGfx.setDepth(BOSS_DEPTH);

    this.pauseButton = this.createButton("PAUSE", "#7df9ff", onPause).setOrigin(
      0,
      0.5,
    );

    this.goldValue = scene.add
      .text(0, 0, "$0", {
        color: "#ffd166",
        fontFamily: CHIP_FONT,
        fontSize: "12px",
        fontStyle: "700",
      })
      .setDepth(BUTTON_DEPTH)
      .setOrigin(0.5, 0.5);
    this.bossLabel = scene.add
      .text(0, 0, "", {
        color: "#ff9fb5",
        fontFamily: CHIP_FONT,
        fontSize: "10px",
        fontStyle: "700",
      })
      .setDepth(BUTTON_DEPTH)
      .setOrigin(1, 0.5);

    this.setBounds(bounds);
  }

  setBounds(bounds: Phaser.Geom.Rectangle): void {
    if (
      this.bounds.x === bounds.x &&
      this.bounds.y === bounds.y &&
      this.bounds.width === bounds.width &&
      this.bounds.height === bounds.height
    ) {
      return;
    }
    this.bounds.setTo(bounds.x, bounds.y, bounds.width, bounds.height);
    this.redraw();
  }

  setStatus(status: HudStatus): void {
    this.status = status;
    this.redraw();
  }

  private redraw(): void {
    const stripPaddingX = 10;
    const stripPaddingY = 10;
    const stripHeight = 36;
    const stripX = this.bounds.x + stripPaddingX;
    const stripY = this.bounds.y + stripPaddingY;
    const stripW = this.bounds.width - stripPaddingX * 2;

    const hpRatio = Phaser.Math.Clamp(
      this.status.hp / Math.max(1, this.status.maxHp),
      0,
      1,
    );

    this.gfx.clear();
    this.gfx.fillStyle(0x0b1320, 0.85);
    this.gfx.fillRoundedRect(stripX, stripY, stripW, stripHeight, 10);
    this.gfx.lineStyle(1, 0x27405f, 0.95);
    this.gfx.strokeRoundedRect(stripX, stripY, stripW, stripHeight, 10);

    const buttonY = stripY + stripHeight * 0.5;
    const rightInset = 12;
    const laneGap = 10;

    const pauseX = stripX + stripW - rightInset - this.pauseButton.width;
    this.pauseButton.setPosition(pauseX, buttonY);

    this.goldValue.setText(`$${Math.round(this.status.gold)}`);
    const goldChipW = Phaser.Math.Clamp(this.goldValue.width + 22, 64, 108);
    const goldChipX = pauseX - laneGap - goldChipW * 0.5;
    this.drawInfoChip(goldChipX, buttonY, goldChipW, 18, 0x211e14, 0x6f5a24);
    this.goldValue.setPosition(goldChipX, buttonY);

    const hpRailX = stripX + 12;
    const hpRailRight = goldChipX - goldChipW * 0.5 - laneGap;
    const hpRailW = Math.max(118, hpRailRight - hpRailX);
    const hpRailH = 12;
    const hpRailY = stripY + (stripHeight - hpRailH) * 0.5;
    this.drawHpRail(
      hpRailX,
      hpRailY,
      hpRailW,
      hpRailH,
      hpRatio,
      this.status.lowHealthState,
    );

    this.redrawBoss(stripX, stripY + stripHeight + 6, stripW);
  }

  private redrawBoss(x: number, y: number, w: number): void {
    this.bossGfx.clear();
    const boss = this.status.boss;
    if (!boss) {
      this.bossLabel.setVisible(false);
      return;
    }
    this.bossLabel.setVisible(true);
    const ratio = Phaser.Math.Clamp(boss.hp / Math.max(1, boss.maxHp), 0, 1);
    const h = 12;
    this.bossGfx.fillStyle(0x1a0f17, 0.85);
    this.bossGfx.fillRoundedRect(x, y, w, h, 6);
    this.bossGfx.lineStyle(1, 0x6d2f43, 0.95);
    this.bossGfx.strokeRoundedRect(x, y, w, h, 6);
    this.bossGfx.fillStyle(0xff6f9b, 0.95);
    this.bossGfx.fillRoundedRect(
      x + 1,
      y + 1,
      Math.max((w - 2) * ratio, 2),
      h - 2,
      5,
    );
    this.bossLabel.setText(
      `BOSS ${Math.ceil(boss.hp)}/${Math.ceil(Math.max(1, boss.maxHp))}  T+${boss.timeSec.toFixed(1)}s`,
    );
    this.bossLabel.setPosition(x + w, y - 2);
  }

  private drawHpRail(
    x: number,
    y: number,
    width: number,
    height: number,
    ratio: number,
    lowHealthState?: HudStatus["lowHealthState"],
  ): void {
    this.gfx.fillStyle(0x0e1929, 1);
    this.gfx.fillRoundedRect(x, y, width, height, 5);
    this.gfx.lineStyle(1, 0x325273, 0.95);
    this.gfx.strokeRoundedRect(x, y, width, height, 5);

    const segments = 16;
    const gap = 2;
    const segmentW = (width - gap * (segments + 1)) / segments;
    const fillSegments = Math.round(segments * ratio);
    const isWarning = lowHealthState === "warning";
    const isCritical = lowHealthState === "critical";
    const nowSec = this.scene.time.now / 1000;
    const pulse = 0.65 + 0.35 * Math.sin(nowSec * (isCritical ? 8.5 : 6.2));
    for (let i = 0; i < segments; i += 1) {
      const segX = x + gap + i * (segmentW + gap);
      const segY = y + 2;
      const segH = height - 4;
      if (i < fillSegments) {
        if (isCritical) {
          this.gfx.fillStyle(0xff5f5f, 0.82 + pulse * 0.18);
        } else if (isWarning) {
          this.gfx.fillStyle(0xffb347, 0.88 + pulse * 0.12);
        } else {
          this.gfx.fillStyle(0x53f2b2, 0.95);
        }
      } else {
        this.gfx.fillStyle(0x193246, 0.55);
      }
      this.gfx.fillRect(segX, segY, segmentW, segH);
    }

    if (ratio < 1) {
      const shimmerT = ((this.scene.time.now * 0.0025) % 1) * width;
      const shimmerX = x + shimmerT;
      this.gfx.fillStyle(0xffffff, 0.18);
      this.gfx.fillRect(shimmerX, y + 1, 6, height - 2);
    }
    if (isWarning || isCritical) {
      const color = isCritical ? 0xff5f5f : 0xffb347;
      this.gfx.lineStyle(1.4, color, 0.4 + pulse * 0.4);
      this.gfx.strokeRoundedRect(x - 2, y - 2, width + 4, height + 4, 6);
    }
  }

  private drawInfoChip(
    cx: number,
    cy: number,
    width: number,
    height: number,
    fill: number,
    line: number,
  ): void {
    const x = cx - width * 0.5;
    const y = cy - height * 0.5;
    this.gfx.fillStyle(fill, 0.9);
    this.gfx.fillRoundedRect(x, y, width, height, 8);
    this.gfx.lineStyle(1, line, 0.95);
    this.gfx.strokeRoundedRect(x, y, width, height, 8);
  }

  private createButton(
    label: string,
    color: string,
    onClick: () => void,
  ): Phaser.GameObjects.Text {
    return this.scene.add
      .text(0, 0, label, {
        backgroundColor: "#0e1a2b",
        color,
        fontFamily: CHIP_FONT,
        fontSize: "11px",
        fontStyle: "700",
        padding: { x: 10, y: 6 },
      })
      .setDepth(BUTTON_DEPTH)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        const nativeEvent = pointer.event as PointerEvent | TouchEvent;
        if (nativeEvent instanceof TouchEvent) nativeEvent.preventDefault();
        onClick();
      });
  }
}
