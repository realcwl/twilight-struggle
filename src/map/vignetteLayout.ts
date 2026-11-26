// Decides where each country's ink vignette sits: the roomiest spot on its own land that keeps clear
// of every node and, where possible, of the links. A country too small to hold a drawing gets one in
// the nearest open water or unclaimed land instead, the way old charts filled their seas.
import { type LoadedPack, sampleId } from './pack';

/** Centre and side length (world units) of the square a drawing occupies. */
export type Spot = { x: number; z: number; size: number };

type Seg = [x0: number, z0: number, x1: number, z1: number];
type Box = { x: number; z: number; half: number };

// Room kept free around a node: its token and the name above it, at the size they have in a close view
// (the drawings are only shown close up; further out, where tokens cover more ground, they fade away).
const NODE_HALF_W = 1.15;
const NODE_UP = 1.15;
const NODE_DOWN = 0.6;
const R_MIN = 0.7;
const R_GOOD = 1.0;
const SPILL = 1.0; // how far past its own coast a drawing may reach
const FILL = 1.04; // drawings rarely reach the corners of their box, so the box may be a touch larger

/** Two-pass chamfer distance (in cells) from every cell to the nearest cell where `blocked` is set. */
function distanceTo(blocked: Uint8Array, w: number, h: number, edgeBlocks: boolean): Float32Array {
  const d = new Float32Array(w * h);
  const far = 1e6;
  const D = Math.SQRT2;
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? (edgeBlocks ? 0 : far) : d[y * w + x]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      d[i] = blocked[i] ? 0 : Math.min(far, at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + D, at(x + 1, y - 1) + D);
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (d[i] > 0) d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + D, at(x - 1, y + 1) + D);
    }
  }
  return d;
}

