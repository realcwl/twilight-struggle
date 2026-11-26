// V2 04 Letterpress: the poster still locked in the printer's forme. Wood frame, wood-type title.
(function () {
  const A = window.CardArt;
  const K = window.V2;
  const f = A.f;
  const wood = (p) =>
    `<linearGradient id="${p}-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9a6234"/><stop offset=".5" stop-color="#6f4120"/><stop offset="1" stop-color="#87532b"/></linearGradient>`;
  const frame = (p) =>
    '<rect x="30" y="30" width="440" height="640" rx="3" fill="#000" filter="url(#f-inset)" opacity=".6"/>' +
    `<g filter="url(#f-bevel-l)"><path fill-rule="evenodd" d="${K.band(0, 30, 23, 3)}" fill="url(#${p}-wood)" filter="url(#f-wood)"/></g>` +
    '<path d="M5,5L30,30M495,5L470,30M5,695L30,670M495,695L470,670" stroke="#241204" stroke-opacity=".55" stroke-width="1.5"/>';

  // one block of wood type per letter, set a little unevenly
  function type(title) {
    const letters = [...title];
    const n = letters.length;
    const gap = 2.4;
    const tw = (404 - gap * (n - 1)) / n;
    const r = A.rng(5);
    let blocks = '';
    let glyphs = '';
    letters.forEach((ch, i) => {
      const x = 48 + i * (tw + gap);
      const dy = (r() - 0.5) * 3.2;
      const turn = `rotate(${f((r() - 0.5) * 2.6)} ${f(x + tw / 2)} 355)`;
      blocks += `<rect x="${f(x)}" y="${f(322 + dy)}" width="${f(tw)}" height="66" rx="2.5" fill="${['#dcb078', '#cfa064', '#e2b982'][i % 3]}" transform="${turn}"/>`;
      glyphs += `<text x="${f(x + tw / 2)}" y="${f(370.5 + dy)}" text-anchor="middle" class="e04-letter${i ? '' : ' hot'}" transform="${turn}">${ch}</text>`;
    });
    return `<g filter="url(#f-drop-s)"><g filter="url(#f-bevel-s)"><g filter="url(#f-wood)">${blocks}</g></g></g>${glyphs}`;
  }

  function front(c, p = 'e04') {
    const w = K.words(c);
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>${wood(p)}</defs>
  <rect width="500" height="700" fill="#efe4c6" filter="url(#f-grit)"/>
  <g filter="url(#f-rough)"><rect x="58" y="60" width="404" height="256" fill="#c8281e"/><rect x="45" y="47" width="410" height="262" fill="#15110e"/></g>
  ${K.photo(p + '-win', K.rr(48, 50, 404, 256), [48, 50, 404, 256], '10 150 580 368')}
  <path d="M374,50H452V77H374Z" fill="#15110e"/>
  <text x="444" y="69.500" text-anchor="end" class="k-no">${w.no}</text>
  ${type(w.title)}

  <path d="M48,401H452" stroke="#15110e" stroke-width="2.5"/><path d="M48,427H452" stroke="#15110e" stroke-width="1"/>
  <text x="48" y="419" class="k-type hot">${w.type}</text>
  <text x="452" y="419" text-anchor="end" class="k-type">${w.era}</text>
  <path d="${A.starD(213, 414.500, 6.5)}" fill="#c8281e"/>

  <rect x="48" y="442" width="9" height="150" fill="#15110e" filter="url(#f-rough)"/>
  <path d="M48,606H452" stroke="#15110e" stroke-width="3"/><path d="M48,612H452" stroke="#15110e" stroke-width="1"/>
  <text x="250" y="640" text-anchor="middle" class="k-foot">${w.where}</text>
  <rect x="26" y="30" width="94" height="100" rx="5" fill="#000" opacity=".5" filter="url(#v2-blur-s)"/>
  ${frame(p)}
</svg>
<svg class="layer px" viewBox="0 0 500 700" style="--d:1cqw">
  <g filter="url(#f-bevel)"><rect x="20" y="20" width="94" height="100" rx="5" fill="#c4935a" filter="url(#f-wood)"/></g>
  <rect x="29" y="29" width="76" height="82" rx="2" fill="#c8281e" filter="url(#f-grit)"/>
  <text x="67" y="92" text-anchor="middle" class="k-value">${c.value}</text>
</svg>
${K.text(c)}
<div class="abs v2-print"></div>`;
  }

  // Shared by the whole deck: two inks overprinted, blue from the west and red from the east.
  function back(c, p = 'e04') {
    const b = p + 'b';
    const DISCS = K.circle(203, 350, 104) + K.circle(297, 350, 104);
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>${wood(b)}</defs>
  <rect width="500" height="700" fill="url(#${b}-wood)" filter="url(#f-wood)"/>
  <rect width="500" height="700" fill="#1a0c03" opacity=".62"/>
  <circle cx="257" cy="363" r="184" fill="#000" opacity=".6" filter="url(#v2-blur)"/>
  ${frame(b)}
</svg>
<svg class="layer px" viewBox="0 0 500 700" style="--d:.8cqw">
  <g filter="url(#f-bevel-l)"><circle cx="250" cy="350" r="184" fill="#efe4c6" filter="url(#f-grit)"/></g>
  ${K.shadow(DISCS, 5, 9, 0.45, 'v2-blur-s')}
</svg>
<svg class="layer px" viewBox="0 0 500 700" style="--d:1.7cqw">
  <g filter="url(#f-bevel)"><g filter="url(#f-grit)">
    <path d="${K.circle(203, 350, 104)}" fill="${K.BLUE}"/>
    <path d="${K.circle(297, 350, 104)}" fill="${K.RED}"/>
    <path d="${K.lens(203, 297, 350, 104)}" fill="#1c1622"/>
  </g></g>
</svg>`;
  }

  window.CardDesigns = window.CardDesigns || [];
  window.CardDesigns.push({
    id: '04',
    key: 'e04',
    cls: 'v2 e04',
    name: 'Letterpress',
    concept: 'The poster still locked in the printer’s forme: a wood frame, the title set in blocks of wood type.',
    notes: [
      ['Frame', 'Stained wood with mitred corners; the sheet sits inside it, ruled off into slots.'],
      ['Value', 'A single large type block, inked red.'],
      ['Title', 'One wooden block per letter, set slightly unevenly; the first letter in red.'],
      ['Back', 'Both sides overprinted: a blue disc and a red disc on a round ivory block, black where they overlap.'],
    ],
    front,
    back,
  });
})();
