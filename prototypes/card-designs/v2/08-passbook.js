// V2 08 Passbook: the poster as a document in an oxblood leather holder, the value on a gold seal.
(function () {
  const A = window.CardArt;
  const K = window.V2;
  const grads = (p) =>
    `<radialGradient id="${p}-vig" cx=".5" cy=".45" r=".8"><stop offset=".4" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient>`;
  const leather = (p, dye = '#741919') =>
    `<rect width="500" height="700" fill="${dye}" filter="url(#f-leather)"/><rect width="500" height="700" fill="url(#${p}-vig)"/>` +
    '<rect x="11" y="11" width="478" height="678" rx="15" fill="none" stroke="#ecd7a6" stroke-opacity=".8" stroke-width="1.6" stroke-dasharray="7 5"/>';
  // leather corners that hold the sheet
  const CORNERS = 'M22,22H116L22,116ZM478,22V94L406,22ZM22,628V558L92,628ZM478,628H408L478,558Z';
  const SEAMS = 'M30,100L100,30M414,30L470,86M30,566L84,620M416,620L470,566';

  function front(c, p = 'e08') {
    const w = K.words(c);
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>${grads(p)}</defs>
  ${leather(p)}
  <g filter="url(#f-drop)"><rect x="30" y="30" width="440" height="590" rx="2" fill="#efe4c6" filter="url(#f-grit)"/></g>
  <g filter="url(#f-rough)"><rect x="30" y="30" width="440" height="290" fill="#c8281e"/><rect x="45" y="45" width="410" height="260" fill="#15110e"/></g>
  ${K.photo(p + '-win', K.rr(48, 48, 404, 254), [48, 48, 404, 254], '10 150 580 365')}

  <!-- title bar -->
  <g filter="url(#f-rough)"><rect x="30" y="320" width="440" height="70" fill="#15110e"/></g>
  <text x="250" y="371" text-anchor="middle" class="k-title">${w.title}</text>
  <text x="48" y="417" class="k-type hot">${w.type}</text>
  <text x="452" y="417" text-anchor="end" class="k-type">${w.era}</text>
  <path d="M48,426H452" stroke="#15110e" stroke-width="1.5"/>
  <rect x="48" y="440" width="9" height="134" fill="#15110e" filter="url(#f-rough)"/>

  <g filter="url(#f-drop-s)"><g filter="url(#f-bevel-s)"><path d="${CORNERS}" fill="#812020" filter="url(#f-leather)"/></g></g>
  <path d="${SEAMS}" fill="none" stroke="#ecd7a6" stroke-opacity=".8" stroke-width="1.5" stroke-dasharray="6 4.5"/>
  <text x="42" y="664" class="k-foot">${w.no}</text>
  <text x="458" y="664" text-anchor="end" class="k-foot">${w.where}</text>
  <path d="${A.starD(250, 659, 9)}" fill="url(#g-gold)" filter="url(#f-bevel-s)"/>
  <circle cx="73" cy="77" r="42" fill="#000" opacity=".55" filter="url(#v2-blur-s)"/>
</svg>
<svg class="layer px" viewBox="0 0 500 700" style="--d:.9cqw">
  <circle cx="68" cy="68" r="42" fill="url(#g-gold-r)" filter="url(#f-bevel)"/>
  <circle cx="68" cy="68" r="34.5" fill="none" stroke="#6a4609" stroke-width="1.4"/>
  <text x="68" y="87" text-anchor="middle" class="k-value lit">${c.value}</text>
  <text x="68" y="86" text-anchor="middle" class="k-value">${c.value}</text>
</svg>
${K.text(c)}
<div class="abs v2-print"></div>`;
  }

  // Shared by the whole deck, so it takes no side: brown leather and one blank gold seal.
  function back(c, p = 'e08') {
    const b = p + 'b';
    const SEAL = K.scallop(250, 350, 134, 28);
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>${grads(b)}</defs>
  ${leather(b, '#553722')}
  <circle cx="250" cy="350" r="174" fill="#412815" filter="url(#f-leather)"/>
  <circle cx="250" cy="350" r="174" fill="#000" filter="url(#f-inset)" opacity=".95"/>
  <path d="M96,430A174,174 0 0 0 404,430" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="2.5"/>
  <circle cx="250" cy="350" r="192" fill="none" stroke="#e6c268" stroke-width="2.6" filter="url(#f-bevel-s)"/>
  ${K.shadow(SEAL, 4, 8, 0.6, 'v2-blur-s')}
</svg>
<svg class="layer px" viewBox="0 0 500 700" style="--d:1.1cqw">
  <g filter="url(#f-bevel-l)"><path d="${SEAL}" fill="url(#g-gold-d)"/></g>
  <path d="${K.burstD(250, 350, 124, 40, 98, 0.5, 0)}" fill="#6a4609" opacity=".5"/>
  <g filter="url(#f-drop-s)"><circle cx="250" cy="350" r="88" fill="url(#g-gold-r)" filter="url(#f-bevel)"/></g>
</svg>`;
  }

  window.CardDesigns = window.CardDesigns || [];
  window.CardDesigns.push({
    id: '08',
    key: 'e08',
    cls: 'v2 e08',
    name: 'Passbook',
    concept: 'The poster as a document in an oxblood leather holder, with the value on a gold seal.',
    notes: [
      ['Frame', 'Stitched leather with four corner mounts holding the sheet; gold tooling along the foot.'],
      ['Value', 'A gold foil seal on the top-left corner mount.'],
      ['Title', 'A black bar straight across the sheet, under the red photo block.'],
      ['Back', 'No side: brown leather, a pressed-in disc and one blank gold foil seal.'],
    ],
    front,
    back,
  });
})();
