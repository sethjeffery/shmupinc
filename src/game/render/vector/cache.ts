import type { VectorShape } from "../../data/vectorShape";
import type { CompiledVectorShape, VectorBounds } from "./compile";

import { compileVectorShape } from "./compile";

const compiledShapeCache = new WeakMap<VectorShape, CompiledVectorShape>();

export const getCompiledVectorShape = (
  shape: VectorShape,
): CompiledVectorShape => {
  const cached = compiledShapeCache.get(shape);
  if (cached) return cached;
  const compiled = compileVectorShape(shape);
  compiledShapeCache.set(shape, compiled);
  return compiled;
};

export const getVectorBounds = (shape: VectorShape): VectorBounds =>
  getCompiledVectorShape(shape).bounds;
