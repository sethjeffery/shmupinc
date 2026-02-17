import type { SoundContent } from "../../content/schemas";
import type { BulletSpec } from "../data/scripts";

import { getContentRegistry } from "../../content/registry";

type MusicMode = "game" | "menu";
type EnemyDeathClass = "boss" | "large" | "small";
type SoundPlayHandle = () => void;

interface ModeAudioState {
  audioElements: HTMLAudioElement[];
  currentIndex: number;
  positionSec: number[];
  volume: number;
}

const MENU_TRACKS = [
  new URL("../../../content/music/menu01.mp3", import.meta.url).href,
];
const GAME_TRACKS = [
  new URL("../../../content/music/game01.mp3", import.meta.url).href,
  new URL("../../../content/music/game02.mp3", import.meta.url).href,
  new URL("../../../content/music/game03.mp3", import.meta.url).href,
  new URL("../../../content/music/game04.mp3", import.meta.url).href,
];
const AUDIO_PREFS_STORAGE_KEY = "shmupinc-audio-prefs-v1";
const BASE_SFX_GAIN = 0.26;

interface AudioPreferences {
  musicEnabled: boolean;
  soundEnabled: boolean;
}

const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  musicEnabled: true,
  soundEnabled: true,
};

const MUSIC_FADE_MS = 380;
const SHOT_COOLDOWNS_MS: Record<string, number> = {
  "enemy-bomb": 180,
  "enemy-dart": 42,
  "enemy-missile": 130,
  "enemy-orb": 44,
  "player-bomb": 180,
  "player-dart": 28,
  "player-missile": 110,
  "player-orb": 30,
};

const SHOT_SOUND_IDS: Record<string, readonly string[]> = {
  "enemy-bomb": ["enemy_bomb_fire", "enemy_orb_fire"],
  "enemy-dart": ["enemy_dart_fire", "enemy_orb_fire"],
  "enemy-missile": ["enemy_missile_fire", "enemy_orb_fire"],
  "enemy-orb": ["enemy_orb_fire"],
  "player-bomb": ["player_bomb_fire", "player_missile_fire", "player_orb_fire"],
  "player-dart": ["player_dart_fire", "player_orb_fire"],
  "player-missile": ["player_missile_fire", "player_orb_fire"],
  "player-orb": ["player_orb_fire"],
};

const IMPACT_SOUND_IDS: Record<"enemy" | "player", readonly string[]> = {
  enemy: ["impact_enemy_hit", "impact_light"],
  player: ["impact_player_hit", "impact_light"],
};

const BULLET_EXPLOSION_SOUND_IDS: Record<
  "enemy" | "player",
  readonly string[]
> = {
  enemy: ["explosion_enemy_bullet", "explosion_small"],
  player: ["explosion_player_bullet", "explosion_small"],
};

const ENEMY_DEATH_SOUND_IDS: Record<EnemyDeathClass, readonly string[]> = {
  boss: ["enemy_death_boss", "enemy_death_large", "explosion_small"],
  large: ["enemy_death_large", "enemy_death_small", "explosion_small"],
  small: ["enemy_death_small", "explosion_small"],
};

const PLAYER_DAMAGE_SOUND_IDS = ["player_damage"] as const;
const PLAYER_DEATH_SOUND_IDS = [
  "player_death",
  "enemy_death_large",
  "explosion_small",
] as const;
const COIN_COLLECT_SOUND_IDS = ["coin_collect"] as const;

const LAYER_GAIN_FLOOR = 0.0001;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const msToSec = (ms: number | undefined): number =>
  Math.max(0, (ms ?? 0) / 1000);
const NOOP_SOUND_STOP: SoundPlayHandle = () => {
  return;
};

const readAudioPreferences = (): AudioPreferences => {
  if (typeof window === "undefined") return DEFAULT_AUDIO_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(AUDIO_PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_AUDIO_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<AudioPreferences>;
    return {
      ...DEFAULT_AUDIO_PREFERENCES,
      ...parsed,
    };
  } catch {
    return DEFAULT_AUDIO_PREFERENCES;
  }
};

const writeAudioPreferences = (prefs: AudioPreferences): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AUDIO_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
};

// -----------------------------------------------------------------------------
// Extended procedural SFX support (effects, pan, randomize, eventGroup, bandpass)
// -----------------------------------------------------------------------------

type PitchCurve = "expFast" | "linear";

type PanSpec = { min: number; max: number } | number;

type RandomizeSpec = Partial<{
  gain: number; // ± multiplier amount, e.g. 0.12 => ±12%
  startHz: number;
  endHz: number;
  highpassHz: number;
  lowpassHz: number;
  bandpassHz: number;
  releaseMs: number;
}>;

