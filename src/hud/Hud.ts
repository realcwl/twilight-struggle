import { text as displayText } from '../i18n/index.js';
// The play screen's HUD: time and cards on the left, one shared status panel on the right.
//
//   top left      time: the turn, its era, the action round, whose move it is
//   top right     status: score, space race, nuclear crisis and military operations
//   bottom left   cards: the one on the table, the three piles, and the way to every card
//
// The opponent's hand hangs from the top edge and the player's fans out along the bottom.
//
//   const hud = Hud.create(container, { rules, sides, cards });
//   hud.setState(state);                 // HudState, see types.ts
//   hud.on('play', (card) => {});        // the player dragged a card out of the hand
//   hud.briefFor(map).setState(mapState, standings) // the country and region card, in place of the map's own
import type { WorldMap } from '../map/WorldMap';
import { CountryBrief } from './brief';
import { type Ctx, type Part, type PartFactory, type Rect, cardRectIn } from './dom';
import { fly } from './fly';
import { Hand } from './hand';
import { CardMotion } from './cardMotion';
import type { CardMove, Play } from '../play/types';
import { catalog, opponentHand, pile, table } from './parts/cards';
import { passives } from './parts/passives';
import { crisisGauge } from './parts/crisis';
import { milops } from './parts/milops';
import { scoreRead, scoreRule } from './parts/score';
import { spaceRace } from './parts/space';
import { bindStatusPanel, statusSummary } from './parts/status';
import { timeDial } from './parts/time';
import { openPileBrowser } from './pileBrowser';
import { HUD_STRINGS } from './strings';
import type { HudEvents, HudOptions, HudState, Lang, Pile, SideIndex } from './types';
import './hud.css';

const PARTS: Record<string, PartFactory> = {
  passives,
  dial: timeDial,
  scoreRead,
  scoreRule,
  space: spaceRace,
  statusSummary,
  table,
  catalog,
  deck: pile('deck'),
  discard: pile('discard'),
  removed: pile('removed'),
  crisis: crisisGauge,
  milops,
  opponent: opponentHand,
};

const LAYOUT = `
<i class="hud-dread"></i>
<div data-part="passives"></div>
<div class="hud-corner hud-tl hud-pane"><div data-part="dial"></div></div>
<div class="hud-corner hud-tr hud-pane"><div data-part="statusSummary"></div><div class="hud-status-detail" hidden><div class="hud-score"><div data-part="scoreRead"></div><div class="hud-stack"><div data-part="scoreRule"></div><div data-part="space"></div></div></div><i class="hud-rule"></i><div class="hud-threat"><div data-part="crisis"></div><i class="hud-rule"></i><div data-part="milops"></div></div></div></div>
<div class="hud-corner hud-bl hud-pane"><div data-part="table"></div><div class="hud-piles"><div data-part="catalog"></div><div class="hud-pile-row"><div data-part="deck"></div><div data-part="discard"></div><div data-part="removed"></div></div></div></div>
<div data-part="opponent"></div>
<div data-hand></div>
<div class="hud-overlay" hidden></div>
<div class="hud-fly"></div>`;

// the light tints the two stock side colours were tuned with; any other colour gets a mixed one
const TINTS: Record<string, string> = { '#2e6ad6': '#8ab6ff', '#de3f2b': '#ff9482' };
type CardList = Exclude<Pile, 'deck'> | 'candidates';

export class Hud {
  readonly root: HTMLDivElement;
  private lang: Lang;
  private state: HudState | null = null;
  private parts: Part[] = [];
  private hand: Hand | null = null;
  private headlineCard: string | null = null;
  private timeFooter: HTMLElement | null = null;
  private motion: CardMotion | null = null;
  private brief: CountryBrief | null = null;
  private statusPanel: ReturnType<typeof bindStatusPanel> | null = null;
  private pileView: { kind: CardList; browser: ReturnType<typeof openPileBrowser> } | null = null;
  private readonly handlers: { [K in keyof HudEvents]: Set<HudEvents[K]> } = { play: new Set(), deck: new Set(), catalog: new Set(), poke: new Set(), step: new Set() };
  private readonly onResize = (): void => this.measure();

