// Offline generator: turns public geographic data plus one scenario file into the runtime map pack
// (public/maps/<scenario>/). Usage: npm run mapgen -- <scenario-id> [--debug]
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp, { type Sharp } from 'sharp';
import type { Link, MapPack, ScenarioSource } from '../../src/map/types.ts';
import { buildFonts } from './fonts.ts';
import { CACHE_DIR, OUT_DIR, RAW_DIR, SCENARIOS_DIR } from './paths.ts';
import { latToY, lonToX, makeProjection, xToLon, yToLat } from './projection.ts';
import { type Ring, bilinear, distanceTransform, downsample, fillPolygon, fnv1a, gaussianBlur } from './raster.ts';
import { loadElevation, loadLandCover } from './sources.ts';
import { paintAlbedo } from './albedo.ts';
import { validateScenario } from './validate.ts';

// ---------------------------------------------------------------- layout
const W = 4096; // full-resolution texture width
const H = 2304; // 16:9, so the whole map fills a widescreen display edge to edge; texels stay square
const SS = 2; // borders are rasterised at SS x and reduced, for sub-texel accurate distance fields
const W2 = W * SS;
const H2 = H * SS;
const WORLD_W = 200;
const WORLD_H = (WORLD_W * H) / W;
const PX = WORLD_W / W; // world units per texel
const LON0 = -169; // map edge: between Alaska and Chukotka
const LAT_SOUTH = -70; // with the 16:9 shape this puts the north edge at about 85 N
const EDGE_RANGE_PX = 24;
const COAST_RANGE_PX = 8;
const SEA_RANGE_PX = 160;
const RELIEF = 1; // world height of a terrain value of 1; the runtime may scale it
const MIN_LINK_PX = 3; // shared border length for two countries to count as land neighbours
const MIN_LAKE_PX = 30;
// Board layout: every node gets at least this much room (world units), found by easing crowded
// nodes apart, and is never moved further than NODE_REACH from its country.
const NODE_W = 3.2;
const NODE_H = 2.1;
const NODE_REACH = 5;

const args = process.argv.slice(2);
const scenarioId = args.find((a) => !a.startsWith('--')) ?? 'coldwar';
const debug = args.includes('--debug');
const scenarioDir = path.join(SCENARIOS_DIR, scenarioId);
const outDir = path.join(OUT_DIR, scenarioId);
const proj = makeProjection(LON0, LAT_SOUTH, W / H);

const t0 = Date.now();
const log = (msg: string): void => console.log(`[${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s] ${msg}`);

// ---------------------------------------------------------------- scenario
const scenario = JSON.parse(await readFile(path.join(scenarioDir, 'scenario.json'), 'utf8')) as ScenarioSource;
validateScenario(scenario);
const N = scenario.countries.length;
log(`scenario ${scenario.id}: ${N} countries, ${scenario.regions.length} regions`);

// ---------------------------------------------------------------- vector data
type Geometry = { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };
type GeoFeature = { properties: Record<string, string | number>; geometry: Geometry };
const readGeo = async (file: string): Promise<GeoFeature[]> =>
  (JSON.parse(await readFile(file, 'utf8')) as { features: GeoFeature[] }).features;
const polygonsOf = (g: Geometry): number[][][][] =>
  g.type === 'Polygon' ? [g.coordinates as number[][][]] : (g.coordinates as number[][][][]);

/** Projects a lon/lat ring to pixels. Long edges are subdivided because latitude is not linear in y. */
function projectRing(ring: number[][], w: number, h: number, xOffset: number): Ring {
  const out: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const [lonA, latA] = ring[i];
    const [lonB, latB] = ring[(i + 1) % ring.length];
    const steps = Math.max(1, Math.ceil(Math.abs(latB - latA) / 0.5));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push(lonToX(proj, lonA + (lonB - lonA) * t, w) + xOffset, latToY(proj, latA + (latB - latA) * t, h));
    }
  }
  return Float64Array.from(out);
}

/** Fills a lon/lat polygon. Drawn twice so the part west of the map edge wraps to the east side. */
function fillGeo(rings: number[][][], w: number, h: number, span: (y: number, x0: number, x1: number) => void): void {
  for (const xOffset of [0, w]) {
    fillPolygon(
      rings.map((r) => projectRing(r, w, h, xOffset)),
      w,
      h,
      span,
    );
  }
}

const units = await readGeo(path.join(RAW_DIR, 'ne_50m_admin_0_map_units.geojson'));
const lakes = await readGeo(path.join(RAW_DIR, 'ne_50m_lakes.geojson'));

/** `adm0:XXX` = every unit of that country, `unit:XXX` = one map unit. Returns feature numbers (1-based). */
function resolveSelector(sel: string): number[] {
  const [kind, code] = sel.split(':');
  const out: number[] = [];
  units.forEach((f, i) => {
    const p = f.properties;
    if (kind === 'adm0' ? p.ADM0_A3 === code : kind === 'unit' ? p.GU_A3 === code || p.SU_A3 === code : false) out.push(i + 1);
  });
  return out;
}

