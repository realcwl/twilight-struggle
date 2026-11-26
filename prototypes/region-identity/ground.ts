// Region colour laid on the ground: one extra transparent layer drawn directly over the game's terrain.
// It reuses the terrain's own grid and data textures, so it follows the relief and the hover lift
// exactly, and it reads which country is which from the same index texture the game picks with.
// Four treatments live in this one layer and can be mixed: wash (06), outline (07), hatch (08), mat (10).
import * as THREE from 'three';
import type { MapPack } from '../../src/map/types';
import { REGIONS } from './variants';

const VERT = /* glsl */ `
precision highp float;
precision highp int;

in vec3 position;
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

out vec2 vUv;
out vec3 vWorld;

// The same displacement as the terrain's vertex shader, so this layer lies exactly on it.
void main() {
  vec2 uv = (position.xz + uWorld * 0.5) / uWorld;
  float h = texture(uHeight, uv).r * uRelief;
  ivec2 p = clamp(ivec2(uv * uIdSize), ivec2(0), ivec2(uIdSize) - 1);
  int id = int(texelFetch(uIds, p, 0).r * 255.0 + 0.5);
  float lift = texelFetch(uState, ivec2(id, 2), 0).b;
  h += lift * uLift * smoothstep(0.0, 0.3, texture(uEdge, uv).r);
  vec3 pos = vec3(position.x, h, position.z);
  pos.x += sign(position.x) * step(uWorld.x * 0.49995, abs(position.x)) * 0.03;
  vUv = uv;
  vWorld = pos;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
precision highp int;

in vec2 vUv;
in vec3 vWorld;
out vec4 outColor;

uniform sampler2D uEdge;
uniform sampler2D uCoast;
uniform sampler2D uIds;
uniform sampler2D uState;
uniform sampler2D uRegion;   // 256 x 3. row 0: region colour of a territory, a = it has one. row 1: r = its region code. row 2: colour of a region code.
uniform sampler2D uHull;     // r: signed distance to the nearest region's mat (- inside), g: to the next region's, b: region code
uniform vec2 uIdSize;
uniform vec2 uHullSize;
uniform vec3 uRanges;
uniform float uGlobal;
uniform float uDim;
uniform vec4 uMix;           // strength of wash, outline, hatch, mat

float lines(float t, float duty, float aa) {
  float tri = abs(fract(t) - 0.5) * 2.0;
  return 1.0 - smoothstep(duty - aa, duty + aa, tri);
}

// One hatch per region code, drawn in world space so it sticks to the ground.
float pattern(int code, vec2 wp, float px) {
  const float P = 0.46;
  float aa = 2.0 * px / P;
  float duty = 0.30;
  float v;
  if (code == 1) {
    v = lines(wp.y / P, duty, aa);                                  // level lines
  } else if (code == 2) {
    vec2 g = fract(wp / P) - 0.5;                                   // dots
    v = 1.0 - smoothstep(0.27 - aa * 0.25, 0.27 + aa * 0.25, length(g));
    duty = 0.23;
  } else if (code == 3) {
    v = lines((wp.x - wp.y) / (P * 1.4142), duty, aa);              // falling diagonal
  } else if (code == 4) {
    v = lines(wp.x / P, duty, aa);                                  // upright lines
  } else if (code == 5) {
    v = max(lines(wp.x / (P * 1.5), 0.19, aa), lines(wp.y / (P * 1.5), 0.19, aa));   // grid
    duty = 0.34;
  } else {
    v = lines((wp.y + 0.11 * sin(wp.x * 9.0)) / P, duty, aa);       // waves
  }
  // finer than the screen can draw, a hatch dissolves into the flat tone it averages to
  return mix(duty, v, smoothstep(2.2, 5.0, P / px));
}

// Adds one index texel's data, weighted. aux: on a region's outer edge, controlled, out of focus, hatch.
void addTap(vec2 raw, float w, vec2 wp, float px, inout vec3 col, inout vec4 aux, inout vec2 wsum) {
  int id = int(raw.x * 255.0 + 0.5);
  if (id == 0) return;
  wsum.x += w;
  vec4 reg = texelFetch(uRegion, ivec2(id, 0), 0);
  if (reg.a < 0.5) return;
  int nb = int(raw.y * 255.0 + 0.5);
  int code = int(texelFetch(uRegion, ivec2(id, 1), 0).r * 255.0 + 0.5);
  int other = int(texelFetch(uRegion, ivec2(nb, 1), 0).r * 255.0 + 0.5);
  float controlled = texelFetch(uState, ivec2(id, 0), 0).a;
  float dim = texelFetch(uState, ivec2(id, 2), 0).g;
  col += w * reg.rgb;
  // the outer edge of a region: full strength against other land, lighter along a coast
  float outer = code == other ? 0.0 : (nb == 0 ? 0.6 : 1.0);
  aux += w * vec4(outer, controlled, dim, pattern(code, wp, px));
  wsum.y += w;
}

// premultiplied "over"
void over(inout vec4 acc, vec3 c, float a) {
  a = clamp(a, 0.0, 1.0);
  acc = vec4(c * a, a) + acc * (1.0 - a);
}

void main() {
  vec2 wp = vWorld.xz;
  float px = max(length(abs(dFdx(wp)) + abs(dFdy(wp))) * 0.7071, 1e-4);
  float coast = (texture(uCoast, vUv).r - 0.5) * 2.0 * uRanges.y;
  float landMask = clamp(coast / max(fwidth(coast), 1e-5) + 0.5, 0.0, 1.0);
  float edge = texture(uEdge, vUv).r * uRanges.x;
  float aaE = max(fwidth(edge), px * 0.5);
  vec4 hull = texture(uHull, vUv);
  float aaH = max(fwidth(hull.r), px * 0.75);

  vec4 acc = vec4(0.0);

  // ---- 10: a mat around the nodes and links of each region, land and sea alike
  if (uMix.w > 0.003) {
    ivec2 hp = clamp(ivec2(vUv * uHullSize), ivec2(0), ivec2(uHullSize) - 1);
    int code = int(texelFetch(uHull, hp, 0).b + 0.5);
    if (code > 0) {
      vec3 c = texelFetch(uRegion, ivec2(code, 2), 0).rgb;
      float inside = 1.0 - smoothstep(-aaH, aaH, hull.r);
      float wl = max(0.07, 1.3 * px);
      float rim = 1.0 - smoothstep(wl - aaH, wl + aaH, abs(hull.r + wl));
      // where two regions' mats would touch, both stop short and leave a channel between them
      float apart = smoothstep(0.06, 0.42, hull.g - hull.r);
      float a = uMix.w * apart * max(inside * mix(0.20, 0.30, uGlobal), rim * 0.92) * (1.0 - 0.45 * uDim);
      over(acc, mix(c, vec3(1.0), rim * 0.12), a);
    }
  }

  // ---- 06, 07, 08: per territory, on land only
  if (landMask > 0.002 && uMix.x + uMix.y + uMix.z > 0.003) {
    vec2 st = vUv * uIdSize - 0.5;
    ivec2 base = ivec2(floor(st));
    vec2 f = st - vec2(base);
    ivec2 maxP = ivec2(uIdSize) - 1;
    ivec2 p0 = clamp(base, ivec2(0), maxP);
    ivec2 p1 = clamp(base + 1, ivec2(0), maxP);
    vec2 r00 = texelFetch(uIds, p0, 0).rg;
    vec2 r10 = texelFetch(uIds, ivec2(p1.x, p0.y), 0).rg;
    vec2 r01 = texelFetch(uIds, ivec2(p0.x, p1.y), 0).rg;
    vec2 r11 = texelFetch(uIds, p1, 0).rg;
    vec3 col = vec3(0.0);
    vec4 aux = vec4(0.0);
    vec2 wsum = vec2(0.0);
    if (r00 == r10 && r00 == r01 && r00 == r11) {
      addTap(r00, 1.0, wp, px, col, aux, wsum);
    } else {
      addTap(r00, (1.0 - f.x) * (1.0 - f.y), wp, px, col, aux, wsum);
      addTap(r10, f.x * (1.0 - f.y), wp, px, col, aux, wsum);
      addTap(r01, (1.0 - f.x) * f.y, wp, px, col, aux, wsum);
      addTap(r11, f.x * f.y, wp, px, col, aux, wsum);
    }
    if (wsum.y > 0.0) {
      vec3 rc = col / wsum.y;
      aux /= wsum.y;
      float cover = landMask * wsum.y / max(wsum.x, 1e-4);
      float fade = cover * (1.0 - 0.6 * aux.z);     // territories out of focus step back, as the terrain does

      // 06 wash: the whole territory, lighter where a side's own colour already fills it
      over(acc, rc, uMix.x * mix(0.34, 0.44, uGlobal) * (1.0 - 0.5 * aux.y) * fade);

      // 08 hatch
      over(acc, rc, uMix.z * 0.07 * fade);
      over(acc, mix(rc, vec3(1.0), 0.08), uMix.z * aux.w * 0.56 * fade);

      // 07 outline: a firm line on the region's outer edge and a band fading inwards from it
      float wLine = max(0.055, 2.5 * px);
      float line = 1.0 - smoothstep(wLine - aaE, wLine + aaE, edge);
      float wBand = max(0.55, 13.0 * px);
      float band = pow(1.0 - smoothstep(0.0, wBand, edge), 1.3) * (1.0 - 0.5 * aux.y);
      over(acc, mix(rc, vec3(1.0), line * 0.10), uMix.y * aux.x * max(line * 0.96, band * mix(0.6, 0.95, uGlobal)) * fade);
    }
  }

  outColor = acc;
}
`;

