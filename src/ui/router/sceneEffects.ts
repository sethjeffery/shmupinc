import type { UiRoute } from "../router";
import type Phaser from "phaser";

const sceneExists = (game: Phaser.Game, sceneKey: string): boolean => {
  const manager = game.scene as Phaser.Scenes.SceneManager & {
    keys?: Record<string, Phaser.Scene | undefined>;
  };
  return Boolean(manager.keys?.[sceneKey]);
};

const ensureSceneLoaded = async (
  game: Phaser.Game,
  sceneKey: "PlayScene" | "ShopScene",
): Promise<void> => {
  if (sceneExists(game, sceneKey)) return;
  if (sceneKey === "PlayScene") {
    const { PlayScene } = await import("../../game/scenes/PlayScene");
    if (!sceneExists(game, sceneKey)) {
      game.scene.add(sceneKey, PlayScene, false);
    }
    return;
  }
  const { ShopScene } = await import("../../game/scenes/ShopScene");
  if (!sceneExists(game, sceneKey)) {
    game.scene.add(sceneKey, ShopScene, false);
  }
};

export const setPlayInputEnabled = (
  game: Phaser.Game,
  enabled: boolean,
): void => {
  if (!sceneExists(game, "PlayScene")) return;
  const input = game.scene.getScene("PlayScene")?.input;
  if (input) input.enabled = enabled;
};

export const pausePlayScene = (game: Phaser.Game): void => {
  if (game.scene.isActive("PlayScene")) {
    game.scene.pause("PlayScene");
    setPlayInputEnabled(game, false);
  }
};

export const stopPlayScene = (game: Phaser.Game): void => {
  if (sceneExists(game, "PlayScene") && game.scene.isActive("PlayScene")) {
    game.scene.stop("PlayScene");
  }
};

export const stopShopScene = (game: Phaser.Game): void => {
  if (sceneExists(game, "ShopScene") && game.scene.isActive("ShopScene")) {
    game.scene.stop("ShopScene");
  }
};

export const startOrResumePlayScene = async (params: {
  game: Phaser.Game;
  previous: UiRoute;
  restart: boolean;
  shouldAbort: () => boolean;
}): Promise<void> => {
  await ensureSceneLoaded(params.game, "PlayScene");
  await ensureSceneLoaded(params.game, "ShopScene");
  if (params.shouldAbort()) return;

  params.game.scene.stop("ShopScene");
  if (params.game.scene.isActive("BootScene")) {
    params.game.scene.stop("BootScene");
  }

  if (
    !params.restart &&
    params.previous === "pause" &&
    params.game.scene.isPaused("PlayScene")
  ) {
    params.game.scene.resume("PlayScene");
    setPlayInputEnabled(params.game, true);
    return;
  }

  params.game.scene.start("PlayScene");
  setPlayInputEnabled(params.game, true);
};

export const openHangarScene = async (params: {
  game: Phaser.Game;
  shouldAbort: () => boolean;
}): Promise<void> => {
  await ensureSceneLoaded(params.game, "ShopScene");
  if (params.shouldAbort()) return;
  stopPlayScene(params.game);
  params.game.scene.start("ShopScene");
};
