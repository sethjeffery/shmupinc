import type { GunDefinition } from "../data/gunTypes";
import type Phaser from "phaser";

import { drawVectorToGraphics } from "./vector/drawPhaser";

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
  drawVectorToGraphics(
    graphics,
    gun.vector,
    { mirror, rotationRad, scale: size, x, y },
    { lineWidth: 1.5 },
  );
};
