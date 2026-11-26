// 10 Prismatic: the premium printing. Full-bleed art, a crystal value gem, and holographic foil
// that shifts as the card tilts.
(function () {
  const A = window.CardArt;
  const FOIL = (p) => `<linearGradient id="${p}-foil" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8ad8"/><stop offset=".25" stop-color="#ffd86e"/><stop offset=".5" stop-color="#7dffcf"/><stop offset=".75" stop-color="#6eaaff"/><stop offset="1" stop-color="#c88bff"/></linearGradient>`;
  // a cut gem: hexagon table with facets
  function gem(cx, cy, R) {
    const P = (r, a) => [cx + r * Math.cos(A.rad(a)), cy + r * Math.sin(A.rad(a))];
    const outer = [];
    const inner = [];
    for (let i = 0; i < 6; i++) {
      outer.push(P(R, -90 + i * 60));
      inner.push(P(R * 0.6, -90 + i * 60));
    }
    const pt = (q) => A.f(q[0]) + ',' + A.f(q[1]);
    let s = `<path d="M${outer.map(pt).join('L')}Z" fill="url(#d10-gem)"/>`;
    const shade = [0.5, 0.18, 0, 0.12, 0.38, 0.62];
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6;
      const lightness = shade[i];
      s += `<path d="M${pt(outer[i])}L${pt(outer[j])}L${pt(inner[j])}L${pt(inner[i])}Z" fill="${lightness > 0.3 ? '#fff' : '#000'}" opacity="${A.f(lightness > 0.3 ? lightness - 0.2 : 0.34 - lightness)}"/>`;
    }
    s += `<path d="M${inner.map(pt).join('L')}Z" fill="#fff" opacity=".1"/>`;
    s += `<path d="M${outer.map(pt).join('L')}Z" fill="none" stroke="url(#d10-foil)" stroke-width="2.4"/>`;
    s += `<path d="M${inner.map(pt).join('L')}Z" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".8"/>`;
    return s;
  }

  function front(c) {
    return `
<div class="art d10-art">${A.scene('0 0 600 840')}</div>
<div class="abs d10-shade"></div>
<svg class="frame" viewBox="0 0 500 700">
  <defs>${FOIL('d10')}
    <linearGradient id="d10-gem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6ff3ff"/><stop offset=".45" stop-color="#3d6dff"/><stop offset="1" stop-color="#8a2be2"/></linearGradient>
    <filter id="d10-halo" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="10"/></filter>
  </defs>
  <circle cx="72" cy="74" r="44" fill="#5aa8ff" opacity=".7" filter="url(#d10-halo)"/>
  <g filter="url(#f-drop)">${gem(72, 74, 52)}</g>
  <text x="72" y="97" text-anchor="middle" class="d10-value">${c.value}</text>
  <g fill="none" stroke="url(#d10-foil)"><path d="M40,478H190M310,478H460" stroke-width="1.2"/></g>
  <path d="${A.starD(250, 478, 9)}" fill="url(#d10-foil)"/>
  <g fill="url(#d10-foil)"><path d="${A.starD(250, 664, 7)}"/></g>
  <text x="46" y="669" class="d10-foot" fill="url(#d10-foil)">${c.no} / 事件</text>
  <text x="454" y="669" text-anchor="end" class="d10-foot" fill="url(#d10-foil)">${c.side.toUpperCase()} · 1959</text>
</svg>
<div class="abs d10-era">${c.era}<span>${c.eraSpan}</span></div>
<div class="abs d10-copy">
  <p class="kicker">${c.place} · ${c.date}</p>
  <h3>${c.title}</h3>
</div>
<div class="abs d10-text"><p class="rules">${c.text}</p><p class="note">${CardZh.highlight(c.note)}</p></div>
<div class="abs d10-rim"></div>
<div class="abs d10-holo"></div><div class="abs d10-spark"></div>`;
  }

  function back() {
    let stars = '';
    const r = A.rng(31);
    for (let i = 0; i < 110; i++) {
      const x = 20 + r() * 460;
      const y = 20 + r() * 660;
      if (Math.hypot(x - 250, y - 350) < 150) continue;
      stars += `<circle cx="${A.f(x)}" cy="${A.f(y)}" r="${A.f(0.4 + r() * 1.3)}" opacity="${A.f(0.25 + r() * 0.7)}"/>`;
    }
    const big = A.orderStar(250, 350, 210, 12, 0.5, 0.74);
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>${FOIL('d10b')}
    <radialGradient id="d10b-core" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#3a1b7a"/><stop offset=".6" stop-color="#1a0b3c"/><stop offset="1" stop-color="#0a0418"/></radialGradient>
    <filter id="d10b-halo" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="16"/></filter>
  </defs>
  <g fill="#fff">${stars}</g>
  <path d="${big.d}" fill="url(#d10b-foil)" opacity=".16"/>
  <circle cx="250" cy="350" r="120" fill="#7a4dff" opacity=".5" filter="url(#d10b-halo)"/>
  <g fill="none" stroke="url(#d10b-foil)">
    <ellipse cx="250" cy="350" rx="206" ry="74" stroke-width="1.2" transform="rotate(-28 250 350)"/>
    <ellipse cx="250" cy="350" rx="206" ry="74" stroke-width="1.2" transform="rotate(28 250 350)"/>
    <circle cx="250" cy="350" r="150" stroke-width="1" stroke-dasharray="2 6"/>
  </g>
  <circle cx="250" cy="350" r="112" fill="url(#d10b-core)" stroke="url(#d10b-foil)" stroke-width="3"/>
  <g stroke="url(#d10b-foil)">${A.globe(250, 350, 82, 2.4)}</g>
  <g fill="url(#d10b-foil)"><path d="${A.starD(250, 350, 22)}"/><circle cx="68" cy="255" r="6"/><circle cx="432" cy="445" r="6"/>
    <path d="${A.starD(250, 92, 10)}"/><path d="${A.starD(250, 608, 10)}"/></g>
  <text x="250" y="132" text-anchor="middle" class="d10-backline" fill="url(#d10b-foil)">1945</text>
  <text x="250" y="580" text-anchor="middle" class="d10-backline" fill="url(#d10b-foil)">1989</text>
</svg>
<div class="abs d10-rim"></div>
<div class="abs d10-holo"></div><div class="abs d10-spark"></div>`;
  }

  window.CardDesigns = window.CardDesigns || [];
  window.CardDesigns.push({
    id: '10',
    name: 'Prismatic',
    concept: 'The premium printing: full-bleed art, a cut-crystal value gem and holographic foil that shifts as the card tilts.',
    notes: [
      ['Frame', 'None. The art runs to the edge inside a hairline foil rim; text sits on a dusk gradient.'],
      ['Value', 'A faceted sapphire with a soft halo, top left.'],
      ['Back', 'A globe in foil line over a star field, with crossing orbits.'],
      ['Type', 'Bebas Neue title, Oswald for labels and rules.'],
    ],
    front,
    back,
  });
})();
