// Map camera: drag to pan, wheel to zoom around the cursor, pitch follows zoom (straight down when far,
// tilted when close). The map always fills the view. East and west it has no end: the world is a band
// that joins up with itself, so panning carries on round the globe. North and south it stops at the
// map's edge. The farthest zoom never takes in more than one turn of the band, so nothing shows twice,
// and it does not pan north or south at all: the overview only slides east and west.
import * as THREE from 'three';

type View = { x: number; z: number; d: number };
/** Fractions of the canvas left available by overlay panels. */
export type CameraViewport = { left: number; top: number; width: number; height: number };

const FOV = 28;
const PITCH_NEAR = (49 * Math.PI) / 180; // camera elevation above the ground when zoomed in
const PITCH_FAR = Math.PI / 2; // straight down when zoomed out, so the map rectangle matches the screen
const NEAREST = 22;
const DRAG_THRESHOLD = 4;
const EDGE = 0.03; // world units kept back from the map edge, against rounding
const OVERVIEW_LOCK = 0.88; // zoom (0..1) above which north-south panning closes down towards the overview

const smooth = (a: number, b: number, v: number): number => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 2000);
  /** True while the pointer is dragging the map. */
  dragging = false;
  /** Set when a pointer-down turned into a drag, so the following click is not treated as a selection. */
  dragged = false;
  private cur: View = { x: 0, z: 0, d: 200 };
  private goal: View = { x: 0, z: 0, d: 200 };
  private farthest = 200;
  private aspect = 1;
  private readonly tanHalf = Math.tan((FOV * Math.PI) / 360);
  private dirty = true;
  private sized = false;
  private down: { x: number; y: number; gx: number; gz: number; id: number } | null = null;
  private rect = { left: 0, top: 0, width: 1, height: 1 };

  constructor(
    private readonly dom: HTMLElement,
    private readonly world: { width: number; height: number },
  ) {
    dom.addEventListener('pointerdown', this.onDown);
    dom.addEventListener('pointermove', this.onMove);
    dom.addEventListener('pointerup', this.onUp);
    dom.addEventListener('pointercancel', this.onUp);
    dom.addEventListener('wheel', this.onWheel, { passive: false });
  }

  dispose(): void {
    this.dom.removeEventListener('pointerdown', this.onDown);
    this.dom.removeEventListener('pointermove', this.onMove);
    this.dom.removeEventListener('pointerup', this.onUp);
    this.dom.removeEventListener('pointercancel', this.onUp);
    this.dom.removeEventListener('wheel', this.onWheel);
  }

  resize(width: number, height: number): void {
    const r = this.dom.getBoundingClientRect();
    this.rect = { left: r.left, top: r.top, width, height };
    this.aspect = width / height;
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
    // Farthest zoom: looking straight down, the view is a rectangle; it grows until it touches the map's
    // edge on one axis. On a screen shaped like the map that is the whole world, edge to edge.
    const forWidth = (this.world.width - 2 * EDGE) / (2 * this.tanHalf * this.aspect);
    const forHeight = (this.world.height - 2 * EDGE) / (2 * this.tanHalf);
    // a view that was fully zoomed out stays fully zoomed out when the window changes shape
    const wasFarthest = !this.sized || this.goal.d >= this.farthest * 0.995;
    this.farthest = Math.max(NEAREST * 1.5, Math.min(forWidth, forHeight));
    if (wasFarthest) this.cur.d = this.goal.d = this.farthest;
    this.sized = true;
    this.goal = this.clamp(this.goal);
    this.cur = this.clamp(this.cur);
    this.dirty = true;
  }

  /** 0 at the closest zoom, 1 at the farthest. */
  zoomOf(d: number): number {
    return Math.log(d / NEAREST) / Math.log(this.farthest / NEAREST);
  }
  get zoom(): number {
    return this.zoomOf(this.cur.d);
  }
  /** 0 in the local view, 1 in the global view, smooth in between. */
  get globalness(): number {
    return smooth(0.5, 0.76, this.zoom);
  }
  get distance(): number {
    return this.cur.d;
  }
  /** World units per screen pixel at the centre of the view. */
  get unitsPerPixel(): number {
    return (2 * this.cur.d * this.tanHalf) / this.rect.height;
  }

  private pitchOf(d: number): number {
    return PITCH_NEAR + (PITCH_FAR - PITCH_NEAR) * smooth(0.08, 0.86, this.zoomOf(d));
  }

  /** Where the ray through a screen point meets the ground plane, for a given view. */
  private ground(v: View, nx: number, ny: number): { x: number; z: number } {
    const p = this.pitchOf(v.d);
    const sin = Math.sin(p);
    const cos = Math.cos(p);
    const cy = v.d * sin;
    const cz = v.z + v.d * cos;
    // forward (0,-sin,-cos), right (1,0,0), up (0,cos,-sin)
    const dx = nx * this.tanHalf * this.aspect;
    const dy = -sin + ny * this.tanHalf * cos;
    const dz = -cos - ny * this.tanHalf * sin;
    const t = dy < -1e-4 ? -cy / dy : 1e5;
    return { x: v.x + dx * t, z: cz + dz * t };
  }

  private ndc(clientX: number, clientY: number): [number, number] {
    return [
      ((clientX - this.rect.left) / this.rect.width) * 2 - 1,
      -(((clientY - this.rect.top) / this.rect.height) * 2 - 1),
    ];
  }

  /** Ground-plane point under a screen position, using the view as currently drawn. */
  groundAt(clientX: number, clientY: number): { x: number; z: number } {
    const [nx, ny] = this.ndc(clientX, clientY);
    return this.ground(this.cur, nx, ny);
  }

  /**
   * Keeps the ground footprint of the view between a north and a south limit. East-west is free.
   * Zoomed in, the limits are the map's edges. At the farthest zoom they are the edges of that view
   * itself, so the overview has one fixed framing and only slides east and west, even on a window
   * wider than the map, where the overview is not tall enough to reach the map's edges.
   */
  private clamp(v: View): View {
    const d = Math.min(this.farthest, Math.max(NEAREST, v.d));
    // tilted views see a trapezoid whose far edge lies further from the centre than its near edge
    const far = this.ground({ x: 0, z: 0, d }, 1, 1);
    const near = this.ground({ x: 0, z: 0, d }, 1, -1);
    const edge = this.world.height / 2 - EDGE;
    const overview = Math.min(edge, this.farthest * this.tanHalf); // half the height of the farthest view
    const limit = edge + (overview - edge) * smooth(OVERVIEW_LOCK, 1, this.zoomOf(d));
    const zMin = -limit - far.z;
    const zMax = limit - near.z;
    const z = zMin > zMax ? (zMin + zMax) / 2 : Math.min(zMax, Math.max(zMin, v.z));
    return { d, x: v.x, z };
  }

  /** The x of the copy of a world position that lies nearest the view centre (the world repeats east-west). */
  nearestX(x: number, from = this.cur.x): number {
    const w = this.world.width;
    return x - w * Math.round((x - from) / w);
  }

  /** x of the view centre, always within half a world width of zero. */
  get centerX(): number {
    return this.cur.x;
  }

  /** West and east limits of the ground the view takes in. */
  get spanX(): [number, number] {
    const far = this.ground(this.cur, 1, 1).x - this.cur.x;
    const near = this.ground(this.cur, 1, -1).x - this.cur.x;
    const half = Math.max(far, near);
    return [this.cur.x - half, this.cur.x + half];
  }

  /** Moves the view so a world-space box fits. `maxZoom` caps how far out it may go (0..1), `minDistance` how close. */
  flyToBox(box: [number, number, number, number], opts: { maxZoom?: number; minDistance?: number; instant?: boolean; viewport?: CameraViewport } = {}): void {
    const w = Math.max(1, box[2] - box[0]);
    const h = Math.max(1, box[3] - box[1]);
    if (opts.viewport) {
      const v = opts.viewport;
      const footprint = (d: number) => {
        const view = { x: 0, z: 0, d };
        const left = 2*v.left-1, right = 2*(v.left+v.width)-1;
        const top = 1-2*v.top, bottom = 1-2*(v.top+v.height);
        const tl = this.ground(view,left,top), tr = this.ground(view,right,top);
        const bl = this.ground(view,left,bottom), br = this.ground(view,right,bottom);
        return { l: Math.max(tl.x,bl.x), r: Math.min(tr.x,br.x), t: tl.z, b: bl.z };
      };
      let d = NEAREST;
      for (let i=0;i<12;i++) {
        const f = footprint(d);
        const scale = Math.max(w*1.15/Math.max(.1,f.r-f.l),h*1.15/Math.max(.1,f.b-f.t));
        d = Math.max(NEAREST,Math.min(this.farthest,d*scale));
      }
      const f = footprint(d);
      this.goal = this.clamp({ x: this.nearestX((box[0]+box[2]-f.l-f.r)/2), z: (box[1]+box[3]-f.t-f.b)/2, d });
      if (opts.instant) this.cur = { ...this.goal };
      this.dirty = true;
      return;
    }
    let d = NEAREST;
    // pitch depends on distance, so settle on a distance with a few fixed-point steps
    for (let i = 0; i < 6; i++) {
      const p = this.pitchOf(d);
      d = Math.max((w * 1.5) / (2 * this.tanHalf * this.aspect), (h * 1.7 * Math.sin(p)) / (2 * this.tanHalf));
      d = Math.min(this.farthest, Math.max(NEAREST, d));
    }
    if (opts.minDistance) d = Math.max(d, opts.minDistance);
    if (opts.maxZoom !== undefined) d = Math.min(d, NEAREST * Math.pow(this.farthest / NEAREST, opts.maxZoom));
    // go the short way round
    this.goal = this.clamp({ x: this.nearestX((box[0] + box[2]) / 2), z: (box[1] + box[3]) / 2 + h * 0.06, d });
    if (opts.instant) this.cur = { ...this.goal };
    this.dirty = true;
  }

  /** Eases the view centre to a point, keeping the zoom. */
  panTo(x: number, z: number): void {
    this.goal = this.clamp({ x: this.nearestX(x), z, d: this.goal.d });
    this.dirty = true;
  }

  /** Where the view is heading. Keep it to hand back to restore(). */
  get aim(): { x: number; z: number; d: number } {
    return { ...this.goal };
  }

  /** Sends the view back to a place it was aimed at before. */
  restore(aim: { x: number; z: number; d: number }): void {
    this.goal = this.clamp({ ...aim, x: this.nearestX(aim.x) });
    this.dirty = true;
  }

  flyHome(): void {
    this.goal = this.clamp({ x: this.nearestX(0), z: 0, d: this.farthest });
    this.dirty = true;
  }

  private onDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    const g = this.groundAt(e.clientX, e.clientY);
    this.down = { x: e.clientX, y: e.clientY, gx: g.x, gz: g.z, id: e.pointerId };
    this.dragged = false;
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.down || e.pointerId !== this.down.id) return;
    if (!this.dragging) {
      if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) < DRAG_THRESHOLD) return;
      this.dragging = true;
      this.dragged = true;
      this.dom.setPointerCapture(e.pointerId);
      this.dom.classList.add('dragging');
    }
    // keep the grabbed ground point under the cursor
    const g = this.groundAt(e.clientX, e.clientY);
    const next = this.clamp({ x: this.cur.x + this.down.gx - g.x, z: this.cur.z + this.down.gz - g.z, d: this.cur.d });
    this.cur = next;
    this.goal = { ...next, d: this.goal.d };
    this.dirty = true;
  };

  private onUp = (e: PointerEvent): void => {
    if (!this.down || e.pointerId !== this.down.id) return;
    this.down = null;
    if (this.dragging) {
      this.dragging = false;
      this.dom.classList.remove('dragging');
      if (this.dom.hasPointerCapture(e.pointerId)) this.dom.releasePointerCapture(e.pointerId);
    }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? 600 : 1;
    const delta = Math.max(-240, Math.min(240, e.deltaY * unit));
    const [nx, ny] = this.ndc(e.clientX, e.clientY);
    const before = this.ground(this.goal, nx, ny);
    const zoomed = this.clamp({ ...this.goal, d: this.goal.d * Math.exp(delta * 0.0016) });
    // keep the ground point under the cursor fixed while the distance changes
    const after = this.ground(zoomed, nx, ny);
    this.goal = this.clamp({ x: zoomed.x + before.x - after.x, z: zoomed.z + before.z - after.z, d: zoomed.d });
    this.dirty = true;
  };

  /** Eases towards the goal view and updates the camera. Returns true if the view changed. */
  update(dt: number): boolean {
    const k = 1 - Math.exp(-dt * 9);
    const dx = this.goal.x - this.cur.x;
    const dz = this.goal.z - this.cur.z;
    const dd = Math.log(this.goal.d / this.cur.d);
    if (Math.abs(dx) + Math.abs(dz) > 1e-4 || Math.abs(dd) > 1e-5) {
      this.cur.x += dx * k;
      this.cur.z += dz * k;
      this.cur.d *= Math.exp(dd * k);
      // the goal is inside the map, but the eased path towards it (pitch changes on the way) may not be
      this.cur = this.clamp(this.cur);
      this.dirty = true;
    }
    if (!this.dirty) return false;
    this.dirty = false;
    // Having gone once round, carry on from the matching place on the other side, so that positions stay
    // small however long the panning goes on. Everything that refers to the view moves with it.
    const turn = this.world.width * Math.round(this.cur.x / this.world.width);
    if (turn !== 0) {
      this.cur.x -= turn;
      this.goal.x -= turn;
      if (this.down) this.down.gx -= turn;
    }
    const p = this.pitchOf(this.cur.d);
    this.camera.position.set(this.cur.x, this.cur.d * Math.sin(p), this.cur.z + this.cur.d * Math.cos(p));
    this.camera.up.set(0, Math.cos(p), -Math.sin(p));
    this.camera.lookAt(this.cur.x, 0, this.cur.z);
    this.camera.near = Math.max(0.5, this.cur.d * 0.05);
    this.camera.far = this.cur.d * 6 + 400;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    return true;
  }
}
