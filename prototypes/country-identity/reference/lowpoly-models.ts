// Decorative miniatures: one small low-poly model per country, to give each place some character.
// They are scenery only. They appear when zoomed in, cannot be clicked, and make a small move when
// their country is in focus. Every model is assembled in code from boxes, cylinders, cones and balls.
import * as THREE from 'three';
import { type LoadedPack, sampleHeight } from './pack';

type Vec3 = [number, number, number];
type Axis = 'x' | 'y' | 'z';
/**
 * spin: turns continuously. swing: rocks back and forth. raise: holds a pose while in focus.
 * bob: moves up and down. All are gentle at rest and fuller while the country is in focus.
 */
type Anim = { kind: 'spin' | 'swing' | 'raise' | 'bob'; axis: Axis; amount: number; speed: number };

// ---------------------------------------------------------------- geometry helpers
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0).toNonIndexed();
const UNIT_BALL = new THREE.IcosahedronGeometry(1, 1);
const UNIT_ROOF = (() => {
  // a gable roof: triangular prism, ridge along z, base on y = 0
  const A = [-0.5, 0, -0.5], B = [0.5, 0, -0.5], Cc = [0, 1, -0.5], D = [-0.5, 0, 0.5], E = [0.5, 0, 0.5], F = [0, 1, 0.5];
  const tris = [A, Cc, B, D, E, F, A, D, F, A, F, Cc, B, Cc, F, B, F, E];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tris.flat()), 3));
  return g;
})();
const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const EULER = new THREE.Euler();

/** Collects coloured triangles. Every shape sits on its base: `y` is the bottom, not the centre. */
class Shape {
  readonly pos: number[] = [];
  readonly col: number[] = [];

  private put(geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rz = 0, rx = 0): this {
    EULER.set(rx, ry, rz, 'YZX');
    M.compose(new THREE.Vector3(x, y, z), Q.setFromEuler(EULER), new THREE.Vector3(sx, sy, sz));
    const src = (geo.index ? geo.toNonIndexed() : geo).getAttribute('position');
    const c = new THREE.Color(color);
    const v = new THREE.Vector3();
    for (let i = 0; i < src.count; i++) {
      v.fromBufferAttribute(src, i).applyMatrix4(M);
      this.pos.push(v.x, v.y, v.z);
      this.col.push(c.r, c.g, c.b);
    }
    return this;
  }
  box(w: number, h: number, d: number, x: number, y: number, z: number, color: number, ry = 0, rz = 0, rx = 0): this {
    return this.put(UNIT_BOX, color, x, y, z, w, h, d, ry, rz, rx);
  }
  /** A cylinder or frustum, top radius first. */
  cyl(rTop: number, rBottom: number, h: number, x: number, y: number, z: number, color: number, sides = 8, ry = 0, rz = 0, rx = 0): this {
    const g = new THREE.CylinderGeometry(rTop, rBottom, 1, sides).translate(0, 0.5, 0);
    return this.put(g, color, x, y, z, 1, h, 1, ry, rz, rx);
  }
  cone(r: number, h: number, x: number, y: number, z: number, color: number, sides = 8, ry = 0): this {
    return this.cyl(0, r, h, x, y, z, color, sides, ry);
  }
  /** A four-sided pyramid with its edges square to the axes. */
  pyramid(w: number, h: number, x: number, y: number, z: number, color: number): this {
    return this.cyl(0, w * 0.7071, h, x, y, z, color, 4, Math.PI / 4);
  }
  /** A ball centred on x, y, z. */
  ball(r: number, x: number, y: number, z: number, color: number, sx = 1, sy = 1, sz = 1): this {
    return this.put(UNIT_BALL, color, x, y, z, r * sx, r * sy, r * sz);
  }
  roof(w: number, h: number, d: number, x: number, y: number, z: number, color: number, ry = 0): this {
    return this.put(UNIT_ROOF, color, x, y, z, w, h, d, ry);
  }
  geometry(offset: Vec3 = [0, 0, 0]): THREE.BufferGeometry {
    const p = new Float32Array(this.pos);
    for (let i = 0; i < p.length; i += 3) {
      p[i] -= offset[0];
      p[i + 1] -= offset[1];
      p[i + 2] -= offset[2];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.col), 3));
    g.computeVertexNormals(); // unindexed, so this gives flat facets
    return g;
  }
}

class Model {
  readonly body = new Shape();
  readonly parts: { shape: Shape; pivot: Vec3; anim: Anim }[] = [];
  /** A separately moving piece, authored in the model's own coordinates and turning about `pivot`. */
  part(pivot: Vec3, anim: Anim): Shape {
    const shape = new Shape();
    this.parts.push({ shape, pivot, anim });
    return shape;
  }
}

// ---------------------------------------------------------------- palette and shared props
const C = {
  stone: 0xb9b2a3, pale: 0xe9e2d0, white: 0xf3eee2, dark: 0x3a322c, wood: 0x8a5a36, log: 0x9c6b42, red: 0xc23b2b,
  tile: 0xb5533a, gold: 0xe8b93c, leaf: 0x3f8a3d, pine: 0x2f6b45, sand: 0xdcc089, mud: 0xc49a6c, blue: 0x3b6fb0,
  teal: 0x2f9c9a, grey: 0x8b8f96, iron: 0x5d5148, snow: 0xf4f6f7, skin: 0xe2b48c, water: 0x3a86b8, thatch: 0xc9a85c,
  brick: 0xa5553b, rose: 0xd08a6e, grass: 0x7da653, rock: 0x857a6c, steel: 0xd9e1e6, navy: 0x2b3554,
};
const TAU = Math.PI * 2;

function palm(s: Shape, x: number, z: number, h = 0.5): void {
  s.cyl(0.018, 0.028, h, x, 0, z, C.wood, 5, 0, 0.08);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    s.box(0.24, 0.015, 0.07, x + Math.cos(a) * 0.1 + 0.03, h - 0.03, z - Math.sin(a) * 0.1, C.leaf, a, -0.45);
  }
}
function pine(s: Shape, x: number, z: number, h = 0.5, color = C.pine): void {
  s.cyl(0.02, 0.025, h * 0.25, x, 0, z, C.wood, 5);
  s.cone(h * 0.3, h * 0.45, x, h * 0.18, z, color, 6);
  s.cone(h * 0.23, h * 0.4, x, h * 0.42, z, color, 6);
  s.cone(h * 0.15, h * 0.35, x, h * 0.66, z, color, 6);
}
function flag(m: Model, x: number, y: number, z: number, h: number, color: number): void {
  m.body.cyl(0.008, 0.008, h, x, y, z, C.dark, 4);
  m.part([x, y + h - 0.06, z], { kind: 'swing', axis: 'y', amount: 0.5, speed: 3 }).box(0.16, 0.1, 0.008, x + 0.085, y + h - 0.11, z, color);
}
function water(s: Shape, r = 0.46): void {
  s.cyl(r, r, 0.02, 0, 0, 0, C.water, 14);
}
// ---------------------------------------------------------------- the models
type Builder = (m: Model, variant: string) => void;

