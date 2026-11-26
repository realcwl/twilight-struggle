// V2 03 Foundry: the poster as a factory sign. Riveted iron round red paint, steel plates bolted on.
(function () {
  const A = window.CardArt;
  const K = window.V2;
  const RIVETS = [[42, 13], [250, 13], [458, 13], [42, 687], [250, 687], [458, 687], [13, 190], [13, 350], [13, 510], [487, 190], [487, 350], [487, 510]];
  const iron = `<g filter="url(#f-bevel-l)"><path fill-rule="evenodd" d="${K.band(0, 26, 23, 8)}" fill="url(#g-gun-d)" filter="url(#f-grit)"/></g>`;
  const rivets = (list) => list.map(([x, y]) => A.rivet(x, y, 5, 'steel')).join('');
  const WIN = 'M72,44H428L456,72V290L428,318H72L44,290V72Z';
  const paint = (p) => `<radialGradient id="${p}-vig" cx=".5" cy=".4" r=".8"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></radialGradient>`;

  function front(c, p = 'e03') {
    const w = K.words(c);
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>${paint(p)}
    <linearGradient id="${p}-cream" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8f1da"/><stop offset="1" stop-color="#e0d2ac"/></linearGradient>
  </defs>
  <rect width="500" height="700" fill="#b8241c" filter="url(#f-grit)"/>
  <rect width="500" height="700" fill="url(#${p}-vig)"/>
  ${K.photo(p + '-win', WIN, [44, 44, 412, 274], '20 140 560 372')}
  <path d="${WIN}" fill="#000" filter="url(#f-inset)" opacity=".75"/>
  <g filter="url(#f-drop)"><g filter="url(#f-bevel)"><path fill-rule="evenodd" d="M66,32H434L468,66V296L434,330H66L32,296V66Z${WIN}" fill="url(#g-gun-d)" filter="url(#f-grit)"/></g></g>

  <!-- title plate -->
  <g filter="url(#f-drop)"><g filter="url(#f-bevel)"><path d="M32,344H426L468,383L426,422H32L60,383Z" fill="url(#g-steel)" filter="url(#f-brushed)"/></g></g>
  <path d="M34,346H52L80,383L52,420H34L62,383Z" fill="#c8281e"/>
  <text x="256" y="400.3" text-anchor="middle" class="k-title lit">${w.title}</text>
  <text x="256" y="399" text-anchor="middle" class="k-title">${w.title}</text>

  <text x="40" y="447" class="k-type hot">${w.type}</text>
  <text x="460" y="447" text-anchor="end" class="k-type">${w.era}</text>

  <!-- rules plate -->
  <g filter="url(#f-drop)"><rect x="30" y="457" width="440" height="180" rx="8" fill="url(#g-gun-d)" filter="url(#f-bevel)"/></g>
  <rect x="38" y="465" width="424" height="164" rx="4" fill="url(#${p}-cream)"/>
  <rect x="38" y="465" width="424" height="164" rx="4" fill="#000" filter="url(#f-inset)" opacity=".3"/>
  ${A.screw(50, 477, 4.4, 30)}${A.screw(450, 477, 4.4, -20)}${A.screw(50, 617, 4.4, 75)}${A.screw(450, 617, 4.4, 10)}
  <text x="40" y="662" class="k-foot">${w.no}</text>
  <text x="460" y="662" text-anchor="end" class="k-foot">${w.where}</text>
  <circle cx="81" cy="90" r="54" fill="#000" opacity=".55" filter="url(#v2-blur-s)"/>
  ${iron}${rivets(RIVETS)}
</svg>
<svg class="layer px" viewBox="0 0 500 700" style="--d:1cqw">
  <g filter="url(#f-bevel)"><path d="${K.gear(76, 80, 57, 10, 0.2, -9)}" fill="url(#g-steel-d)" filter="url(#f-grit)"/></g>
  <circle cx="76" cy="80" r="35" fill="#15110e"/>
  <circle cx="76" cy="80" r="35" fill="none" stroke="#000" stroke-opacity=".6" stroke-width="2"/>
  <text x="76" y="100" text-anchor="middle" class="k-value">${c.value}</text>
</svg>
${K.text(c)}`;
  }

  // Shared by the whole deck: a gauge, not a flag. One needle with a blue end and a red end.
  function back(c, p = 'e03') {
    const b = p + 'b';
    const GEAR = K.gear(250, 350, 180, 16, 0.14, -6);
    const NEEDLE = 'M100,350L250,316L400,350L250,384Z';
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>${paint(b)}</defs>
  <rect width="500" height="700" fill="#3c4349" filter="url(#f-grit)"/>
  <rect width="500" height="700" fill="url(#${b}-vig)"/>
  ${K.shadow(GEAR, 9, 16, 0.7, 'v2-blur-l')}
  ${iron}${rivets(RIVETS.filter((r, i) => i % 3 !== 1 || i > 5))}
</svg>
<svg class="layer px" viewBox="0 0 500 700" style="--d:1.3cqw">
  <defs><radialGradient id="${b}-dial" cx=".42" cy=".36" r=".75"><stop offset="0" stop-color="#f8f0da"/><stop offset=".6" stop-color="#e8dbb9"/><stop offset="1" stop-color="#c4b58e"/></radialGradient></defs>
  <g filter="url(#f-bevel-l)"><path d="${GEAR}" fill="url(#g-steel-d)" filter="url(#f-grit)"/></g>
  <circle cx="250" cy="350" r="122" fill="url(#${b}-dial)"/>
  <circle cx="250" cy="350" r="122" fill="#000" filter="url(#f-inset)" opacity=".8"/>
  ${K.shadow(NEEDLE, 5, 10, 0.6, 'v2-blur-s')}
</svg>
<svg class="layer px" viewBox="0 0 500 700" style="--d:2.2cqw">
  <g filter="url(#f-bevel)">
    <path d="M100,350L250,316V384Z" fill="${K.BLUE}"/>
    <path d="M400,350L250,316V384Z" fill="${K.RED}"/>
    <path d="M100,350L250,316L400,350Z" fill="#fff" opacity=".16"/>
    <path d="M100,350L250,384L400,350Z" fill="#000" opacity=".24"/>
  </g>
  ${A.rivet(250, 350, 12, 'steel')}
</svg>`;
  }

  window.CardDesigns = window.CardDesigns || [];
  window.CardDesigns.push({
    id: '03',
    key: 'e03',
    cls: 'v2 e03',
    name: 'Foundry',
    concept: 'The poster as a factory sign: riveted iron round red paint, with steel plates bolted on.',
    notes: [
      ['Frame', 'Cast-iron band with rivets; the photo in a chamfered iron port; a bolted cream rules plate.'],
      ['Value', 'A steel gear with a black hub.'],
      ['Title', 'A brushed-steel arrow plate with a red chevron, lettering stamped in black.'],
      ['Back', 'Both sides on one needle: a cast gear round a cream dial, the needle blue at one end and red at the other.'],
    ],
    front,
    back,
  });
})();
