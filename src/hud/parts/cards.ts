import { text as displayText } from '../../i18n/index.js';
// The bottom-left corner and the top edge: the card on the table, the three piles, and the backs of
// the opponent's hand.
import { type PartFactory, esc, label, times } from '../dom';
import { crossGlyph, fanGlyph } from '../glyphs';
import type { Pile } from '../types';

/** The full catalog and the seat's card-counting assistant sit side by side. */
export const catalog: PartFactory = (host, ctx) => {
  host.hidden = ctx.catalog === null;
  if (ctx.catalog === null) return () => {};
  host.className = 'hc';
  host.innerHTML = displayText(`<button type="button" class="hc-btn hc-all" title="${esc(ctx.t.viewAllCards)}">${fanGlyph()}${label(ctx.t.allCards)}<b class="hud-num">${ctx.catalog}</b><i class="hc-go"></i></button><button type="button" class="hc-btn hc-candidates" aria-haspopup="dialog" hidden>${label(ctx.t.candidatesTitle)}<i class="hc-go"></i></button>`);
  const button = host.querySelector<HTMLButtonElement>('.hc-all')!;
  const candidates = host.querySelector<HTMLButtonElement>('.hc-candidates')!;
  button.addEventListener('click', (e) => {
    // a mouse click does not leave the keyboard on the button; a key press keeps its place
    if (e.detail > 0) button.blur();
    ctx.emit('catalog');
  });
  candidates.addEventListener('click', () => ctx.openPile('candidates'));
  return (s) => { candidates.hidden = s.opponentCandidates === undefined; };
};

/** One of the three piles. The draw pile shows the back; the other two show what is on top. */
export const pile = (kind: Pile): PartFactory => (host, ctx) => {
  const name = ctx.t[kind];
  host.className = `hp hp-${kind}`;
  if (kind !== 'deck') {
    host.setAttribute('role', 'button');
    host.tabIndex = 0;
    host.setAttribute('aria-haspopup', 'dialog');
    host.title = displayText(ctx.t.viewPile(name));
    host.addEventListener('click', () => ctx.openPile(kind));
    host.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); host.click(); }
    });
  }
  host.innerHTML = displayText(`<div class="hp-card"></div><div class="hp-cap">${label(name)}<b class="hud-num"></b></div>`);
  const slot = host.querySelector<HTMLElement>('.hp-card')!;
  const num = host.querySelector('.hud-num')!;
  if (kind === 'deck') slot.appendChild(ctx.cards.back());
  let top: string | undefined;
  return (s) => {
    const n = kind === 'deck' ? s.deck : s[kind].length;
    host.setAttribute('aria-label', `${name} · ${n}`);
    num.textContent = displayText(String(n));
    host.classList.toggle('empty', n === 0);
    slot.style.setProperty('--depth', String(Math.min(6, Math.ceil(n / 4))));
    if (kind === 'deck') return;
    const id = s[kind][n - 1];
    if (id === top) return;
    top = id;
    slot.replaceChildren();
    if (!id) return;
    const face = ctx.cards.face(id);
    slot.appendChild(face);
    ctx.cards.fit(face);
    if (kind === 'removed') slot.insertAdjacentHTML('beforeend', `<i class="hp-x">${crossGlyph()}</i>`);
  };
};

export { battleLog as table } from './battleLog';

/** The opponent's hand: how many, as a fan of backs hanging from the top edge. */
export const opponentHand: PartFactory = (host, ctx) => {
  host.className = 'op';
  host.innerHTML = displayText(`<span class="op-cards"></span><span class="op-cap">${label(ctx.t.opponentHand)}<b class="hud-num"></b></span>`);
  const fan = host.querySelector('.op-cards')!;
  const num = host.querySelector('.hud-num')!;
  let n = -1;
  return (s) => {
    num.textContent = displayText(String(s.opponentHand));
    if (n === s.opponentHand) return;
    n = s.opponentHand;
    fan.innerHTML = displayText(times(n, (i) => `<i class="op-back" style="--t:${(i - (n - 1) / 2).toFixed(2)}"></i>`));
  };
};
