import Phaser from "phaser";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  kind?: "debris" | "dot" | "smoke" | "spark";
  length?: number;
  thickness?: number;
  angle?: number;
  drag?: number;
  grow?: number;
  startSize?: number;
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

function pickColor(colors: number[] | undefined, fallback: number): number {
  if (!colors || colors.length === 0) return fallback;
  const index = Math.floor(Math.random() * colors.length);
  return colors[index] ?? fallback;
}

const MAX_ACTIVE_PARTICLES = 180;
const MAX_ACTIVE_RINGS = 16;

export class ParticleSystem {
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private gfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics();
    this.gfx.setDepth(9);
    this.gfx.setBlendMode(Phaser.BlendModes.ADD);
  }

  spawnBurst(
    x: number,
    y: number,
    count: number,
    color: number,
    priority = false,
  ): void {
    const capped = Math.min(count, 40);
    for (let i = 0; i < capped; i += 1) {
      const angle = randRange(0, Math.PI * 2);
      const speed = randRange(40, 180);
      this.pushParticle(
        {
          color,
          kind: "dot",
          life: randRange(0.35, 0.7),
          maxLife: 0.7,
          size: randRange(1.2, 3.2),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          x,
          y,
        },
        priority,
      );
    }
  }

  spawnTrail(
    x: number,
    y: number,
    color: number,
    sizeMin = 0.8,
    sizeMax = 1.6,
    count = 1,
    priority = false,
  ): void {
    for (let i = 0; i < count; i += 1) {
      this.pushParticle(
        {
          color,
          kind: "dot",
          life: 0.22,
          maxLife: 0.22,
          size: randRange(sizeMin, sizeMax),
          vx: randRange(-20, 20),
          vy: randRange(-20, 20),
          x,
          y,
        },
        priority,
      );
    }
  }

  spawnSmoke(
    x: number,
    y: number,
    count: number,
    color: number,
    options?: {
      sizeMin?: number;
      sizeMax?: number;
      speedMin?: number;
      speedMax?: number;
      lifeMin?: number;
      lifeMax?: number;
      grow?: number;
      priority?: boolean;
    },
  ): void {
    const sizeMin = options?.sizeMin ?? 1.6;
    const sizeMax = options?.sizeMax ?? 3.2;
    const speedMin = options?.speedMin ?? 10;
    const speedMax = options?.speedMax ?? 35;
    const lifeMin = options?.lifeMin ?? 0.25;
    const lifeMax = options?.lifeMax ?? 0.55;
    const grow = options?.grow ?? 3;
    const priority = options?.priority ?? false;
    const capped = Math.min(count, 18);

    for (let i = 0; i < capped; i += 1) {
      const life = randRange(lifeMin, lifeMax);
      const startSize = randRange(sizeMin, sizeMax);
      const angle = randRange(-Math.PI * 0.72, -Math.PI * 0.28);
      const speed = randRange(speedMin, speedMax);
      this.pushParticle(
        {
          color,
          drag: 0.94,
          grow,
          kind: "smoke",
          life,
          maxLife: life,
          size: startSize,
          startSize,
          vx: Math.cos(angle) * speed + randRange(-8, 8),
          vy: Math.sin(angle) * speed - randRange(0, 8),
          x,
          y,
        },
        priority,
      );
    }
  }

  spawnDebris(
    x: number,
    y: number,
    count: number,
    color: number,
    options?: {
      speedMin?: number;
      speedMax?: number;
      sizeMin?: number;
      sizeMax?: number;
      lifeMin?: number;
      lifeMax?: number;
      drag?: number;
      priority?: boolean;
      angleMin?: number;
      angleMax?: number;
    },
  ): void {
    const speedMin = options?.speedMin ?? 70;
    const speedMax = options?.speedMax ?? 220;
    const sizeMin = options?.sizeMin ?? 1.5;
    const sizeMax = options?.sizeMax ?? 3.3;
    const lifeMin = options?.lifeMin ?? 0.3;
    const lifeMax = options?.lifeMax ?? 0.8;
    const drag = options?.drag ?? 0.95;
    const priority = options?.priority ?? false;
    const angleMin = options?.angleMin ?? 0;
    const angleMax = options?.angleMax ?? Math.PI * 2;
    const capped = Math.min(count, 28);

    for (let i = 0; i < capped; i += 1) {
      const angle = randRange(angleMin, angleMax);
      const speed = randRange(speedMin, speedMax);
      const life = randRange(lifeMin, lifeMax);
      const startSize = randRange(sizeMin, sizeMax);
      this.pushParticle(
        {
          angle,
          color,
          drag,
          kind: "debris",
          life,
          maxLife: life,
          size: startSize,
          startSize,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          x,
          y,
        },
        priority,
      );
    }
  }

  spawnSparks(
    x: number,
    y: number,
    count: number,
    options?: {
      colors?: number[];
      speedMin?: number;
      speedMax?: number;
      lengthMin?: number;
      lengthMax?: number;
      thicknessMin?: number;
      thicknessMax?: number;
      lifeMin?: number;
      lifeMax?: number;
      drag?: number;
      angleMin?: number;
      angleMax?: number;
      priority?: boolean;
    },
  ): void {
    const speedMin = options?.speedMin ?? 120;
    const speedMax = options?.speedMax ?? 260;
    const lengthMin = options?.lengthMin ?? 6;
    const lengthMax = options?.lengthMax ?? 12;
    const thicknessMin = options?.thicknessMin ?? 1;
    const thicknessMax = options?.thicknessMax ?? 1.6;
    const lifeMin = options?.lifeMin ?? 0.18;
    const lifeMax = options?.lifeMax ?? 0.35;
    const angleMin = options?.angleMin ?? 0;
    const angleMax = options?.angleMax ?? Math.PI * 2;
    const drag = options?.drag ?? 0.92;
    const priority = options?.priority ?? false;

    const capped = Math.min(count, 24);
    for (let i = 0; i < capped; i += 1) {
      const angle = randRange(angleMin, angleMax);
      const speed = randRange(speedMin, speedMax);
      const life = randRange(lifeMin, lifeMax);
      this.pushParticle(
        {
          angle,
          color: pickColor(options?.colors, 0xffffff),
          drag,
          kind: "spark",
          length: randRange(lengthMin, lengthMax),
          life,
          maxLife: life,
          size: 1,
          thickness: randRange(thicknessMin, thicknessMax),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          x,
          y,
        },
        priority,
      );
    }
  }

  spawnRing(
    x: number,
    y: number,
    radius: number,
    color: number,
    thickness = 2,
    life = 0.4,
    priority = false,
  ): void {
    this.pushRing(
      {
        color,
        endRadius: radius,
        life,
        maxLife: life,
        startRadius: Math.max(4, radius * 0.1),
        thickness,
        x,
        y,
      },
      priority,
    );
  }

  spawnInward(
    x: number,
    y: number,
    count: number,
    color: number,
    radius: number,
    priority = false,
  ): void {
    const capped = Math.min(count, 12);
    for (let i = 0; i < capped; i += 1) {
      const angle = randRange(0, Math.PI * 2);
      const dist = randRange(radius * 0.6, radius);
      const startX = x + Math.cos(angle) * dist;
      const startY = y + Math.sin(angle) * dist;
      const speed = randRange(40, 120);
      this.pushParticle(
        {
          color,
          life: randRange(0.3, 0.6),
          maxLife: 0.6,
          size: randRange(1, 2),
          vx: ((x - startX) / dist) * speed,
          vy: ((y - startY) / dist) * speed,
          x: startX,
          y: startY,
        },
        priority,
      );
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
      const drag = p.drag ?? 0.98;
      p.vx *= drag;
      p.vy *= drag;
      const alpha = Math.max(0, p.life / p.maxLife);
      if (p.kind === "spark") {
        const angle = p.angle ?? Math.atan2(p.vy, p.vx);
        const halfLen = (p.length ?? 8) * 0.5;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        this.gfx.lineStyle(p.thickness ?? 1, p.color, alpha);
        this.gfx.beginPath();
        this.gfx.moveTo(p.x - cos * halfLen, p.y - sin * halfLen);
        this.gfx.lineTo(p.x + cos * halfLen, p.y + sin * halfLen);
        this.gfx.strokePath();
      } else if (p.kind === "debris") {
        const size = Math.max(
          0.2,
          (p.startSize ?? p.size) * Math.max(0.08, alpha),
        );
        this.gfx.fillStyle(p.color, 0.95);
        this.gfx.fillRect(p.x - size * 0.5, p.y - size * 0.5, size, size);
      } else if (p.kind === "smoke") {
        const size = (p.startSize ?? p.size) + (1 - alpha) * (p.grow ?? 3);
        this.gfx.fillStyle(p.color, alpha * 0.42);
        this.gfx.fillCircle(p.x, p.y, size);
      } else {
        this.gfx.fillStyle(p.color, alpha);
        this.gfx.fillCircle(p.x, p.y, p.size);
      }
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
      const radius =
        ring.startRadius + (ring.endRadius - ring.startRadius) * eased;
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

  private pushParticle(particle: Particle, priority: boolean): void {
    if (this.particles.length >= MAX_ACTIVE_PARTICLES) {
      if (!priority) return;
      this.dropOldestParticle();
    }
    this.particles.push(particle);
  }

  private pushRing(ring: Ring, priority: boolean): void {
    if (this.rings.length >= MAX_ACTIVE_RINGS) {
      if (!priority) return;
      this.dropOldestRing();
    }
    this.rings.push(ring);
  }

  private dropOldestParticle(): void {
    if (this.particles.length === 0) return;
    this.particles[0] = this.particles[this.particles.length - 1];
    this.particles.pop();
  }

  private dropOldestRing(): void {
    if (this.rings.length === 0) return;
    this.rings[0] = this.rings[this.rings.length - 1];
    this.rings.pop();
  }
}
