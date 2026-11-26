import {withLocales} from '../i18n/index.js';
// Loads a generated map pack (public/maps/<scenario>/) into GPU textures plus the CPU copies needed for picking.
import * as THREE from 'three';
import type { MapPack, TextureInfo } from './types';

export type LoadedPack = {
  pack: MapPack;
  /** Territory index per texel (row-major, north first). */
  ids: Uint8Array;
  idSize: [number, number];
  /** Terrain height 0..1 per texel of the height texture. */
  heights: Float32Array;
  heightSize: [number, number];
  tex: {
    ids: THREE.DataTexture;
    edge: THREE.Texture;
    coast: THREE.Texture;
    sea: THREE.Texture;
    depth: THREE.Texture;
    height: THREE.Texture;
    albedo: THREE.Texture;
    shade: THREE.Texture;
  };
};

async function loadBitmap(url: string): Promise<ImageBitmap> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  // No colour management and no alpha premultiply: these images carry data, the bytes must arrive untouched.
  return createImageBitmap(await res.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
}

function readPixels(bitmap: ImageBitmap): Uint8ClampedArray {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
}

function imageTexture(bitmap: ImageBitmap, opts: { mip?: boolean; aniso?: number } = {}): THREE.Texture {
  const t = new THREE.Texture(bitmap as unknown as HTMLImageElement);
  t.flipY = false;
  t.premultiplyAlpha = false;
  t.colorSpace = THREE.NoColorSpace;
  // the map joins up with itself east-west, so sampling runs on across that edge
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = opts.mip ?? true;
  t.minFilter = t.generateMipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = opts.aniso ?? 1;
  t.needsUpdate = true;
  return t;
}

export async function loadPack(baseUrl: string, maxAnisotropy: number, onProgress?: (done: number, total: number) => void): Promise<LoadedPack> {
  const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  const missing = `No map pack at ${base} — generate it with "npm run mapgen -- <scenario>".`;
  const res = await fetch(base + 'map.json');
  if (!res.ok) throw new Error(missing);
  let pack: MapPack;
  try {
    pack = withLocales(await res.json()) as MapPack;
  } catch {
    // a dev server answers unknown paths with the HTML page, which is not a pack either
    throw new Error(missing);
  }
  if (pack.format !== 1) throw new Error(`unsupported map pack format ${pack.format}`);

  const names = Object.keys(pack.textures) as (keyof MapPack['textures'])[];
  let done = 0;
  const total = names.length + 2;
  const tick = (): void => onProgress?.(++done, total);
  const bitmaps = {} as Record<keyof MapPack['textures'], ImageBitmap>;
  const fonts = [
    new FontFace('MapDisplay', `url(${base + pack.fonts.display})`, { weight: '400 800' }),
    new FontFace('MapText', `url(${base + pack.fonts.text})`, { weight: '400 800' }),
  ];
  await Promise.all([
    ...names.map(async (name) => {
      const info: TextureInfo = pack.textures[name];
      const bitmap = await loadBitmap(base + info.file);
      if (bitmap.width !== info.width || bitmap.height !== info.height) throw new Error(`${info.file}: unexpected size`);
      bitmaps[name] = bitmap;
      tick();
    }),
    ...fonts.map(async (f) => {
      document.fonts.add(await f.load());
      tick();
    }),
  ]);

  // Territory indices: exact bytes, never filtered.
  const idPixels = readPixels(bitmaps.ids);
  const count = pack.textures.ids.width * pack.textures.ids.height;
  const ids = new Uint8Array(count);
  const rg = new Uint8Array(count * 2);
  let hash = 0x811c9dc5;
  for (let i = 0; i < count; i++) {
    const r = idPixels[i * 4];
    const g = idPixels[i * 4 + 1];
    ids[i] = r;
    rg[i * 2] = r;
    rg[i * 2 + 1] = g;
    hash = Math.imul(hash ^ r, 0x01000193);
    hash = Math.imul(hash ^ g, 0x01000193);
    hash = Math.imul(hash ^ idPixels[i * 4 + 2], 0x01000193);
  }
  if (hash >>> 0 !== pack.checks.ids) {
    throw new Error('territory index image was altered while decoding; picking would be wrong in this browser');
  }
  const idsTex = new THREE.DataTexture(rg, pack.textures.ids.width, pack.textures.ids.height, THREE.RGFormat, THREE.UnsignedByteType);
  idsTex.minFilter = idsTex.magFilter = THREE.NearestFilter;
  idsTex.generateMipmaps = false;
  idsTex.unpackAlignment = 1;
  idsTex.needsUpdate = true;

  const hPixels = readPixels(bitmaps.height);
  const hCount = pack.textures.height.width * pack.textures.height.height;
  const heights = new Float32Array(hCount);
  for (let i = 0; i < hCount; i++) heights[i] = hPixels[i * 4] / 255;

  const aniso = Math.min(8, maxAnisotropy);
  return {
    pack,
    ids,
    idSize: [pack.textures.ids.width, pack.textures.ids.height],
    heights,
    heightSize: [pack.textures.height.width, pack.textures.height.height],
    tex: {
      ids: idsTex,
      edge: imageTexture(bitmaps.edge, { aniso }),
      coast: imageTexture(bitmaps.coast, { aniso }),
      sea: imageTexture(bitmaps.sea, { mip: false }),
      depth: imageTexture(bitmaps.depth, { mip: false }),
      height: imageTexture(bitmaps.height, { mip: false }),
      albedo: imageTexture(bitmaps.albedo, { aniso }),
      shade: imageTexture(bitmaps.shade, { aniso }),
    },
  };
}

/** Brings an x that has gone round the world back onto the map (the map repeats east-west). */
export function wrapX(p: LoadedPack, x: number): number {
  const w = p.pack.world.width;
  return x - w * Math.floor((x + w / 2) / w);
}

/** Bilinear terrain height (0..1) at a world position. */
export function sampleHeight(p: LoadedPack, x: number, z: number): number {
  const [w, h] = p.heightSize;
  x = wrapX(p, x);
  const fx = Math.min(w - 1, Math.max(0, ((x + p.pack.world.width / 2) / p.pack.world.width) * w - 0.5));
  const fy = Math.min(h - 1, Math.max(0, ((z + p.pack.world.height / 2) / p.pack.world.height) * h - 0.5));
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const d = p.heights;
  return (d[y0 * w + x0] * (1 - tx) + d[y0 * w + x1] * tx) * (1 - ty) + (d[y1 * w + x0] * (1 - tx) + d[y1 * w + x1] * tx) * ty;
}

/** Territory index at a world position, 0 for water or beyond the map's north and south edges. */
export function sampleId(p: LoadedPack, x: number, z: number): number {
  const [w, h] = p.idSize;
  const px = Math.floor(((wrapX(p, x) + p.pack.world.width / 2) / p.pack.world.width) * w);
  const py = Math.floor(((z + p.pack.world.height / 2) / p.pack.world.height) * h);
  if (px < 0 || py < 0 || px >= w || py >= h) return 0;
  return p.ids[py * w + px];
}
