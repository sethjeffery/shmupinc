import Phaser from 'phaser';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
}

interface Ring {
  x: number;
  y: number;
  startRadius: number;
  endRadius: number;
  life: number;
  maxLife: number;
  thickness: number;
  color: number;
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private gfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics();
    this.gfx.setDepth(9);
    this.gfx.setBlendMode(Phaser.BlendModes.ADD);
  }

  spawnBurst(x: number, y: number, count: number, color: number): void {
    const capped = Math.min(count, 40);
    for (let i = 0; i < capped; i += 1) {
      const angle = randRange(0, Math.PI * 2);
      const speed = randRange(40, 180);
      this.particles.push({
        color,
        life: randRange(0.35, 0.7),
        maxLife: 0.7,
        size: randRange(1.2, 3.2),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        x,
        y,
      });
    }
  }

  spawnTrail(
    x: number,
    y: number,
    color: number,
    sizeMin = 0.8,
    sizeMax = 1.6,
    count = 1,
  ): void {
    for (let i = 0; i < count; i += 1) {
      this.particles.push({
        color,
        life: 0.22,
        maxLife: 0.22,
        size: randRange(sizeMin, sizeMax),
        vx: randRange(-20, 20),
        vy: randRange(-20, 20),
        x,
        y,
      });
    }
  }

  spawnRing(
    x: number,
    y: number,
    radius: number,
    color: number,
    thickness = 2,
    life = 0.4,
  ): void {
    this.rings.push({
      color,
      endRadius: radius,
      life,
      maxLife: life,
      startRadius: Math.max(4, radius * 0.1),
      thickness,
      x,
      y,
    });
  }

  spawnInward(x: number, y: number, count: number, color: number, radius: number): void {
    const capped = Math.min(count, 12);
    for (let i = 0; i < capped; i += 1) {
      const angle = randRange(0, Math.PI * 2);
      const dist = randRange(radius * 0.6, radius);
      const startX = x + Math.cos(angle) * dist;
      const startY = y + Math.sin(angle) * dist;
      const speed = randRange(40, 120);
      this.particles.push({
        color,
        life: randRange(0.3, 0.6),
        maxLife: 0.6,
        size: randRange(1, 2),
        vx: ((x - startX) / dist) * speed,
        vy: ((y - startY) / dist) * speed,
        x: startX,
        y: startY,
      });
    }
  }

  update(delta: number): void {
    this.gfx.clear();
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= delta;
      if (p.life <= 0) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vx *= 0.98;
      p.vy *= 0.98;
      const alpha = Math.max(0, p.life / p.maxLife);
      this.gfx.fillStyle(p.color, alpha);
      this.gfx.fillCircle(p.x, p.y, p.size);
    }
    for (let i = this.rings.length - 1; i >= 0; i -= 1) {
      const ring = this.rings[i];
      ring.life -= delta;
      if (ring.life <= 0) {
        this.rings[i] = this.rings[this.rings.length - 1];
        this.rings.pop();
        continue;
      }
      const progress = 1 - ring.life / ring.maxLife;
      const eased = this.easeOutCubic(progress);
      const radius = ring.startRadius + (ring.endRadius - ring.startRadius) * eased;
      const alpha = Math.max(0, 1 - progress);
      this.gfx.lineStyle(ring.thickness, ring.color, alpha);
      this.gfx.strokeCircle(ring.x, ring.y, radius);
    }
  }

  private easeOutCubic(t: number): number {
    const clamped = Math.min(1, Math.max(0, t));
    const inv = 1 - clamped;
    return 1 - inv * inv * inv;
  }
}