// ---------------------------------------------------------------- rasterise territories (at SS x)
log('rasterising');
const N2 = W2 * H2;
const feat2 = new Uint16Array(N2); // which Natural Earth feature covers each pixel (0 = water)
units.forEach((f, i) => {
  for (const poly of polygonsOf(f.geometry)) {
    fillGeo(poly, W2, H2, (y, x0, x1) => feat2.fill(i + 1, y * W2 + x0, y * W2 + x1));
  }
});
const lake2 = new Uint8Array(N2);
for (const f of lakes) {
  for (const poly of polygonsOf(f.geometry)) {
    let area = 0;
    fillGeo(poly, W, H, (_y, x0, x1) => (area += x1 - x0));
    if (area < MIN_LAKE_PX) continue;
    fillGeo(poly, W2, H2, (y, x0, x1) => {
      for (let i = y * W2 + x0; i < y * W2 + x1; i++) {
        if (feat2[i]) {
          feat2[i] = 0;
          lake2[i] = 1;
        }
      }
    });
  }
}

const featPixels = new Uint32Array(units.length + 1);
for (let i = 0; i < N2; i++) featPixels[feat2[i]]++;

const featIndex = new Uint8Array(units.length + 1); // feature -> territory index
scenario.countries.forEach((c, ci) => {
  for (const sel of c.shapes) {
    if (sel.startsWith('custom:')) continue;
    const found = resolveSelector(sel);
    if (!found.length) throw new Error(`${c.id}: shape ${sel} matches nothing`);
    for (const f of found) {
      if (featIndex[f] && featIndex[f] !== ci + 1) {
        throw new Error(`${c.id}: shape ${sel} is already used by ${scenario.countries[featIndex[f] - 1].id}`);
      }
      featIndex[f] = ci + 1;
    }
  }
});
// Land outside the scenario still gets an index per country, so the old-map style can draw its borders.
let indexCount = N + 1;
{
  const byCountry = new Map<string, number>();
  units.forEach((f, i) => {
    if (featIndex[i + 1] || featPixels[i + 1] === 0) return;
    const key = String(f.properties.ADM0_A3);
    let idx = byCountry.get(key);
    if (idx === undefined) {
      if (indexCount > 255) throw new Error('more than 255 territories; merge some land that is outside the scenario');
      idx = indexCount++;
      byCountry.set(key, idx);
    }
    featIndex[i + 1] = idx;
  });
}
const id2 = new Uint8Array(N2);
for (let i = 0; i < N2; i++) id2[i] = featIndex[feat2[i]];

// Custom polygons repaint part of an existing shape (for example one half of a divided country).
if (scenario.customShapes) {
  const custom = await readGeo(path.join(scenarioDir, scenario.customShapes));
  scenario.countries.forEach((c, ci) => {
    for (const sel of c.shapes) {
      if (!sel.startsWith('custom:')) continue;
      const f = custom.find((x) => x.properties.id === sel.slice(7));
      if (!f) throw new Error(`${c.id}: ${sel} not found in ${scenario.customShapes}`);
      const clip = new Set(resolveSelector(String(f.properties.clip)));
      if (!clip.size) throw new Error(`${sel}: clip ${f.properties.clip} matches nothing`);
      let painted = 0;
      for (const poly of polygonsOf(f.geometry)) {
        fillGeo(poly, W2, H2, (y, x0, x1) => {
          for (let i = y * W2 + x0; i < y * W2 + x1; i++) {
            if (clip.has(feat2[i])) {
              id2[i] = ci + 1;
              painted++;
            }
          }
        });
      }
      if (!painted) throw new Error(`${sel}: painted nothing`);
    }
  });
}
// Lake water thinner than about two and a half texels (narrow reservoirs) cannot be drawn as water at texture
// resolution, but would still leave a border line behind. Fill it in with the land around it so the
// distance fields and the territory map agree. Sea straits are left alone: closing them would invent
// land borders between countries that only face each other across water.
{
  // morphological opening of the water mask: erode by R, then grow back by R
  const R = 2;
  const wide = new Uint8Array(N2);
  for (let y = R; y < H2 - R; y++) {
    for (let x = R; x < W2 - R; x++) {
      const i = y * W2 + x;
      if (id2[i]) continue;
      let open = true;
      for (let j = -R; j <= R && open; j++) for (let k = -R; k <= R; k++) if (id2[i + j * W2 + k]) { open = false; break; }
      if (!open) continue;
      for (let j = -R; j <= R; j++) for (let k = -R; k <= R; k++) wide[i + j * W2 + k] = 1;
    }
  }
  let filled = 0;
  for (let pass = 0; pass < 2 * R + 1; pass++) {
    const next: number[] = [];
    for (let y = 1; y < H2 - 1; y++) {
      for (let x = 1; x < W2 - 1; x++) {
        const i = y * W2 + x;
        if (id2[i] || wide[i] || !lake2[i]) continue;
        const v = id2[i - 1] || id2[i + 1] || id2[i - W2] || id2[i + W2];
        if (v) next.push(i, v);
      }
    }
    for (let k = 0; k < next.length; k += 2) {
      id2[next[k]] = next[k + 1];
      lake2[next[k]] = 0;
    }
    filled += next.length / 2;
  }
  log(`filled ${filled} thin lake pixels`);
}
{
  const seen = new Uint32Array(256);
  for (let i = 0; i < N2; i++) seen[id2[i]]++;
  scenario.countries.forEach((c, ci) => {
    if (!seen[ci + 1]) throw new Error(`${c.id}: no pixels on the map`);
  });
}
log(`${indexCount - 1} territories (${N} in the scenario, ${indexCount - 1 - N} outside it)`);

