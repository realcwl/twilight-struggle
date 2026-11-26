// 01 State Order: cloisonne enamel and gold, built like a decoration from a medal case.
(function () {
  const A = window.CardArt;
  const WINDOW = 'M52,372V178A198,118 0 0 1 448,178V372Z';
  const BAND = '<path fill-rule="evenodd" d="M26,7H474A19,19 0 0 1 493,26V674A19,19 0 0 1 474,693H26A19,19 0 0 1 7,674V26A19,19 0 0 1 26,7ZM30,21A9,9 0 0 0 21,30V670A9,9 0 0 0 30,679H470A9,9 0 0 0 479,670V30A9,9 0 0 0 470,21Z" fill="url(#g-gold-d)" filter="url(#f-bevel)"/>';
  const plaque = (y, label, w = 86) =>
    `<g filter="url(#f-drop-s)"><path d="M${250 - w},${y - 16}H${250 + w}L${250 + w + 12},${y}L${250 + w},${y + 16}H${250 - w}L${250 - w - 12},${y}Z" fill="url(#g-gold)" filter="url(#f-bevel-s)"/></g>` +
    `<path d="M${250 - w + 2},${y - 11}H${250 + w - 2}L${250 + w + 6},${y}L${250 + w - 2},${y + 11}H${250 - w + 2}L${250 - w - 6},${y}Z" fill="none" stroke="#6b4508" stroke-opacity=".55" stroke-width="1"/>` +
    `<text x="250" y="${y + 5}" text-anchor="middle" class="d01-engrave">${label}</text>`;

  function front(c) {
    const star = A.orderStar(76, 86, 64, 8, 0.5, 0.8);
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>
    <clipPath id="d01-win"><path d="${WINDOW}"/></clipPath>
    <radialGradient id="d01-enamel" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#ff6a55"/><stop offset=".45" stop-color="#c3121d"/><stop offset="1" stop-color="#5e050c"/></radialGradient>
    <linearGradient id="d01-ivory" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf4"/><stop offset=".6" stop-color="#f6ecd4"/><stop offset="1" stop-color="#e2d0a8"/></linearGradient>
    <path id="d01-title" d="M70,428Q250,407 430,428"/>
  </defs>
  <g clip-path="url(#d01-win)"><svg x="52" y="60" width="396" height="312">${A.scene('20 150 560 441')}</svg></g>
  <path d="${WINDOW}" fill="#000" filter="url(#f-inset)"/>
  <rect x="29.500" y="29.500" width="441" height="641" rx="5" fill="none" stroke="#f3d27a" stroke-opacity=".7" stroke-width="1.2"/>
  <g filter="url(#f-drop)"><path fill-rule="evenodd" d="M40,384V178A210,130 0 0 1 460,178V384ZM52,372H448V178A198,118 0 0 0 52,178Z" fill="url(#g-gold)" filter="url(#f-bevel)"/></g>
  <path d="${WINDOW}" fill="none" stroke="#3b0407" stroke-width="2.5"/>
  <path d="M46,378V178A204,124 0 0 1 454,178V378Z" fill="none" stroke="#6b4508" stroke-opacity=".5" stroke-width="1"/>
  <g fill="url(#g-gold)" filter="url(#f-bevel-s)"><path d="${A.starD(438, 60, 13)}"/><circle cx="412" cy="50" r="2.6"/><circle cx="452" cy="88" r="2.6"/></g>
  ${plaque(52, c.era.toUpperCase())}

  <!-- title ribbon -->
  <g filter="url(#f-drop)">
    <path d="M40,398L10,406L24,428L10,452L56,446V398Z" fill="#cdb98f"/><path d="M40,398L56,446V398Z" fill="#8f7a52"/>
    <path d="M460,398L490,406L476,428L490,452L444,446V398Z" fill="#cdb98f"/><path d="M460,398L444,446V398Z" fill="#8f7a52"/>
    <path d="M34,394Q250,368 466,394V444Q250,418 34,444Z" fill="url(#d01-ivory)" stroke="url(#g-gold)" stroke-width="3.5"/>
  </g>
  <path d="M42,401Q250,376 458,401" fill="none" stroke="#b9912f" stroke-width="1"/><path d="M42,436Q250,411 458,436" fill="none" stroke="#b9912f" stroke-width="1"/>
  <text class="d01-title" text-anchor="middle"><textPath href="#d01-title" startOffset="50%"><tspan class="cap">${c.title[0]}</tspan>${c.title.slice(1).toUpperCase()}</textPath></text>

  <!-- rules plate -->
  <g filter="url(#f-drop)"><rect x="44" y="460" width="412" height="178" rx="13" fill="url(#g-gold)" filter="url(#f-bevel)"/></g>
  <rect x="52" y="468" width="396" height="162" rx="7" fill="url(#d01-ivory)"/>
  <rect x="52" y="468" width="396" height="162" rx="7" fill="#000" filter="url(#f-inset)" opacity=".35"/>
  <rect x="58.500" y="474.500" width="383" height="149" rx="4" fill="none" stroke="#b9912f" stroke-width="1"/>

  <!-- foot -->
  <text x="62" y="664" class="d01-foot">№ ${c.no}</text>
  <text x="438" y="664" text-anchor="end" class="d01-foot">1959</text>
  <g filter="url(#f-drop-s)"><circle cx="250" cy="647" r="19" fill="url(#g-gold)" filter="url(#f-bevel-s)"/><circle cx="250" cy="647" r="14.500" fill="url(#d01-enamel)"/><path d="${A.starD(250, 647.500, 10)}" fill="url(#g-gold)"/></g>

  <!-- the value, worn as an order star -->
  <g filter="url(#f-drop)">
    <g filter="url(#f-bevel)"><path d="${star.d}" fill="url(#g-gold-d)"/>${star.facets}</g>
    <circle cx="76" cy="86" r="34" fill="url(#g-gold)" filter="url(#f-bevel-s)"/>
    <circle cx="76" cy="86" r="28.500" fill="url(#d01-enamel)"/>
    <path d="M54,76A25,25 0 0 1 92,65A30,30 0 0 0 54,76Z" fill="#fff" opacity=".45"/>
    <text x="76" y="102" text-anchor="middle" class="d01-value">${c.value}</text>
  </g>
  ${BAND}
</svg>
<div class="abs d01-text"><p class="rules">${c.text}</p><p class="note">${CardZh.highlight(c.note)}</p></div>
<div class="abs d01-gloss"></div>`;
  }

  function back() {
    const star = A.orderStar(250, 350, 142, 12, 0.58, 0.8);
    const corner = (x, y) => `<g filter="url(#f-drop-s)"><circle cx="${x}" cy="${y}" r="17" fill="url(#g-gold)" filter="url(#f-bevel-s)"/><circle cx="${x}" cy="${y}" r="12.500" fill="url(#d01b-blue)"/><path d="${A.starD(x, y + 0.5, 8.5)}" fill="url(#g-gold)"/></g>`;
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>
    <radialGradient id="d01b-blue" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#5f8fe6"/><stop offset=".5" stop-color="#1c3f9a"/><stop offset="1" stop-color="#0a1a4d"/></radialGradient>
    <radialGradient id="d01b-red" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#ff6a55"/><stop offset=".45" stop-color="#c3121d"/><stop offset="1" stop-color="#5e050c"/></radialGradient>
  </defs>
  <rect x="29.500" y="29.500" width="441" height="641" rx="5" fill="none" stroke="#f3d27a" stroke-opacity=".7" stroke-width="1.2"/>
  <g filter="url(#f-drop)"><path fill-rule="evenodd" d="M44,44H456V656H44ZM52,52V648H448V52Z" fill="url(#g-gold)" filter="url(#f-bevel-s)"/></g>
  <rect x="58.500" y="58.500" width="383" height="583" fill="none" stroke="#f3d27a" stroke-opacity=".55" stroke-width="1"/>
  <g stroke="#f3d27a" stroke-opacity=".5" fill="none">${A.rosette(250, 350, 212, { petals: 18, depth: 0.045, bands: 6, sw: 0.8 })}</g>
  <g fill="url(#g-gold)" filter="url(#f-bevel-s)">${A.laurel(250, 356, 174, 17, 0.2, 152)}</g>
  <g filter="url(#f-drop)">
    <g filter="url(#f-bevel)"><path d="${star.d}" fill="url(#g-gold-d)"/>${star.facets}</g>
    <circle cx="250" cy="350" r="82" fill="url(#g-gold)" filter="url(#f-bevel)"/>
    <circle cx="250" cy="350" r="72" fill="url(#d01b-blue)"/>
    <g stroke="#f6dc8e">${A.globe(250, 350, 52, 2.4)}</g>
    <path d="M192,322A64,64 0 0 1 286,290A76,76 0 0 0 192,322Z" fill="#fff" opacity=".35"/>
    <circle cx="250" cy="350" r="72" fill="none" stroke="#06103a" stroke-opacity=".6" stroke-width="2"/>
  </g>
  <g filter="url(#f-drop-s)"><circle cx="250" cy="350" r="15" fill="url(#g-gold)" filter="url(#f-bevel-s)"/><circle cx="250" cy="350" r="11" fill="url(#d01b-red)"/><path d="${A.starD(250, 350.500, 7.5)}" fill="url(#g-gold)"/></g>
  ${plaque(112, '1945', 64)}
  ${plaque(588, '1989', 78)}
  ${corner(48, 48)}${corner(452, 48)}${corner(48, 652)}${corner(452, 652)}
  ${BAND}
</svg>
<div class="abs d01-gloss"></div>`;
  }

  window.CardDesigns = window.CardDesigns || [];
  window.CardDesigns.push({
    id: '01',
    name: 'State Order',
    concept: 'Red cloisonné enamel in a gold setting, like a decoration lifted out of its presentation case.',
    notes: [
      ['Frame', 'Bevelled gold band, arched window, ivory enamel ribbon and rules plate.'],
      ['Value', 'An eight-rayed order star with an enamel roundel, top left.'],
      ['Back', 'Guilloche sunburst under red enamel; the globe in cobalt, ringed by laurel.'],
      ['Type', 'Cinzel for the title and engraving, EB Garamond for rules.'],
    ],
    front,
    back,
  });
})();
