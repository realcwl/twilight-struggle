import { attachHelpCaptions, type HelpCaptions } from '../i18n/help-captions.js';
import { t as i18n, text as displayText } from '../i18n/index.js';
import './coach.css';
import { cardFace, fitCard } from '../cards/deck';
import { TutorialComet } from './comet';

export interface CoachStep {
  id: string;
  chapter: string;
  title: string;
  /** Plain text; blank lines separate paragraphs. Never interpreted as HTML. */
  body: string;
  /** A short glyph, or one of: compass, eye, hand, card, flag, shield, dice, star. */
  icon?: string;
  /** An existing, same-origin /cards/help/*.mp4. Loaded only while this step is visible. */
  video?: string;
  /** Public card illustration for lessons such as the China Card. */
  card?: string;
  /** Document-wide CSS selectors, including dynamically mounted game controls. */
  targets?: string[];
  /** Click/drag permissions. show defaults to targets; explain/choose default to none. */
  allow?: string[];
  button?: string;
  progress?: string;
}

export interface CoachOption { id: string; label: string; icon?: string }
export interface CoachCallbacks { onExit?: () => void; onRestart?: () => void }

type Mode = 'explain' | 'action' | 'choose';
type Box = { x: number; y: number; width: number; height: number };
type Gesture = { target: Element; x: number; y: number; moved: boolean };
const SVG = 'http://www.w3.org/2000/svg';
const TERM = '[data-term], [data-country-ref], [data-card-ref], [data-card-history]';
const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex], [contenteditable="true"]';
let serial = 0;

const symbols: Record<string, string> = {
  compass: '✦', eye: '◎', hand: '↗', card: '▱', flag: '⚑', shield: '◇', dice: '⚄', star: '✧',
};
const glyph = (name?: string): string => symbols[name ?? 'compass'] ?? name ?? '✦';
const overlap = (a: Box, b: Box): number => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
const setAttr = (el: Element, key: string, value: string): void => {
  if (el.getAttribute(key) !== value) el.setAttribute(key, value);
};
const px = (n: number): string => `${Math.round(n)}px`;

/**
 * Presentation/input guard only: no engine state, decisions, storage or timers that advance play.
 *
 * await coach.explain(step);              // resolves on Next, then hides
 * coach.show({ ...step, allow: ['…'] });  // parent observes the real action and changes steps
 * const id = await coach.choose(step, [{ id: 'continue', label: '继续与电脑对战' }]);
 *
 * hide(), dispose(), exit/restart and replacement reject a pending explain/choose with AbortError.
 * Catch that error at the script boundary. show() is idempotent for identical content, so a parent
 * MutationObserver can safely call it repeatedly. Active drags survive show() replacements.
 * Selectors refer to actual DOM hit targets, not their rectangular holes. The existing hand's
 * paired .hd-hit is automatically admitted when its .hd-card is allowed. Missing targets remain
 * guarded, are retried each frame, and never hide Next/choices or the exit/restart controls.
 */
export class TutorialCoach {
  readonly root: HTMLElement;
  private readonly doc: Document;
  private readonly win: Window;
  private readonly panel: HTMLElement;
  private readonly chapter: HTMLElement;
  private readonly title: HTMLElement;
  private readonly body: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly emblem: HTMLElement;
  private readonly actions: HTMLElement;
  private readonly status: HTMLElement;
  private readonly exit: HTMLButtonElement;
  private readonly media: HTMLElement;
  private readonly card: HTMLElement;
  private readonly video: HTMLVideoElement;
  private readonly captions: HelpCaptions;
  private readonly playback: HTMLButtonElement;
  private readonly mask: SVGGElement;
  private readonly rings: SVGGElement;
  private readonly markers: HTMLElement;
  private readonly comet: TutorialComet;
  private readonly reduce: MediaQueryList;
  private readonly lifetime = new AbortController();
  private input: AbortController | null = null;
  private pending: { resolve: (value: string) => void; reject: (reason: DOMException) => void } | null = null;
  private step: CoachStep | null = null;
  private mode: Mode = 'action';
  private signature = '';
  private targets: Element[] = [];
  private allowed: Element[] = [];
  private help: Element | null = null;
  private readonly gestures = new Map<number, Gesture>();
  private tail: { until: number; moved: boolean } | null = null;
  private previousFocus: HTMLElement | null = null;
  private frame = 0;
  private disposed = false;
  private missingSince = 0;
  private videoEpoch = 0;
  private videoFailed = false;
  private source = '';
  private position = '';