  static create(container: HTMLElement, opts: HudOptions): Hud {
    return new Hud(container, opts);
  }

  private constructor(
    container: HTMLElement,
    private readonly opts: HudOptions,
  ) {
    this.lang = opts.lang ?? 'zh';
    this.root = document.createElement('div');
    this.root.className = 'hud';
    opts.sides.forEach((side, i) => {
      const key = i === 0 ? 'a' : 'b';
      this.root.style.setProperty(`--${key}`, side.color);
      this.root.style.setProperty(`--${key}-l`, TINTS[side.color.toLowerCase()] ?? `color-mix(in srgb, ${side.color} 55%, #fff)`);
    });
    container.appendChild(this.root);
    this.build();
    window.addEventListener('resize', this.onResize);
  }

  /** The visible seat's hand, without exposing the other player's private cards. */
  get handCards(): readonly string[] { return this.state?.hand ?? []; }

  /** Optional controls attached just below the timeline, included in the HUD's safe area. */
  setTimeFooter(node: HTMLElement): void {
    this.timeFooter?.remove();
    this.timeFooter = node;
    node.classList.add('hud-time-footer');
    this.root.querySelector('.hud-tl')!.append(node);
    this.measure();
  }

  setHandAvailability(choices: Map<string, string> | null): void {
    this.hand?.setAvailability(choices);
  }

  /** End an interrupted interaction without playing its card. */
  cancelHandDrag(): void {
    this.hand?.cancelDrag();
  }

  /** A selected headline leaves the fan immediately, including before a server acknowledgement. */
  holdHeadline(card: string | null): void {
    if (this.headlineCard === card) return;
    this.headlineCard = card;
    if (this.state) this.hand?.sync({ ...this.state, hand: this.state.hand.filter(id => id !== card) }, this.state, false);
  }

  /** Draws a state. The first one appears as it is; later ones animate what changed unless told not to. */
  setState(state: HudState, animate = true): void {
    const prev = this.state;
    const moving = animate && prev !== null;
    this.state = state;
    this.root.dataset.heat = String(this.heat(state.crisis));
    for (const part of this.parts) part(state, prev, moving);
    if (this.pileView) this.pileView.browser.update(this.pileCards(this.pileView.kind));
    // CardMotion owns the complete journey, including the concealed back during a deal.
    this.hand?.sync({ ...state, hand: state.hand.filter(id => id !== this.headlineCard) }, prev, false);
    this.measure();
    if (moving && !this.explicitCardChange) this.motion?.sync(state, prev);
  }

  private explicitCardChange = false;
  /** The presenter owns this journey; do not also infer a flight from the HUD diff. */
  commitCardChange(commit: () => void): void {
    this.explicitCardChange = true;
    try { commit(); } finally { this.explicitCardChange = false; }
  }
  /** A card an effect moves from one place to another (CardMotion.move). False: cut off before it committed. */
  moveCard(move: CardMove, commit: () => void, pace = 1): Promise<boolean> {
    const apply = (): void => this.commitCardChange(commit);
    if (this.motion) return this.motion.move(move, apply, pace);
    apply();
    return Promise.resolve(true);
  }
  waitForCards(): Promise<void> { return this.motion?.drain() ?? Promise.resolve(); }
  dealOpening(): Promise<void> { return this.state ? this.motion?.opening(this.state) ?? Promise.resolve() : Promise.resolve(); }
  showResolving(play: Play): Promise<void> { return this.motion?.show(play) ?? Promise.resolve(); }
  settleResolving(play: Play): Promise<void> { return this.motion?.settle(play) ?? Promise.resolve(); }
  skipCardMotion(): void { this.motion?.skip(); }
  resetCardMotion(resetState = false): void { this.motion?.reset(); if (resetState) this.state = null; }
  /**
   * Presentation only: shows a score the rules have not applied yet, so that a scoring can be seen
   * counting in. Nothing else changes, and the next state from the rules replaces it.
   */
  previewVp(vp: number): void { if (this.state && this.state.vp !== vp) this.setState({ ...this.state, vp }); }

