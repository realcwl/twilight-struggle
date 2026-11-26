// V2 09 Concrete: the poster painted on a poured slab. Board marks, stencil lettering, a sunk window.
(function () {
  const A = window.CardArt;
  const K = window.V2;
  const slab = () => {
    let lines = '';
    for (const y of [118, 236, 354, 472, 590]) {
      lines += `<path d="M0,${y}H500" stroke="#000" stroke-opacity=".2" stroke-width="1.4"/><path d="M0,${y + 1.6}H500" stroke="#fff" stroke-opacity=".16" stroke-width="1"/>`;
    }
    return `<g filter="url(#f-bevel-xl)"><rect width="500" height="700" rx="23" fill="#a7a297" filter="url(#f-concrete)"/></g>${lines}`;
  };
  const hole = (x, y) =>
    `<circle cx="${x}" cy="${y}" r="7" fill="#4d4943"/><circle cx="${x}" cy="${y}" r="7" fill="#000" filter="url(#f-inset)" opacity=".9"/><path d="M${x - 6},${y + 4}A7,7 0 0 0 ${x + 6},${y + 4}" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="1.2"/>`;

  function front(c, p = 'e09') {
    const w = K.words(c);
    return `
<svg class="frame" viewBox="0 0 500 700">
  ${slab()}
  <g transform="rotate(-5 250 392)"><rect x="-40" y="340" width="580" height="104" fill="#c8281e" filter="url(#f-stamp-l)"/></g>
  ${K.photo(p + '-win', K.rr(56, 44, 388, 268), [56, 44, 388, 268], '40 140 520 359')}
  <rect x="56" y="44" width="388" height="268" fill="#000" filter="url(#f-inset)" opacity=".95"/>
  <rect x="56" y="44" width="388" height="268" fill="none" stroke="#35312d" stroke-width="3"/>
  <path d="M54,314.5H446.5V42" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="2"/>

  <!-- title -->
  <g transform="rotate(-5 250 392)">
    <rect x="-40" y="357" width="580" height="70" fill="#15110e" filter="url(#f-rough)"/>
    <text x="250" y="411" text-anchor="middle" class="k-title">${w.title}</text>
  </g>
  <path d="M40,474L460,437.2V626H40Z" fill="#ebe1c6" filter="url(#f-rough)"/>
  <g transform="rotate(-5 58 497)">
    <text x="58" y="497" class="k-type hot">${w.type}</text>
    <text x="443.5" y="497" text-anchor="end" class="k-type">${w.era}</text>
    <path d="M58,504.5H443.5" stroke="#8f150f" stroke-width="1.5"/>
  </g>
  <text x="44" y="661" class="k-foot">编号 ${c.no}</text>
  <text x="456" y="661" text-anchor="end" class="k-foot">${w.where}</text>
  <rect x="26" y="30" width="96" height="96" rx="4" fill="#000" opacity=".5" filter="url(#v2-blur-s)"/>
</svg>
<svg class="layer px" viewBox="0 0 500 700" style="--d:1cqw">
  <g filter="url(#f-bevel-l)"><rect x="20" y="20" width="96" height="96" rx="4" fill="#c8281e" filter="url(#f-concrete)"/></g>
  <text x="68" y="94" text-anchor="middle" class="k-value">${c.value}</text>
</svg>
${K.text(c)}`;
  }

  // Shared by the whole deck: one disc split down the middle, blue to the west and red to the east.
  function back(c, p = 'e09') {
    const WEST = 'M236,210A140,140 0 0 0 236,490Z';
    const EAST = 'M264,210A140,140 0 0 1 264,490Z';
    return `
<svg class="frame" viewBox="0 0 500 700">
  ${slab()}
  <circle cx="250" cy="350" r="178" fill="#8f8a80" filter="url(#f-concrete)"/>
  <circle cx="250" cy="350" r="178" fill="#000" filter="url(#f-inset)" opacity="1"/>
  <path d="M92,432A178,178 0 0 0 408,432" fill="none" stroke="#fff" stroke-opacity=".34" stroke-width="3"/>
  ${hole(56, 56)}${hole(444, 56)}${hole(56, 644)}${hole(444, 644)}
  ${K.shadow(WEST + EAST, 8, 14, 0.6)}
</svg>
<svg class="layer px" viewBox="0 0 500 700" style="--d:1.5cqw">
  <g filter="url(#f-bevel-l)"><path d="${WEST}" fill="${K.BLUE}" filter="url(#f-concrete)"/></g>
  <g filter="url(#f-bevel-l)"><path d="${EAST}" fill="${K.RED}" filter="url(#f-concrete)"/></g>
</svg>`;
  }

  window.CardDesigns = window.CardDesigns || [];
  window.CardDesigns.push({
    id: '09',
    key: 'e09',
    cls: 'v2 e09',
    name: 'Concrete',
    concept: 'The poster painted on a poured slab: board marks, stencil lettering and a window sunk into the wall.',
    notes: [
      ['Frame', 'The slab is the frame: a chamfered edge, a sunk window, the rules on a painted panel.'],
      ['Value', 'A red block standing off the wall with a stencilled numeral.'],
      ['Title', 'A black band on the slant over a worn red one, lettered in stencil.'],
      ['Back', 'Both sides of one disc: a round recess with a blue half and a red half standing in it, a gap between them.'],
    ],
    front,
    back,
  });
})();
