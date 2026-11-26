// Ambient motion: while one country is in focus, something of its own drifts across it. Cherry petals,
// blown sand, snow, monsoon rain, butterflies. A single pool of small sprites; nothing is drawn at rest.
//
// Particles live in the world (they stay over their country when the camera moves) but move in the plane
// of the screen, so "falling" reads as falling whether the view is tilted or straight down. Sizes and
// speeds are given in screen pixels at the closest zoom and shrink gently as the view pulls back.
import * as THREE from 'three';
import { FLAVOR, type MoteKind } from './countryFlavor';
import { type LoadedPack, sampleHeight, sampleId } from './pack';

const CAP = 420;
const REF_UPP = 0.0122; // world units per pixel at the closest zoom

const enum Shape { Dot, Petal, Rect, Streak, Puff, Butterfly, Leaf, Glint, Lantern, Glow }
const enum Mode { Fall, Streak, Drift, Rise, Wander, Twinkle, Spark, Puff }

type Spec = {
  /** Particles alive at once when the country covers about a sixth of the screen; fewer for a speck, up to twice as many for one that fills it. */
  count: number;
  life: [number, number];
  /** Half-width in pixels. */
  size: [number, number];
  /** Height over width. */
  aspect: number;
  shape: Shape;
  mode: Mode;
  alpha: number;
  /** 0 = painted over the map, 1 = added to it as light. */
  glow?: number;
  /** Main speed in pixels per second: falling, rising, drifting or flying, depending on the mode. */
  speed: number;
  /** Sideways sway in pixels per second. For streaks, the heading in radians instead (0 = right, negative = down). */
  sway: number;
  spin?: number;
};

const SPECS: Record<MoteKind, Spec> = {
  petals: { count: 46, life: [3.2, 5], size: [9.5, 13.5], aspect: 0.62, shape: Shape.Petal, mode: Mode.Fall, alpha: 0.96, speed: 34, sway: 20, spin: 1.6 },
  leaves: { count: 30, life: [3.5, 5.5], size: [12, 16.5], aspect: 0.5, shape: Shape.Leaf, mode: Mode.Fall, alpha: 0.96, speed: 30, sway: 24, spin: 1.2 },
  feathers: { count: 18, life: [4, 6], size: [15, 21], aspect: 0.3, shape: Shape.Leaf, mode: Mode.Fall, alpha: 0.94, speed: 17, sway: 28, spin: 0.5 },
  snow: { count: 90, life: [4, 7], size: [3.4, 5.6], aspect: 1, shape: Shape.Dot, mode: Mode.Fall, alpha: 0.95, speed: 24, sway: 10 },
  rain: { count: 110, life: [0.7, 1.1], size: [12, 18], aspect: 0.11, shape: Shape.Streak, mode: Mode.Streak, alpha: 0.8, speed: 380, sway: -1.73 },
  sand: { count: 110, life: [1.4, 2.4], size: [11, 19], aspect: 0.13, shape: Shape.Streak, mode: Mode.Streak, alpha: 0.78, speed: 140, sway: 0.04 },
  dust: { count: 60, life: [2.5, 4.5], size: [2.8, 4.6], aspect: 1, shape: Shape.Dot, mode: Mode.Drift, alpha: 0.8, speed: 30, sway: 8 },
  seeds: { count: 44, life: [3.5, 6], size: [3, 4.8], aspect: 1, shape: Shape.Dot, mode: Mode.Drift, alpha: 0.9, speed: 13, sway: 13 },
  confetti: { count: 60, life: [2.6, 4], size: [7, 10], aspect: 0.5, shape: Shape.Rect, mode: Mode.Fall, alpha: 0.97, speed: 48, sway: 15, spin: 5 },
  sparks: { count: 0, life: [1.1, 1.6], size: [4.6, 6.6], aspect: 1, shape: Shape.Glow, mode: Mode.Spark, alpha: 1, glow: 0.7, speed: 150, sway: 0 },
  holi: { count: 18, life: [3, 4.5], size: [8, 10.5], aspect: 0.7, shape: Shape.Petal, mode: Mode.Fall, alpha: 0.96, speed: 24, sway: 17, spin: 1.6 },
  fireflies: { count: 28, life: [3, 5.5], size: [7.5, 11], aspect: 1, shape: Shape.Glow, mode: Mode.Wander, alpha: 1, glow: 0.7, speed: 15, sway: 0 },
  lanterns: { count: 16, life: [5, 8], size: [9.5, 13], aspect: 1.3, shape: Shape.Lantern, mode: Mode.Rise, alpha: 0.97, glow: 0.35, speed: 19, sway: 7 },
  embers: { count: 44, life: [1.6, 3], size: [3, 4.6], aspect: 1, shape: Shape.Glow, mode: Mode.Rise, alpha: 1, glow: 0.7, speed: 42, sway: 15 },
  mist: { count: 12, life: [5, 8], size: [50, 90], aspect: 0.6, shape: Shape.Puff, mode: Mode.Drift, alpha: 0.3, speed: 12, sway: 3 },
  butterflies: { count: 10, life: [5, 8], size: [15, 20], aspect: 0.86, shape: Shape.Butterfly, mode: Mode.Wander, alpha: 0.98, speed: 34, sway: 0 },
  glints: { count: 30, life: [0.9, 1.7], size: [8, 14], aspect: 1, shape: Shape.Glint, mode: Mode.Twinkle, alpha: 1, glow: 0.6, speed: 0, sway: 0 },
};
/** The burst of colour thrown up in the 'holi' kind, alongside its drifting marigold petals. */
const PUFF: Spec = { count: 0, life: [1.3, 1.7], size: [30, 48], aspect: 1, shape: Shape.Puff, mode: Mode.Puff, alpha: 0.7, speed: 0, sway: 0 };
const MARIGOLD = new THREE.Color('#ffb52e');
const GRAVITY = 80; // pixels per second squared, on firework sparks

