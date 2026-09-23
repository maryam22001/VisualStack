export const GRID_SIZE = 20;

/**
 * Snaps a coordinate value to the nearest grid step.
 */
export function snapToGrid(value: number, step: number = GRID_SIZE): number {
  return Math.round(value / step) * step;
}

/**
 * Snaps 2D coordinates (x, y) to the grid.
 */
export function snapPoint(x: number, y: number, step: number = GRID_SIZE): { x: number; y: number } {
  return {
    x: snapToGrid(x, step),
    y: snapToGrid(y, step)
  };
}