  on<K extends keyof HudEvents>(event: K, handler: HudEvents[K]): () => void {
    this.handlers[event].add(handler);
    return () => this.handlers[event].delete(handler);
  }

  setLanguage(lang: Lang): void {
    if (lang === this.lang) return;
    this.lang = lang;
    this.build();
    this.brief?.setLanguage(lang);
    const state = this.state;
    this.state = null;
    if (state) this.setState(state, false);
  }

  /**
   * The short card for this map's countries and regions: shown on hover and on selection, under the
   * time corner. Give it the same MapState the map gets, and each side's standing in the regions.
   * The map's own card should be hidden by the page.
   */
  briefFor(map: WorldMap): CountryBrief {
    this.brief?.dispose();
    this.brief = new CountryBrief(this.root, map, this.lang, { scoring: this.opts.rules.scoring, countryScoring: this.opts.rules.countryScoring, term: this.opts.term });
    return this.brief;
  }

  /** Holds a card of the hand up without a pointer, for screenshots and tests. */
  hoverCard(id: string | null): void {
    this.hand?.hover(id);
  }

  /** Reveal full meters before the presenter measures and moves the shared status panel. */
  setStatusSpotlight(active: boolean): void {
    this.statusPanel?.spotlight(active);
  }

  dispose(): void {
    this.pileView?.browser.close();
    this.motion?.dispose();
    window.removeEventListener('resize', this.onResize);
    this.statusPanel?.dispose();
    this.parts.forEach((part) => part.dispose?.());
    this.hand?.dispose();
    this.brief?.dispose();
    this.root.remove();
  }

  // ------------------------------------------------------------------ internals

  private heat(crisis: number): number {
    const n = this.opts.rules.crisis.length;
    return n === 1 ? 1 : Math.round(1 + ((crisis - 1) * 4) / (n - 1));
  }

  private emit<K extends keyof HudEvents>(event: K, ...args: Parameters<HudEvents[K]>): void {
    for (const handler of this.handlers[event]) (handler as (...a: Parameters<HudEvents[K]>) => void)(...args);
  }

  private place(where: Pile | 'table' | 'opponent'): Rect | null {
    if (where === 'table') return cardRectIn(this.root.querySelector('.pl-slot')) ?? cardRectIn(this.root.querySelector('.hp-discard .hp-card'));
    if (where === 'opponent') {
      const r = this.root.querySelector('.op-cards')?.getBoundingClientRect();
      return r?.width ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
    }
    return cardRectIn(this.root.querySelector(`.hp-${where} .hp-card`));
  }

