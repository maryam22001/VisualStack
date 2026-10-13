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

export function getOrthogonalPathMidpoint(
  from: { x: number; y: number },
  to: { x: number; y: number }
): { x: number; y: number } {
  const midX = (from.x + to.x) / 2;
  const points = [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to];
  const segments = points.slice(1).map((point, index) => {
    const start = points[index];
    return {
      start,
      end: point,
      length: Math.abs(point.x - start.x) + Math.abs(point.y - start.y)
    };
  });
  const halfLength = segments.reduce((total, segment) => total + segment.length, 0) / 2;
  let traversed = 0;

  for (const segment of segments) {
    if (traversed + segment.length >= halfLength) {
      const ratio = segment.length === 0 ? 0 : (halfLength - traversed) / segment.length;
      return {
        x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
        y: segment.start.y + (segment.end.y - segment.start.y) * ratio
      };
    }
    traversed += segment.length;
  }

  return to;
}