// V2 07 Bronze: the poster as a memorial plaque. Cast bronze round red and limestone, a stepped window.
(function () {
  const A = window.CardArt;
  const K = window.V2;
  const band = `<g filter="url(#f-bevel-l)"><path fill-rule="evenodd" d="${K.band(0, 24, 23, 6)}" fill="url(#g-bronze-d)" filter="url(#f-grit)"/></g>`;
  const WIN = 'M56,330V118H96V86H146V56H354V86H404V118H444V330Z';
  const RIM = 'M44,342V106H84V74H134V44H366V74H416V106H456V342Z';

  function front(c, p = 'e07') {
    const w = K.words(c);
    return `
<svg class="frame" viewBox="0 0 500 700">
  <rect width="500" height="700" fill="#e6dcc1" filter="url(#f-grit)"/>
  <rect x="0" y="0" width="500" height="352" fill="#c0241c" filter="url(#f-grit)"/>
  ${K.photo(p + '-win', WIN, [56, 56, 388, 274], '40 140 520 367')}
  <path d="${WIN}" fill="#000" filter="url(#f-inset)" opacity=".75"/>
  <g filter="url(#f-drop)"><g filter="url(#f-bevel)"><path fill-rule="evenodd" d="${RIM}${WIN}" fill="url(#g-bronze-d)" filter="url(#f-grit)"/></g></g>
  <text x="464" y="58" text-anchor="end" class="k-no">${w.no}</text>

  <!-- title plaque -->
  <g filter="url(#f-drop)"><rect x="30" y="353" width="440" height="78" rx="5" fill="url(#g-bronze-d)" filter="url(#f-bevel)"/></g>
  <rect x="39" y="362" width="422" height="60" rx="2" fill="#15110e"/>
  <rect x="39" y="362" width="422" height="60" rx="2" fill="#000" filter="url(#f-inset)" opacity=".7"/>
  <text x="250" y="408" text-anchor="middle" class="k-title">${w.title}</text>

  <text x="40" y="455" class="k-type hot">${w.type}</text>
  <text x="460" y="455" text-anchor="end" class="k-type">${w.era}</text>
  <rect x="36" y="466" width="428" height="150" rx="4" fill="#f5efdc" stroke="#8a5a2a" stroke-width="2"/>
  <rect x="36" y="466" width="428" height="150" rx="4" fill="#000" filter="url(#f-inset)" opacity=".35"/>
  <text x="250" y="650" text-anchor="middle" class="k-foot">${w.where}</text>
  <path d="${A.starD(120, 646, 7)}${A.starD(380, 646, 7)}" fill="#8a5a2a"/>
  <circle cx="77" cy="86" r="47" fill="#000" opacity=".55" filter="url(#v2-blur-s)"/>
  ${band}
</svg>
<svg class="layer px" viewBox="0 0 500 700" style="--d:1cqw">
  <g filter="url(#f-bevel)"><circle cx="72" cy="76" r="47" fill="url(#g-bronze-d)" filter="url(#f-grit)"/></g>
  <circle cx="72" cy="76" r="35" fill="#15110e"/>
  <circle cx="72" cy="76" r="35" fill="#000" filter="url(#f-inset)" opacity=".8"/>
  <text x="72" y="96" text-anchor="middle" class="k-value">${c.value}</text>
</svg>
${K.text(c)}`;
  }

  // Shared by the whole deck, so it takes no side: the atom, cast in bronze over a dark patina well.
  function back(c, p = 'e07') {
    const b = p + 'b';
    const orbits = [90, 30, 150].map((a) => `<ellipse cx="250" cy="350" rx="146" ry="52" transform="rotate(${a} 250 350)"/>`).join('');
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs><radialGradient id="${b}-well" cx=".5" cy=".42" r=".62"><stop offset="0" stop-color="#2f3a34"/><stop offset="1" stop-color="#0d110f"/></radialGradient></defs>
  <rect width="500" height="700" fill="url(#g-bronze-d)" filter="url(#f-grit)"/>
  <rect width="500" height="700" fill="#1a0c02" opacity=".3"/>
  <g filter="url(#f-drop)"><g filter="url(#f-bevel-l)"><path fill-rule="evenodd" d="${K.circle(250, 350, 192)}${K.circle(250, 350, 172)}" fill="url(#g-bronze-d)" filter="url(#f-grit)"/></g></g>
  <circle cx="250" cy="350" r="172" fill="url(#${b}-well)"/>
  <circle cx="250" cy="350" r="172" fill="#000" filter="url(#f-inset)" opacity=".9"/>
  <g transform="translate(8 14)" opacity=".65" filter="url(#v2-blur)"><g fill="none" stroke="#000" stroke-width="15">${orbits}</g><circle cx="250" cy="350" r="34"/></g>
  ${band}
</svg>
<svg class="layer px" viewBox="0 0 500 700" style="--d:1.8cqw">
  <g filter="url(#f-bevel-l)"><g fill="none" stroke="url(#g-bronze-d)" stroke-width="15">${orbits}</g><circle cx="250" cy="350" r="34" fill="url(#g-bronze-r)"/></g>
</svg>`;
  }

  window.CardDesigns = window.CardDesigns || [];
  window.CardDesigns.push({
    id: '07',
    key: 'e07',
    cls: 'v2 e07',
    name: 'Bronze',
    concept: 'The poster as a memorial plaque: cast bronze round red and limestone, with a stepped window.',
    notes: [
      ['Frame', 'Cast bronze band and a stepped window rim; red above the title, pale stone below it.'],
      ['Value', 'A bronze medallion with a black well.'],
      ['Title', 'A black enamel plaque in a bronze rim, straight across the middle.'],
      ['Back', 'No side: a cast plaque with the atom in high relief over a dark patina well.'],
    ],
    front,
    back,
  });
})();
