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

export interface DiagramPoint {
  x: number;
  y: number;
}

export function getDefaultConnectorBend(
  from: DiagramPoint,
  to: DiagramPoint,
  index = 0
): DiagramPoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const offset = Math.min(72, Math.max(28, distance * 0.16)) * (index % 2 === 0 ? 1 : -1);
  const normalX = distance === 0 ? 0 : -dy / distance;
  const normalY = distance === 0 ? -1 : dx / distance;

  return {
    x: (from.x + to.x) / 2 + normalX * offset,
    y: (from.y + to.y) / 2 + normalY * offset
  };
}

export function getQuadraticConnectorPath(
  from: DiagramPoint,
  to: DiagramPoint,
  bend: DiagramPoint
): string {
  const controlX = 2 * bend.x - (from.x + to.x) / 2;
  const controlY = 2 * bend.y - (from.y + to.y) / 2;
  return `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`;
}