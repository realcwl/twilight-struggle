// The map surface: one displaced grid and one shader that paints land, water, borders, tint and highlights.
import * as THREE from 'three';
import type { LoadedPack } from './pack';

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

void main() {
  vec2 uv = (position.xz + uWorld * 0.5) / uWorld;
  float h = texture(uHeight, uv).r * uRelief;
  // A hovered territory rises slightly; the rise fades to zero at its border so the surface never tears.
  ivec2 p = clamp(ivec2(uv * uIdSize), ivec2(0), ivec2(uIdSize) - 1);
  int id = int(texelFetch(uIds, p, 0).r * 255.0 + 0.5);
  float lift = texelFetch(uState, ivec2(id, 2), 0).b;
  h += lift * uLift * smoothstep(0.0, 0.3, texture(uEdge, uv).r);
  vec3 pos = vec3(position.x, h, position.z);
  // The east and west edges reach a hair past the map, so that where the world is drawn again beside
  // itself the two copies overlap instead of leaving a crack of rounding error between them.
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

uniform sampler2D uAlbedo;
uniform sampler2D uShade;
uniform sampler2D uEdge;
uniform sampler2D uCoast;
uniform sampler2D uSea;
uniform sampler2D uDepth;
uniform sampler2D uBrush;
uniform sampler2D uNoise;
uniform sampler2D uIds;
uniform sampler2D uState;
uniform vec2 uIdSize;
uniform vec2 uWorld;
uniform vec3 uRanges;   // world-unit ranges of the edge, coast and sea distance textures
uniform vec3 uSideA;
uniform vec3 uSideB;
uniform float uTime;
uniform float uGlobal;  // 0 = local view, 1 = global view
uniform float uDim;     // how strongly something is in focus, 0..1

const vec3 INK = vec3(0.17, 0.12, 0.09);
const vec3 SEPIA = vec3(0.35, 0.24, 0.14);
const vec3 GOLD = vec3(1.0, 0.80, 0.28);

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// Adds one index texel's territory data, weighted. Water texels (index 0) contribute nothing.
void addTap(vec2 raw, float w, inout vec4 band, inout vec4 flags, inout vec4 hl, inout vec3 extra, inout float wsum) {
  int id = int(raw.x * 255.0 + 0.5);
  if (id == 0) return;
  int nb = int(raw.y * 255.0 + 0.5);
  vec4 h = texelFetch(uState, ivec2(id, 2), 0);
  vec4 hn = texelFetch(uState, ivec2(nb, 2), 0);
  band += w * texelFetch(uState, ivec2(id, 0), 0);
  flags += w * texelFetch(uState, ivec2(id, 1), 0);
  hl += w * h;
  // glow only where the highlight ends, shadow only outside a lifted territory
  extra += w * vec3(h.r * (1.0 - hn.r), hn.b * (1.0 - h.b), texelFetch(uState, ivec2(id, 3), 0).r);
  wsum += w;
}

void main() {
  vec2 wp = vWorld.xz;
  // Screen-space gradients, taken once up front. Lookups further down sit inside land-only and water-only
  // branches, where implicit derivatives are not defined, so they are given these explicitly.
  vec2 dWx = dFdx(wp);
  vec2 dWy = dFdy(wp);
  vec2 dUx = dFdx(vUv);
  vec2 dUy = dFdy(vUv);
  float px = max(length(abs(dWx) + abs(dWy)) * 0.7071, 1e-4);   // world units covered by one screen pixel
  float detail = 1.0 - uGlobal;

  float coast = (texture(uCoast, vUv).r - 0.5) * 2.0 * uRanges.y;   // + on land
  float edge = texture(uEdge, vUv).r * uRanges.x;                   // distance to the nearest border
  float landMask = clamp(coast / max(fwidth(coast), 1e-5) + 0.5, 0.0, 1.0);
  float aaE = max(fwidth(edge), px * 0.5);

  // ---- brush strokes: move colour lookups around in stroke-shaped pieces
  vec3 b1 = texture(uBrush, wp * 0.085).rgb;
  vec3 b2 = texture(uBrush, wp * 0.31 + 0.37).rgb;
  vec2 warp = (b1.rg - 0.5) * 0.8 + (b2.rg - 0.5) * 0.3 * detail;
  float tone = (b1.b - 0.5) * 0.10 + (b2.b - 0.5) * 0.08 * detail;

  // ---- baked light, used by land and (as a soft cast shadow) by the sea
  float sRaw = (textureGrad(uShade, vUv + warp * 0.10 / uWorld, dUx, dUy).r - 0.5) * 2.0;   // 0 = flat ground
  float s = sign(sRaw) * smoothstep(0.03, 1.0, abs(sRaw));   // quiet on rolling ground, full strength on mountains
  s *= mix(1.0, 0.75, uGlobal);

  vec4 hl = vec4(0.0);      // highlight, dim, lift
  vec3 land = vec3(0.0);
  if (landMask > 0.002) {
    // ---- per-territory data, blended over the four nearest index texels so fills meet without stair-steps
    vec2 st = vUv * uIdSize - 0.5;
    ivec2 base = ivec2(floor(st));
    vec2 f = st - vec2(base);
    ivec2 maxP = ivec2(uIdSize) - 1;
    vec4 band = vec4(0.0);    // side colour, a = controlled
    vec4 flags = vec4(0.0);   // in scenario, side A present, side B present, key
    vec3 extra = vec3(0.0);   // outline glow, drop shadow, target marker
    float wsum = 0.0;
    ivec2 p0 = clamp(base, ivec2(0), maxP);
    ivec2 p1 = clamp(base + 1, ivec2(0), maxP);
    vec2 r00 = texelFetch(uIds, p0, 0).rg;
    vec2 r10 = texelFetch(uIds, ivec2(p1.x, p0.y), 0).rg;
    vec2 r01 = texelFetch(uIds, ivec2(p0.x, p1.y), 0).rg;
    vec2 r11 = texelFetch(uIds, p1, 0).rg;
    if (r00 == r10 && r00 == r01 && r00 == r11) {
      // the common case, away from any border: all four texels agree, so one lookup is enough
      addTap(r00, 1.0, band, flags, hl, extra, wsum);
    } else {
      addTap(r00, (1.0 - f.x) * (1.0 - f.y), band, flags, hl, extra, wsum);
      addTap(r10, f.x * (1.0 - f.y), band, flags, hl, extra, wsum);
      addTap(r01, (1.0 - f.x) * f.y, band, flags, hl, extra, wsum);
      addTap(r11, f.x * f.y, band, flags, hl, extra, wsum);
    }
    if (wsum > 0.0) {
      float inv = 1.0 / wsum;
      band *= inv; flags *= inv; hl *= inv; extra *= inv;
    }

    // ---- painted land
    vec3 alb = textureGrad(uAlbedo, vUv + warp * 0.5 / uWorld, dUx, dUy).rgb * (1.0 + tone);
    // Shadows are laid in as shapes with a decisive edge, roughened by the brush strokes, rather than as a
    // smooth gradient: that is what makes ranges read as solid painted masses.
    float shadowEdge = -sRaw + (b2.b - 0.5) * 0.10 * detail + (b1.b - 0.5) * 0.05;
    float shadow = smoothstep(0.10, 0.30, shadowEdge) * 0.6 + clamp(-s, 0.0, 1.0) * 0.3;
    shadow = clamp(shadow * mix(1.0, 0.8, uGlobal), 0.0, 1.0);
    vec3 lit = alb * (1.0 + max(s, 0.0) * vec3(0.50, 0.42, 0.26));   // warm on the lit side
    lit = mix(lit, lit * vec3(0.50, 0.47, 0.60), shadow);            // cool in shadow

    // ---- land outside the scenario: parchment and ink, like an old chart
    float part = flags.r;
    vec3 parch = vec3(0.0);
    if (part < 0.998) {
      float grain = textureGrad(uNoise, wp * 0.06, dWx * 0.06, dWy * 0.06).r * 0.6
                  + textureGrad(uNoise, wp * 0.45, dWx * 0.45, dWy * 0.45).g * 0.4;
      parch = vec3(0.845, 0.765, 0.605) * (0.90 + 0.20 * grain) * (1.0 + tone * 0.5);
      parch = mix(parch, SEPIA, shadow * 0.55);
      parch += max(s, 0.0) * 0.05;
      float inland = clamp(coast, 0.0, uRanges.y);
      float hatchVis = smoothstep(2.0, 5.0, 0.13 / px);
      float hatch = (0.5 + 0.5 * sin(inland * 48.0 + (b2.b - 0.5) * 2.5)) * (1.0 - smoothstep(0.0, uRanges.y * 0.9, inland));
      parch = mix(parch, SEPIA, mix(0.14 * (1.0 - smoothstep(0.0, uRanges.y * 0.9, inland)), hatch * 0.34, hatchVis));
    }
    land = mix(parch, lit, part);
    float lum = luma(land);

    // ---- territory: tint, inward band, border strokes
    float wStroke = max(1.25 * px, 0.028);
    float stroke = 1.0 - smoothstep(wStroke - aaE, wStroke + aaE, edge);
    float controlled = band.a * part;
    vec3 side = band.rgb;

    // Keep ownership visible inside the border, including at the closest zoom.
    // Terrain luminance still carries the relief through the deeper faction tint.
    land = mix(land, side * (0.45 + 0.7 * lum), controlled * mix(0.36, 0.65, uGlobal));
    float wBand = max(0.55, 9.0 * px);
    float bandA = 1.0 - smoothstep(0.0, wBand, edge);
    land = mix(land, side * (0.72 + 0.5 * lum), controlled * bandA * bandA * 0.88);

    // influence without control: distinct diagonal stripes in the colours of whoever is present
    float contested = max(flags.g, flags.b) * part * (1.0 - band.a);
    float period = 0.36;
    float t = (wp.x + wp.y) / period;
    float which = step(0.5, fract(t * 0.5));
    float tri = abs(fract(t) - 0.5) * 2.0;
    float sAA = 2.0 * px / period;
    float body = 1.0 - smoothstep(0.5 - sAA, 0.5 + sAA, tri);
    float stripeVis = smoothstep(2.5, 6.0, period / px);
    vec3 avgCol = (uSideA * flags.g + uSideB * flags.b) / max(flags.g + flags.b, 1e-3);
    vec3 stripeCol = mix(avgCol, mix(uSideA, uSideB, which), stripeVis);
    float stripeA = mix(0.25 * (flags.g + flags.b), body * mix(flags.g, flags.b, which), stripeVis);
    land = mix(land, stripeCol * (0.65 + 0.5 * lum), stripeA * contested * 0.52);

    // border strokes: neutral ink when nobody controls, side colour with a bright inner line when someone does
    land = mix(land, mix(SEPIA, INK, part), stroke * (1.0 - controlled) * mix(0.45, 0.62, part));
    land = mix(land, side * 0.40, stroke * controlled * 0.92);
    float inner = smoothstep(wStroke - aaE, wStroke + aaE, edge) * (1.0 - smoothstep(wStroke * 2.4 - aaE, wStroke * 2.4 + aaE, edge));
    land = mix(land, side * 1.12 + 0.14, inner * controlled * 0.85);

    // key country: an extra gold line set in from the border
    float k0 = wStroke * 3.3;
    float k1 = wStroke * 4.9;
    float keyLine = smoothstep(k0 - aaE, k0 + aaE, edge) * (1.0 - smoothstep(k1 - aaE, k1 + aaE, edge));
    land = mix(land, GOLD * (0.82 + 0.25 * lum), keyLine * flags.a * part * 0.92);

    // ---- hover and selection
    vec3 glowCol = mix(vec3(1.0, 0.95, 0.82), side * 1.25 + 0.18, controlled);
    float breathe = mix(1.0, 0.80 + 0.20 * sin(uTime * 2.6), controlled);
    land *= 1.0 + 0.17 * hl.r;
    land = mix(land, glowCol, hl.r * 0.10 * breathe);
    float wGlow = max(0.42, 7.0 * px);
    float glow = extra.x * pow(1.0 - smoothstep(0.0, wGlow, edge), 1.6);
    land = mix(land, glowCol, glow * mix(0.72, 0.95, uGlobal) * breathe);
    land = mix(land, vec3(luma(land)) * vec3(0.50, 0.50, 0.57), hl.g * 0.52);
    land *= 1.0 - 0.45 * extra.y * (1.0 - smoothstep(0.0, 0.55, edge));
    float pulse = 0.6 + 0.4 * sin(uTime * 4.0);
    land = mix(land, GOLD, extra.z * (0.14 + 0.55 * (1.0 - smoothstep(0.0, wGlow, edge))) * pulse);
    // A steady, ink-backed contour on the focused country's actual boundary. Screen-space
    // widths stay readable at every zoom; the index neighbour mask skips internal group edges.
    float focusEdge = extra.x;
    float outlineAA = max(aaE * 0.9, px * 0.75);
    float casing = 1.0 - smoothstep(4.2 * px - outlineAA, 4.2 * px + outlineAA, edge);
    float contour = 1.0 - smoothstep(2.4 * px - outlineAA, 2.4 * px + outlineAA, edge);
    land = mix(land, vec3(0.12, 0.08, 0.04), casing * focusEdge * 0.88);
    land = mix(land, vec3(1.0, 0.88, 0.52), contour * focusEdge);
  }

  vec3 water = vec3(0.0);
  if (landMask < 0.998) {
    // ---- water: deep blue to teal shallows, driven by the real sea floor and by distance to land
    float seaD = textureLod(uSea, vUv + warp * 0.12 / uWorld, 0.0).r * uRanges.z;
    float depth = textureLod(uDepth, vUv + warp * 0.30 / uWorld, 0.0).r;
    float shelf = 1.0 - smoothstep(0.10, 0.45, depth);
    float near = 1.0 - smoothstep(0.0, 2.4, seaD);
    float shallow = clamp(max(shelf * 0.8, near * near), 0.0, 1.0);
    water = mix(vec3(0.075, 0.19, 0.37), vec3(0.10, 0.34, 0.53), smoothstep(0.0, 0.55, shallow));
    water = mix(water, vec3(0.26, 0.64, 0.66), smoothstep(0.5, 1.0, shallow));
    water *= 1.0 - 0.22 * smoothstep(0.55, 0.95, depth);
    water *= 1.0 + (b1.b - 0.5) * 0.16 + (b2.b - 0.5) * 0.08 * detail;
    if (detail > 0.01) {
      vec2 flow = vec2(uTime * 0.012, uTime * 0.007);
      float wav = textureGrad(uNoise, wp * 0.22 + flow, dWx * 0.22, dWy * 0.22).b
                + textureGrad(uNoise, wp * 0.31 - flow.yx, dWx * 0.31, dWy * 0.31).g;
      water += vec3(0.05, 0.085, 0.09) * smoothstep(1.05, 1.35, wav) * detail;
    }
    water *= 1.0 + min(s, 0.0) * 0.30;   // land throws a soft shadow on the sea
    float dC = max(-coast, 0.0);
    float foamW = max(1.6 * px, 0.045);
    water = mix(water, vec3(0.80, 0.95, 0.92), (1.0 - smoothstep(foamW * 0.4, foamW * 1.6, dC)) * 0.8);
    float ringD = 0.20 + 0.03 * sin(uTime * 0.8 + wp.x * 1.3 + wp.y * 0.9);
    float ring = (1.0 - smoothstep(0.0, 0.03, abs(dC - ringD))) * smoothstep(3.0, 6.0, 0.2 / px);
    water = mix(water, vec3(0.75, 0.93, 0.92), ring * 0.22);
    water = mix(water, vec3(luma(water)) * vec3(0.50, 0.53, 0.62), uDim * 0.32);
  }

  // The map is the backdrop for the board: a touch quieter overall so nodes and links read first.
  // Whatever is in focus keeps its full strength.
  vec3 col = mix(water, land, landMask);
  float quiet = 1.0 - hl.r * landMask;
  col = mix(col, mix(vec3(luma(col)), col, 0.84) * 0.86, quiet);
  outColor = vec4(col, 1.0);
}
`;

/**
 * One rectangular piece of the terrain grid. `segX`/`segZ` are the segment counts of the whole map,
 * `i0..i1` and `j0..j1` the range this piece covers; neighbouring pieces compute their shared edge
 * from the same indices, so they meet without cracks.
 */
function gridGeometry(
  world: { width: number; height: number },
  segX: number,
  segZ: number,
  i0: number,
  i1: number,
  j0: number,
  j1: number,
  maxHeight: number,
): THREE.BufferGeometry {
  const nx = i1 - i0;
  const nz = j1 - j0;
  const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
  let o = 0;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      pos[o++] = (i / segX - 0.5) * world.width;
      pos[o++] = 0;
      pos[o++] = (j / segZ - 0.5) * world.height;
    }
  }
  const idx = new Uint32Array(nx * nz * 6);
  o = 0;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + 1;
      const c = a + nx + 1;
      const d = c + 1;
      idx[o++] = a; idx[o++] = c; idx[o++] = b;
      idx[o++] = b; idx[o++] = c; idx[o++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  // The vertex shader moves vertices up, so the bounds are set by hand for frustum culling.
  const w = ((i1 - i0) / segX) * world.width;
  const h = ((j1 - j0) / segZ) * world.height;
  geo.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(((i0 + i1) / 2 / segX - 0.5) * world.width, maxHeight / 2, ((j0 + j1) / 2 / segZ - 0.5) * world.height),
    Math.hypot(w / 2, h / 2, maxHeight),
  );
  return geo;
}

export type Terrain = {
  group: THREE.Group;
  uniforms: Record<string, THREE.IUniform>;
  /** World height of a terrain value of 1. */
  relief: number;
  /** How far a hovered territory rises. */
  lift: number;
  /** Picks the grid density for the current zoom (world units per screen pixel). */
  setDetail(unitsPerPixel: number): void;
};

export function createTerrain(
  loaded: LoadedPack,
  stateTexture: THREE.Texture,
  brush: THREE.Texture,
  noise: THREE.Texture,
): Terrain {
  const { pack, tex } = loaded;
  const world = new THREE.Vector2(pack.world.width, pack.world.height);
  const relief = pack.world.relief * 1.25;
  const lift = 0.3;
  const uniforms: Record<string, THREE.IUniform> = {
    uHeight: { value: tex.height },
    uAlbedo: { value: tex.albedo },
    uShade: { value: tex.shade },
    uEdge: { value: tex.edge },
    uCoast: { value: tex.coast },
    uSea: { value: tex.sea },
    uDepth: { value: tex.depth },
    uIds: { value: tex.ids },
    uState: { value: stateTexture },
    uBrush: { value: brush },
    uNoise: { value: noise },
    uIdSize: { value: new THREE.Vector2(loaded.idSize[0], loaded.idSize[1]) },
    uWorld: { value: world },
    uRanges: { value: new THREE.Vector3(pack.encoding.edgeRange, pack.encoding.coastRange, pack.encoding.seaRange) },
    uSideA: { value: new THREE.Color(pack.scenario.sides[0].color) },
    uSideB: { value: new THREE.Color(pack.scenario.sides[1].color) },
    uRelief: { value: relief },
    uLift: { value: lift },
    uTime: { value: 0 },
    uGlobal: { value: 1 },
    uDim: { value: 0 },
  };
  const material = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG, uniforms });
  const group = new THREE.Group();
  const maxHeight = relief + lift;
  // Three grid densities. The finest is cut into tiles so that, zoomed in, only the tiles in view are
  // drawn; zoomed out, a coarse grid avoids filling the screen with triangles smaller than a pixel.
  const levels = [
    { segX: 1024, tilesX: 8, tilesZ: 4, upTo: 0.042 },
    { segX: 512, tilesX: 2, tilesZ: 1, upTo: 0.085 },
    { segX: 256, tilesX: 1, tilesZ: 1, upTo: Infinity },
  ].map((level) => {
    const perTileZ = Math.round((level.segX * pack.world.height) / pack.world.width / level.tilesZ);
    const segZ = perTileZ * level.tilesZ;
    const perTileX = level.segX / level.tilesX;
    const meshes: THREE.Mesh[] = [];
    for (let tz = 0; tz < level.tilesZ; tz++) {
      for (let tx = 0; tx < level.tilesX; tx++) {
        const geo = gridGeometry(pack.world, level.segX, segZ, tx * perTileX, (tx + 1) * perTileX, tz * perTileZ, (tz + 1) * perTileZ, maxHeight);
        const mesh = new THREE.Mesh(geo, material);
        mesh.visible = false;
        group.add(mesh);
        meshes.push(mesh);
      }
    }
    return { upTo: level.upTo, meshes };
  });
  let current = -1;
  const setDetail = (unitsPerPixel: number): void => {
    let want = levels.findIndex((l) => unitsPerPixel < l.upTo);
    // a little hysteresis so the grid does not flip back and forth around a threshold
    if (current >= 0 && want !== current) {
      const edge = levels[Math.min(want, current)].upTo;
      if (Math.abs(unitsPerPixel - edge) / edge < 0.08) want = current;
    }
    if (want === current) return;
    current = want;
    levels.forEach((l, i) => l.meshes.forEach((m) => (m.visible = i === want)));
  };
  setDetail(1);

  return { group, uniforms, relief, lift, setDetail };
}
