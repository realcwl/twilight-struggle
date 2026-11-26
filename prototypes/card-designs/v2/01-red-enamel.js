// V2 01 Red Enamel: the 08 poster struck in red enamel and set in a gold band.
(function () {
  const A = window.CardArt;
  const K = window.V2;
  const BAND = `<path fill-rule="evenodd" d="${K.band(7, 14, 19, 9)}" fill="url(#g-gold-d)" filter="url(#f-bevel)"/>`;
  const HAIR = '<rect x="29.5" y="29.5" width="441" height="641" rx="5" fill="none" stroke="#f3d27a" stroke-opacity=".7" stroke-width="1.2"/>';
  const enamel = (p) =>
    `<radialGradient id="${p}-enamel" cx=".5" cy=".3" r=".9"><stop offset="0" stop-color="#d8242a"/><stop offset=".55" stop-color="#a50f18"/><stop offset="1" stop-color="#55040a"/></radialGradient>`;
  const PLATE = 'M48,477.1L452,427.4V626H48Z';

  function front(c, p = 'e01') {
    const w = K.words(c);
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>${enamel(p)}
    <linearGradient id="${p}-cream" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf5e0"/><stop offset=".6" stop-color="#efe4c6"/><stop offset="1" stop-color="#dccb9f"/></linearGradient>
    <clipPath id="${p}-rays"><path d="M14,14H486V328L14,385Z"/></clipPath>
    <clipPath id="${p}-in"><rect x="14" y="14" width="472" height="672" rx="14"/></clipPath>
  </defs>
  <rect width="500" height="700" fill="url(#${p}-enamel)"/>
  <g clip-path="url(#${p}-rays)"><path d="${K.burstD(250, 206, 520, 18, 150, 0.24, -70)}" fill="#15110e" opacity=".88"/></g>
  ${HAIR}
  <g filter="url(#f-drop)"><circle cx="250" cy="206" r="160" fill="#15110e"/><circle cx="250" cy="206" r="153" fill="url(#g-gold)" filter="url(#f-bevel)"/></g>
  ${K.photo(p + '-disc', K.circle(250, 206, 139), [111, 67, 278, 278], '84 122 440 440')}
  <circle cx="250" cy="206" r="139" fill="#000" filter="url(#f-inset)" opacity=".7"/>
  <circle cx="250" cy="206" r="139" fill="none" stroke="#15110e" stroke-width="2.5"/>

  <!-- rules plate, its top cut to the slant of the title -->
  <g filter="url(#f-drop)"><path fill-rule="evenodd" d="M40,470L460,418.4V634H40Z${PLATE}" fill="url(#g-gold)" filter="url(#f-bevel-s)"/></g>
  <path d="${PLATE}" fill="url(#${p}-cream)"/>
  <path d="${PLATE}" fill="#000" filter="url(#f-inset)" opacity=".3"/>
  <g transform="rotate(-7 62 496)">
    <text x="62" y="496" class="k-type hot">${w.type}</text>
    <text x="441" y="496" text-anchor="end" class="k-type">${w.era}</text>
    <path d="M62,503.5H441" stroke="#c8281e" stroke-width="1.5"/>
  </g>

  <!-- title bar -->
  <g clip-path="url(#${p}-in)"><g filter="url(#f-drop)"><g transform="rotate(-7 250 392)">
    <rect x="-40" y="351" width="580" height="82" fill="url(#g-gold)" filter="url(#f-bevel-s)"/>
    <rect x="-40" y="356" width="580" height="72" fill="#15110e"/>
    <text x="250" y="410" text-anchor="middle" class="k-title">${w.title}</text>
  </g></g></g>

  <text x="48" y="661" class="k-foot">${w.no}</text>
  <text x="452" y="661" text-anchor="end" class="k-foot">${w.where}</text>
  <path d="${A.starD(250, 656, 9)}" fill="url(#g-gold)" filter="url(#f-bevel-s)"/>
  <circle cx="79" cy="92" r="48" fill="#000" opacity=".55" filter="url(#v2-blur-s)"/>
  ${BAND}
</svg>
<svg class="layer px" viewBox="0 0 500 700" style="--d:1cqw">
  <circle cx="74" cy="82" r="48" fill="url(#g-gold-d)" filter="url(#f-bevel)"/>
  <circle cx="74" cy="82" r="38" fill="#15110e"/>
  <path d="M46,72A30,30 0 0 1 92,56A36,36 0 0 0 46,72Z" fill="#fff" opacity=".22"/>
  <circle cx="74" cy="82" r="38" fill="none" stroke="#6b4508" stroke-width="1.5"/>
  <text x="74" y="102" text-anchor="middle" class="k-value">${c.value}</text>
</svg>
${K.text(c)}
<div class="abs v2-gloss"></div>`;
  }

  // The back is the same for every card in the deck, so it takes no side: black enamel, gold compass rose.
  function back(c, p = 'e01') {
    const b = p + 'b';
    const ROSE = A.orderStar(250, 350, 162, 4, 0.3, 0.68);
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>
    <radialGradient id="${b}-ink" cx=".5" cy=".3" r=".9"><stop offset="0" stop-color="#37322e"/><stop offset=".55" stop-color="#1a1715"/><stop offset="1" stop-color="#080706"/></radialGradient>
    <radialGradient id="${b}-well" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="#2b2724"/><stop offset="1" stop-color="#0b0a09"/></radialGradient>
  </defs>
  <rect width="500" height="700" fill="url(#${b}-ink)"/>
  <path d="${K.burstD(250, 350, 640, 24, 196, 0.5, -3.75)}" fill="#fff" opacity=".04"/>
  ${HAIR}
  <g filter="url(#f-drop)"><path fill-rule="evenodd" d="${K.circle(250, 350, 198)}${K.circle(250, 350, 178)}" fill="url(#g-gold-d)" filter="url(#f-bevel-l)"/></g>
  <circle cx="250" cy="350" r="178" fill="url(#${b}-well)"/>
  <circle cx="250" cy="350" r="178" fill="#000" filter="url(#f-inset)" opacity=".85"/>
  ${K.shadow(ROSE.d, 8, 14, 0.7)}
  ${BAND}
</svg>
<svg class="layer px" viewBox="0 0 500 700" style="--d:1.9cqw">
  <g filter="url(#f-bevel-l)"><path d="${ROSE.d}" fill="url(#g-gold-d)"/>${ROSE.facets}</g>
</svg>
<div class="abs v2-gloss"></div>`;
  }

  window.CardDesigns = window.CardDesigns || [];
  window.CardDesigns.push({
    id: '01',
    key: 'e01',
    cls: 'v2 e01',
    name: 'Red Enamel',
    concept: 'The 08 poster struck in red enamel and set in a gold band: the closest cross of V1’s 08 and 01.',
    notes: [
      ['Frame', 'Bevelled gold band; the photo disc in a gold ring; a cream rules plate with a gold rim.'],
      ['Value', 'A black enamel roundel in gold, floating over the top-left corner.'],
      ['Title', 'The black poster bar on the slant, edged in gold and tucked under the band.'],
      ['Back', 'No side: a cut-gold compass rose in a gold ring over black enamel.'],
    ],
    front,
    back,
  });
})();
