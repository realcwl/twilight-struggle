// Shared drawing code for the card sheet: the illustration every card uses, plus the ornaments
// (stars, wreaths, globes, guilloche) and the SVG filters and metal gradients the frames share.
// Everything is generated here as SVG markup; colours come from CSS custom properties, so each
// design re-inks the same drawing.
(function () {
  'use strict';

  const f = (n) => Math.round(n * 100) / 100;
  const rad = (d) => (d * Math.PI) / 180;
  const rng = (seed) => () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  /* ---------------------------------------------------------------- ornaments */

  function starPoints(cx, cy, R, rot = -90, inner = 0.382) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? R * inner : R;
      const a = rad(rot + i * 36);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return pts;
  }
  /** Five-point star as a path `d`. */
  function starD(cx, cy, R, rot = -90, inner = 0.382) {
    return 'M' + starPoints(cx, cy, R, rot, inner).map((p) => f(p[0]) + ',' + f(p[1])).join('L') + 'Z';
  }
  /** Light and dark facets to lay over a star so it reads as cut metal. */
  function starFacets(cx, cy, R, rot = -90, inner = 0.382) {
    const p = starPoints(cx, cy, R, rot, inner);
    let lite = '';
    let dark = '';
    for (let i = 0; i < 10; i++) {
      const a = p[i];
      const b = p[(i + 1) % 10];
      const d = `M${f(cx)},${f(cy)}L${f(a[0])},${f(a[1])}L${f(b[0])},${f(b[1])}Z`;
      if (i % 2) lite += d;
      else dark += d;
    }
    return `<path d="${lite}" fill="#fff" opacity=".22"/><path d="${dark}" fill="#000" opacity=".22"/>`;
  }

  /** Many-rayed order star (long and short rays alternating), with cut facets. */
  function orderStar(cx, cy, R, rays = 8, valley = 0.5, short = 0.78, rot = -90) {
    const n = rays * 4;
    const p = [];
    for (let k = 0; k < n; k++) {
      const r = [R, R * valley, R * short, R * valley][k % 4];
      const a = rad(rot + (k * 360) / n);
      p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    const d = 'M' + p.map((q) => f(q[0]) + ',' + f(q[1])).join('L') + 'Z';
    let lite = '';
    let dark = '';
    for (let k = 0; k < n; k++) {
      const a = p[k];
      const b = p[(k + 1) % n];
      const t = `M${f(cx)},${f(cy)}L${f(a[0])},${f(a[1])}L${f(b[0])},${f(b[1])}Z`;
      if (k % 2) lite += t;
      else dark += t;
    }
    return { d, facets: `<path d="${lite}" fill="#fff" opacity=".2"/><path d="${dark}" fill="#000" opacity=".2"/>` };
  }

  /** Two laurel branches curving up from the bottom of a circle, each on a thin stem. Inherits fill. */
  function laurel(cx, cy, R, n = 14, leaf = 0.24, spread = 150) {
    let out = '';
    const pt = (r, a) => f(cx + r * Math.cos(rad(a))) + ',' + f(cy + r * Math.sin(rad(a)));
    for (const side of [-1, 1]) {
      const a0 = 90 + side * 6;
      const a1 = 90 + side * (10 + spread);
      const w = Math.max(0.8, R * 0.012);
      const sweep = side > 0 ? 1 : 0;
      out += `<path d="M${pt(R + w, a0)}A${R + w},${R + w} 0 0 ${sweep} ${pt(R + w * 0.3, a1)}L${pt(R - w * 0.3, a1)}A${R - w},${R - w} 0 0 ${1 - sweep} ${pt(R - w, a0)}Z"/>`;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const ang = 90 + side * (10 + t * spread);
        const x = cx + R * Math.cos(rad(ang));
        const y = cy + R * Math.sin(rad(ang));
        const L = R * leaf * (1 - t * 0.3);
        const W = L * 0.3;
        for (const tilt of [-30, 30]) {
          const rot = ang + side * 90 + tilt * side;
          out += `<path transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})" d="M0,0Q${f(L * 0.45)},${f(-W)} ${f(L)},0Q${f(L * 0.45)},${f(W)} 0,0Z"/>`;
        }
      }
      const tip = 90 + side * (10 + spread);
      const tx = cx + R * Math.cos(rad(tip));
      const ty = cy + R * Math.sin(rad(tip));
      const L = R * leaf * 0.7;
      out += `<path transform="translate(${f(tx)} ${f(ty)}) rotate(${f(tip + side * 90)})" d="M0,0Q${f(L * 0.45)},${f(-L * 0.3)} ${f(L)},0Q${f(L * 0.45)},${f(L * 0.3)} 0,0Z"/>`;
    }
    return out;
  }

  /** Wireframe globe. Inherits stroke. */
  function globe(cx, cy, R, sw = 1.5) {
    let out = `<g fill="none" stroke-width="${sw}"><circle cx="${cx}" cy="${cy}" r="${R}"/>`;
    for (const k of [0.36, 0.72]) out += `<ellipse cx="${cx}" cy="${cy}" rx="${f(R * k)}" ry="${R}"/>`;
    out += `<path d="M${cx},${cy - R}V${cy + R}M${cx - R},${cy}H${cx + R}"/>`;
    for (const k of [0.5, -0.5]) {
      const y = cy + R * k;
      const half = R * Math.sqrt(1 - k * k);
      out += `<path d="M${f(cx - half)},${f(y)}Q${cx},${f(y + R * k * 0.22)} ${f(cx + half)},${f(y)}"/>`;
    }
    return out + '</g>';
  }

  /** Rays from a point, as alternating wedges. Inherits fill. */
  function burst(cx, cy, R, n, r0 = 0, duty = 0.5, rot = 0) {
    let d = '';
    const step = 360 / n;
    for (let i = 0; i < n; i++) {
      const a0 = rad(rot + i * step);
      const a1 = rad(rot + (i + duty) * step);
      d += `M${f(cx + r0 * Math.cos(a0))},${f(cy + r0 * Math.sin(a0))}L${f(cx + R * Math.cos(a0))},${f(cy + R * Math.sin(a0))}L${f(cx + R * Math.cos(a1))},${f(cy + R * Math.sin(a1))}L${f(cx + r0 * Math.cos(a1))},${f(cy + r0 * Math.sin(a1))}Z`;
    }
    return `<path d="${d}"/>`;
  }

  /** Guilloche rosette: `bands` phase-shifted rose curves. Inherits stroke. */
  function rosette(cx, cy, R, { petals = 12, depth = 0.22, bands = 10, sw = 0.5, turns = 1, inner = 0 } = {}) {
    let out = `<g fill="none" stroke-width="${sw}">`;
    const N = 360;
    for (let j = 0; j < bands; j++) {
      const ph = (j / bands) * Math.PI * 2;
      let d = '';
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * Math.PI * 2 * turns;
        const r = R * (1 - depth + depth * Math.cos(petals * t + ph)) - inner * (j / bands);
        d += (i ? 'L' : 'M') + f(cx + r * Math.cos(t)) + ',' + f(cy + r * Math.sin(t));
      }
      out += `<path d="${d}Z"/>`;
    }
    return out + '</g>';
  }

  /** Guilloche ribbon between two x positions. Inherits stroke. */
  function guillocheBand(x0, x1, y, amp, waves, bands = 6, sw = 0.5) {
    let out = `<g fill="none" stroke-width="${sw}">`;
    const N = Math.max(60, Math.round((x1 - x0) / 2));
    for (let j = 0; j < bands; j++) {
      const ph = (j / bands) * Math.PI * 2;
      let d = '';
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        d += (i ? 'L' : 'M') + f(x0 + (x1 - x0) * t) + ',' + f(y + amp * Math.sin(t * waves * Math.PI * 2 + ph));
      }
      out += `<path d="${d}"/>`;
    }
    return out + '</g>';
  }

  /** Slotted screw head. */
  function screw(cx, cy, r, rot = 30, metal = 'steel') {
    return (
      `<g transform="translate(${cx} ${cy})">` +
      `<circle r="${r}" fill="#000" opacity=".45" transform="translate(${f(r * 0.12)} ${f(r * 0.18)})"/>` +
      `<circle r="${r}" fill="url(#g-${metal}-r)"/>` +
      `<circle r="${f(r * 0.86)}" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="${f(r * 0.1)}"/>` +
      `<path d="M${-r * 0.72},0H${r * 0.72}" stroke="#000" stroke-opacity=".7" stroke-width="${f(r * 0.3)}" stroke-linecap="round" transform="rotate(${rot})"/>` +
      `<path d="M${-r * 0.72},0H${r * 0.72}" stroke="#fff" stroke-opacity=".35" stroke-width="${f(r * 0.08)}" transform="rotate(${rot}) translate(0 ${f(r * 0.2)})"/>` +
      '</g>'
    );
  }

  /** Domed rivet. */
  function rivet(cx, cy, r, metal = 'steel') {
    return (
      `<circle cx="${f(cx + r * 0.18)}" cy="${f(cy + r * 0.28)}" r="${f(r * 1.08)}" fill="#000" opacity=".5"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#g-${metal}-r)"/>` +
      `<circle cx="${f(cx - r * 0.3)}" cy="${f(cy - r * 0.34)}" r="${f(r * 0.3)}" fill="#fff" opacity=".5"/>`
    );
  }

  /* ------------------------------------------------------------ illustration */
  // Master drawing is 600 x 840 (the card's own proportion). The subject sits in the band from
  // y = 140 to y = 560, so a design can crop to a landscape window with its viewBox.

  function palm(x0, y0, tx, ty, s, r) {
    const cx = (x0 + tx) / 2 + (tx - x0) * 0.7;
    const cy = (y0 + ty) / 2;
    let out = `<path class="sc-mid" d="M${f(x0 - 5 * s)},${y0}Q${f(cx - 4 * s)},${f(cy)} ${f(tx - 3 * s)},${ty}L${f(tx + 3 * s)},${ty}Q${f(cx + 5 * s)},${f(cy)} ${f(x0 + 5 * s)},${y0}Z"/>`;
    for (const a of [-188, -163, -138, -112, -90, -66, -42, -17, 8]) {
      const L = 66 * s * (0.82 + 0.36 * r());
      const c = Math.cos(rad(a));
      const sn = Math.sin(rad(a));
      const ex = tx + L * c;
      const ey = ty + L * sn + L * 0.62 * (1 - Math.abs(sn));
      const mx = tx + 0.52 * L * c;
      const my = ty + 0.52 * L * sn - L * 0.16;
      out += `<path class="sc-mid" d="M${f(tx)},${f(ty)}Q${f(mx)},${f(my)} ${f(ex)},${f(ey)}Q${f(mx)},${f(my + L * 0.24)} ${f(tx)},${f(ty)}Z"/>`;
    }
    return out + `<circle class="sc-mid" cx="${tx}" cy="${ty}" r="${f(6 * s)}"/>`;
  }

  function flag(px, py, w, h, amp, phase) {
    const N = 16;
    const top = [];
    const bot = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = px + t * w;
      const yt = py + amp * Math.sin(phase + t * Math.PI * 2.4) * (0.25 + 0.75 * t) - t * h * 0.1;
      top.push([x, yt]);
      bot.push([x, yt + h * (1 - 0.08 * t)]);
    }
    const at = (i, k) => [top[i][0], top[i][1] + (bot[i][1] - top[i][1]) * k];
    let out = `<rect class="sc-mid" x="${px - 3}" y="${py - 16}" width="5" height="470"/><circle class="sc-mid" cx="${px - 0.5}" cy="${py - 18}" r="5"/>`;
    for (let s = 0; s < 5; s++) {
      let d = '';
      for (let i = 0; i <= N; i++) d += (i ? 'L' : 'M') + at(i, s / 5).map(f).join(',');
      for (let i = N; i >= 0; i--) d += 'L' + at(i, (s + 1) / 5).map(f).join(',');
      out += `<path class="${s % 2 ? 'sc-flag-b' : 'sc-flag-a'}" d="${d}Z"/>`;
    }
    const k = Math.round(N * 0.36);
    const tip = at(k, 0.5);
    out += `<path class="sc-flag-c" d="M${top[0].map(f).join(',')}L${f(tip[0])},${f(tip[1])}L${bot[0].map(f).join(',')}Z"/>`;
    const sc = at(Math.round(N * 0.12), 0.5);
    out += `<path class="sc-flag-b" d="${starD(sc[0], sc[1], h * 0.13)}"/>`;
    // soft fold shadows
    for (const t of [0.3, 0.62, 0.9]) {
      const i = Math.round(N * t);
      out += `<path d="M${top[i].map(f).join(',')}L${top[Math.min(N, i + 2)].map(f).join(',')}L${bot[Math.min(N, i + 2)].map(f).join(',')}L${bot[i].map(f).join(',')}Z" fill="#000" opacity=".13"/>`;
    }
    return out;
  }

  function crowdRow(r, { n, s, yMid, yEdge, cls, items }) {
    let out = '';
    const people = [];
    for (let i = 0; i < n; i++) {
      const x = -24 + (648 * (i + 0.5)) / n + (r() - 0.5) * (420 / n);
      const y = yMid - (yMid - yEdge) * Math.pow(Math.abs(x - 300) / 300, 1.35) + (r() - 0.5) * 16 * s;
      people.push([x, y, r(), r(), r(), r()]);
    }
    for (const [x, y, hatR, armR, itemR, sideR] of people) {
      const side = sideR < 0.5 ? -1 : 1;
      // raised arm first, so the body overlaps its root
      if (armR < 0.46) {
        const x1 = x + side * 19 * s;
        const y1 = y + 20 * s;
        const x2 = x + side * (25 + 9 * itemR) * s;
        const y2 = y - (24 + 16 * hatR) * s;
        out += `<path class="${cls}-s" d="M${f(x1)},${f(y1)}L${f(x2)},${f(y2)}" stroke-width="${f(7.5 * s)}" stroke-linecap="round" fill="none"/>`;
        out += `<circle class="${cls}" cx="${f(x2)}" cy="${f(y2 - 2 * s)}" r="${f(5.4 * s)}"/>`;
        if (items && itemR < 0.3) {
          // rifle
          const a = rad(-90 + side * (8 + 18 * hatR));
          out += `<path class="${cls}-s" d="M${f(x2 - 9 * s * Math.cos(a))},${f(y2 - 9 * s * Math.sin(a))}L${f(x2 + 36 * s * Math.cos(a))},${f(y2 + 36 * s * Math.sin(a))}" stroke-width="${f(2.1 * s)}" stroke-linecap="round" fill="none"/>`;
        } else if (items && itemR < 0.52) {
          // pennant
          out += `<path class="${cls}-s" d="M${f(x2)},${f(y2)}L${f(x2 + side * 2 * s)},${f(y2 - 34 * s)}" stroke-width="${f(1.5 * s)}" fill="none"/>`;
          out += `<path class="sc-pennant" d="M${f(x2 + side * 2 * s)},${f(y2 - 34 * s)}l${f(-side * 15 * s)},${f(4.5 * s)}l${f(side * 14.5 * s)},${f(6 * s)}Z"/>`;
        } else if (itemR < 0.75) {
          // waved hat
          out += `<ellipse class="${cls}" cx="${f(x2)}" cy="${f(y2 - 8 * s)}" rx="${f(11 * s)}" ry="${f(4 * s)}" transform="rotate(${side * 24} ${f(x2)} ${f(y2 - 8 * s)})"/>`;
        }
      }
      out += `<path class="${cls}" d="M${f(x - 25 * s)},860L${f(x - 25 * s)},${f(y + 31 * s)}Q${f(x - 25 * s)},${f(y + 13 * s)} ${f(x - 9 * s)},${f(y + 10 * s)}L${f(x + 9 * s)},${f(y + 10 * s)}Q${f(x + 25 * s)},${f(y + 13 * s)} ${f(x + 25 * s)},${f(y + 31 * s)}L${f(x + 25 * s)},860Z"/>`;
      out += `<circle class="${cls}" cx="${f(x)}" cy="${f(y)}" r="${f(10 * s)}"/>`;
      if (hatR < 0.36) {
        out += `<ellipse class="${cls}" cx="${f(x)}" cy="${f(y - 5 * s)}" rx="${f(17.5 * s)}" ry="${f(3.8 * s)}"/>`;
        out += `<path class="${cls}" d="M${f(x - 8.5 * s)},${f(y - 5 * s)}Q${f(x - 8.5 * s)},${f(y - 17 * s)} ${f(x)},${f(y - 17 * s)}Q${f(x + 8.5 * s)},${f(y - 17 * s)} ${f(x + 8.5 * s)},${f(y - 5 * s)}Z"/>`;
      } else if (hatR < 0.64) {
        out += `<path class="${cls}" d="M${f(x - 11 * s)},${f(y - 3 * s)}Q${f(x - 11.5 * s)},${f(y - 14.5 * s)} ${f(x)},${f(y - 14.5 * s)}Q${f(x + 11.5 * s)},${f(y - 14.5 * s)} ${f(x + 11 * s)},${f(y - 3 * s)}Z"/>`;
        out += `<path class="${cls}" d="M${f(x + side * 8 * s)},${f(y - 6 * s)}l${f(side * 11 * s)},${f(3.5 * s)}l${f(-side * 11 * s)},${f(1.5 * s)}Z"/>`;
      }
      // rim light on the shoulder and head
      const lw = Math.min(2.6, 1.5 * s);
      out += `<path class="sc-crowd-l-s" d="M${f(x - 24 * s)},${f(y + 27 * s)}Q${f(x - 24 * s)},${f(y + 14 * s)} ${f(x - 9 * s)},${f(y + 11 * s)}" stroke-width="${f(lw)}" fill="none"/>`;
      if (hatR >= 0.64) out += `<path class="sc-crowd-l-s" d="M${f(x - 9 * s)},${f(y - 2.5 * s)}A${f(9.3 * s)},${f(9.3 * s)} 0 0 1 ${f(x + 1 * s)},${f(y - 9.3 * s)}" stroke-width="${f(lw)}" fill="none"/>`;
    }
    return out;
  }

  function mic(x, top, rot) {
    const h = 600 - top;
    return (
      `<g transform="translate(${x} 600) rotate(${rot})">` +
      `<rect class="sc-crowd-b" x="-1.6" y="${-h}" width="3.2" height="${h}"/>` +
      `<rect class="sc-crowd-b" x="-7" y="${-h - 24}" width="14" height="28" rx="7"/>` +
      `<rect class="sc-accent" x="-4.5" y="${-h - 19}" width="9" height="2" rx="1"/>` +
      `<rect class="sc-accent" x="-4.5" y="${-h - 14}" width="9" height="2" rx="1"/>` +
      `<rect class="sc-accent" x="-4.5" y="${-h - 9}" width="9" height="2" rx="1"/>` +
      '</g>'
    );
  }

  const DOVE = 'M0,13Q9,3 18,10Q21,-2 35,1Q27,7 25,14Q33,11 42,16Q31,21 21,19Q10,20 0,13Z';
  function dove(x, y, s, rot, flip) {
    return `<path class="sc-dove" transform="translate(${x} ${y}) rotate(${rot}) scale(${flip ? -s : s} ${s})" d="${DOVE}"/>`;
  }

  let sceneCount = 0;
  /**
   * The illustration. `viewBox` crops the 600 x 840 master; colours come from the --sky-*, --fig-*,
   * --crowd-* ... custom properties of whatever element the scene sits in (see cards.css).
   */
  function scene(viewBox = '0 0 600 840', extraClass = '') {
    const id = 'sc' + ++sceneCount;
    const r = rng(77);
    let s = `<svg class="scene ${extraClass}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">`;
    s += `<defs><linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="840" gradientUnits="userSpaceOnUse"><stop offset="0" class="sc-sky-a"/><stop offset=".42" class="sc-sky-b"/><stop offset=".68" class="sc-sky-c"/></linearGradient>`;
    s += `<linearGradient id="${id}-haze" x1="0" y1="330" x2="0" y2="610" gradientUnits="userSpaceOnUse"><stop offset="0" class="sc-haze" stop-opacity="0"/><stop offset="1" class="sc-haze" stop-opacity="1"/></linearGradient>`;
    s += `<radialGradient id="${id}-glow" cx="300" cy="330" r="330" gradientUnits="userSpaceOnUse"><stop offset="0" class="sc-glow" stop-opacity=".9"/><stop offset=".5" class="sc-glow" stop-opacity=".35"/><stop offset="1" class="sc-glow" stop-opacity="0"/></radialGradient></defs>`;
    s += `<rect x="-100" y="-100" width="800" height="1040" fill="url(#${id}-sky)"/>`;
    s += `<g class="sc-ray">${burst(300, 330, 1100, 22, 0, 0.5, 4)}</g>`;
    s += `<circle cx="300" cy="330" r="330" fill="url(#${id}-glow)"/>`;
    s += `<circle class="sc-sun" cx="300" cy="330" r="166"/><circle class="sc-sun-ring" cx="300" cy="330" r="190" fill="none" stroke-width="5"/>`;

    // doves
    s += dove(58, 118, 1.05, -12, false) + dove(118, 62, 0.72, -6, false) + dove(250, 74, 0.55, 8, true);
    s += dove(402, 96, 0.9, 10, true) + dove(530, 52, 0.62, 4, true) + dove(26, 250, 0.6, -18, false);

    // distant city
    s += '<path class="sc-far2" d="M0,620V452H38V436H74V458H118V440H150V462H210V446H246V468H380V450H412V438H440V460H486V432H512V456H556V444H600V620Z"/>';
    // capitol, left
    s += '<g class="sc-far">';
    s += '<path d="M0,620V446H40V438H52L90,416L128,438H140V446H196V620Z"/>';
    s += '<rect x="62" y="394" width="56" height="46"/><path d="M57,396Q57,338 90,334Q123,338 123,396Z"/>';
    s += '<rect x="55" y="390" width="70" height="7"/><rect x="83" y="316" width="14" height="22"/><path d="M82,317Q90,303 98,317Z"/><rect x="89" y="290" width="2.4" height="18"/>';
    s += '<path d="M196,620V454H250V620Z"/><path d="M392,620V448H470V620Z"/>';
    // church and bell tower, right
    s += '<path d="M470,620V432Q486,432 489,415Q500,401 511,415Q514,432 526,432V620Z"/>';
    s += '<rect x="524" y="330" width="40" height="290"/><rect x="519" y="324" width="50" height="8"/><path d="M521,325L544,282L567,325Z"/><rect x="543" y="266" width="2.4" height="20"/>';
    s += '<path d="M564,620V440H600V620Z"/>';
    s += '</g>';
    // lit details on the far buildings
    s += '<g class="sc-far2">';
    for (let i = 0; i < 6; i++) s += `<rect x="${59 + i * 11.4}" y="446" width="4" height="40"/>`;
    for (let i = 0; i < 6; i++) s += `<rect x="${66 + i * 9}" y="402" width="3" height="32"/>`;
    s += '<path d="M533,372V352Q538,344 543,352V372ZM547,372V352Q552,344 557,352V372Z"/>';
    for (let i = 0; i < 4; i++) s += `<path d="M${399 + i * 17},500V478Q${405 + i * 17},468 ${411 + i * 17},478V500Z"/>`;
    for (let i = 0; i < 3; i++) s += `<rect x="${204 + i * 15}" y="470" width="7" height="13"/>`;
    for (let i = 0; i < 4; i++) s += `<rect x="${8 + i * 9}" y="458" width="4" height="12"/>`;
    for (let i = 0; i < 5; i++) s += `<rect x="${146 + i * 9.5}" y="458" width="4" height="12"/>`;
    s += '<circle cx="500" cy="436" r="6"/>';
    s += '</g>';
    s += `<rect x="-100" y="330" width="800" height="300" fill="url(#${id}-haze)"/>`;

    // palms and the big flag
    s += palm(212, 620, 222, 318, 1.0, r);
    s += palm(588, 620, 578, 250, 1.25, r);
    s += palm(18, 620, 8, 356, 0.9, r);
    s += flag(452, 172, 142, 86, 9, 0.6);

    // the speaker
    s += '<g class="sc-hero">';
    s += '<path class="sc-fig-m" d="M300,356Q320,350 340,356L378,372L408,392Q419,400 421,422L428,660H236L240,425L232,412L268,376Z"/>';
    s += '<path class="sc-fig-d" opacity=".42" d="M338,356L378,372L408,392Q419,400 421,422L428,660H352L342,430Z"/>';
    s += '<path class="sc-fig-l" opacity=".55" d="M240,425L250,424L246,660H236Z"/>';
    s += '<path class="sc-ink" d="M304,356H336L320,392Z"/>';
    s += '<path class="sc-fig-l" d="M298,354L320,394L292,387L281,366Z"/><path class="sc-fig-l" d="M342,354L320,394L348,387L359,366Z"/>';
    s += '<path class="sc-fig-d" opacity=".55" d="M342,354L320,394L348,387L359,366Z"/>';
    s += '<path class="sc-fig-d" opacity=".6" d="M318.5,394H322.5L325,660H318.5Z"/>';
    s += '<circle class="sc-fig-l" cx="321" cy="432" r="3"/><circle class="sc-fig-l" cx="321.5" cy="482" r="3"/><circle class="sc-fig-l" cx="322" cy="532" r="3"/>';
    s += '<path class="sc-fig-d" opacity=".34" d="M258,448L302,444L304,500L260,504Z"/><path class="sc-fig-l" d="M255,441L304,437V453L280,462L255,457Z"/><circle class="sc-fig-d" cx="280" cy="453" r="2.4"/>';
    s += '<path class="sc-fig-d" opacity=".4" d="M340,444L384,448V504L340,500Z"/><path class="sc-fig-l" opacity=".75" d="M338,437L387,441V457L362,462L338,453Z"/><circle class="sc-fig-d" cx="362" cy="453" r="2.4"/>';
    s += '<path class="sc-fig-l" d="M262,379L290,362L296,371L268,389Z"/><path class="sc-fig-l" opacity=".7" d="M378,379L350,362L344,371L372,389Z"/>';
    // raised arm
    s += '<path class="sc-fig-m" d="M270,378L199,302L184,229L148,235L159,316Q160,326 166,332L230,412Q250,422 268,400Z"/>';
    s += '<path class="sc-fig-l" opacity=".8" d="M148,235L159,316Q160,326 166,332L230,412L223,393L173,322L161,235Z"/>';
    s += '<path class="sc-fig-d" opacity=".4" d="M270,378L199,302L184,229L175,231L189,307L256,385Z"/>';
    s += '<path class="sc-fig-d" opacity=".55" d="M230,412Q250,420 267,402L262,397Q250,410 234,405Z"/>';
    s += '<path class="sc-fig-l" d="M145,238L187,230L190,247L148,255Z"/><path class="sc-fig-d" opacity=".4" d="M172,233L187,230L190,247L175,250Z"/>';
    s += '<g transform="translate(166 232) rotate(-10)">';
    s += '<rect class="sc-skin" x="-17" y="-40" width="34" height="44" rx="9"/>';
    s += '<rect class="sc-skin" x="-17" y="-74" width="7.8" height="42" rx="3.9" transform="rotate(-9 -13 -36)"/>';
    s += '<rect class="sc-skin" x="-8.4" y="-81" width="7.8" height="48" rx="3.9" transform="rotate(-3 -4.5 -36)"/>';
    s += '<rect class="sc-skin" x="0.5" y="-80" width="7.8" height="47" rx="3.9" transform="rotate(3 4.4 -36)"/>';
    s += '<rect class="sc-skin" x="9.3" y="-72" width="7.8" height="40" rx="3.9" transform="rotate(9 13.2 -36)"/>';
    s += '<rect class="sc-skin" x="12.5" y="-36" width="9.5" height="30" rx="4.7" transform="rotate(40 17 -8)"/>';
    s += '<rect class="sc-skin-d" opacity=".55" x="3" y="-40" width="14" height="44" rx="7"/>';
    s += '</g>';
    // head
    s += '<path class="sc-skin-d" d="M302,336H338L336,362H304Z"/>';
    s += '<rect class="sc-skin-d" x="285" y="284" width="8" height="20" rx="4"/><rect class="sc-skin-d" x="347" y="284" width="8" height="20" rx="4"/>';
    s += '<path class="sc-skin" d="M291,260H349V302Q349,322 338,334H302Q291,322 291,302Z"/>';
    s += '<path class="sc-skin-d" opacity=".7" d="M331,260H349V302Q349,322 338,334H327Q336,300 331,260Z"/>';
    s += '<path class="sc-skin-d" d="M291,266H349V283Q320,290 291,283Z"/>';
    s += '<path class="sc-ink" d="M299,276L314,274.5V278L299,279.5ZM326,274.5L341,276V279.5L326,278Z"/>';
    s += '<ellipse class="sc-ink" cx="307" cy="283" rx="4.6" ry="2"/><ellipse class="sc-ink" cx="334" cy="283" rx="4.6" ry="2"/>';
    s += '<path class="sc-skin-d" d="M321,284L328,306H315Z"/>';
    s += '<path class="sc-beard" d="M291,286L288,312Q290,344 306,359Q320,369 334,359Q350,344 352,312L349,286L345,301Q341,309 333,308.500L324,307Q320,305.500 316,307L307,308.500Q299,309 295,301Z"/>';
    s += '<path class="sc-beard-l" opacity=".55" d="M294,316Q297,342 311,355Q302,340 300,318Z"/>';
    s += '<path class="sc-skin-d" d="M312,321Q320,324 328,321Q320,327.500 312,321Z"/>';
    s += '<path class="sc-fig-m" d="M286,258L287,232Q320,217 353,232L354,258Z"/>';
    s += '<path class="sc-fig-l" opacity=".75" d="M286,258L289,230Q300,224 309,221.500L305,258Z"/>';
    s += '<path class="sc-fig-d" opacity=".45" d="M335,222.500Q346,226 351,230L354,258H338Z"/>';
    s += '<rect class="sc-fig-d" x="285" y="251" width="70" height="11"/>';
    s += '<path class="sc-ink" d="M285,261Q320,255 355,261L359,271Q320,262.500 281,271Z"/>';
    s += '</g>';

    // lectern, microphones
    s += '<path class="sc-crowd-b" d="M248,598H396L404,660H240Z"/>';
    s += mic(297, 488, -9) + mic(322, 470, 2) + mic(348, 492, 11);

    // the crowd
    s += crowdRow(r, { n: 25, s: 1.72, yMid: 606, yEdge: 486, cls: 'sc-crowd-a', items: true });
    s += crowdRow(r, { n: 11, s: 3.1, yMid: 722, yEdge: 612, cls: 'sc-crowd-b', items: false });
    return s + '</svg>';
  }

  /* ------------------------------------------------- shared filters and metals */

  const stops = (list) => list.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('');
  const METALS = {
    gold: [[0, '#fff4bf'], [0.22, '#f1cd68'], [0.5, '#c08a25'], [0.62, '#8d5e13'], [0.82, '#c99a3a'], [1, '#f5df96']],
    goldsoft: [[0, '#f8e39a'], [0.5, '#d2a23a'], [1, '#8a5d14']],
    bronze: [[0, '#e9bb85'], [0.3, '#b97b3c'], [0.6, '#74431a'], [0.85, '#9a6330'], [1, '#d7a36a']],
    brass: [[0, '#fff0b4'], [0.3, '#dcb95e'], [0.58, '#9d7426'], [0.8, '#c7a24a'], [1, '#f1dc97']],
    steel: [[0, '#f1f4f6'], [0.28, '#aeb7bf'], [0.52, '#68727b'], [0.72, '#98a2ab'], [1, '#d5dbe0']],
    gun: [[0, '#6f7880'], [0.3, '#474e55'], [0.6, '#24292e'], [0.85, '#3a4147'], [1, '#5a636b']],
    silver: [[0, '#ffffff'], [0.3, '#cfd6dc'], [0.55, '#8a949d'], [0.8, '#c3cbd2'], [1, '#f2f5f7']],
  };

  function defs() {
    let g = '';
    for (const [name, list] of Object.entries(METALS)) {
      g += `<linearGradient id="g-${name}" x1="0" y1="0" x2="0" y2="1">${stops(list)}</linearGradient>`;
      g += `<linearGradient id="g-${name}-h" x1="0" y1="0" x2="1" y2="0">${stops(list)}</linearGradient>`;
      g += `<linearGradient id="g-${name}-d" x1="0" y1="0" x2="1" y2="1">${stops(list)}</linearGradient>`;
      g += `<radialGradient id="g-${name}-r" cx=".34" cy=".3" r=".8">${stops([[0, list[0][1]], [0.45, list[Math.min(2, list.length - 2)][1]], [1, list[Math.min(3, list.length - 1)][1]]])}</radialGradient>`;
    }
    const light = '<feDistantLight azimuth="225" elevation="52"/>';
    // Flat faces would otherwise pick up a constant specular wash (cos(19deg)^22 of the light), which
    // greys out dark stone and wood; the colour matrix subtracts it so only the edges catch light.
    const bevel = (id, blur, scale, spec, shade = 1.28) =>
      `<filter id="${id}" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">` +
      `<feGaussianBlur in="SourceAlpha" stdDeviation="${blur}" result="b"/>` +
      `<feSpecularLighting in="b" surfaceScale="${scale}" specularConstant="${spec}" specularExponent="22" lighting-color="#fff" result="s0">${light}</feSpecularLighting>` +
      `<feColorMatrix in="s0" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1.35 ${f(-1.35 * 0.29 * spec)}" result="s"/>` +
      '<feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/>' +
      `<feDiffuseLighting in="b" surfaceScale="${scale}" diffuseConstant="${shade}" lighting-color="#fff" result="d">${light}</feDiffuseLighting>` +
      '<feComposite in="d" in2="SourceAlpha" operator="in" result="d2"/>' +
      '<feBlend in="SourceGraphic" in2="d2" mode="multiply" result="m"/>' +
      '<feComposite in="m" in2="s2" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/>' +
      '</filter>';
    const f1 =
      bevel('f-bevel', 1.4, 4, 0.75) +
      bevel('f-bevel-s', 0.7, 2.4, 0.6) +
      bevel('f-bevel-l', 3, 7, 0.8) +
      bevel('f-bevel-xl', 5, 10, 0.7) +
      // grain multiplied into a shape (stone, cast metal)
      '<filter id="f-grit" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
      '<feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" seed="4" result="n"/>' +
      '<feColorMatrix in="n" type="matrix" values=".4 .4 .4 0 -.05  .4 .4 .4 0 -.05  .4 .4 .4 0 -.05  0 0 0 0 1" result="g"/>' +
      '<feBlend in="g" in2="SourceGraphic" mode="soft-light" result="o"/><feComposite in="o" in2="SourceAlpha" operator="in"/></filter>' +
      // marble veins
      '<filter id="f-marble" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
      '<feTurbulence type="turbulence" baseFrequency=".005 .009" numOctaves="5" seed="11" result="n"/>' +
      '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -13 0 0 0 .92" result="v"/>' +
      '<feFlood flood-color="#cfe9dc" flood-opacity=".8" result="c"/><feComposite in="c" in2="v" operator="in" result="veins"/>' +
      '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 -9 0 0 .62" result="v2"/>' +
      '<feFlood flood-color="#7fb39d" flood-opacity=".55" result="c2"/><feComposite in="c2" in2="v2" operator="in" result="veins2"/>' +
      '<feTurbulence type="fractalNoise" baseFrequency=".01 .016" numOctaves="4" seed="5" result="n2"/>' +
      '<feColorMatrix in="n2" type="matrix" values=".6 .6 .6 0 -.3  .6 .6 .6 0 -.3  .6 .6 .6 0 -.3  0 0 0 0 1" result="cloud"/>' +
      '<feBlend in="cloud" in2="SourceGraphic" mode="overlay" result="base"/>' +
      '<feMerge result="mm"><feMergeNode in="base"/><feMergeNode in="veins2"/><feMergeNode in="veins"/></feMerge>' +
      '<feComposite in="mm" in2="SourceAlpha" operator="in"/></filter>' +
      // wood grain
      '<filter id="f-wood" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
      '<feTurbulence type="fractalNoise" baseFrequency=".014 .3" numOctaves="4" seed="8" result="n"/>' +
      '<feColorMatrix in="n" type="matrix" values=".62 .62 .62 0 -.47  .62 .62 .62 0 -.47  .62 .62 .62 0 -.47  0 0 0 0 1" result="g"/>' +
      '<feBlend in="g" in2="SourceGraphic" mode="overlay" result="o"/>' +
      '<feTurbulence type="fractalNoise" baseFrequency=".003 .02" numOctaves="3" seed="21" result="n2"/>' +
      '<feColorMatrix in="n2" type="matrix" values=".5 .5 .5 0 -.28  .5 .5 .5 0 -.28  .5 .5 .5 0 -.28  0 0 0 0 1" result="g2"/>' +
      '<feBlend in="g2" in2="o" mode="soft-light" result="o2"/><feComposite in="o2" in2="SourceAlpha" operator="in"/></filter>' +
      // brushed metal
      '<filter id="f-brushed" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
      '<feTurbulence type="fractalNoise" baseFrequency=".004 .7" numOctaves="3" seed="2" result="n"/>' +
      '<feColorMatrix in="n" type="matrix" values=".5 .5 .5 0 -.12  .5 .5 .5 0 -.12  .5 .5 .5 0 -.12  0 0 0 0 1" result="g"/>' +
      '<feBlend in="g" in2="SourceGraphic" mode="overlay" result="o"/><feComposite in="o" in2="SourceAlpha" operator="in"/></filter>' +
      // pebbled leather
      '<filter id="f-leather" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
      '<feTurbulence type="fractalNoise" baseFrequency=".55" numOctaves="2" seed="9" result="n"/>' +
      '<feDiffuseLighting in="n" surfaceScale="1.5" diffuseConstant="1.15" lighting-color="#fff" result="d"><feDistantLight azimuth="225" elevation="58"/></feDiffuseLighting>' +
      '<feBlend in="SourceGraphic" in2="d" mode="multiply" result="o"/><feComposite in="o" in2="SourceAlpha" operator="in"/></filter>' +
      // worn ink for rubber stamps
      '<filter id="f-stamp" x="-5%" y="-5%" width="110%" height="110%">' +
      '<feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="3" result="w"/><feDisplacementMap in="SourceGraphic" in2="w" scale="2.2" result="dsp"/>' +
      '<feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="2" seed="6" result="n"/>' +
      '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.6 1.75" result="mask"/>' +
      '<feComposite in="dsp" in2="mask" operator="in"/></filter>' +
      // the same, lightly worn: for large stencilled lettering that must stay legible
      '<filter id="f-stamp-l" x="-5%" y="-5%" width="110%" height="110%">' +
      '<feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="3" result="w"/><feDisplacementMap in="SourceGraphic" in2="w" scale="1.6" result="dsp"/>' +
      '<feTurbulence type="fractalNoise" baseFrequency=".45" numOctaves="2" seed="6" result="n"/>' +
      '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3.4 2.55" result="mask"/>' +
      '<feComposite in="dsp" in2="mask" operator="in"/></filter>' +
      // hand-cut edge for printed shapes
      '<filter id="f-rough" x="-3%" y="-3%" width="106%" height="106%">' +
      '<feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="7" result="w"/><feDisplacementMap in="SourceGraphic" in2="w" scale="2.4"/></filter>' +
      // soft drop shadow
      '<filter id="f-drop" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur in="SourceAlpha" stdDeviation="3"/><feOffset dy="3" result="o"/><feComponentTransfer><feFuncA type="linear" slope=".55"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<filter id="f-drop-s" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur in="SourceAlpha" stdDeviation="1.2"/><feOffset dy="1.4" result="o"/><feComponentTransfer><feFuncA type="linear" slope=".6"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      // inner shadow, for recessed windows
      '<filter id="f-inset" x="-5%" y="-5%" width="110%" height="110%"><feComponentTransfer in="SourceAlpha"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer><feGaussianBlur stdDeviation="5"/><feOffset dx="2" dy="5" result="sh"/><feFlood flood-color="#000" flood-opacity=".8"/><feComposite in2="sh" operator="in"/><feComposite in2="SourceAlpha" operator="in"/></filter>';
    return `<svg class="art-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>${g}${f1}</defs></svg>`;
  }

  window.CardArt = { scene, defs, starD, starFacets, starPoints, orderStar, laurel, globe, burst, rosette, guillocheBand, screw, rivet, palm, crowdRow, dove, rng, f, rad };
})();