export function layoutVignettes(loaded: LoadedPack, ids: Set<string>, routes: [number, number][][]): Map<string, Spot> {
  const { pack } = loaded;
  const scenarioCount = pack.scenario.countries.length;
  const nodes = pack.countries.map((c) => c.node);
  const segs: Seg[] = [];
  for (const route of routes) for (let i = 1; i < route.length; i++) segs.push([route[i - 1][0], route[i - 1][1], route[i][0], route[i][1]]);
  const placed: Box[] = [];
  const out = new Map<string, Spot>();
  const halfW = pack.world.width / 2;
  const halfH = pack.world.height / 2;

  /** Largest half-size of a square centred here that touches no node. */
  const nodeGap = (x: number, z: number): number => {
    let gap = Infinity;
    for (const n of nodes) {
      const dx = Math.abs(x - n[0]) - NODE_HALF_W;
      const dz = Math.max(n[1] - NODE_UP - z, z - (n[1] + NODE_DOWN));
      gap = Math.min(gap, Math.max(dx, dz));
    }
    return gap;
  };
  const placedGap = (x: number, z: number): number => {
    let gap = Infinity;
    for (const p of placed) gap = Math.min(gap, Math.max(Math.abs(x - p.x), Math.abs(z - p.z)) - p.half);
    return gap;
  };
  const linkGap = (x: number, z: number, near: Seg[]): number => {
    let best = Infinity;
    for (const [x0, z0, x1, z1] of near) {
      const vx = x1 - x0;
      const vz = z1 - z0;
      const len2 = vx * vx + vz * vz;
      const t = len2 > 0 ? Math.min(1, Math.max(0, ((x - x0) * vx + (z - z0) * vz) / len2)) : 0;
      best = Math.min(best, Math.hypot(x - x0 - vx * t, z - z0 - vz * t));
    }
    return best;
  };
  const edgeGap = (x: number, z: number): number => Math.min(halfW - Math.abs(x), halfH - Math.abs(z)) - 0.3;
  const segsNear = (x0: number, z0: number, x1: number, z1: number): Seg[] =>
    segs.filter((s) => Math.max(s[0], s[2]) > x0 && Math.min(s[0], s[2]) < x1 && Math.max(s[1], s[3]) > z0 && Math.min(s[1], s[3]) < z1);
  const take = (id: string, x: number, z: number, r: number): void => {
    placed.push({ x, z, half: r });
    out.set(id, { x, z, size: 2 * r * FILL });
  };

  // ---- first choice: centred on the country's own land. The drawing may run a little way out over
  // water or unclaimed land (islands and narrow countries would otherwise get a postage stamp), but
  // never over another country of the scenario.
  const leftover: typeof pack.countries = [];
  for (const c of pack.countries) {
    if (!ids.has(c.id)) continue;
    const rMax = Math.min(2.3, Math.max(1.3, 1.1 + Math.sqrt(c.area) * 0.05));
    const g = Math.min(0.45, Math.max(0.12, Math.max(c.bbox[2] - c.bbox[0], c.bbox[3] - c.bbox[1]) / 110));
    const bx0 = c.bbox[0] - rMax;
    const bz0 = c.bbox[1] - rMax;
    const w = Math.max(1, Math.ceil((c.bbox[2] - c.bbox[0] + 2 * rMax) / g));
    const h = Math.max(1, Math.ceil((c.bbox[3] - c.bbox[1] + 2 * rMax) / g));
    const notOwn = new Uint8Array(w * h);
    const foreign = new Uint8Array(w * h);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const id = sampleId(loaded, bx0 + (i + 0.5) * g, bz0 + (j + 0.5) * g);
        notOwn[j * w + i] = id === c.index ? 0 : 1;
        foreign[j * w + i] = id !== 0 && id !== c.index && id <= scenarioCount ? 1 : 0;
      }
    }
    const inland = distanceTo(notOwn, w, h, true);
    const fromForeign = distanceTo(foreign, w, h, false);
    const near = segsNear(bx0, bz0, bx0 + w * g, bz0 + h * g);
    let clear: { x: number; z: number; r: number; score: number } | null = null;
    let crossing: { x: number; z: number; r: number; score: number } | null = null;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const room = inland[j * w + i] * g;
        if (room < 0.25) continue;
        const x = bx0 + (i + 0.5) * g;
        const z = bz0 + (j + 0.5) * g;
        const fits = Math.max(room * 1.3, Math.min(fromForeign[j * w + i] * g * 0.95, room + SPILL));
        const cap = Math.min(rMax, fits, nodeGap(x, z), placedGap(x, z), edgeGap(x, z));
        if (cap < R_MIN) continue;
        const link = linkGap(x, z, near);
        const home = 0.05 * Math.hypot(x - c.node[0], z - c.node[1]); // other things equal, stay near the node
        const r = Math.min(cap, link * 1.15);
        if (r >= R_MIN && (!clear || r - home > clear.score)) clear = { x, z, r, score: r - home };
        const score = cap - 0.35 * Math.max(0, cap - link) - home;
        if (!crossing || score > crossing.score) crossing = { x, z, r: cap, score };
      }
    }
    const pick = clear && clear.r >= R_GOOD ? clear : crossing ?? clear;
    if (pick) take(c.id, pick.x, pick.z, pick.r);
    else leftover.push(c);
  }

  // ---- otherwise: beside it, on water or on land outside the scenario; failing that, anywhere clear
  for (const c of leftover) {
    const margin = 3.5;
    const g = 0.2;
    const bx0 = c.bbox[0] - margin;
    const bz0 = c.bbox[1] - margin;
    const w = Math.ceil((c.bbox[2] - c.bbox[0] + 2 * margin) / g);
    const h = Math.ceil((c.bbox[3] - c.bbox[1] + 2 * margin) / g);
    const foreign = new Uint8Array(w * h);
    const own = new Uint8Array(w * h);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const id = sampleId(loaded, bx0 + (i + 0.5) * g, bz0 + (j + 0.5) * g);
        own[j * w + i] = id === c.index ? 1 : 0;
        foreign[j * w + i] = id !== 0 && id !== c.index && id <= scenarioCount ? 1 : 0;
      }
    }
    const fromForeign = distanceTo(foreign, w, h, false);
    const fromOwn = distanceTo(own, w, h, false);
    const near = segsNear(bx0, bz0, bx0 + w * g, bz0 + h * g);
    type Found = { x: number; z: number; r: number; score: number; away: number };
    const search = (strict: boolean): Found | null => {
      let found: Found | null = null;
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const x = bx0 + (i + 0.5) * g;
          const z = bz0 + (j + 0.5) * g;
          const open = strict ? fromForeign[j * w + i] * g * 1.1 : Infinity;
          const cap = Math.min(0.95, open, nodeGap(x, z), placedGap(x, z), edgeGap(x, z));
          if (cap < (strict ? 0.6 : 0.55)) continue;
          const away = fromOwn[j * w + i] * g;
          const score = Math.min(cap, 0.85) - 0.5 * away - 0.25 * Math.max(0, cap - linkGap(x, z, near)) - 0.03 * Math.hypot(x - c.node[0], z - c.node[1]);
          if (!found || score > found.score) found = { x, z, r: Math.min(cap, 0.9), score, away };
        }
      }
      return found;
    };
    // Open water is the first choice, but only close by: a drawing far out at sea no longer reads as
    // belonging to its country, and a landlocked one is better off overlapping a neighbour's border.
    const offshore = search(true);
    const best = offshore && offshore.away <= 1.5 ? offshore : search(false) ?? offshore;
    if (best) take(c.id, best.x, best.z, best.r);
  }
  return out;
}
