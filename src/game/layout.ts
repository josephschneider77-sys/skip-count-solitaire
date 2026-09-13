export const CARD_W = 1.42;
export const CARD_H = 2.02;
export const CARD_D = 0.05;
export const CARD_LEAN = -0.16;

export type LayoutMetrics = {
  colGap: number;
  cascade: number;
  topZ: number;
  tableauZ0: number;
  wasteFan: number;
};

export function layoutForAspect(aspect: number): LayoutMetrics {
  if (aspect < 0.68) {
    return { colGap: 1.16, cascade: 0.33, topZ: -2.12, tableauZ0: 0.1, wasteFan: 0.08 };
  }
  if (aspect < 0.9) {
    return { colGap: 1.3, cascade: 0.36, topZ: -2.28, tableauZ0: 0.14, wasteFan: 0.12 };
  }
  if (aspect < 1.15) {
    return { colGap: 1.46, cascade: 0.38, topZ: -2.45, tableauZ0: 0.18, wasteFan: 0.16 };
  }
  return { colGap: 1.54, cascade: 0.4, topZ: -2.55, tableauZ0: 0.2, wasteFan: 0.18 };
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

/** More overhead than side-on so card faces read flat toward the player. */
export function cameraDirection(aspect: number): { x: number; y: number; z: number } {
  if (aspect < 0.75) return normalize3(0, 1.35, 0.42);
  if (aspect < 1) return normalize3(0, 1.28, 0.48);
  return normalize3(0, 1.22, 0.52);
}