// ---------------------------------------------------------------- reduce to texture resolution
const NPX = W * H;
const id1 = new Uint8Array(NPX);
const lake1 = new Uint8Array(NPX);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const o = y * 2 * W2 + x * 2;
    const s = [id2[o], id2[o + 1], id2[o + W2], id2[o + W2 + 1]];
    let best = s[0];
    let bestN = 0;
    for (const v of s) {
      let n = 0;
      for (const u of s) if (u === v) n++;
      // majority wins; on a tie land beats water so thin land survives
      if (n > bestN || (n === bestN && best === 0 && v !== 0)) {
        best = v;
        bestN = n;
      }
    }
    id1[y * W + x] = best;
    lake1[y * W + x] = best === 0 && lake2[o] + lake2[o + 1] + lake2[o + W2] + lake2[o + W2 + 1] >= 2 ? 1 : 0;
  }
}

// ---------------------------------------------------------------- distance to the nearest border / coast
log('border distance field');
const edge1 = new Float32Array(NPX); // texels, unclamped
const nb1 = new Uint8Array(NPX); // territory on the other side of the nearest border
{
  const isBorder = new Uint8Array(N2);
  const across = new Uint8Array(N2);
  for (let y = 0; y < H2; y++) {
    for (let x = 0; x < W2; x++) {
      const i = y * W2 + x;
      const v = id2[i];
      let found = false;
      let other = 0;
      // the map joins up with itself east-west, so the neighbours of an edge texel are on the other edge
      const east = x + 1 < W2 ? i + 1 : i + 1 - W2;
      const west = x > 0 ? i - 1 : i - 1 + W2;
      if (id2[east] !== v) { found = true; other ||= id2[east]; }
      if (id2[west] !== v) { found = true; other ||= id2[west]; }
      if (y + 1 < H2 && id2[i + W2] !== v) { found = true; other ||= id2[i + W2]; }
      if (y > 0 && id2[i - W2] !== v) { found = true; other ||= id2[i - W2]; }
      if (found) {
        isBorder[i] = 1;
        across[i] = other;
      }
    }
  }
  const ft = distanceTransform(isBorder, W2, H2, true, true);
  const dist2 = new Float32Array(N2);
  const nb2 = new Uint8Array(N2);
  for (let i = 0; i < N2; i++) {
    const b = ft.sy![i] * W2 + ft.sx![i];
    const r = Math.sqrt(ft.d2[i]);
    // The border runs half a pixel beyond the nearest border pixel on our own side.
    if (id2[b] === id2[i]) {
      dist2[i] = r + 0.5;
      nb2[i] = across[b];
    } else {
      dist2[i] = Math.max(0, r - 0.5);
      nb2[i] = id2[b];
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = y * 2 * W2 + x * 2;
      const m = id1[y * W + x];
      let acc = 0;
      let nb = -1;
      for (const i of [o, o + 1, o + W2, o + W2 + 1]) {
        if (id2[i] === m) {
          acc += dist2[i];
          if (nb < 0) nb = nb2[i];
        } else acc -= dist2[i];
      }
      edge1[y * W + x] = Math.max(0, acc / 4 / SS);
      nb1[y * W + x] = Math.max(0, nb);
    }
  }
}

log('coast distance field');
let coast1: Float32Array; // texels, signed, + on land
{
  const water = new Uint8Array(N2);
  const land = new Uint8Array(N2);
  for (let i = 0; i < N2; i++) {
    water[i] = id2[i] === 0 ? 1 : 0;
    land[i] = 1 - water[i];
  }
  // across the map's east-west join too, so that shallows and shore lines carry on round the world
  const toWater = distanceTransform(water, W2, H2, false, true).d2;
  const toLand = distanceTransform(land, W2, H2, false, true).d2;
  const signed = new Float32Array(N2);
  for (let i = 0; i < N2; i++) signed[i] = land[i] ? Math.sqrt(toWater[i]) - 0.5 : -(Math.sqrt(toLand[i]) - 0.5);
  coast1 = downsample(signed, W2, H2, SS);
  for (let i = 0; i < NPX; i++) coast1[i] /= SS;
}

