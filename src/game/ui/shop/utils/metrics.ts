export function normalizeMetric(
  value: number,
  min: number,
  max: number,
): number {
  if (max <= min) return 1;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}
