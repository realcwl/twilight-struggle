// Connections between countries.
// The full authored graph is always drawn. Board links distinguish regional, inter-regional and
// superpower adjacency; geographic land/sea styles remain available for other scenarios.
// A link is drawn the way a road is on a printed map: a light line inside a dark casing. The pair
// reads on any ground, pale desert and dark sea alike, and cannot be taken for a border, which the
// terrain draws as a single thin stroke in a colour of its own.
import * as THREE from 'three';
import { LineBatch } from './lineBatch';
import { routeLinkAroundNodes, splitLinkAtMapEdge } from './linkPaths';
import { type LoadedPack, sampleHeight } from './pack';
import type { LinkKind } from './types';

type Pair = { line: LineBatch; halo: LineBatch };

const KINDS: LinkKind[] = ['land', 'sea', 'regional', 'inter-regional', 'superpower'];
const CREAM = 0xfff0c8;
const BRIGHT = 0xfffaec;
const INK = 0x1d140d;
const SEA_DASH: [number, number] = [0.5, 0.42];
type Neighbour = { id: string; kind: LinkKind; wrap?: boolean };

export class Links {
  readonly group = new THREE.Group();
  /** Every link as a polyline of ground positions (x, z), as routed around the nodes in its way. */
  readonly routes: [number, number][][] = [];
  private readonly neighbours = new Map<string, Neighbour[]>();
  /** Node positions; links run between these. */
  private readonly nodes = new Map<string, [number, number]>();
  private readonly groundPaths = new Map<string, number[][]>();
  private readonly network: Record<LinkKind, Pair>;
  private readonly focus: Record<LinkKind, Pair>;
  private current: string | null = null;
  private fade = 0;
  private recede = 0;

  constructor(private readonly loaded: LoadedPack, private readonly relief: number) {
    const { pack } = loaded;
    pack.countries.forEach((c) => this.nodes.set(c.id, c.node));
    for (const l of pack.scenario.links) {
      (this.neighbours.get(l.a) ?? this.neighbours.set(l.a, []).get(l.a)!).push({ id: l.b, kind: l.kind, wrap: l.wrap });
      (this.neighbours.get(l.b) ?? this.neighbours.set(l.b, []).get(l.b)!).push({ id: l.a, kind: l.kind, wrap: l.wrap });
    }
    const pair = (color: number, dashed: boolean, order: number, halo = INK): Pair => ({
      halo: new LineBatch({ color: halo, dash: dashed ? SEA_DASH : undefined }, order),
      line: new LineBatch({ color, dash: dashed ? SEA_DASH : undefined }, order + 1),
    });
    this.network = {
      land: pair(CREAM, false, 6), sea: pair(CREAM, true, 6),
      regional: pair(CREAM, false, 6), 'inter-regional': pair(0xff7a66, true, 6),
      superpower: pair(INK, false, 6, CREAM),
    };
    this.focus = {
      land: pair(BRIGHT, false, 10), sea: pair(BRIGHT, true, 10),
      regional: pair(BRIGHT, false, 10), 'inter-regional': pair(0xff8a7c, true, 10),
      superpower: pair(INK, false, 10, BRIGHT),
    };
    for (const kind of KINDS) {
      // The standing network: every link of one kind in a single batch.
      const paths: number[][] = [];
      for (const l of pack.scenario.links) {
        const a = this.nodes.get(l.a);
        const b = this.nodes.get(l.b);
        if (l.kind === kind && a && b) {
          const obstacles = [...this.nodes].filter(([id]) => id !== l.a && id !== l.b).map(([id, point]) => ({ id, point }));
          const routed: number[][] = [];
          for (const [from, to] of this.pieces(a, b, l.wrap)) {
            const waypoints = routeLinkAroundNodes(from, to, obstacles);
            this.routes.push(waypoints);
            const path: number[] = [];
            for (let i = 1; i < waypoints.length; i++) {
              const segment = this.groundPath(waypoints[i - 1], waypoints[i]);
              path.push(...(i === 1 ? segment : segment.slice(3)));
            }
            routed.push(path);
          }
          this.groundPaths.set([l.a, l.b].sort().join('|'), routed);
          paths.push(...routed);
        }
      }
      this.network[kind].halo.setPaths(paths);
      this.network[kind].line.setPaths(paths);
      for (const set of [this.network, this.focus]) this.group.add(set[kind].halo.mesh, set[kind].line.mesh);
    }
  }

  neighboursOf(id: string): Neighbour[] {
    return this.neighbours.get(id) ?? [];
  }