// ---------------------------------------------------------------- terrain
log('elevation');
const elev = await loadElevation(proj, { width: W, height: H });
const height1 = new Float32Array(NPX); // 0..1
const depth1 = new Float32Array(NPX); // sea-floor depth, 0..1
{
  // Lakes sit flat at their shore level instead of following the lake bed.
  const lakeLevel = new Float32Array(NPX);
  const seen = new Uint8Array(NPX);
  const stack: number[] = [];
  for (let start = 0; start < NPX; start++) {
    if (!lake1[start] || seen[start]) continue;
    const members: number[] = [];
    const shore: number[] = [];
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      members.push(i);
      const x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (j < 0 || j >= NPX) continue;
        if (lake1[j]) {
          if (!seen[j]) {
            seen[j] = 1;
            stack.push(j);
          }
        } else if (id1[j]) shore.push(Math.max(0, elev[j]));
      }
    }
    shore.sort((a, b) => a - b);
    const level = shore.length ? shore[Math.floor(shore.length * 0.2)] : 0;
    for (const i of members) lakeLevel[i] = level;
  }

  const ocean = new Uint8Array(NPX);
  for (let i = 0; i < NPX; i++) ocean[i] = id1[i] === 0 && !lake1[i] ? 1 : 0;
  const toOcean = distanceTransform(ocean, W, H, false, true).d2;

  const metres = new Float32Array(NPX);
  for (let i = 0; i < NPX; i++) metres[i] = ocean[i] ? 0 : lake1[i] ? lakeLevel[i] : Math.max(0, elev[i]);
  // Stylised relief: ranges are pushed up relative to their surroundings so they read as solid masses,
  // while broad plateaus are held down.
  const broad = gaussianBlur(metres, W, H, 26, true);
  const raw = new Float32Array(NPX);
  for (let i = 0; i < NPX; i++) {
    if (ocean[i]) continue;
    const m = metres[i];
    const local = Math.max(0, m - broad[i]);
    const shaped = 0.55 * m + 0.45 * broad[i] * 0.55 + 1.5 * local;
    const h = 1 - Math.exp(-shaped / 2600);
    const shoreDist = Math.sqrt(toOcean[i]) - 0.5;
    const t = Math.min(1, Math.max(0, shoreDist / 5));
    raw[i] = h * t * t * (3 - 2 * t);
  }
  height1.set(gaussianBlur(raw, W, H, 0.7, true));
  for (let i = 0; i < NPX; i++) {
    if (ocean[i]) height1[i] = 0;
    depth1[i] = ocean[i] ? Math.sqrt(Math.min(1, Math.max(0, -elev[i]) / 6000)) : 0;
  }
}

log('baking light');
const shade1 = new Float32Array(NPX); // 0.5 = flat ground
{
  // One warm key light from the north-west. The bake uses a steeper terrain than the mesh so relief
  // stays readable from far away.
  const BAKE_RELIEF = 2.6;
  const hd = new Float32Array(NPX);
  for (let i = 0; i < NPX; i++) hd[i] = height1[i] * BAKE_RELIEF;
  const L = [-0.52, 0.6, -0.61];
  const len = Math.hypot(L[0], L[1], L[2]);
  const [lx, ly, lz] = L.map((v) => v / len);
  const horiz = Math.hypot(lx, lz);
  const stepX = lx / horiz;
  const stepY = lz / horiz;
  const sunSlope = ly / horiz;
  const soft = gaussianBlur(hd, W, H, 5);
  const STEPS = 40;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const h = hd[i];
      const hx0 = hd[y * W + Math.max(0, x - 1)];
      const hx1 = hd[y * W + Math.min(W - 1, x + 1)];
      const hy0 = hd[Math.max(0, y - 1) * W + x];
      const hy1 = hd[Math.min(H - 1, y + 1) * W + x];
      const dx = (hx1 - hx0) / (2 * PX);
      const dz = (hy1 - hy0) / (2 * PX);
      const inv = 1 / Math.hypot(dx, 1, dz);
      const lambert = Math.max(0, (-dx * lx + ly - dz * lz) * inv);
      const direct = lambert / ly - 1; // 0 on flat ground
      // Soft cast shadow: steepest slope towards the sun compared with the sun's own slope.
      let horizon = 0;
      if (h < BAKE_RELIEF * 0.98) {
        for (let s = 1; s <= STEPS; s++) {
          const sx = x + stepX * s * 1.5;
          const sy = y + stepY * s * 1.5;
          if (sx < 0 || sy < 0 || sx > W - 1 || sy > H - 1) break;
          const slope = (bilinear(hd, W, H, sx, sy) - h) / (s * 1.5 * PX);
          if (slope > horizon) horizon = slope;
        }
      }
      const k = Math.min(1, Math.max(0, (horizon - sunSlope * 0.45) / (sunSlope * 0.9)));
      const shadow = k * k * (3 - 2 * k);
      const cavity = Math.min(1, Math.max(-1, (soft[i] - h) / 0.22));
      shade1[i] = 0.5 + 0.5 * Math.min(0.75, Math.max(-1, direct)) - 0.2 * shadow - 0.1 * cavity;
    }
  }
}

