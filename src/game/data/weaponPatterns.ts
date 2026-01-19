export type WeaponPattern =
  | { kind: "angles"; anglesDeg: number[] }
  | { kind: "fan"; count: number; spreadDeg: number };

export const resolveWeaponAngles = (pattern: WeaponPattern): number[] => {
  if (pattern.kind === "angles") return pattern.anglesDeg;
  const count = Math.max(1, Math.floor(pattern.count));
  if (count <= 1) return [0];
  // spreadDeg is the step between bullets to preserve existing behavior.
  const step = pattern.spreadDeg;
  const angles: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const indexOffset = i - (count - 1) / 2;
    angles.push(indexOffset * step);
  }
  return angles;
};
