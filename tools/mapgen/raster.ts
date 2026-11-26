// Raster primitives: scanline polygon fill, exact Euclidean distance / feature transforms, blurs.

export type Ring = Float64Array; // x0,y0,x1,y1,...

/** Even-odd scanline fill. Calls span(y, x0, x1) for each run of covered pixel centres (x1 exclusive). */
export function fillPolygon(
  rings: Ring[],
  width: number,
  height: number,
  span: (y: number, x0: number, x1: number) => void,
): void {
  let minY = Infinity;
  let maxY = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  for (const r of rings) {
    for (let i = 0; i < r.length; i += 2) {
      if (r[i] < minX) minX = r[i];
      if (r[i] > maxX) maxX = r[i];
      if (r[i + 1] < minY) minY = r[i + 1];
      if (r[i + 1] > maxY) maxY = r[i + 1];
    }
  }
  if (maxX < 0 || minX > width || maxY < 0 || minY > height) return;
  const y0 = Math.max(0, Math.ceil(minY - 0.5));
  const y1 = Math.min(height - 1, Math.ceil(maxY - 0.5) - 1);
  if (y1 < y0) return;
  const rows: number[][] = Array.from({ length: y1 - y0 + 1 }, () => []);
  for (const r of rings) {
    const n = r.length / 2;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      let xa = r[i * 2];
      let ya = r[i * 2 + 1];
      let xb = r[j * 2];
      let yb = r[j * 2 + 1];
      if (ya === yb) continue;
      if (ya > yb) {
        [xa, xb] = [xb, xa];
        [ya, yb] = [yb, ya];
      }
      const s = Math.max(y0, Math.ceil(ya - 0.5));
      const e = Math.min(y1, Math.ceil(yb - 0.5) - 1);
      const slope = (xb - xa) / (yb - ya);
      for (let y = s; y <= e; y++) rows[y - y0].push(xa + (y + 0.5 - ya) * slope);
    }
  }
  for (let y = y0; y <= y1; y++) {
    const xs = rows[y - y0];
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const a = Math.max(0, Math.ceil(xs[i] - 0.5));
      const b = Math.min(width, Math.ceil(xs[i + 1] - 0.5));
      if (b > a) span(y, a, b);
    }
  }
}

const INF = 1e20;

/**
 * Exact squared Euclidean distance to the nearest site (Felzenszwalb & Huttenlocher).
 * With `track`, also returns the coordinates of that nearest site.
 * With `wrapX`, the raster joins up with itself left to right (a map of the whole globe), so the
 * nearest site may lie across that edge.
 */
export function distanceTransform(
  site: Uint8Array,
  width: number,
  height: number,
  track = false,
  wrapX = false,
): { d2: Float32Array; sx: Int16Array | null; sy: Int16Array | null } {
  const n = width * height;
  const d2 = new Float32Array(n);
  const colY = track ? new Int16Array(n) : null;
  // Pass 1, columns: the input is binary, so two sweeps find the nearest site in the column.
  for (let x = 0; x < width; x++) {
    let last = -1;
    for (let y = 0; y < height; y++) {
      const i = y * width + x;
      if (site[i]) last = y;
      if (last < 0) {
        d2[i] = INF;
        if (colY) colY[i] = -1;
      } else {
        const d = y - last;
        d2[i] = d * d;
        if (colY) colY[i] = last;
      }
    }
    last = -1;
    for (let y = height - 1; y >= 0; y--) {
      const i = y * width + x;
      if (site[i]) last = y;
      if (last >= 0) {
        const d = last - y;
        if (d * d < d2[i]) {
          d2[i] = d * d;
          if (colY) colY[i] = last;
        }
      }
    }
  }
  // Pass 2, rows: lower envelope of parabolas. A wrapped row is read with half a turn of itself
  // repeated on either side, which is as far as a nearest site can be.
  const sx = track ? new Int16Array(n) : null;
  const sy = track ? new Int16Array(n) : null;
  const pad = wrapX ? Math.ceil(width / 2) : 0;
  const span = width + 2 * pad;
  const f = new Float64Array(span);
  const v = new Int32Array(span);
  const z = new Float64Array(span + 1);
  const col = new Int32Array(span); // the column of the raster each position of the padded row reads
  for (let q = 0; q < span; q++) col[q] = (((q - pad) % width) + width) % width;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let q = 0; q < span; q++) f[q] = d2[row + col[q]];
    let k = -1;
    for (let q = 0; q < span; q++) {
      if (f[q] >= INF) continue;
      if (k < 0) {
        k = 0;
        v[0] = q;
        z[0] = -Infinity;
        z[1] = Infinity;
        continue;
      }
      let s: number;
      for (;;) {
        const p = v[k];
        s = (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p);
        if (s <= z[k] && k > 0) k--;
        else break;
      }
      if (s <= z[k]) {
        // q dominates the only remaining parabola
        v[0] = q;
        z[0] = -Infinity;
        z[1] = Infinity;
        k = 0;
      } else {
        k++;
        v[k] = q;
        z[k] = s;
        z[k + 1] = Infinity;
      }
    }
    if (k < 0) {
      for (let x = 0; x < width; x++) {
        d2[row + x] = INF;
        if (sx && sy) {
          sx[row + x] = -1;
          sy[row + x] = -1;
        }
      }
      continue;
    }
    let j = 0;
    for (let x = 0; x < width; x++) {
      const q = x + pad;
      while (z[j + 1] < q) j++;
      const p = v[j];
      d2[row + x] = (q - p) * (q - p) + f[p];
      if (sx && sy && colY) {
        sx[row + x] = col[p];
        sy[row + x] = colY[row + col[p]];
      }
    }
  }
  return { d2, sx, sy };
}

