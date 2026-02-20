import Phaser from "phaser";

const MAX_SAMPLES = 12;

const VECTOR_BEVEL_FRAG_SHADER = `
#define SHADER_NAME VECTOR_BEVEL_FS
precision mediump float;
uniform sampler2D uMainSampler;
varying vec2 outTexCoord;
uniform vec2 uTexelSize;
uniform float uDepthPx;
uniform float uShadeAlpha;
uniform vec3 uShadeColor;
uniform int uSamples;
const int MAX = 12;
const float SOLID_ALPHA_MIN = 0.7;
void main ()
{
    vec4 top = texture2D(uMainSampler, outTexCoord);
    vec4 side = vec4(0.0);
    float sampleCount = max(float(uSamples), 1.0);
    for (int i = 1; i <= MAX; i++)
    {
        if (i > uSamples)
        {
            break;
        }
        float t = float(i) / sampleCount;
        vec2 offset = vec2(0.0, uDepthPx * t) * uTexelSize;
        vec4 sampleColor = texture2D(uMainSampler, outTexCoord + offset);
        if (sampleColor.a >= SOLID_ALPHA_MIN)
        {
            side = sampleColor;
            break;
        }
    }
    side.rgb *= uShadeColor;
    side *= uShadeAlpha;
    float topSolid = step(SOLID_ALPHA_MIN, top.a);
    float reveal = 1.0 - topSolid;
    vec4 sideMasked = side * reveal;
    float outA = top.a + sideMasked.a * (1.0 - top.a);
    vec3 outRgb = top.rgb + sideMasked.rgb * (1.0 - top.a);
    gl_FragColor = vec4(outRgb, outA);
}
`;

export const VECTOR_BEVEL_PIPELINE_KEY = "VectorBevelPostFX";

export interface VectorBevelOptions {
  depthPx?: number;
  samples?: number;
  shadeAlpha?: number;
  shadeColor?: number;
}

const clampSampleCount = (value: number): number =>
  Math.max(1, Math.min(MAX_SAMPLES, Math.round(value)));

const toColorVec3 = (color: number): [number, number, number] => [
  ((color >> 16) & 0xff) / 255,
  ((color >> 8) & 0xff) / 255,
  (color & 0xff) / 255,
];

export class VectorBevelPostPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private depthPx = 5;
  private sampleCount = 6;
  private shadeAlpha = 1;
  private shadeColor: [number, number, number] = toColorVec3(0xffffff);

  constructor(game: Phaser.Game) {
    super({
      fragShader: VECTOR_BEVEL_FRAG_SHADER,
      game,
    });
  }

  setOptions(options: VectorBevelOptions): void {
    if (options.depthPx !== undefined) {
      this.depthPx = Math.max(0, options.depthPx);
    }
    if (options.samples !== undefined) {
      this.sampleCount = clampSampleCount(options.samples);
    }
    if (options.shadeAlpha !== undefined) {
      this.shadeAlpha = Math.max(0, Math.min(1, options.shadeAlpha));
    }
    if (options.shadeColor !== undefined) {
      this.shadeColor = toColorVec3(options.shadeColor);
    }
  }

  onDraw(renderTarget: Phaser.Renderer.WebGL.RenderTarget): void {
    const width = Math.max(1, renderTarget.width);
    const height = Math.max(1, renderTarget.height);
    this.set1f("uDepthPx", this.depthPx);
    this.set1f("uShadeAlpha", this.shadeAlpha);
    this.set1i("uSamples", this.sampleCount);
    this.set2f("uTexelSize", 1 / width, 1 / height);
    this.set3f(
      "uShadeColor",
      this.shadeColor[0],
      this.shadeColor[1],
      this.shadeColor[2],
    );
    this.bindAndDraw(renderTarget);
  }
}