log('painting base colour');
const AW = W / 2;
const AH = H / 2;
const landCover = await loadLandCover(proj, { width: AW, height: AH });
const albedo = paintAlbedo({
  width: AW,
  height: AH,
  landCover,
  coast: downsample(coast1, W, H, 2),
  relief: downsample(height1, W, H, 2),
  elevation: downsample(elev, W, H, 2),
  latitude: (y) => yToLat(proj, y + 0.5, AH),
});

// ---------------------------------------------------------------- anchors, bounds, links
log('anchors and links');
const toWorld = (px: number, py: number): [number, number] => [
  Math.round(((px + 0.5) * PX - WORLD_W / 2) * 1000) / 1000,
  Math.round(((py + 0.5) * PX - WORLD_H / 2) * 1000) / 1000,
];
const anchorPx: [number, number][] = [];
{
  const best = new Float32Array(N + 1).fill(-1);
  const at = new Int32Array(N + 1).fill(-1);
  for (let i = 0; i < NPX; i++) {
    const v = id1[i];
    if (v >= 1 && v <= N && edge1[i] > best[v]) {
      best[v] = edge1[i];
      at[v] = i;
    }
  }
  scenario.countries.forEach((c, ci) => {
    let px = at[ci + 1] % W;
    let py = Math.floor(at[ci + 1] / W);
    if (c.anchor) {
      let x = lonToX(proj, c.anchor[0], W);
      if (x < 0) x += W;
      px = Math.round(x);
      py = Math.round(latToY(proj, c.anchor[1], H));
      if (id1[py * W + px] !== ci + 1) console.warn(`  warning: ${c.id} anchor override is outside its territory`);
    }
    anchorPx.push([px, py]);
  });
}
const packCountries: MapPack['countries'] = [];
{
  const seen = new Uint8Array(NPX);
  scenario.countries.forEach((c, ci) => {
    const [ax, ay] = anchorPx[ci];
    // Bounds of the landmass that holds the anchor, so far-flung islands do not blow up the framing.
    let x0 = ax, x1 = ax, y0 = ay, y1 = ay;
    const start = ay * W + ax;
    if (id1[start] === ci + 1) {
      const stack = [start];
      seen[start] = 1;
      while (stack.length) {
        const i = stack.pop()!;
        const x = i % W;
        const y = (i - x) / W;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
          if (j >= 0 && j < NPX && !seen[j] && id1[j] === ci + 1) {
            seen[j] = 1;
            stack.push(j);
          }
        }
      }
    }
    let area = 0;
    for (let i = 0; i < NPX; i++) if (id1[i] === ci + 1) area++;
    const [bx0, bz0] = toWorld(x0 - 0.5, y0 - 0.5);
    const [bx1, bz1] = toWorld(x1 + 0.5, y1 + 0.5);
    packCountries.push({
      id: c.id,
      index: ci + 1,
      anchor: toWorld(ax, ay),
      node: toWorld(ax, ay),
      bbox: [bx0, bz0, bx1, bz1],
      area: Math.round(area * PX * PX * 100) / 100,
    });
    c.anchor = [Math.round(xToLon(proj, ax + 0.5, W) * 100) / 100, Math.round(yToLat(proj, ay + 0.5, H) * 100) / 100];
  });
}

