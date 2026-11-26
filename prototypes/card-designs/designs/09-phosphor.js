// 09 Phosphor: a situation-room monitor. Green phosphor, amber readouts, scanlines, a live sweep.
(function () {
  const A = window.CardArt;
  const BEZEL = (p) => `
    <linearGradient id="${p}-bezel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3f42"/><stop offset=".5" stop-color="#1c1f21"/><stop offset="1" stop-color="#2a2e31"/></linearGradient>
    <radialGradient id="${p}-glass" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#0b3320"/><stop offset=".6" stop-color="#051a10"/><stop offset="1" stop-color="#020a06"/></radialGradient>`;
  const SCREEN = 'M52,24H448A28,28 0 0 1 476,52V640A28,28 0 0 1 448,668H52A28,28 0 0 1 24,640V52A28,28 0 0 1 52,24Z';
  const PLATE = 'M22,0H478A22,22 0 0 1 500,22V678A22,22 0 0 1 478,700H22A22,22 0 0 1 0,678V22A22,22 0 0 1 22,0Z';
  const shell = (p) =>
    `<path d="${SCREEN}" fill="url(#${p}-glass)"/>` +
    `<g filter="url(#f-bevel-l)"><path fill-rule="evenodd" d="${PLATE}${SCREEN}" fill="url(#${p}-bezel)" filter="url(#f-grit)"/></g>` +
    `<path d="${SCREEN}" fill="none" stroke="#000" stroke-width="3"/>` +
    A.screw(14, 14, 4.6, 30, 'gun') + A.screw(486, 14, 4.6, -20, 'gun') + A.screw(14, 686, 4.6, 80, 'gun') + A.screw(486, 686, 4.6, 10, 'gun') +
    '<circle cx="452" cy="684" r="7" fill="#ff3b2b" opacity=".5" filter="url(#f-drop-s)"/><circle cx="452" cy="684" r="3.200" fill="#ff5a48"/><circle cx="451" cy="683" r="1.100" fill="#fff" opacity=".8"/>' +
    '<text x="48" y="689" class="d09-brand">世界 · 45/89 型</text>';
  const brackets = (x0, y0, x1, y1, n = 16) =>
    `M${x0},${y0 + n}V${y0}H${x0 + n}M${x1 - n},${y0}H${x1}V${y0 + n}M${x1},${y1 - n}V${y1}H${x1 - n}M${x0 + n},${y1}H${x0}V${y1 - n}`;

  function front(c) {
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>${BEZEL('d09')}<clipPath id="d09-win"><rect x="46" y="142" width="408" height="246"/></clipPath></defs>
  ${shell('d09')}
  <g class="d09-glow">
    <g clip-path="url(#d09-win)"><svg x="46" y="142" width="408" height="246">${A.scene('0 150 600 362')}</svg></g>
    <path d="${brackets(46, 142, 454, 388)}" fill="none" stroke="#6dffaa" stroke-width="2"/>
    <path d="M250,142V152M250,378V388M46,265H56M444,265H454" stroke="#6dffaa" stroke-width="1.4"/>
    <path d="M146,58V128M146,134H454" stroke="#2f9d62" stroke-width="1"/>
    <rect x="46" y="58" width="88" height="70" fill="none" stroke="#ffb23e" stroke-width="1.6"/>
    <text x="52" y="74" class="d09-amber sm">数值</text>
    <text x="90" y="124" text-anchor="middle" class="d09-amber lg">0${c.value}</text>
    <text x="160" y="80" class="d09-green">CH-${c.no} // 事件</text>
    <text x="160" y="104" class="d09-green dim">${c.era.toUpperCase()} ${c.eraSpan}</text>
    <text x="160" y="126" class="d09-green dim">${c.place.toUpperCase()} 23°08'N 82°22'W</text>
    <rect x="46" y="628" width="408" height="24" fill="#6dffaa"/>
    <text x="54" y="646" class="d09-inverse">阵营：${c.side.toUpperCase()}</text>
    <text x="446" y="646" text-anchor="end" class="d09-inverse">${c.date.toUpperCase()}</text>
  </g>
</svg>
<div class="abs d09-text">
  <h3><span>&gt;</span> ${c.title.toUpperCase()}<i></i></h3>
  <p class="rules">${c.text}</p>
  <p class="note">! ${CardZh.highlight(c.note)}</p>
</div>
<div class="abs d09-rec">● 录制</div>
<div class="abs d09-crt"></div>`;
  }

  function back() {
    let ticks = '';
    for (let i = 0; i < 72; i++) {
      const a = A.rad(i * 5);
      const r0 = i % 6 ? 176 : 168;
      ticks += `M${A.f(250 + r0 * Math.cos(a))},${A.f(338 + r0 * Math.sin(a))}L${A.f(250 + 184 * Math.cos(a))},${A.f(338 + 184 * Math.sin(a))}`;
    }
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>${BEZEL('d09b')}</defs>
  ${shell('d09b')}
  <g class="d09-glow" fill="none" stroke="#6dffaa">
    <circle cx="250" cy="338" r="184" stroke-width="2"/><circle cx="250" cy="338" r="138" stroke-width="1" opacity=".7"/><circle cx="250" cy="338" r="92" stroke-width="1" opacity=".7"/><circle cx="250" cy="338" r="46" stroke-width="1" opacity=".7"/>
    <path d="M66,338H434M250,154V522M120,208L380,468M380,208L120,468" stroke-width="1" opacity=".45"/>
    <path d="${ticks}" stroke-width="1.2"/>
    <g opacity=".55">${A.globe(250, 338, 138, 1)}</g>
    <path d="${A.starD(250, 338, 12)}" fill="#6dffaa" stroke="none"/>
  </g>
  <g class="d09-glow">
    <text x="46" y="74" class="d09-green">追踪 // 全部区域</text>
    <text x="46" y="600" class="d09-green dim">范围 4000 公里</text><text x="454" y="600" text-anchor="end" class="d09-green dim">扫描 06 转/分</text>
    <rect x="46" y="628" width="408" height="24" fill="#6dffaa"/>
    <text x="250" y="646" text-anchor="middle" class="d09-inverse">1945 — 1989</text>
  </g>
</svg>
<div class="abs d09-sweep"></div>
<div class="abs d09-rec">● 实时</div>
<i class="abs d09-blip" style="left:63%;top:38%"></i><i class="abs d09-blip b" style="left:34%;top:55%"></i><i class="abs d09-blip c" style="left:58%;top:60%"></i>
<div class="abs d09-crt"></div>`;
  }

  window.CardDesigns = window.CardDesigns || [];
  window.CardDesigns.push({
    id: '09',
    name: 'Phosphor',
    concept: 'A situation-room monitor: green phosphor, amber readouts, scanlines and a live radar sweep.',
    notes: [
      ['Frame', 'A moulded bezel around curved glass; the art is a monochrome feed with targeting brackets.'],
      ['Value', 'An amber numeric readout, top left.'],
      ['Back', 'A radar scope with a turning sweep and blinking contacts.'],
      ['Type', 'VT323 terminal face throughout.'],
    ],
    front,
    back,
  });
})();
