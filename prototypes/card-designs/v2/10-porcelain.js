// V2 10 Porcelain: the poster painted on white porcelain under a gilt rim. The brightest of the ten.
(function () {
  const A = window.CardArt;
  const K = window.V2;
  const grads = (p) =>
    `<radialGradient id="${p}-shade" cx=".42" cy=".3" r=".95"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#8b7f66" stop-opacity=".42"/></radialGradient>` +
    `<radialGradient id="${p}-glaze" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="#ee4a3c"/><stop offset=".5" stop-color="#c8281e"/><stop offset="1" stop-color="#7d100b"/></radialGradient>`;
  const body = (p) => `<rect width="500" height="700" fill="#f4f0e4"/><rect width="500" height="700" fill="url(#${p}-shade)"/>`;
  const rim = (line = '#c8281e') =>
    `<path fill-rule="evenodd" d="${K.band(5, 9, 19, 11)}" fill="url(#g-gold-d)" filter="url(#f-bevel-s)"/>` +
    '<rect x="20" y="20" width="460" height="660" rx="7" fill="none" stroke="' + line + '" stroke-width="2.2"/>';

  function front(c, p = 'e10') {
    const w = K.words(c);
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>${grads(p)}<clipPath id="${p}-paint"><rect x="21" y="21" width="458" height="340"/></clipPath></defs>
  ${body(p)}
  <g clip-path="url(#${p}-paint)">
    <circle cx="346" cy="146" r="112" fill="#c8281e"/>
    <g transform="rotate(-32 250 250)" fill="#15110e"><rect x="-80" y="244" width="660" height="24"/><rect x="-80" y="277" width="660" height="5"/></g>
    <rect x="407" y="286" width="34" height="34" fill="#c8281e" transform="rotate(-32 424 303)"/>
    <circle cx="62" cy="322" r="13" fill="#15110e"/>
  </g>
  <g filter="url(#f-drop-s)"><circle cx="226" cy="212" r="136" fill="url(#g-gold-d)" filter="url(#f-bevel-s)"/></g>
  ${K.photo(p + '-disc', K.circle(226, 212, 127), [99, 85, 254, 254], '84 122 440 440')}
  <circle cx="226" cy="212" r="127" fill="none" stroke="#15110e" stroke-width="2"/>
  <text x="458" y="56" text-anchor="end" class="k-no">${w.no}</text>

  <!-- title, painted straight on the glaze -->
  <text x="250" y="421" text-anchor="middle" class="k-title">${w.title}</text>
  <rect x="60" y="435" width="380" height="9" fill="#c8281e"/><rect x="60" y="448" width="380" height="2" fill="#15110e"/>
  <text x="60" y="476" class="k-type hot">${w.type}</text>
  <text x="440" y="476" text-anchor="end" class="k-type">${w.era}</text>
  <path d="M60,487H440M60,622H440" stroke="#b8902f" stroke-width="1.2"/>
  <text x="250" y="652" text-anchor="middle" class="k-foot">${w.where}</text>
  <path d="${A.starD(128, 648, 6.5)}${A.starD(372, 648, 6.5)}" fill="#b8902f"/>
  <circle cx="76" cy="84" r="46" fill="#3b2f1c" opacity=".45" filter="url(#v2-blur-s)"/>
  ${rim()}
</svg>
<svg class="layer px" viewBox="0 0 500 700" style="--d:1cqw">
  <defs>${grads(p + 'v')}</defs>
  <circle cx="72" cy="76" r="47" fill="url(#g-gold-d)" filter="url(#f-bevel)"/>
  <circle cx="72" cy="76" r="39" fill="url(#${p}v-glaze)"/>
  <path d="M44,66A30,30 0 0 1 90,50A37,37 0 0 0 44,66Z" fill="#fff" opacity=".4"/>
  <text x="72" y="96" text-anchor="middle" class="k-value">${c.value}</text>
</svg>
${K.text(c)}
<div class="abs v2-gloss e10-gloss"></div>`;
  }

  // Shared by the whole deck, so it takes no side: a white dial, gold hours, the hands a few minutes short of twelve.
  function back(c, p = 'e10') {
    const b = p + 'b';
    const at = (r, deg) => A.f(250 + r * Math.sin(A.rad(deg))) + ',' + A.f(350 - r * Math.cos(A.rad(deg)));
    let hours = '';
    for (let i = 0; i < 12; i++) hours += `<path d="M${at(i % 3 ? 124 : 112, i * 30)}L${at(136, i * 30)}"/>`;
    const hand = (len, w, deg) =>
      `<path d="M${250 - w},364L${A.f(250 - w * 0.3)},${350 - len}H${A.f(250 + w * 0.3)}L${250 + w},364Z" transform="rotate(${deg} 250 350)"/>`;
    const HANDS = hand(120, 7, -30) + hand(82, 9.5, -2.5);
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>${grads(b)}</defs>
  ${body(b)}
  <circle cx="250" cy="350" r="176" fill="none" stroke="#15110e" stroke-width="7"/>
  <circle cx="258" cy="366" r="150" fill="#3b2f1c" opacity=".5" filter="url(#v2-blur)"/>
  ${rim('#15110e')}
</svg>
<svg class="layer px" viewBox="0 0 500 700" style="--d:1.3cqw">
  <defs><radialGradient id="${b}-dial" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#f1ecdf"/><stop offset="1" stop-color="#cdc4ae"/></radialGradient></defs>
  <circle cx="250" cy="350" r="150" fill="url(#${b}-dial)" filter="url(#f-bevel-xl)"/>
  <g stroke="#c9a03c" stroke-width="7" filter="url(#f-bevel-s)">${hours}</g>
  <g transform="translate(5 9)" fill="#3b2f1c" opacity=".45" filter="url(#v2-blur-s)">${HANDS}</g>
</svg>
<svg class="layer px" viewBox="0 0 500 700" style="--d:2.2cqw">
  <g fill="#15110e" filter="url(#f-bevel-s)">${HANDS}</g>
  <circle cx="250" cy="350" r="11" fill="url(#g-gold-r)" filter="url(#f-bevel)"/>
</svg>
<div class="abs v2-gloss e10-gloss"></div>`;
  }

  window.CardDesigns = window.CardDesigns || [];
  window.CardDesigns.push({
    id: '10',
    key: 'e10',
    cls: 'v2 e10',
    name: 'Porcelain',
    concept: 'The poster painted on white porcelain under a gilt rim: the brightest and lightest of the ten.',
    notes: [
      ['Frame', 'A gilt rim and a red line on white glaze; the slots are ruled off in gold rather than boxed.'],
      ['Value', 'A red glazed boss in a gold collar.'],
      ['Title', 'Black lettering straight on the glaze, underlined in red.'],
      ['Back', 'No side: a white domed dial with gold hours, the black hands a few minutes short of twelve.'],
    ],
    front,
    back,
  });
})();