const BUILDERS: Record<string, Builder> = {
  samurai(m) {
    const b = m.body;
    b.cyl(0.32, 0.36, 0.05, 0, 0, 0, C.stone, 10);
    b.box(0.11, 0.3, 0.13, -0.08, 0.05, 0, C.navy).box(0.11, 0.3, 0.13, 0.08, 0.05, 0, C.navy); // wide trousers
    b.box(0.34, 0.1, 0.2, 0, 0.32, 0, 0x8f2a22); // armour skirt
    b.box(0.3, 0.26, 0.18, 0, 0.41, 0, C.red); // cuirass
    b.box(0.32, 0.03, 0.19, 0, 0.51, 0, C.gold);
    b.box(0.13, 0.05, 0.22, -0.21, 0.62, 0, 0x8f2a22).box(0.13, 0.05, 0.22, 0.21, 0.62, 0, 0x8f2a22); // shoulder guards
    b.box(0.08, 0.26, 0.09, -0.21, 0.37, 0, C.navy); // resting arm
    b.ball(0.095, 0, 0.76, 0, C.skin);
    b.ball(0.12, 0, 0.8, -0.005, C.dark, 1, 0.75, 1); // helmet bowl
    b.box(0.3, 0.03, 0.26, 0, 0.75, -0.03, C.dark); // neck guard
    b.box(0.03, 0.17, 0.02, -0.06, 0.86, 0.09, C.gold, 0, 0.5).box(0.03, 0.17, 0.02, 0.06, 0.86, 0.09, C.gold, 0, -0.5); // crest
    b.cyl(0.008, 0.008, 0.52, -0.04, 0.45, -0.13, C.wood, 5); // back banner
    b.box(0.15, 0.26, 0.012, 0.045, 0.7, -0.13, C.white).box(0.07, 0.07, 0.016, 0.045, 0.8, -0.13, C.red);
    // sword arm: hangs at rest, lifts the blade overhead while the country is in focus
    const arm = m.part([0.21, 0.61, 0], { kind: 'raise', axis: 'x', amount: -2.2, speed: 2.4 });
    arm.box(0.08, 0.26, 0.09, 0.21, 0.37, 0, C.navy);
    arm.box(0.03, 0.03, 0.12, 0.21, 0.37, 0.07, C.dark);
    arm.box(0.016, 0.012, 0.46, 0.21, 0.379, 0.36, C.steel);
  },

  pagoda(m, v) {
    const b = m.body;
    const wall = v === 'red' || v === 'bright' ? C.red : v === 'green' ? C.pale : C.white;
    const roof = v === 'green' ? 0x3d6b4f : v === 'bright' ? C.teal : v === 'slim' ? C.tile : 0x3c4a52;
    if (v === 'slim') {
      // a single shrine on one pillar, standing in a pond
      water(b, 0.42);
      b.cyl(0.05, 0.06, 0.3, 0, 0.02, 0, C.stone, 8);
      b.box(0.34, 0.16, 0.34, 0, 0.32, 0, C.wood);
      b.cyl(0.08, 0.4, 0.16, 0, 0.48, 0, roof, 4, Math.PI / 4);
      b.cyl(0.01, 0.02, 0.1, 0, 0.64, 0, C.gold, 4);
      palm(b, -0.3, 0.2, 0.34);
      return;
    }
    b.box(0.72, 0.06, 0.72, 0, 0, 0, C.stone);
    let y = 0.06;
    for (let i = 0; i < 3; i++) {
      const w = 0.46 - i * 0.1;
      b.box(w, 0.17, w, 0, y, 0, wall);
      b.cyl(w * 0.45, w * 1.05, 0.1, 0, y + 0.17, 0, roof, 4, Math.PI / 4);
      y += 0.27;
    }
    b.cyl(0.012, 0.02, 0.2, 0, y, 0, C.gold, 5).ball(0.03, 0, y + 0.2, 0, C.gold);
  },

  stupa(m, v) {
    const b = m.body;
    if (v === 'stone') {
      // weathered temple towers
      b.box(0.8, 0.07, 0.6, 0, 0, 0, 0x8c8271);
      for (const [x, h, r] of [[0, 0.62, 0.15], [-0.27, 0.42, 0.11], [0.27, 0.42, 0.11]] as const) {
        b.cyl(r * 0.8, r, h * 0.45, x, 0.07, 0, 0x9a8f7c, 8);
        b.cyl(r * 0.25, r * 0.85, h * 0.55, x, 0.07 + h * 0.45, 0, 0x8c8271, 8);
      }
      palm(b, -0.34, 0.24, 0.4);
      return;
    }
    const main = v === 'thai' ? C.white : C.gold;
    b.cyl(0.42, 0.46, 0.06, 0, 0, 0, C.pale, 8).cyl(0.34, 0.38, 0.06, 0, 0.06, 0, C.pale, 8);
    b.ball(0.26, 0, 0.26, 0, main, 1, 0.85, 1); // the bell
    b.cyl(0.07, 0.12, 0.1, 0, 0.44, 0, main, 8);
    b.cyl(0.004, 0.07, 0.42, 0, 0.54, 0, C.gold, 8); // spire
    if (v === 'thai') {
      b.box(0.3, 0.16, 0.2, 0.34, 0, 0.16, C.white);
      b.roof(0.24, 0.16, 0.36, 0.34, 0.16, 0.16, C.red, Math.PI / 2).roof(0.18, 0.14, 0.26, 0.34, 0.24, 0.16, C.gold, Math.PI / 2);
    } else {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + 0.78;
        b.cyl(0.004, 0.05, 0.2, Math.cos(a) * 0.34, 0.12, Math.sin(a) * 0.34, C.gold, 6);
      }
    }
  },

  mausoleum(m) {
    const b = m.body;
    b.box(0.86, 0.06, 0.86, 0, 0, 0, C.pale);
    b.box(0.46, 0.28, 0.46, 0, 0.06, 0, C.white);
    b.box(0.14, 0.2, 0.02, 0, 0.06, 0.23, 0xbfc7cc); // arched doorway, in shade
    b.cyl(0.15, 0.15, 0.06, 0, 0.34, 0, C.white, 10);
    b.ball(0.18, 0, 0.5, 0, C.white, 1, 1.12, 1).cyl(0.004, 0.02, 0.12, 0, 0.68, 0, C.gold, 5);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      b.ball(0.06, x * 0.16, 0.37, z * 0.16, C.white);
      b.cyl(0.022, 0.028, 0.46, x * 0.38, 0.06, z * 0.38, C.white, 6).ball(0.035, x * 0.38, 0.54, z * 0.38, C.white);
    }
    b.box(0.1, 0.012, 0.3, 0, 0.061, 0.6, C.water); // reflecting pool
  },

  mosque(m, v) {
    const b = m.body;
    if (v === 'mud') {
      // adobe mosque with buttressed towers and palm-wood pegs
      b.box(0.74, 0.3, 0.44, 0, 0, 0, C.mud);
      for (const x of [-0.3, 0, 0.3]) {
        b.cyl(0.05, 0.085, x === 0 ? 0.62 : 0.5, x, 0, 0.2, 0xb88c5e, 4, Math.PI / 4).cone(0.035, 0.08, x, x === 0 ? 0.62 : 0.5, 0.2, C.pale, 5);
        for (let k = 0; k < 3; k++) b.box(0.16, 0.012, 0.012, x, 0.2 + k * 0.1, 0.24, C.wood);
      }
      for (let i = 0; i < 6; i++) b.cone(0.03, 0.07, -0.33 + i * 0.132, 0.3, -0.2, 0xb88c5e, 4);
      return;
    }
    if (v === 'square') {
      // red-ochre hall with one tall square tower
      b.box(0.56, 0.2, 0.42, -0.1, 0, 0, 0xc98a5e).roof(0.56, 0.08, 0.42, -0.1, 0.2, 0, 0x4f8f6a);
      b.box(0.17, 0.66, 0.17, 0.3, 0, 0.1, 0xc98a5e).box(0.2, 0.03, 0.2, 0.3, 0.66, 0.1, C.pale);
      b.box(0.09, 0.14, 0.09, 0.3, 0.69, 0.1, 0xc98a5e).ball(0.035, 0.3, 0.86, 0.1, C.gold);
      palm(b, -0.36, 0.26, 0.4);
      return;
    }
    if (v === 'white') {
      // whitewashed houses stepping up a hill
      for (const [x, z, h, w] of [[-0.24, 0.16, 0.16, 0.26], [0.04, 0.12, 0.24, 0.24], [0.28, 0.14, 0.18, 0.22], [-0.1, -0.12, 0.32, 0.26], [0.2, -0.12, 0.28, 0.24]] as const) {
        b.box(w, h, 0.22, x, 0, z, C.white);
      }
      b.ball(0.09, -0.1, 0.33, -0.12, C.white, 1, 0.8, 1);
      b.cyl(0.03, 0.035, 0.6, 0.34, 0, -0.14, C.white, 6).cone(0.04, 0.08, 0.34, 0.6, -0.14, 0x4f8f6a, 6);
      return;
    }
    const wall = v === 'gold' ? C.white : v === 'red' ? 0xb4553f : v === 'turquoise' ? C.sand : C.stone;
    const dome = v === 'gold' ? C.gold : v === 'red' ? C.white : v === 'turquoise' ? 0x2fb0b0 : 0x5f7fa8;
    b.box(0.56, 0.24, 0.48, 0, 0, 0, wall);
    b.ball(0.2, 0, 0.26, 0, dome, 1, 0.9, 1).cyl(0.004, 0.015, 0.1, 0, 0.44, 0, C.gold, 5);
    if (v === 'red') b.ball(0.11, -0.2, 0.25, 0, dome).ball(0.11, 0.2, 0.25, 0, dome);
    if (v === 'turquoise') b.box(0.24, 0.36, 0.05, 0, 0, 0.25, 0x2f7fb0).box(0.1, 0.24, 0.06, 0, 0, 0.26, C.navy); // tiled portal
    const corners: [number, number][] = v === 'grand' || v === 'red' ? [[-1, -1], [1, -1], [-1, 1], [1, 1]] : [[-1, 1], [1, 1]];
    for (const [x, z] of corners) {
      b.cyl(0.024, 0.03, 0.56, x * 0.34, 0, z * 0.28, wall === C.sand ? 0x2f9c9a : wall, 6);
      b.cyl(0.036, 0.036, 0.02, x * 0.34, 0.4, z * 0.28, C.pale, 6).cone(0.03, 0.12, x * 0.34, 0.56, z * 0.28, dome, 6);
    }
    if (v === 'grand') for (const x of [-0.2, 0.2]) b.ball(0.09, x, 0.25, 0.16, dome);
  },

  pyramids(m, v) {
    const b = m.body;
    b.cyl(0.5, 0.52, 0.02, 0, 0, 0, C.sand, 12);
    if (v === 'nubian') {
      // small, steep, close together
      for (const [x, z, w] of [[-0.24, 0.05, 0.2], [-0.02, -0.08, 0.24], [0.2, 0.06, 0.2], [0.06, 0.24, 0.16]] as const) {
        b.pyramid(w, w * 1.7, x, 0.02, z, 0xb98d5c);
        b.box(w * 0.4, w * 0.35, w * 0.25, x, 0.02, z + w * 0.5, 0xa67c50);
      }
      return;
    }
    b.pyramid(0.5, 0.42, -0.1, 0.02, -0.08, 0xe3c98a).pyramid(0.34, 0.29, 0.24, 0.02, 0.08, 0xd9bd7d).pyramid(0.16, 0.14, -0.3, 0.02, 0.22, 0xd9bd7d);
    palm(b, 0.34, 0.3, 0.3);
  },

  onion(m, v) {
    const b = m.body;
    const gold = v === 'gold';
    b.box(0.5, 0.26, 0.4, 0, 0, 0, gold ? C.white : 0xb04a38);
    b.box(0.52, 0.03, 0.42, 0, 0.26, 0, C.white);
    const domes = gold ? [C.gold, C.gold, 0x4f8f6a, C.gold, 0x4f8f6a] : [C.gold, 0x3f7fc0, 0x3f9a58, 0xd9452f, 0xe0b53c];
    const spots: [number, number, number, number][] = [[0, 0, 0.62, 0.085], [-0.19, 0.13, 0.4, 0.06], [0.19, 0.13, 0.4, 0.06], [-0.19, -0.13, 0.44, 0.06], [0.19, -0.13, 0.44, 0.06]];
    spots.forEach(([x, z, h, r], i) => {
      b.cyl(r * 0.8, r * 0.9, h - 0.26, x, 0.26, z, gold ? C.white : 0xc9624a, 8);
      b.ball(r * 1.35, x, h + r * 0.9, z, domes[i], 1, 1.05, 1); // the bulb
      b.cone(r * 0.75, r * 1.9, x, h + r * 1.5, z, domes[i], 8); // drawn up to a point
      b.cyl(0.004, 0.004, 0.07, x, h + r * 3.3, z, C.gold, 4);
    });
  },

  clocktower(m) {
    const b = m.body;
    b.box(0.5, 0.2, 0.2, -0.16, 0, 0.02, 0xc9b27c).roof(0.22, 0.08, 0.5, -0.16, 0.2, 0.02, 0x54606a, Math.PI / 2); // the hall
    for (let i = 0; i < 4; i++) b.cone(0.02, 0.1, -0.36 + i * 0.13, 0.2, 0.12, 0xc9b27c, 4);
    b.box(0.19, 0.72, 0.19, 0.22, 0, 0, 0xc9b27c);
    b.box(0.22, 0.19, 0.22, 0.22, 0.6, 0, 0xb8a06c);
    for (const [x, z, ry] of [[0, 0.112, 0], [0, -0.112, 0], [0.112, 0, Math.PI / 2], [-0.112, 0, Math.PI / 2]] as const) {
      b.cyl(0.07, 0.07, 0.008, 0.22 + x, 0.69, z, C.white, 12, ry, 0, Math.PI / 2); // clock faces
    }
    b.pyramid(0.24, 0.24, 0.22, 0.79, 0, 0x54606a).cyl(0.004, 0.012, 0.12, 0.22, 1.02, 0, C.gold, 4);
    flag(m, -0.4, 0.2, 0.02, 0.3, C.red);
  },

  irontower(m) {
    const b = m.body;
    b.cyl(0.46, 0.48, 0.02, 0, 0, 0, C.grass, 12);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      b.box(0.07, 0.4, 0.07, x * 0.25, 0.02, z * 0.25, C.iron, 0, x * 0.42, -z * 0.42); // four legs leaning in
    }
    b.box(0.36, 0.035, 0.36, 0, 0.36, 0, 0x6e6156); // first deck
    b.cyl(0.07, 0.16, 0.3, 0, 0.39, 0, C.iron, 4, Math.PI / 4);
    b.box(0.19, 0.03, 0.19, 0, 0.69, 0, 0x6e6156); // second deck
    b.cyl(0.018, 0.07, 0.42, 0, 0.72, 0, C.iron, 4, Math.PI / 4);
    b.cyl(0.004, 0.012, 0.1, 0, 1.14, 0, C.iron, 4);
    flag(m, 0, 1.2, 0, 0.14, 0x3b6fb0);
  },

  windmill(m) {
    const b = m.body;
    b.cyl(0.46, 0.48, 0.02, 0, 0, 0, C.grass, 12);
    b.cyl(0.13, 0.21, 0.5, 0, 0.02, 0, C.white, 8);
    b.cyl(0.24, 0.24, 0.02, 0, 0.2, 0, C.wood, 8); // gallery
    b.cone(0.16, 0.14, 0, 0.52, 0, 0x4a3b33, 8);
    b.box(0.07, 0.12, 0.02, 0, 0.02, 0.2, C.wood);
    for (let i = 0; i < 5; i++) b.ball(0.035, -0.36 + i * 0.07, 0.04, 0.34, i % 2 ? C.red : C.gold); // tulips
    const sails = m.part([0, 0.56, 0.17], { kind: 'spin', axis: 'z', amount: 1, speed: 1.6 });
    sails.cyl(0.03, 0.03, 0.05, 0, 0.56, 0.15, C.dark, 6, 0, 0, Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      sails.box(0.07, 0.36, 0.012, 0, 0.56, 0.19, C.pale, 0, a);
    }
  },

  castle(m, v) {
    const b = m.body;
    const wall = v === 'white' || v === 'alpine' ? C.white : v === 'sand' ? C.sand : v === 'brick' ? C.brick : v === 'dark' ? 0x7f8189 : v === 'spires' || v === 'dome' ? C.pale : C.stone;
    const roof = v === 'white' ? 0x3d5f8f : v === 'sand' ? C.tile : v === 'brick' ? 0x4f8f7a : v === 'dark' ? 0x7a3f33 : v === 'spires' ? 0x3f4a55 : v === 'dome' ? 0x9c3b30 : C.red;
    const tall = v === 'white' || v === 'spires' || v === 'dark';
    b.cyl(0.46, 0.5, 0.08, 0, 0, 0, v === 'alpine' ? C.snow : C.grass, 9);
    b.box(0.5, 0.24, 0.36, 0, 0.08, 0, wall); // the keep
    if (v === 'dome') {
      // a long riverside hall under a central dome
      b.box(0.8, 0.18, 0.24, 0, 0.08, 0.06, wall).ball(0.14, 0, 0.36, 0, roof, 1, 1.15, 1).cyl(0.004, 0.012, 0.16, 0, 0.5, 0, C.gold, 4);
      for (let i = 0; i < 6; i++) b.cone(0.022, 0.2, -0.36 + i * 0.144, 0.26, 0.16, roof, 4);
      return;
    }
    b.roof(0.36, 0.14, 0.5, 0, 0.32, 0, roof, Math.PI / 2);
    for (let i = 0; i < 5; i++) b.box(0.05, 0.04, 0.03, -0.2 + i * 0.1, 0.32, 0.19, wall); // battlements
    b.box(0.1, 0.14, 0.02, 0, 0.08, 0.185, C.dark); // gate
    const towers: [number, number, number, number][] = [[-0.3, 0.17, 0.07, tall ? 0.56 : 0.4], [0.3, 0.17, 0.07, tall ? 0.5 : 0.4], [-0.27, -0.17, 0.06, tall ? 0.7 : 0.46], [0.27, -0.17, 0.065, tall ? 0.62 : 0.44]];
    for (const [x, z, r, h] of towers) {
      b.cyl(r, r, h, x, 0.08, z, wall, 8);
      b.cone(r * 1.3, tall ? 0.26 : 0.16, x, 0.08 + h, z, roof, 8);
    }
    if (v === 'spires') for (const x of [-0.1, 0.1]) b.box(0.07, 0.5, 0.07, x, 0.08, -0.05, wall).cone(0.05, 0.3, x, 0.58, -0.05, roof, 4, Math.PI / 4);
    if (v === 'alpine') pine(b, 0.4, 0.3, 0.3);
    flag(m, -0.27, 0.08 + (tall ? 0.7 : 0.46) + (tall ? 0.26 : 0.16), -0.17, 0.16, v === 'white' ? 0x2b3554 : C.gold);
  },

  temple(m, v) {
    const b = m.body;
    const stone = v === 'rose' ? C.rose : v === 'sand' ? C.sand : v === 'gate' ? 0xd8cfb8 : C.white;
    if (v === 'gate') {
      // a columned city gate with a chariot group on top
      b.box(0.86, 0.04, 0.3, 0, 0, 0, C.stone);
      for (let i = 0; i < 6; i++) b.cyl(0.03, 0.035, 0.42, -0.35 + i * 0.14, 0.04, 0, stone, 8);
      b.box(0.84, 0.1, 0.2, 0, 0.46, 0, stone).box(0.4, 0.05, 0.16, 0, 0.56, 0, stone);
      b.box(0.22, 0.07, 0.06, 0, 0.61, 0.02, 0x4f8f7a).box(0.03, 0.1, 0.03, 0.03, 0.66, -0.03, 0x4f8f7a);
      flag(m, 0.03, 0.74, -0.03, 0.14, C.gold);
      return;
    }
    if (v === 'rose') b.box(0.9, 0.9, 0.3, 0, 0, -0.2, 0xb87458); // the cliff the front is carved from
    b.box(0.8, 0.04, 0.5, 0, 0, 0.05, stone).box(0.72, 0.04, 0.44, 0, 0.04, 0.05, stone);
    const broken = v === 'sand';
    for (let i = 0; i < 6; i++) {
      const x = -0.3 + i * 0.12;
      b.cyl(0.026, 0.03, broken && i % 3 === 1 ? 0.18 : 0.36, x, 0.08, 0.22, stone, 8);
      if (v !== 'rose') b.cyl(0.026, 0.03, broken && i % 2 === 0 ? 0.12 : 0.36, x, 0.08, -0.12, stone, 8);
    }
    if (!broken) {
      b.box(0.72, 0.05, v === 'rose' ? 0.12 : 0.42, 0, 0.44, v === 'rose' ? 0.2 : 0.05, stone);
      b.roof(0.72, 0.13, v === 'rose' ? 0.12 : 0.42, 0, 0.49, v === 'rose' ? 0.2 : 0.05, stone);
    } else {
      b.box(0.4, 0.05, 0.08, -0.14, 0.44, 0.22, stone);
      palm(b, 0.36, 0.3, 0.34);
    }
    if (v === 'rose') b.cyl(0.06, 0.07, 0.16, 0, 0.62, 0.18, stone, 8).cone(0.07, 0.08, 0, 0.78, 0.18, stone, 8);
  },

  arena(m, v) {
    const b = m.body;
    const stone = v === 'sand' ? 0xd2b680 : 0xd9c6a0;
    b.cyl(0.46, 0.48, 0.02, 0, 0, 0, v === 'sand' ? C.sand : C.grass, 14);
    b.cyl(0.26, 0.26, 0.025, 0, 0.02, 0, 0xe2cf9e, 14); // the floor
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;
      const tiers = i >= 3 && i <= 8 ? 1 : i === 2 || i === 9 ? 2 : 3; // one side has fallen
      for (let t = 0; t < tiers; t++) {
        b.box(0.115, 0.1, 0.07, Math.cos(a) * 0.36, 0.02 + t * 0.11, Math.sin(a) * 0.26, stone, -a + Math.PI / 2);
        b.box(0.05, 0.065, 0.075, Math.cos(a) * 0.36, 0.02 + t * 0.11, Math.sin(a) * 0.26, 0x6d5b48, -a + Math.PI / 2); // arch openings
      }
    }
  },

  longship(m) {
    water(m.body);
    const ship = m.part([0, 0.06, 0], { kind: 'swing', axis: 'z', amount: 0.09, speed: 1.7 });
    ship.ball(0.2, 0, 0.09, 0, C.wood, 2.1, 0.42, 0.62); // hull
    ship.box(0.05, 0.22, 0.04, 0.4, 0.07, 0, C.wood, 0, -0.5).box(0.05, 0.16, 0.04, -0.4, 0.07, 0, C.wood, 0, 0.5); // prow and stern
    ship.ball(0.035, 0.47, 0.27, 0, C.gold);
    ship.cyl(0.012, 0.014, 0.5, 0, 0.1, 0, C.dark, 5);
    ship.box(0.34, 0.26, 0.012, 0, 0.3, 0.012, C.pale);
    for (const x of [-0.11, 0, 0.11]) ship.box(0.045, 0.26, 0.014, x, 0.3, 0.013, C.red);
    for (let i = 0; i < 6; i++) ship.cyl(0.035, 0.035, 0.012, -0.25 + i * 0.1, 0.13, 0.125, [C.red, C.gold, C.blue][i % 3], 8, 0, 0, Math.PI / 2); // shields
  },

  cabin(m, v) {
    const b = m.body;
    const snow = v === 'snow';
    const wall = v === 'red' ? 0xa63a2a : v === 'danish' ? C.white : C.log;
    const roof = snow ? C.snow : v === 'danish' ? C.thatch : v === 'red' ? 0x3f4a55 : 0x6b4a3a;
    b.cyl(0.46, 0.5, 0.03, 0, 0, 0, snow ? C.snow : C.grass, 10);
    b.box(0.4, 0.2, 0.3, -0.04, 0.03, 0, wall).roof(0.34, 0.16, 0.44, -0.04, 0.23, 0, roof, Math.PI / 2);
    b.box(0.07, 0.12, 0.012, -0.04, 0.03, 0.152, v === 'red' ? C.white : C.dark); // door
    b.box(0.07, 0.07, 0.012, -0.16, 0.1, 0.152, C.gold).box(0.07, 0.07, 0.012, 0.08, 0.1, 0.152, C.gold); // lit windows
    b.box(0.05, 0.16, 0.05, 0.08, 0.26, -0.06, C.rock); // chimney
    if (v === 'danish') for (const x of [-0.24, -0.04, 0.16]) b.box(0.014, 0.2, 0.012, x, 0.03, 0.153, C.dark); // timber framing
    pine(b, 0.3, -0.16, 0.56, snow ? 0x3d6f5a : C.pine);
    pine(b, -0.36, -0.1, 0.44, snow ? 0x3d6f5a : C.pine);
    if (snow) b.cone(0.09, 0.08, 0.3, 0.5, -0.16, C.snow, 6).cone(0.07, 0.07, -0.36, 0.38, -0.1, C.snow, 6);
    const smoke = m.part([0.08, 0.44, -0.06], { kind: 'bob', axis: 'y', amount: 0.05, speed: 1.4 });
    smoke.ball(0.035, 0.08, 0.46, -0.06, C.pale).ball(0.045, 0.1, 0.54, -0.06, C.pale);
    flag(m, 0.36, 0.03, 0.2, 0.44, v === 'red' ? C.gold : v === 'snow' ? C.white : C.red);
  },

  skyline(m) {
    const b = m.body;
    b.box(0.8, 0.03, 0.5, 0, 0, 0, C.grey);
    const blocks: [number, number, number, number, number][] = [[-0.3, 0.02, 0.15, 0.4, 0x8fa3ba], [-0.12, 0.1, 0.13, 0.56, 0xb9c4cf], [0.26, 0.06, 0.16, 0.46, 0xcdbd9a], [0.36, -0.12, 0.12, 0.3, 0x8fa3ba], [-0.26, -0.14, 0.14, 0.26, 0xcdbd9a]];
    for (const [x, z, w, h, c] of blocks) b.box(w, h, w, x, 0.03, z, c).box(w * 0.86, 0.01, w * 0.86, x, 0.03 + h, z, C.dark);
    // the tall one steps in towards a spire
    b.box(0.2, 0.52, 0.2, 0.07, 0.03, -0.04, 0xb0a48e).box(0.15, 0.16, 0.15, 0.07, 0.55, -0.04, 0xb0a48e).box(0.1, 0.1, 0.1, 0.07, 0.71, -0.04, 0xc5baa3);
    b.cyl(0.004, 0.03, 0.26, 0.07, 0.81, -0.04, C.steel, 6);
    flag(m, -0.12, 0.6, 0.1, 0.16, C.red);
  },

  steppyramid(m, v) {
    const b = m.body;
    if (v === 'mud') {
      // a mud-brick temple mound with one long stair
      b.cyl(0.5, 0.52, 0.02, 0, 0, 0, C.sand, 12);
      b.box(0.74, 0.16, 0.54, 0, 0.02, 0, C.mud).box(0.5, 0.14, 0.36, 0, 0.18, -0.02, 0xb98d5c).box(0.26, 0.12, 0.2, 0, 0.32, -0.04, C.mud);
      b.box(0.12, 0.3, 0.4, 0, 0.02, 0.3, 0xd3ab7c, 0, 0, -0.62);
      return;
    }
    const stone = v === 'jungle' ? 0x9aa07f : 0xbcae8e;
    b.cyl(0.5, 0.52, 0.02, 0, 0, 0, v === 'jungle' ? 0x4f8f4a : C.grass, 12);
    for (let i = 0; i < 5; i++) {
      const w = 0.7 - i * 0.12;
      b.box(w, 0.09, w, 0, 0.02 + i * 0.09, 0, i % 2 ? stone : 0xcbbd9b);
    }
    b.box(0.13, 0.5, 0.1, 0, 0.0, 0.33, 0xd8ccae, 0, 0, -0.6); // the stair
    b.box(0.18, 0.11, 0.16, 0, 0.47, 0, stone).box(0.22, 0.03, 0.2, 0, 0.58, 0, 0xcbbd9b);
    if (v === 'jungle') {
      b.ball(0.12, -0.38, 0.1, 0.26, 0x3f8a3d).ball(0.1, 0.4, 0.09, 0.22, 0x4a9645);
      palm(b, 0.38, -0.28, 0.5);
    }
  },

  church(m, v) {
    const b = m.body;
    const wall = v === 'yellow' ? 0xe8c75a : v === 'mission' ? 0xd6a274 : C.white;
    const roof = v === 'mission' ? 0x8f5a3c : C.tile;
    b.cyl(0.46, 0.5, 0.02, 0, 0, 0, C.grass, 10);
    b.box(0.3, 0.24, 0.5, 0, 0.02, -0.04, wall).roof(0.3, 0.12, 0.5, 0, 0.26, -0.04, roof);
    b.box(0.09, 0.14, 0.012, 0, 0.02, 0.212, C.wood);
    if (v === 'mission') {
      b.box(0.4, 0.44, 0.05, 0, 0.02, 0.22, wall).box(0.08, 0.08, 0.06, 0, 0.36, 0.22, C.dark); // bell wall
      b.box(0.012, 0.1, 0.012, 0, 0.46, 0.22, C.wood).box(0.06, 0.012, 0.012, 0, 0.51, 0.22, C.wood);
      return;
    }
    const twin = v === 'red' || v === 'yellow';
    for (const x of twin ? [-0.19, 0.19] : [-0.2]) {
      b.box(0.13, 0.46, 0.13, x, 0.02, 0.17, wall).box(0.08, 0.07, 0.14, x, 0.36, 0.17, C.dark);
      b.pyramid(0.16, 0.12, x, 0.48, 0.17, v === 'red' ? C.red : roof);
      b.box(0.012, 0.1, 0.012, x, 0.6, 0.17, C.gold).box(0.06, 0.012, 0.012, x, 0.65, 0.17, C.gold);
    }
    if (v === 'palm') {
      palm(b, 0.34, 0.2, 0.5);
      palm(b, 0.3, -0.24, 0.4);
    }
  },

  volcano(m, v) {
    const b = m.body;
    if (v === 'snow') {
      // a broad, flat-topped mountain with a snow cap, rising out of grassland
      b.cyl(0.5, 0.52, 0.02, 0, 0, 0, 0xb9b765, 12);
      b.cyl(0.2, 0.46, 0.34, 0, 0.02, -0.04, 0x8b7460, 9).cyl(0.12, 0.2, 0.1, 0, 0.36, -0.04, C.snow, 9);
      b.cyl(0.012, 0.016, 0.16, 0.3, 0.02, 0.3, C.wood, 5).ball(0.12, 0.3, 0.2, 0.3, 0x5f8f45, 1, 0.3, 1);
      return;
    }
    b.cyl(0.5, 0.52, 0.02, 0, 0, 0, v === 'green' ? 0x4f8f4a : C.grass, 12);
    b.cyl(0.22, 0.46, 0.3, 0, 0.02, 0, v === 'green' ? 0x5f8f4f : 0x6f8b55, 9);
    b.cyl(0.07, 0.22, 0.26, 0, 0.32, 0, 0x7a5b47, 9).cyl(0.05, 0.065, 0.02, 0, 0.58, 0, 0xe8642c, 9);
    const smoke = m.part([0, 0.62, 0], { kind: 'bob', axis: 'y', amount: 0.06, speed: 1.2 });
    smoke.ball(0.05, 0, 0.66, 0, 0xb9b4ad).ball(0.07, 0.04, 0.76, 0, 0xcbc6bf).ball(0.085, 0.01, 0.89, 0.02, 0xdad6d0);
  },

  ship(m, v) {
    water(m.body);
    const hull = m.part([0, 0.05, 0], { kind: 'swing', axis: 'z', amount: 0.08, speed: 1.6 });
    if (v === 'freighter') {
      hull.box(0.78, 0.1, 0.2, 0, 0.03, 0, 0x4f5a66).box(0.8, 0.03, 0.21, 0, 0.1, 0, C.red);
      hull.box(0.14, 0.16, 0.18, -0.28, 0.13, 0, C.white).cyl(0.03, 0.035, 0.1, -0.28, 0.29, 0, C.red, 6);
      for (let i = 0; i < 4; i++) hull.box(0.1, i % 2 ? 0.07 : 0.12, 0.16, -0.1 + i * 0.12, 0.13, 0, [C.blue, C.gold, 0x4f8f6a, C.tile][i]); // containers
      return;
    }
    if (v === 'riverboat') {
      hull.ball(0.18, 0, 0.07, 0, C.wood, 2.2, 0.3, 0.6);
      hull.box(0.3, 0.1, 0.16, -0.04, 0.09, 0, C.thatch).roof(0.18, 0.06, 0.32, -0.04, 0.19, 0, 0xb08d4a, Math.PI / 2);
      hull.cyl(0.006, 0.006, 0.3, 0.3, 0.08, 0, C.dark, 4, 0, -0.5);
      return;
    }
    hull.ball(0.2, 0, 0.09, 0, C.wood, 1.9, 0.5, 0.62);
    hull.box(0.12, 0.08, 0.2, -0.3, 0.12, 0, 0x7a4f30); // raised stern
    hull.cyl(0.012, 0.014, 0.5, 0.02, 0.1, 0, C.dark, 5);
    if (v === 'caravel') {
      hull.box(0.28, 0.24, 0.012, 0.02, 0.3, 0.012, C.white).box(0.2, 0.05, 0.014, 0.02, 0.4, 0.013, C.red).box(0.05, 0.18, 0.014, 0.02, 0.33, 0.013, C.red);
      hull.cyl(0.01, 0.012, 0.36, -0.24, 0.16, 0, C.dark, 5).box(0.18, 0.2, 0.012, -0.24, 0.28, 0.012, C.white, 0, 0.35);
    } else {
      // one big slanted sail
      hull.box(0.4, 0.34, 0.012, 0.0, 0.26, 0.012, v === 'dhow2' ? 0xe6d3a5 : C.white, 0, 0.5);
    }
  },

  derrick(m, v) {
    const b = m.body;
    const desert = v === 'desert';
    b.cyl(0.48, 0.5, 0.02, 0, 0, 0, desert ? C.sand : C.grass, 12);
    b.cyl(0.02, 0.13, 0.7, -0.2, 0.02, -0.06, 0x7a3f33, 4, Math.PI / 4); // drilling tower
    for (let i = 0; i < 4; i++) b.box(0.2 - i * 0.045, 0.012, 0.2 - i * 0.045, -0.2, 0.14 + i * 0.14, -0.06, C.dark);
    b.cyl(0.1, 0.1, 0.16, 0.26, 0.02, -0.18, 0xc7ccd1, 10); // storage tank
    b.box(0.2, 0.03, 0.1, 0.16, 0.02, 0.2, C.dark).box(0.03, 0.2, 0.03, 0.16, 0.05, 0.2, 0x4f5a66);
    // the pump beam nods
    const beam = m.part([0.16, 0.25, 0.2], { kind: 'swing', axis: 'z', amount: 0.32, speed: 2.4 });
    beam.box(0.4, 0.035, 0.035, 0.16, 0.24, 0.2, C.red).box(0.06, 0.12, 0.05, 0.36, 0.16, 0.2, C.red).box(0.07, 0.07, 0.07, -0.04, 0.2, 0.2, C.dark);
    if (desert) {
      b.cyl(0.012, 0.016, 0.34, 0.38, 0.02, -0.02, C.dark, 5);
      m.part([0.38, 0.36, -0.02], { kind: 'bob', axis: 'y', amount: 0.02, speed: 7 }).cone(0.04, 0.12, 0.38, 0.36, -0.02, 0xf08a2e, 6);
    }
  },

  terraces(m, v) {
    const b = m.body;
    const high = v === 'high';
    for (let i = 0; i < 5; i++) {
      const r = 0.5 - i * 0.085;
      b.cyl(r, r + 0.02, 0.1, i * 0.03, i * 0.1, -i * 0.02, i % 2 ? (high ? 0xb8a85f : 0x6f9a55) : high ? 0xa8975a : 0x86ad62, 9);
      b.cyl(r + 0.004, r + 0.004, 0.02, i * 0.03, i * 0.1 + 0.08, -i * 0.02, 0xa79b88, 9); // retaining walls
    }
    b.box(0.16, 0.1, 0.12, 0.12, 0.5, -0.08, 0xa79b88).roof(0.14, 0.09, 0.2, 0.12, 0.6, -0.08, C.thatch, Math.PI / 2);
    b.cone(0.1, 0.3, -0.12, 0.5, -0.16, 0x7d7468, 6);
    if (high) {
      // a llama grazing on a lower step
      b.box(0.14, 0.08, 0.06, -0.26, 0.26, 0.2, C.white).box(0.035, 0.12, 0.035, -0.2, 0.3, 0.2, C.white).box(0.06, 0.04, 0.04, -0.18, 0.41, 0.2, C.white);
      for (const x of [-0.31, -0.21]) b.box(0.02, 0.07, 0.02, x, 0.2, 0.2, C.pale);
    }
  },

  statue(m) {
    const b = m.body;
    b.cyl(0.24, 0.46, 0.32, 0, 0, 0, 0x5f8f4f, 8).cyl(0.14, 0.24, 0.16, 0, 0.32, 0, 0x7d7468, 7); // the hill
    b.ball(0.1, -0.24, 0.16, 0.2, 0x3f8a3d).ball(0.09, 0.26, 0.14, 0.16, 0x4a9645);
    b.box(0.12, 0.1, 0.12, 0, 0.48, 0, C.stone);
    b.cyl(0.035, 0.06, 0.28, 0, 0.58, 0, C.white, 8); // robed figure
    b.box(0.46, 0.035, 0.045, 0, 0.78, 0, C.white); // open arms
    b.ball(0.04, 0, 0.9, 0, C.white);
  },

  windpump(m) {
    const b = m.body;
    b.cyl(0.48, 0.5, 0.02, 0, 0, 0, 0xa8b060, 12);
    b.cyl(0.015, 0.1, 0.6, -0.1, 0.02, 0, C.grey, 4, Math.PI / 4);
    b.cyl(0.11, 0.11, 0.1, 0.22, 0.02, -0.12, 0x9aa3ab, 10).cyl(0.1, 0.1, 0.012, 0.22, 0.115, -0.12, C.water, 10); // water tank
    for (let i = 0; i < 6; i++) b.box(0.012, 0.09, 0.012, -0.4 + i * 0.16, 0.02, 0.32, C.wood);
    b.box(0.82, 0.012, 0.012, 0, 0.08, 0.32, C.wood);
    b.box(0.14, 0.08, 0.07, 0.24, 0.07, 0.16, 0x7a4f30).box(0.05, 0.05, 0.05, 0.33, 0.12, 0.16, 0x7a4f30); // a cow
    for (const x of [0.19, 0.29]) b.box(0.02, 0.05, 0.02, x, 0.02, 0.16, 0x7a4f30);
    const wheel = m.part([-0.1, 0.62, 0.03], { kind: 'spin', axis: 'z', amount: 1, speed: 2.6 });
    for (let i = 0; i < 8; i++) wheel.box(0.035, 0.15, 0.008, -0.1, 0.62, 0.035, C.steel, 0, (i / 8) * TAU);
    b.box(0.012, 0.1, 0.16, -0.1, 0.57, -0.1, C.red); // tail vane
  },

  moai(m) {
    const b = m.body;
    b.ball(0.48, 0, 0, 0, 0x7da653, 1, 0.16, 0.8);
    for (const [x, z, h, hat] of [[-0.24, 0.02, 0.44, 1], [0.02, -0.02, 0.56, 0], [0.26, 0.04, 0.4, 1]] as const) {
      b.cyl(0.07, 0.085, h, x, 0.04, z, 0x8d8a84, 4, Math.PI / 4);
      b.box(0.13, 0.035, 0.05, x, 0.04 + h * 0.72, z + 0.06, 0x7b7872); // heavy brow
      b.box(0.035, 0.13, 0.05, x, 0.04 + h * 0.46, z + 0.07, 0x8d8a84); // long nose
      b.box(0.08, 0.02, 0.03, x, 0.04 + h * 0.32, z + 0.065, 0x6b6862);
      if (hat) b.cyl(0.07, 0.07, 0.07, x, 0.04 + h, z, 0xa1553f, 8);
    }
  },

  stele(m, v) {
    const b = m.body;
    if (v === 'white') {
      // a white obelisk in a round plaza
      b.cyl(0.46, 0.48, 0.02, 0, 0, 0, C.grey, 14).cyl(0.2, 0.2, 0.03, 0, 0.02, 0, C.grass, 12);
      b.cyl(0.035, 0.065, 0.8, 0, 0.05, 0, C.white, 4, Math.PI / 4).pyramid(0.05, 0.08, 0, 0.85, 0, C.white);
      b.cyl(0.015, 0.02, 0.2, 0.3, 0.02, 0.18, C.wood, 5).ball(0.13, 0.3, 0.3, 0.18, 0x8a6fc0, 1, 0.8, 1); // a tree in purple bloom
      flag(m, -0.32, 0.02, 0.1, 0.4, 0x7fb6e6);
      return;
    }
    b.cyl(0.48, 0.5, 0.03, 0, 0, 0, 0xb9a070, 12);
    b.cyl(0.045, 0.07, 0.86, -0.14, 0.03, -0.06, 0x9a8f80, 4, Math.PI / 4).ball(0.05, -0.14, 0.9, -0.06, 0x9a8f80, 1, 0.5, 0.4); // the tall carved stone
    b.cyl(0.03, 0.045, 0.46, -0.34, 0.03, 0.06, 0x8a7f70, 4, Math.PI / 4);
    b.box(0.3, 0.16, 0.1, 0.2, 0.03, 0.12, 0xa8553f).box(0.1, 0.16, 0.3, 0.2, 0.03, 0.12, 0xa8553f); // cross-shaped rock church
    b.box(0.31, 0.02, 0.11, 0.2, 0.19, 0.12, 0xc06a50).box(0.11, 0.02, 0.31, 0.2, 0.19, 0.12, 0xc06a50);
  },

  fort(m, v) {
    const b = m.body;
    if (v === 'mudtowers') {
      // tall mud tower houses with white-painted trim
      b.cyl(0.46, 0.48, 0.02, 0, 0, 0, C.sand, 12);
      for (const [x, z, h] of [[-0.24, 0.06, 0.6], [0, -0.06, 0.78], [0.22, 0.08, 0.66], [0.06, 0.24, 0.44], [-0.14, -0.2, 0.5]] as const) {
        b.box(0.17, h, 0.17, x, 0.02, z, 0xa87a52);
        for (let k = 1; k < 4; k++) b.box(0.175, 0.018, 0.175, x, 0.02 + (h * k) / 4, z, C.white);
        b.box(0.18, 0.03, 0.18, x, 0.02 + h, z, C.white);
      }
      return;
    }
    if (v === 'ruin') {
      // dry-stone ruins: a great curved wall and a cone tower
      b.cyl(0.48, 0.5, 0.02, 0, 0, 0, 0xa8b060, 12);
      for (let i = 0; i < 12; i++) {
        const a = (i / 16) * TAU + 0.6;
        b.box(0.14, 0.2 - (i % 3) * 0.03, 0.07, Math.cos(a) * 0.34, 0.02, Math.sin(a) * 0.3, 0x9a8f80, -a + Math.PI / 2);
      }
      b.cyl(0.05, 0.11, 0.42, 0.06, 0.02, 0.02, 0x8a7f70, 9);
      b.cyl(0.012, 0.016, 0.16, -0.3, 0.02, 0.32, C.wood, 5).ball(0.12, -0.3, 0.2, 0.32, 0x5f8f45, 1, 0.3, 1);
      return;
    }
    if (v === 'tower') {
      // a stone tower house above a village
      b.cyl(0.3, 0.46, 0.2, 0, 0, 0, 0x7d8f5a, 8);
      b.box(0.2, 0.5, 0.2, -0.06, 0.2, 0, C.stone).pyramid(0.26, 0.12, -0.06, 0.7, 0, C.tile);
      b.box(0.16, 0.12, 0.14, 0.2, 0.14, 0.14, C.white).roof(0.16, 0.07, 0.18, 0.2, 0.26, 0.14, C.tile, Math.PI / 2);
      flag(m, -0.06, 0.82, 0, 0.14, C.red);
      return;
    }
    const wall = v === 'white' ? C.white : v === 'stone' ? C.stone : v === 'mud' ? C.mud : C.sand;
    const mound = v === 'citadel' || v === 'golddome';
    if (mound) b.cyl(0.4, 0.5, 0.16, 0, 0, 0, 0xcbb07a, 10);
    else b.cyl(0.48, 0.5, 0.02, 0, 0, 0, v === 'mud' ? C.sand : C.grass, 12);
    const y = mound ? 0.16 : 0.02;
    b.box(0.6, 0.18, 0.5, 0, y, 0, wall).box(0.5, 0.02, 0.4, 0, y + 0.181, 0, v === 'white' ? 0xd9d2c0 : 0xa89878); // the yard inside
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      if (v === 'white') b.box(0.14, 0.26, 0.14, x * 0.3, y, z * 0.25, wall);
      else b.cyl(0.075, 0.085, 0.3, x * 0.3, y, z * 0.25, wall, 8);
      if (v === 'stone') b.cone(0.1, 0.12, x * 0.3, y + 0.3, z * 0.25, C.tile, 8);
    }
    for (let i = 0; i < 5; i++) b.box(0.05, 0.035, 0.03, -0.2 + i * 0.1, y + 0.18, 0.25, wall);
    b.box(0.1, 0.12, 0.02, 0, y, 0.255, C.dark);
    if (v === 'golddome') b.cyl(0.11, 0.11, 0.1, 0, y + 0.2, 0, 0x3f7fb0, 8).ball(0.11, 0, y + 0.32, 0, C.gold);
    if (v === 'white') {
      for (const x of [-0.14, 0.14]) b.cyl(0.018, 0.018, 0.12, x, y + 0.2, 0.2, C.dark, 6, 0, 0, Math.PI / 2 - 0.2); // cannon
      palm(b, 0.4, -0.2, 0.46);
    }
    flag(m, mound ? 0 : -0.3, y + (v === 'golddome' ? 0.44 : 0.3), mound ? -0.2 : -0.25, 0.2, v === 'mud' ? C.dark : C.red);
  },

  huts(m, v) {
    const b = m.body;
    const wall = v === 'mud' ? 0xc98a5e : C.mud;
    b.cyl(0.48, 0.5, 0.02, 0, 0, 0, v === 'forest' ? 0x4f8f4a : 0xa8b060, 12);
    for (const [x, z, r] of [[-0.2, 0.08, 0.12], [0.14, 0.12, 0.1], [0, -0.16, 0.11]] as const) {
      b.cyl(r, r, 0.13, x, 0.02, z, wall, 9).cone(r * 1.5, 0.2, x, 0.15, z, C.thatch, 9);
      b.box(0.045, 0.085, 0.012, x, 0.02, z + r, C.dark);
    }
    if (v === 'mud') b.cyl(0.05, 0.065, 0.14, 0.34, 0.02, -0.12, wall, 8).cone(0.08, 0.1, 0.34, 0.16, -0.12, C.thatch, 8); // granary
    if (v === 'river') {
      b.box(0.26, 0.012, 0.3, 0.34, 0.021, 0.02, C.water);
      b.box(0.3, 0.03, 0.05, 0.3, 0.03, 0.26, C.wood, 0.4); // a dugout canoe
      palm(b, -0.38, -0.16, 0.46);
    }
    if (v === 'palm') {
      palm(b, 0.36, -0.14, 0.5);
      palm(b, -0.38, -0.12, 0.4);
    }
    if (v === 'savanna' || v === '') b.cyl(0.012, 0.016, 0.22, 0.34, 0.02, -0.16, C.wood, 5).ball(0.16, 0.34, 0.26, -0.16, 0x5f8f45, 1, 0.3, 1);
    if (v === 'forest') {
      for (const [x, z, h] of [[0.36, -0.14, 0.62], [-0.36, -0.18, 0.5], [0.3, 0.26, 0.4]] as const) {
        b.cyl(0.018, 0.024, h * 0.6, x, 0.02, z, C.wood, 5).ball(h * 0.3, x, h * 0.72, z, 0x2f7a3f, 1, 0.9, 1);
      }
    }
  },

  acacia(m, v) {
    const b = m.body;
    if (v === 'desert') {
      // red dunes and a dead tree
      b.cyl(0.48, 0.5, 0.02, 0, 0, 0, 0xd9a05e, 12);
      b.ball(0.34, -0.1, 0.02, -0.1, 0xcf7a45, 1.1, 0.5, 0.8).ball(0.24, 0.24, 0.02, 0.1, 0xd98850, 1, 0.42, 0.8);
      b.cyl(0.012, 0.02, 0.26, 0.2, 0.06, 0.3, C.dark, 5).box(0.16, 0.012, 0.012, 0.24, 0.26, 0.3, C.dark, 0, 0.5).box(0.12, 0.012, 0.012, 0.15, 0.22, 0.3, C.dark, 0, -0.6);
      return;
    }
    b.cyl(0.48, 0.5, 0.02, 0, 0, 0, 0xb9b765, 12);
    if (v === 'baobab') {
      // a swollen trunk under a sparse crown
      b.cyl(0.09, 0.15, 0.4, 0, 0.02, 0, 0x9a8a78, 8);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        b.box(0.2, 0.025, 0.025, Math.cos(a) * 0.12, 0.42, Math.sin(a) * 0.12, 0x8a7a68, -a, 0.5);
        b.ball(0.07, Math.cos(a) * 0.24, 0.54, Math.sin(a) * 0.24, 0x5f8f45, 1, 0.6, 1);
      }
      return;
    }
    b.cyl(0.02, 0.03, 0.4, -0.2, 0.02, -0.06, C.wood, 5).ball(0.3, -0.2, 0.46, -0.06, 0x5f8f45, 1, 0.22, 0.85); // flat-topped tree
    // a giraffe, which dips its neck to browse while the country is in focus
    for (const [x, z] of [[0.14, 0.06], [0.26, 0.06], [0.14, 0.14], [0.26, 0.14]]) b.box(0.02, 0.2, 0.02, x, 0.02, z, 0xd9a441);
    b.box(0.17, 0.09, 0.1, 0.2, 0.22, 0.1, 0xd9a441);
    const neck = m.part([0.27, 0.3, 0.1], { kind: 'raise', axis: 'z', amount: -0.7, speed: 1.6 });
    neck.box(0.035, 0.3, 0.04, 0.27, 0.28, 0.1, 0xd9a441, 0, -0.25).box(0.09, 0.04, 0.045, 0.37, 0.56, 0.1, 0xd9a441);
  },

  headframe(m) {
    const b = m.body;
    b.cyl(0.48, 0.5, 0.02, 0, 0, 0, 0xb9a070, 12);
    b.box(0.03, 0.62, 0.03, -0.06, 0.02, 0, C.iron).box(0.03, 0.62, 0.03, 0.06, 0.02, 0, C.iron);
    b.box(0.03, 0.7, 0.03, 0.2, 0.02, 0, C.iron, 0, 0.42); // the raking leg
    b.box(0.2, 0.03, 0.1, 0, 0.6, 0, C.iron);
    b.box(0.24, 0.16, 0.2, -0.26, 0.02, 0.06, C.brick).roof(0.24, 0.08, 0.2, -0.26, 0.18, 0.06, 0x54606a);
    b.cone(0.16, 0.2, 0.3, 0.02, 0.18, 0xcdaa4a, 8); // spoil heap
    const wheel = m.part([0, 0.7, 0], { kind: 'spin', axis: 'z', amount: 1, speed: 2.2 });
    wheel.cyl(0.085, 0.085, 0.025, 0, 0.7, -0.012, C.dark, 12, 0, 0, Math.PI / 2);
    for (let i = 0; i < 3; i++) wheel.box(0.012, 0.16, 0.03, 0, 0.7, 0, C.steel, 0, (i / 3) * Math.PI);
  },

  shells(m) {
    const b = m.body;
    water(b, 0.5);
    b.box(0.74, 0.07, 0.34, 0, 0.02, 0, 0xd8b9a0);
    // overlapping white roof shells, each a tilted half-cone
    for (const [x, s] of [[-0.24, 0.8], [-0.04, 1], [0.18, 0.86]] as const) {
      b.cyl(0, 0.13 * s, 0.34 * s, x, 0.09, 0.02, C.white, 4, 0.4, -0.5);
      b.cyl(0, 0.1 * s, 0.24 * s, x + 0.1, 0.09, 0.02, 0xe6e1d6, 4, 0.4, -0.75);
    }
    b.cyl(0, 0.08, 0.2, -0.3, 0.09, -0.12, C.white, 4, 0.4, 0.5);
    const boat = m.part([0.3, 0.03, 0.34], { kind: 'swing', axis: 'z', amount: 0.12, speed: 2 });
    boat.box(0.14, 0.03, 0.05, 0.3, 0.02, 0.34, C.white).box(0.012, 0.16, 0.1, 0.3, 0.05, 0.34, C.white);
  },

  stilt(m, v) {
    const b = m.body;
    b.cyl(0.48, 0.5, 0.02, 0, 0, 0, 0x6f9a55, 12);
    for (const [x, z] of [[-0.17, -0.11], [0.17, -0.11], [-0.17, 0.11], [0.17, 0.11]]) b.cyl(0.014, 0.014, 0.2, x, 0.02, z, C.wood, 5);
    b.box(0.46, 0.025, 0.32, 0, 0.21, 0, C.wood).box(0.38, 0.14, 0.24, 0, 0.235, 0, v === 'palm' ? C.thatch : C.log);
    b.box(0.1, 0.02, 0.16, 0, 0.1, 0.22, C.wood, 0, 0, -0.7); // ladder
    if (v === 'horn') {
      // a saddle roof swept up into horns at both ends
      b.roof(0.3, 0.14, 0.4, 0, 0.375, 0, 0x5b3f30, Math.PI / 2);
      b.box(0.22, 0.05, 0.26, -0.27, 0.44, 0, 0x5b3f30, 0, -0.75).box(0.22, 0.05, 0.26, 0.27, 0.44, 0, 0x5b3f30, 0, 0.75);
      b.cone(0.03, 0.14, -0.37, 0.56, 0, C.gold, 4).cone(0.03, 0.14, 0.37, 0.56, 0, C.gold, 4);
    } else {
      b.roof(0.34, 0.2, 0.5, 0, 0.375, 0, v === 'palm' ? 0xb08d4a : C.tile, Math.PI / 2);
    }
    palm(b, 0.38, -0.2, 0.56);
    if (v === 'palm') palm(b, -0.38, 0.14, 0.44);
  },
};

