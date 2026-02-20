import Phaser from "phaser";

import { VectorBevelPostPipeline } from "./vectorBevelPostPipeline";
import {
  type VectorBevelOptions,
  VECTOR_BEVEL_PIPELINE_KEY,
} from "./vectorBevelPostPipeline";

const isWebGlRenderer = (graphics: Phaser.GameObjects.Graphics): boolean =>
  graphics.scene.game.renderer.type === Phaser.WEBGL;

const getVectorBevelPipeline = (
  graphics: Phaser.GameObjects.Graphics,
): undefined | VectorBevelPostPipeline => {
  const pipeline = graphics.getPostPipeline(VECTOR_BEVEL_PIPELINE_KEY);
  if (Array.isArray(pipeline)) {
    return pipeline.find(
      (entry): entry is VectorBevelPostPipeline =>
        entry instanceof VectorBevelPostPipeline,
    );
  }
  if (pipeline instanceof VectorBevelPostPipeline) return pipeline;
  return undefined;
};

export const applyVectorBevelFx = (
  graphics: Phaser.GameObjects.Graphics,
  options: VectorBevelOptions,
): void => {
  if (!isWebGlRenderer(graphics)) return;
  let pipeline = getVectorBevelPipeline(graphics);
  if (!pipeline) {
    graphics.setPostPipeline(VECTOR_BEVEL_PIPELINE_KEY);
    pipeline = getVectorBevelPipeline(graphics);
  }
  if (!pipeline) return;
  pipeline.setOptions(options);
};

export const computeVectorBevelDepthPx = (
  radius: number,
  minDepth = 4,
  maxDepth = 8,
): number => {
  if (radius <= 0) return minDepth;
  const scaled = Math.round(radius * 0.32);
  return Phaser.Math.Clamp(scaled, minDepth, maxDepth);
};
