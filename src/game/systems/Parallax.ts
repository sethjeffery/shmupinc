import Phaser from 'phaser';

interface Star {
  x: number;
  y: number;
  size: number;
  alpha: number;
  stretch: boolean;
}

interface ParallaxLayer {
  speed: number;
  color: number;
  stars: Star[];
  gfx: Phaser.GameObjects.Graphics;
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export class ParallaxBackground {
  private scene: Phaser.Scene;
  private layers: ParallaxLayer[] = [];
  private bounds: Phaser.Geom.Rectangle;

  constructor(scene: Phaser.Scene, bounds?: Phaser.Geom.Rectangle) {
    this.scene = scene;
    this.bounds = bounds
      ? new Phaser.Geom.Rectangle(bounds.x, bounds.y, bounds.width, bounds.height)
      : new Phaser.Geom.Rectangle(0, 0, scene.scale.width, scene.scale.height);
    this.createLayers();
  }

  setBounds(bounds: Phaser.Geom.Rectangle): void {
    this.bounds.setTo(bounds.x, bounds.y, bounds.width, bounds.height);
    for (const layer of this.layers) {
      for (const star of layer.stars) {
        star.x = randRange(0, this.bounds.width);
        star.y = randRange(0, this.bounds.height);
      }
    }
  }

  update(delta: number): void {
    const { height, width, x, y } = this.bounds;
    for (const layer of this.layers) {
      layer.gfx.clear();
      for (const star of layer.stars) {
        star.y += layer.speed * delta;
        if (star.y > height) {
          star.y -= height;
          star.x = randRange(0, width);
        }
        const drawX = x + star.x;
        const drawY = y + star.y;
        if (star.stretch) {
          layer.gfx.lineStyle(1, layer.color, star.alpha);
          layer.gfx.beginPath();
          layer.gfx.moveTo(drawX, drawY - star.size * 2);
          layer.gfx.lineTo(drawX, drawY + star.size * 2);
          layer.gfx.strokePath();
        } else {
          layer.gfx.fillStyle(layer.color, star.alpha);
          layer.gfx.fillCircle(drawX, drawY, star.size);
        }
      }
    }
  }

  private createLayers(): void {
    const { height, width } = this.bounds;
    const configs = [
      { color: 0x0f1724, count: 28, size: [0.7, 1.2], speed: 18, stretchChance: 0.1 },
      { color: 0x16263b, count: 24, size: [0.8, 1.6], speed: 36, stretchChance: 0.35 },
      { color: 0x1f3c5e, count: 16, size: [1, 2.4], speed: 62, stretchChance: 0.55 },
    ];

    for (const cfg of configs) {
      const stars: Star[] = [];
      for (let i = 0; i < cfg.count; i += 1) {
        stars.push({
          alpha: randRange(0.35, 0.9),
          size: randRange(cfg.size[0], cfg.size[1]),
          stretch: Math.random() < cfg.stretchChance,
          x: randRange(0, width),
          y: randRange(0, height),
        });
      }
      const gfx = this.scene.add.graphics();
      gfx.setDepth(-10);
      gfx.setBlendMode(Phaser.BlendModes.ADD);
      this.layers.push({ color: cfg.color, gfx, speed: cfg.speed, stars });
    }
  }
}
