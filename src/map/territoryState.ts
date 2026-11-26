// A tiny data texture, one column per territory index, that the terrain shader reads to colour and
// highlight territories. Changing the situation or the hover only rewrites this texture.
import * as THREE from 'three';
import type { MapPack, MapState } from './types';

const COLS = 256;
const ROWS = 4;
// row 0: side colour rgb, a = controlled
// row 1: r = part of the scenario, g = side A has influence, b = side B has influence, a = key country
// row 2: r = highlight, g = dim, b = lift      (animated)
// row 3: r = target marker                     (animated)

export type Focus = {
  /**
   * Highlighted territories: the hovered country, or every country of the hovered region. Everything
   * else on the board recedes, the hovered country's neighbours included: on the land only the one
   * country stands out, and its neighbours are picked out by their nodes and the links to them.
   */
  primary: Iterable<number>;
  /** Territories that rise off the map. */
  lifted: Iterable<number>;
};

export class TerritoryState {
  readonly texture: THREE.DataTexture;
  /** How strongly anything is in focus right now, 0..1. */
  dim = 0;
  private readonly data = new Uint8Array(COLS * ROWS * 4);
  private readonly cur = new Float32Array(COLS * 4); // highlight, dim, lift, target
  private readonly goal = new Float32Array(COLS * 4);
  private dimGoal = 0;
  private readonly participants: number;
  private readonly sideRgb: [number, number, number][];
  private animating = false;

  constructor(private readonly pack: MapPack) {
    this.participants = pack.scenario.countries.length;
    this.sideRgb = pack.scenario.sides.map((s) => {
      const c = new THREE.Color(s.color);
      return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)] as [number, number, number];
    });
    pack.scenario.countries.forEach((c, i) => {
      const o = (COLS + i + 1) * 4;
      this.data[o] = 255;
      this.data[o + 3] = c.key ? 255 : 0;
    });
    this.texture = new THREE.DataTexture(this.data, COLS, ROWS, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.texture.minFilter = this.texture.magFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
  }

  setState(state: MapState): void {
    this.pack.scenario.countries.forEach((c, i) => {
      const s = state.countries[c.id];
      const idx = i + 1;
      const o0 = idx * 4;
      const o1 = (COLS + idx) * 4;
      const ctrl = c.superpower ?? s?.controller ?? null;
      if (ctrl === null) {
        this.data[o0] = this.data[o0 + 1] = this.data[o0 + 2] = this.data[o0 + 3] = 0;
      } else {
        const rgb = this.sideRgb[ctrl];
        this.data[o0] = rgb[0];
        this.data[o0 + 1] = rgb[1];
        this.data[o0 + 2] = rgb[2];
        this.data[o0 + 3] = 255;
      }
      this.data[o1 + 1] = c.superpower === undefined && s && s.influence[0] > 0 ? 255 : 0;
      this.data[o1 + 2] = c.superpower === undefined && s && s.influence[1] > 0 ? 255 : 0;
    });
    this.texture.needsUpdate = true;
  }

  setFocus(focus: Focus | null): void {
    for (let i = 0; i < COLS; i++) {
      this.goal[i * 4] = 0;
      this.goal[i * 4 + 1] = 0;
      this.goal[i * 4 + 2] = 0;
    }
    this.dimGoal = 0;
    if (focus) {
      // everything that takes part and is not in focus recedes
      for (let i = 1; i <= this.participants; i++) this.goal[i * 4 + 1] = 1;
      for (const i of focus.primary) {
        this.goal[i * 4] = 1;
        this.goal[i * 4 + 1] = 0;
      }
      for (const i of focus.lifted) this.goal[i * 4 + 2] = 1;
      this.dimGoal = 1;
    }
    this.animating = true;
  }

  setTargets(indices: Iterable<number>): void {
    for (let i = 0; i < COLS; i++) this.goal[i * 4 + 3] = 0;
    for (const i of indices) this.goal[i * 4 + 3] = 1;
    this.animating = true;
  }

  /** Current lift (0..1) of a territory, so nameplates can ride along. */
  liftOf(index: number): number {
    return this.cur[index * 4 + 2];
  }

  /** Eases the animated rows towards their goals. Returns true while something is still moving. */
  update(dt: number): boolean {
    if (!this.animating) return false;
    const k = 1 - Math.exp(-dt * 11);
    let moving = false;
    for (let i = 0; i < COLS * 4; i++) {
      const d = this.goal[i] - this.cur[i];
      if (d === 0) continue;
      if (Math.abs(d) < 0.004) this.cur[i] = this.goal[i];
      else {
        this.cur[i] += d * k;
        moving = true;
      }
    }
    const dd = this.dimGoal - this.dim;
    if (Math.abs(dd) < 0.004) this.dim = this.dimGoal;
    else {
      this.dim += dd * k;
      moving = true;
    }
    for (let i = 0; i < COLS; i++) {
      const o2 = (COLS * 2 + i) * 4;
      this.data[o2] = Math.round(this.cur[i * 4] * 255);
      this.data[o2 + 1] = Math.round(this.cur[i * 4 + 1] * 255);
      this.data[o2 + 2] = Math.round(this.cur[i * 4 + 2] * 255);
      this.data[(COLS * 3 + i) * 4] = Math.round(this.cur[i * 4 + 3] * 255);
    }
    this.texture.needsUpdate = true;
    this.animating = moving;
    return true;
  }
}
