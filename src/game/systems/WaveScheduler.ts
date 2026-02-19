import type { Spawn, WaveDefinition } from "../data/waves";

interface WaveSchedulerConfig {
  getEnemyCount: () => number;
  getWaveDefinition: (index: number) => null | WaveDefinition;
  maxWaves?: number;
  onWaveStart?: (wave: WaveDefinition, index: number) => void;
  spawn: (event: Spawn) => void;
}

export class WaveScheduler {
  private config: WaveSchedulerConfig;
  private waveEvents: Spawn[] = [];
  private waveEventCursor = 0;
  private waveTimerMs = 0;
  private waveIndex = -1;
  private completed = false;

  constructor(config: WaveSchedulerConfig) {
    this.config = config;
  }

  start(index = 0): void {
    this.completed = false;
    this.waveIndex = -1;
    this.startWave(index);
  }

  update(deltaMs: number): void {
    if (this.completed) return;
    this.waveTimerMs += deltaMs;
    while (
      this.waveEventCursor < this.waveEvents.length &&
      this.waveEvents[this.waveEventCursor].atMs <= this.waveTimerMs
    ) {
      const event = this.waveEvents[this.waveEventCursor];
      this.config.spawn(event);
      this.waveEventCursor += 1;
    }

    const waveFinished =
      this.waveEventCursor >= this.waveEvents.length &&
      this.config.getEnemyCount() === 0;
    if (waveFinished) {
      this.startWave(this.waveIndex + 1);
    }
  }

  isComplete(): boolean {
    return this.completed;
  }

  getWaveNumber(): number {
    if (this.waveIndex < 0) return 0;
    const number = this.waveIndex + 1;
    return typeof this.config.maxWaves === "number"
      ? Math.min(number, this.config.maxWaves)
      : number;
  }

  private startWave(index: number): void {
    const wave = this.config.getWaveDefinition(index);
    if (!wave) {
      this.completed = true;
      this.waveEvents = [];
      this.waveEventCursor = 0;
      this.waveTimerMs = 0;
      this.waveIndex = Math.max(-1, index - 1);
      return;
    }
    this.waveIndex = index;
    this.waveTimerMs = 0;
    this.waveEventCursor = 0;
    this.waveEvents = [...wave.spawns].sort((a, b) => a.atMs - b.atMs);
    this.config.onWaveStart?.(wave, index);
  }
}
