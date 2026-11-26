// V2 05 Banner: the poster sewn as a parade banner. Red cloth, gold braid, a fringe along the foot.
(function () {
  const A = window.CardArt;
  const K = window.V2;
  const f = A.f;
  const GOLD = '#ecc75f';

  const cloth = (p, folds, dye = '#bb211c') =>
    `<rect width="500" height="700" fill="${dye}" filter="url(#f-cloth)"/><rect width="500" height="700" fill="url(#${p}-folds)" opacity="${folds}"/>`;
  const grads = (p) =>
    `<linearGradient id="${p}-folds" x1="0" y1="0" x2="1" y2=".12"><stop offset="0" stop-color="#000" stop-opacity=".34"/><stop offset=".16" stop-color="#fff" stop-opacity=".12"/><stop offset=".34" stop-color="#000" stop-opacity=".22"/><stop offset=".53" stop-color="#fff" stop-opacity=".1"/><stop offset=".74" stop-color="#000" stop-opacity=".26"/><stop offset=".9" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>`;
  // braid round the edge, a gold bar, and the fringe hanging from it
  function trim() {
    let strands = '';
    for (let i = 0; i < 60; i++) {
      const x = 14 + i * 8;
      const edge = Math.min(x, 500 - x);
      const len = edge < 26 ? 24 - (26 - edge) * 0.75 : 24;
      strands += `<path d="M${x},671v${f(len + (i % 3) * 1.2)}" stroke="${i % 2 ? '#c9982f' : '#f0cf6c'}"/>`;
    }
    return (
      '<rect x="13" y="13" width="474" height="652" rx="6" fill="none" stroke="url(#g-gold-h)" stroke-width="9" filter="url(#f-bevel-s)"/>' +
      '<rect x="13" y="13" width="474" height="652" rx="6" fill="none" stroke="#5a3a08" stroke-opacity=".5" stroke-width="9" stroke-dasharray="2.5 3.5"/>' +
      '<rect x="25.5" y="25.5" width="449" height="627" rx="2" fill="none" stroke="#f1d68a" stroke-opacity=".75" stroke-width="1.3"/>' +
      `<g filter="url(#f-drop-s)"><g stroke-width="5.6" stroke-linecap="round" fill="none">${strands}</g><rect x="7" y="660" width="486" height="12" rx="3" fill="url(#g-gold)" filter="url(#f-bevel-s)"/></g>`
    );
  }

  function front(c, p = 'e05') {
    const w = K.words(c);
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>${grads(p)}
    <linearGradient id="${p}-satin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3430"/><stop offset=".35" stop-color="#14110f"/><stop offset=".7" stop-color="#0b0908"/><stop offset="1" stop-color="#2a2522"/></linearGradient>
    <clipPath id="${p}-rays"><rect x="26" y="26" width="448" height="336"/></clipPath>
    <path id="${p}-arc" d="M40,433.5Q250,398.5 460,433.5"/>
  </defs>
  ${cloth(p, 0.45)}
  <g clip-path="url(#${p}-rays)"><path d="${K.burstD(250, 196, 360, 28, 164, 0.1, -93)}" fill="${GOLD}" opacity=".85"/></g>
  <g filter="url(#f-drop)"><circle cx="250" cy="196" r="150" fill="#1b1614" filter="url(#f-cloth)"/></g>
  <circle cx="250" cy="196" r="157" fill="none" stroke="#f1d68a" stroke-opacity=".85" stroke-width="1.6" stroke-dasharray="6 5"/>
  ${K.photo(p + '-disc', K.circle(250, 196, 134), [116, 62, 268, 268], '84 122 440 440')}
  <circle cx="250" cy="196" r="138" fill="none" stroke="url(#g-gold)" stroke-width="8" filter="url(#f-bevel-s)"/>

  <!-- title sash -->
  <g filter="url(#f-drop)"><path d="M18,388Q250,352 482,388V452Q250,416 18,452Z" fill="url(#${p}-satin)"/></g>
  <path d="M22,395Q250,359.5 478,395M22,445Q250,409.5 478,445" fill="none" stroke="${GOLD}" stroke-width="1.4" stroke-dasharray="5 4"/>
  <text class="k-title" text-anchor="middle"><textPath href="#${p}-arc" startOffset="50%">${w.title}</textPath></text>

  <text x="48" y="479" class="k-type">${w.type}</text>
  <text x="452" y="479" text-anchor="end" class="k-type">${w.era}</text>
  <g filter="url(#f-drop-s)"><rect x="44" y="491" width="412" height="128" rx="3" fill="#efe4c6" filter="url(#f-cloth)"/></g>
  <rect x="51" y="498" width="398" height="114" rx="2" fill="none" stroke="#c8281e" stroke-width="1.6" stroke-dasharray="7 5"/>
  <text x="250" y="643" text-anchor="middle" class="k-foot">${w.note}</text>
  <text x="452" y="58" text-anchor="end" class="k-no">${w.no}</text>
  <circle cx="78" cy="88" r="44" fill="#000" opacity=".5" filter="url(#v2-blur-s)"/>
  ${trim()}
</svg>
<svg class="layer px" viewBox="0 0 500 700" style="--d:.8cqw">
  <circle cx="74" cy="80" r="44" fill="url(#g-gold-r)" filter="url(#f-bevel)"/>
  <circle cx="74" cy="80" r="36" fill="none" stroke="#6a4609" stroke-width="1.5" stroke-dasharray="4 3"/>
  <text x="74" y="99" text-anchor="middle" class="k-value">${c.value}</text>
</svg>
${K.text(c, false)}
<div class="abs e05-weave"></div>`;
  }

  // Shared by the whole deck, so it takes no side: undyed linen, a black satin roundel, the globe in gold thread.
  function back(c, p = 'e05') {
    const b = p + 'b';
    const PATCH = K.circle(250, 344, 156);
    const globe = A.globe(250, 344, 112, 7);
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>${grads(b)}</defs>
  ${cloth(b, 0.8, '#d6c9a8')}
  ${K.shadow(PATCH, 5, 9, 0.5, 'v2-blur-s')}
  ${trim()}
</svg>
<svg class="layer px" viewBox="0 0 500 700" style="--d:.9cqw">
  <defs><linearGradient id="${b}-satin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3d3733"/><stop offset=".45" stop-color="#15110e"/><stop offset="1" stop-color="#282321"/></linearGradient></defs>
  <g filter="url(#f-bevel)"><path d="${PATCH}" fill="url(#${b}-satin)"/></g>
  <circle cx="250" cy="344" r="145" fill="none" stroke="${GOLD}" stroke-opacity=".85" stroke-width="1.6" stroke-dasharray="6 4"/>
  <g stroke="${GOLD}" filter="url(#f-bevel-s)">${globe}</g>
  <g stroke="#5a3a08" stroke-opacity=".45" stroke-dasharray="2.5 3.5">${globe}</g>
</svg>
<div class="abs e05-weave"></div>`;
  }

  window.CardDesigns = window.CardDesigns || [];
  window.CardDesigns.push({
    id: '05',
    key: 'e05',
    cls: 'v2 e05',
    name: 'Banner',
    concept: 'The poster sewn as a parade banner: red cloth, gold braid, a fringe along the foot.',
    notes: [
      ['Frame', 'Gold braid stitched round the edge, a gold bar and fringe at the foot; the rules on a sewn linen patch.'],
      ['Value', 'A gold roundel with a stitched edge.'],
      ['Title', 'A black satin sash across the cloth, lettered in cream.'],
      ['Back', 'No side: undyed linen, a black satin roundel and the globe in gold thread, over the fringe.'],
    ],
    front,
    back,
  });
})();
