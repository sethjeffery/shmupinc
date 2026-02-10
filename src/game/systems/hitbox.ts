import type { EnemyHitbox } from "../data/enemyTypes";

export interface CircleHitboxPenetration {
  contactX: number;
  contactY: number;
  depth: number;
  nx: number;
  ny: number;
}

const EPSILON = 0.0001;

const getEllipseBoundaryDistance = (
  radiusX: number,
  radiusY: number,
  nx: number,
  ny: number,
): number => {
  const denom = Math.sqrt(
    (nx * nx) / (radiusX * radiusX) + (ny * ny) / (radiusY * radiusY),
  );
  return denom > EPSILON ? 1 / denom : Math.max(radiusX, radiusY);
};

export const hitboxMaxRadius = (hitbox: EnemyHitbox): number =>
  hitbox.kind === "circle"
    ? hitbox.radius
    : Math.max(hitbox.radiusX, hitbox.radiusY);

export const resolveCircleHitboxPenetration = (
  circleX: number,
  circleY: number,
  circleRadius: number,
  hitboxX: number,
  hitboxY: number,
  hitbox: EnemyHitbox,
): CircleHitboxPenetration | null => {
  const dx = circleX - hitboxX;
  const dy = circleY - hitboxY;

  if (hitbox.kind === "circle") {
    const totalRadius = circleRadius + hitbox.radius;
    const distSq = dx * dx + dy * dy;
    if (distSq >= totalRadius * totalRadius) return null;
    const dist = Math.sqrt(distSq);
    const nx = dist > EPSILON ? dx / dist : 1;
    const ny = dist > EPSILON ? dy / dist : 0;
    const depth = totalRadius - dist;
    return {
      contactX: circleX - nx * circleRadius,
      contactY: circleY - ny * circleRadius,
      depth,
      nx,
      ny,
    };
  }

  const expandedRadiusX = hitbox.radiusX + circleRadius;
  const expandedRadiusY = hitbox.radiusY + circleRadius;
  const norm =
    (dx * dx) / (expandedRadiusX * expandedRadiusX) +
    (dy * dy) / (expandedRadiusY * expandedRadiusY);
  if (norm >= 1) return null;

  const dist = Math.sqrt(dx * dx + dy * dy);
  const nx = dist > EPSILON ? dx / dist : 1;
  const ny = dist > EPSILON ? dy / dist : 0;
  const boundaryDist = getEllipseBoundaryDistance(
    expandedRadiusX,
    expandedRadiusY,
    nx,
    ny,
  );
  const depth = Math.max(0, boundaryDist - dist);
  if (depth <= EPSILON) return null;
  return {
    contactX: circleX - nx * circleRadius,
    contactY: circleY - ny * circleRadius,
    depth,
    nx,
    ny,
  };
};

export const circleHitboxOverlap = (
  circleX: number,
  circleY: number,
  circleRadius: number,
  hitboxX: number,
  hitboxY: number,
  hitbox: EnemyHitbox,
): boolean =>
  Boolean(
    resolveCircleHitboxPenetration(
      circleX,
      circleY,
      circleRadius,
      hitboxX,
      hitboxY,
      hitbox,
    ),
  );
