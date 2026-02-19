import type { MountAssignment } from "../../data/save";
import type { ShipDefinition } from "../../data/shipTypes";

export interface NodeGraphPoint {
  x: number;
  y: number;
}

interface NodeGraphLayout {
  mountPoints: Map<string, NodeGraphPoint>;
  modPoints: Map<string, NodeGraphPoint[]>;
  shipPoint: NodeGraphPoint;
  worldHeight: number;
  worldWidth: number;
}

const MAX_RENDERED_WEAPON_MOUNTS = 3;
export const MAX_RENDERED_MOD_SLOTS = 2;

const getAngleVector = (angleDegrees: number): NodeGraphPoint => {
  const radians = (angleDegrees * Math.PI) / 180;
  return {
    x: Math.sin(radians),
    y: -Math.cos(radians),
  };
};

const getMountBranchAngles = (count: number): number[] => {
  if (count <= 0) return [];
  if (count === 1) return [0];
  if (count === 2) return [-35, 35];
  return [-90, 0, 90];
};

const getModBranchAngles = (count: number): number[] => {
  if (count <= 0) return [];
  if (count === 1) return [0];
  return [-45, 45];
};

export const getVisibleMounts = (ship: ShipDefinition) =>
  ship.mounts.slice(0, MAX_RENDERED_WEAPON_MOUNTS);

export const createNodeGraphLayout = (
  ship: ShipDefinition,
  assignments: MountAssignment[],
): NodeGraphLayout => {
  const visibleMounts = getVisibleMounts(ship);
  const mountAssignmentById = new Map(
    assignments.map((assignment) => [assignment.mountId, assignment]),
  );
  const mountAngles = getMountBranchAngles(visibleMounts.length);
  const mountDistance = 160;
  const modDistance = 160;
  const shipHalfSize = { h: 96, w: 96 };
  const nodeHalfSize = { h: 72, w: 98 };

  let minX = -shipHalfSize.w;
  let maxX = shipHalfSize.w;
  let minY = -shipHalfSize.h;
  let maxY = shipHalfSize.h;
  const includePointBounds = (
    point: NodeGraphPoint,
    halfSize: { h: number; w: number },
  ): void => {
    minX = Math.min(minX, point.x - halfSize.w);
    maxX = Math.max(maxX, point.x + halfSize.w);
    minY = Math.min(minY, point.y - halfSize.h);
    maxY = Math.max(maxY, point.y + halfSize.h);
  };

  const shipLocalPoint = { x: 0, y: 0 };
  const mountLocalPoints = new Map<string, NodeGraphPoint>();
  const modLocalPoints = new Map<string, NodeGraphPoint[]>();

  visibleMounts.forEach((mount, index) => {
    const branchAngle = mountAngles[index] ?? 0;
    const branchVector = getAngleVector(branchAngle);
    const mountPoint = {
      x: shipLocalPoint.x + branchVector.x * mountDistance,
      y: shipLocalPoint.y + branchVector.y * mountDistance,
    };
    mountLocalPoints.set(mount.id, mountPoint);
    includePointBounds(mountPoint, nodeHalfSize);

    const mountAssignment = mountAssignmentById.get(mount.id);
    const modCount = mountAssignment?.weaponInstanceId
      ? Math.min(mount.modSlots, MAX_RENDERED_MOD_SLOTS)
      : 0;
    const modBranchOffsets = getModBranchAngles(modCount);
    const mountModPoints: NodeGraphPoint[] = [];
    modBranchOffsets.forEach((offset) => {
      const modAngle = branchAngle + offset;
      const modVector = getAngleVector(modAngle);
      const modPoint = {
        x: mountPoint.x + modVector.x * modDistance,
        y: mountPoint.y + modVector.y * modDistance,
      };
      mountModPoints.push(modPoint);
      includePointBounds(modPoint, nodeHalfSize);
    });
    modLocalPoints.set(mount.id, mountModPoints);
  });

  const framePadding = { x: 180, y: 180 };
  const coreWidth = maxX - minX;
  const coreHeight = maxY - minY;
  const baseWidth = coreWidth + framePadding.x * 2;
  const baseHeight = coreHeight + framePadding.y * 2;
  const worldWidth = Math.max(1020, baseWidth);
  const worldHeight = Math.max(820, baseHeight);
  const extraX = (worldWidth - baseWidth) * 0.5;
  const extraY = (worldHeight - baseHeight) * 0.5;
  const shiftX = -minX + framePadding.x + extraX;
  const shiftY = -minY + framePadding.y + extraY;

  const mountPoints = new Map<string, NodeGraphPoint>();
  for (const [mountId, point] of mountLocalPoints) {
    mountPoints.set(mountId, {
      x: point.x + shiftX,
      y: point.y + shiftY,
    });
  }

  const modPoints = new Map<string, NodeGraphPoint[]>();
  for (const [mountId, points] of modLocalPoints) {
    modPoints.set(
      mountId,
      points.map((point) => ({ x: point.x + shiftX, y: point.y + shiftY })),
    );
  }

  const shipPoint = {
    x: shipLocalPoint.x + shiftX,
    y: shipLocalPoint.y + shiftY,
  };

  return {
    modPoints,
    mountPoints,
    shipPoint,
    worldHeight,
    worldWidth,
  };
};