/**
 * Separable box blur repeated three times, which approximates a Gaussian of the given sigma. Edges clamp,
 * except that with `wrapX` the raster joins up with itself left to right.
 */
export function gaussianBlur(src: Float32Array, width: number, height: number, sigma: number, wrapX = false): Float32Array {
  if (sigma <= 0) return src.slice();
  const r = Math.max(1, Math.round(Math.sqrt((12 * sigma * sigma) / 3 + 1) / 2 - 0.5));
  let a = src.slice();
  let b = new Float32Array(src.length);
  for (let pass = 0; pass < 3; pass++) {
    boxBlurH(a, b, width, height, r, wrapX);
    boxBlurV(b, a, width, height, r);
  }
  return a;
}

function boxBlurH(src: Float32Array, dst: Float32Array, w: number, h: number, r: number, wrap: boolean): void {
  const norm = 1 / (2 * r + 1);
  const at = wrap ? (x: number): number => ((x % w) + w) % w : (x: number): number => Math.min(w - 1, Math.max(0, x));
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += src[row + at(i)];
    for (let x = 0; x < w; x++) {
      dst[row + x] = acc * norm;
      acc += src[row + at(x + r + 1)] - src[row + at(x - r)];
    }
  }
}

function boxBlurV(src: Float32Array, dst: Float32Array, w: number, h: number, r: number): void {
  const norm = 1 / (2 * r + 1);
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += src[Math.min(h - 1, Math.max(0, i)) * w + x];
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = acc * norm;
      acc += src[Math.min(h - 1, y + r + 1) * w + x] - src[Math.max(0, y - r) * w + x];
    }
  }
}

/** Box downsample by an integer factor. */
export function downsample(src: Float32Array, width: number, height: number, factor: number): Float32Array {
  const w = Math.floor(width / factor);
  const h = Math.floor(height / factor);
  const out = new Float32Array(w * h);
  const norm = 1 / (factor * factor);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let j = 0; j < factor; j++) {
        const row = (y * factor + j) * width + x * factor;
        for (let i = 0; i < factor; i++) acc += src[row + i];
      }
      out[y * w + x] = acc * norm;
    }
  }
  return out;
}

export function bilinear(src: Float32Array, width: number, height: number, x: number, y: number): number {
  const fx = Math.min(width - 1, Math.max(0, x));
  const fy = Math.min(height - 1, Math.max(0, y));
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const a = src[y0 * width + x0] * (1 - tx) + src[y0 * width + x1] * tx;
  const b = src[y1 * width + x0] * (1 - tx) + src[y1 * width + x1] * tx;
  return a * (1 - ty) + b * ty;
}

export function fnv1a(bytes: Uint8Array): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