  constructor(container: HTMLElement, callbacks: CoachCallbacks = {}) {
    this.doc = container.ownerDocument;
    this.win = this.doc.defaultView!;
    this.reduce = this.win.matchMedia('(prefers-reduced-motion: reduce)');
    const prefix = `tutorial-coach-${++serial}`;
    this.root = this.el('div', 'tutorial-coach');
    this.root.hidden = true;
    this.root.setAttribute('popover', 'manual');
    this.root.lang = document.documentElement.lang;
    const svg = this.doc.createElementNS(SVG, 'svg');
    svg.classList.add('tc-shade');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = displayText(`<defs><mask id="${prefix}-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%"><rect width="100%" height="100%" fill="white"/><g></g></mask></defs><rect width="100%" height="100%" fill="#080b0d" fill-opacity=".72" mask="url(#${prefix}-mask)"/><g class="tc-rings"></g>`);
    this.mask = svg.querySelector('mask g')!;
    this.rings = svg.querySelector('.tc-rings')!;
    this.markers = this.el('div', 'tc-markers');
    this.markers.setAttribute('aria-hidden', 'true');
    this.panel = this.el('section', 'tc-panel');
    this.panel.tabIndex = -1;
    this.panel.setAttribute('role', 'dialog');
    // This is intentionally non-modal: the highlighted game control is part of the interaction.
    this.panel.setAttribute('aria-labelledby', `${prefix}-title`);
    this.panel.setAttribute('aria-describedby', `${prefix}-body`);
    const top = this.el('div', 'tc-top');
    const label = this.el('span', 'tc-label', i18n("实战教学"));
    this.progress = this.el('span', 'tc-progress');
    const controls = this.el('div', 'tc-controls');
    if (callbacks.onRestart) {
      const restart = this.button('tc-control', '↺', i18n("重新开始教学"));
      restart.addEventListener('click', () => { this.hide(); callbacks.onRestart?.(); });
      controls.append(restart);
    }
    this.exit = this.button('tc-control tc-exit', '×', i18n("退出教学"));
    this.exit.addEventListener('click', () => { this.hide(); callbacks.onExit?.(); });
    controls.append(this.exit);
    top.append(label, this.progress, controls);
    const heading = this.el('header', 'tc-heading');
    this.emblem = this.el('span', 'tc-emblem');
    this.emblem.setAttribute('aria-hidden', 'true');
    const text = this.el('div');
    this.chapter = this.el('div', 'tc-chapter');
    this.title = this.el('h2');
    this.title.id = `${prefix}-title`;
    text.append(this.chapter, this.title);
    heading.append(this.emblem, text);
    this.body = this.el('div', 'tc-body');
    this.body.id = `${prefix}-body`;
    this.card = this.el('figure', 'tc-card');
    this.card.hidden = true;
    this.media = this.el('figure', 'tc-media');
    this.media.hidden = true;
    this.video = this.el('video');
    this.video.muted = true;
    this.video.defaultMuted = true;
    this.video.loop = true;
    this.video.playsInline = true;
    this.video.preload = 'none';
    this.video.setAttribute('playsinline', '');
    this.video.setAttribute('disablepictureinpicture', '');
    const caption = this.el('figcaption');
    caption.append(this.el('span', '', i18n("游戏画面演示")));
    this.playback = this.button('tc-playback', i18n("播放演示"));
    this.playback.addEventListener('click', () => {
      if (this.videoFailed) { this.videoFailed = false; this.video.load(); }
      if (this.video.paused) void this.playVideo();
      else { this.video.pause(); this.playback.textContent = i18n("继续播放"); }
    });
    caption.append(this.playback);
    const footage = this.el('div', 'tc-footage');
    footage.append(this.video);
    this.captions = attachHelpCaptions(footage, this.video);
    this.media.append(footage, caption);
    this.status = this.el('p', 'tc-status');
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');
    this.actions = this.el('div', 'tc-actions');
    this.panel.append(top, heading, this.body, this.card, this.media, this.status, this.actions);
    this.root.append(svg, this.markers, this.panel);
    this.comet = new TutorialComet(this.root);
    container.append(this.root);
    const opts = { signal: this.lifetime.signal };
    this.video.addEventListener('error', () => {
      if (!this.step || !this.source) return;
      this.videoFailed = true;
      this.playback.textContent = i18n("重试播放");
      this.media.dataset.error = 'true';
    }, opts);
    this.reduce.addEventListener('change', () => {
      if (this.reduce.matches) { this.video.pause(); this.playback.textContent = i18n("播放演示"); }
    }, opts);
    // Panel events must not reach the map or the game's bubbling keyboard shortcuts.
    for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'keydown', 'keyup', 'wheel', 'touchstart', 'touchmove', 'touchend']) {
      this.root.addEventListener(type, e => e.stopPropagation(), opts);
    }
  }

  async explain(step: CoachStep): Promise<void> {
    await this.prompt(step, 'explain', [{ id: 'next', label: step.button ?? i18n("下一步"), icon: '→' }]);
  }

  choose(step: CoachStep, options: CoachOption[]): Promise<string> {
    if (!options.length || new Set(options.map(o => o.id)).size !== options.length) {
      return Promise.reject(new TypeError('Tutorial choices need at least one option and unique ids.'));
    }
    return this.prompt(step, 'choose', options);
  }

  show(step: CoachStep): void { this.present(step, 'action', []); }

  /** Remove only tutorial UI/listeners. Pending prompts reject with AbortError. Idempotent. */
  hide(): void {
    const restoreFocus = this.root.contains(this.doc.activeElement);
    this.cancelPending();
    this.cancelGestures();
    this.step = null;
    this.signature = '';
    this.input?.abort(); this.input = null;
    this.win.cancelAnimationFrame(this.frame); this.frame = 0;
    this.stopVideo();
    this.comet.clear();
    try { if (this.root.matches(':popover-open')) this.root.hidePopover(); } catch { /* no Popover API */ }
    this.root.hidden = true;
    delete this.root.dataset.step;
    this.targets = []; this.allowed = []; this.help = null; this.tail = null;
    if (restoreFocus && this.previousFocus?.isConnected) {
      this.previousFocus.focus({ preventScroll: true });
    }
    this.previousFocus = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.hide();
    this.disposed = true;
    this.lifetime.abort(); this.captions.dispose();
    this.root.remove();
  }

  private prompt(step: CoachStep, mode: 'explain' | 'choose', options: CoachOption[]): Promise<string> {
    if (this.disposed) return Promise.reject(this.abortError());
    this.cancelPending();
    this.present(step, mode, options);
    return new Promise((resolve, reject) => { this.pending = { resolve, reject }; });
  }

  private present(step: CoachStep, mode: Mode, options: CoachOption[]): void {
    if (this.disposed) return;
    const signature = JSON.stringify([step, mode, options]);
    if (signature === this.signature) return;
    this.cancelPending();
    const entering = !this.step;
    if (entering) this.previousFocus = this.doc.activeElement instanceof HTMLElement ? this.doc.activeElement : null;
    this.signature = signature;
    this.comet.setCue(JSON.stringify([step.id, step.targets, step.allow]));
    this.step = { ...step, targets: [...(step.targets ?? [])], allow: step.allow ? [...step.allow] : undefined };
    this.mode = mode;
    this.missingSince = 0;
    this.position = '';
    this.root.dataset.step = step.id;
    this.root.dataset.mode = mode;
    this.progress.textContent = displayText(step.progress ?? '');
    this.chapter.textContent = displayText(step.chapter);
    this.title.textContent = displayText(step.title);
    this.emblem.textContent = displayText(glyph(step.icon));
    this.body.replaceChildren(...step.body.split(/\n\s*\n/).filter(Boolean).map(p => this.el('p', '', p)));
    this.card.replaceChildren();
    this.card.hidden = !step.card;
    if (step.card) {
      const face = cardFace(step.card);this.card.append(face);
      this.win.requestAnimationFrame(() => { if(face.isConnected)fitCard(face); });
    }
    this.actions.replaceChildren(...options.map((option, i) => {
      const b = this.button(i === 0 ? 'tc-choice tc-primary' : 'tc-choice', '');
      b.dataset.choice = option.id;
      const mark = this.el('span', 'tc-choice-icon', glyph(option.icon ?? (mode === 'explain' ? '→' : '◇')));
      mark.setAttribute('aria-hidden', 'true');
      b.append(this.el('span', '', option.label), mark);
      b.addEventListener('click', () => {
        const pending = this.pending;
        if (!pending) return;
        this.pending = null;
        this.hide();
        pending.resolve(option.id);
      });
      return b;
    }));
    this.root.hidden = false;
    try { if (!this.root.matches(':popover-open')) this.root.showPopover(); } catch { /* fixed-position fallback */ }
    this.setVideo(step.video);
    if (entering) this.listen();
    this.update();
    // A MutationObserver-driven show during a drag must not steal focus or cancel capture.
    if (!this.gestures.size) this.panel.focus({ preventScroll: true });
    if (!this.frame) this.frame = this.win.requestAnimationFrame(this.tick);
  }

  private readonly tick = (): void => {
    this.frame = 0;
    if (!this.step) return;
    this.update();
    this.frame = this.win.requestAnimationFrame(this.tick);
  };

  private select(selectors: string[]): Element[] {
    const nodes = new Set<Element>();
    for (const selector of selectors) {
      try {
        for (const el of this.doc.querySelectorAll(selector)) {
          if (!this.root.contains(el) && this.visible(el)) nodes.add(el);
        }
      } catch { /* A bad/temporarily unavailable selector never disables Next or Exit. */ }
    }
    return [...nodes];
  }

  private visible(el: Element): boolean {
    if (!el.isConnected || el.closest('[hidden], [inert]') || !el.getClientRects().length) return false;
    const style = this.win.getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
  }

  private resolveTargets(): void {
    if (!this.step) return;
    this.targets = this.select(this.step.targets ?? []);
    this.allowed = this.select(this.step.allow ?? (this.mode === 'action' ? this.step.targets ?? [] : []));
    // Hand visuals are pointer-events:none; their sibling hit surface owns pointer capture.
    for (const card of [...this.allowed]) {
      if (!card.matches('.hd-card[data-card]')) continue;
      const hit = [...(card.parentElement?.children ?? [])].find(el =>
        el.matches('.hd-hit') && el.getAttribute('data-card') === card.getAttribute('data-card'));
      if (hit) this.allowed.push(hit);
    }
  }

  private box(el: Element, pad = 7): Box | null {
    let r = el.getBoundingClientRect();
    // Map tokens are positioned by a zero-size anchor; their children draw the actual token.
    if ((!r.width || !r.height) && el.matches('.wm-plate')) {
      const body = el.querySelector('.wm-plate-body');
      if (body) {
        r = body.getBoundingClientRect();
        const name = el.querySelector('.wm-plate-name');
        if (name && this.visible(name)) {
          const n = name.getBoundingClientRect();
          const left=Math.min(r.left,n.left), top=Math.min(r.top,n.top);
          r=new DOMRect(left,top,Math.max(r.right,n.right)-left,Math.max(r.bottom,n.bottom)-top);
        }
      }
    }
    const w = this.win.innerWidth, h = this.win.innerHeight;
    if (r.width <= 0 || r.height <= 0 || r.right < 0 || r.bottom < 0 || r.left > w || r.top > h) return null;
    const x = Math.max(2, r.left - pad), y = Math.max(2, r.top - pad);
    return { x, y, width: Math.max(0, Math.min(w - 2, r.right + pad) - x), height: Math.max(0, Math.min(h - 2, r.bottom + pad) - y) };
  }

  private update(): void {
    if (!this.step) return;
    this.resolveTargets();
    const boxes = [...new Set([...this.targets, ...this.allowed.filter(el => !el.matches('.hd-hit'))])]
      .map(el => this.box(el)).filter((b): b is Box => !!b);
    while (this.mask.children.length > boxes.length) { this.mask.lastElementChild?.remove(); this.rings.lastElementChild?.remove(); this.markers.lastElementChild?.remove(); }
    for (let i = 0; i < boxes.length; i++) {
      if (!this.mask.children[i]) {
        const cut = this.doc.createElementNS(SVG, 'rect'); cut.setAttribute('fill', 'black'); cut.setAttribute('rx', '10');
        const ring = this.doc.createElementNS(SVG, 'rect'); ring.setAttribute('rx', '10');
        this.mask.append(cut); this.rings.append(ring);
        const marker = this.el('span', 'tc-marker');
        this.markers.append(marker);
      }
      const b = boxes[i];
      for (const key of ['x', 'y', 'width', 'height'] as const) {
        const value = String(Math.round(b[key] * 2) / 2);
        setAttr(this.mask.children[i], key, value); setAttr(this.rings.children[i], key, value);
      }
      const marker = this.markers.children[i] as HTMLElement;
      const mark = glyph(this.step.icon ?? (this.mode === 'action' ? 'hand' : 'eye'));
      if (marker.textContent !== mark) marker.textContent = displayText(mark);
      this.move(marker, Math.min(this.win.innerWidth - 32, b.x + b.width - 8), b.y >= 34 ? b.y - 32 : Math.min(this.win.innerHeight - 32, b.y + b.height + 4));
    }
    const wanted = this.step.allow ?? (this.mode === 'action' ? this.step.targets ?? [] : []);
    const missing = this.mode === 'action' && wanted.length > 0 && !this.allowed.some(el => this.box(el));
    if (missing && !this.missingSince) this.missingSince = performance.now();
    if (!missing) this.missingSince = 0;
    const message = missing ? (performance.now() - this.missingSince > 4000 ? i18n("操作目标尚未就绪，可重新开始或退出教学。") : i18n("正在准备这一步…"))
      : this.mode === 'action' ? (wanted.length ? i18n("按高亮提示操作，完成后自动继续") : i18n("观察局势变化，稍后继续")) : '';
    if (this.status.textContent !== message) this.status.textContent = displayText(message);
    if (this.status.hidden !== !message) this.status.hidden = !message;
    this.placePanel(boxes);
    this.comet.update(this.panel.getBoundingClientRect(), boxes, {
      reduced: this.reduce.matches,
      suspended: this.doc.hidden || this.gestures.size > 0 || !!this.help,
    });
  }

  private placePanel(boxes: Box[]): void {
    const w = this.win.innerWidth, h = this.win.innerHeight, gap = w < 600 ? 10 : 22;
    const size = this.panel.getBoundingClientRect();
    const right = Math.max(gap, w - size.width - gap), bottom = Math.max(gap, h - size.height - gap);
    const corners = [{ x: gap, y: gap }, { x: right, y: gap }, { x: gap, y: bottom }, { x: right, y: bottom }];
    const helpBox = this.help && this.visible(this.help) ? this.box(this.help, 12) : null;
    const obstacles = helpBox ? [...boxes, helpBox] : boxes;
    const score = (p: { x: number; y: number }): number => obstacles.reduce((n, b) => n + overlap({ ...p, width: size.width + 12, height: size.height + 12 }, b), 0);
    const ranked = corners.map(p => ({ ...p, score: score(p) })).sort((a, b) => a.score - b.score);
    let best = ranked[0];
    // An overview may highlight all four HUD corners; use the free centre in that case.
    if (best.score > 0) {
      const cx = (gap + right) / 2, cy = (gap + bottom) / 2;
      for (const p of [{ x: cx, y: cy }, { x: cx, y: gap }, { x: cx, y: bottom }, { x: gap, y: cy }, { x: right, y: cy }]) {
        const value = score(p);
        if (value < best.score) best = { ...p, score: value };
      }
    }
    // Keep the current clear corner while an animated card moves; avoid chasing the pointer.
    const old = corners.find(p => `${p.x},${p.y}` === this.position);
    if (old && score(old) <= best.score + 1) best = { ...old, score: score(old) };
    this.position = `${best.x},${best.y}`;
    this.move(this.panel, best.x, best.y);
  }

  private move(el: HTMLElement, x: number, y: number): void {
    if (el.style.left !== px(x)) el.style.left = px(x);
    if (el.style.top !== px(y)) el.style.top = px(y);
  }

  private listen(): void {
    this.input = new AbortController();
    const opts = { capture: true, passive: false, signal: this.input.signal };
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture', 'pointerover', 'pointerout', 'pointerenter', 'pointerleave', 'mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout', 'click', 'dblclick', 'contextmenu', 'wheel', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'dragstart', 'drop']) {
      this.win.addEventListener(type, this.guardPointer, opts);
    }
    this.win.addEventListener('keydown', this.guardKey, opts);
    this.win.addEventListener('keyup', this.guardKey, opts);
    this.win.addEventListener('keypress', this.guardKey, opts);
    this.win.addEventListener('focusin', this.guardFocus, opts);
    for (const type of ['keydown', 'keyup', 'keypress']) {
      this.doc.addEventListener(type, e => e.stopPropagation(), { signal: this.input.signal });
    }
    this.win.addEventListener('blur', () => { this.cancelGestures(); this.video.pause(); }, { signal: this.input.signal });
    this.doc.addEventListener('visibilitychange', () => { if (this.doc.hidden) { this.cancelGestures(); this.video.pause(); } }, { signal: this.input.signal });
    this.doc.addEventListener('card-term-open', e => {
      const trigger = (e as CustomEvent<{ trigger: Element }>).detail?.trigger;
      if (trigger && (this.contains([...this.targets, ...this.allowed], trigger) || this.help?.contains(trigger))) {
        this.help = this.doc.getElementById(trigger.getAttribute('aria-describedby') ?? 'card-term-help');
      }
    }, { signal: this.input.signal });
    this.doc.addEventListener('card-term-close', () => { this.help = null; }, { signal: this.input.signal });
  }

  private contains(nodes: Element[], target: EventTarget | null): boolean {
    return target instanceof Node && nodes.some(el => el === target || el.contains(target));
  }

  private isTerm(target: EventTarget | null): boolean {
    return target instanceof Element && !!target.closest(TERM) && this.contains([...this.targets, ...this.allowed], target);
  }

  private stop(e: Event): void { if (e.cancelable) e.preventDefault(); e.stopImmediatePropagation(); }

  private readonly guardPointer = (event: Event): void => {
    if (!this.step) return;
    const e = event as PointerEvent;
    const type = e.type, target = e.composedPath()[0] ?? e.target;
    const owned = this.gestures.get(e.pointerId);
    // Delivery of terminal events is independent of the current step or pointer position.
    if (owned && (type === 'pointerup' || type === 'pointercancel' || type === 'lostpointercapture')) {
      if (type === 'pointerup') this.tail = { until: performance.now() + 600, moved: owned.moved };
      this.gestures.delete(e.pointerId);
      return;
    }
    if (owned && type === 'pointermove') {
      owned.moved ||= Math.hypot(e.clientX - owned.x, e.clientY - owned.y) > 6;
      return;
    }
    const tail = this.tail && this.tail.until > performance.now() ? this.tail : null;
    // A drop over Exit/a different game button must finish the drag, not click that button.
    if (type === 'click' && tail?.moved) { this.tail = null; this.stop(e); return; }
    if (['mouseup', 'touchend', 'touchcancel'].includes(type) && (tail || this.gestures.size)) return;
    if (['mousemove', 'touchmove'].includes(type) && this.gestures.size) return;
    if (target instanceof Element && target.closest('.language-switcher')) return;
    if (target instanceof Node && this.root.contains(target)) return;
    if (target instanceof Node && this.help?.contains(target) && this.visible(this.help)) return;
    this.resolveTargets();
    const allowed = this.contains(this.allowed, target);
    const hover = ['pointermove', 'pointerover', 'pointerout', 'pointerenter', 'pointerleave', 'mousemove', 'mouseover', 'mouseout'].includes(type);
    if (hover && this.contains([...this.targets, ...this.allowed], target)) return;
    if (this.isTerm(target) && type !== 'contextmenu' && type !== 'dragstart') return;
    if (allowed && !['contextmenu', 'dragstart', 'drop'].includes(type)) {
      if (type === 'pointerdown') {
        if (e.button !== 0 || this.gestures.size) { this.stop(e); return; }
        this.tail = null;
        this.gestures.set(e.pointerId, { target: target as Element, x: e.clientX, y: e.clientY, moved: false });
      }
      return;
    }
    this.stop(e);
  };

  private readonly guardKey = (event: Event): void => {
    const e = event as KeyboardEvent;
    if (!this.step) return;
    this.resolveTargets();
    const target = e.target;
    if (target instanceof Element && target.closest('.language-switcher') && e.key !== 'Tab') return;
    if (e.key === 'Tab') {
      this.stop(e);
      if (e.type === 'keydown') {
        const stops = this.focusStops();
        const at = stops.indexOf(this.doc.activeElement as HTMLElement);
        const i = e.shiftKey ? (at <= 0 ? stops.length - 1 : at - 1) : (at + 1) % stops.length;
        (stops[i] ?? this.panel).focus({ preventScroll: true });
      }
      return;
    }
    if (e.key === 'Escape') {
      if (this.help && this.visible(this.help)) return; // existing help owns Escape
      this.stop(e);
      if (e.type === 'keydown') {
        if (this.gestures.size) this.cancelGestures();
        else this.exit.focus({ preventScroll: true });
      }
      return;
    }
    const permitted = target instanceof Element && (this.root.contains(target) || this.help?.contains(target) || this.contains(this.allowed, target) || this.isTerm(target));
    const textInput = target instanceof Element && target.matches('input, textarea, select, [contenteditable="true"]');
    const activation = ['Enter', ' ', 'Spacebar'].includes(e.key);
    if (permitted && ((!e.metaKey && !e.ctrlKey && !e.altKey && activation) || textInput)) return;
    // In particular, Z/X/C/V, Shift-map mode and unrelated menu hotkeys never reach the game.
    this.stop(e);
  };

  private focusStops(): HTMLElement[] {
    const nodes = new Set<HTMLElement>();
    const collect = (el: Element): void => {
      if (el instanceof HTMLElement && el.matches(FOCUSABLE)) nodes.add(el);
      el.querySelectorAll<HTMLElement>(FOCUSABLE).forEach(n => nodes.add(n));
    };
    collect(this.panel);
    const languages = this.doc.querySelector('.language-switcher');
    if (languages) collect(languages);
    this.allowed.forEach(collect);
    for (const target of this.targets) target.querySelectorAll<HTMLElement>(TERM).forEach(el => nodes.add(el));
    if (this.help && this.visible(this.help)) collect(this.help);
    return [...nodes].filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && this.visible(el) && !!this.box(el, 0));
  }

  private readonly guardFocus = (e: Event): void => {
    if (!this.step || !(e.target instanceof Node)) return;
    if (e.target instanceof Element && e.target.closest('.language-switcher')) return;
    if (this.root.contains(e.target) || this.help?.contains(e.target) || this.contains(this.allowed, e.target) || this.isTerm(e.target)) return;
    e.stopImmediatePropagation();
    this.panel.focus({ preventScroll: true });
  };

  private cancelGestures(): void {
    for (const [pointerId, gesture] of [...this.gestures]) {
      // The real game's cancellation handler releases its own capture and visual drag state.
      gesture.target.dispatchEvent(new PointerEvent('pointercancel', { pointerId, bubbles: true, composed: true }));
      this.gestures.delete(pointerId);
    }
    this.tail = null;
  }

  private setVideo(path?: string): void {
    let url: URL | null = null;
    if (path) {
      try {
        const candidate = new URL(path, this.doc.baseURI);
        if (candidate.origin === this.win.location.origin && /\/cards\/help\/[^/]+\.mp4$/.test(candidate.pathname)) url = candidate;
      } catch { /* Keep the authored text and navigation available. */ }
    }
    if (url?.href === this.source) return;
    this.stopVideo();
    this.media.hidden = !url;
    if (!url) return;
    this.source = url.href;
    this.captions.set(url.pathname.split('/').pop()!.replace(/\.mp4$/, ''), displayText(this.step?.title ?? '')); 
    this.video.src = url.href;
    this.video.poster = url.href.replace(/\.mp4(?=\?|$)/, '.webp');
    this.video.setAttribute('aria-label', i18n("{0} · 游戏画面演示，文字说明见上方", [this.step?.title ?? '']));
    this.video.preload = 'metadata';
    this.playback.textContent = i18n("播放演示");
    if (!this.reduce.matches) void this.playVideo();
  }

  private async playVideo(): Promise<void> {
    if (!this.step || !this.source) return;
    const epoch = ++this.videoEpoch;
    try {
      await this.video.play();
      if (epoch === this.videoEpoch && this.step) {
        this.playback.textContent = i18n("暂停");
        delete this.media.dataset.error;
      }
    } catch { if (epoch === this.videoEpoch) this.playback.textContent = i18n("播放演示"); }
  }

  private stopVideo(): void {
    this.videoEpoch++;
    this.video.pause();
    if (this.source) { this.video.removeAttribute('src'); this.video.removeAttribute('poster'); this.video.load(); }
    this.source = ''; this.videoFailed = false;
    delete this.media.dataset.error;
    this.media.hidden = true;
  }

  private abortError(): DOMException { return new DOMException('Tutorial prompt cancelled', 'AbortError'); }
  private cancelPending(): void {
    const pending = this.pending;
    this.pending = null;
    pending?.reject(this.abortError());
  }

  private el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
    const el = this.doc.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = displayText(text);
    return el;
  }

  private button(cls: string, text: string, label?: string): HTMLButtonElement {
    const el = this.el('button', cls, text);
    el.type = 'button';
    if (label) { el.setAttribute('aria-label', label); el.title = displayText(label); }
    return el;
  }
}
