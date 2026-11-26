// 06 Treasury: intaglio engraving on cotton paper, with guilloche lathe-work and a red serial.
(function () {
  const A = window.CardArt;
  const INK = '#143a2a';

  function border(p) {
    // lathe-work band around the sheet, with solid rules either side
    return (
      `<g stroke="${INK}" opacity=".9">` +
      A.guillocheBand(46, 454, 29, 8, 17, 6, 0.55) +
      A.guillocheBand(46, 454, 671, 8, 17, 6, 0.55) +
      `<g transform="translate(29 0) rotate(90)">${A.guillocheBand(46, 654, 0, 8, 25, 6, 0.55)}</g>` +
      `<g transform="translate(471 0) rotate(90)">${A.guillocheBand(46, 654, 0, 8, 25, 6, 0.55)}</g>` +
      '</g>' +
      `<rect x="14" y="14" width="472" height="672" rx="6" fill="none" stroke="${INK}" stroke-width="2.4"/>` +
      `<rect x="19" y="19" width="462" height="662" rx="3" fill="none" stroke="${INK}" stroke-width=".7"/>` +
      `<rect x="40" y="40" width="420" height="620" fill="none" stroke="${INK}" stroke-width="1.6"/>` +
      `<rect x="44" y="44" width="412" height="612" fill="none" stroke="${INK}" stroke-width=".6"/>` +
      `<pattern id="${p}-tint" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0,3Q1.500,1 3,3T6,3" fill="none" stroke="#3f7a5c" stroke-opacity=".28" stroke-width=".5"/></pattern>`
    );
  }
  const cornerRose = (x, y, r, inner) =>
    `<circle cx="${x}" cy="${y}" r="${r + 3}" fill="#efe6cd"/>` +
    `<g stroke="${INK}">${A.rosette(x, y, r, { petals: 10, depth: 0.16, bands: 8, sw: 0.5 })}</g>` +
    `<circle cx="${x}" cy="${y}" r="${A.f(r * 0.62)}" fill="${INK}"/><circle cx="${x}" cy="${y}" r="${A.f(r * 0.54)}" fill="none" stroke="#efe6cd" stroke-width=".7"/>` +
    inner;

  function front(c) {
    const seal = A.orderStar(398, 318, 34, 14, 0.82, 0.92);
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>
    <clipPath id="d06-oval"><ellipse cx="250" cy="216" rx="150" ry="124"/></clipPath>
    <pattern id="d06-hatch" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height=".9" fill="#f1ead2" opacity=".3"/></pattern>
    <pattern id="d06-hatch2" width="3.500" height="3.500" patternUnits="userSpaceOnUse" patternTransform="rotate(52)"><rect width="3.500" height=".8" fill="#f1ead2" opacity=".13"/></pattern>
    <path id="d06-arc" d="M112,424Q250,396 388,424"/>
    ${border('d06')}
  </defs>
  <rect x="44" y="44" width="412" height="612" fill="url(#d06-tint)"/>
  <g stroke="#3f7a5c" opacity=".3" transform="translate(250 216) scale(1 .8) translate(-250 -216)">${A.rosette(250, 216, 190, { petals: 24, depth: 0.05, bands: 10, sw: 0.5 })}</g>
  ${border('d06x')}

  <!-- the vignette -->
  <g stroke="${INK}" transform="translate(250 216) scale(1 .835) translate(-250 -216)">${A.rosette(250, 216, 172, { petals: 30, depth: 0.045, bands: 8, sw: 0.55 })}</g>
  <ellipse cx="250" cy="216" rx="158" ry="132" fill="#efe6cd" stroke="${INK}" stroke-width="2.2"/>
  <g clip-path="url(#d06-oval)">
    <svg x="100" y="92" width="300" height="248">${A.scene('44 140 500 413')}</svg>
    <rect x="100" y="92" width="300" height="248" fill="url(#d06-hatch)"/><rect x="100" y="92" width="300" height="248" fill="url(#d06-hatch2)"/>
  </g>
  <ellipse cx="250" cy="216" rx="150" ry="124" fill="none" stroke="${INK}" stroke-width="1.4"/>
  <ellipse cx="250" cy="216" rx="154" ry="128" fill="none" stroke="${INK}" stroke-width=".5"/>

  <!-- title scroll -->
  <path d="M82,402Q250,372 418,402V444Q250,414 82,444Z" fill="#efe6cd" stroke="${INK}" stroke-width="1.8"/>
  <path d="M82,402L62,396L72,420L60,446L82,444Z" fill="#d9cfb2" stroke="${INK}" stroke-width="1.4"/><path d="M418,402L438,396L428,420L440,446L418,444Z" fill="#d9cfb2" stroke="${INK}" stroke-width="1.4"/>
  <path d="M90,408Q250,379 410,408M90,438Q250,409 410,438" fill="none" stroke="${INK}" stroke-width=".6"/>
  <text class="d06-title" text-anchor="middle"><textPath href="#d06-arc" startOffset="50%">${c.title.toUpperCase()}</textPath></text>

  <!-- red seal and serials -->
  <g opacity=".92"><path d="${seal.d}" fill="#b3261e"/><circle cx="398" cy="318" r="23" fill="none" stroke="#f1ead2" stroke-width="1"/><path d="${A.starD(398, 318.500, 13)}" fill="#f1ead2"/></g>
  <text x="448" y="66" text-anchor="end" class="d06-serial">A ${('00000' + c.no).slice(-8)} ★</text>
  <text x="54" y="386" class="d06-serial">A ${('00000' + c.no).slice(-8)} ★</text>
  <text x="126" y="64" class="d06-micro">${c.era.toUpperCase()} · ${c.eraSpan}</text>
  <text x="250" y="648" text-anchor="middle" class="d06-micro">${c.place.toUpperCase()} · 1959 · № ${c.no}</text>

  <!-- denomination -->
  ${cornerRose(72, 72, 44, `<text x="72" y="91" text-anchor="middle" class="d06-value">${c.value}</text>`)}
  ${cornerRose(446, 644, 22, `<text x="446" y="652" text-anchor="middle" class="d06-value sm">${c.value}</text>`)}
  ${cornerRose(54, 644, 22, `<path d="${A.starD(54, 644.500, 8)}" fill="#efe6cd"/>`)}
</svg>
<div class="abs d06-text"><p class="rules">${c.text}</p><p class="note">${CardZh.highlight(c.note)}</p></div>
<div class="abs d06-paper"></div>`;
  }

  function back() {
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs><path id="d06b-top" d="M118,196A150,150 0 0 1 382,196"/><path id="d06b-bot" d="M104,486A168,168 0 0 0 396,486"/>${border('d06b')}</defs>
  <rect x="44" y="44" width="412" height="612" fill="url(#d06b-tint)"/>
  ${border('d06bx')}
  <g stroke="${INK}" opacity=".85">${A.rosette(250, 350, 212, { petals: 16, depth: 0.1, bands: 14, sw: 0.5 })}</g>
  <g stroke="#3f7a5c" opacity=".8">${A.rosette(250, 350, 176, { petals: 22, depth: 0.08, bands: 12, sw: 0.5 })}</g>
  <circle cx="250" cy="350" r="134" fill="#efe6cd" stroke="${INK}" stroke-width="2.2"/>
  <g stroke="${INK}">${A.rosette(250, 350, 128, { petals: 36, depth: 0.035, bands: 6, sw: 0.5 })}</g>
  <circle cx="250" cy="350" r="112" fill="${INK}"/>
  <g stroke="#efe6cd" opacity=".35">${A.rosette(250, 350, 108, { petals: 12, depth: 0.2, bands: 10, sw: 0.5 })}</g>
  <g fill="#efe6cd">${A.laurel(250, 356, 88, 12, 0.25, 140)}</g>
  <g stroke="#efe6cd">${A.globe(250, 356, 50, 1.8)}</g>
  <path d="${A.starD(250, 276, 13)}" fill="#efe6cd"/>
  <text class="d06-ribbon" text-anchor="middle"><textPath href="#d06b-top" startOffset="50%">分裂的世界</textPath></text>
  <text class="d06-ribbon" text-anchor="middle"><textPath href="#d06b-bot" startOffset="50%">1945 — 1989</textPath></text>
  ${cornerRose(64, 64, 30, `<path d="${A.starD(64, 64.500, 11)}" fill="#efe6cd"/>`)}
  ${cornerRose(436, 64, 30, `<path d="${A.starD(436, 64.500, 11)}" fill="#efe6cd"/>`)}
  ${cornerRose(64, 636, 30, `<path d="${A.starD(64, 636.500, 11)}" fill="#efe6cd"/>`)}
  ${cornerRose(436, 636, 30, `<path d="${A.starD(436, 636.500, 11)}" fill="#efe6cd"/>`)}
</svg>
<div class="abs d06-paper"></div>`;
  }

  window.CardDesigns = window.CardDesigns || [];
  window.CardDesigns.push({
    id: '06',
    name: 'Treasury',
    concept: 'Intaglio engraving on cotton paper, with guilloche lathe-work and a red serial: a card you could spend.',
    notes: [
      ['Frame', 'Lathe-work border, an oval vignette with the art cut as a line engraving, a title scroll.'],
      ['Value', 'The denomination in a rosette, top left, repeated small bottom right.'],
      ['Back', 'Layered rosettes around a solid roundel with globe and laurel.'],
      ['Type', 'Playfair Display; the serial in Share Tech Mono.'],
    ],
    front,
    back,
  });
})();
