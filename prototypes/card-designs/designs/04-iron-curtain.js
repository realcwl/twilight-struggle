// 04 Iron Curtain: riveted gunmetal, stencilled paint and a red warning lamp.
(function () {
  const A = window.CardArt;
  const PLATE = 'M22,0H478A22,22 0 0 1 500,22V678A22,22 0 0 1 478,700H22A22,22 0 0 1 0,678V22A22,22 0 0 1 22,0Z';
  const WIN = 'M66,98H434L460,124V346L434,372H66L40,346V124Z';
  const WIN_IN = 'M72,111H428L447,130V340L428,359H72L53,340V130Z';

  function rivets() {
    let out = '';
    for (let x = 46; x <= 454; x += 58.3) out += A.rivet(x, 15, 3.6, 'gun') + A.rivet(x, 685, 3.6, 'gun');
    for (let y = 70; y <= 630; y += 62.2) out += A.rivet(15, y, 3.6, 'gun') + A.rivet(485, y, 3.6, 'gun');
    return out;
  }
  function scratches(seed, n) {
    const r = A.rng(seed);
    let d = '';
    for (let i = 0; i < n; i++) {
      const x = r() * 500;
      const y = r() * 700;
      const len = 14 + r() * 70;
      const a = A.rad(-28 + r() * 22);
      d += `M${A.f(x)},${A.f(y)}l${A.f(len * Math.cos(a))},${A.f(len * Math.sin(a))}`;
    }
    return `<path d="${d}" stroke="#fff" stroke-opacity=".1" stroke-width=".7" fill="none"/><path d="${d}" stroke="#000" stroke-opacity=".25" stroke-width=".7" fill="none" transform="translate(.6 .9)"/>`;
  }
  const DEFS = (p) => `
    <linearGradient id="${p}-plate" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4c555d"/><stop offset=".45" stop-color="#2c3238"/><stop offset="1" stop-color="#3a4249"/></linearGradient>
    <linearGradient id="${p}-alu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9dee2"/><stop offset=".5" stop-color="#b3bbc2"/><stop offset="1" stop-color="#8c959d"/></linearGradient>
    <radialGradient id="${p}-lamp" cx=".4" cy=".34" r=".72"><stop offset="0" stop-color="#ffb199"/><stop offset=".3" stop-color="#ff3b2b"/><stop offset=".75" stop-color="#b30d10"/><stop offset="1" stop-color="#4d0305"/></radialGradient>
    <pattern id="${p}-haz" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="22" height="22" fill="#e0ae18"/><rect width="11" height="22" fill="#15171a"/></pattern>
    <filter id="${p}-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="9"/></filter>`;

  function front(c) {
    let bolts = '';
    for (const [x, y] of [[250, 104.5], [250, 365.5], [46.5, 235], [453.5, 235], [120, 104.5], [380, 104.5], [120, 365.5], [380, 365.5]]) bolts += A.rivet(x, y, 4.2, 'steel');
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs><clipPath id="d04-win"><path d="${WIN_IN}"/></clipPath>${DEFS('d04')}</defs>
  <g clip-path="url(#d04-win)"><svg x="53" y="111" width="394" height="248">${A.scene('0 150 600 378')}</svg></g>
  <path d="${WIN_IN}" fill="#000" filter="url(#f-inset)"/>
  <g filter="url(#f-bevel-l)"><path fill-rule="evenodd" d="${PLATE}${WIN}" fill="url(#d04-plate)" filter="url(#f-brushed)"/></g>
  ${scratches(5, 46)}
  <path d="M8,380H492M8,446H492" stroke="#000" stroke-opacity=".6" stroke-width="2"/><path d="M8,382H492M8,448H492" stroke="#fff" stroke-opacity=".12" stroke-width="1"/>
  <g filter="url(#f-drop-s)"><path fill-rule="evenodd" d="${WIN}${WIN_IN}" fill="url(#g-steel-d)" filter="url(#f-bevel)"/></g>
  <path d="${WIN_IN}" fill="none" stroke="#0b0d0f" stroke-width="2"/>
  ${bolts}${rivets()}

  <!-- era: a painted warning plate -->
  <g filter="url(#f-drop-s)"><rect x="138" y="28" width="326" height="50" rx="3" fill="url(#d04-haz)"/><rect x="149" y="37" width="304" height="32" fill="#e0ae18"/></g>
  <rect x="138" y="28" width="326" height="50" rx="3" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="1.5"/>
  <text x="301" y="61" text-anchor="middle" class="d04-era" filter="url(#f-stamp-l)">${c.era.toUpperCase()}</text>

  <!-- title, stencilled on a welded strip -->
  <g filter="url(#f-drop-s)"><rect x="26" y="386" width="448" height="54" rx="3" fill="url(#g-gun)" filter="url(#f-bevel-s)"/></g>
  ${A.rivet(40, 413, 3.6, 'steel')}${A.rivet(460, 413, 3.6, 'steel')}
  <text x="250" y="427" text-anchor="middle" class="d04-title" filter="url(#f-stamp-l)">${c.title.toUpperCase()}</text>

  <!-- data plate -->
  <g filter="url(#f-drop)"><rect x="38" y="456" width="424" height="186" rx="5" fill="url(#d04-alu)" filter="url(#f-bevel-s)"/></g>
  <rect x="38" y="456" width="424" height="186" rx="5" fill="url(#d04-alu)" filter="url(#f-brushed)" opacity=".7"/>
  <rect x="46.500" y="464.500" width="407" height="169" rx="2" fill="none" stroke="#2a3036" stroke-opacity=".55" stroke-width="1"/>
  ${A.screw(52, 470, 4.6, 20)}${A.screw(448, 470, 4.6, -35)}${A.screw(52, 628, 4.6, 70)}${A.screw(448, 628, 4.6, 5)}

  <text x="44" y="672" class="d04-stamped">编号 ${c.no}</text>
  <text x="456" y="672" text-anchor="end" class="d04-stamped">哈瓦那 / 59</text>
  <path d="${A.starD(250, 667, 12)}" fill="#e0312a" filter="url(#f-stamp-l)"/>

  <!-- value: a warning lamp -->
  <circle cx="72" cy="70" r="46" fill="#ff2a1a" opacity=".55" filter="url(#d04-glow)"/>
  <g filter="url(#f-drop)">
    <circle cx="72" cy="70" r="50" fill="url(#g-steel-d)" filter="url(#f-bevel)"/>
    <circle cx="72" cy="70" r="39" fill="#0b0d0f"/>
    <circle cx="72" cy="70" r="36" fill="url(#d04-lamp)"/>
    <path d="M44,56A32,32 0 0 1 92,42A40,40 0 0 0 44,56Z" fill="#fff" opacity=".55"/>
    <text x="72" y="90" text-anchor="middle" class="d04-value">${c.value}</text>
  </g>
  ${[0, 60, 120, 180, 240, 300].map((a) => A.rivet(72 + 44.5 * Math.cos(A.rad(a + 30)), 70 + 44.5 * Math.sin(A.rad(a + 30)), 2.4, 'gun')).join('')}
</svg>
<div class="abs d04-text"><p class="rules">${c.text}</p><p class="note">${CardZh.highlight(c.note)}</p></div>`;
  }

  function back() {
    let spokes = '';
    for (let i = 0; i < 6; i++) spokes += `<rect x="-9" y="-112" width="18" height="84" rx="3" transform="translate(250 350) rotate(${i * 60})"/>`;
    let ring = '';
    for (let i = 0; i < 16; i++) ring += A.rivet(250 + 173 * Math.cos(A.rad(i * 22.5)), 350 + 173 * Math.sin(A.rad(i * 22.5)), 4.4, 'steel');
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>${DEFS('d04b')}</defs>
  <g filter="url(#f-bevel-l)"><path d="${PLATE}" fill="url(#d04b-plate)" filter="url(#f-brushed)"/></g>
  ${scratches(9, 60)}
  <rect x="34" y="34" width="432" height="26" fill="url(#d04b-haz)" filter="url(#f-stamp)"/><rect x="34" y="640" width="432" height="26" fill="url(#d04b-haz)" filter="url(#f-stamp)"/>
  <text x="250" y="112" text-anchor="middle" class="d04-title sm" filter="url(#f-stamp-l)">封存 · 1945</text>
  <text x="250" y="612" text-anchor="middle" class="d04-title sm" filter="url(#f-stamp-l)">1989 · 封存</text>
  <g filter="url(#f-drop)">
    <circle cx="250" cy="350" r="190" fill="url(#g-steel-d)" filter="url(#f-bevel-l)"/>
    <circle cx="250" cy="350" r="156" fill="url(#g-gun-d)" filter="url(#f-bevel-l)"/>
    <circle cx="250" cy="350" r="150" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="2"/>
  </g>
  ${ring}
  <g filter="url(#f-drop)">
    <g fill="url(#g-steel)" filter="url(#f-bevel)">${spokes}<path fill-rule="evenodd" d="M250,226A124,124 0 0 1 250,474A124,124 0 0 1 250,226ZM250,246A104,104 0 0 0 250,454A104,104 0 0 0 250,246Z"/></g>
    <circle cx="250" cy="350" r="46" fill="url(#g-steel-d)" filter="url(#f-bevel)"/>
    <circle cx="250" cy="350" r="34" fill="#16191c"/>
    <path d="${A.starD(250, 351, 27)}" fill="#e0312a" filter="url(#f-stamp-l)"/>
  </g>
  ${rivets()}
</svg>`;
  }

  window.CardDesigns = window.CardDesigns || [];
  window.CardDesigns.push({
    id: '04',
    name: 'Iron Curtain',
    concept: 'Riveted gunmetal, stencilled paint and a red warning lamp: a card cut from a bunker door.',
    notes: [
      ['Frame', 'Brushed plate with weld seams and scratches, a bolted viewport, an aluminium data plate.'],
      ['Value', 'A lit red lamp in a steel bezel, top left.'],
      ['Back', 'A vault wheel with a painted star, hazard bars above and below.'],
      ['Type', 'Stardos Stencil for paint, Oswald for the data plate.'],
    ],
    front,
    back,
  });
})();
