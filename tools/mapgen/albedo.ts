// Turns the Natural Earth II land-cover raster into the stylised base colour of the terrain.
// The source is a pale, realistic wash. Each pixel is re-coloured by example: a table pairs colours
// sampled from the source with the saturated, clearly separated colour we want for that kind of land,
// and pixels in between are blended by how close they are to each example.
import { gaussianBlur } from './raster.ts';

export type AlbedoInput = {
  width: number;
  height: number;
  landCover: Float32Array; // RGB 0..255
  coast: Float32Array; // signed distance, + on land
  relief: Float32Array; // terrain height 0..1
  elevation: Float32Array; // metres
  latitude: (y: number) => number;
};

type Rgb = [number, number, number];
const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// [source colour in Natural Earth II, target colour]
const EXAMPLES: [Rgb, Rgb][] = [
  [[137, 188, 145], hex('#4f9a47')], // rainforest
  [[150, 194, 152], hex('#5aa24a')], // rainforest edge
  [[164, 199, 173], hex('#5f9967')], // taiga
  [[172, 199, 177], hex('#6c9f6e')], // boreal forest
  [[179, 205, 167], hex('#86b452')], // temperate forest and farmland
  [[185, 209, 167], hex('#8fb954')], // farmland
  [[198, 214, 170], hex('#a5bd58')], // monsoon plains
  [[205, 217, 172], hex('#b1c05b')], // black-earth plains
  [[228, 226, 180], hex('#cdc66b')], // dry plains
  [[222, 209, 177], hex('#d8bb76')], // steppe
  [[217, 206, 172], hex('#cfb76f')], // mediterranean scrub
  [[237, 226, 191], hex('#e0c27a')], // sahel
  [[226, 212, 178], hex('#dcae74')], // red desert
  [[245, 242, 216], hex('#eed390')], // sand desert
  [[244, 233, 210], hex('#e8c684')], // sand desert, warmer
  [[228, 211, 197], hex('#d6b48d')], // rock desert
  [[218, 205, 185], hex('#d0b986')], // cold desert
  [[210, 216, 202], hex('#a9af89')], // tundra
  [[211, 220, 203], hex('#9cab7f')], // mountain forest
  [[218, 223, 225], hex('#c2c5b4')], // cold highland
  [[227, 235, 247], hex('#eef3f6')], // ice sheet
  [[246, 244, 242], hex('#f2f1ec')], // permanent snow
];
const SIGMA = 11;
const ROCK: Rgb = hex('#8f8472');
const SNOW: Rgb = hex('#f4f6f7');

const smooth = (a: number, b: number, v: number): number => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function paintAlbedo(input: AlbedoInput): Uint8Array {
  const { width: w, height: h } = input;
  const n = w * h;
  const src = input.landCover.slice();

  // Push land colour out over the water so nothing pale bleeds in at the coast when the texture is filtered.
  const known = new Uint8Array(n);
  for (let i = 0; i < n; i++) known[i] = input.coast[i] > 0.25 ? 1 : 0;
  for (let pass = 0; pass < 24; pass++) {
    const add: number[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (known[i]) continue;
        let r = 0, g = 0, b = 0, c = 0;
        for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
          if (j < 0 || j >= n || !known[j]) continue;
          r += src[j * 3];
          g += src[j * 3 + 1];
          b += src[j * 3 + 2];
          c++;
        }
        if (c) add.push(i, r / c, g / c, b / c);
      }
    }
    for (let k = 0; k < add.length; k += 4) {
      const i = add[k];
      src[i * 3] = add[k + 1];
      src[i * 3 + 1] = add[k + 2];
      src[i * 3 + 2] = add[k + 3];
      known[i] = 1;
    }
  }

  const broad = gaussianBlur(input.elevation, w, h, 10);
  const out = new Float32Array(n * 3);
  for (let y = 0; y < h; y++) {
    const lat = Math.abs(input.latitude(y));
    const snowline = 5300 - 58 * lat;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const r = src[i * 3], g = src[i * 3 + 1], b = src[i * 3 + 2];
      let tr = 0, tg = 0, tb = 0, tw = 0;
      for (const [s, t] of EXAMPLES) {
        const d2 = (r - s[0]) ** 2 + (g - s[1]) ** 2 + (b - s[2]) ** 2;
        const wgt = Math.exp(-d2 / (2 * SIGMA * SIGMA)) + 1e-12;
        tr += t[0] * wgt;
        tg += t[1] * wgt;
        tb += t[2] * wgt;
        tw += wgt;
      }
      let cr = tr / tw, cg = tg / tw, cb = tb / tw;
      // Bare rock on the high ground, snow on peaks that stand well above their surroundings.
      const e = input.elevation[i];
      const rock = 0.55 * smooth(0.42, 0.8, input.relief[i]);
      cr += (ROCK[0] - cr) * rock;
      cg += (ROCK[1] - cg) * rock;
      cb += (ROCK[2] - cb) * rock;
      const snow = smooth(snowline - 600, snowline + 500, e) * smooth(150, 900, e - broad[i]);
      cr += (SNOW[0] - cr) * snow;
      cg += (SNOW[1] - cg) * snow;
      cb += (SNOW[2] - cb) * snow;
      out[i * 3] = cr;
      out[i * 3 + 1] = cg;
      out[i * 3 + 2] = cb;
    }
  }

  // A light blur keeps colour areas broad and flat; the brush-stroke texture adds the detail back at runtime.
  const result = new Uint8Array(n * 3);
  const chan = new Float32Array(n);
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < n; i++) chan[i] = out[i * 3 + k];
    const blurred = gaussianBlur(chan, w, h, 1.1);
    for (let i = 0; i < n; i++) result[i * 3 + k] = Math.min(255, Math.max(0, Math.round(blurred[i])));
  }
  return result;
}