const hexRgb = (hex: string): [number, number, number] => {
  const c = new THREE.Color(hex);
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
};

/** Per-territory region colour and code, and the colour of each code. */
function regionTexture(pack: MapPack): THREE.DataTexture {
  const data = new Uint8Array(256 * 3 * 4);
  pack.scenario.countries.forEach((c, i) => {
    const region = c.region ? REGIONS[c.region] : undefined;
    if (!region) return;
    const index = pack.countries[i].index;
    const rgb = hexRgb(region.color);
    data.set([rgb[0], rgb[1], rgb[2], 255], index * 4);
    data[(256 + index) * 4] = region.code;
  });
  for (const region of Object.values(REGIONS)) {
    const rgb = hexRgb(region.color);
    data.set([rgb[0], rgb[1], rgb[2], 255], (512 + region.code) * 4);
  }
  const tex = new THREE.DataTexture(data, 256, 3, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

const HULL_W = 2048;
const NODE_R = 2.55; // world units of mat around a node
const LINK_R = 1.25; // and around a link
const REACH = 3; // distances are kept this far out from a mat's edge

/**
 * A distance field per region around its nodes and the links between them, merged into one texture:
 * the signed distance to the nearest region's mat, the distance to the next region's, and which
 * region the nearest is.
 */
function hullTexture(pack: MapPack, groundPaths: Map<string, number[][]>): { texture: THREE.DataTexture; size: [number, number] } {
  const W = HULL_W;
  const H = Math.round((W * pack.world.height) / pack.world.width);
  const scale = W / pack.world.width;
  const regionOf = new Map(pack.scenario.countries.map((c) => [c.id, c.region]));
  const d1 = new Float32Array(W * H).fill(REACH);
  const d2 = new Float32Array(W * H).fill(REACH);
  const r1 = new Uint8Array(W * H);
  const cur = new Float32Array(W * H);

  // capsule from a to b with radius r, written as a signed distance where it is the smallest so far
  const capsule = (ax: number, az: number, bx: number, bz: number, r: number): void => {
    const reach = r + REACH;
    const x0 = Math.max(0, Math.floor((Math.min(ax, bx) - reach + pack.world.width / 2) * scale));
    const x1 = Math.min(W - 1, Math.ceil((Math.max(ax, bx) + reach + pack.world.width / 2) * scale));
    const y0 = Math.max(0, Math.floor((Math.min(az, bz) - reach + pack.world.height / 2) * scale));
    const y1 = Math.min(H - 1, Math.ceil((Math.max(az, bz) + reach + pack.world.height / 2) * scale));
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    for (let y = y0; y <= y1; y++) {
      const pz = (y + 0.5) / scale - pack.world.height / 2;
      for (let x = x0; x <= x1; x++) {
        const px = (x + 0.5) / scale - pack.world.width / 2;
        const t = len2 > 0 ? Math.min(1, Math.max(0, ((px - ax) * dx + (pz - az) * dz) / len2)) : 0;
        const sd = Math.hypot(px - ax - dx * t, pz - az - dz * t) - r;
        const i = y * W + x;
        if (sd < cur[i]) cur[i] = sd;
      }
    }
  };

  for (const [regionId, region] of Object.entries(REGIONS)) {
    cur.fill(REACH);
    pack.scenario.countries.forEach((c, i) => {
      if (c.region !== regionId) return;
      const [x, z] = pack.countries[i].node;
      capsule(x, z, x, z, NODE_R);
    });
    for (const l of pack.scenario.links) {
      if (l.kind !== 'regional' || regionOf.get(l.a) !== regionId) continue;
      for (const path of groundPaths.get([l.a, l.b].sort().join('|')) ?? []) {
        // every fourth point of the draped path is plenty for a soft shape
        const step = 12;
        for (let i = 0; i + 3 < path.length; i += step) {
          const j = Math.min(path.length - 3, i + step);
          capsule(path[i], path[i + 2], path[j], path[j + 2], LINK_R);
        }
      }
    }
    for (let i = 0; i < cur.length; i++) {
      const v = cur[i];
      if (v < d1[i]) {
        d2[i] = d1[i];
        d1[i] = v;
        r1[i] = region.code;
      } else if (v < d2[i]) d2[i] = v;
    }
  }

  const data = new Uint16Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    data[i * 4] = THREE.DataUtils.toHalfFloat(d1[i]);
    data[i * 4 + 1] = THREE.DataUtils.toHalfFloat(d2[i]);
    data[i * 4 + 2] = THREE.DataUtils.toHalfFloat(d1[i] < REACH ? r1[i] : 0);
    data[i * 4 + 3] = THREE.DataUtils.toHalfFloat(1);
  }
  const texture = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return { texture, size: [W, H] };
}

export type GroundMix = { wash: number; outline: number; hatch: number; mat: number };

export class GroundOverlay {
  private readonly meshes: THREE.Mesh[] = [];
  // (a Vector4 starts out as 0, 0, 0, 1, which here would mean "mat fully on")
  private readonly mix = new THREE.Vector4(0, 0, 0, 0);
  private readonly goal = new THREE.Vector4(0, 0, 0, 0);

  constructor(
    pack: MapPack,
    terrain: { group: THREE.Group; uniforms: Record<string, THREE.IUniform> },
    groundPaths: Map<string, number[][]>,
  ) {
    const t = terrain.uniforms;
    const hull = hullTexture(pack, groundPaths);
    const material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: FRAG,
      // the terrain's own uniform objects, so relief, lift, focus and zoom stay in step by themselves
      uniforms: {
        uHeight: t.uHeight,
        uEdge: t.uEdge,
        uCoast: t.uCoast,
        uIds: t.uIds,
        uState: t.uState,
        uIdSize: t.uIdSize,
        uWorld: t.uWorld,
        uRanges: t.uRanges,
        uRelief: t.uRelief,
        uLift: t.uLift,
        uGlobal: t.uGlobal,
        uDim: t.uDim,
        uRegion: { value: regionTexture(pack) },
        uHull: { value: hull.texture },
        uHullSize: { value: new THREE.Vector2(hull.size[0], hull.size[1]) },
        uMix: { value: this.mix },
      },
      transparent: true,
      premultipliedAlpha: true,
      depthTest: false,
      depthWrite: false,
    });
    // One copy per terrain piece, hung on that piece: the game shows and hides pieces as the zoom
    // changes, and a child is only drawn while its parent is.
    for (const piece of terrain.group.children) {
      const mesh = new THREE.Mesh((piece as THREE.Mesh).geometry, material);
      mesh.renderOrder = 1; // over the terrain, under the ink drawings (3) and the links (6+)
      mesh.visible = false;
      piece.add(mesh);
      this.meshes.push(mesh);
    }
  }

  set(mix: GroundMix): void {
    this.goal.set(mix.wash, mix.outline, mix.hatch, mix.mat);
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-dt * 9);
    for (const axis of ['x', 'y', 'z', 'w'] as const) {
      const d = this.goal[axis] - this.mix[axis];
      this.mix[axis] = Math.abs(d) < 0.004 ? this.goal[axis] : this.mix[axis] + d * k;
    }
    const any = this.mix.x + this.mix.y + this.mix.z + this.mix.w > 0.003;
    for (const mesh of this.meshes) mesh.visible = any;
  }
}