const VERT = /* glsl */ `
precision highp float;
in vec2 corner;
in vec4 iPos;     // world position, rotation in the screen plane
in vec4 iDim;     // half width, half height (world units), shape, glow
in vec4 iColor;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
out vec2 vUv;
out vec4 vColor;
flat out vec2 vKind;

void main() {
  vec4 mv = modelViewMatrix * vec4(iPos.xyz, 1.0);
  float c = cos(iPos.w);
  float s = sin(iPos.w);
  vec2 o = corner * iDim.xy;
  mv.xy += vec2(o.x * c - o.y * s, o.x * s + o.y * c);
  vUv = corner;
  vColor = iColor;
  vKind = iDim.zw;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in vec4 vColor;
flat in vec2 vKind;
out vec4 outColor;

// A painted shape from its edge distance (negative inside, in sprite units): solid, with a darker rim so
// it reads on bright land as well as on dark sea.
float painted(float d, float soft, inout vec3 col) {
  col = mix(col, col * 0.6, smoothstep(-0.2, -0.06, d));
  return 1.0 - smoothstep(-soft, soft, d);
}

void main() {
  vec2 p = vUv;
  float r = length(p);
  int shape = int(vKind.x + 0.5);
  vec3 col = vColor.rgb;
  float a;
  if (shape == 0) {            // dot: a flake, a grain
    a = painted(r - 0.82, 0.14, col);
  } else if (shape == 1) {     // petal: an oval with a nick in one end
    col *= 0.92 + 0.12 * p.y;
    a = painted(max(r - 0.88, 0.3 - length(p - vec2(0.98, 0.0))), 0.07, col);
  } else if (shape == 2) {     // paper rectangle
    a = painted(max(abs(p.x), abs(p.y)) - 0.86, 0.1, col);
  } else if (shape == 3) {     // streak: light above, shadow below
    a = (1.0 - smoothstep(0.25, 1.0, abs(p.y))) * (1.0 - smoothstep(0.4, 1.0, abs(p.x)));
    col = mix(col * 0.45, col, smoothstep(-0.35, 0.2, p.y));
  } else if (shape == 4) {     // soft puff
    a = 1.0 - smoothstep(0.15, 1.0, r);
  } else if (shape == 5) {     // butterfly: two pairs of wings with a dark edge, and a body
    vec2 q = vec2(abs(p.x), p.y);
    float d = min(length((q - vec2(0.50, 0.26)) * vec2(0.96, 0.8)) - 0.47, length((q - vec2(0.34, -0.40)) * vec2(1.0, 0.9)) - 0.3);
    a = 1.0 - smoothstep(-0.04, 0.04, d);
    col = mix(col, col * 0.25, smoothstep(-0.1, -0.035, d));
    float body = (1.0 - smoothstep(0.03, 0.1, abs(p.x))) * (1.0 - smoothstep(0.5, 0.66, abs(p.y + 0.05)));
    col = mix(col, vec3(0.12, 0.09, 0.07), body);
    a = max(a, body);
  } else if (shape == 6) {     // leaf or feather: a pointed lens with a midrib
    col *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.14, abs(p.y)));
    a = painted(max(length(p - vec2(0.0, 0.1056)), length(p + vec2(0.0, 0.1056))) - 0.95, 0.06, col);
  } else if (shape == 7) {     // glint: a four-pointed sparkle
    a = clamp(max(0.0, 1.0 - r) * (exp(-abs(p.x) * 9.0) + exp(-abs(p.y) * 9.0)) + exp(-r * r * 30.0), 0.0, 1.0);
  } else if (shape == 8) {     // paper lantern: a lit box
    float d = length(max(abs(p) - vec2(0.36, 0.52), 0.0)) - 0.2;
    float body = 1.0 - smoothstep(-0.06, 0.06, d);
    col = mix(col * 0.75, vec3(1.0, 0.95, 0.78), body * (1.0 - smoothstep(0.0, 0.8, r)) * 0.8);
    a = max(body, exp(-r * r * 2.6) * 0.45);
  } else {                     // glow: a bright core in a soft halo
    a = clamp(exp(-r * r * 14.0) + 0.5 * pow(max(0.0, 1.0 - r), 2.0), 0.0, 1.0);
    col = mix(col, vec3(1.0), exp(-r * r * 26.0) * 0.35);
  }
  a *= vColor.a;
  // one blend state for both kinds: paint is laid over the map, light is added to it
  outColor = vec4(col * a, a * (1.0 - vKind.y));
}
`;