  /** How many link lines are currently brought out for the country in focus. */
  get focusCount(): number {
    return this.current ? this.neighboursOf(this.current).length : 0;
  }

  setResolution(width: number, height: number): void {
    for (const set of [this.network, this.focus]) {
      for (const kind of KINDS) {
        set[kind].line.setResolution(width, height);
        set[kind].halo.setResolution(width, height);
      }
    }
  }

  /** Brings out the links of one country, or none. */
  show(id: string | null): void {
    if (id === this.current) return;
    this.current = id;
    this.fade = 0;
    const from = id ? this.nodes.get(id) : undefined;
    for (const kind of KINDS) {
      const paths: number[][] = [];
      if (id && from) {
        for (const n of this.neighboursOf(id)) {
          const to = this.nodes.get(n.id);
          if (n.kind === kind && to) {
            if (kind === 'sea') {
              for (const [a, b] of this.pieces(from, to, n.wrap)) paths.push(this.arcPath(a, b));
            } else paths.push(...(this.groundPaths.get([id!, n.id].sort().join('|')) ?? []));
          }
        }
      }
      this.focus[kind].halo.setPaths(paths);
      this.focus[kind].line.setPaths(paths);
    }
  }

  /**
   * The straight runs a link is drawn as. A link across the map's east-west join comes in two, one to
   * each edge; the world is drawn again beside itself there, so the two meet. Each runs a hair past
   * the edge, which keeps a seam of rounding error from showing where they meet.
   */
  private pieces(a: [number, number], b: [number, number], wrap?: boolean): [[number, number], [number, number]][] {
    const parts = splitLinkAtMapEdge(a, b, this.loaded.pack.world.width, wrap);
    if (parts.length !== 2) return parts;
    const past = (from: [number, number], edge: [number, number]): [number, number] => {
      const len = Math.hypot(edge[0] - from[0], edge[1] - from[1]) || 1;
      return [edge[0] + ((edge[0] - from[0]) / len) * 0.1, edge[1] + ((edge[1] - from[1]) / len) * 0.1];
    };
    return [[parts[0][0], past(parts[0][0], parts[0][1])], [past(parts[1][1], parts[1][0]), parts[1][1]]];
  }

  private heightAt(x: number, z: number): number {
    return sampleHeight(this.loaded, x, z) * this.relief;
  }

  /** A line draped over the terrain (flat across water). */
  private groundPath(a: [number, number], b: [number, number]): number[] {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(8, Math.ceil(len / 0.35));
    const raw: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      raw.push(this.heightAt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t));
    }
    const out: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // smooth the profile a little so the line drapes over the terrain instead of jittering
      const h = Math.max(raw[i], (raw[Math.max(0, i - 1)] + raw[i] + raw[Math.min(steps, i + 1)]) / 3);
      out.push(a[0] + (b[0] - a[0]) * t, h + 0.09, a[1] + (b[1] - a[1]) * t);
    }
    return out;
  }

  private arcPath(a: [number, number], b: [number, number]): number[] {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(16, Math.ceil(len / 0.4));
    const rise = Math.min(3.2, 0.5 + len * 0.16);
    const ha = this.heightAt(a[0], a[1]);
    const hb = this.heightAt(b[0], b[1]);
    const out: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      out.push(a[0] + (b[0] - a[0]) * t, ha + (hb - ha) * t + 0.09 + Math.sin(Math.PI * t) * rise, a[1] + (b[1] - a[1]) * t);
    }
    return out;
  }

  /**
   * Per-frame styling. `globalness` is 0 in the local view and 1 in the global view; `focused` says
   * whether some country or region is in focus, in which case the standing network steps back.
   */
  update(dt: number, time: number, globalness: number, focused: boolean): void {
    this.recede += ((focused ? 1 : 0) - this.recede) * Math.min(1, dt * 9);
    const strength = 1 - 0.62 * this.recede;
    // Bold enough to be read before the land it crosses; thinner from far away, where many links
    // share few pixels. The casing shows as a dark edge of about a pixel and a half on each side.
    const width = 3.4 - 0.9 * globalness;
    for (const kind of KINDS) {
      this.network[kind].line.style(width, strength);
      this.network[kind].halo.style(width + 3, 0.9 * strength);
    }
    if (this.current) this.fade = Math.min(1, this.fade + dt * 5);
    // the links of the country in focus: wider again, over a network that has stepped back
    for (const kind of KINDS) {
      const drift = kind === 'sea' ? -time * 0.6 : 0;
      this.focus[kind].line.style(width + 1.2, this.fade, drift);
      this.focus[kind].halo.style(width + 4.6, this.fade * 0.92, drift);
    }
  }
}
