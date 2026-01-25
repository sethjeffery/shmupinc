import type { WaveDefinition } from "../waves";
import type { HazardScript, LevelDefinition } from "./types";

const SQUEEZE_WAVES: WaveDefinition[] = [
  {
    id: "squeeze-entry",
    spawns: [
      { atMs: 0, enemyId: "crossfire", x: 0.2, y: -0.14 },
      { atMs: 700, enemyId: "crossfire", x: 0.8, y: -0.14 },
      { atMs: 2500, enemyId: "swooper", x: 0.5, y: -0.18 },
      { atMs: 5200, enemyId: "crossfire", x: 0.5, y: -0.14 },
      { atMs: 8200, enemyId: "swooper", x: 0.25, y: -0.18 },
      { atMs: 10000, enemyId: "swooper", x: 0.75, y: -0.18 },
      { atMs: 13500, enemyId: "crossfire", x: 0.2, y: -0.14 },
      { atMs: 15000, enemyId: "crossfire", x: 0.8, y: -0.14 },
      { atMs: 19000, enemyId: "swooper", x: 0.5, y: -0.18 },
    ],
  },
  {
    id: "squeeze-lock",
    spawns: [
      { atMs: 0, enemyId: "crossfire", x: 0.5, y: -0.14 },
      { atMs: 1200, enemyId: "swooper", x: 0.25, y: -0.18 },
      { atMs: 2400, enemyId: "swooper", x: 0.75, y: -0.18 },
      { atMs: 6000, enemyId: "crossfire", x: 0.2, y: -0.14 },
      { atMs: 7400, enemyId: "crossfire", x: 0.8, y: -0.14 },
      { atMs: 11000, enemyId: "swooper", x: 0.5, y: -0.18 },
      { atMs: 15000, enemyId: "crossfire", x: 0.5, y: -0.14 },
      { atMs: 18000, enemyId: "swooper", x: 0.2, y: -0.18 },
      { atMs: 20000, enemyId: "swooper", x: 0.8, y: -0.18 },
      { atMs: 26000, enemyId: "crossfire", x: 0.5, y: -0.14 },
    ],
  },
];

const SQUEEZE_HAZARDS: HazardScript[] = [
  {
    damageOnTouch: true,
    fillColor: 0x0b1220,
    h: 0.92,
    lineColor: 0x1b3149,
    motion: {
      amplitude: 0.12,
      axis: "x",
      kind: "sine",
      periodMs: 16000,
      phase: 0,
    },
    type: "laneWall",
    w: 0.18,
    x: 0.08,
    y: 0.5,
  },
  {
    damageOnTouch: true,
    fillColor: 0x0b1220,
    h: 0.92,
    lineColor: 0x1b3149,
    motion: {
      amplitude: 0.12,
      axis: "x",
      kind: "sine",
      periodMs: 16000,
      phase: Math.PI,
    },
    type: "laneWall",
    w: 0.18,
    x: 0.92,
    y: 0.5,
  },
];

export const L2_SQUEEZE: LevelDefinition = {
  endCondition: { kind: "clearWaves" },
  hazards: SQUEEZE_HAZARDS,
  id: "L2_SQUEEZE",
  postBeatId: "beat_squeeze_post",
  preBeatId: "beat_squeeze_pre",
  pressureProfile: {
    primary: "space",
    secondary: ["enemy", "focus"],
  },
  shopRules: {
    allowedSecondaryWeapons: [
      "haloOrbs",
      "miniMissiles",
      "rapidDarts",
      "sideCannons",
    ],
    allowedShips: ["starter", "scout", "interceptor"],
    allowedWeapons: [
      "dartGun",
      "orbBlaster",
      "orbBlasterPlus",
      "pulseArray",
    ],
    caps: {
      primaryCost: 260,
      secondaryCost: 220,
      shipCost: 220,
    },
  },
  title: "The Squeeze",
  waves: SQUEEZE_WAVES,
  winCondition: { kind: "clearWaves" },
};
