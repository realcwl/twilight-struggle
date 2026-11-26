// Shared by the V2 designs: small path helpers, the halftone photo, the card's words in poster case,
// and a few extra filters (cloth, concrete, soft blurs for cast shadows).
(function () {
  'use strict';
  const A = window.CardArt;
  const f = A.f;
  const P = (cx, cy, r, deg) => f(cx + r * Math.cos(A.rad(deg))) + ',' + f(cy + r * Math.sin(A.rad(deg)));

  /** Rounded rectangle as a path `d`. */
  const rr = (x, y, w, h, r = 0) =>
    r
      ? `M${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h - r}A${r},${r} 0 0 1 ${x + w - r},${y + h}H${x + r}A${r},${r} 0 0 1 ${x},${y + h - r}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}Z`
      : `M${x},${y}H${x + w}V${y + h}H${x}Z`;
  /** A band round the card: outer edge `o` in from the card edge, `t` thick. Fill with evenodd. */
  const band = (o, t, ro, ri) => rr(o, o, 500 - 2 * o, 700 - 2 * o, ro) + rr(o + t, o + t, 500 - 2 * (o + t), 700 - 2 * (o + t), ri);
  const circle = (cx, cy, r) => `M${cx - r},${cy}A${r},${r} 0 1 0 ${cx + r},${cy}A${r},${r} 0 1 0 ${cx - r},${cy}Z`;
  const burstD = (...a) => A.burst(...a).slice(9, -3);
  /** The two faction inks, for backs that carry both in balance: blue to the west, red to the east. */
  const RED = '#c8281e';
  const BLUE = '#235a9f';
  /** The lens where two equal circles centred on (x1, cy) and (x2, cy) overlap. */
  function lens(x1, x2, cy, r) {
    const m = (x1 + x2) / 2;
    const h = Math.sqrt(r * r - ((x2 - x1) / 2) ** 2);
    return `M${m},${f(cy - h)}A${r},${r} 0 0 1 ${m},${f(cy + h)}A${r},${r} 0 0 1 ${m},${f(cy - h)}Z`;
  }
  /** A disc with `n` scallops round its edge (a foil seal). */
  function scallop(cx, cy, R, n, bulge = 0.62) {
    const rr = f(2 * R * Math.sin(Math.PI / n) * bulge);
    let d = 'M' + P(cx, cy, R, 0);
    for (let i = 1; i <= n; i++) d += `A${rr},${rr} 0 0 1 ${P(cx, cy, R, (i * 360) / n)}`;
    return d + 'Z';
  }

  /** Gear outline with `n` flat-topped teeth. */
  function gear(cx, cy, R, n, depth = 0.17, rot = 0) {
    const r = f(R * (1 - depth));
    const step = 360 / n;
    let d = 'M' + P(cx, cy, r, rot);
    for (let i = 0; i < n; i++) {
      const a = rot + i * step;
      d += `L${P(cx, cy, R, a + step * 0.12)}A${R},${R} 0 0 1 ${P(cx, cy, R, a + step * 0.46)}L${P(cx, cy, r, a + step * 0.58)}A${r},${r} 0 0 1 ${P(cx, cy, r, a + step)}`;
    }
    return d + 'Z';
  }

  /** The illustration cropped to `box` = [x, y, w, h], clipped to the path `d`, under a halftone screen. */
  function photo(id, d, box, view, dots = 0.2) {
    const [x, y, w, h] = box;
    return (
      `<defs><clipPath id="${id}"><path d="${d}"/></clipPath></defs>` +
      `<g clip-path="url(#${id})"><svg x="${x}" y="${y}" width="${w}" height="${h}">${A.scene(view)}</svg>` +
      (dots ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#v2-dots)" opacity="${dots}"/>` : '') +
      '</g>'
    );
  }

  /** A soft cast shadow of the path `d`, for things that float above the card on their own layer. */
  const shadow = (d, dx = 6, dy = 12, o = 0.5, blur = 'v2-blur') =>
    `<path d="${d}" transform="translate(${dx} ${dy})" fill="#000" opacity="${o}" filter="url(#${blur})"/>`;

  /** The card's words, set the way a poster sets them. */
  const words = (c) => ({
    title: c.title.toUpperCase(),
    type: `${c.side}事件`,
    era: `${c.era.toUpperCase()} · ${c.eraSpan}`,
    where: `${c.place.toUpperCase()} · ${c.date.toUpperCase()}`,
    note: CardZh.highlightSVG(c.note),
    no: `№ ${c.no}`,
  });
  /** The rules block (HTML, so it wraps). */
  const text = (c, note = true) => `<div class="abs txt"><p class="rules">${c.text}</p>${note ? `<p class="note">${CardZh.highlight(c.note)}</p>` : ''}</div>`;

  const blur = (id, sd) => `<filter id="${id}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${sd}"/></filter>`;
  const defs =
    '<pattern id="v2-dots" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><circle cx="2.5" cy="2.5" r="1.05" fill="#15110e"/></pattern>' +
    blur('v2-blur-s', 4) +
    blur('v2-blur', 9) +
    blur('v2-blur-l', 16) +
    // woven cloth: fine noise lit from the upper left
    '<filter id="f-cloth" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
    '<feTurbulence type="fractalNoise" baseFrequency="1.5 .85" numOctaves="2" seed="12" result="n"/>' +
    '<feDiffuseLighting in="n" surfaceScale="1.2" diffuseConstant="1.14" lighting-color="#fff" result="d"><feDistantLight azimuth="225" elevation="60"/></feDiffuseLighting>' +
    '<feBlend in="SourceGraphic" in2="d" mode="multiply" result="o"/><feComposite in="o" in2="SourceAlpha" operator="in"/></filter>' +
    // poured concrete: broad blotches, sandy grain, a scatter of air holes
    '<filter id="f-concrete" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
    '<feTurbulence type="fractalNoise" baseFrequency=".011 .02" numOctaves="4" seed="31" result="n1"/>' +
    '<feColorMatrix in="n1" type="matrix" values=".55 .55 .55 0 -.32  .55 .55 .55 0 -.32  .55 .55 .55 0 -.32  0 0 0 0 1" result="blot"/>' +
    '<feBlend in="blot" in2="SourceGraphic" mode="soft-light" result="a"/>' +
    '<feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="5" result="n2"/>' +
    '<feDiffuseLighting in="n2" surfaceScale="1.3" diffuseConstant="1.12" lighting-color="#fff" result="d"><feDistantLight azimuth="225" elevation="62"/></feDiffuseLighting>' +
    '<feBlend in="a" in2="d" mode="multiply" result="b"/>' +
    '<feTurbulence type="fractalNoise" baseFrequency=".2" numOctaves="1" seed="9" result="n3"/>' +
    '<feColorMatrix in="n3" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  14 0 0 0 -9.4" result="pores"/>' +
    '<feFlood flood-color="#2b2723" flood-opacity=".5" result="c"/><feComposite in="c" in2="pores" operator="in" result="holes"/>' +
    '<feMerge result="m"><feMergeNode in="b"/><feMergeNode in="holes"/></feMerge>' +
    '<feComposite in="m" in2="SourceAlpha" operator="in"/></filter>';
  document.body.insertAdjacentHTML('afterbegin', `<svg class="art-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>${defs}</defs></svg>`);

  window.V2 = { RED, BLUE, rr, band, circle, burstD, lens, scallop, gear, photo, shadow, words, text };
})();
