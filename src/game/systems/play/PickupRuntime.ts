import type { PickupGold } from "../../entities/PickupGold";
import type { ObjectPool } from "../../util/pool";
import type Phaser from "phaser";

import { circleOverlap } from "../Collision";

interface UpdatePickupsRuntimeContext {
  delta: number;
  goldPickups: ObjectPool<PickupGold>;
  magnetRadius: number;
  onCollected: (value: number) => void;
  playArea: Phaser.Geom.Rectangle;
  playerAlive: boolean;
  playerRadius: number;
  playerX: number;
  playerY: number;
}

export const updatePickupsRuntime = (
  context: UpdatePickupsRuntimeContext,
): void => {
  context.goldPickups.forEachActive((pickup) => {
    pickup.update(
      context.delta,
      context.playArea,
      context.playerX,
      context.playerY,
      context.playerAlive ? context.magnetRadius : 0,
    );
    if (!context.playerAlive) return;

    const collected = circleOverlap(
      pickup.x,
      pickup.y,
      pickup.radius,
      context.playerX,
      context.playerY,
      context.playerRadius,
    );
    if (!collected) return;

    context.onCollected(pickup.value);
    pickup.deactivate();
  });
};
