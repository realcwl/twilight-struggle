// 02 Monument: a slab of green marble with cast bronze fittings and a limestone tablet.
(function () {
  const A = window.CardArt;
  const WIN = 'M68,84H432L456,108V344L432,368H68L44,344V108Z';
  const WIN_IN = 'M72,94H428L446,112V340L428,358H72L54,340V112Z';
  const TAB = 'M56,452H444A10,10 0 0 1 454,462V632A10,10 0 0 1 444,642H56A10,10 0 0 1 46,632V462A10,10 0 0 1 56,452Z';
  const SLAB = 'M22,0H478A22,22 0 0 1 500,22V678A22,22 0 0 1 478,700H22A22,22 0 0 1 0,678V22A22,22 0 0 1 22,0Z';
  // letters cut into the stone and gilded
  const carve = (x, y, anchor, cls, label) =>
    `<text x="${x - 0.7}" y="${y - 1.1}" text-anchor="${anchor}" class="${cls}" style="fill:#030b08">${label}</text>` +
    `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}">${label}</text>`;
  const groove = (d) => `<path d="${d}" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="2"/><path d="${d}" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="1" transform="translate(1 1.4)"/>`;

  function front(c) {
    let beads = '';
    for (let i = 0; i < 28; i++) {
      const a = A.rad(i * (360 / 28));
      beads += `<circle cx="${A.f(74 + 40.5 * Math.cos(a))}" cy="${A.f(76 + 40.5 * Math.sin(a))}" r="2.3"/>`;
    }
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>
    <clipPath id="d02-win"><path d="${WIN_IN}"/></clipPath>
    <linearGradient id="d02-stone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f6650"/><stop offset=".5" stop-color="#1b4636"/><stop offset="1" stop-color="#275a46"/></linearGradient>
    <linearGradient id="d02-lime" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9e2cf"/><stop offset="1" stop-color="#cfc5ac"/></linearGradient>
    <radialGradient id="d02-patina" cx=".4" cy=".32" r=".8"><stop offset="0" stop-color="#3f8a76"/><stop offset=".55" stop-color="#1b4a40"/><stop offset="1" stop-color="#0b2620"/></radialGradient>
  </defs>
  <g clip-path="url(#d02-win)"><svg x="54" y="94" width="392" height="264">${A.scene('0 148 600 404')}</svg></g>
  <path d="${WIN_IN}" fill="#000" filter="url(#f-inset)"/>
  <path d="${TAB}" fill="url(#d02-lime)" filter="url(#f-grit)"/>
  <path d="${TAB}" fill="#000" filter="url(#f-inset)" opacity=".7"/>
  <g filter="url(#f-bevel-l)"><path fill-rule="evenodd" d="${SLAB}${WIN}${TAB}" fill="url(#d02-stone)" filter="url(#f-marble)"/></g>
  ${groove('M24,14H476A10,10 0 0 1 486,24V676A10,10 0 0 1 476,686H24A10,10 0 0 1 14,676V24A10,10 0 0 1 24,14Z')}
  <g filter="url(#f-drop-s)"><path fill-rule="evenodd" d="${WIN}${WIN_IN}" fill="url(#g-bronze-d)" filter="url(#f-bevel)"/></g>
  <path d="${WIN_IN}" fill="none" stroke="#1d0f04" stroke-width="1.6"/>

  ${carve(286, 56, 'middle', 'd02-carve', c.era.toUpperCase())}
  ${groove('M150,50H196')}${groove('M376,50H422')}
  <g filter="url(#f-drop-s)"><path d="${A.starD(452, 46, 15)}" fill="url(#g-bronze)" filter="url(#f-bevel-s)"/></g>

  <!-- cast title plaque -->
  <g filter="url(#f-drop)">
    <g filter="url(#f-bevel)"><path d="M84,380H416L436,408L416,436H84L64,408Z" fill="url(#g-bronze)" filter="url(#f-grit)"/></g>
    <path d="M88,386H412L428,408L412,430H88L72,408Z" fill="none" stroke="#3a1e08" stroke-opacity=".7" stroke-width="1.4"/>
  </g>
  ${A.rivet(88, 408, 4.5, 'bronze')}${A.rivet(412, 408, 4.5, 'bronze')}
  <text x="250" y="421" text-anchor="middle" class="d02-title">${c.title.toUpperCase()}</text>

  <!-- foot, cut into the marble -->
  ${carve(58, 674, 'start', 'd02-carve sm', '第 014 号')}
  ${carve(442, 674, 'end', 'd02-carve sm', '1959')}
  ${groove('M150,669H350')}

  <!-- value medallion -->
  <g filter="url(#f-drop)">
    <circle cx="74" cy="76" r="50" fill="url(#g-bronze-d)" filter="url(#f-bevel)"/>
    <circle cx="74" cy="76" r="34" fill="url(#d02-patina)"/>
    <circle cx="74" cy="76" r="34" fill="#000" filter="url(#f-inset)" opacity=".8"/>
    <g fill="#3a1e08" opacity=".75">${beads}</g>
    <circle cx="74" cy="76" r="34" fill="none" stroke="#2a1505" stroke-width="1.5"/>
    <text x="74" y="94" text-anchor="middle" class="d02-value">${c.value}</text>
  </g>
</svg>
<div class="abs d02-text"><p class="rules">${c.text}</p><p class="note">${CardZh.highlight(c.note)}</p></div>`;
  }

  function back() {
    const bolt = (x, y) => `<g filter="url(#f-drop-s)"><path d="${A.starD(x, y, 13)}" fill="url(#g-bronze)" filter="url(#f-bevel-s)"/></g>`;
    let dent = '';
    for (let i = 0; i < 19; i++) dent += `<rect x="${72 + i * 19}" y="92" width="11" height="9"/><rect x="${72 + i * 19}" y="599" width="11" height="9"/>`;
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>
    <linearGradient id="d02b-stone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f6650"/><stop offset=".5" stop-color="#1b4636"/><stop offset="1" stop-color="#275a46"/></linearGradient>
    <radialGradient id="d02b-patina" cx=".4" cy=".32" r=".8"><stop offset="0" stop-color="#3f8a76"/><stop offset=".55" stop-color="#1b4a40"/><stop offset="1" stop-color="#0b2620"/></radialGradient>
  </defs>
  <circle cx="250" cy="350" r="150" fill="#0f241f"/>
  <g filter="url(#f-bevel-l)"><path fill-rule="evenodd" d="${SLAB}M250,196A154,154 0 0 1 250,504A154,154 0 0 1 250,196Z" fill="url(#d02b-stone)" filter="url(#f-marble)"/></g>
  <circle cx="250" cy="350" r="154" fill="#000" filter="url(#f-inset)"/>
  ${groove('M24,14H476A10,10 0 0 1 486,24V676A10,10 0 0 1 476,686H24A10,10 0 0 1 14,676V24A10,10 0 0 1 24,14Z')}
  ${groove('M56,60H444V640H56Z')}
  <g fill="#000" opacity=".45">${dent}</g><g fill="#fff" opacity=".12" transform="translate(1 1.500)">${dent}</g>
  ${carve(250, 148, 'middle', 'd02-carve', '1945')}
  ${carve(250, 566, 'middle', 'd02-carve', '1989')}
  <g filter="url(#f-drop)">
    <g filter="url(#f-bevel)"><path fill-rule="evenodd" d="M250,204A146,146 0 0 1 250,496A146,146 0 0 1 250,204ZM250,222A128,128 0 0 0 250,478A128,128 0 0 0 250,222Z" fill="url(#g-bronze-d)" filter="url(#f-grit)"/></g>
    <circle cx="250" cy="350" r="128" fill="url(#d02b-patina)"/>
    <circle cx="250" cy="350" r="128" fill="#000" filter="url(#f-inset)" opacity=".8"/>
    <g fill="url(#g-bronze)" filter="url(#f-bevel-s)">${A.laurel(250, 356, 104, 13, 0.25, 142)}</g>
    <g stroke="url(#g-bronze)" filter="url(#f-bevel-s)">${A.globe(250, 356, 62, 4.2)}</g>
    <g filter="url(#f-bevel-s)"><path d="${A.starD(250, 262, 21)}" fill="url(#g-bronze)"/>${A.starFacets(250, 262, 21)}</g>
  </g>
  ${bolt(40, 40)}${bolt(460, 40)}${bolt(40, 660)}${bolt(460, 660)}
</svg>`;
  }

  window.CardDesigns = window.CardDesigns || [];
  window.CardDesigns.push({
    id: '02',
    name: 'Monument',
    concept: 'A slab of green marble with cast bronze fittings; the rules are cut into a limestone tablet.',
    notes: [
      ['Frame', 'Veined marble with chiselled edges, a chamfered bronze window, a bolted title plaque.'],
      ['Value', 'A bronze medallion with a verdigris well, top left.'],
      ['Back', 'The same slab with a sunk roundel: bronze globe, laurel and star.'],
      ['Type', 'Cinzel throughout, carved or raised; EB Garamond for rules.'],
    ],
    front,
    back,
  });
})();
