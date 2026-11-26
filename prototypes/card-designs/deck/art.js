// Illustrations for the deck. Every card gets its own small scene, composed from a sky, a sun, a
// skyline, a ground, a few subjects and a foreground. Flat poster shapes only; the colours come from
// the --sky-*, --far*, --fig-* custom properties set per side in deck/art.css.
//
// A scene is written as one line:
//   "sky:rays sun:220,180,110 far:berlin ground:land transport@250,120*1.1 flag@90,400~ fore:crowd"
//     sky:rays | rings | bars | plain      night            (dark sky, the sun becomes a moon)
//     sun:x,y,r | sun:none                 horizon:300      (y of the ground line, canvas is 440 x 440)
//     far:name or far:back+front           ground:land | sea | snow | sand | moon | none
//     fore:name or fore:a+b
//     part@x,y  then optionally *scale  ~ (mirror)  ^degrees  :variant      e.g. tank@220,400*1.2~:b
//
// The drawings themselves are registered by the parts-*.js files:
//   DeckArt.far(name, fn)   fn({r}) -> markup. x runs 0..440, y = 0 is the horizon, up is negative.
//                           Fill the body down to y = 40. Use class sc-far for the mass, sc-far2 for lit detail.
//   DeckArt.part(name, fn)  fn({r, v}) -> markup. The origin is where the thing stands (bottom centre),
//                           up is negative. At scale 1 a standing adult is 120 tall.
//   DeckArt.fore(name, fn)  fn({r, H}) -> markup in canvas coordinates, for the bottom strip.
(function () {
  'use strict';
  const A = window.CardArt;
  const f = A.f;
  const R = { far: {}, part: {}, fore: {} };
  const missing = new Set();
  const src = () => ((document.currentScript && document.currentScript.src) || '').replace(/^.*\/|\.js.*$/g, '');
  const reg = (kind) => (name, fn) => {
    fn.src = src();
    R[kind][name] = fn;
  };
  let count = 0;

  const TOKEN = /^([a-z0-9-]+)@(-?[\d.]+),(-?[\d.]+)(?:\*([\d.]+))?(~)?(?:\^(-?[\d.]+))?(?::([a-z0-9-]+))?$/;
  function parse(spec) {
    const t = { sky: 'rays', night: false, sun: [220, 190, 110], far: [], ground: 'land', fore: [], horizon: 300, parts: [] };
    for (const tok of spec.trim().split(/\s+/)) {
      const m = TOKEN.exec(tok);
      if (m) {
        t.parts.push({ name: m[1], x: +m[2], y: +m[3], s: m[4] ? +m[4] : 1, flip: !!m[5], rot: m[6] ? +m[6] : 0, v: m[7] || '' });
        continue;
      }
      const i = tok.indexOf(':');
      const k = i < 0 ? tok : tok.slice(0, i);
      const v = i < 0 ? '' : tok.slice(i + 1);
      if (k === 'night') t.night = true;
      else if (k === 'sun') t.sun = v === 'none' ? null : v.split(',').map(Number);
      else if (k === 'far' || k === 'fore') t[k] = v.split('+');
      else if (k === 'horizon') t.horizon = +v;
      else if (k === 'sky' || k === 'ground') t[k] = v;
      else console.warn('DeckArt: cannot read "' + tok + '"');
    }
    return t;
  }

  function sky(t, id, r) {
    const H = t.horizon;
    const [sx, sy, sr] = t.sun || [220, 190, 0];
    let s =
      `<defs><linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="${H + 30}" gradientUnits="userSpaceOnUse"><stop offset="0" class="sc-sky-a"/><stop offset=".62" class="sc-sky-b"/><stop offset="1" class="sc-sky-c"/></linearGradient>` +
      `<linearGradient id="${id}-haze" x1="0" y1="${H - 120}" x2="0" y2="${H + 10}" gradientUnits="userSpaceOnUse"><stop offset="0" class="sc-haze" stop-opacity="0"/><stop offset="1" class="sc-haze" stop-opacity="1"/></linearGradient>` +
      `<radialGradient id="${id}-glow" cx="${sx}" cy="${sy}" r="${f(sr * 2.1)}" gradientUnits="userSpaceOnUse"><stop offset="0" class="sc-glow" stop-opacity=".9"/><stop offset=".5" class="sc-glow" stop-opacity=".3"/><stop offset="1" class="sc-glow" stop-opacity="0"/></radialGradient></defs>` +
      `<rect x="-20" y="-20" width="480" height="480" fill="url(#${id}-sky)"/>`;
    if (t.sky === 'rays') s += `<g class="sc-ray">${A.burst(sx, sy, 700, 20, 0, 0.5, 4)}</g>`;
    else if (t.sky === 'rings') {
      const base = Math.max(sr, 40);
      for (let i = 1; i <= 4; i++) s += `<circle class="sc-ray" cx="${sx}" cy="${sy}" r="${f(base + i * 62)}" fill="none" stroke="currentColor" stroke-width="22"/>`;
    } else if (t.sky === 'bars') {
      s += '<g class="sc-ray" transform="rotate(-24 220 220)">';
      for (let i = 0; i < 5; i++) s += `<rect x="-200" y="${-60 + i * 104}" width="840" height="44"/>`;
      s += '</g>';
    }
    if (t.night) {
      s += '<rect class="sc-ink" x="-20" y="-20" width="480" height="480" opacity=".8"/>';
      for (let i = 0; i < 46; i++) s += `<circle class="sc-sun" cx="${f(r() * 440)}" cy="${f(r() * (H - 20))}" r="${f(0.8 + r() * 1.5)}" opacity="${f(0.45 + r() * 0.5)}"/>`;
    }
    if (t.sun) {
      s += `<circle cx="${sx}" cy="${sy}" r="${f(sr * 2.1)}" fill="url(#${id}-glow)"/>`;
      s += `<circle class="sc-sun" cx="${sx}" cy="${sy}" r="${sr}"/><circle class="sc-sun-ring" cx="${sx}" cy="${sy}" r="${f(sr * 1.15)}" fill="none" stroke-width="4"/>`;
    }
    return s;
  }

  function ground(t, r) {
    const H = t.horizon;
    const h = 442 - H;
    const sx = t.sun ? t.sun[0] : 220;
    if (t.ground === 'none') return '';
    if (t.ground === 'sea') {
      let s = `<rect class="sc-far" x="0" y="${H}" width="440" height="${h}"/><rect class="sc-ink" x="0" y="${H}" width="440" height="${h}" opacity=".18"/>`;
      for (let i = 0; i < 8; i++) {
        const w = 30 + i * 17;
        s += `<rect class="sc-sun" opacity="${f(0.8 - i * 0.07)}" x="${f(sx - w / 2 + (i % 2 ? 7 : -7))}" y="${f(H + 5 + i * 7 + i * i * 1.7)}" width="${w}" height="${f(2.2 + i * 0.5)}" rx="1.4"/>`;
      }
      for (let i = 0; i < 26; i++) {
        const y = H + 8 + r() * (h - 14);
        const w = 14 + ((y - H) / h) * 40 * (0.5 + r());
        s += `<rect class="sc-far2" opacity=".55" x="${f(r() * 440 - w / 2)}" y="${f(y)}" width="${f(w)}" height="${f(1.6 + ((y - H) / h) * 2)}" rx="1"/>`;
      }
      return s;
    }
    if (t.ground === 'snow')
      return `<rect class="sc-sun" x="0" y="${H}" width="440" height="${h}"/><path class="sc-far2" opacity=".55" d="M0,${H + 26}Q120,${H + 8} 230,${H + 30}T440,${H + 22}V442H0Z"/>`;
    if (t.ground === 'sand')
      return `<rect class="sc-far2" x="0" y="${H}" width="440" height="${h}"/><path class="sc-far" opacity=".55" d="M0,${H + 34}Q90,${H + 6} 200,${H + 30}T440,${H + 16}V442H0Z"/><path class="sc-mid" opacity=".5" d="M0,${H + 92}Q150,${H + 58} 300,${H + 88}T440,${H + 80}V442H0Z"/>`;
    if (t.ground === 'moon') {
      let s = `<rect class="sc-fig-l" x="0" y="${H}" width="440" height="${h}"/><path class="sc-sun" opacity=".5" d="M0,${H}H440V${H + 5}H0Z"/>`;
      for (const [x, y, w] of [[70, 28, 46], [300, 20, 30], [372, 62, 64], [170, 82, 80], [40, 104, 54]])
        s += `<ellipse class="sc-fig-m" cx="${x}" cy="${H + y}" rx="${w / 2}" ry="${f(w / 7)}"/><path class="sc-sun" opacity=".45" d="M${x - w / 2},${H + y}a${w / 2},${f(w / 7)} 0 0 0 ${w},0a${w / 2},${f(w / 5)} 0 0 1 ${-w},0Z"/>`;
      return s;
    }
    return (
      `<rect class="sc-far" x="0" y="${H}" width="440" height="${h}"/><rect class="sc-ink" x="0" y="${H}" width="440" height="${h}" opacity=".3"/>` +
      `<path class="sc-ink" opacity=".22" d="M0,${H + 46}Q130,${H + 30} 250,${H + 52}T440,${H + 44}V442H0Z"/>`
    );
  }

  function scene(spec) {
    if (spec === 'havana') return A.scene('84 122 440 440');
    const id = 'da' + ++count;
    const t = parse(spec);
    let seed = 7;
    for (let i = 0; i < spec.length; i++) seed = (seed * 31 + spec.charCodeAt(i)) >>> 0;
    const r = A.rng(seed);
    const H = t.horizon;
    let s = `<svg class="scene" viewBox="0 0 440 440" preserveAspectRatio="xMidYMid slice" aria-hidden="true">` + sky(t, id, r);
    t.far.forEach((name, i) => {
      const fn = R.far[name];
      if (!fn) return name === 'none' || name === 'sea' ? 0 : missing.add('far:' + name);
      s += `<g transform="translate(0 ${H})"${i < t.far.length - 1 ? ' class="is-back"' : ''}>${fn({ r })}</g>`;
    });
    s += `<rect x="-20" y="${H - 120}" width="480" height="130" fill="url(#${id}-haze)"/>`;
    s += ground(t, r);
    for (const p of t.parts) {
      const fn = R.part[p.name];
      if (!fn) {
        missing.add(p.name);
        continue;
      }
      s += `<g transform="translate(${p.x} ${p.y})${p.rot ? ` rotate(${p.rot})` : ''} scale(${p.flip ? -p.s : p.s} ${p.s})">${fn({ r, v: p.v })}</g>`;
    }
    for (const name of t.fore) {
      const fn = R.fore[name];
      if (!fn) {
        missing.add('fore:' + name);
        continue;
      }
      s += fn({ r, H });
    }
    return s + '</svg>';
  }

  const DeckArt = { far: reg('far'), part: reg('part'), fore: reg('fore'), scene, parse, R, missing };
  window.DeckArt = DeckArt;

  /* ---- the few pieces the first sheet already had ---- */
  DeckArt.part('palm', ({ r }) => A.palm(0, 0, 9, -150, 0.9, r));
  DeckArt.part('dove', () => A.dove(-21, -10, 1, 0, false));
  // a crowd rising at the sides, the way it frames the speaker on the Havana card
  const crowd = (dy) => ({ r }) =>
    `<g transform="translate(-80 ${dy})">` +
    A.crowdRow(r, { n: 25, s: 1.72, yMid: 606, yEdge: 486, cls: 'sc-crowd-a', items: true }) +
    A.crowdRow(r, { n: 11, s: 3.1, yMid: 722, yEdge: 612, cls: 'sc-crowd-b', items: false }) +
    '</g>';
  DeckArt.fore('crowd', crowd(-212));
  DeckArt.fore('crowd-low', crowd(-176));
})();
