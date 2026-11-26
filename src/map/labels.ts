// Region names, lettered flat on the map like labels on a chart. Shown in the global view only;
// country names live on the nameplates.
import * as THREE from 'three';
import type { Lang, MapPack } from './types';

type Label = { id: string; mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; texture: THREE.CanvasTexture; height: number };

const INK = 'rgba(38, 26, 16, 0.94)';
const HALO = 'rgba(244, 234, 208, 0.82)';

export class RegionLabels {
  readonly group = new THREE.Group();
  private readonly labels: Label[] = [];
  private focus: string | null = null;
  private opacity = 0;

  constructor(private readonly pack: MapPack) {
    for (const r of pack.regions) {
      const canvas = document.createElement('canvas');
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.NoColorSpace;
      texture.anisotropy = 4;
      const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, opacity: 0 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(r.center[0], 1.6, r.center[1]);
      mesh.renderOrder = 20; // above the link network
      mesh.frustumCulled = false;
      const span = Math.min(r.bbox[2] - r.bbox[0], (r.bbox[3] - r.bbox[1]) * 2.2);
      const height = Math.min(6.2, Math.max(3.3, span * 0.085));
      this.labels.push({ id: r.id, mesh, material, texture, height });
      this.group.add(mesh);
    }
  }

  setLanguage(lang: Lang): void {
    for (const label of this.labels) {
      const region = this.pack.scenario.regions.find((r) => r.id === label.id)!;
      const main = region.name[lang];
      const sub = lang === 'zh' ? region.name.en.toUpperCase() : '';
      const canvas = label.texture.image as HTMLCanvasElement;
      const size = 96; // px height of the main line
      const ctx = canvas.getContext('2d')!;
      const mainFont = lang === 'zh' ? `700 ${size}px MapText, serif` : `700 ${size * 0.8}px MapDisplay, serif`;
      const subFont = `600 ${size * 0.3}px MapDisplay, serif`;
      const mainSpacing = lang === 'zh' ? size * 0.34 : size * 0.12;
      const subSpacing = size * 0.14;
      const measure = (font: string, text: string, spacing: number): number => {
        ctx.font = font;
        return ctx.measureText(text).width + spacing * Math.max(0, [...text].length - 1);
      };
      const w = Math.ceil(Math.max(measure(mainFont, lang === 'zh' ? main : main.toUpperCase(), mainSpacing), measure(subFont, sub, subSpacing)) + size * 0.8);
      const h = Math.ceil(size * (sub ? 1.95 : 1.5));
      canvas.width = w;
      canvas.height = h;
      const draw = (font: string, text: string, spacing: number, y: number, halo: number): void => {
        ctx.font = font;
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        let x = (w - measure(font, text, spacing)) / 2;
        for (const ch of text) {
          ctx.strokeStyle = HALO;
          ctx.lineWidth = halo;
          ctx.strokeText(ch, x, y);
          x += ctx.measureText(ch).width + spacing;
        }
        x = (w - measure(font, text, spacing)) / 2;
        for (const ch of text) {
          ctx.fillStyle = INK;
          ctx.fillText(ch, x, y);
          x += ctx.measureText(ch).width + spacing;
        }
      };
      ctx.clearRect(0, 0, w, h);
      draw(mainFont, lang === 'zh' ? main : main.toUpperCase(), mainSpacing, size * 0.78, size * 0.13);
      if (sub) draw(subFont, sub, subSpacing, size * 1.52, size * 0.07);
      label.texture.needsUpdate = true;
      const worldH = label.height * (h / size);
      label.mesh.scale.set((worldH * w) / h, worldH, 1);
    }
  }

  setFocus(regionId: string | null): void {
    this.focus = regionId;
  }

  /** Fades labels with the zoom level. Returns true if anything changed. */
  update(globalness: number, anyFocus: boolean): boolean {
    let changed = false;
    if (Math.abs(globalness - this.opacity) > 0.002) {
      this.opacity = globalness;
      changed = true;
    }
    for (const label of this.labels) {
      const emphasis = !anyFocus ? 0.62 : label.id === this.focus ? 0.95 : 0.25;
      const target = this.opacity * emphasis;
      if (Math.abs(label.material.opacity - target) > 0.002) {
        label.material.opacity += (target - label.material.opacity) * 0.25;
        changed = true;
      }
      label.mesh.visible = label.material.opacity > 0.01;
    }
    return changed;
  }
}