  private build(): void {
    const { opts, lang } = this;
    this.pileView?.browser.close();
    this.motion?.dispose();
    this.statusPanel?.dispose();
    this.parts.forEach((part) => part.dispose?.());
    this.hand?.dispose();
    const keep = this.brief?.root;
    this.root.dataset.lang = lang;
    this.root.innerHTML = displayText(LAYOUT);
    if (keep) this.root.appendChild(keep);
    const layer = this.root.querySelector<HTMLElement>('.hud-fly')!;
    const overlay = this.root.querySelector<HTMLElement>('.hud-overlay')!;
    const side = (i: SideIndex) => opts.sides[i];
    const ctx: Ctx = {
      lang,
      t: HUD_STRINGS[lang],
      rules: opts.rules,
      sides: opts.sides,
      player: opts.player ?? 0,
      cards: opts.cards,
      catalog: opts.catalog ?? null,
      demo: opts.demo ?? false,
      playFlight: opts.playFlight ?? true,
      root: this.root,
      emit: (event, ...args) => this.emit(event, ...args),
      fly: (node, from, to, o) => fly(layer, node, from, to, o),
      place: (where) => this.place(where),
      openPile: (kind) => {
        this.cancelHandDrag();
        this.pileView?.browser.close();
        const candidates = kind === 'candidates';
        const browser = openPileBrowser(overlay, ctx, candidates ? ctx.t.candidatesTitle : ctx.t[kind], this.pileCards(kind), {
          ...(candidates ? { catalogOrder: true, description: ctx.t.candidatesHint, count: ctx.t.candidatesCount, empty: ctx.t.candidatesEmpty } : {}),
          onClose: () => { this.pileView = null; },
        });
        this.pileView = { kind, browser };
      },
      sideName: (i) => side(i).name[lang],
      sideShort: (i) => side(i).short[lang],
    };
    this.parts = [...this.root.querySelectorAll<HTMLElement>('[data-part]')].map((host) => PARTS[host.dataset.part!](host, ctx));
    this.hand = new Hand(this.root.querySelector<HTMLElement>('[data-hand]')!, ctx);
    this.motion = new CardMotion(ctx);
    this.statusPanel = bindStatusPanel(this.root.querySelector<HTMLElement>('.hud-tr')!, lang, () => this.measure());
    if (this.timeFooter) this.root.querySelector('.hud-tl')!.append(this.timeFooter);
  }

  private pileCards(kind: CardList): string[] {
    return (kind === 'candidates' ? this.state?.opponentCandidates : this.state?.[kind]) ?? [];
  }

  /** Tells the country card where the top corners end, so it can sit under either. */
  private measure(): void {
    let leftBottom = 0;
    for (const [name, sel] of [['left', '.hud-tl'], ['right', '.hud-tr']] as const) {
      const pane = this.root.querySelector<HTMLElement>(sel);
      if (pane) {
        const footer = pane.querySelector<HTMLElement>('.hud-time-footer:not([hidden])');
        const bottom = pane.offsetTop + Math.max(pane.offsetHeight, footer ? footer.offsetTop + footer.offsetHeight : 0);
        this.root.style.setProperty(`--under-${name}`, `${bottom}px`);
        if (name === 'left') leftBottom = bottom;
      }
    }
    const piles = this.root.querySelector<HTMLElement>('.hud-bl')!;
    const opponent = this.root.querySelector<HTMLElement>('.op')!;
    const left = this.root.querySelector<HTMLElement>('.hud-tl')!;
    const right = this.root.querySelector<HTMLElement>('.hud-tr')!;
    const room = 2 * Math.min(this.root.clientWidth / 2 - left.offsetLeft - left.offsetWidth, right.offsetLeft - this.root.clientWidth / 2) - 30;
    this.root.classList.toggle('passive-narrow', room < 180);
    this.root.style.setProperty('--passive-top-room', `${Math.max(180, room)}px`);
    this.root.style.setProperty('--under-corners', `${Math.max(leftBottom, right.offsetTop + right.offsetHeight)}px`);
    this.root.style.setProperty('--over-piles', `${this.root.clientHeight - piles.offsetTop}px`);
    // Keep the lower shelf clear of the merged status panel on very short screens.
    const shelf = this.root.querySelector<HTMLElement>('.ps-mine');
    const panelBottom = right.offsetTop + right.offsetHeight;
    const shelfTop = piles.offsetTop - (shelf?.offsetHeight ?? 0) - 12;
    const bottomRoom = shelfTop < panelBottom ? right.offsetLeft - piles.offsetLeft - 12 : this.root.clientWidth - 2 * piles.offsetLeft;
    this.root.style.setProperty('--passive-bottom-room', `${Math.max(90, bottomRoom)}px`);
    this.root.style.setProperty('--under-opponent', `${opponent.offsetTop + opponent.offsetHeight}px`);
  }
}
