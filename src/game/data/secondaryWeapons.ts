import type { SecondaryWeaponDefinition } from "./secondaryWeaponTypes";

import { getContentRegistry } from "../../content/registry";
import {
  BULLET_BOMB_MICRO_PLAYER,
  BULLET_BOMB_MICRO_GUIDED_PLAYER,
  BULLET_DART_PLAYER,
  BULLET_DART_RAPID_PLAYER,
  BULLET_MISSILE_MINI_PLAYER,
  BULLET_ORB_FLARE_PLAYER,
  BULLET_ORB_SPREAD_PLAYER,
} from "./bullets";

export const LEGACY_SECONDARY_WEAPONS: Record<string, SecondaryWeaponDefinition> = {
  crossDarts: {
    bullet: BULLET_DART_PLAYER,
    cost: 210,
    description: "Crossing dart fan for crowd control.",
    fireRate: 2.1,
    id: "crossDarts",
    name: "Cross Darts",
    pattern: { anglesDeg: [-45, -15, 15, 45], kind: "angles" },
  },
  crossDartsPlus: {
    bullet: BULLET_DART_PLAYER,
    cost: 270,
    description: "Super spreader!",
    fireRate: 5,
    id: "crossDartsPlus",
    name: "Cross Darts+",
    pattern: { anglesDeg: [-60, -40, -20, 20, 40, 60], kind: "angles" },
  },
  flareOrbs: {
    bullet: BULLET_ORB_FLARE_PLAYER,
    cost: 190,
    description: "Three hot flares with a tight spread.",
    fireRate: 3.2,
    id: "flareOrbs",
    name: "Flare Orbs",
    pattern: { anglesDeg: [-15, 0, 15], kind: "angles" },
  },
  guidedMicroBombs: {
    bullet: BULLET_BOMB_MICRO_GUIDED_PLAYER,
    cost: 330,
    description: "Guided mini-bombs with a splash.",
    fireRate: 1.4,
    id: "guidedMicroBombs",
    name: "Guided Micro Bombs",
    pattern: { anglesDeg: [-60, 60], kind: "angles" },
  },
  haloOrbs: {
    bullet: BULLET_ORB_SPREAD_PLAYER,
    cost: 180,
    description: "Tight halo of paired orbs.",
    fireRate: 3.4,
    id: "haloOrbs",
    name: "Halo Orbs",
    pattern: { anglesDeg: [-12, 12], kind: "angles" },
  },
  microBombs: {
    bullet: BULLET_BOMB_MICRO_PLAYER,
    cost: 230,
    description: "Tiny bombs with a splashy finish.",
    fireRate: 1.3,
    id: "microBombs",
    name: "Micro Bombs",
    pattern: { anglesDeg: [-40, 40, 180], kind: "angles" },
  },
  miniMissiles: {
    bullet: BULLET_MISSILE_MINI_PLAYER,
    cost: 180,
    description: "Light homing pair at wide angles.",
    fireRate: 1.8,
    id: "miniMissiles",
    muzzleOffsets: [
      { x: -0.75, y: 0 },
      { x: 0.75, y: 0 },
    ],
    name: "Mini-Missiles",
    pattern: { anglesDeg: [-20, 20], kind: "angles" },
  },
  needleDarts: {
    bullet: BULLET_DART_RAPID_PLAYER,
    cost: 230,
    description: "Five narrow darts for lane pressure.",
    fireRate: 3.6,
    id: "needleDarts",
    name: "Needle Darts",
    pattern: { anglesDeg: [-8, -4, 0, 4, 8], kind: "angles" },
  },
  rapidDarts: {
    bullet: BULLET_DART_RAPID_PLAYER,
    cost: 210,
    description: "Fast twin darts, straight ahead.",
    fireRate: 5.6,
    id: "rapidDarts",
    muzzleOffsets: [
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ],
    name: "Rapid Darts",
    pattern: { anglesDeg: [0, 0], kind: "angles" },
  },
  sideCannons: {
    bullet: BULLET_DART_PLAYER,
    cost: 170,
    description: "Wide-angle darts for side coverage.",
    fireRate: 4.8,
    id: "sideCannons",
    muzzleOffsets: [
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ],
    name: "Side Cannons",
    pattern: { anglesDeg: [-90, 90], kind: "angles" },
  },
  sideCannonsPlus: {
    bullet: BULLET_DART_PLAYER,
    cost: 240,
    description: "No one gets past.",
    fireRate: 7.5,
    id: "sideCannonsPlus",
    muzzleOffsets: [
      { x: -1, y: 0 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0 },
    ],
    name: "Side Cannons+",
    pattern: { anglesDeg: [-95, -85, 85, 95], kind: "angles" },
  },
  spreadOrbs: {
    bullet: BULLET_ORB_SPREAD_PLAYER,
    cost: 190,
    description: "Four orb spread with soft arcs.",
    fireRate: 2.0,
    id: "spreadOrbs",
    name: "Spread Orbs",
    pattern: { anglesDeg: [-40, -20, 20, 40], kind: "angles" },
  },
  stingerMissiles: {
    bullet: BULLET_MISSILE_MINI_PLAYER,
    cost: 250,
    description: "Tri-missile pod with sharp tracking.",
    fireRate: 1.4,
    id: "stingerMissiles",
    name: "Stinger Missiles",
    pattern: { anglesDeg: [-25, 0, 25], kind: "angles" },
  },
};

const contentSecondaryWeapons = getContentRegistry().secondaryWeaponsById;

export const SECONDARY_WEAPONS: Record<string, SecondaryWeaponDefinition> =
  Object.keys(contentSecondaryWeapons).length > 0
    ? contentSecondaryWeapons
    : LEGACY_SECONDARY_WEAPONS;

export type { SecondaryWeaponDefinition, SecondaryWeaponId } from "./secondaryWeaponTypes";