type FxSpec =
  | { type: "bandpass"; hz: number; q?: number }
  | {
      type: "compressor";
      thresholdDb?: number;
      kneeDb?: number;
      ratio?: number;
      attackMs?: number;
      releaseMs?: number;
      makeupGain?: number;
    }
  | {
      type: "delay";
      timeMs?: number;
      feedback?: number;
      mix?: number;
      highpassHz?: number;
      lowpassHz?: number;
    }
  | { type: "highpass"; hz: number; q?: number }
  | { type: "lowpass"; hz: number; q?: number }
  | {
      type: "reverb";
      roomMs?: number;
      damping?: number;
      highpassHz?: number;
      lowpassHz?: number;
      mix?: number;
    }
  | { type: "waveshaper"; drive?: number; mix?: number };

interface ToneLayer {
  type: "tone";
  name?: string;
  startOffsetMs?: number;
  wave: OscillatorType;
  startHz: number;
  endHz?: number;
  pitchCurve?: PitchCurve;
  attackMs?: number;
  holdMs?: number;
  releaseMs?: number;
  gain: number;
  pan?: PanSpec;
  randomize?: RandomizeSpec;
  effects?: FxSpec[];
}

interface NoiseLayer {
  type: "noise";
  name?: string;
  startOffsetMs?: number;
  attackMs?: number;
  holdMs?: number;
  releaseMs?: number;
  highpassHz?: number;
  lowpassHz?: number;
  bandpassHz?: number;
  bandpassQ?: number;
  gain: number;
  pan?: PanSpec;
  randomize?: RandomizeSpec;
  effects?: FxSpec[];
}

interface EventGroupLayer {
  type: "eventGroup";
  name?: string;
  startOffsetMs?: number;
  count: number;
  spacingMs: number;
  jitterMs?: number;
  event: NoiseLayer | ToneLayer;
}

type ExtendedSoundContent = SoundContent & {
  effects?: FxSpec[];
  layers: (EventGroupLayer | NoiseLayer | ToneLayer)[];
};

class AudioDirector {
  private activeMode: MusicMode | null = null;
  private audioContext: AudioContext | null = null;
  private desiredMode: MusicMode = "menu";
  private desiredPauseLowPass = false;
  private fadeHandles = new Set<number>();
  private missingSoundIds = new Set<string>();
  private modeState: Record<MusicMode, ModeAudioState>;
  private musicFilter: BiquadFilterNode | null = null;
  private musicGain: GainNode | null = null;
  private musicSources = new Map<
    HTMLAudioElement,
    MediaElementAudioSourceNode
  >();
  private musicEnabled = DEFAULT_AUDIO_PREFERENCES.musicEnabled;
  private soundsById: Record<string, SoundContent>;
  private soundEnabled = DEFAULT_AUDIO_PREFERENCES.soundEnabled;
  private sfxLastAtMs = new Map<string, number>();
  private sfxGain: GainNode | null = null;
  private unlockAttached = false;
  private unlocked = false;

  // FX caches
  private reverbCache = new Map<string, AudioBuffer>();

  constructor() {
    const prefs = readAudioPreferences();
    this.musicEnabled = prefs.musicEnabled;
    this.soundEnabled = prefs.soundEnabled;
    this.soundsById = getContentRegistry().soundsById;
    this.modeState = {
      game: this.createModeState(GAME_TRACKS, 0.42),
      menu: this.createModeState(MENU_TRACKS, 0.34),
    };
    this.modeState.game.currentIndex = -1;
  }

  attachUnlockHandlers(): void {
    if (typeof window === "undefined" || this.unlockAttached) return;
    this.unlockAttached = true;
    const unlock = (): void => {
      this.unlock();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock, { passive: true });
    window.addEventListener("touchstart", unlock, { passive: true });
  }

  unlock(): void {
    if (!this.unlocked) {
      this.unlocked = true;
    }
    const context = this.ensureAudioContext();
    if (!context) return;
    void context.resume();
    this.ensureMusicGraph();
    this.applySfxEnabled();
    this.applyMusicMode(this.desiredMode);
    this.applyPauseLowPass(this.desiredPauseLowPass);
  }

  getMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  getSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  setMusicEnabled(enabled: boolean): void {
    if (this.musicEnabled === enabled) return;
    this.musicEnabled = enabled;
    this.persistAudioPreferences();
    if (!this.unlocked) return;
    if (!enabled) {
      this.stopAllMusic();
      return;
    }
    this.activeMode = null;
    this.applyMusicMode(this.desiredMode);
    this.applyPauseLowPass(this.desiredPauseLowPass);
  }

  setSoundEnabled(enabled: boolean): void {
    if (this.soundEnabled === enabled) return;
    this.soundEnabled = enabled;
    this.persistAudioPreferences();
    this.applySfxEnabled();
  }

  setMusicMode(mode: MusicMode): void {
    this.desiredMode = mode;
    if (!this.unlocked) return;
    this.applyMusicMode(mode);
  }

  setPauseLowPass(enabled: boolean): void {
    this.desiredPauseLowPass = enabled;
    if (!this.unlocked) return;
    this.applyPauseLowPass(enabled);
  }

