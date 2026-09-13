export const CARD_W = 1.42;
export const CARD_H = 2.02;
export const CARD_D = 0.05;
/** Almost flat on the table so faces point up at a top-down camera. */
export const CARD_LEAN = -Math.PI / 2 + 0.16;
export const CARD_Y = 0.06;

export type LayoutMetrics = {
  colGap: number;
  cascade: number;
  topZ: number;
  tableauZ0: number;
  wasteFan: number;
};

export function layoutForAspect(aspect: number): LayoutMetrics {
  if (aspect < 0.68) {
    return { colGap: 1.16, cascade: 0.52, topZ: -2.35, tableauZ0: 0.15, wasteFan: 0.1 };
  }
  if (aspect < 0.9) {
    return { colGap: 1.32, cascade: 0.55, topZ: -2.5, tableauZ0: 0.18, wasteFan: 0.14 };
  }
  if (aspect < 1.15) {
    return { colGap: 1.48, cascade: 0.58, topZ: -2.65, tableauZ0: 0.22, wasteFan: 0.16 };
  }
  return { colGap: 1.56, cascade: 0.6, topZ: -2.75, tableauZ0: 0.25, wasteFan: 0.18 };
}

export function columnX(column: number, colGap: number): number {
  return (column - 3) * colGap;
}

export function ndcSideMargin(aspect: number): number {
  if (aspect < 0.68) return 0.04;
  if (aspect < 1) return 0.06;
  return 0.08;
}

function normalize3(x: number, y: number, z: number): { x: number; y: number; z: number } {
  const length = Math.hypot(x, y, z) || 1;
  return { x: x / length, y: y / length, z: z / length };
}

/** Nearly straight down; a tiny +Z keeps the table oriented toward the player. */
export function cameraDirection(aspect: number): { x: number; y: number; z: number } {
  void aspect;
  return normalize3(0, 1, 0.08);
}

export function orthoHalfExtents(
  boardW: number,
  boardD: number,
  aspect: number,
  side: number,
  top: number,
  bottom: number,
): { halfW: number; halfH: number } {
  let halfW = boardW / (2 * Math.max(0.25, 1 - side));
  let halfH = boardD / (2 * Math.max(0.25, 1 - (top + bottom) / 2));
  if (halfW / Math.max(halfH, 0.01) < aspect) halfW = halfH * aspect;
  else halfH = halfW / Math.max(aspect, 0.01);
  return { halfW, halfH };
}
