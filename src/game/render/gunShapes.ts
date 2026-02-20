import type { GunDefinition } from "../data/gunTypes";
import type Phaser from "phaser";

import { drawVectorToGraphics } from "./vector/drawPhaser";
import { computeVectorBevelDepthPx } from "./vector/vectorBevelFx";

export const drawGunToGraphics = (
  graphics: Phaser.GameObjects.Graphics,
  gun: GunDefinition,
  x: number,
  y: number,
  size: number,
  accent: number,
  mirror = false,
  rotationRad = 0,
): void => {
  void accent;
  const bevelDepth = computeVectorBevelDepthPx(size, 2, 5);
  drawVectorToGraphics(
    graphics,
    gun.vector,
    { mirror, rotationRad, scale: size, x, y },
    { bevel: { depthPx: bevelDepth, layerAlpha: 0.96 }, lineWidth: 1.5 },
  );
};