  playShot(owner: "enemy" | "player", bullet: BulletSpec): void {
    const key = `${owner}-${bullet.kind}`;
    const cooldown = SHOT_COOLDOWNS_MS[key] ?? 60;
    if (!this.canTriggerSfx(`shot-${key}`, cooldown)) return;
    this.playSoundByIds(SHOT_SOUND_IDS[key] ?? [], {
      pitchSemitones: (Math.random() - 0.5) * 0.45,
    });
  }

  playBulletImpact(owner: "enemy" | "player", bullet: BulletSpec): void {
    if (
      !this.canTriggerSfx(
        `impact-${owner}-${bullet.kind}`,
        owner === "enemy" ? 32 : 22,
      )
    ) {
      return;
    }
    const pitchByKind: Record<BulletSpec["kind"], number> = {
      bomb: -0.8,
      dart: 1.1,
      missile: -0.45,
      orb: 0,
    };
    this.playSoundByIds(IMPACT_SOUND_IDS[owner], {
      pitchSemitones: pitchByKind[bullet.kind] + (Math.random() - 0.5) * 0.5,
    });
  }

  playBulletExplosion(owner: "enemy" | "player", bullet: BulletSpec): void {
    if (!this.canTriggerSfx(`explosion-${owner}-${bullet.kind}`, 68)) return;
    this.playSoundByIds(BULLET_EXPLOSION_SOUND_IDS[owner], {
      gainScale: bullet.kind === "bomb" ? 1.18 : 1,
      pitchSemitones:
        bullet.kind === "bomb" ? -0.5 : (Math.random() - 0.5) * 0.4,
    });
  }

  playEnemyDeath(kind: EnemyDeathClass): void {
    const cooldownMs = kind === "boss" ? 260 : kind === "large" ? 120 : 32;
    if (!this.canTriggerSfx(`enemy-death-${kind}`, cooldownMs)) {
      return;
    }
    const gainScaleByClass: Record<EnemyDeathClass, number> = {
      boss: 1.35,
      large: 1.15,
      small: 1,
    };
    this.playSoundByIds(ENEMY_DEATH_SOUND_IDS[kind], {
      gainScale: gainScaleByClass[kind],
      pitchSemitones: kind === "small" ? (Math.random() - 0.5) * 0.5 : -0.35,
    });
  }

  playPlayerDamage(damageTaken = 1): void {
    if (!this.canTriggerSfx("player-damage", 78)) return;
    const intensity = clamp(damageTaken / 2, 0.45, 1.25);
    this.playSoundByIds(PLAYER_DAMAGE_SOUND_IDS, {
      gainScale: intensity,
      pitchSemitones: (Math.random() - 0.5) * 0.4,
    });
  }

  playPlayerDeath(): void {
    if (!this.canTriggerSfx("player-death", 260)) return;
    this.playSoundByIds(PLAYER_DEATH_SOUND_IDS, {
      gainScale: 1.2,
      pitchSemitones: -0.5,
    });
  }

  playCoinCollect(value = 1): void {
    if (!this.canTriggerSfx("coin-collect", 22)) return;
    const amountScale = clamp(value, 1, 8);
    this.playSoundByIds(COIN_COLLECT_SOUND_IDS, {
      gainScale: clamp(0.74 + amountScale * 0.055, 0.72, 1.2),
      pitchSemitones:
        clamp((amountScale - 1) * 0.16, 0, 1.2) + (Math.random() - 0.5) * 0.5,
    });
  }

  playPreviewSound(
    sound: SoundContent,
    options?: {
      gainScale?: number;
      pitchSemitones?: number;
    },
  ): SoundPlayHandle {
    if (!this.soundEnabled) return NOOP_SOUND_STOP;
    const context = this.ensureAudioContext();
    const master = this.ensureSfxGain();
    if (!context || !master) return NOOP_SOUND_STOP;
    void context.resume();
    return this.playSoundDefinition(sound, options);
  }

