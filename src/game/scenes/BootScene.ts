import Phaser from "phaser";

import {
  VectorBevelPostPipeline,
  VECTOR_BEVEL_PIPELINE_KEY,
} from "../render/vector/vectorBevelPostPipeline";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    this.cameras.main.setBackgroundColor("#05060a");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#05060a");
    if (this.game.renderer.type === Phaser.WEBGL) {
      const renderer = this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
      renderer.pipelines.addPostPipeline(
        VECTOR_BEVEL_PIPELINE_KEY,
        VectorBevelPostPipeline,
      );
    }
  }
}
