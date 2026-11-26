export type Point = [number, number];
export type NodeObstacle = { id: string; point: Point };

// Slightly smaller than mapgen's 3.2 × 2.1 node spacing, leaving a corridor between markers.
const HALF_W = 1.45;
const HALF_H = 0.9;

function crosses(a: Point, b: Point, center: Point): boolean {
  // Slab intersection with the rectangle's interior; touching a routing corner is permitted.
  let enter = 0;
  let leave = 1;
  for (const [axis, half] of [[0, HALF_W], [1, HALF_H]] as const) {
    const min = center[axis] - half + 1e-6;
    const max = center[axis] + half - 1e-6;
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-9) {
      if (a[axis] <= min || a[axis] >= max) return false;
    } else {
      const first = (min - a[axis]) / delta;
      const last = (max - a[axis]) / delta;
      enter = Math.max(enter, Math.min(first, last));
      leave = Math.min(leave, Math.max(first, last));
      if (enter >= leave) return false;
    }
  }
  return enter < leave;
}

/** A shortest visible polyline around intervening markers; endpoints are not obstacles. */
export function routeLinkAroundNodes(a: Point, b: Point, obstacles: NodeObstacle[]): Point[] {
  let path: Point[] = [a, b];
  const active = new Set<NodeObstacle>();
  // Add only obstacles met by the current route. Long links need not build a graph of the whole world.
  for (let pass = 0; pass <= obstacles.length; pass++) {
    const blockers = obstacles.filter((o) => path.some((p, i) => i > 0 && crosses(path[i - 1], p, o.point)));
    if (!blockers.length) return path;
    for (const o of blockers) active.add(o);
    const points: Point[] = [a, b];
    for (const { point: [x, z] } of active) {
      points.push([x - HALF_W, z - HALF_H], [x - HALF_W, z + HALF_H], [x + HALF_W, z - HALF_H], [x + HALF_W, z + HALF_H]);
    }
    const distance = points.map(() => Infinity);
    const previous = points.map(() => -1);
    const visited = new Set<number>();
    distance[0] = 0;
    while (visited.size < points.length) {
      let next = -1;
      for (let i = 0; i < points.length; i++) {
        if (!visited.has(i) && Number.isFinite(distance[i]) && (next < 0 || distance[i] < distance[next])) next = i;
      }
      if (next < 0 || next === 1) break;
      visited.add(next);
      for (let i = 0; i < points.length; i++) {
        if (visited.has(i)) continue;
        const candidate = distance[next] + Math.hypot(points[next][0] - points[i][0], points[next][1] - points[i][1]);
        if (candidate >= distance[i] || [...active].some((o) => crosses(points[next], points[i], o.point))) continue;
        distance[i] = candidate;
        previous[i] = next;
      }
    }
    if (!Number.isFinite(distance[1])) throw new Error('No clear route between map nodes');
    path = [];
    for (let i = 1; i >= 0; i = previous[i]) path.unshift(points[i]);
  }
  throw new Error('Map link routing did not converge');
}

/** Split a wrapped edge at the two map boundaries without creating another graph edge. */
export function splitLinkAtMapEdge(a: Point, b: Point, width: number, wrap = false): [Point, Point][] {
  if (!wrap || Math.abs(b[0] - a[0]) <= width / 2) return [[a, b]];
  const shiftedX = b[0] + (b[0] > a[0] ? -width : width);
  const boundary = shiftedX < -width / 2 ? -width / 2 : width / 2;
  const t = (boundary - a[0]) / (shiftedX - a[0]);
  const z = a[1] + (b[1] - a[1]) * t;
  return [[a, [boundary, z]], [[-boundary, z], b]];
}
