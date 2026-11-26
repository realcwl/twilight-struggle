// V2 02 Black Lacquer: a lacquer box lid. Black on black, with the poster in red and bone.
(function () {
  const A = window.CardArt;
  const K = window.V2;
  const grads = (p) =>
    `<linearGradient id="${p}-lac" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3d3733"/><stop offset=".35" stop-color="#0f0d0c"/><stop offset=".7" stop-color="#1e1a18"/><stop offset="1" stop-color="#070606"/></linearGradient>` +
    `<linearGradient id="${p}-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2463a"/><stop offset=".5" stop-color="#c8281e"/><stop offset="1" stop-color="#96160f"/></linearGradient>` +
    `<linearGradient id="${p}-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4c84cf"/><stop offset=".5" stop-color="#235a9f"/><stop offset="1" stop-color="#143a6c"/></linearGradient>`;
  const band = (p, line = '#c8281e') =>
    `<path fill-rule="evenodd" d="${K.band(0, 22, 23, 6)}" fill="url(#${p}-lac)" filter="url(#f-bevel-l)"/>` +
    '<rect x="26" y="26" width="448" height="648" rx="3" fill="none" stroke="' + line + '" stroke-width="2"/>';
  const WIN = 'M30,30H470V292L30,354Z';
  const DIAMOND = 'M250,146L414,350L250,554L86,350Z';

  function front(c, p = 'e02') {
    const w = K.words(c);
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>${grads(p)}
    <linearGradient id="${p}-cream" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8f1da"/><stop offset="1" stop-color="#e3d5ae"/></linearGradient>
  </defs>
  <rect width="500" height="700" fill="#100d0c"/>
  ${K.photo(p + '-win', WIN, [30, 30, 440, 324], '30 120 540 398')}
  <path d="${WIN}" fill="#000" filter="url(#f-inset)" opacity=".6"/>
  <path d="M384,30H470V60H397Z" fill="#15110e"/>
  <text x="462" y="51" text-anchor="end" class="k-no">${w.no}</text>

  <!-- title -->
  <g filter="url(#f-drop)"><path d="M22,363.1L478,298.9V368.9L22,433.1Z" fill="url(#${p}-red)" filter="url(#f-bevel-s)"/></g>
  <text transform="rotate(-8.02 250 366)" x="250" y="383" text-anchor="middle" class="k-title">${w.title}</text>
  <path d="M26,440.6L474,377.4" stroke="#efe4c6" stroke-width="2"/>
  <g transform="rotate(-8.02 44 462)">
    <text x="44" y="462" class="k-type hot">${w.type}</text>
    <text x="460" y="462" text-anchor="end" class="k-type">${w.era}</text>
  </g>

  <!-- rules plate -->
  <path d="M30,478L470,416V628H30Z" fill="url(#${p}-cream)"/>
  <path d="M36,483.2L464,422.9V622H36Z" fill="none" stroke="#c8281e" stroke-width="1.5"/>
  <text x="250" y="657" text-anchor="middle" class="k-foot">${w.where}</text>
  <path d="M82,28L140,86L82,144L24,86Z" fill="#000" opacity=".6" filter="url(#v2-blur-s)"/>
  ${band(p)}
</svg>
<svg class="layer px" viewBox="0 0 500 700" style="--d:1cqw">
  <path d="M78,20L138,80L78,140L18,80Z" fill="url(#${p}-lac)" filter="url(#f-bevel)"/>
  <path d="M78,35L123,80L78,125L33,80Z" fill="url(#${p}-red)" filter="url(#f-bevel-s)"/>
  <text x="78" y="99" text-anchor="middle" class="k-value">${c.value}</text>
</svg>
${K.text(c)}
<div class="abs v2-gloss"></div>`;
  }

  // Shared by the whole deck, so it carries both sides in balance: one gem, blue to the west, red to the east.
  function back(c, p = 'e02') {
    const b = p + 'b';
    const CAP = 'M250,290L298,350L250,410L202,350Z';
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>${grads(b)}</defs>
  <rect width="500" height="700" fill="url(#${b}-lac)"/>
  ${K.shadow(DIAMOND, 9, 16, 0.75, 'v2-blur-l')}
  ${band(b, '#d8ccac')}
</svg>
<svg class="layer px" viewBox="0 0 500 700" style="--d:1.4cqw">
  <g filter="url(#f-bevel-l)">
    <path d="M250,146L86,350L250,554Z" fill="url(#${b}-blue)"/>
    <path d="M250,146L414,350L250,554Z" fill="url(#${b}-red)"/>
    <path d="M250,350L86,350L250,146Z" fill="#fff" opacity=".2"/>
    <path d="M250,350L250,146L414,350Z" fill="#fff" opacity=".05"/>
    <path d="M250,350L250,554L86,350Z" fill="#000" opacity=".14"/>
    <path d="M250,350L414,350L250,554Z" fill="#000" opacity=".32"/>
  </g>
  ${K.shadow(CAP, 4, 8, 0.55, 'v2-blur-s')}
</svg>
<svg class="layer px" viewBox="0 0 500 700" style="--d:2.3cqw">
  <g filter="url(#f-bevel)">
    <path d="${CAP}" fill="#f0e6c9"/>
    <path d="M250,350L202,350L250,290Z" fill="#fff" opacity=".3"/>
    <path d="M250,350L250,410L202,350Z" fill="#000" opacity=".1"/>
    <path d="M250,350L298,350L250,410Z" fill="#000" opacity=".24"/>
  </g>
</svg>
<div class="abs v2-gloss"></div>`;
  }

  window.CardDesigns = window.CardDesigns || [];
  window.CardDesigns.push({
    id: '02',
    key: 'e02',
    cls: 'v2 e02',
    name: 'Black Lacquer',
    concept: 'A lacquer box lid: black on black with a red inlay line, the poster painted in red and bone.',
    notes: [
      ['Frame', 'Polished black band with a red inlay hairline; the photo fills the top and is cut on the slant.'],
      ['Value', 'A red lacquer diamond, the only diamond on the card.'],
      ['Title', 'A red bar on the same slant; the bone rules plate is cut to match.'],
      ['Back', 'Both sides in one gem: a faceted pyramid, blue to the west and red to the east, capped in bone.'],
    ],
    front,
    back,
  });
})();
