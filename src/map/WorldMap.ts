// The map module. Give it a generated map pack and a container; drive it with setState().
//
//   const map = await WorldMap.create(container, '/maps/coldwar');
//   map.setState(state);
//   map.on('select', (target) => ...);
//   map.flyTo('fra');
import * as THREE from 'three';
import { CameraRig } from './cameraRig';
import { type CardTarget, InfoCard } from './infoCard';
import { RegionLabels } from './labels';
import { RegionLegend } from './legend';
import { areaBounds, areaMembers, countryAreas, scoringAreas } from './scoringAreas';
import { Links } from './links';
import { Motes } from './motes';
import { type LoadedPack, loadPack, sampleHeight, sampleId } from './pack';
import { Plates } from './plates';
import { PostFX } from './post';
import { el } from './strings';
import { type Terrain, createTerrain } from './terrain';
import { TerritoryState } from './territoryState';
import { makeBrushTexture, makeNoiseTexture } from './textures';
import { Vignettes } from './vignettes';
import type { HighlightKind, Lang, MapPack, MapState } from './types';
import './map.css';

export type MapTarget = CardTarget;
export type MapEventName = 'hover' | 'select' | 'pick';
type Handler = (target: MapTarget | null) => void;

/**
 * Countries the game is asking the player to choose among, or is pointing out. While an offer stands
 * it takes the place of the map's own focus and selection, and looks the same: the offered countries
 * are lit along their own borders and the rest step back; a single country standing up (`lift`) gets
 * the full treatment of a country in focus. Bare
 * land always answers as its country, and a click on an offered country is reported as 'pick'
 * instead of selecting it.
 */
export type MapOffer = {
  /** The countries that can be chosen. */
  ok: Iterable<string>;
  /** Countries whose land stands up: what has been chosen so far. */
  lift?: Iterable<string>;
  /** Countries that stay bright without being on offer, such as ones shown as barred. */
  keep?: Iterable<string>;
  /** false leaves the land alone and marks only the nodes. */
  land?: boolean;
};
/** Where the view is aimed. Opaque: read it from `view`, write it back to `view`. */
export type MapView = { x: number; z: number; d: number };

export type MapOptions = {
  lang?: Lang;
  /**
   * Shows the key to the region marks in the map's bottom-left corner. Off unless asked for: a page
   * with a HUD of its own decides where such a thing goes.
   */
  legend?: boolean;
  onProgress?: (done: number, total: number) => void;
};

export class WorldMap {
  readonly pack: MapPack;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  /** Geography and decoration can disappear together without changing their own visibility settings. */
  private readonly backdrop = new THREE.Group();
  private readonly rig: CameraRig;
  private readonly terrain: Terrain;
  private readonly territories: TerritoryState;
  private readonly plates: Plates;
  private readonly links: Links;
  private readonly vignettes: Vignettes;
  private readonly motes: Motes;
  private readonly labels: RegionLabels;
  private readonly card: InfoCard;
  private readonly legend: RegionLegend | null;
  private readonly post: PostFX;
  private readonly stage: HTMLDivElement;
  private readonly indexOf = new Map<string, number>();
  private readonly idOf: string[] = [];
  private readonly regionOf = new Map<string, string>();
  private readonly handlers: Record<MapEventName, Set<Handler>> = { hover: new Set(), select: new Set(), pick: new Set() };
  private offered: { ok: Set<string>; lift: Set<string>; keep: Set<string>; land: boolean } | null = null;
  private readonly observer: ResizeObserver;
  private state: MapState = { countries: {}, regions: {} };
  private lang: Lang;
  private hovered: MapTarget | null = null;
  private selected: MapTarget | null = null;
  private inspected: string | null = null;
  private inspectionView: MapView | null = null;
  private pointer: { x: number; y: number; target: EventTarget | null } | null = null;
  private pointerDirty = false;
  private width = 1;
  private height = 1;
  private raf = 0;
  private last = 0;
  private time = 0;
  private frameMs = 16.7;
  /** Multiplier on the pixel ratio; lowered when frames keep running long, so weak GPUs stay smooth. */
  private renderScale = 1;
  private slowFrames = 0;
  private disposed = false;
  private tactical = false;
  private readonly shiftKeys = new Set<string>();

