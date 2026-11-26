// Reads the big source rasters (ETOPO elevation, Natural Earth II land cover) and resamples them
// into the map projection by area averaging. Results are cached in assets/cache/.
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fromFile } from 'geotiff';
import { CACHE_DIR, RAW_DIR } from './paths.ts';
import { type Projection, latToY } from './projection.ts';

type Grid = { width: number; height: number };

function cacheName(kind: string, p: Projection, g: Grid): string {
  return path.join(CACHE_DIR, `${kind}_${g.width}x${g.height}_${p.lon0}_${p.latSouth}.bin`);
}

/**
 * Accumulates a global equirectangular source (north-up, starting at 180W) into the target grid.
 * Every source pixel is added to the target pixel it falls in, so the result is a box filter.
 */
async function resample(
  file: string,
  channels: number,
  p: Projection,
  g: Grid,
  label: string,
): Promise<Float32Array> {
  const tiff = await fromFile(file);
  const image = await tiff.getImage();
  const sw = image.getWidth();
  const sh = image.getHeight();
  const colTo = new Int32Array(sw);
  for (let c = 0; c < sw; c++) {
    let lon = -180 + ((c + 0.5) / sw) * 360;
    if (lon < p.lon0) lon += 360;
    colTo[c] = Math.min(g.width - 1, Math.floor(((lon - p.lon0) / 360) * g.width));
  }
  const rowTo = new Int32Array(sh);
  for (let r = 0; r < sh; r++) {
    const lat = 90 - ((r + 0.5) / sh) * 180;
    const y = Math.floor(latToY(p, lat, g.height));
    rowTo[r] = y >= 0 && y < g.height ? y : -1;
  }
  const sum = new Float64Array(g.width * g.height * channels);
  const count = new Uint32Array(g.width * g.height);
  const CHUNK = 256;
  for (let r0 = 0; r0 < sh; r0 += CHUNK) {
    const r1 = Math.min(sh, r0 + CHUNK);
    let any = false;
    for (let r = r0; r < r1; r++) if (rowTo[r] >= 0) any = true;
    if (!any) continue;
    const data = (await image.readRasters({ window: [0, r0, sw, r1], interleave: true })) as unknown as ArrayLike<number>;
    for (let r = r0; r < r1; r++) {
      const ty = rowTo[r];
      if (ty < 0) continue;
      const src = (r - r0) * sw * channels;
      const dst = ty * g.width;
      for (let c = 0; c < sw; c++) {
        const t = dst + colTo[c];
        count[t]++;
        for (let k = 0; k < channels; k++) sum[t * channels + k] += data[src + c * channels + k];
      }
    }
    if ((r0 / CHUNK) % 8 === 0) process.stdout.write(`\r  ${label} ${((r1 / sh) * 100).toFixed(0)}%   `);
  }
  process.stdout.write(`\r  ${label} done      \n`);
  const out = new Float32Array(g.width * g.height * channels);
  for (let i = 0; i < count.length; i++) {
    const n = count[i] || 1;
    for (let k = 0; k < channels; k++) out[i * channels + k] = sum[i * channels + k] / n;
  }
  return out;
}

async function cached(kind: string, p: Projection, g: Grid, make: () => Promise<Float32Array>): Promise<Float32Array> {
  const file = cacheName(kind, p, g);
  if (existsSync(file)) {
    const buf = await readFile(file);
    return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4).slice();
  }
  const data = await make();
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(file, Buffer.from(data.buffer, data.byteOffset, data.byteLength));
  return data;
}

/** Elevation in metres (negative below sea level). */
export function loadElevation(p: Projection, g: Grid): Promise<Float32Array> {
  return cached('elevation', p, g, () =>
    resample(path.join(RAW_DIR, 'ETOPO_2022_v1_60s_N90W180_surface.tif'), 1, p, g, 'elevation'),
  );
}

/** Land cover colour, RGB 0..255 interleaved. */
export function loadLandCover(p: Projection, g: Grid): Promise<Float32Array> {
  return cached('landcover', p, g, () =>
    resample(path.join(RAW_DIR, 'NE2_LR_LC', 'NE2_LR_LC.tif'), 3, p, g, 'land cover'),
  );
}
