// One-off authoring helper for the coldwar scenario pack: builds the custom historical polygons that
// cannot be made by merging present-day countries, and writes them to data/scenarios/coldwar/shapes.geojson.
// The result is committed with the scenario, so this only needs re-running if the definition changes.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RAW_DIR, SCENARIOS_DIR } from './paths.ts';

type Feature = { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } };

const admin1 = JSON.parse(
  await readFile(path.join(RAW_DIR, 'ne_10m_admin_1_states_provinces.geojson'), 'utf8'),
) as { features: Feature[] };

// East Germany = the five eastern states plus Berlin (all of Berlin, a simplification at this map scale).
const EAST = new Set(['DE-BB', 'DE-BE', 'DE-MV', 'DE-SN', 'DE-ST', 'DE-TH']);
const round = (v: unknown): unknown => (Array.isArray(v) ? v.map(round) : Math.round((v as number) * 1e4) / 1e4);

const polygons: unknown[] = [];
for (const f of admin1.features) {
  if (!EAST.has(f.properties.iso_3166_2 as string)) continue;
  const g = f.geometry;
  if (g.type === 'Polygon') polygons.push(round(g.coordinates));
  else if (g.type === 'MultiPolygon') polygons.push(...(round(g.coordinates) as unknown[]));
}
if (!polygons.length) throw new Error('no states matched');

const out = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'gdr',
        // Only pixels that belong to this parent shape are repainted, so the custom outline cannot leak past it.
        clip: 'adm0:DEU',
        source: 'Natural Earth 10m admin-1 v5.1.2: Brandenburg, Berlin, Mecklenburg-Vorpommern, Sachsen, Sachsen-Anhalt, Thüringen',
      },
      geometry: { type: 'MultiPolygon', coordinates: polygons },
    },
  ],
};
const file = path.join(SCENARIOS_DIR, 'coldwar', 'shapes.geojson');
await writeFile(file, JSON.stringify(out) + '\n');
console.log(`wrote ${file} (${polygons.length} polygons)`);
