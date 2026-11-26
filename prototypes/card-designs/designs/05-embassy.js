// 05 Embassy: midnight blue and gold line work, an Art Deco invitation to a state reception.
(function () {
  const A = window.CardArt;
  const WIN = 'M62,366V150H88V120H118V92H382V120H412V150H438V366Z';
  const OUT = 'M54,374V142H80V112H110V84H390V112H420V142H446V374Z';

  function fan(cx, cy, R, n, a0, a1, r0 = 0) {
    let d = '';
    for (let i = 0; i <= n; i++) {
      const a = A.rad(a0 + ((a1 - a0) * i) / n);
      const rr = i % 2 ? R * 0.82 : R;
      d += `M${A.f(cx + r0 * Math.cos(a))},${A.f(cy + r0 * Math.sin(a))}L${A.f(cx + rr * Math.cos(a))},${A.f(cy + rr * Math.sin(a))}`;
    }
    return d;
  }
  // stepped corner ornament, drawn for the top-left and mirrored by coordinates
  function corner(sx, sy) {
    const X = (v) => (sx > 0 ? v : 500 - v);
    const Y = (v) => (sy > 0 ? v : 700 - v);
    return `M${X(12)},${Y(44)}H${X(24)}V${Y(34)}H${X(34)}V${Y(24)}H${X(44)}V${Y(12)}M${X(12)},${Y(54)}H${X(18)}M${X(54)},${Y(12)}V${Y(18)}`;
  }
  const corners = corner(1, 1) + corner(-1, 1) + corner(1, -1) + corner(-1, -1);
  const rule = (y, w = 150) =>
    `<path d="M${250 - w},${y}H${250 - 16}M${250 + 16},${y}H${250 + w}" stroke="url(#g-gold-h)" stroke-width="1.4"/><path d="M250,${y - 6}L256,${y}L250,${y + 6}L244,${y}Z" fill="url(#g-gold)"/>` +
    `<path d="M${250 - w + 30},${y - 5}H${250 - 26}M${250 + 26},${y - 5}H${250 + w - 30}M${250 - w + 30},${y + 5}H${250 - 26}M${250 + 26},${y + 5}H${250 + w - 30}" stroke="#d9b65a" stroke-opacity=".5" stroke-width=".8"/>`;

  function front(c) {
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs><clipPath id="d05-win"><path d="${WIN}"/></clipPath>
    <linearGradient id="d05-panel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#162a57"/><stop offset="1" stop-color="#0c1836"/></linearGradient>
  </defs>
  <g stroke="#d9b65a" stroke-opacity=".34" stroke-width=".9" fill="none"><path d="${fan(250, 232, 330, 44, 180, 360, 0)}"/></g>
  <path d="${OUT}" fill="#0a1430"/>
  <g clip-path="url(#d05-win)"><svg x="62" y="92" width="376" height="274">${A.scene('20 136 560 408')}</svg></g>
  <path d="${WIN}" fill="#000" filter="url(#f-inset)" opacity=".8"/>
  <path d="${WIN}" fill="none" stroke="url(#g-gold-d)" stroke-width="3.2"/>
  <path d="${OUT}" fill="none" stroke="url(#g-gold-d)" stroke-width="1.4"/>
  <path d="M46,382V134H72V104H102V76H398V104H428V134H454V382" fill="none" stroke="#d9b65a" stroke-opacity=".55" stroke-width=".9"/>

  <rect x="12" y="12" width="476" height="676" rx="14" fill="none" stroke="url(#g-gold-d)" stroke-width="2.6"/>
  <rect x="19.500" y="19.500" width="461" height="661" rx="9" fill="none" stroke="#d9b65a" stroke-opacity=".6" stroke-width=".9"/>
  <path d="${corners}" fill="none" stroke="url(#g-gold-d)" stroke-width="1.6" transform="translate(14 14) scale(.944 .96)"/>

  <text x="250" y="426" text-anchor="middle" class="d05-title" fill="url(#g-gold)">${c.title.toUpperCase()}</text>
  ${rule(446)}

  <path d="M58,466H442V474H450V634H442V642H58V634H50V474H58Z" fill="url(#d05-panel)" stroke="url(#g-gold-d)" stroke-width="1.6"/>
  <path d="M64,472H436V480H444V628H436V636H64V628H56V480H64Z" fill="none" stroke="#d9b65a" stroke-opacity=".45" stroke-width=".8"/>

  <text x="432" y="52" text-anchor="end" class="d05-label">${c.era.toUpperCase()}</text>
  <text x="432" y="68" text-anchor="end" class="d05-label thin">${c.eraSpan}</text>
  <text x="70" y="667" class="d05-label">№ ${c.no}</text>
  <text x="430" y="667" text-anchor="end" class="d05-label">1959</text>
  <g fill="url(#g-gold)"><path d="${A.starD(250, 662, 8)}"/><path d="M222,663H236M264,663H278" stroke="url(#g-gold-h)" stroke-width="1.2"/></g>

  <!-- value: a gold lozenge -->
  <g filter="url(#f-drop)">
    <path d="M66,16L116,66L66,116L16,66Z" fill="url(#g-gold-d)" filter="url(#f-bevel-s)"/>
    <path d="M66,28L104,66L66,104L28,66Z" fill="#0c1836"/>
    <path d="M66,33L99,66L66,99L33,66Z" fill="none" stroke="#d9b65a" stroke-width=".9"/>
    <text x="66" y="82" text-anchor="middle" class="d05-value" fill="url(#g-gold)">${c.value}</text>
  </g>
</svg>
<div class="abs d05-text"><p class="rules">${c.text}</p><p class="note">${CardZh.highlight(c.note)}</p></div>`;
  }

  function back() {
    let rays = fan(250, 350, 330, 96, 0, 360, 118);
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>
    <clipPath id="d05b-in"><rect x="30" y="30" width="440" height="640" rx="6"/></clipPath>
    <radialGradient id="d05b-disc" cx=".5" cy=".42" r=".7"><stop offset="0" stop-color="#1d3a78"/><stop offset="1" stop-color="#0a1430"/></radialGradient>
  </defs>
  <g clip-path="url(#d05b-in)" stroke="#d9b65a" stroke-opacity=".55" stroke-width="1" fill="none"><path d="${rays}"/></g>
  <rect x="12" y="12" width="476" height="676" rx="14" fill="none" stroke="url(#g-gold-d)" stroke-width="2.6"/>
  <rect x="19.500" y="19.500" width="461" height="661" rx="9" fill="none" stroke="#d9b65a" stroke-opacity=".6" stroke-width=".9"/>
  <rect x="30" y="30" width="440" height="640" rx="6" fill="none" stroke="url(#g-gold-d)" stroke-width="1.6"/>
  <path d="${corners}" fill="none" stroke="url(#g-gold-d)" stroke-width="1.8" transform="translate(26 26) scale(.896 .926)"/>

  <g filter="url(#f-drop)">
    <circle cx="250" cy="350" r="118" fill="url(#g-gold-d)" filter="url(#f-bevel-s)"/>
    <circle cx="250" cy="350" r="110" fill="url(#d05b-disc)"/>
  </g>
  <circle cx="250" cy="350" r="102" fill="none" stroke="#d9b65a" stroke-width=".9"/>
  <circle cx="250" cy="350" r="96" fill="none" stroke="#d9b65a" stroke-opacity=".6" stroke-width=".9" stroke-dasharray="1.500 4"/>
  <g stroke="url(#g-gold)">${A.globe(250, 350, 66, 2.2)}</g>
  <g fill="url(#g-gold)"><path d="${A.starD(250, 266, 9)}"/><path d="${A.starD(250, 434, 9)}"/></g>

  <path d="M150,96H350L362,112L350,128H150L138,112Z" fill="#0a1430" stroke="url(#g-gold-d)" stroke-width="1.6"/>
  <text x="250" y="119" text-anchor="middle" class="d05-banner" fill="url(#g-gold)">1945</text>
  <path d="M132,572H368L380,588L368,604H132L120,588Z" fill="#0a1430" stroke="url(#g-gold-d)" stroke-width="1.6"/>
  <text x="250" y="595" text-anchor="middle" class="d05-banner" fill="url(#g-gold)">1989</text>
  <path d="M250,150V214M250,486V550" stroke="url(#g-gold)" stroke-width="1.4"/>
  <g fill="url(#g-gold)"><path d="M250,176L257,186L250,196L243,186Z"/><path d="M250,504L257,514L250,524L243,514Z"/></g>
</svg>`;
  }

  window.CardDesigns = window.CardDesigns || [];
  window.CardDesigns.push({
    id: '05',
    name: 'Embassy',
    concept: 'Midnight blue and gold line work: an Art Deco invitation to a state reception.',
    notes: [
      ['Frame', 'Stepped ziggurat window, hairline double borders, a fan of rays behind the art.'],
      ['Value', 'A gold lozenge cut into the top-left corner.'],
      ['Back', 'A full sunburst around a gilt globe, with stepped corners.'],
      ['Type', 'Limelight for the title, Josefin Sans for everything else.'],
    ],
    front,
    back,
  });
})();