// ---------------------------------------------------------------- board layout
// Nodes are the main thing a player reads, so they must never sit on top of each other, even with the
// whole world on screen. Start every node at its country's anchor and ease overlapping ones apart.
// A country with an explicit `node` in the scenario stays exactly where the author put it.
{
  const pos = packCountries.map((c) => [c.anchor[0], c.anchor[1]] as [number, number]);
  const pinned = scenario.countries.map((c, i) => {
    if (!c.node) return false;
    let x = lonToX(proj, c.node[0], W);
    if (x < 0) x += W;
    pos[i] = toWorld(x, latToY(proj, c.node[1], H));
    return true;
  });
  const home = pos.map((p) => [p[0], p[1]] as [number, number]);
  // Where a node may go is relaxed in three stages: first only over its own country, then also over
  // water, and only at the very end over somebody else's land (where it could be misread as theirs).
  const ownerAt = (x: number, z: number): number => {
    const px = Math.floor((x + WORLD_W / 2) / PX);
    const py = Math.floor((z + WORLD_H / 2) / PX);
    return px < 0 || py < 0 || px >= W || py >= H ? 0 : id1[py * W + px];
  };
  let stage: 'own' | 'water' | 'any' = 'own';
  const move = (i: number, k: 0 | 1, by: number): boolean => {
    if (pinned[i] || by === 0) return false;
    for (const step of [by, by / 2, by / 4]) {
      const x = pos[i][0] + (k === 0 ? step : 0);
      const z = pos[i][1] + (k === 1 ? step : 0);
      const owner = ownerAt(x, z);
      if (stage === 'any' || owner === i + 1 || (stage === 'water' && owner === 0)) {
        pos[i][0] = x;
        pos[i][1] = z;
        return true;
      }
    }
    return false;
  };
  const ROUNDS = 1500;
  for (let round = 0; round < ROUNDS; round++) {
    stage = round < 900 ? 'own' : round < ROUNDS - 150 ? 'water' : 'any';
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const dx = pos[j][0] - pos[i][0];
        const dz = pos[j][1] - pos[i][1];
        const ox = NODE_W - Math.abs(dx);
        const oz = NODE_H - Math.abs(dz);
        if (ox <= 0 || oz <= 0 || (pinned[i] && pinned[j])) continue;
        const shareI = pinned[i] ? 0 : pinned[j] ? 1 : 0.5;
        // Each node steps away along whichever axis needs the smaller move; if it may not go that way
        // (it would leave its own country), it tries the other axis instead.
        const preferX = ox / NODE_W < oz / NODE_H;
        const stepAway = (n: number, sign: number, share: number): void => {
          for (const alongX of [preferX, !preferX]) {
            const dir = ((alongX ? dx : dz) >= 0 ? 1 : -1) * sign;
            if (move(n, alongX ? 0 : 1, dir * (alongX ? ox : oz) * 0.5 * share)) return;
          }
        };
        stepAway(i, -1, shareI);
        stepAway(j, 1, 1 - shareI);
      }
    }
    for (let i = 0; i < pos.length; i++) {
      if (pinned[i]) continue;
      // a weak pull home keeps the layout geographic; it is switched off for the last rounds so gaps hold
      if (round < ROUNDS - 220) {
        move(i, 0, (home[i][0] - pos[i][0]) * 0.02);
        move(i, 1, (home[i][1] - pos[i][1]) * 0.02);
      }
      const dx = pos[i][0] - home[i][0];
      const dz = pos[i][1] - home[i][1];
      const far = Math.hypot(dx, dz);
      if (far > NODE_REACH) {
        pos[i][0] = home[i][0] + (dx / far) * NODE_REACH;
        pos[i][1] = home[i][1] + (dz / far) * NODE_REACH;
      }
      pos[i][0] = Math.min(WORLD_W / 2 - NODE_W, Math.max(-WORLD_W / 2 + NODE_W, pos[i][0]));
      pos[i][1] = Math.min(WORLD_H / 2 - NODE_H, Math.max(-WORLD_H / 2 + NODE_H, pos[i][1]));
    }
  }
  const atSea: string[] = [];
  const abroad: string[] = [];
  pos.forEach((q, i) => {
    const owner = ownerAt(q[0], q[1]);
    if (owner === 0) atSea.push(scenario.countries[i].id);
    else if (owner !== i + 1) abroad.push(scenario.countries[i].id);
  });
  let overlaps = 0;
  let farthest = 0;
  for (let i = 0; i < pos.length; i++) {
    farthest = Math.max(farthest, Math.hypot(pos[i][0] - home[i][0], pos[i][1] - home[i][1]));
    for (let j = i + 1; j < pos.length; j++) {
      if (NODE_W - Math.abs(pos[j][0] - pos[i][0]) > 0.05 && NODE_H - Math.abs(pos[j][1] - pos[i][1]) > 0.05) overlaps++;
    }
    packCountries[i].node = [Math.round(pos[i][0] * 1000) / 1000, Math.round(pos[i][1] * 1000) / 1000];
  }
  log(`board layout: ${overlaps} overlapping pairs left, largest move ${farthest.toFixed(1)} units`);
  if (atSea.length) console.log(`  nodes placed over water: ${atSea.join(', ')}`);
  if (abroad.length) console.log(`  nodes placed over another country: ${abroad.join(', ')}`);
}