  static async create(container: HTMLElement, packUrl: string, opts: MapOptions = {}): Promise<WorldMap> {
    THREE.ColorManagement.enabled = false;
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    if (!renderer.capabilities.isWebGL2) throw new Error('WebGL 2 is required');
    // All colours are authored as display values; the shaders do their own grading.
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    const loaded = await loadPack(packUrl, renderer.capabilities.getMaxAnisotropy(), opts.onProgress);
    return new WorldMap(container, renderer, loaded, opts.lang ?? 'zh', opts.legend ?? false);
  }

  private constructor(
    container: HTMLElement,
    renderer: THREE.WebGLRenderer,
    private readonly loaded: LoadedPack,
    lang: Lang,
    legend: boolean,
  ) {
    this.renderer = renderer;
    this.pack = loaded.pack;
    this.lang = lang;
    const { pack } = loaded;
    pack.countries.forEach((c, i) => {
      this.indexOf.set(c.id, c.index);
      this.idOf[c.index] = c.id;
      const region = pack.scenario.countries[i].region;
      if (region !== null) this.regionOf.set(c.id, region);
    });

    this.stage = el('div', 'wm-stage');
    this.stage.style.setProperty('--side-a', pack.scenario.sides[0].color);
    this.stage.style.setProperty('--side-b', pack.scenario.sides[1].color);
    this.stage.appendChild(renderer.domElement);
    container.appendChild(this.stage);

    this.territories = new TerritoryState(pack);
    this.terrain = createTerrain(loaded, this.territories.texture, makeBrushTexture(), makeNoiseTexture());
    this.backdrop.add(this.terrain.group);
    this.scene.add(this.backdrop);

    this.labels = new RegionLabels(pack);
    this.backdrop.add(this.labels.group);
    this.links = new Links(loaded, this.terrain.relief);
    this.scene.add(this.links.group);
    // country flavour: an ink drawing on the land, and something adrift over the country in focus
    this.vignettes = new Vignettes(loaded, this.terrain.uniforms, this.links.routes);
    this.backdrop.add(this.vignettes.group);
    this.motes = new Motes(loaded, this.terrain.relief);
    this.backdrop.add(this.motes.mesh);

    this.plates = new Plates(this.stage, loaded, this.terrain.relief);
    this.card = new InfoCard(this.stage, pack, (id) => this.links.neighboursOf(id), (id) => { this.select({ kind: 'region', id }); this.flyTo(id, { fit: true }); });
    this.legend = legend ? new RegionLegend(this.stage, pack.scenario) : null;
    this.post = new PostFX(renderer);
    this.rig = new CameraRig(this.stage, pack.world);

    this.setLanguage(lang);
    this.setState(this.state);

    this.stage.addEventListener('pointermove', this.onPointerMove);
    this.stage.addEventListener('pointerleave', this.onPointerLeave);
    this.stage.addEventListener('click', this.onClick);
    this.stage.addEventListener('dblclick', this.onDoubleClick);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp, true);
    window.addEventListener('blur', this.clearTactical);
    window.addEventListener('pagehide', this.clearTactical);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    document.addEventListener('focusin', this.onFocusIn);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.stage);
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }

  // ------------------------------------------------------------------ public interface

  setState(state: MapState): void {
    this.state = state;
    this.territories.setState(state);
    this.plates.setState(state);
    this.card.setState(state);
  }

  /** Read-only help uses the same public country situation that the map draws. */
  countryState(id: string) {
    const s = this.state.countries[id];
    return s && { influence: [...s.influence] as [number, number], controller: s.controller };
  }

  /** Temporary card-text focus; never changes selection, legal targets or game state. */
  inspectCountry(id: string | null): void {
    if (id && !this.indexOf.has(id)) return;
    this.inspected = id;
    if (id) {
      const node = this.stage.querySelector<HTMLElement>(`.wm-plate[data-id="${id}"]`);
      const r = node?.getBoundingClientRect();
      const frame = this.stage.getBoundingClientRect();
      if (!r || r.right < frame.left + 50 || r.left > frame.right - 50 || r.top < frame.top + 80 || r.bottom > frame.bottom - 180) {
        this.inspectionView ??= this.view;
        this.panTo(id);
      }
      this.stage.dataset.inspected = id;
    } else {
      if (this.inspectionView && !this.dragging) this.view = this.inspectionView;
      this.inspectionView = null;
      delete this.stage.dataset.inspected;
    }
    this.applyFocus();
  }

  /** Reserved for the rules engine: marks countries (for example legal targets of an action). */
  setHighlights(ids: string[], _kind: HighlightKind = 'target'): void {
    const indices = ids.map((id) => this.indexOf.get(id)).filter((i): i is number => i !== undefined);
    this.territories.setTargets(indices);
    this.plates.setTargets(new Set(ids));
  }

  on(event: MapEventName, handler: Handler): () => void {
    this.handlers[event].add(handler);
    return () => this.handlers[event].delete(handler);
  }

  /** Flies to a country or region. fit frames the whole scoring area; an unknown id returns home. */
  flyTo(id: string, opts: { fit?: boolean; viewport?: import('./cameraRig').CameraViewport } = {}): void {
    const country = this.pack.countries.find((c) => c.id === id);
    if (country) {
      this.rig.flyToBox(country.bbox, { maxZoom: 0.42, minDistance: 30 });
      return;
    }
    const bounds = areaBounds(this.pack, id);
    if (bounds) this.rig.flyToBox(bounds, opts.fit ? { viewport: opts.viewport } : { maxZoom: this.pack.regions.some(r => r.id === id) ? 0.47 : 0.62, viewport: opts.viewport });
    else this.rig.flyHome();
  }

  /** Puts countries on offer (see MapOffer), or takes the offer away with null. */
  offer(offer: MapOffer | null): void {
    if (offer && this.selected) this.select(null);
    this.offered = offer && { ok: new Set(offer.ok), lift: new Set(offer.lift ?? []), keep: new Set(offer.keep ?? []), land: offer.land !== false };
    this.applyFocus();
  }

  /** The country whose land is under a screen position. */
  landAt(clientX: number, clientY: number): string | null {
    return this.pickCountry(clientX, clientY);
  }

  /** Eases the view to a country's node without changing the zoom. */
  panTo(id: string, screenX = 0.5): void {
    const c = this.pack.countries.find((x) => x.id === id);
    if (c) this.rig.panTo(c.node[0] + (0.5 - screenX) * this.width * this.rig.unitsPerPixel * this.view.d / this.rig.distance, c.node[1]);
  }

  /**
   * Moves the view, pulling back if it has to, until the nodes of all these countries are in it.
   * With `viewport` (fractions of the map's box) they are fitted into that part of the screen instead.
   */
  frameCountries(ids: string[], pad = 9, viewport?: import('./cameraRig').CameraViewport): void {
    const nodes = this.pack.countries.filter((c) => ids.includes(c.id)).map((c) => c.node);
    if (!nodes.length) return;
    const xs = nodes.map((n) => this.rig.nearestX(n[0]));
    const zs = nodes.map((n) => n[1]);
    if (viewport) this.rig.flyToBox([Math.min(...xs) - pad, Math.min(...zs) - pad, Math.max(...xs) + pad, Math.max(...zs) + pad], { viewport });
    else this.rig.flyToBox([Math.min(...xs) - pad, Math.min(...zs) - pad, Math.max(...xs) + pad, Math.max(...zs) + pad * 1.6], { maxZoom: 1 });
  }

  /** Where the view is aimed. Assign an earlier value to send it back there. */
  get view(): MapView {
    return this.rig.aim;
  }
  set view(v: MapView) {
    this.rig.restore(v);
  }

  /** True while the player is dragging the map. */
  get dragging(): boolean {
    return this.rig.dragging;
  }

  /** Selects a country or region as if it had been clicked. */
  select(target: MapTarget | null): void {
    const same = target?.id === this.selected?.id && target?.kind === this.selected?.kind;
    this.selected = target;
    this.applyFocus();
    if (!same) for (const h of this.handlers.select) h(target);
  }

  get selection(): MapTarget | null {
    return this.selected;
  }

  get language(): Lang {
    return this.lang;
  }

  setLanguage(lang: Lang): void {
    this.lang = lang;
    this.plates.setLanguage(lang);
    this.labels.setLanguage(lang);
    this.card.setLanguage(lang);
    this.legend?.setLanguage(lang);
  }

  setTiltShift(enabled: boolean): void {
    this.post.enabled = enabled;
  }

  /** Country flavour (ink vignettes and drifting particles) on or off. Pure decoration. */
  setFlavor(enabled: boolean): void {
    this.vignettes.enabled = enabled;
    this.motes.setEnabled(enabled);
  }

  /** Live numbers for the sandbox readout. */
  get stats(): { fps: number; frameMs: number; renderScale: number; zoom: number; view: 'global' | 'local' } {
    return {
      fps: 1000 / this.frameMs,
      frameMs: this.frameMs,
      renderScale: this.renderScale,
      zoom: this.rig.zoom,
      view: this.rig.globalness > 0.5 ? 'global' : 'local',
    };
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.rig.dispose();
    this.vignettes.dispose();
    this.motes.dispose();
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKeyUp, true);
    window.removeEventListener('blur', this.clearTactical);
    window.removeEventListener('pagehide', this.clearTactical);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    document.removeEventListener('focusin', this.onFocusIn);
    this.renderer.dispose();
    this.stage.remove();
  }

  // ------------------------------------------------------------------ focus

  private applyFocus(): void {
    if (this.offered && !this.inspected) return this.applyOffer();
    const focus: MapTarget | null = this.inspected ? {kind:'country',id:this.inspected} : this.selected ?? this.hovered;
    if (!focus) {
      this.territories.setFocus(null);
      this.plates.setFocus(null, null);
      this.links.show(null);
      this.labels.setFocus(null);
    } else if (focus.kind === 'country') {
      const index = this.indexOf.get(focus.id)!;
      const near = this.links.neighboursOf(focus.id);
      // On the land only this country lights up. Its neighbours are shown by their nodes and links.
      this.territories.setFocus({ primary: [index], lifted: [index] });
      this.plates.setFocus(new Set([focus.id]), new Set(near.map((n) => n.id)), focus.id);
      this.links.show(focus.id);
      this.labels.setFocus(this.regionOf.get(focus.id) ?? null);
    } else {
      const members = areaMembers(this.pack.scenario, focus.id).map((c) => c.id);
      this.territories.setFocus({ primary: members.map((id) => this.indexOf.get(id)!), lifted: [] });
      this.plates.setFocus(new Set(members), null);
      this.links.show(null);
      const area = scoringAreas(this.pack.scenario).find(r => r.id === focus.id);
      this.labels.setFocus(area?.parentId ?? focus.id);
    }
    this.legend?.setFocus(focus ? (focus.kind === 'region' ? focus.id : this.regionOf.get(focus.id) ?? null) : null);
    const one = focus?.kind === 'country' ? focus.id : null;
    this.vignettes.setFocus(one ? this.indexOf.get(one)! : -1);
    this.motes.setFocus(one);
    this.card.show(this.inspected ? null : focus, this.selected !== null);
    if (focus && !this.selected && this.pointer) this.card.follow(this.pointer.x, this.pointer.y);
  }

  /** The focus while countries are on offer: they stay lit, and the one under the pointer stands up. */
  private applyOffer(): void {
    const o = this.offered!;
    const hov = this.hovered?.kind === 'country' ? this.hovered.id : null;
    const index = (ids: Iterable<string>): number[] => [...ids].map((id) => this.indexOf.get(id)).filter((i): i is number => i !== undefined);
    const up = [...new Set([...o.lift, ...(hov && o.ok.has(hov) ? [hov] : [])])];
    this.territories.setFocus({ primary: index(o.land ? [...o.ok, ...up] : up), lifted: index(up) });
    this.plates.setFocus(new Set([...o.ok, ...o.keep]), null, hov && (o.ok.has(hov) || o.keep.has(hov)) ? hov : null);
    this.links.show(null);
    this.labels.setFocus(null);
    this.legend?.setFocus(null);
    // one country standing up is shown the way the map shows a country in focus: lit along its own
    // borders, raised, with its drawing and whatever drifts over it
    const one = up.length === 1 ? up[0] : null;
    this.vignettes.setFocus(one ? this.indexOf.get(one) ?? -1 : -1);
    this.motes.setFocus(one);
    this.card.show(null, false);
  }

  // ------------------------------------------------------------------ picking

  /** The country under a screen position: ray against the terrain, then the index texture. */
  private pickCountry(clientX: number, clientY: number): string | null {
    // Hidden geography must not create invisible hover or action targets; the nodes still answer.
    if (this.tactical) return null;
    const base = this.rig.groundAt(clientX, clientY);
    const cam = this.rig.camera.position;
    // The ground is not flat: slide the hit point up the view ray until it sits on the terrain.
    let x = base.x;
    let z = base.z;
    for (let i = 0; i < 4 && cam.y > 0; i++) {
      const t = (sampleHeight(this.loaded, x, z) * this.terrain.relief) / cam.y;
      x = base.x + (cam.x - base.x) * t;
      z = base.z + (cam.z - base.z) * t;
    }
    return this.idOf[sampleId(this.loaded, x, z)] ?? null;
  }

  /**
   * What the pointer is on. A node is always its country, at any zoom. Bare terrain is the country in
   * the local view and the region in the global view. A row of the legend is its region.
   */
  private targetAt(clientX: number, clientY: number, eventTarget: EventTarget | null): MapTarget | null {
    if (eventTarget instanceof Element && eventTarget.closest('.wm-card')) return this.hovered;
    const listed = this.legend?.regionAt(eventTarget);
    if (listed !== undefined) return listed === null ? null : { kind: 'region', id: listed };
    const node = this.plates.countryAt(eventTarget);
    if (node) return { kind: 'country', id: node };
    const country = this.pickCountry(clientX, clientY);
    if (!country) return null;
    if (this.offered) return { kind: 'country', id: country };
    const region = this.regionOf.get(country);
    const area = countryAreas(this.pack.scenario, this.pack.scenario.countries.find(c => c.id === country)!).at(-1);
    return this.rig.globalness > 0.5 && region ? { kind: 'region', id: area?.id ?? region } : { kind: 'country', id: country };
  }

  private refreshHover(): void {
    if (!this.pointer || this.rig.dragging) return;
    const target = this.targetAt(this.pointer.x, this.pointer.y, this.pointer.target);
    this.stage.classList.toggle('hot', target !== null);
    if (target?.id !== this.hovered?.id || target?.kind !== this.hovered?.kind) {
      this.hovered = target;
      if (!this.selected) this.applyFocus();
      for (const h of this.handlers.hover) h(target);
    }
    this.card.follow(this.pointer.x, this.pointer.y);
  }

  // ------------------------------------------------------------------ input

  private onPointerMove = (e: PointerEvent): void => {
    this.pointer = { x: e.clientX, y: e.clientY, target: e.target };
    this.pointerDirty = true;
  };

  private onPointerLeave = (): void => {
    this.pointer = null;
    this.stage.classList.remove('hot');
    if (this.hovered) {
      this.hovered = null;
      if (!this.selected) this.applyFocus();
      for (const h of this.handlers.hover) h(null);
    }
  };

  private onClick = (e: MouseEvent): void => {
    if (this.rig.dragged) return;
    if (this.offered) {
      // a click answers the offer or does nothing; it never selects
      const id = this.plates.countryAt(e.target) ?? this.pickCountry(e.clientX, e.clientY);
      if (id && this.offered.ok.has(id)) for (const h of this.handlers.pick) h({ kind: 'country', id });
      return;
    }
    if (e.target instanceof Element && e.target.closest('.wm-card')) return;
    const target = this.targetAt(e.clientX, e.clientY, e.target);
    this.select(target);
    // ease the camera so the selection sits comfortably in view, without changing the zoom level
    if (target?.kind === 'country') {
      const c = this.pack.countries.find((x) => x.id === target.id)!;
      this.rig.panTo(c.node[0], c.node[1]);
    } else if (target) {
      const box = areaBounds(this.pack, target.id);
      if (box) this.rig.panTo((box[0] + box[2]) / 2, (box[1] + box[3]) / 2);
    }
  };

  private onDoubleClick = (e: MouseEvent): void => {
    const target = this.targetAt(e.clientX, e.clientY, e.target);
    if (target) this.flyTo(target.id);
  };

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Shift' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing && !this.editing(e.target) && !document.querySelector('dialog[open]')) {
      this.shiftKeys.add(e.code || e.key);
      this.setTactical(true);
    }
    if (e.key === 'Escape' && this.selected) this.select(null);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.key !== 'Shift') return;
    this.shiftKeys.delete(e.code || e.key);
    if (!this.shiftKeys.size) this.setTactical(false);
  };

  private editing(target: EventTarget | null): boolean {
    return target instanceof Element && !!target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
  }

  private onFocusIn = (e: FocusEvent): void => {
    if (this.editing(e.target)) this.clearTactical();
  };

  private onVisibilityChange = (): void => {
    if (document.hidden) this.clearTactical();
  };

  private clearTactical = (): void => {
    this.shiftKeys.clear();
    this.setTactical(false);
  };

  private setTactical(enabled: boolean): void {
    if (this.tactical === enabled) return;
    this.tactical = enabled;
    this.backdrop.visible = !enabled;
    this.renderer.setClearColor(enabled ? 0x111b23 : 0x000000);
    this.stage.classList.toggle('tactical', enabled);
    this.pointerDirty = true;
  }

  // ------------------------------------------------------------------ frame

  private resize(): void {
    const w = Math.max(1, this.stage.clientWidth);
    const h = Math.max(1, this.stage.clientHeight);
    this.width = w;
    this.height = h;
    const ratio = Math.min(window.devicePixelRatio || 1, 2) * this.renderScale;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h, ratio);
    this.links.setResolution(w, h);
    this.rig.resize(w, h);
  }

  private frame = (now: number): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, this.last ? (now - this.last) / 1000 : 0.016);
    if (this.last) {
      const ms = now - this.last;
      this.frameMs += (ms - this.frameMs) * 0.08;
      // Adaptive resolution: a run of frames slower than ~50 fps drops the render resolution one step.
      // It is not raised again within a session, which avoids hunting back and forth.
      if (this.time > 3 && ms < 200) {
        this.slowFrames = ms > 20 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 2);
        if (this.slowFrames > 40 && this.renderScale > 0.55) {
          this.renderScale = Math.max(0.5, this.renderScale * 0.84);
          this.slowFrames = 0;
          this.resize();
        }
      }
    }
    this.last = now;
    this.time += dt;

    const moved = this.rig.update(dt);
    if (moved || this.pointerDirty) {
      this.pointerDirty = false;
      this.refreshHover();
    }
    const focusMoving = this.territories.update(dt);
    const globalness = this.rig.globalness;
    this.links.update(dt, this.time, globalness, (this.selected ?? this.hovered) !== null);
    this.labels.update(globalness, (this.selected ?? this.hovered) !== null);
    if (moved || focusMoving) {
      this.plates.update(this.rig.camera, this.width, this.height, this.rig.zoom, globalness, (i) => this.territories.liftOf(i), this.terrain.lift, this.rig.unitsPerPixel, (x) => this.rig.nearestX(x));
    }
    this.vignettes.update(dt, this.rig.zoom, (i) => this.territories.liftOf(i));
    this.motes.update(dt, this.rig.camera, this.rig.unitsPerPixel, this.width, this.height, (x) => this.rig.nearestX(x));
    this.terrain.setDetail(this.rig.unitsPerPixel);
    const u = this.terrain.uniforms;
    u.uTime.value = this.time;
    u.uGlobal.value = globalness;
    u.uDim.value = this.territories.dim;
    // The world joins up with itself east-west. Where the view runs past the map's edge, the map is
    // drawn again beside itself; the view is never wider than the world, so no place shows twice.
    const [west, east] = this.rig.spanX;
    const half = this.pack.world.width / 2;
    const reach = 2; // raised ground and whatever stands on it can show a little beyond the flat footprint
    const repeats: number[] = [];
    if (west - reach < -half) repeats.push(-this.pack.world.width);
    if (east + reach > half) repeats.push(this.pack.world.width);
    this.post.render(this.scene, this.rig.camera, this.tactical ? 0 : 1 - globalness, repeats);
  };
}
