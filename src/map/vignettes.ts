// Pen-and-ink vignettes: one small drawing per country, laid flat on the map like the illustrations on
// an old chart. They belong to the local view only, sit under the links and nodes, and stay quiet until
// their country is in focus, when the drawing is inked in afresh, stroke by stroke.
import * as THREE from 'three';
import { FLAVOR, type Shape, type Tone } from './countryFlavor';
import type { LoadedPack } from './pack';
import { type Spot, layoutVignettes } from './vignetteLayout';

// ------------------------------------------------------------------ the atlas
// Every drawing is rasterised once into its own cell. The four channels are data, not colour:
//   R  ink outline coverage          G  hatching density wanted here (the shader rules the lines)
//   B  when this spot is inked, 0..1 A  soft patch of bare paper behind the whole drawing

const CELL = 256;
const PAD = 14;
const UNIT = (CELL - 2 * PAD) / 100; // atlas pixels per art unit
const BOX = CELL / UNIT; // art units across a whole cell, padding included
const COLS = 10;
const STROKE: Record<Tone, number> = { a: 1.5, d: 1.5, w: 1.5, c: 1.5, l: 1.5, b: 1.1, s: 0.9, t: 0.9 };
const SHADE: Partial<Record<Tone, number>> = { a: 0.5, b: 0.25, d: 0.85 };
const GROUND = 'M-3,93 H103';
const isLine = (tone: Tone): boolean => tone === 'l' || tone === 't';
const grey = (v: number): string => {
  const b = Math.round(Math.min(1, Math.max(0, v)) * 255);
  return `rgb(${b},${b},${b})`;
};

type Atlas = { texture: THREE.DataTexture; rows: number; cellOf: Map<string, [number, number]> };

function boxBlur(src: Float32Array, size: number, radius: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const span = 2 * radius + 1;
  for (let pass = 0; pass < 2; pass++) {
    const from = pass === 0 ? src : tmp;
    const to = pass === 0 ? tmp : out;
    const stepIn = pass === 0 ? 1 : size;
    const stepLine = pass === 0 ? size : 1;
    for (let line = 0; line < size; line++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += from[line * stepLine + Math.min(size - 1, Math.max(0, k)) * stepIn];
      for (let k = 0; k < size; k++) {
        to[line * stepLine + k * stepIn] = sum / span;
        sum += from[line * stepLine + Math.min(size - 1, k + radius + 1) * stepIn] - from[line * stepLine + Math.max(0, k - radius) * stepIn];
      }
    }
  }
  return out;
}

