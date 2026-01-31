import Phaser from "phaser";

export const PLAYFIELD_BASE_WIDTH = 450;
export const PLAYFIELD_BASE_HEIGHT = 800;
export const PLAYFIELD_CORNER_RADIUS = 18;
export const PLAYFIELD_MARGIN = 10;

export const computePlayArea = (
  width: number,
  height: number,
): Phaser.Geom.Rectangle => {
  const availableWidth = Math.max(0, width - PLAYFIELD_MARGIN * 2);
  const availableHeight = Math.max(0, height - PLAYFIELD_MARGIN * 2);
  const scale = Math.min(
    availableWidth / PLAYFIELD_BASE_WIDTH,
    availableHeight / PLAYFIELD_BASE_HEIGHT,
  );
  const playWidth = Math.round(PLAYFIELD_BASE_WIDTH * scale);
  const playHeight = Math.round(PLAYFIELD_BASE_HEIGHT * scale);
  const x = Math.round(PLAYFIELD_MARGIN + (availableWidth - playWidth) / 2);
  const y = Math.round(PLAYFIELD_MARGIN + (availableHeight - playHeight) / 2);
  return new Phaser.Geom.Rectangle(x, y, playWidth, playHeight);
};