// ---------------------------------------------------------------- material
const VERT = /* glsl */ `
precision highp float;
in vec3 position;
in vec3 normal;
in vec3 color;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat4 modelMatrix;
out vec3 vColor;
out vec3 vNormal;
void main() {
  vColor = color;
  vNormal = mat3(modelMatrix) * normal;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`;
const FRAG = /* glsl */ `
precision highp float;
in vec3 vColor;
in vec3 vNormal;
out vec4 outColor;
// the same warm key light from the north-west that the terrain was baked with
const vec3 LIGHT = vec3(-0.519, 0.599, -0.609);
void main() {
  vec3 n = normalize(vNormal);
  float d = dot(n, LIGHT);
  vec3 c = vColor * (0.86 + max(d, 0.0) * vec3(0.40, 0.33, 0.20));
  c = mix(c, c * vec3(0.54, 0.52, 0.68), smoothstep(0.15, -0.45, d) * 0.8);   // cool in shadow
  c *= 1.0 + 0.08 * max(n.y, 0.0);
  outColor = vec4(c, 1.0);
}
`;

export function makeMiniatureMaterial(): THREE.RawShaderMaterial {
  return new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG });
}

type Built = { root: THREE.Group; parts: { mesh: THREE.Mesh; anim: Anim; turn: number }[] };

