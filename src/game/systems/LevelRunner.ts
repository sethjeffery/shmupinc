import type { EnemyId } from "../data/enemyTypes";
import type { LevelConversationMoment, LevelDefinition } from "../data/levels";
import type { EnemyOverride } from "../data/waves";
import type Phaser from "phaser";

import { CONTACT_DAMAGE_PER_SEC } from "./combatConstants";
import { getDebugFlags } from "./DebugFlags";
import { createHazard, type Hazard, type PlayerSnapshot } from "./hazards";
import { WaveScheduler } from "./WaveScheduler";

interface LevelRunnerContext {
  scene: Phaser.Scene;
  getPlayArea: () => Phaser.Geom.Rectangle;
  spawnEnemy: (
    enemyId: EnemyId,
    x: number,
    y: number,
    hpMultiplier: number,
    overrides?: EnemyOverride,
  ) => void;
  getEnemyCount: () => number;
  isEnemyActive: (enemyId: EnemyId) => boolean;
  getPlayerState: () => {
    x: number;
    y: number;
    radius: number;
    alive: boolean;
  };
  applyContactDamage: (amount: number, fxX?: number, fxY?: number) => void;
  pushPlayer: (
    offsetX: number,
    offsetY: number,
    fxColor?: number,
    fxX?: number,
    fxY?: number,
    allowBottomEject?: boolean,
  ) => void;
  onVictory: () => void;
  showConversation: (moments: LevelConversationMoment[]) => number;
}

export class LevelRunner {
  private level: LevelDefinition;
  private context: LevelRunnerContext;
  private elapsedMs = 0;
  private hazards: Hazard[] = [];
  private completed = false;
  private bossSpawned = false;
  private activeWaveScheduler: null | WaveScheduler = null;
  private activeConversationMs = 0;
  private eventIndex = -1;
  private waveNumber = 0;
  private hazardDebug?: Phaser.GameObjects.Graphics;
  private spawnDebug?: Phaser.GameObjects.Graphics;

  constructor(level: LevelDefinition, context: LevelRunnerContext) {
    this.level = level;
    this.context = context;
  }

  start(): void {
    this.elapsedMs = 0;
    this.completed = false;
    this.bossSpawned = false;
    this.activeWaveScheduler = null;
    this.activeConversationMs = 0;
    this.eventIndex = -1;
    this.waveNumber = 0;
    this.buildHazards();
    this.setupDebug();
    this.advanceEventQueue();
  }

  update(deltaMs: number): void {
    if (this.completed) return;
    this.elapsedMs += deltaMs;
    this.updateHazards(deltaMs);
    if (this.activeWaveScheduler) {
      this.activeWaveScheduler.update(deltaMs);
      if (this.activeWaveScheduler.isComplete()) {
        this.activeWaveScheduler = null;
        this.advanceEventQueue();
      }
    } else if (this.activeConversationMs > 0) {
      this.activeConversationMs = Math.max(0, this.activeConversationMs - deltaMs);
      if (this.activeConversationMs === 0) {
        this.advanceEventQueue();
      }
    }
    this.checkWinCondition();
  }

  getWaveNumber(): number {
    return this.waveNumber;
  }

  setBounds(bounds: Phaser.Geom.Rectangle): void {
    for (const hazard of this.hazards) {
      hazard.updateBounds(bounds);
    }
    this.drawHazardBounds();
    this.drawSpawnPoints();
  }

  destroy(): void {
    for (const hazard of this.hazards) {
      hazard.destroy();
    }
    this.hazards.length = 0;
    this.clearDebug();
  }

  private buildHazards(): void {
    this.destroy();
    const scripts = this.level.hazards;
    if (!scripts || scripts.length === 0) return;
    const bounds = this.context.getPlayArea();
    for (const script of scripts) {
      const hazard = createHazard(script, this.context.scene, bounds);
      if (hazard) this.hazards.push(hazard);
    }
  }

  private updateHazards(deltaMs: number): void {
    if (this.hazards.length === 0) return;
    const damage = (CONTACT_DAMAGE_PER_SEC * deltaMs) / 1000;
    const player: PlayerSnapshot = this.context.getPlayerState();
    for (const hazard of this.hazards) {
      hazard.update(this.elapsedMs);
      if (!player.alive) continue;
      const impact = hazard.getImpact(player);
      if (impact) {
        this.context.pushPlayer(
          impact.pushX,
          impact.pushY,
          impact.fxColor,
          impact.contactX,
          impact.contactY,
          impact.deathOnBottomEject,
        );
        if (impact.damageOnTouch) {
          this.context.applyContactDamage(
            damage,
            impact.contactX,
            impact.contactY,
          );
        }
      }
    }
    this.drawHazardBounds();
  }

