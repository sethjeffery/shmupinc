export const formatCost = (cost: number, resourceId: string): string =>
  resourceId === "gold" ? `${cost}g` : `${cost} ${resourceId}`;

export const formatColor = (color: number): string =>
  `#${color.toString(16).padStart(6, "0")}`;