/** Builds one miniature from its `model` or `model:variant` key, or returns null for an unknown model. */
export function buildMiniature(key: string, material: THREE.Material): Built | null {
  const [name, variant = ''] = key.split(':');
  const builder = BUILDERS[name];
  if (!builder) return null;
  const model = new Model();
  builder(model, variant);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(model.body.geometry(), material));
  const parts = model.parts.map((p) => {
    const mesh = new THREE.Mesh(p.shape.geometry(p.pivot), material);
    mesh.position.set(p.pivot[0], p.pivot[1], p.pivot[2]);
    root.add(mesh);
    return { mesh, anim: p.anim, turn: 0 };
  });
  return { root, parts };
}

/** Moves a miniature's parts. `focus` is 0 at rest and 1 while its country is in focus. */
export function animateMiniature(built: Built, dt: number, time: number, focus: number): void {
  for (const p of built.parts) {
    const a = p.anim;
    if (a.kind === 'spin') {
      p.turn += dt * a.speed * (0.35 + 1.4 * focus);
      p.mesh.rotation[a.axis] = p.turn;
    } else if (a.kind === 'swing') {
      p.mesh.rotation[a.axis] = Math.sin(time * a.speed) * a.amount * (0.35 + 0.65 * focus);
    } else if (a.kind === 'raise') {
      p.mesh.rotation[a.axis] = a.amount * focus + Math.sin(time * a.speed) * 0.04 * (1 + focus);
    } else {
      p.mesh.userData.rest ??= p.mesh.position[a.axis];
      p.mesh.position[a.axis] = p.mesh.userData.rest + (Math.sin(time * a.speed) * 0.5 + 0.5) * a.amount * (0.5 + focus);
    }
  }
}