  private checkWinCondition(): void {
    const condition = this.level.endCondition ?? this.level.winCondition;
    if (condition.kind === "survive") {
      if (this.elapsedMs >= condition.durationMs) {
        this.triggerVictory();
      }
      return;
    }
    if (condition.kind === "clearWaves") {
      if (this.isTimelineComplete() && this.context.getEnemyCount() === 0) {
        this.triggerVictory();
      }
      return;
    }
    if (condition.kind === "defeatBoss") {
      if (this.bossSpawned && !this.context.isEnemyActive(condition.bossId)) {
        this.triggerVictory();
      }
    }
  }

  private triggerVictory(): void {
    if (this.completed) return;
    this.completed = true;
    this.context.onVictory();
  }

  private getBossTargetId(): EnemyId | null {
    const condition = this.level.endCondition ?? this.level.winCondition;
    if (condition.kind === "defeatBoss") return condition.bossId;
    return null;
  }

  private isTimelineComplete(): boolean {
    if (this.activeWaveScheduler) return false;
    if (this.activeConversationMs > 0) return false;
    return this.eventIndex >= this.level.events.length - 1;
  }

  private advanceEventQueue(): void {
    while (!this.completed && !this.activeWaveScheduler && this.activeConversationMs <= 0) {
      const next = this.level.events[this.eventIndex + 1];
      if (!next) return;
      this.eventIndex += 1;
      if (next.kind === "wave") {
        this.startWaveEvent(next.wave);
        return;
      }
      const durationMs = this.context.showConversation(next.moments);
      if (durationMs > 0) {
        this.activeConversationMs = durationMs;
        return;
      }
    }
  }

  private startWaveEvent(
    wave: Extract<LevelDefinition["events"][number], { kind: "wave" }>["wave"],
  ): void {
    this.waveNumber += 1;
    this.activeWaveScheduler = new WaveScheduler({
      getEnemyCount: () => this.context.getEnemyCount(),
      getWaveDefinition: (index) => (index === 0 ? wave : null),
      maxWaves: 1,
      spawn: (event) => {
        const bossId = this.getBossTargetId();
        if (bossId && event.enemyId === bossId) {
          this.bossSpawned = true;
        }
        this.context.spawnEnemy(
          event.enemyId,
          event.x,
          event.y,
          1,
          event.overrides,
        );
      },
    });
    this.activeWaveScheduler.start(0);
  }

  private setupDebug(): void {
    this.clearDebug();
    const flags = getDebugFlags();
    if (flags.showHazardBounds) {
      this.hazardDebug = this.context.scene.add.graphics();
      this.hazardDebug.setDepth(6);
    }
    if (flags.showSpawnPoints) {
      this.spawnDebug = this.context.scene.add.graphics();
      this.spawnDebug.setDepth(6);
      this.drawSpawnPoints();
    }
  }

  private clearDebug(): void {
    this.hazardDebug?.destroy();
    this.hazardDebug = undefined;
    this.spawnDebug?.destroy();
    this.spawnDebug = undefined;
  }

  private drawHazardBounds(): void {
    if (!this.hazardDebug) return;
    this.hazardDebug.clear();
    this.hazardDebug.lineStyle(1, 0xffcc66, 0.8);
    for (const hazard of this.hazards) {
      const rect = hazard.getBounds();
      this.hazardDebug.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
  }

  private drawSpawnPoints(): void {
    if (!this.spawnDebug) return;
    const bounds = this.context.getPlayArea();
    this.spawnDebug.clear();
    this.spawnDebug.lineStyle(1, 0x3fd2ff, 0.8);
    this.spawnDebug.fillStyle(0x3fd2ff, 0.2);
    for (const event of this.level.events) {
      if (event.kind !== "wave") continue;
      for (const spawn of event.wave.spawns) {
        const x = bounds.x + (0.5 + spawn.x) * bounds.width;
        const y = bounds.y + spawn.y * bounds.height;
        this.spawnDebug.strokeCircle(x, y, 6);
        this.spawnDebug.fillCircle(x, y, 3);
      }
    }
  }
}
