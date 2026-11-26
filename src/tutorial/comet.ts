import { text as displayText } from '../i18n/index.js';
type Box = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };
type Flight = { start: Point; end: Point; control: Point; at: number; duration: number };
const NS = 'http://www.w3.org/2000/svg';
let serial = 0;
const centre = (r: Box): Point => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
const edge = (r: Box, toward: Point): Point => {
  const c = centre(r), dx = toward.x - c.x, dy = toward.y - c.y;
  const scale = 1 / Math.max(Math.abs(dx) / Math.max(1, r.width / 2), Math.abs(dy) / Math.max(1, r.height / 2), .001);
  return { x: c.x + dx * scale, y: c.y + dy * scale };
};
const onCurve = (f: Flight, t: number): Point => ({
  x: (1-t)**2*f.start.x + 2*(1-t)*t*f.control.x + t*t*f.end.x,
  y: (1-t)**2*f.start.y + 2*(1-t)*t*f.control.y + t*t*f.end.y,
});
const smooth = (t: number) => t*t*(3-2*t);
const n = (v: number) => v.toFixed(2);

/** One visual cue per target, driven by the coach's existing frame loop. No input or game state. */
export class TutorialComet {
  private readonly svg: SVGSVGElement;
  private readonly gradient: SVGLinearGradientElement;
  private readonly tails: SVGPathElement[];
  private readonly head: SVGGElement;
  private readonly arrival: SVGCircleElement;
  private cue = '';
  private geometry = '';
  private stableAt = 0;
  private readyAt = 0;
  private index = 0;
  private flight: Flight | null = null;

  constructor(root: HTMLElement) {
    const id = `tc-comet-${++serial}`;
    this.svg = root.ownerDocument.createElementNS(NS, 'svg');
    this.svg.classList.add('tc-comet');this.svg.setAttribute('aria-hidden', 'true');
    this.svg.innerHTML = displayText(`<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#bd8129" stop-opacity="0"/><stop offset=".48" stop-color="#e6ad4c" stop-opacity=".5"/><stop offset="1" stop-color="#fff0bd"/></linearGradient></defs><g class="tc-comet-tail"><path class="tc-comet-haze" stroke="url(#${id})"/><path class="tc-comet-thread" stroke="url(#${id})"/></g><g class="tc-comet-head"><ellipse rx="9" ry="4" fill="#f1bf67" opacity=".25"/><path d="M-8 0 -2 -1.4 0 -4 1.8 -1.4 5 0 1.8 1.4 0 4 -2 1.4Z" fill="#ffe6aa"/><circle r="2.3" fill="#fffbea"/></g><circle class="tc-comet-arrival" fill="none" stroke="#ffe2a2" stroke-width="1.5"/>`);
    this.gradient = this.svg.querySelector('linearGradient')!;
    this.tails = [...this.svg.querySelectorAll<SVGPathElement>('.tc-comet-tail path')];
    this.head = this.svg.querySelector('.tc-comet-head')!;
    this.arrival = this.svg.querySelector('.tc-comet-arrival')!;
    this.svg.style.display = 'none';root.append(this.svg);
  }

  setCue(key: string): void {
    if (key === this.cue) return;
    this.clear();this.cue = key;this.readyAt = performance.now() + 420;
  }

  clear(): void {
    this.cue = '';this.geometry = '';this.index = 0;this.flight = null;
    this.svg.style.display = 'none';delete this.svg.dataset.phase;
  }

  update(panel: DOMRect, boxes: Box[], options: { reduced: boolean; suspended: boolean }): void {
    if (!this.cue) return;
    if (options.reduced) {
      this.index = boxes.length;this.flight = null;this.svg.style.display = 'none';return;
    }
    const now = performance.now();
    if (options.suspended) {
      this.flight = null;this.geometry = '';this.readyAt = now + 420;this.svg.style.display = 'none';return;
    }
    if (this.index >= boxes.length) { this.svg.style.display = 'none';return; }
    const target = boxes[this.index];
    const geometry = [panel.x,panel.y,panel.width,panel.height,target.x,target.y,target.width,target.height].map(v => Math.round(v/3)).join(',');
    // Wait for the panel entrance, camera pan and enlarged hand to settle. Resize cancels stale paths.
    if (geometry !== this.geometry) {
      this.geometry = geometry;this.stableAt = now;this.flight = null;this.svg.style.display = 'none';
    }
    if (!this.flight) {
      if (now < this.readyAt || now - this.stableAt < 180) return;
      const start = edge(panel, centre(target)), end = edge(target, centre(panel));
      const dx = end.x-start.x, dy = end.y-start.y, distance = Math.hypot(dx,dy);
      if (distance < 36) { this.index++;this.geometry = '';return; }
      const bend = Math.min(76, distance*.12), sign = dx < 0 ? -1 : 1;
      const control = {
        x: Math.max(12, Math.min(innerWidth-12, (start.x+end.x)/2 + dy/distance*bend*sign)),
        y: Math.max(12, Math.min(innerHeight-12, (start.y+end.y)/2 - dx/distance*bend*sign)),
      };
      this.flight = { start, end, control, at: now, duration: Math.min(1150, Math.max(700, 430+distance*.6)) };
      this.svg.style.display = '';this.svg.dataset.target = String(this.index);
    }
    const f = this.flight, elapsed = now-f.at, t = Math.min(1, elapsed/f.duration);
    if (elapsed <= f.duration) {
      this.svg.dataset.phase = 'flight';
      const from = Math.max(0, t-.16), head = onCurve(f, smooth(t)), tail = onCurve(f, smooth(from));
      let d = '';
      for (let i=0;i<=12;i++) { const p=onCurve(f,smooth(from+(t-from)*i/12));d+=`${i?'L':'M'}${n(p.x)},${n(p.y)} `; }
      for (const path of this.tails) { path.setAttribute('d', d);path.style.opacity = String(Math.min(1,t*8)); }
      for (const [key,value] of Object.entries({x1:tail.x,y1:tail.y,x2:head.x,y2:head.y})) this.gradient.setAttribute(key,n(value));
      const ahead = onCurve(f, Math.min(1,smooth(t)+.005)), behind = onCurve(f, Math.max(0,smooth(t)-.005));
      const angle = Math.atan2(ahead.y-behind.y,ahead.x-behind.x)*180/Math.PI;
      this.head.setAttribute('transform',`translate(${n(head.x)} ${n(head.y)}) rotate(${n(angle)})`);
      this.head.style.opacity=String(Math.min(1,t*10));this.arrival.style.opacity='0';
    } else {
      this.svg.dataset.phase = 'arrival';
      const p = Math.min(1,(elapsed-f.duration)/480);
      for (const path of this.tails) path.style.opacity='0';
      this.head.style.opacity=String((1-p)**2);
      this.arrival.setAttribute('cx',n(f.end.x));this.arrival.setAttribute('cy',n(f.end.y));
      this.arrival.setAttribute('r',n(5+25*p));this.arrival.style.opacity=String(.85*(1-p)**2);
      if (p===1) {
        this.index++;this.flight=null;this.geometry='';this.readyAt=now+120;
        this.svg.style.display='none';delete this.svg.dataset.phase;
      }
    }
  }
}
