import type { Bullet } from "../../entities/Bullet";
import type { Enemy } from "../../entities/Enemy";
import type { PickupGold } from "../../entities/PickupGold";
import type { ObjectPool } from "../../util/pool";
import type Phaser from "phaser";

export interface GameOverEventPayload {
  gold: number;
  wave: number;
}

export const bankRunGoldOnce = (
  gold: number,
  goldBanked: boolean,
  bankGold: (amount: number) => void,
): boolean => {
  if (goldBanked) return true;
  bankGold(gold);
  return true;
};

export const clearWaveEntitiesRuntime = (context: {
  enemies: Enemy[];
  enemyPool: Enemy[];
  enemyBullets: ObjectPool<Bullet>;
  goldPickups: ObjectPool<PickupGold>;
  playerBullets: ObjectPool<Bullet>;
}): void => {
  for (const enemy of context.enemies) {
    enemy.deactivate();
    context.enemyPool.push(enemy);
  }
  context.enemies.length = 0;
  context.playerBullets.forEachActive((bullet) => bullet.deactivate());
  context.enemyBullets.forEachActive((bullet) => bullet.deactivate());
  context.goldPickups.forEachActive((pickup) => pickup.deactivate());
};

export const emitGameOverEvent = (
  game: Phaser.Game,
  payload: GameOverEventPayload,
): void => {
  game.events.emit("ui:gameover", payload);
};

export const emitVictoryRoute = (
  game: Phaser.Game,
  postBeatId: string | undefined,
  nextRoute: "menu" | "progression" = "menu",
): void => {
  if (postBeatId) {
    game.events.emit("ui:story", {
      beatId: postBeatId,
      clearLevelOnExit: true,
      nextRoute,
    });
    return;
  }
  game.events.emit("ui:route", nextRoute);
};