export const MINIATURE_KEYS = Object.keys(BUILDERS);

// ---------------------------------------------------------------- on the map
const SIZE = 1.2; // world units for a model one unit tall
const smooth = (a: number, b: number, v: number): number => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

type Placed = Built & { id: string; index: number; ground: number; focus: number; phase: number; yaw: number };

export class Miniatures {
  readonly group = new THREE.Group();
  private readonly placed: Placed[] = [];
  private shown = 0;

  constructor(loaded: LoadedPack, relief: number) {
    const material = makeMiniatureMaterial();
    const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x0c0906, transparent: true, opacity: 0.28, depthWrite: false });
    const shadowGeo = new THREE.CircleGeometry(0.52, 18).rotateX(-Math.PI / 2);
    loaded.pack.scenario.countries.forEach((c, i) => {
      const meta = loaded.pack.countries[i];
      if (!c.miniature || !meta.prop) return;
      const built = buildMiniature(c.miniature, material);
      if (!built) {
        console.warn(`unknown miniature "${c.miniature}" for ${c.id}`);
        return;
      }
      const ground = sampleHeight(loaded, meta.prop[0], meta.prop[1]) * relief;
      built.root.position.set(meta.prop[0], ground, meta.prop[1]);
      const shadow = new THREE.Mesh(shadowGeo, shadowMaterial);
      shadow.position.y = 0.012;
      shadow.renderOrder = 1;
      built.root.add(shadow);
      // a fixed, slightly different facing for each, so they do not look stamped
      const yaw = ((i * 0.618) % 1) * 0.5 - 0.25;
      this.placed.push({ ...built, id: c.id, index: meta.index, ground, focus: 0, phase: (i * 0.37) % 1, yaw });
      this.group.add(built.root);
    });
    this.group.visible = false;
  }

  /**
   * `zoom` is 0 at the closest view and 1 at the farthest: miniatures only exist up close.
   * `focusId` is the country in focus, if any; `liftOf` reports how far a territory has risen.
   */
  update(dt: number, time: number, zoom: number, focusId: string | null, liftOf: (index: number) => number, liftHeight: number): void {
    const target = 1 - smooth(0.3, 0.44, zoom);
    this.shown += (target - this.shown) * Math.min(1, dt * 8);
    this.group.visible = this.shown > 0.01;
    if (!this.group.visible) return;
    for (const p of this.placed) {
      p.focus += ((p.id === focusId ? 1 : 0) - p.focus) * Math.min(1, dt * 7);
      // they rise out of the ground one after another as the view comes in
      const grow = smooth(p.phase * 0.35, p.phase * 0.35 + 0.65, this.shown);
      p.root.scale.setScalar(SIZE * grow * (1 + 0.14 * p.focus));
      p.root.position.y = p.ground + liftOf(p.index) * liftHeight + Math.abs(Math.sin(time * 5)) * 0.05 * p.focus;
      p.root.rotation.y = p.yaw + Math.sin(time * 2.4) * 0.16 * p.focus;
      animateMiniature(p, dt, time, p.focus);
    }
  }
}