async function buildAtlas(ids: string[]): Promise<Atlas> {
  const rows = Math.ceil(ids.length / COLS);
  const width = COLS * CELL;
  const data = new Uint8Array(width * rows * CELL * 4);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = CELL;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // an off-screen SVG path, used only to walk along outlines so they can be inked in order
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
  const probe = document.createElementNS(NS, 'path');
  svg.appendChild(probe);
  document.body.appendChild(svg);

  const begin = (background: string): void => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, CELL, CELL);
    ctx.setTransform(UNIT, 0, 0, UNIT, PAD, PAD);
    ctx.setLineDash([]);
  };
  const read = (): Uint8ClampedArray => ctx.getImageData(0, 0, CELL, CELL).data;
  const cellOf = new Map<string, [number, number]>();

  for (let n = 0; n < ids.length; n++) {
    const flavor = FLAVOR[ids[n]];
    const shapes = flavor.art.map(([tone, d]: Shape) => ({ tone, d, path: new Path2D(d) }));
    const ground = (flavor.ground ?? 'land') === 'land' ? new Path2D(GROUND) : null;

    // R: outlines, each shape painted over the ones before it
    begin('#fff');
    if (ground) {
      ctx.setLineDash([3, 2.4]);
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = '#000';
      ctx.stroke(ground);
      ctx.setLineDash([]);
    }
    for (const s of shapes) {
      if (!isLine(s.tone)) {
        ctx.fillStyle = s.tone === 'c' ? '#000' : '#fff';
        ctx.fill(s.path);
      }
      ctx.lineWidth = STROKE[s.tone];
      ctx.strokeStyle = '#000';
      ctx.stroke(s.path);
    }
    const ink = read();

    // G: hatching density
    begin('#000');
    for (const s of shapes) {
      if (isLine(s.tone)) continue;
      ctx.fillStyle = grey(SHADE[s.tone] ?? 0);
      ctx.fill(s.path);
    }
    const shade = read();

    // B: the moment each spot is inked. Shapes follow one another with some overlap; within a shape the
    // outline is traced from its start to its end and the hatching follows once the outline has closed.
    begin('#fff');
    if (ground) {
      ctx.lineWidth = 4;
      ctx.strokeStyle = grey(0.03);
      ctx.stroke(ground);
    }
    shapes.forEach((s, i) => {
      const p0 = (0.62 * i) / shapes.length;
      const p1 = p0 + 0.38;
      if (!isLine(s.tone)) {
        ctx.fillStyle = grey(p1);
        ctx.fill(s.path);
      }
      probe.setAttribute('d', s.d);
      const length = probe.getTotalLength();
      const steps = Math.max(2, Math.ceil(length / 3.2));
      ctx.lineWidth = STROKE[s.tone] + 3.4;
      let prev = probe.getPointAtLength(0);
      for (let k = 1; k <= steps; k++) {
        const pt = probe.getPointAtLength((length * k) / steps);
        // a long jump means the path started a new piece; nothing is drawn across the gap
        if (Math.hypot(pt.x - prev.x, pt.y - prev.y) < (length / steps) * 1.5 + 0.2) {
          ctx.strokeStyle = grey(p0 + ((p1 - p0) * k) / steps);
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(pt.x, pt.y);
          ctx.stroke();
        }
        prev = pt;
      }
    });
    const when = read();

    // A: the silhouette, widened and blurred into a patch of paper
    begin('#000');
    ctx.fillStyle = ctx.strokeStyle = '#fff';
    if (ground) {
      ctx.lineWidth = 4.5;
      ctx.stroke(ground);
    }
    for (const s of shapes) {
      if (!isLine(s.tone)) ctx.fill(s.path);
      ctx.lineWidth = STROKE[s.tone] + 5.5;
      ctx.stroke(s.path);
    }
    const solid = read();
    const mask = new Float32Array(CELL * CELL);
    for (let i = 0; i < mask.length; i++) mask[i] = solid[i * 4] / 255;
    const halo = boxBlur(boxBlur(mask, CELL, 4), CELL, 3);

    const col = n % COLS;
    const row = Math.floor(n / COLS);
    cellOf.set(ids[n], [col, row]);
    for (let y = 0; y < CELL; y++) {
      for (let x = 0; x < CELL; x++) {
        const i = y * CELL + x;
        const o = ((row * CELL + y) * width + col * CELL + x) * 4;
        data[o] = 255 - ink[i * 4];
        data[o + 1] = shade[i * 4];
        data[o + 2] = when[i * 4];
        data[o + 3] = Math.round(Math.min(1, halo[i] * 1.25) * 255);
      }
    }
    // a few drawings per turn of the event loop, so building the atlas never holds up a frame for long
    if (n % 3 === 2) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  svg.remove();

  const texture = new THREE.DataTexture(data, width, rows * CELL, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.colorSpace = THREE.NoColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return { texture, rows, cellOf };
}

// ------------------------------------------------------------------ the decals

const VERT = /* glsl */ `
precision highp float;
precision highp int;

in vec3 position;     // a flat grid over the unit square
in vec4 iPlace;       // centre x, centre z, world size of the whole cell, territory index
in vec2 iCell;        // atlas column and row
in float iDraw;       // how far the fresh inking has got, 0..1.2
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform sampler2D uHeight;
uniform sampler2D uEdge;
uniform sampler2D uIds;
uniform sampler2D uState;
uniform vec2 uIdSize;
uniform vec2 uWorld;
uniform float uRelief;
uniform float uLift;

out vec2 vCell;
flat out vec2 vAt;
out vec3 vFx;         // inking progress, in focus, dimmed

void main() {
  vec2 wp = iPlace.xy + position.xz * iPlace.z;
  // the same surface as the terrain, including the rise of a territory in focus, so the drawing lies on it
  vec2 uv = (wp + uWorld * 0.5) / uWorld;
  float h = texture(uHeight, uv).r * uRelief;
  ivec2 p = clamp(ivec2(uv * uIdSize), ivec2(0), ivec2(uIdSize) - 1);
  int id = int(texelFetch(uIds, p, 0).r * 255.0 + 0.5);
  h += texelFetch(uState, ivec2(id, 2), 0).b * uLift * smoothstep(0.0, 0.3, texture(uEdge, uv).r);
  vec4 own = texelFetch(uState, ivec2(int(iPlace.w + 0.5), 2), 0);
  vCell = position.xz + 0.5;
  vAt = iCell;
  vFx = vec3(iDraw, own.b, own.g);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(wp.x, h + 0.03, wp.y, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;

in vec2 vCell;
flat in vec2 vAt;
in vec3 vFx;
out vec4 outColor;
uniform sampler2D uAtlas;
uniform vec2 uGrid;     // atlas columns and rows
uniform float uFade;

const float CELL = ${CELL.toFixed(1)};
const float BOX = ${BOX.toFixed(3)};
const vec3 PAPER = vec3(0.93, 0.87, 0.72);
const vec3 FADED = vec3(0.34, 0.24, 0.15);
const vec3 FRESH = vec3(0.13, 0.085, 0.055);

float ruled(float u, float halfWidth, float aa) {
  return 1.0 - smoothstep(halfWidth - aa, halfWidth + aa, abs(fract(u) - 0.5));
}

void main() {
  vec2 c = clamp(vCell, 0.004, 0.996);
  vec4 t = texture(uAtlas, (vAt + c) / uGrid);

  // outlines: crisp when the drawing is shown larger than it was rasterised, plain coverage when smaller
  float texels = max(length(dFdx(vCell)), length(dFdy(vCell))) * CELL;
  float w = clamp(0.5 * texels, 0.07, 0.5);
  float line = clamp((t.r - 0.5) / (2.0 * w) + 0.5, 0.0, 1.0);

  // hatching, ruled here so it stays sharp at any size: sparse for distance, close for bodies, crossed for shadow
  vec2 a = vCell * BOX;
  float u = (a.x * 0.788 + a.y * 0.616) / 3.0;
  float v = (a.x * 0.616 - a.y * 0.788) / 3.0;
  float aa = max(fwidth(u), 1e-4);
  float level = t.g;
  float sparse = ruled(u * 0.5, 0.055, aa * 0.5);
  float close = ruled(u, 0.13, aa);
  float crossed = ruled(v, 0.13, aa) * smoothstep(0.62, 0.8, level);
  float hatch = max(mix(sparse, close, smoothstep(0.3, 0.45, level)), crossed) * smoothstep(0.08, 0.2, level);
  hatch = mix(hatch, level * 0.4, smoothstep(0.22, 0.5, aa));   // too fine to rule: an even wash instead

  float ink = max(line, hatch * 0.82);
  float fresh = smoothstep(0.0, 0.06, vFx.x * 1.08 - t.b) * vFx.y;
  float inkA = ink * mix(0.8, 1.0, fresh);
  vec3 inkCol = mix(FADED, FRESH, fresh);
  float paperA = t.a * mix(0.64, 0.88, vFx.y);
  float alpha = inkA + paperA * (1.0 - inkA);
  vec3 col = (inkCol * inkA + PAPER * paperA * (1.0 - inkA)) / max(alpha, 1e-4);
  outColor = vec4(col, alpha * uFade * (1.0 - 0.5 * vFx.z));
}
`;

const smooth = (a: number, b: number, v: number): number => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class Vignettes {
  readonly group = new THREE.Group();
  enabled = true;
  private mesh: THREE.Mesh | null = null;
  private draw: THREE.InstancedBufferAttribute | null = null;
  private indices: number[] = [];
  /** Where each drawing was put, by country id. */
  readonly spots: ReadonlyMap<string, Spot>;
  private focus = -1;
  private shown = 0;
  private readonly uniforms: Record<string, THREE.IUniform>;

  /** `terrain` is the terrain's uniform set: the drawings reuse its height and territory textures. */
  constructor(loaded: LoadedPack, terrain: Record<string, THREE.IUniform>, routes: [number, number][][]) {
    this.uniforms = {
      uHeight: terrain.uHeight,
      uEdge: terrain.uEdge,
      uIds: terrain.uIds,
      uState: terrain.uState,
      uIdSize: terrain.uIdSize,
      uWorld: terrain.uWorld,
      uRelief: terrain.uRelief,
      uLift: terrain.uLift,
      uAtlas: { value: null },
      uGrid: { value: new THREE.Vector2(COLS, 1) },
      uFade: { value: 0 },
    };
    const ids = loaded.pack.countries.map((c) => c.id).filter((id) => FLAVOR[id]);
    const spots = layoutVignettes(loaded, new Set(ids), routes);
    this.spots = spots;
    const drawn = ids.filter((id) => spots.has(id));
    if (!drawn.length) return;
    void buildAtlas(drawn).then((atlas) => {
      const SEG = 8;
      const pos: number[] = [];
      const idx: number[] = [];
      for (let j = 0; j <= SEG; j++) for (let i = 0; i <= SEG; i++) pos.push(i / SEG - 0.5, 0, j / SEG - 0.5);
      for (let j = 0; j < SEG; j++) {
        for (let i = 0; i < SEG; i++) {
          const a = j * (SEG + 1) + i;
          idx.push(a, a + SEG + 1, a + 1, a + 1, a + SEG + 1, a + SEG + 2);
        }
      }
      const geo = new THREE.InstancedBufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      const place = new Float32Array(drawn.length * 4);
      const cell = new Float32Array(drawn.length * 2);
      drawn.forEach((id, n) => {
        const spot = spots.get(id)!;
        const index = loaded.pack.countries.find((c) => c.id === id)!.index;
        this.indices.push(index);
        place.set([spot.x, spot.z, (spot.size * BOX) / 100, index], n * 4);
        cell.set(atlas.cellOf.get(id)!, n * 2);
      });
      geo.setAttribute('iPlace', new THREE.InstancedBufferAttribute(place, 4));
      geo.setAttribute('iCell', new THREE.InstancedBufferAttribute(cell, 2));
      this.draw = new THREE.InstancedBufferAttribute(new Float32Array(drawn.length), 1);
      this.draw.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('iDraw', this.draw);
      geo.instanceCount = drawn.length;
      this.uniforms.uAtlas.value = atlas.texture;
      this.uniforms.uGrid.value.set(COLS, atlas.rows);
      this.mesh = new THREE.Mesh(
        geo,
        new THREE.RawShaderMaterial({
          glslVersion: THREE.GLSL3,
          vertexShader: VERT,
          fragmentShader: FRAG,
          uniforms: this.uniforms,
          transparent: true,
          depthTest: false,
          depthWrite: false,
        }),
      );
      this.mesh.frustumCulled = false;
      this.mesh.renderOrder = 3; // over the terrain, under every link
      this.group.add(this.mesh);
    });
  }

  /** The territory index of the one country in focus, or -1. */
  setFocus(index: number): void {
    this.focus = index;
  }

  /** `zoom` is 0 at the closest view and 1 at the farthest; `liftOf` is how far a territory has risen. */
  update(dt: number, zoom: number, liftOf: (index: number) => number): void {
    if (!this.mesh || !this.draw) return;
    this.shown += ((this.enabled ? 1 : 0) - this.shown) * Math.min(1, dt * 3);
    const fade = this.shown * (1 - smooth(0.4, 0.62, zoom));
    this.uniforms.uFade.value = fade;
    this.mesh.visible = fade > 0.004;
    const draw = this.draw.array as Float32Array;
    let changed = false;
    for (let n = 0; n < this.indices.length; n++) {
      const before = draw[n];
      if (this.indices[n] === this.focus) draw[n] = Math.min(1.2, before + dt / 1.5);
      else if (before > 0 && liftOf(this.indices[n]) < 0.02) draw[n] = 0; // start afresh next time
      if (draw[n] !== before) changed = true;
    }
    if (changed) this.draw.needsUpdate = true;
  }

  dispose(): void {
    this.mesh?.geometry.dispose();
    (this.mesh?.material as THREE.Material | undefined)?.dispose();
    (this.uniforms.uAtlas.value as THREE.Texture | null)?.dispose();
  }
}