const links: Link[] = [];
{
  const shared = new Map<number, number>();
  const count = (a: number, b: number): void => {
    if (a === b || a < 1 || b < 1 || a > N || b > N) return;
    const key = a < b ? a * 256 + b : b * 256 + a;
    shared.set(key, (shared.get(key) ?? 0) + 1);
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (x + 1 < W) count(id1[i], id1[i + 1]);
      if (y + 1 < H) count(id1[i], id1[i + W]);
    }
  }
  const have = new Set<string>();
  const mode = scenario.landLinks ?? 'derive';
  let pairs: [number, number][] = [];
  if (mode !== 'manual') {
    for (const [key, n] of [...shared].sort((p, q) => p[0] - q[0])) {
      if (n >= MIN_LINK_PX) pairs.push([(key >> 8) - 1, (key & 255) - 1]);
    }
  }
  const bordering = pairs.length;
  if (mode === 'thinned') {
    // Drop a link when a third country borders both ends and the link is the longest side of that
    // triangle. Every dropped link leaves a two-step route over strictly shorter links, so the board
    // stays connected while losing most of its crossing and redundant lines.
    const next = new Map<number, Set<number>>();
    for (const [a, b] of pairs) {
      (next.get(a) ?? next.set(a, new Set()).get(a)!).add(b);
      (next.get(b) ?? next.set(b, new Set()).get(b)!).add(a);
    }
    const span = (a: number, b: number): number =>
      Math.hypot(packCountries[a].node[0] - packCountries[b].node[0], packCountries[a].node[1] - packCountries[b].node[1]);
    pairs = pairs.filter(([a, b]) => {
      const len = span(a, b);
      for (const c of next.get(a)!) {
        if (c !== b && next.get(b)!.has(c) && len > span(a, c) && len > span(b, c)) return false;
      }
      return true;
    });
  }
  for (const [ia, ib] of pairs) {
    const a = scenario.countries[ia].id;
    const b = scenario.countries[ib].id;
    links.push({ a, b, kind: 'land' });
    have.add(`${a}|${b}`).add(`${b}|${a}`);
  }
  for (const l of scenario.links) {
    if (have.has(`${l.a}|${l.b}`)) {
      console.warn(`  note: ${l.a}-${l.b} is listed as ${l.kind} but already shares a land border; kept as land`);
      continue;
    }
    links.push({ ...l });
    have.add(`${l.a}|${l.b}`).add(`${l.b}|${l.a}`);
  }
  const degree = new Map<string, number>();
  for (const l of links) {
    degree.set(l.a, (degree.get(l.a) ?? 0) + 1);
    degree.set(l.b, (degree.get(l.b) ?? 0) + 1);
  }
  const isolated = scenario.countries.filter((c) => !degree.get(c.id)).map((c) => c.id);
  if (isolated.length) console.warn(`  warning: no links at all for ${isolated.join(', ')}`);
  const counts = new Map<string, number>();
  for (const l of links) counts.set(l.kind, (counts.get(l.kind) ?? 0) + 1);
  log(`${links.length} links (${mode}${mode === 'thinned' ? `, from ${bordering} shared borders` : ''}): ${[...counts].map(([kind, n]) => `${n} ${kind}`).join(', ')}`);
}

const packRegions: MapPack['regions'] = scenario.regions.map((r) => {
  const members = packCountries.filter((_, i) => scenario.countries[i].region === r.id);
  if (!members.length) throw new Error(`region ${r.id} has no countries`);
  const bbox: [number, number, number, number] = [
    Math.min(...members.map((m) => m.bbox[0])),
    Math.min(...members.map((m) => m.bbox[1])),
    Math.max(...members.map((m) => m.bbox[2])),
    Math.max(...members.map((m) => m.bbox[3])),
  ];
  let center: [number, number];
  if (r.labelAt) {
    let x = lonToX(proj, r.labelAt[0], W);
    if (x < 0) x += W;
    center = toWorld(x, latToY(proj, r.labelAt[1], H));
  } else {
    const total = members.reduce((s, m) => s + m.area, 0);
    center = [
      Math.round((members.reduce((s, m) => s + m.anchor[0] * m.area, 0) / total) * 1000) / 1000,
      Math.round((members.reduce((s, m) => s + m.anchor[1] * m.area, 0) / total) * 1000) / 1000,
    ];
  }
  return { id: r.id, center, bbox };
});

// ---------------------------------------------------------------- write
log('writing');
await rm(outDir, { recursive: true, force: true }); // nothing stale may ship
await mkdir(outDir, { recursive: true });
const clamp8 = (v: number): number => Math.min(255, Math.max(0, Math.round(v)));
const gray = (src: Float32Array, map: (v: number) => number): Buffer => {
  const out = Buffer.alloc(src.length);
  for (let i = 0; i < src.length; i++) out[i] = clamp8(map(src[i]) * 255);
  return out;
};
const sizes: Record<string, number> = {};
const save = async (name: string, img: Sharp): Promise<void> => {
  const info = await img.toFile(path.join(outDir, name));
  sizes[name] = info.size;
};

const idsRgb = Buffer.alloc(NPX * 3);
for (let i = 0; i < NPX; i++) {
  idsRgb[i * 3] = id1[i];
  idsRgb[i * 3 + 1] = nb1[i];
}
await save('ids.png', sharp(idsRgb, { raw: { width: W, height: H, channels: 3 } }).png({ compressionLevel: 9 }));

await save(
  'edge.webp',
  sharp(gray(edge1, (v) => v / EDGE_RANGE_PX), { raw: { width: W, height: H, channels: 1 } }).webp({ lossless: true, effort: 6 }),
);
await save(
  'coast.webp',
  sharp(gray(coast1, (v) => 0.5 + v / (2 * COAST_RANGE_PX)), { raw: { width: W, height: H, channels: 1 } }).webp({ lossless: true, effort: 6 }),
);
const SW = W / 4;
const SH = Math.floor(H / 4);
await save(
  'sea.webp',
  sharp(gray(downsample(coast1, W, H, 4), (v) => -v / SEA_RANGE_PX), { raw: { width: SW, height: SH, channels: 1 } }).webp({ quality: 90 }),
);

