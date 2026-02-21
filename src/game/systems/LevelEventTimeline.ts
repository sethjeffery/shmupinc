import type {
  LevelConversationMoment,
  LevelDefinition,
  LevelEventAction,
  LevelEventCondition,
} from "../data/levels";
import type { Spawn } from "../data/waves";

import { WaveScheduler } from "./WaveScheduler";

interface LevelEventTimelineContext {
  getBranchOptionSelectionCount: (
    eventIndex: number,
    optionIndex: number,
  ) => number;
  getEnemyCount: () => number;
  getPlayerHpRatio: () => number;
  getPlayerMaxHp: () => number;
  isFirstClearRun: () => boolean;
  markBranchOptionSelected: (eventIndex: number, optionIndex: number) => void;
  showConversation: (moments: LevelConversationMoment[]) => number;
  spawnFromWave: (event: Spawn) => void;
}

export const visitEventWaveSpawns = (
  events: LevelDefinition["events"],
  visit: (spawn: Spawn) => void,
): void => {
  for (const event of events) {
    if (event.kind === "wave") {
      for (const spawn of event.wave.spawns) {
        visit(spawn);
      }
      continue;
    }
    if (event.kind === "conversation") continue;
    for (const option of event.options) {
      if (option.event.kind !== "wave") continue;
      for (const spawn of option.event.wave.spawns) {
        visit(spawn);
      }
    }
  }
};

export class LevelEventTimeline {
  private readonly events: LevelDefinition["events"];
  private readonly context: LevelEventTimelineContext;
  private activeConversationMs = 0;
  private activeWaveScheduler: null | WaveScheduler = null;
  private eventIndex = -1;
  private waveNumber = 0;

  constructor(
    events: LevelDefinition["events"],
    context: LevelEventTimelineContext,
  ) {
    this.events = events;
    this.context = context;
  }

  start(): void {
    this.activeConversationMs = 0;
    this.activeWaveScheduler = null;
    this.eventIndex = -1;
    this.waveNumber = 0;
    this.advanceEventQueue();
  }

  update(deltaMs: number): void {
    if (this.activeWaveScheduler) {
      this.activeWaveScheduler.update(deltaMs);
      if (this.activeWaveScheduler.isComplete()) {
        this.activeWaveScheduler = null;
        this.advanceEventQueue();
      }
    } else if (this.activeConversationMs > 0) {
      this.activeConversationMs = Math.max(
        0,
        this.activeConversationMs - deltaMs,
      );
      if (this.activeConversationMs === 0) {
        this.advanceEventQueue();
      }
    }
  }

  getWaveNumber(): number {
    return this.waveNumber;
  }

  isComplete(): boolean {
    if (this.activeWaveScheduler) return false;
    if (this.activeConversationMs > 0) return false;
    return this.eventIndex >= this.events.length - 1;
  }

  private evaluateEventCondition(condition?: LevelEventCondition): boolean {
    if (!condition) return true;
    const firstClearRun = this.context.isFirstClearRun();
    const hpRatio = this.context.getPlayerHpRatio();
    const maxHp = this.context.getPlayerMaxHp();
    if (condition.firstClearOnly && !firstClearRun) return false;
    if (condition.repeatOnly && firstClearRun) return false;
    if (condition.hpRatioGte !== undefined && hpRatio < condition.hpRatioGte) {
      return false;
    }
    if (condition.hpRatioLte !== undefined && hpRatio > condition.hpRatioLte) {
      return false;
    }
    if (condition.maxHpGte !== undefined && maxHp < condition.maxHpGte) {
      return false;
    }
    if (condition.maxHpLte !== undefined && maxHp > condition.maxHpLte) {
      return false;
    }
    return true;
  }

  private evaluateBranchOptionCondition(
    condition: LevelEventCondition | undefined,
    eventIndex: number,
    optionIndex: number,
  ): boolean {
    if (!this.evaluateEventCondition(condition)) return false;
    if (condition?.maxTimes !== undefined) {
      const count = this.context.getBranchOptionSelectionCount(
        eventIndex,
        optionIndex,
      );
      if (count >= condition.maxTimes) {
        return false;
      }
    }
    return true;
  }

  private resolveEventAction(
    event: LevelDefinition["events"][number],
    eventIndex: number,
  ): {
    action: LevelEventAction;
    selectedBranchOptionIndex?: number;
  } | null {
    if (event.kind !== "branch") {
      return {
        action: event,
      };
    }
    for (
      let optionIndex = 0;
      optionIndex < event.options.length;
      optionIndex += 1
    ) {
      const option = event.options[optionIndex];
      if (
        this.evaluateBranchOptionCondition(option.when, eventIndex, optionIndex)
      ) {
        return {
          action: option.event,
          selectedBranchOptionIndex: optionIndex,
        };
      }
    }
    return null;
  }

  private advanceEventQueue(): void {
    while (!this.activeWaveScheduler && this.activeConversationMs <= 0) {
      const next = this.events[this.eventIndex + 1];
      if (!next) return;
      this.eventIndex += 1;
      const resolved = this.resolveEventAction(next, this.eventIndex);
      if (!resolved) {
        continue;
      }
      if (resolved.selectedBranchOptionIndex !== undefined) {
        this.context.markBranchOptionSelected(
          this.eventIndex,
          resolved.selectedBranchOptionIndex,
        );
      }
      if (resolved.action.kind === "wave") {
        this.startWaveEvent(resolved.action.wave);
        return;
      }
      const durationMs = this.context.showConversation(resolved.action.moments);
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
      spawn: (event) => this.context.spawnFromWave(event),
    });
    this.activeWaveScheduler.start(0);
  }
}
