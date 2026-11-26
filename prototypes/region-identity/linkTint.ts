// Treatment 09: links inside a region drawn in that region's colour.
// The game draws every such link in one batch with one colour; here they are drawn again, one batch
// per region, and the game's own batch is hidden while this is on.
import * as THREE from 'three';
import { LineBatch } from '../../src/map/lineBatch';
import type { MapPack } from '../../src/map/types';
import { REGIONS } from './variants';

type Pair = { line: LineBatch; halo: LineBatch };

/** The parts of the game's link layer this reaches into. */
export type LinkInternals = {
  group: THREE.Group;
  groundPaths: Map<string, number[][]>;
  network: Record<string, { line: { mesh: THREE.Mesh }; halo: { mesh: THREE.Mesh } }>;
  recede: number;
};

export class LinkTint {
  private readonly pairs: Pair[] = [];
  private on = false;

  constructor(pack: MapPack, private readonly links: LinkInternals) {
    const regionOf = new Map(pack.scenario.countries.map((c) => [c.id, c.region]));
    for (const [id, region] of Object.entries(REGIONS)) {
      const paths: number[][] = [];
      for (const l of pack.scenario.links) {
        if (l.kind === 'regional' && regionOf.get(l.a) === id) paths.push(...(links.groundPaths.get([l.a, l.b].sort().join('|')) ?? []));
      }
      // a little lighter than the region colour: a thin line needs more light than a filled shape
      const color = new THREE.Color(region.color).lerp(new THREE.Color(0xffffff), 0.18).getHex();
      const pair = { halo: new LineBatch({ color: 0x1d140d }, 6), line: new LineBatch({ color }, 7) };
      pair.halo.setPaths(paths);
      pair.line.setPaths(paths);
      pair.halo.mesh.visible = pair.line.mesh.visible = false;
      links.group.add(pair.halo.mesh, pair.line.mesh);
      this.pairs.push(pair);
    }
  }

  setEnabled(on: boolean): void {
    if (on === this.on) return;
    this.on = on;
    for (const p of this.pairs) p.halo.mesh.visible = p.line.mesh.visible = on;
    const own = this.links.network.regional;
    own.line.mesh.visible = own.halo.mesh.visible = !on;
  }

  /** Follows the game's own styling of the network: thinner from far away, stepping back while something is in focus. */
  update(width: number, height: number, globalness: number): void {
    if (!this.on) return;
    const strength = 1 - 0.62 * this.links.recede;
    const w = 3.2 - 0.8 * globalness;
    for (const p of this.pairs) {
      p.line.setResolution(width, height);
      p.halo.setResolution(width, height);
      p.line.style(w, 0.96 * strength);
      p.halo.style(w + 2.6, 0.62 * strength);
    }
  }
}
