// The deck page: every card as a small front, filters by era and side, and one card at a time enlarged
// (tilt it with the pointer, click to turn it over). Cards are built as they scroll into view.
(function () {
  'use strict';
  const q = new URLSearchParams(location.search);
  const DECK = window.DECK;
  const C = window.DeckCard;
  const byNo = Object.fromEntries(DECK.map((c) => [c.no, c]));
  const FX = '<div class="fx-glare"></div><div class="fx-edge"></div>';
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const $ = (id) => document.getElementById(id);

  document.body.insertAdjacentHTML('afterbegin', CardArt.defs());
  const deckEl = $('deck');
  if (q.get('w')) deckEl.style.setProperty('--card-w', q.get('w') + 'px');

  function slot(c, uid, hint, flipped) {
    return (
      `<div class="slot v2 e01 deck side-${c ? c.side : 'tally'}${flipped ? ' is-flipped' : ''}" data-no="${c ? c.no : ''}" data-uid="${uid}" tabindex="0" role="button" aria-label="${esc((c ? C.describe(c) : 'The card back, the same for every card.') + ' ' + hint)}">` +
      '<div class="slot-shadow"></div><div class="tilt"><div class="flip"><div class="face front" data-pending></div><div class="face back" data-pending></div></div></div></div>'
    );
  }
  function build(el, side) {
    const face = el.querySelector('.face.' + side);
    if (!face.hasAttribute('data-pending')) return;
    face.innerHTML = (side === 'front' ? C.front(byNo[el.dataset.no], el.dataset.uid) : C.back(el.dataset.uid)) + FX;
    face.removeAttribute('data-pending');
    if (side === 'front') C.fit(face);
  }

  // tilt and glare follow the pointer
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  function wire(el, onPress) {
    let raf = 0;
    if (fine) {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          el.classList.add('is-live');
          el.style.setProperty('--tx', ((x - 0.5) * 2).toFixed(3));
          el.style.setProperty('--ty', ((y - 0.5) * 2).toFixed(3));
          el.style.setProperty('--glare', '1');
        });
      });
      el.addEventListener('pointerleave', () => {
        cancelAnimationFrame(raf);
        el.classList.remove('is-live');
        el.style.setProperty('--tx', '0');
        el.style.setProperty('--ty', '0');
        el.style.setProperty('--glare', '0');
      });
    }
    el.addEventListener('click', () => onPress(el));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onPress(el);
      }
    });
  }
  const turn = (el) => {
    build(el, el.classList.contains('is-flipped') ? 'front' : 'back');
    el.classList.toggle('is-flipped');
  };

  /* ---- art review: ?art=1 shows only the illustrations ---- */
  if (q.get('art')) {
    deckEl.classList.add('is-art');
    deckEl.innerHTML = DECK.filter((c) => !q.get('era') || c.era === q.get('era')).map((c) => `<figure><div class="disc side-${c.side}">${DeckArt.scene(c.art)}</div><figcaption><span>${c.no}</span>${c.title}</figcaption></figure>`).join('');
    if (DeckArt.missing.size) deckEl.insertAdjacentHTML('beforebegin', `<p style="padding:0 32px;color:#f77">Not drawn yet: ${[...DeckArt.missing].join(', ')}</p>`);
    document.querySelectorAll('.legend, .deck-bar, .deck-back').forEach((el) => (el.hidden = true));
    return;
  }

  /* ---- the grid ---- */
  const only = q.get('only') ? q.get('only').split(',').map((n) => n.padStart(3, '0')) : null;
  let html = '';
  for (const era of Object.keys(C.ERAS)) {
    html += `<h2 class="era-head" data-era="${era}">${C.ERAS[era].name}<span>${C.ERAS[era].span}</span></h2>`;
    for (const c of DECK)
      if (c.era === era && (!only || only.includes(c.no)))
        html += `<figure data-era="${c.era}" data-side="${c.side}" data-no="${c.no}">${slot(c, 'c' + c.no, 'Press to enlarge.')}<figcaption><span>№ ${c.no}</span>${c.title}</figcaption></figure>`;
  }
  deckEl.innerHTML = html;
  const figures = [...deckEl.querySelectorAll('figure')];

  // what the four colours mean, on four cards from the deck
  const KINDS = [['025', 'Red', 'A Soviet event'], ['008', 'Blue', 'A US event'], ['047', 'Ivory', 'A neutral event: it works for whoever plays it'], ['018', 'Black', 'A tally: it scores a region']];
  $('kinds').innerHTML = KINDS.map(([no, colour, what]) => `<figure>${slot(byNo[no], 'k' + no, 'Press to enlarge.')}<figcaption><b>${colour}</b>${what}</figcaption></figure>`).join('');
  $('back-slot').innerHTML = slot(null, 'bk', 'Press to turn it over.', true);

  const fonts = Promise.race([
    Promise.all(["500 20px 'Card Chinese'", "750 20px 'Card Chinese'", "48px 'Russo One'", "600 12px 'Oswald'", "400 12px 'Oswald'", "700 12px 'Oswald'"].map((f) => document.fonts.load(f))),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
  fonts.then(() => {
    const seen = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            build(e.target, 'front');
            seen.unobserve(e.target);
          }
      },
      { rootMargin: '700px 0px' },
    );
    document.querySelectorAll('#deck .slot, #kinds .slot').forEach((el) => {
      if (q.get('eager')) build(el, 'front');
      else seen.observe(el);
      wire(el, () => open(el.dataset.no));
    });
    const bk = $('back-slot').firstElementChild;
    build(bk, 'back');
    wire(bk, () => bk.classList.toggle('is-flipped'));
    // the back slot has no card of its own: its front shows the first card
    bk.dataset.no = DECK[0].no;
    bk.addEventListener('pointerenter', () => build(bk, 'front'), { once: true });
    bk.addEventListener('focus', () => build(bk, 'front'), { once: true });
    if (q.get('open')) open(q.get('open').padStart(3, '0'));
    if (DeckArt.missing.size) console.warn('Deck art not drawn: ' + [...DeckArt.missing].join(', '));
    document.documentElement.dataset.ready = '1';
  });

  /* ---- filters ---- */
  const state = { era: q.get('era') || 'all', side: q.get('side') || 'all' };
  function apply() {
    let n = 0;
    for (const fig of figures) {
      const show = (state.era === 'all' || fig.dataset.era === state.era) && (state.side === 'all' || fig.dataset.side === state.side);
      fig.hidden = !show;
      if (show) n++;
    }
    for (const h of deckEl.querySelectorAll('.era-head')) h.hidden = !figures.some((fig) => !fig.hidden && fig.dataset.era === h.dataset.era);
    for (const b of document.querySelectorAll('.chips button')) b.setAttribute('aria-pressed', String(state[b.dataset.key] === b.dataset.value));
    $('count').textContent = n === figures.length ? `${n} cards` : `${n} of ${figures.length} cards`;
  }
  for (const b of document.querySelectorAll('.chips button'))
    b.addEventListener('click', () => {
      state[b.dataset.key] = b.dataset.value;
      apply();
    });
  apply();

  /* ---- one card, large ---- */
  const viewer = $('viewer');
  const stage = $('v-stage');
  let current = null;
  const visible = () => figures.filter((fig) => !fig.hidden).map((fig) => fig.dataset.no);
  function open(no) {
    const c = byNo[no];
    if (!c) return;
    current = no;
    stage.innerHTML = slot(c, 'v' + no, 'Press to turn it over.');
    const el = stage.firstElementChild;
    if (!viewer.open) viewer.showModal();
    build(el, 'front');
    wire(el, turn);
    el.focus({ preventScroll: true });
    $('v-cap').innerHTML = `<b>№ ${c.no} · ${C.SIDES[c.side].name}${c.side === 'tally' ? '' : ' · value ' + c.value} · ${C.ERAS[c.era].name} ${C.ERAS[c.era].span}</b>${c.place}, ${c.date}. ${C.plain(c.text)}`;
    if (q.get('flip')) turn(el);
    const pose = q.get('pose');
    if (pose) {
      const [x, y] = pose.split(',').map(Number);
      el.style.setProperty('--tx', ((x - 0.5) * 2).toFixed(3));
      el.style.setProperty('--ty', ((y - 0.5) * 2).toFixed(3));
      el.style.setProperty('--glare', '1');
    }
  }
  function step(d) {
    const list = visible();
    const i = list.indexOf(current);
    open(list[(Math.max(0, i) + d + list.length) % list.length] || current);
  }
  $('v-prev').addEventListener('click', () => step(-1));
  $('v-next').addEventListener('click', () => step(1));
  $('v-close').addEventListener('click', () => viewer.close());
  viewer.addEventListener('click', (e) => {
    if (e.target === viewer || e.target.classList.contains('viewer-in')) viewer.close();
  });
  viewer.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
  viewer.addEventListener('close', () => {
    stage.innerHTML = '';
    const back = deckEl.querySelector(`figure[data-no="${current}"] .slot`);
    if (back) back.focus({ preventScroll: true });
  });
})();
