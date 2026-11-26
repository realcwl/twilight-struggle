// 03 War Room: walnut, brass and green leather, the furniture of a strategist's desk.
(function () {
  const A = window.CardArt;
  const BOARD = 'M22,0H478A22,22 0 0 1 500,22V678A22,22 0 0 1 478,700H22A22,22 0 0 1 0,678V22A22,22 0 0 1 22,0Z';
  const WIN = 'M56,60H444A14,14 0 0 1 458,74V342A14,14 0 0 1 444,356H56A14,14 0 0 1 42,342V74A14,14 0 0 1 56,60Z';
  const WIN_IN = 'M58,70H442A6,6 0 0 1 448,76V340A6,6 0 0 1 442,346H58A6,6 0 0 1 52,340V76A6,6 0 0 1 58,70Z';
  const PAD = 'M54,438H446A12,12 0 0 1 458,450V636A12,12 0 0 1 446,648H54A12,12 0 0 1 42,636V450A12,12 0 0 1 54,438Z';
  const INLAY = 'M26,13H474A13,13 0 0 1 487,26V674A13,13 0 0 1 474,687H26A13,13 0 0 1 13,674V26A13,13 0 0 1 26,13Z';

  function front(c) {
    let ticks = '';
    for (let i = 0; i < 40; i++) {
      const a = A.rad(i * 9);
      const r0 = i % 5 ? 31 : 28;
      ticks += `M${A.f(76 + r0 * Math.cos(a))},${A.f(78 + r0 * Math.sin(a))}L${A.f(76 + 34 * Math.cos(a))},${A.f(78 + 34 * Math.sin(a))}`;
    }
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>
    <clipPath id="d03-win"><path d="${WIN_IN}"/></clipPath>
    <linearGradient id="d03-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#85502c"/><stop offset=".5" stop-color="#5e3419"/><stop offset="1" stop-color="#744424"/></linearGradient>
    <linearGradient id="d03-leather" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a6149"/><stop offset="1" stop-color="#143526"/></linearGradient>
    <radialGradient id="d03-dial" cx=".42" cy=".36" r=".75"><stop offset="0" stop-color="#fffbee"/><stop offset=".7" stop-color="#efe2c2"/><stop offset="1" stop-color="#cdb98c"/></radialGradient>
  </defs>
  <g clip-path="url(#d03-win)"><svg x="52" y="70" width="396" height="276">${A.scene('0 144 600 418')}</svg></g>
  <path d="${WIN_IN}" fill="#000" filter="url(#f-inset)"/>
  <path d="${PAD}" fill="url(#d03-leather)" filter="url(#f-leather)"/>
  <path d="${PAD}" fill="#000" filter="url(#f-inset)" opacity=".85"/>
  <g filter="url(#f-bevel-l)"><path fill-rule="evenodd" d="${BOARD}${WIN}${PAD}" fill="url(#d03-wood)" filter="url(#f-wood)"/></g>
  <path d="${INLAY}" fill="none" stroke="url(#g-brass-d)" stroke-width="3.2" filter="url(#f-bevel-s)"/>
  <g filter="url(#f-drop-s)"><path fill-rule="evenodd" d="${WIN}${WIN_IN}" fill="url(#g-brass-d)" filter="url(#f-bevel)"/></g>
  <path d="${WIN_IN}" fill="none" stroke="#2b1a05" stroke-width="1.5"/>

  <!-- tooling and stitching on the leather -->
  <rect x="51.500" y="447.500" width="397" height="191" rx="8" fill="none" stroke="#e7c873" stroke-opacity=".8" stroke-width="1.3" stroke-dasharray="5.500 4"/>
  <rect x="59.500" y="455.500" width="381" height="175" rx="4" fill="none" stroke="#e7c873" stroke-opacity=".55" stroke-width="1"/>
  <g fill="#e7c873" opacity=".85"><path d="${A.starD(69, 465, 5)}"/><path d="${A.starD(431, 465, 5)}"/><path d="${A.starD(69, 621, 5)}"/><path d="${A.starD(431, 621, 5)}"/></g>

  <!-- era tag -->
  <g filter="url(#f-drop-s)"><rect x="172" y="22" width="260" height="28" rx="4" fill="url(#g-brass)" filter="url(#f-bevel-s)"/></g>
  <rect x="172" y="22" width="260" height="28" rx="4" fill="url(#g-brass)" filter="url(#f-brushed)" opacity=".5"/>
  ${A.rivet(182, 36, 2.6, 'brass')}${A.rivet(422, 36, 2.6, 'brass')}
  <text x="302" y="40.500" text-anchor="middle" class="d03-engrave">${c.era.toUpperCase()} · ${c.eraSpan}</text>

  <!-- nameplate -->
  <g filter="url(#f-drop)"><rect x="62" y="368" width="376" height="58" rx="7" fill="url(#g-brass)" filter="url(#f-bevel)"/></g>
  <rect x="62" y="368" width="376" height="58" rx="7" fill="url(#g-brass)" filter="url(#f-brushed)" opacity=".55"/>
  <rect x="69.500" y="375.500" width="361" height="43" rx="3" fill="none" stroke="#5a3d0c" stroke-opacity=".6" stroke-width="1"/>
  ${A.screw(82, 397, 6, 28, 'brass')}${A.screw(418, 397, 6, -40, 'brass')}
  <text x="250" y="409" text-anchor="middle" class="d03-title">${c.title.toUpperCase()}</text>

  <!-- foot: gilt lettering on the wood -->
  <text x="56" y="676" class="d03-gilt">№ ${c.no}</text>
  <text x="444" y="676" text-anchor="end" class="d03-gilt">${c.place.toUpperCase()} · 1959</text>
  <g filter="url(#f-drop-s)"><path d="${A.starD(250, 670, 11)}" fill="url(#g-brass)" filter="url(#f-bevel-s)"/></g>

  <!-- value: a brass dial -->
  <g filter="url(#f-drop)">
    <circle cx="76" cy="78" r="50" fill="url(#g-brass-d)" filter="url(#f-bevel)"/>
    <circle cx="76" cy="78" r="46" fill="none" stroke="#5a3d0c" stroke-width="5" stroke-dasharray="2 2.200" opacity=".55"/>
    <circle cx="76" cy="78" r="38" fill="url(#d03-dial)"/>
    <circle cx="76" cy="78" r="38" fill="#000" filter="url(#f-inset)" opacity=".5"/>
    <path d="${ticks}" stroke="#3b2a14" stroke-width="1.1" fill="none"/>
    <text x="76" y="97" text-anchor="middle" class="d03-value">${c.value}</text>
    <path d="M46,62A34,34 0 0 1 96,48A42,42 0 0 0 46,62Z" fill="#fff" opacity=".55"/>
    <circle cx="76" cy="78" r="38" fill="none" stroke="#2b1a05" stroke-width="1.5"/>
  </g>
</svg>
<div class="abs d03-text"><p class="rules">${c.text}</p><p class="note">${CardZh.highlight(c.note)}</p></div>`;
  }

  function back() {
    const PANEL = 'M52,40H448A12,12 0 0 1 460,52V648A12,12 0 0 1 448,660H52A12,12 0 0 1 40,648V52A12,12 0 0 1 52,40Z';
    let quilt = '';
    let studs = '';
    for (let i = -12; i <= 12; i++) {
      quilt += `M${250 + i * 60 - 400},-50L${250 + i * 60 + 400},750M${250 + i * 60 + 400},-50L${250 + i * 60 - 400},750`;
    }
    for (let row = 0; row <= 11; row++) {
      for (let col = 0; col <= 8; col++) {
        const x = 10 + col * 60 + (row % 2 ? 30 : 0);
        const y = 20 + row * 60;
        if (x < 56 || x > 444 || y < 56 || y > 644) continue;
        if (Math.hypot(x - 250, y - 350) < 122) continue;
        studs += A.rivet(x, y, 3.4, 'brass');
      }
    }
    const corner = (sx, sy) => {
      const X = (v) => (sx > 0 ? v : 500 - v);
      const Y = (v) => (sy > 0 ? v : 700 - v);
      const sweep = sx * sy > 0 ? 1 : 0;
      return (
        `<g filter="url(#f-drop-s)"><path d="M${X(0)},${Y(22)}A22,22 0 0 ${sweep} ${X(22)},${Y(0)}H${X(92)}L${X(0)},${Y(92)}Z" fill="url(#g-brass-d)" filter="url(#f-bevel)"/>` +
        A.rivet(X(22), Y(22), 4, 'brass') + A.rivet(X(58), Y(14), 3, 'brass') + A.rivet(X(14), Y(58), 3, 'brass') + '</g>'
      );
    };
    const rose = A.orderStar(250, 350, 84, 4, 0.3, 0.62);
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>
    <clipPath id="d03b-pad"><path d="${PANEL}"/></clipPath>
    <linearGradient id="d03b-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#85502c"/><stop offset=".5" stop-color="#5e3419"/><stop offset="1" stop-color="#744424"/></linearGradient>
    <radialGradient id="d03b-leather" cx=".5" cy=".5" r=".75"><stop offset="0" stop-color="#2d6a50"/><stop offset="1" stop-color="#113022"/></radialGradient>
    <radialGradient id="d03b-dial" cx=".42" cy=".36" r=".75"><stop offset="0" stop-color="#fffbee"/><stop offset=".7" stop-color="#efe2c2"/><stop offset="1" stop-color="#cdb98c"/></radialGradient>
  </defs>
  <path d="${PANEL}" fill="url(#d03b-leather)" filter="url(#f-leather)"/>
  <g clip-path="url(#d03b-pad)"><path d="${quilt}" stroke="#061a11" stroke-opacity=".7" stroke-width="2.4" fill="none"/><path d="${quilt}" stroke="#7fc0a0" stroke-opacity=".16" stroke-width="1" fill="none" transform="translate(1.200 1.600)"/></g>
  ${studs}
  <path d="${PANEL}" fill="#000" filter="url(#f-inset)" opacity=".9"/>
  <g filter="url(#f-bevel-l)"><path fill-rule="evenodd" d="${BOARD}${PANEL}" fill="url(#d03b-wood)" filter="url(#f-wood)"/></g>
  <path d="${INLAY}" fill="none" stroke="url(#g-brass-d)" stroke-width="3.2" filter="url(#f-bevel-s)"/>
  <rect x="50.500" y="50.500" width="399" height="599" rx="7" fill="none" stroke="#e7c873" stroke-opacity=".75" stroke-width="1.3" stroke-dasharray="5.500 4"/>

  <g filter="url(#f-drop)">
    <circle cx="250" cy="350" r="108" fill="url(#g-brass-d)" filter="url(#f-bevel)"/>
    <circle cx="250" cy="350" r="101" fill="none" stroke="#5a3d0c" stroke-width="6" stroke-dasharray="2 2.400" opacity=".5"/>
    <circle cx="250" cy="350" r="92" fill="url(#d03b-dial)"/>
    <circle cx="250" cy="350" r="92" fill="#000" filter="url(#f-inset)" opacity=".55"/>
    <g stroke="#6b5326" opacity=".8">${A.globe(250, 350, 70, 1.3)}</g>
    <g filter="url(#f-drop-s)"><g filter="url(#f-bevel-s)"><path d="${rose.d}" fill="url(#g-brass-d)"/>${rose.facets}</g></g>
    <circle cx="250" cy="350" r="8" fill="url(#g-brass-r)" stroke="#2b1a05" stroke-width="1"/>
    <text x="250" y="279" text-anchor="middle" class="d03-compass">北</text><text x="250" y="436" text-anchor="middle" class="d03-compass">南</text>
    <text x="327" y="356" text-anchor="middle" class="d03-compass">东</text><text x="173" y="356" text-anchor="middle" class="d03-compass">西</text>
    <path d="M178,306A84,84 0 0 1 300,272A102,102 0 0 0 178,306Z" fill="#fff" opacity=".5"/>
    <circle cx="250" cy="350" r="92" fill="none" stroke="#2b1a05" stroke-width="1.6"/>
  </g>
  ${corner(1, 1)}${corner(-1, 1)}${corner(1, -1)}${corner(-1, -1)}
</svg>`;
  }

  window.CardDesigns = window.CardDesigns || [];
  window.CardDesigns.push({
    id: '03',
    name: 'War Room',
    concept: 'Walnut, brass and green leather: the furniture of a strategist’s desk.',
    notes: [
      ['Frame', 'Grained walnut with a brass inlay, a brass picture rim, an engraved nameplate on screws.'],
      ['Value', 'A brass instrument dial under glass, top left.'],
      ['Back', 'Quilted leather with brass studs, corner guards and a compass-rose globe.'],
      ['Type', 'Cinzel engraved on brass; EB Garamond in gilt on the leather.'],
    ],
    front,
    back,
  });
})();