  private applyMusicMode(mode: MusicMode): void {
    if (!this.musicEnabled) {
      this.stopAllMusic();
      this.activeMode = mode;
      return;
    }
    if (this.activeMode === mode) return;
    const targetState = this.modeState[mode];
    if (mode === "game" && targetState.audioElements.length > 1) {
      if (targetState.currentIndex < 0) {
        targetState.currentIndex = Math.floor(
          Math.random() * targetState.audioElements.length,
        );
      }
    }

    const previousMode = this.activeMode;
    this.activeMode = mode;
    const nextAudio =
      targetState.audioElements[targetState.currentIndex] ??
      targetState.audioElements[0];
    if (!nextAudio) return;

    if (typeof window !== "undefined" && this.fadeHandles.size > 0) {
      for (const handle of this.fadeHandles) {
        window.cancelAnimationFrame(handle);
      }
      this.fadeHandles.clear();
    }

    if (previousMode) {
      const previousState = this.modeState[previousMode];
      const previousAudio =
        previousState.audioElements[previousState.currentIndex] ??
        previousState.audioElements[0];
      if (previousAudio && previousAudio !== nextAudio) {
        this.fadeAudio(
          previousAudio,
          previousAudio.volume,
          0,
          MUSIC_FADE_MS,
          () => {
            this.captureAudioPosition(previousMode, previousAudio);
            previousAudio.pause();
          },
        );
      }
    }

    this.restoreAudioPosition(mode, nextAudio);
    nextAudio.volume = 0;
    nextAudio.loop = true;
    void nextAudio.play();
    this.fadeAudio(nextAudio, 0, targetState.volume, MUSIC_FADE_MS);
  }

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (this.audioContext) return this.audioContext;
    const Context =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Context) return null;
    this.audioContext = new Context();
    return this.audioContext;
  }

  private ensureSfxGain(): GainNode | null {
    const context = this.ensureAudioContext();
    if (!context) return null;
    if (this.sfxGain) return this.sfxGain;
    this.sfxGain = context.createGain();
    this.sfxGain.gain.value = this.soundEnabled ? BASE_SFX_GAIN : 0;
    this.sfxGain.connect(context.destination);
    return this.sfxGain;
  }

  private ensureMusicGraph(): void {
    const context = this.ensureAudioContext();
    if (!context || this.musicFilter || this.musicGain) return;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 20000;
    filter.Q.value = 0.7;
    const gain = context.createGain();
    gain.gain.value = 1;
    filter.connect(gain);
    gain.connect(context.destination);
    for (const state of Object.values(this.modeState)) {
      for (const audio of state.audioElements) {
        if (this.musicSources.has(audio)) continue;
        const source = context.createMediaElementSource(audio);
        source.connect(filter);
        this.musicSources.set(audio, source);
      }
    }
    this.musicFilter = filter;
    this.musicGain = gain;
  }

  private applyPauseLowPass(enabled: boolean): void {
    const context = this.ensureAudioContext();
    if (!context) return;
    this.ensureMusicGraph();
    if (!this.musicFilter || !this.musicGain) return;
    const now = context.currentTime;
    const cutoff = enabled ? 800 : 20000;
    const outputGain = enabled ? 0.88 : 1;
    this.musicFilter.frequency.cancelScheduledValues(now);
    this.musicFilter.frequency.setValueAtTime(
      this.musicFilter.frequency.value,
      now,
    );
    this.musicFilter.frequency.setTargetAtTime(
      cutoff,
      now,
      enabled ? 0.06 : 0.12,
    );
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.setTargetAtTime(outputGain, now, 0.08);
  }

  private canTriggerSfx(key: string, cooldownMs: number): boolean {
    if (!this.soundEnabled) return false;
    if (!this.unlocked) return false;
    const context = this.ensureAudioContext();
    const masterGain = this.ensureSfxGain();
    if (!context || !masterGain) return false;
    const nowMs = performance.now();
    const lastAt = this.sfxLastAtMs.get(key) ?? -Infinity;
    if (nowMs - lastAt < cooldownMs) return false;
    this.sfxLastAtMs.set(key, nowMs);
    return true;
  }

  private playSoundByIds(
    soundIds: readonly string[],
    options?: {
      gainScale?: number;
      pitchSemitones?: number;
    },
  ): void {
    const sound = this.resolveSound(soundIds);
    if (!sound) {
      this.warnMissingSounds(soundIds);
      return;
    }
    this.playSoundDefinition(sound, options);
  }

  private resolveSound(soundIds: readonly string[]): null | SoundContent {
    for (const soundId of soundIds) {
      const sound = this.soundsById[soundId];
      if (sound) return sound;
    }
    return null;
  }

  private warnMissingSounds(soundIds: readonly string[]): void {
    if (!soundIds.length) return;
    const key = soundIds.join("|");
    if (this.missingSoundIds.has(key)) return;
    this.missingSoundIds.add(key);
    console.warn(
      `[audio] Missing configured sound(s): ${soundIds.join(", ")}.`,
    );
  }

  // ---------------------------------------------------------------------------
  // Extended playback
  // ---------------------------------------------------------------------------

  private randMul(amount?: number): number {
    const a = clamp(amount ?? 0, 0, 2);
    if (a <= 0) return 1;
    return 1 + (Math.random() * 2 - 1) * a;
  }

  private resolvePan(pan?: PanSpec): number {
    if (pan == null) return 0;
    if (typeof pan === "number") return clamp(pan, -1, 1);
    return clamp(pan.min + Math.random() * (pan.max - pan.min), -1, 1);
  }

  private playSoundDefinition(
    sound: SoundContent,
    options?: {
      gainScale?: number;
      pitchSemitones?: number;
    },
  ): SoundPlayHandle {
    const context = this.ensureAudioContext();
    const master = this.ensureSfxGain();
    if (!context || !master) return NOOP_SOUND_STOP;

    const soundDef = sound as ExtendedSoundContent;

    const soundGain = context.createGain();
    const gainScale = clamp(options?.gainScale ?? 1, 0, 2.4);
    soundGain.gain.value = clamp((soundDef.gain ?? 0.2) * gainScale, 0, 1);

    // Apply sound-level FX before master (optional)
    const { cleanup: busCleanup, output: busOut } = this.buildFxChain(
      context,
      soundGain,
      soundDef.effects,
    );
    busOut.connect(master);

    const pitchScale = Math.pow(2, (options?.pitchSemitones ?? 0) / 12);
    const startSec = context.currentTime;

    let latestEnd = startSec;
    const layerStops: SoundPlayHandle[] = [];

    for (const layer of soundDef.layers) {
      if ((layer as EventGroupLayer).type === "eventGroup") {
        const group = layer as EventGroupLayer;
        const baseStart = startSec + msToSec(group.startOffsetMs);
        const count = Math.max(0, Math.floor(group.count));
        const spacing = msToSec(group.spacingMs);
        const jitter = msToSec(group.jitterMs);

        for (let i = 0; i < count; i += 1) {
          const j = jitter > 0 ? (Math.random() * 2 - 1) * jitter : 0;
          const eventLayer = group.event;
          const eventStart = Math.max(
            startSec,
            baseStart + i * spacing + j + msToSec(eventLayer.startOffsetMs),
          );
          const playback = this.playOneLayer(
            context,
            soundGain,
            eventLayer,
            eventStart,
            pitchScale,
          );
          latestEnd = Math.max(latestEnd, playback.endsAt);
          layerStops.push(playback.stop);
        }
        continue;
      }

      const layerStartSec =
        startSec + msToSec((layer as NoiseLayer | ToneLayer).startOffsetMs);
      const playback = this.playOneLayer(
        context,
        soundGain,
        layer as NoiseLayer | ToneLayer,
        layerStartSec,
        pitchScale,
      );
      latestEnd = Math.max(latestEnd, playback.endsAt);
      layerStops.push(playback.stop);
    }

    // Timed cleanup for bus FX and sound gain (nodes created per-play)
    let cleaned = false;
    let cleanupTimeout: null | ReturnType<typeof setTimeout> = null;
    const cleanup = (): void => {
      if (cleaned) return;
      cleaned = true;
      if (cleanupTimeout) {
        clearTimeout(cleanupTimeout);
        cleanupTimeout = null;
      }
      try {
        busOut.disconnect();
        soundGain.disconnect();
        for (const c of busCleanup) c();
      } catch {
        // ignore
      }
    };

    if (typeof window !== "undefined") {
      const cleanupAt = latestEnd + 0.12;
      const delayMs = Math.max(0, (cleanupAt - context.currentTime) * 1000);
      cleanupTimeout = window.setTimeout(cleanup, delayMs);
    }
    return () => {
      for (const stop of layerStops) {
        stop();
      }
      cleanup();
    };
  }

  private playOneLayer(
    context: AudioContext,
    soundGain: GainNode,
    layer: NoiseLayer | ToneLayer,
    startSec: number,
    pitchScale: number,
  ): {
    endsAt: number;
    stop: SoundPlayHandle;
  } {
    const r = layer.randomize;

    // Envelope node
    const layerGain = context.createGain();

    // Optional pan (post-envelope so pan doesn’t alter envelope math)
    const panVal = this.resolvePan(layer.pan);
    let outNode: AudioNode = layerGain;
    let panner: null | StereoPannerNode = null;
    if (panVal !== 0 && "createStereoPanner" in context) {
      panner = context.createStereoPanner();
      panner.pan.value = panVal;
      outNode.connect(panner);
      outNode = panner;
    }

    // Apply envelope
    const layerGainScalar = clamp(layer.gain * this.randMul(r?.gain), 0, 2);
    const durationSec = this.applyLayerEnvelope(
      layerGain.gain,
      startSec,
      layerGainScalar,
      layer.attackMs,
      layer.holdMs,
      // allow optional randomize on release
      (layer.releaseMs ?? 0) * this.randMul(r?.releaseMs),
    );

    // Layer-level FX chain (optional)
    const { cleanup: fxCleanup, output: fxOut } = this.buildFxChain(
      context,
      outNode,
      layer.effects,
    );

    // Legacy per-layer filter params (still supported)
    const extraFilters: BiquadFilterNode[] = [];
    let finalOut: AudioNode = fxOut;

    const connectFilter = (type: BiquadFilterType, hz: number, q?: number) => {
      const f = context.createBiquadFilter();
      f.type = type;
      f.frequency.value = Math.max(10, hz);
      if (q != null) f.Q.value = q;
      finalOut.connect(f);
      finalOut = f;
      extraFilters.push(f);
    };

    if (layer.type === "noise") {
      if (layer.highpassHz)
        connectFilter(
          "highpass",
          layer.highpassHz * this.randMul(r?.highpassHz),
        );
      if (layer.lowpassHz)
        connectFilter("lowpass", layer.lowpassHz * this.randMul(r?.lowpassHz));
      if (layer.bandpassHz)
        connectFilter(
          "bandpass",
          layer.bandpassHz * this.randMul(r?.bandpassHz),
          layer.bandpassQ ?? 1,
        );
    } else {
      // tone layers may still want legacy filters via effects[]; no-op here
    }

    finalOut.connect(soundGain);

    const endTime = startSec + durationSec;

    if (layer.type === "tone") {
      const osc = context.createOscillator();
      osc.type = layer.wave;

      const startHz = Math.max(
        20,
        layer.startHz * this.randMul(r?.startHz) * pitchScale,
      );
      const endHzRaw =
        (layer.endHz ?? layer.startHz) * this.randMul(r?.endHz) * pitchScale;
      const endHz = Math.max(20, endHzRaw);

      osc.frequency.setValueAtTime(startHz, startSec);

      const curve = layer.pitchCurve ?? "linear";
      if (curve === "expFast") {
        const midTime = startSec + durationSec * 0.35;
        const midHz = Math.max(20, startHz * 0.45 + endHz * 0.55);
        osc.frequency.exponentialRampToValueAtTime(midHz, midTime);
        osc.frequency.exponentialRampToValueAtTime(endHz, endTime);
      } else {
        osc.frequency.exponentialRampToValueAtTime(endHz, endTime);
      }

      osc.connect(layerGain);
      osc.start(startSec);
      osc.stop(endTime + 0.02);

      let disposed = false;
      const dispose = (): void => {
        if (disposed) return;
        disposed = true;
        try {
          osc.disconnect();
          layerGain.disconnect();
          panner?.disconnect();
          for (const f of extraFilters) f.disconnect();
          for (const c of fxCleanup) c();
        } catch {
          // ignore
        }
      };
      osc.onended = () => {
        dispose();
      };

      return {
        endsAt: endTime + 0.03,
        stop: () => {
          try {
            osc.stop();
          } catch {
            // already stopped
          }
          dispose();
        },
      };
    }

    // noise
    const source = context.createBufferSource();
    source.buffer = this.buildNoiseBuffer(context, durationSec + 0.06);
    source.connect(layerGain);
    source.start(startSec);
    source.stop(endTime + 0.02);

    let disposed = false;
    const dispose = (): void => {
      if (disposed) return;
      disposed = true;
      try {
        source.disconnect();
        layerGain.disconnect();
        panner?.disconnect();
        for (const f of extraFilters) f.disconnect();
        for (const c of fxCleanup) c();
      } catch {
        // ignore
      }
    };
    source.onended = () => {
      dispose();
    };

    return {
      endsAt: endTime + 0.03,
      stop: () => {
        try {
          source.stop();
        } catch {
          // already stopped
        }
        dispose();
      },
    };
  }

  private buildFxChain(
    context: AudioContext,
    input: AudioNode,
    fx: FxSpec[] | undefined,
  ): { output: AudioNode; cleanup: (() => void)[] } {
    const cleanup: (() => void)[] = [];
    let node: AudioNode = input;

    const connectFilter = (type: BiquadFilterType, hz: number, q?: number) => {
      const f = context.createBiquadFilter();
      f.type = type;
      f.frequency.value = Math.max(10, hz);
      if (q != null) f.Q.value = q;
      node.connect(f);
      cleanup.push(() => f.disconnect());
      node = f;
    };

    const connectGain = (value: number) => {
      const g = context.createGain();
      g.gain.value = value;
      node.connect(g);
      cleanup.push(() => g.disconnect());
      node = g;
      return g;
    };

    const createWaveshaperCurve = (
      drive: number,
    ): Float32Array<ArrayBuffer> => {
      const n = 1024;
      const curve = new Float32Array(n);
      const k = 1 + drive * 20;
      for (let i = 0; i < n; i += 1) {
        const x = (i / (n - 1)) * 2 - 1;
        curve[i] = Math.tanh(k * x);
      }
      return curve;
    };

    const connectWaveshaper = (drive = 0.25, mix = 1) => {
      const dry = context.createGain();
      const wet = context.createGain();
      dry.gain.value = clamp(1 - mix, 0, 1);
      wet.gain.value = clamp(mix, 0, 1);

      const shaper = context.createWaveShaper();
      const curve = createWaveshaperCurve(clamp(drive, 0, 2));
      shaper.curve = curve;
      shaper.oversample = "2x";

      node.connect(dry);
      node.connect(shaper);
      shaper.connect(wet);

      const sum = context.createGain();
      dry.connect(sum);
      wet.connect(sum);

      cleanup.push(() => dry.disconnect());
      cleanup.push(() => wet.disconnect());
      cleanup.push(() => shaper.disconnect());
      cleanup.push(() => sum.disconnect());

      node = sum;
    };

    const connectDelay = (
      timeMs = 70,
      feedback = 0.18,
      mix = 0.1,
      hpHz?: number,
      lpHz?: number,
    ) => {
      const dry = context.createGain();
      const wet = context.createGain();
      dry.gain.value = clamp(1 - mix, 0, 1);
      wet.gain.value = clamp(mix, 0, 1);

      const delay = context.createDelay(1.0);
      delay.delayTime.value = clamp(timeMs, 0, 1000) / 1000;

      const fb = context.createGain();
      fb.gain.value = clamp(feedback, 0, 0.98);

      // Route wet (with optional filters)
      let wetNode: AudioNode = delay;
      const filters: BiquadFilterNode[] = [];
      if (hpHz) {
        const hp = context.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = Math.max(10, hpHz);
        wetNode.connect(hp);
        wetNode = hp;
        filters.push(hp);
      }
      if (lpHz) {
        const lp = context.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = Math.max(10, lpHz);
        wetNode.connect(lp);
        wetNode = lp;
        filters.push(lp);
      }

      node.connect(dry);
      node.connect(delay);
      wetNode.connect(wet);

      delay.connect(fb);
      fb.connect(delay);

      const sum = context.createGain();
      dry.connect(sum);
      wet.connect(sum);

      cleanup.push(() => dry.disconnect());
      cleanup.push(() => wet.disconnect());
      cleanup.push(() => delay.disconnect());
      cleanup.push(() => fb.disconnect());
      for (const f of filters) cleanup.push(() => f.disconnect());
      cleanup.push(() => sum.disconnect());

      node = sum;
    };

    const connectCompressor = (p: Extract<FxSpec, { type: "compressor" }>) => {
      const c = context.createDynamicsCompressor();
      if (p.thresholdDb != null) c.threshold.value = p.thresholdDb;
      if (p.kneeDb != null) c.knee.value = p.kneeDb;
      if (p.ratio != null) c.ratio.value = p.ratio;
      if (p.attackMs != null) c.attack.value = Math.max(0, p.attackMs / 1000);
      if (p.releaseMs != null)
        c.release.value = Math.max(0, p.releaseMs / 1000);

      node.connect(c);
      cleanup.push(() => c.disconnect());
      node = c;

      if (p.makeupGain != null) connectGain(Math.max(0, p.makeupGain));
    };

    for (const f of fx ?? []) {
      if (f.type === "lowpass") connectFilter("lowpass", f.hz, f.q);
      else if (f.type === "highpass") connectFilter("highpass", f.hz, f.q);
      else if (f.type === "bandpass") connectFilter("bandpass", f.hz, f.q);
      else if (f.type === "waveshaper")
        connectWaveshaper(f.drive ?? 0.25, f.mix ?? 1);
      else if (f.type === "delay")
        connectDelay(
          f.timeMs ?? 70,
          f.feedback ?? 0.18,
          f.mix ?? 0.1,
          f.highpassHz,
          f.lowpassHz,
        );
      else if (f.type === "compressor") connectCompressor(f);
      else if (f.type === "reverb") {
        const { cleanup: c, output } = this.connectReverb(context, node, f);
        node = output;
        cleanup.push(...c);
      }
    }

    return { cleanup, output: node };
  }

  private connectReverb(
    context: AudioContext,
    input: AudioNode,
    p: Extract<FxSpec, { type: "reverb" }>,
  ): { output: AudioNode; cleanup: (() => void)[] } {
    const cleanup: (() => void)[] = [];
    const mix = clamp(p.mix ?? 0.12, 0, 1);
    const roomMs = clamp(p.roomMs ?? 320, 30, 2000);
    const damping = clamp(p.damping ?? 0.55, 0, 1);

    const key = `r:${roomMs}|d:${damping}|sr:${context.sampleRate}`;
    let impulse = this.reverbCache.get(key);
    if (!impulse) {
      const len = Math.max(1, Math.floor(context.sampleRate * (roomMs / 1000)));
      impulse = context.createBuffer(2, len, context.sampleRate);
      for (let ch = 0; ch < 2; ch += 1) {
        const data = impulse.getChannelData(ch);
        for (let i = 0; i < len; i += 1) {
          const t = i / len;
          const decay = Math.pow(1 - t, 2 + damping * 6);
          data[i] = (Math.random() * 2 - 1) * decay;
        }
      }
      this.reverbCache.set(key, impulse);
    }

    const dry = context.createGain();
    const wet = context.createGain();
    dry.gain.value = 1 - mix;
    wet.gain.value = mix;

    const convolver = context.createConvolver();
    convolver.buffer = impulse;

    // Optional wet filtering
    let wetNode: AudioNode = convolver;
    const filters: BiquadFilterNode[] = [];
    if (p.highpassHz) {
      const hp = context.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = Math.max(10, p.highpassHz);
      wetNode.connect(hp);
      wetNode = hp;
      filters.push(hp);
    }
    if (p.lowpassHz) {
      const lp = context.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = Math.max(10, p.lowpassHz);
      wetNode.connect(lp);
      wetNode = lp;
      filters.push(lp);
    }

    input.connect(dry);
    input.connect(convolver);
    wetNode.connect(wet);

    const sum = context.createGain();
    dry.connect(sum);
    wet.connect(sum);

    cleanup.push(() => dry.disconnect());
    cleanup.push(() => wet.disconnect());
    cleanup.push(() => convolver.disconnect());
    for (const f of filters) cleanup.push(() => f.disconnect());
    cleanup.push(() => sum.disconnect());

    return { cleanup, output: sum };
  }

  private applyLayerEnvelope(
    gain: AudioParam,
    startSec: number,
    layerGain: number,
    attackMs: number | undefined,
    holdMs: number | undefined,
    releaseMs: number | undefined,
  ): number {
    const attackSec = msToSec(attackMs);
    const holdSec = msToSec(holdMs);
    const releaseSec = Math.max(msToSec(releaseMs), 0.001);
    const peakGain = Math.max(LAYER_GAIN_FLOOR, layerGain);
    gain.setValueAtTime(LAYER_GAIN_FLOOR, startSec);
    gain.exponentialRampToValueAtTime(peakGain, startSec + attackSec);
    gain.setValueAtTime(peakGain, startSec + attackSec + holdSec);
    gain.exponentialRampToValueAtTime(
      LAYER_GAIN_FLOOR,
      startSec + attackSec + holdSec + releaseSec,
    );
    return attackSec + holdSec + releaseSec;
  }

  private buildNoiseBuffer(
    context: AudioContext,
    durationSec: number,
  ): AudioBuffer {
    const frameCount = Math.max(
      1,
      Math.floor(context.sampleRate * durationSec),
    );
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i += 1) {
      channel[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private createModeState(tracks: string[], volume: number): ModeAudioState {
    const elements = tracks.map((trackUrl) => {
      const audio = new Audio(trackUrl);
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = 0;
      return audio;
    });
    return {
      audioElements: elements,
      currentIndex: 0,
      positionSec: elements.map(() => 0),
      volume,
    };
  }

  private persistAudioPreferences(): void {
    writeAudioPreferences({
      musicEnabled: this.musicEnabled,
      soundEnabled: this.soundEnabled,
    });
  }

  private applySfxEnabled(): void {
    const context = this.audioContext;
    const gain = this.sfxGain;
    if (!context || !gain) return;
    const now = context.currentTime;
    const targetGain = this.soundEnabled ? BASE_SFX_GAIN : 0;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.setTargetAtTime(targetGain, now, 0.03);
  }

  private stopAllMusic(): void {
    if (typeof window !== "undefined" && this.fadeHandles.size > 0) {
      for (const handle of this.fadeHandles) {
        window.cancelAnimationFrame(handle);
      }
      this.fadeHandles.clear();
    }

    for (const [mode, state] of Object.entries(this.modeState) as [
      MusicMode,
      ModeAudioState,
    ][]) {
      for (const audio of state.audioElements) {
        if (!audio.paused) {
          this.captureAudioPosition(mode, audio);
        }
        audio.volume = 0;
        audio.pause();
      }
    }
  }

  private captureAudioPosition(mode: MusicMode, audio: HTMLAudioElement): void {
    const state = this.modeState[mode];
    const index = state.audioElements.indexOf(audio);
    if (index < 0) return;
    const safe = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    state.positionSec[index] = Math.max(0, safe);
  }

  private restoreAudioPosition(mode: MusicMode, audio: HTMLAudioElement): void {
    const state = this.modeState[mode];
    const index = state.audioElements.indexOf(audio);
    if (index < 0) return;
    const storedTime = state.positionSec[index] ?? 0;
    const seekTime = Math.max(0, storedTime);
    if (audio.readyState >= 1) {
      audio.currentTime = seekTime;
      return;
    }
    const onLoaded = (): void => {
      audio.currentTime = seekTime;
      audio.removeEventListener("loadedmetadata", onLoaded);
    };
    audio.addEventListener("loadedmetadata", onLoaded);
  }

  private fadeAudio(
    audio: HTMLAudioElement,
    from: number,
    to: number,
    durationMs: number,
    onComplete?: () => void,
  ): void {
    if (typeof window === "undefined") return;
    const start = performance.now();
    const fromClamped = clamp(from, 0, 1);
    const toClamped = clamp(to, 0, 1);

    const tick = (now: number, activeHandle: number): void => {
      this.fadeHandles.delete(activeHandle);
      const progress = clamp((now - start) / Math.max(durationMs, 1), 0, 1);
      const eased = 1 - Math.pow(1 - progress, 2);
      audio.volume = lerp(fromClamped, toClamped, eased);
      if (progress >= 1) {
        audio.volume = toClamped;
        onComplete?.();
        return;
      }
      const nextHandle = window.requestAnimationFrame((ts) =>
        tick(ts, nextHandle),
      );
      this.fadeHandles.add(nextHandle);
    };

    const handle = window.requestAnimationFrame((ts) => tick(ts, handle));
    this.fadeHandles.add(handle);
  }
}

let singleton: AudioDirector | null = null;

export const getAudioDirector = (): AudioDirector => {
  singleton ??= new AudioDirector();
  return singleton;
};
