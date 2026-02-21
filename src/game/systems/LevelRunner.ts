import type { EnemyId } from "../data/enemyTypes";
import type { LevelConversationMoment, LevelDefinition } from "../data/levels";
import type { EnemyOverride } from "../data/waves";
import type Phaser from "phaser";

import { CONTACT_DAMAGE_PER_SEC } from "./combatConstants";
import { getDebugFlags } from "./DebugFlags";
import { createHazard, type Hazard, type PlayerSnapshot } from "./hazards";
import { LevelEventTimeline, visitEventWaveSpawns } from "./LevelEventTimeline";

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
  getPlayerHpRatio: () => number;
  getPlayerMaxHp: () => number;
  getBranchOptionSelectionCount: (
    eventIndex: number,
    optionIndex: number,
  ) => number;
  isFirstClearRun: () => boolean;
  markBranchOptionSelected: (eventIndex: number, optionIndex: number) => void;
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
  private eventTimeline: LevelEventTimeline;
  private hazardDebug?: Phaser.GameObjects.Graphics;
  private spawnDebug?: Phaser.GameObjects.Graphics;

  constructor(level: LevelDefinition, context: LevelRunnerContext) {
    this.level = level;
    this.context = context;
    this.eventTimeline = new LevelEventTimeline(level.events, {
      getBranchOptionSelectionCount: (eventIndex, optionIndex) =>
        this.context.getBranchOptionSelectionCount(eventIndex, optionIndex),
      getEnemyCount: this.context.getEnemyCount,
      getPlayerHpRatio: this.context.getPlayerHpRatio,
      getPlayerMaxHp: this.context.getPlayerMaxHp,
      isFirstClearRun: this.context.isFirstClearRun,
      markBranchOptionSelected: this.context.markBranchOptionSelected,
      showConversation: this.context.showConversation,
      spawnFromWave: (event) => {
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
  }

  start(): void {
    this.elapsedMs = 0;
    this.completed = false;
    this.bossSpawned = false;
    this.buildHazards();
    this.setupDebug();
    this.eventTimeline.start();
  }

  update(deltaMs: number): void {
    if (this.completed) return;
    this.elapsedMs += deltaMs;
    this.updateHazards(deltaMs);
    this.eventTimeline.update(deltaMs);
    this.checkWinCondition();
  }

  getWaveNumber(): number {
    return this.eventTimeline.getWaveNumber();
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
      if (
        this.eventTimeline.isComplete() &&
        this.context.getEnemyCount() === 0
      ) {
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
    visitEventWaveSpawns(this.level.events, (spawn) => {
      const x = bounds.x + (0.5 + spawn.x) * bounds.width;
      const y = bounds.y + spawn.y * bounds.height;
      this.spawnDebug?.strokeCircle(x, y, 6);
      this.spawnDebug?.fillCircle(x, y, 3);
    });
  }
}
