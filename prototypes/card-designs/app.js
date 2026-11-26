// Builds the comparison sheet from window.CardDesigns and wires the tilt, glare and flip.
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const only = params.get('only'); // "3" or "3,4": show just these designs
  const side = params.get('side'); // "front" | "back": one card per plate
  const width = params.get('w'); // card width in px
  const designs = window.CardDesigns.slice().sort((a, b) => a.id.localeCompare(b.id));

  document.body.insertAdjacentHTML('afterbegin', CardArt.defs());
  if (width) document.documentElement.style.setProperty('--card-w', width + 'px');

  // Each slot starts with only the face it shows; the other is built the first time the pointer
  // reaches the card (or it is turned), which halves the work of the first paint.
  const byId = Object.fromEntries(designs.map((d) => [d.id, d]));
  const FX = '<div class="fx-glare"></div><div class="fx-edge"></div>';
  // `uid` prefixes the SVG ids a face defines, so the same design can be on the page more than once.
  function slot(design, flipped, uid = design.key || 'd' + design.id) {
    const face = (side) => {
      const shown = (side === 'back') === flipped;
      return `<div class="face ${side}"${shown ? '' : ' data-pending'}>${shown ? design[side](window.CARD, uid) + FX : ''}</div>`;
    };
    return (
      `<div class="slot ${design.cls || 'd' + design.id}${flipped ? ' is-flipped' : ''}" data-design="${design.id}" data-uid="${uid}" tabindex="0" role="button" aria-label="${design.name}: ${flipped ? 'back' : 'front'}. Press to turn over.">` +
      `<div class="slot-shadow"></div><div class="tilt"><div class="flip">${face('front')}${face('back')}</div></div></div>`
    );
  }
  function complete(el) {
    const pending = el.querySelector('.face[data-pending]');
    if (!pending) return;
    const side = pending.classList.contains('back') ? 'back' : 'front';
    pending.innerHTML = byId[el.dataset.design][side](window.CARD, el.dataset.uid) + FX;
    pending.removeAttribute('data-pending');
  }

  const sheet = document.getElementById('sheet');
  const wanted = only ? only.split(',').map((n) => n.padStart(2, '0')) : null;
  let html = '';
  for (const d of designs) {
    if (wanted && !wanted.includes(d.id)) continue;
    html +=
      `<section class="plate" id="design-${d.id}">` +
      `<header class="plate-head"><span class="plate-no">${d.id}</span><div><h2>${d.name}</h2><p>${d.concept}</p></div></header>` +
      '<div class="plate-stage">' +
      (side !== 'back' ? `<figure>${slot(d, false)}<figcaption>Front</figcaption></figure>` : '') +
      (side !== 'front' ? `<figure>${slot(d, true, (d.key || 'd' + d.id) + 'r')}<figcaption>Back</figcaption></figure>` : '') +
      '</div>' +
      `<dl class="plate-notes">${d.notes.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>` +
      '</section>';
  }
  sheet.innerHTML = html;
  // optional strip: every front at the size it has in a hand
  const hand = document.getElementById('hand-row');
  if (hand) {
    hand.innerHTML = designs
      .filter((d) => !wanted || wanted.includes(d.id))
      .map((d) => `<figure>${slot(d, false, (d.key || 'd' + d.id) + 'h')}<figcaption><a href="#design-${d.id}">${d.id} ${d.name}</a></figcaption></figure>`)
      .join('');
  }
  const slots = document.querySelectorAll('.slot');
  if (wanted && wanted.length === 1) document.body.classList.add('is-solo');
  if (params.get('view') === 'wall') document.body.classList.add('is-wall');

  // tilt + glare follow the pointer; a click or Enter turns the card over
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  for (const el of slots) {
    let raf = 0;
    const move = (e) => {
      const r = el.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.classList.add('is-live');
        el.style.setProperty('--tx', ((x - 0.5) * 2).toFixed(3));
        el.style.setProperty('--ty', ((y - 0.5) * 2).toFixed(3));
        el.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
        el.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
        el.style.setProperty('--glare', '1');
      });
    };
    const leave = () => {
      cancelAnimationFrame(raf);
      el.classList.remove('is-live');
      el.style.setProperty('--tx', '0');
      el.style.setProperty('--ty', '0');
      el.style.setProperty('--glare', '0');
    };
    el.addEventListener('pointerenter', () => complete(el));
    el.addEventListener('focus', () => complete(el));
    if (fine) {
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', leave);
    }
    const turn = () => {
      complete(el);
      el.classList.toggle('is-flipped');
    };
    el.addEventListener('click', turn);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        turn();
      }
    });
  }

  const wall = document.getElementById('wall');
  if (wall) {
    const sync = () => wall.setAttribute('aria-pressed', document.body.classList.contains('is-wall'));
    wall.addEventListener('click', () => {
      document.body.classList.toggle('is-wall');
      sync();
    });
    sync();
  }
  const flipAll = document.getElementById('flip-all');
  if (flipAll) {
    flipAll.addEventListener('click', () =>
      slots.forEach((el) => {
        complete(el);
        el.classList.toggle('is-flipped');
      }),
    );
  }

  // test hook: ?pose=x,y holds every card at a fixed tilt so the glare can be captured
  if (params.get('flip')) slots.forEach((el) => { complete(el); el.classList.toggle('is-flipped'); });
  const pose = params.get('pose');
  if (pose) {
    const [x, y] = pose.split(',').map(Number);
    for (const el of slots) {
      el.style.setProperty('--tx', ((x - 0.5) * 2).toFixed(3));
      el.style.setProperty('--ty', ((y - 0.5) * 2).toFixed(3));
      el.style.setProperty('--gx', x * 100 + '%');
      el.style.setProperty('--gy', y * 100 + '%');
      el.style.setProperty('--glare', '1');
    }
  }
})();
