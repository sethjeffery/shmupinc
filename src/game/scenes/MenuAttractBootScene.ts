import Phaser from "phaser";

import {
  VectorBevelPostPipeline,
  VECTOR_BEVEL_PIPELINE_KEY,
} from "../render/vector/vectorBevelPostPipeline";

export class MenuAttractBootScene extends Phaser.Scene {
  constructor() {
    super("MenuAttractBootScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#04060a");
    if (this.game.renderer.type === Phaser.WEBGL) {
      const renderer = this.game
        .renderer as Phaser.Renderer.WebGL.WebGLRenderer;
      renderer.pipelines.addPostPipeline(
        VECTOR_BEVEL_PIPELINE_KEY,
        VectorBevelPostPipeline,
      );
    }
    this.scene.start("MenuAttractScene");
  }
}