type Emitter = {
  id: string;
  spec: Spec;
  kind: MoteKind;
  colors: THREE.Color[];
  points: Float32Array; // x, z pairs on the country's land
  /** Share of the screen the country covers right now, refreshed a few times a second. */
  cover: number;
  coverAge: number;
  area: number;
  debt: number;
  burst: number;
};
type Point = { x: number; y: number; z: number };

// One particle is a run of numbers in a flat array.
const N = 22;
const X = 0, Y = 1, Z = 2, VX = 3, VY = 4, AGE = 5, LIFE = 6, HALF = 7, ASPECT = 8, ROT = 9, SPIN = 10, PHASE = 11;
const R = 12, G = 13, B = 14, ALPHA = 15, SHAPE = 16, GLOW = 17, MODE = 18, PACE = 19, SPEED = 20, SWAY = 21;

export class Motes {
  readonly mesh: THREE.Mesh;
  private enabled = true;
  private count = 0;
  private readonly p = new Float32Array(CAP * N);
  private readonly aPos = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4);
  private readonly aDim = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4);
  private readonly aColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4);
  private readonly geometry = new THREE.InstancedBufferGeometry();
  private readonly cache = new Map<string, Float32Array>();
  private emitter: Emitter | null = null;
  private time = 0;
  /** World units per reference pixel: 1 reference pixel is 1 screen pixel at the closest zoom, less further out. */
  private px = REF_UPP;
  private readonly up = new THREE.Vector3();
  private readonly probe = new THREE.Vector3();
  private nearX: (x: number) => number = (x) => x;
  private readonly viewport = new THREE.Vector2(1, 1);

  constructor(private readonly loaded: LoadedPack, private readonly relief: number) {
    this.geometry.setAttribute('corner', new THREE.Float32BufferAttribute([-1, -1, 1, -1, 1, 1, -1, 1], 2));
    this.geometry.setIndex([0, 1, 2, 0, 2, 3]);
    for (const [name, attr] of [['iPos', this.aPos], ['iDim', this.aDim], ['iColor', this.aColor]] as const) {
      attr.setUsage(THREE.DynamicDrawUsage);
      this.geometry.setAttribute(name, attr);
    }
    this.geometry.instanceCount = 0;
    this.mesh = new THREE.Mesh(
      this.geometry,
      new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 14; // over the links, under the region names
    this.mesh.visible = false;
  }

  /** How many particles are in the air. */
  get alive(): number {
    return this.count;
  }

  /** Switching off lets what is in the air fade out; nothing new appears until it is switched on again. */
  setEnabled(enabled: boolean): void {
    if (this.enabled && !enabled) this.finish();
    this.enabled = enabled;
  }

  /** Brings every particle in the air to a quick end. */
  private finish(): void {
    for (let o = 0; o < this.count * N; o += N) this.p[o + LIFE] = Math.min(this.p[o + LIFE], this.p[o + AGE] + 0.55);
  }

  /** The one country in focus, or null. Particles already in the air finish quickly. */
  setFocus(id: string | null): void {
    if ((this.emitter?.id ?? null) === id) return;
    this.finish();
    this.emitter = null;
    const flavor = id ? FLAVOR[id] : undefined;
    const meta = id ? this.loaded.pack.countries.find((c) => c.id === id) : undefined;
    if (!id || !flavor || !meta) return;
    const spec = SPECS[flavor.motes.kind];
    this.emitter = {
      id,
      spec,
      kind: flavor.motes.kind,
      colors: flavor.motes.colors.map((c) => new THREE.Color(c)),
      points: this.pointsOf(id),
      cover: -1,
      coverAge: 1,
      area: meta.area,
      debt: 0,
      burst: 0.15,
    };
  }

  /** Scattered points on a country's land. A very small country also gets a patch around it to fill. */
  private pointsOf(id: string): Float32Array {
    const cached = this.cache.get(id);
    if (cached) return cached;
    const c = this.loaded.pack.countries.find((x) => x.id === id)!;
    const pts: number[] = [];
    let seed = c.index * 7919 + 17;
    const rand = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let tries = 0; tries < 1500 && pts.length < 480; tries++) {
      const x = c.bbox[0] + rand() * (c.bbox[2] - c.bbox[0]);
      const z = c.bbox[1] + rand() * (c.bbox[3] - c.bbox[1]);
      if (sampleId(this.loaded, x, z) === c.index) pts.push(x, z);
    }
    if (c.area < 14 || pts.length < 24) {
      for (let k = 0; k < 60; k++) {
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * 1.7;
        pts.push(c.anchor[0] + Math.cos(a) * r, c.anchor[1] + Math.sin(a) * r);
      }
    }
    const out = new Float32Array(pts);
    this.cache.set(id, out);
    return out;
  }

  /** A spot over the country that is on screen right now, a little above the ground. */
  private place(e: Emitter, camera: THREE.Camera): Point | null {
    const spread = this.px / REF_UPP;
    for (let tries = 0; tries < 8; tries++) {
      const k = Math.floor(Math.random() * (e.points.length / 2)) * 2;
      // the map repeats east-west: of the copies of this spot, take the one the view is looking at
      const x = this.nearX(e.points[k] + (Math.random() - 0.5) * 0.5 * spread);
      const z = e.points[k + 1] + (Math.random() - 0.5) * 0.5 * spread;
      const y = sampleHeight(this.loaded, x, z) * this.relief + (0.15 + Math.random() * 0.9) * spread;
      this.probe.set(x, y, z).project(camera);
      if (Math.abs(this.probe.x) < 1.06 && Math.abs(this.probe.y) < 1.1 && this.probe.z < 1) return { x, y, z };
    }
    return null;
  }

  /** Adds one particle; `aged` (0..1) starts it part-way through its life. Returns its offset, or -1 if the pool is full. */
  private add(spec: Spec, at: Point, color: THREE.Color, aged = 0): number {
    if (this.count >= CAP) return -1;
    const o = this.count++ * N;
    const p = this.p;
    const life = spec.life[0] + Math.random() * (spec.life[1] - spec.life[0]);
    p[o + X] = at.x;
    p[o + Y] = at.y;
    p[o + Z] = at.z;
    p[o + VX] = 0;
    p[o + VY] = 0;
    p[o + AGE] = life * aged;
    p[o + LIFE] = life;
    p[o + HALF] = (spec.size[0] + Math.random() * (spec.size[1] - spec.size[0])) * this.px;
    p[o + ASPECT] = spec.aspect;
    p[o + ROT] = Math.random() * Math.PI * 2;
    p[o + SPIN] = (spec.spin ?? 0) * (0.6 + Math.random() * 0.8) * (Math.random() < 0.5 ? -1 : 1);
    p[o + PHASE] = Math.random() * Math.PI * 2;
    p[o + R] = color.r;
    p[o + G] = color.g;
    p[o + B] = color.b;
    p[o + ALPHA] = spec.alpha;
    p[o + SHAPE] = spec.shape;
    p[o + GLOW] = spec.glow ?? 0;
    p[o + MODE] = spec.mode;
    p[o + PACE] = 0.75 + Math.random() * 0.5;
    p[o + SPEED] = spec.speed * this.px;
    p[o + SWAY] = spec.mode === Mode.Streak ? spec.sway : spec.sway * this.px;
    return o;
  }

  /**
   * How many particles this country should carry, as a multiple of the kind's base count. It follows the
   * share of the screen the country fills, so a small island and a continent look equally alive.
   */
  private amount(e: Emitter, camera: THREE.Camera, dt: number, unitsPerPixel: number): number {
    e.coverAge += dt;
    if (e.coverAge > 0.3) {
      e.coverAge = 0;
      const total = e.points.length / 2;
      const step = Math.max(1, Math.floor(total / 90));
      let seen = 0;
      let tried = 0;
      for (let k = 0; k < total; k += step) {
        tried++;
        this.probe.set(this.nearX(e.points[k * 2]), 0, e.points[k * 2 + 1]).project(camera);
        if (Math.abs(this.probe.x) < 1 && Math.abs(this.probe.y) < 1 && this.probe.z < 1) seen++;
      }
      const screenArea = this.viewport.x * this.viewport.y * unitsPerPixel * unitsPerPixel;
      const cover = Math.min(1, (Math.max(e.area, 9) * (seen / Math.max(1, tried))) / screenArea);
      // the first measurement also brings a first handful at once, so the country does not start empty
      if (e.cover < 0) e.debt = e.spec.count * (0.75 + 1.5 * cover) * 0.35;
      e.cover = cover;
    }
    return Math.min(2.2, 0.75 + 1.5 * Math.max(0, e.cover));
  }

  private emit(e: Emitter, camera: THREE.Camera, dt: number, amount: number): void {
    const { spec } = e;
    const pick = (): THREE.Color => e.colors[Math.floor(Math.random() * e.colors.length)];
    if (spec.count > 0) {
      e.debt += ((spec.count * amount) / ((spec.life[0] + spec.life[1]) / 2)) * dt;
      const opening = e.debt > 6; // the first handful arrives part-way through its life
      while (e.debt >= 1) {
        e.debt -= 1;
        const at = this.place(e, camera);
        if (!at || this.add(spec, at, e.kind === 'holi' ? MARIGOLD : pick(), opening ? Math.random() * 0.5 : 0) < 0) {
          e.debt = 0; // nowhere to put them just now (off screen, or the pool is full)
          break;
        }
      }
    }
    if (e.kind !== 'sparks' && e.kind !== 'holi') return;
    e.burst -= dt;
    if (e.burst > 0) return;
    e.burst = (e.kind === 'sparks' ? 0.62 : 0.5) / amount + Math.random() * 0.2;
    const at = this.place(e, camera);
    if (!at) return;
    const color = pick();
    if (e.kind === 'holi') {
      const o = this.add(PUFF, at, color);
      if (o >= 0) this.p[o + VY] = 6 * this.px;
      return;
    }
    at.y += (1.1 * this.px) / REF_UPP; // fireworks open above the ground
    for (let k = 0; k < 26; k++) {
      const o = this.add(spec, at, color);
      if (o < 0) break;
      const a = (k / 26) * Math.PI * 2 + Math.random() * 0.2;
      const v = this.p[o + SPEED] * (0.7 + Math.random() * 0.5);
      this.p[o + VX] = Math.cos(a) * v;
      this.p[o + VY] = Math.sin(a) * v;
    }
  }

  /**
   * `width` and `height` are the size of the view in screen pixels. `nearX` gives, of the copies of a
   * world x (the map repeats east-west), the one nearest the view.
   */
  update(dt: number, camera: THREE.Camera, unitsPerPixel: number, width: number, height: number, nearX: (x: number) => number): void {
    this.nearX = nearX;
    this.time += dt;
    this.px = REF_UPP * Math.sqrt(Math.max(1, unitsPerPixel / REF_UPP));
    this.viewport.set(width, height);
    if (this.enabled && this.emitter) this.emit(this.emitter, camera, dt, this.amount(this.emitter, camera, dt, unitsPerPixel));
    if (this.count === 0) {
      this.mesh.visible = false;
      return;
    }

    // Particles move in the plane of the screen: right is world +x, up is the camera's up.
    this.up.copy(camera.up).normalize();
    const pos = this.aPos.array as Float32Array;
    const dim = this.aDim.array as Float32Array;
    const col = this.aColor.array as Float32Array;
    const p = this.p;
    const t = this.time;
    const px = this.px;
    let n = 0;
    for (let i = 0; i < this.count; i++) {
      let o = i * N;
      const age = (p[o + AGE] += dt);
      const life = p[o + LIFE];
      if (age >= life) continue;
      // survivors are packed towards the front of the pool
      if (n !== i) {
        p.copyWithin(n * N, o, o + N);
        o = n * N;
      }
      // a particle stays with the copy of its country that is in view when the view goes round the world
      p[o + X] = nearX(p[o + X]);
      const mode = p[o + MODE];
      const shape = p[o + SHAPE];
      const pace = p[o + PACE];
      const phase = p[o + PHASE];
      const speed = p[o + SPEED];
      const sway = p[o + SWAY];
      let vx = 0;
      let vy = 0;
      let rot = 0;
      let half = p[o + HALF];
      let tall = p[o + ASPECT];
      let alpha = p[o + ALPHA] * Math.min(1, age / 0.3, (life - age) / (life * 0.28));
      if (mode === Mode.Fall) {
        vx = (0.4 + Math.sin(t * 1.5 + phase)) * sway;
        vy = -speed * pace;
        rot = p[o + ROT] += p[o + SPIN] * dt;
        // tumbling: the sprite turns edge-on and back
        if (p[o + SPIN] !== 0) tall *= 0.35 + 0.65 * Math.abs(Math.cos(t * (1.6 + Math.abs(p[o + SPIN]) * 0.8) * pace + phase));
      } else if (mode === Mode.Streak) {
        rot = sway + 0.06 * Math.sin(t * 2 + phase);
        vx = Math.cos(rot) * speed * pace;
        vy = Math.sin(rot) * speed * pace;
      } else if (mode === Mode.Drift) {
        vx = speed * pace;
        vy = Math.sin(t * 0.9 + phase) * sway + sway * 0.4;
        if (shape === Shape.Puff) half *= 0.8 + 0.4 * (age / life);
      } else if (mode === Mode.Rise) {
        const lantern = shape === Shape.Lantern;
        vx = Math.sin(t * (lantern ? 0.8 : 2.4) + phase) * sway;
        vy = speed * pace;
        if (lantern) rot = Math.sin(t * 0.9 + phase) * 0.12;
        else alpha *= 0.55 + 0.45 * Math.sin(t * 17 + phase * 5);
      } else if (mode === Mode.Wander) {
        // the heading wanders smoothly: butterflies flutter along it, fireflies amble and pulse
        const heading = phase + Math.sin(t * 0.7 + phase * 3) * 1.4 + Math.sin(t * 0.31 + phase) * 1.1;
        vx = Math.cos(heading) * speed * pace;
        vy = Math.sin(heading) * speed * pace;
        if (shape === Shape.Butterfly) {
          vy += Math.sin(t * 5 + phase) * 9 * px;
          rot = heading - Math.PI / 2;
          const open = 0.28 + 0.72 * Math.abs(Math.sin(t * 13 * pace + phase));
          half *= open;
          tall /= open;
        } else alpha *= 0.25 + 0.75 * Math.max(0, Math.sin(t * 2.6 * pace + phase));
      } else if (mode === Mode.Twinkle) {
        const beat = Math.sin((age / life) * Math.PI);
        alpha = p[o + ALPHA] * beat;
        half *= 0.5 + 0.5 * beat;
        rot = phase * 0.2;
      } else if (mode === Mode.Spark) {
        const drag = Math.exp(-dt * 1.4);
        vx = p[o + VX] *= drag;
        vy = p[o + VY] = p[o + VY] * drag - GRAVITY * px * dt;
        alpha = p[o + ALPHA] * Math.min(1, (life - age) / (life * 0.6));
        // a spark is drawn out along its path while it is fast, and rounds off as it slows
        const stretch = Math.min(1.6, Math.hypot(vx, vy) / (speed * 0.45));
        rot = Math.atan2(vy, vx);
        half *= 1 + stretch;
        tall /= 1 + stretch;
      } else {
        // a puff of colour swells and thins
        const f = age / life;
        vy = p[o + VY];
        half *= 0.3 + 1.5 * f;
        alpha = p[o + ALPHA] * (1 - f) * Math.min(1, age / 0.12);
      }
      p[o + X] += vx * dt;
      p[o + Y] += vy * this.up.y * dt;
      p[o + Z] += vy * this.up.z * dt;

      const w = n * 4;
      pos[w] = p[o + X];
      pos[w + 1] = p[o + Y];
      pos[w + 2] = p[o + Z];
      pos[w + 3] = rot;
      dim[w] = half;
      dim[w + 1] = half * tall;
      dim[w + 2] = shape;
      dim[w + 3] = p[o + GLOW];
      col[w] = p[o + R];
      col[w + 1] = p[o + G];
      col[w + 2] = p[o + B];
      col[w + 3] = Math.max(0, alpha);
      n++;
    }
    this.count = n;
    this.geometry.instanceCount = n;
    this.mesh.visible = n > 0;
    this.aPos.needsUpdate = this.aDim.needsUpdate = this.aColor.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
