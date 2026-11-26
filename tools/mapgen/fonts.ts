// Subsets the label and UI typefaces down to the glyphs actually used: every character in the scenario
// plus every non-ASCII character that appears in the app source.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import subsetFont from 'subset-font';
import type { MapPack, ScenarioSource } from '../../src/map/types.ts';
import { RAW_DIR, ROOT } from './paths.ts';

async function sourceText(dir: string): Promise<string> {
  let out = '';
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out += await sourceText(full);
    else if (/\.(ts|html|css)$/.test(entry.name)) out += await readFile(full, 'utf8');
  }
  return out;
}

export async function buildFonts(
  scenario: ScenarioSource,
  outDir: string,
): Promise<{ files: MapPack['fonts']; sizes: Record<string, number> }> {
  const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('');
  const app = (await sourceText(path.join(ROOT, 'src'))) + (await readFile(path.join(ROOT, 'index.html'), 'utf8'));
  const used = new Set<string>([...ascii, ...JSON.stringify(scenario), ...app, ...'·—–…×→←↑↓★◆●○▲▼“”‘’']);
  const text = [...used].filter((ch) => ch >= ' ').join('');

  const sizes: Record<string, number> = {};
  const make = async (src: string, name: string, chars: string, axes: Record<string, unknown>): Promise<string> => {
    const font = await readFile(path.join(RAW_DIR, src));
    const out = await subsetFont(font, chars, { targetFormat: 'woff2', variationAxes: axes as never });
    await writeFile(path.join(outDir, name), out);
    sizes[name] = out.length;
    return name;
  };
  return {
    files: {
      display: await make('Cinzel-wght.ttf', 'display.woff2', ascii, { wght: { min: 400, max: 800 } }),
      text: await make('NotoSerifSC-wght.ttf', 'text.woff2', text, { wght: { min: 400, max: 800 } }),
    },
    sizes,
  };
}