const HW = W / 2;
const HH = H / 2;
await save(
  'height.webp',
  sharp(gray(downsample(height1, W, H, 2), (v) => v), { raw: { width: HW, height: HH, channels: 1 } }).webp({ quality: 92, effort: 6 }),
);
await save(
  'depth.webp',
  sharp(gray(downsample(depth1, W, H, 4), (v) => v), { raw: { width: SW, height: SH, channels: 1 } }).webp({ quality: 80, effort: 6 }),
);
await save('shade.webp', sharp(gray(shade1, (v) => v), { raw: { width: W, height: H, channels: 1 } }).webp({ quality: 82, effort: 6 }));
await save('albedo.webp', sharp(Buffer.from(albedo), { raw: { width: AW, height: AH, channels: 3 } }).webp({ quality: 86, effort: 6 }));

const fonts = await buildFonts(scenario, outDir);
Object.assign(sizes, fonts.sizes);

const { note: _note, customShapes: _custom, landLinks: _landLinks, ...scenarioOut } = scenario;
const pack: MapPack = {
  format: 1,
  scenario: { ...scenarioOut, links },
  world: { width: WORLD_W, height: Math.round(WORLD_H * 1000) / 1000, relief: RELIEF },
  projection: { kind: 'miller', lon0: LON0, latSouth: LAT_SOUTH, latNorth: Math.round(proj.latNorth * 1000) / 1000 },
  textures: {
    ids: { file: 'ids.png', width: W, height: H },
    edge: { file: 'edge.webp', width: W, height: H },
    coast: { file: 'coast.webp', width: W, height: H },
    sea: { file: 'sea.webp', width: SW, height: SH },
    height: { file: 'height.webp', width: HW, height: HH },
    depth: { file: 'depth.webp', width: SW, height: SH },
    albedo: { file: 'albedo.webp', width: AW, height: AH },
    shade: { file: 'shade.webp', width: W, height: H },
  },
  encoding: { edgeRange: EDGE_RANGE_PX * PX, coastRange: COAST_RANGE_PX * PX, seaRange: SEA_RANGE_PX * PX },
  indexCount,
  countries: packCountries,
  regions: packRegions,
  fonts: fonts.files,
  checks: { ids: fnv1a(idsRgb) },
};
const packJson = JSON.stringify(pack);
await writeFile(path.join(outDir, 'map.json'), packJson);
sizes['map.json'] = Buffer.byteLength(packJson);

if (debug) {
  const dbg = path.join(CACHE_DIR, 'debug', scenarioId);
  await mkdir(dbg, { recursive: true });
  await sharp(gray(height1, (v) => v), { raw: { width: W, height: H, channels: 1 } }).resize(2048).png().toFile(path.join(dbg, 'height.png'));
  await sharp(gray(shade1, (v) => v), { raw: { width: W, height: H, channels: 1 } }).resize(2048).png().toFile(path.join(dbg, 'shade.png'));
  await sharp(Buffer.from(albedo), { raw: { width: AW, height: AH, channels: 3 } }).png().toFile(path.join(dbg, 'albedo.png'));
  const lc = Buffer.alloc(AW * AH * 3);
  for (let i = 0; i < lc.length; i++) lc[i] = clamp8(landCover[i]);
  await sharp(lc, { raw: { width: AW, height: AH, channels: 3 } }).png().toFile(path.join(dbg, 'landcover.png'));
  const idc = Buffer.alloc(NPX * 3);
  for (let i = 0; i < NPX; i++) {
    const v = id1[i];
    const e = Math.min(1, edge1[i] / 6);
    const part = v >= 1 && v <= N;
    idc[i * 3] = v === 0 ? 20 : ((v * 67) % 200) * e + 40;
    idc[i * 3 + 1] = v === 0 ? 30 : part ? ((v * 131) % 200) * e + 40 : 60;
    idc[i * 3 + 2] = v === 0 ? 60 : ((v * 29) % 200) * e + 40;
  }
  for (const [x, y] of anchorPx) {
    for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
      const o = ((y + j) * W + x + i) * 3;
      if (o >= 0 && o < idc.length) idc[o] = idc[o + 1] = idc[o + 2] = 255;
    }
  }
  await sharp(idc, { raw: { width: W, height: H, channels: 3 } }).resize(2048).png().toFile(path.join(dbg, 'ids.png'));
}

const total = Object.values(sizes).reduce((s, v) => s + v, 0);
for (const [name, size] of Object.entries(sizes)) console.log(`  ${name.padEnd(22)} ${(size / 1024).toFixed(0).padStart(6)} KB`);
console.log(`  ${'total'.padEnd(22)} ${(total / 1024).toFixed(0).padStart(6)} KB`);
log(`done -> ${path.relative(process.cwd(), outDir)}`);
