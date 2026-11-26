// Downloads everything in assets/manifest.json into assets/raw/.
// sha256 of each file is recorded in assets/manifest.lock.json on first download and verified afterwards.
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import extract from 'extract-zip';
import { ASSETS_DIR, RAW_DIR } from './paths.ts';

type Source = { id: string; url: string; file: string; unzip?: string };

async function sha256(file: string): Promise<string> {
  const h = createHash('sha256');
  await pipeline(createReadStream(file), h);
  return h.digest('hex');
}

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const total = Number(res.headers.get('content-length') ?? 0);
  let got = 0;
  let last = Date.now();
  const tmp = dest + '.part';
  const body = Readable.fromWeb(res.body as never);
  body.on('data', (chunk: Buffer) => {
    got += chunk.length;
    if (Date.now() - last > 5000) {
      last = Date.now();
      const pct = total ? ` ${((got / total) * 100).toFixed(0)}%` : '';
      console.log(`    ${(got / 1e6).toFixed(0)} MB${pct}`);
    }
  });
  await pipeline(body, createWriteStream(tmp));
  await rename(tmp, dest);
}

const manifest = JSON.parse(await readFile(path.join(ASSETS_DIR, 'manifest.json'), 'utf8')) as { sources: Source[] };
const lockPath = path.join(ASSETS_DIR, 'manifest.lock.json');
const lock: Record<string, { sha256: string; bytes: number }> = existsSync(lockPath)
  ? JSON.parse(await readFile(lockPath, 'utf8'))
  : {};

await mkdir(RAW_DIR, { recursive: true });
const only = process.argv.slice(2);
let failed = false;
for (const src of manifest.sources) {
  if (only.length && !only.includes(src.id)) continue;
  const dest = path.join(RAW_DIR, src.file);
  if (!existsSync(dest)) {
    console.log(`fetch  ${src.id}`);
    await download(src.url, dest);
  }
  const hash = await sha256(dest);
  const bytes = (await stat(dest)).size;
  const known = lock[src.id];
  if (!known) {
    lock[src.id] = { sha256: hash, bytes };
    console.log(`lock   ${src.id}  ${(bytes / 1e6).toFixed(1)} MB  ${hash.slice(0, 12)}`);
  } else if (known.sha256 !== hash) {
    failed = true;
    console.error(`MISMATCH ${src.id}: expected ${known.sha256.slice(0, 12)}, got ${hash.slice(0, 12)}. Delete ${dest} and re-run, or update the lock if the upstream file legitimately changed.`);
  } else {
    console.log(`ok     ${src.id}  ${(bytes / 1e6).toFixed(1)} MB`);
  }
  if (src.unzip) {
    const dir = path.join(RAW_DIR, src.unzip);
    if (!existsSync(dir)) {
      console.log(`unzip  ${src.id}`);
      await extract(dest, { dir });
    }
  }
  await writeFile(lockPath, JSON.stringify(lock, null, 2) + '\n');
}
if (failed) process.exit(1);
