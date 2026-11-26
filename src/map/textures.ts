// Small tiling detail textures, generated at start-up instead of downloaded.
import * as THREE from 'three';

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function finish(canvas: HTMLCanvasElement): THREE.Texture {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 4;
  return t;
}

/**
 * Overlapping brush strokes. Each stroke carries one random value per channel, so sampling another
 * texture at "uv + stroke.rg" moves colour around in stroke-shaped pieces, which is what makes the
 * terrain look painted. B is a per-stroke tone.
 */
export function makeBrushTexture(size = 512): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = rng(20471);
  ctx.fillStyle = 'rgb(128,128,128)';
  ctx.fillRect(0, 0, size, size);
  const strokes = Math.round((size * size) / 95);
  for (let i = 0; i < strokes; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 14 + rand() * 40;
    const wid = 4 + rand() * 9;
    const ang = -0.45 + (rand() - 0.5) * 1.3;
    const v = (): number => Math.round(128 + (rand() - 0.5) * 2 * 100);
    ctx.fillStyle = `rgb(${v()},${v()},${v()})`;
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        if (x + ox < -80 || x + ox > size + 80 || y + oy < -80 || y + oy > size + 80) continue;
        ctx.beginPath();
        ctx.ellipse(x + ox, y + oy, len / 2, wid / 2, ang, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  return finish(canvas);
}

/** Three independent channels (R, G, B) of tiling fractal value noise, each at a different base frequency. */
export function makeNoiseTexture(size = 256): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const bases = [4, 8, 16];
  for (let c = 0; c < 3; c++) {
    const rand = rng(977 + c * 131);
    const octaves: { n: number; g: Float32Array; amp: number }[] = [];
    let amp = 1;
    for (let n = bases[c]; n <= size / 2 && octaves.length < 4; n *= 2) {
      const g = new Float32Array(n * n);
      for (let i = 0; i < g.length; i++) g[i] = rand();
      octaves.push({ n, g, amp });
      amp *= 0.5;
    }
    const total = octaves.reduce((s, o) => s + o.amp, 0);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let v = 0;
        for (const o of octaves) {
          const fx = (x / size) * o.n;
          const fy = (y / size) * o.n;
          const x0 = Math.floor(fx);
          const y0 = Math.floor(fy);
          const tx = fx - x0;
          const ty = fy - y0;
          const sx = tx * tx * (3 - 2 * tx);
          const sy = ty * ty * (3 - 2 * ty);
          const x1 = (x0 + 1) % o.n;
          const y1 = (y0 + 1) % o.n;
          const a = o.g[y0 * o.n + x0] * (1 - sx) + o.g[y0 * o.n + x1] * sx;
          const b = o.g[y1 * o.n + x0] * (1 - sx) + o.g[y1 * o.n + x1] * sx;
          v += (a * (1 - sy) + b * sy) * o.amp;
        }
        img.data[(y * size + x) * 4 + c] = Math.round((v / total) * 255);
      }
    }
  }
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;
  ctx.putImageData(img, 0, 0);
  return finish(canvas);
}
