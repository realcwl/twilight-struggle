// V2 06 Red Wedge: cut paper under a black mat. A red wedge driven into the photo carries the value.
(function () {
  const A = window.CardArt;
  const K = window.V2;
  const mat =
    '<rect x="24" y="24" width="452" height="652" fill="#000" filter="url(#f-inset)" opacity=".55"/>' +
    `<g filter="url(#f-bevel)"><path fill-rule="evenodd" d="${K.band(0, 24, 23, 0)}" fill="#221d1a" filter="url(#f-grit)"/></g>` +
    '<rect x="25" y="25" width="450" height="650" fill="none" stroke="#fbf6e6" stroke-width="2.4"/>';

  function front(c, p = 'e06') {
    const w = K.words(c);
    const WEDGE = 'M40,72V336L226,204Z';
    return `
<svg class="frame" viewBox="0 0 500 700">
  <rect width="500" height="700" fill="#efe4c6" filter="url(#f-grit)"/>
  <g filter="url(#f-rough)"><circle cx="304" cy="206" r="152" fill="#15110e"/></g>
  ${K.photo(p + '-disc', K.circle(304, 206, 142), [162, 64, 284, 284], '84 122 440 440')}
  <circle cx="304" cy="206" r="142" fill="none" stroke="#15110e" stroke-width="2"/>
  <text x="458" y="58" text-anchor="end" class="k-no">${w.no}</text>
  ${K.shadow(WEDGE, 5, 9, 0.5, 'v2-blur-s')}

  <!-- title bar -->
  <rect x="24" y="368" width="452" height="72" fill="#15110e"/><rect x="24" y="446" width="452" height="7" fill="#c8281e"/>
  <text x="250" y="421" text-anchor="middle" class="k-title">${w.title}</text>
  <text x="44" y="477" class="k-type hot">${w.type}</text>
  <text x="456" y="477" text-anchor="end" class="k-type">${w.era}</text>

  <!-- rules panel: the same paper, raised -->
  <g filter="url(#f-drop-s)"><rect x="40" y="489" width="420" height="126" rx="3" fill="#f3e9cf" filter="url(#f-bevel-s)"/></g>
  <rect x="40" y="489" width="9" height="126" fill="#15110e"/>
  <rect x="24" y="627" width="452" height="49" fill="#c8281e"/>
  <text x="250" y="657" text-anchor="middle" class="k-foot">${w.where}</text>
  ${mat}
</svg>
<svg class="layer px" viewBox="0 0 500 700" style="--d:.9cqw">
  <g filter="url(#f-bevel-s)"><path d="${WEDGE}" fill="#c8281e" filter="url(#f-rough)"/></g>
  <text x="88" y="229" text-anchor="middle" class="k-value">${c.value}</text>
</svg>
${K.text(c)}
<div class="abs v2-print"></div>`;
  }

  // Shared by the whole deck: two wedges driven at one disc, blue from the west and red from the east.
  function back(c, p = 'e06') {
    const WEST = 'M52,160V424L300,292Z';
    const EAST = 'M448,276V540L200,408Z';
    return `
<svg class="frame" viewBox="0 0 500 700">
  <rect width="500" height="700" fill="#efe4c6" filter="url(#f-grit)"/>
  <circle cx="257" cy="364" r="150" fill="#000" opacity=".3" filter="url(#v2-blur)"/>
  <g filter="url(#f-bevel-l)"><circle cx="250" cy="350" r="150" fill="#f1e7cb" filter="url(#f-grit)"/></g>
  ${K.shadow(WEST + EAST, 9, 15, 0.5)}
  ${mat}
</svg>
<svg class="layer px" viewBox="0 0 500 700" style="--d:1.8cqw">
  <g filter="url(#f-bevel)"><path d="${WEST}" fill="${K.BLUE}" filter="url(#f-grit)"/></g>
  <g filter="url(#f-bevel)"><path d="${EAST}" fill="${K.RED}" filter="url(#f-grit)"/></g>
</svg>
<div class="abs v2-print"></div>`;
  }

  window.CardDesigns = window.CardDesigns || [];
  window.CardDesigns.push({
    id: '06',
    key: 'e06',
    cls: 'v2 e06',
    name: 'Red Wedge',
    concept: 'Cut paper under a black mat: a red wedge driven into the photo disc carries the value.',
    notes: [
      ['Frame', 'A black mat board with a bevel-cut edge; the rules on a raised panel of the same paper.'],
      ['Value', 'The wedge itself: the largest value mark of the ten.'],
      ['Title', 'A black bar the full width of the window, straight, with a red rule under it.'],
      ['Back', 'Both sides in paper relief: a blue wedge from the west and a red wedge from the east, over one embossed disc.'],
    ],
    front,
    back,
  });
})();
