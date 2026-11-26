// Country identity prototype: ten treatments x six sample countries.
// Plain script, no dependencies. Open index.html directly, or through any static server.
(function () {
  'use strict';

  const circle = (cx, cy, r) => `M${cx - r},${cy} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 Z`;

  // ------------------------------------------------------------------ sample countries
  // Landmark art is a handful of flat shapes in a 100 x 100 box with the ground at y = 92.
  // t (tone): a = main body, b = behind, d = shaded side, c = cut-out, w = light accent,
  //           g = foliage, s = sun. `f` overrides the colour in the paper version only.
  const COUNTRIES = [
    {
      at: [44, 48], spot: [72, 68],
      id: 'jpn', name: 'Japan', stab: 5, inf: [3, 0],
      native: '日本', nativeFont: '"Hiragino Mincho ProN", "Yu Mincho", "Songti SC", serif', nativeWeight: 800,
      paper: { a: '#d0452f', b: '#6f86a8', w: '#f6f3ea', s: '#e8473a', d: '#a8321f', c: '#3a322c', g: '#4f8f4a' },
      stamp: { bg: '#f6e9df', ink: '#b3261e', second: '#e8a09a' },
      motes: 'petals', motesNote: 'cherry petals',
      landmark: [
        { t: 's', d: circle(74, 28, 13) },
        { t: 'b', d: 'M2,92 L34,46 Q38,42 42,45 L46,42 Q50,40 54,45 L60,42 L64,47 L98,92 Z' },
        { t: 'w', d: 'M34,46 Q38,42 42,45 L46,42 Q50,40 54,45 L60,42 L64,47 L58,55 L52,51 L47,56 L42,51 L38,55 Z' },
        { t: 'a', d: 'M10,54 Q50,62 90,54 L88,62 Q50,69 12,62 Z' },
        { t: 'a', d: 'M18,70 H82 V76 H18 Z' },
        { t: 'a', d: 'M26,62 L33,62 L32,92 L24,92 Z' },
        { t: 'a', d: 'M67,62 L74,62 L76,92 L68,92 Z' },
        { t: 'a', d: 'M47,63 H53 V70 H47 Z' },
      ],
      emblem: [0, 1, 2, 3, 4].map((k) => `<ellipse cx="20" cy="11.5" rx="4.6" ry="6.6" transform="rotate(${k * 72} 20 20)"/>`).join('') + '<circle cx="20" cy="20" r="2.4" fill="#f3d27a"/>',
      flag: '<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#bc002d"/>',
      pattern: '<pattern id="pat-jpn" width="24" height="12" patternUnits="userSpaceOnUse"><g fill="none" stroke="#fff8e0" stroke-width="1.2">' +
        [[12, 12], [0, 6], [24, 6]].map(([x, y]) => [11, 7.5, 4].map((r) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')).join('') + '</g></pattern>',
    },
    {
      at: [44, 38], spot: [64, 70],
      id: 'egy', name: 'Egypt', stab: 3, inf: [0, 2],
      native: 'مصر', nativeFont: '"Geeza Pro", "Al Bayan", "Damascus", serif', nativeWeight: 700,
      paper: { a: '#e6c680', b: '#cfaa68', d: '#b98f52', s: '#f2b23a', g: '#4f8f4a', w: '#f3e3b0', c: '#3a322c' },
      stamp: { bg: '#f4e6c0', ink: '#7a5524', second: '#e8b860' },
      motes: 'sand', motesNote: 'blown sand',
      landmark: [
        { t: 's', d: circle(72, 24, 10) },
        { t: 'b', d: 'M40,92 L66,50 L92,92 Z' },
        { t: 'a', d: 'M4,92 L36,34 L68,92 Z' },
        { t: 'd', d: 'M36,34 L68,92 L48,92 Z' },
        { t: 'g', d: 'M83,92 Q81,76 84.5,62 L86.5,62 Q84,76 86,92 Z' },
        { t: 'g', d: 'M85.5,62 Q74,54 66,60 Q77,58 85.5,64 Z' },
        { t: 'g', d: 'M85.5,62 Q96,54 100,62 Q93,59 85.5,64 Z' },
        { t: 'g', d: 'M85.5,62 Q80,48 72,48 Q80,52 84.5,63 Z' },
        { t: 'g', d: 'M85.5,62 Q90,48 97,49 Q91,53 86.5,63 Z' },
      ],
      emblem: '<path fill-rule="evenodd" d="M20,5 C12,5 11,16 20,19.5 C29,16 28,5 20,5 Z M20,8.6 C16,8.6 15.6,14.6 20,16.2 C24.4,14.6 24,8.6 20,8.6 Z"/><rect x="10" y="19.5" width="20" height="4.2" rx="1"/><path d="M17.6,23 H22.4 L23.4,36 H16.6 Z"/>',
      flag: '<rect width="30" height="6.7" fill="#ce1126"/><rect y="6.7" width="30" height="6.7" fill="#fff"/><rect y="13.4" width="30" height="6.6" fill="#111"/><circle cx="15" cy="10" r="2.1" fill="#c9a227"/>',
      pattern: '<pattern id="pat-egy" width="16" height="9" patternUnits="userSpaceOnUse"><polyline points="0,7 4,2 8,7 12,2 16,7" fill="none" stroke="#fff8e0" stroke-width="1.6" stroke-linejoin="round"/></pattern>',
    },
    {
      at: [36, 36], spot: [43, 64],
      id: 'fra', name: 'France', stab: 4, inf: [2, 1],
      native: 'France', nativeFont: 'Didot, "Bodoni 72", "Snell Roundhand", serif', nativeWeight: 700, nativeItalic: true,
      paper: { a: '#6a5a4e', b: '#6f9a55', d: '#3f3630', s: '#f1e6c0', w: '#d8cfc0', c: '#3a322c', g: '#4f8f4a' },
      stamp: { bg: '#e3e9f2', ink: '#27408b', second: '#9fb1d8' },
      motes: 'sparks', motesNote: 'fireworks',
      landmark: [
        { t: 'b', d: 'M4,92 Q8,80 15,84 Q21,75 28,86 L30,92 Z' },
        { t: 'b', d: 'M70,92 L72,86 Q79,75 85,84 Q92,80 96,92 Z' },
        { t: 'a', d: 'M50,4 L52.5,30 L56,52 L63,72 L76,92 L62,92 Q50,64 38,92 L24,92 L37,72 L44,52 L47.5,30 Z' },
        { t: 'd', d: 'M41,50 H59 V54 H41 Z' },
        { t: 'd', d: 'M33,70 H67 V75 H33 Z' },
      ],
      emblem: '<path d="M20,4 C25.5,11 25.5,19 20,25.5 C14.5,19 14.5,11 20,4 Z"/><path d="M16.5,25 C9,25.5 4.5,19 8,11.5 C10,17 14,18 17.5,21.5 Z"/><path d="M23.5,25 C31,25.5 35.5,19 32,11.5 C30,17 26,18 22.5,21.5 Z"/><rect x="11.5" y="25.2" width="17" height="3.2" rx="1"/><path d="M20,28.5 L24.5,36.5 H15.5 Z"/>',
      flag: '<rect width="10" height="20" fill="#0055a4"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ef4135"/>',
      pattern: '<pattern id="pat-fra" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M8,1 L15,8 L8,15 L1,8 Z" fill="none" stroke="#fff8e0" stroke-width="1"/><circle cx="8" cy="8" r="1.5" fill="#fff8e0"/></pattern>',
    },
    {
      at: [40, 52], spot: [73, 62],
      id: 'ussr', name: 'Soviet Union', stab: 5, inf: [0, 6],
      native: 'СССР', nativeFont: '"PT Serif", "Times New Roman", serif', nativeWeight: 800, nativeSpacing: '0.1em',
      paper: { a: '#f3eee2', b: '#b5483a', w: '#e8b93c', c: '#3a322c', d: '#d8cfc0', s: '#f1e6c0', g: '#4f8f4a' },
      stamp: { bg: '#f2dcd6', ink: '#a3231b', second: '#e0a49c' },
      motes: 'snow', motesNote: 'snowfall',
      landmark: [
        { t: 'b', d: 'M14,66 H86 V92 H14 Z' },
        { t: 'a', d: 'M22,54 H30 V66 H22 Z' },
        { t: 'a', d: 'M70,54 H78 V66 H70 Z' },
        { t: 'a', d: 'M41,42 H59 V92 H41 Z' },
        { t: 'w', f: '#3f7fc0', d: 'M26,34 C31,41 35,46 35,49 C35,52 30,54 26,54 C22,54 17,52 17,49 C17,46 21,41 26,34 Z' },
        { t: 'w', f: '#3f9a58', d: 'M74,34 C79,41 83,46 83,49 C83,52 78,54 74,54 C70,54 65,52 65,49 C65,46 69,41 74,34 Z' },
        { t: 'w', d: 'M50,12 C57,23 63,30 63,35 C63,40 56,42 50,42 C44,42 37,40 37,35 C37,30 43,23 50,12 Z' },
        { t: 'c', d: 'M46,80 Q50,73 54,80 V92 H46 Z' },
        { t: 'a', d: 'M49.3,3 H50.7 V13 H49.3 Z' },
        { t: 'a', d: 'M47,6 H53 V7.4 H47 Z' },
      ],
      emblem: `<polygon points="${Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 6 : 15; const a = -Math.PI / 2 + (i * Math.PI) / 5; return (20 + Math.cos(a) * r).toFixed(1) + ',' + (21 + Math.sin(a) * r).toFixed(1); }).join(' ')}"/>`,
      flag: `<rect width="30" height="20" fill="#cd0000"/><polygon fill="#ffd700" points="${Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 1.5 : 3.8; const a = -Math.PI / 2 + (i * Math.PI) / 5; return (7 + Math.cos(a) * r).toFixed(1) + ',' + (6.5 + Math.sin(a) * r).toFixed(1); }).join(' ')}"/>`,
      pattern: '<pattern id="pat-ussr" width="14" height="14" patternUnits="userSpaceOnUse"><g fill="#fff8e0">' +
        [[6, 1], [4, 3], [8, 3], [2, 5], [10, 5], [4, 7], [8, 7], [6, 9], [6, 5]].map(([x, y]) => `<rect x="${x}" y="${y}" width="2" height="2"/>`).join('') + '</g></pattern>',
    },
    {
      at: [44, 34], spot: [27, 70],
      id: 'bra', name: 'Brazil', stab: 3, inf: [1, 0],
      native: 'Brasil', nativeFont: 'Baskerville, "Hoefler Text", Georgia, serif', nativeWeight: 700, nativeItalic: true,
      paper: { a: '#4f8f4a', b: '#8a7f72', w: '#f6f3ea', s: '#f2c53a', d: '#3f7a3f', c: '#3a322c', g: '#4f8f4a' },
      stamp: { bg: '#e2efd9', ink: '#1f6b3a', second: '#e6cf6a' },
      motes: 'confetti', motesNote: 'carnival confetti',
      landmark: [
        { t: 's', d: circle(80, 24, 9) },
        { t: 'b', d: 'M54,92 Q60,56 73,52 Q88,57 96,92 Z' },
        { t: 'a', d: 'M0,92 Q10,74 22,64 Q32,54 40,52 L52,52 Q60,58 66,72 L74,92 Z' },
        { t: 'w', d: 'M43.5,30 H48.5 L49.5,52 H42.5 Z' },
        { t: 'w', d: 'M30,31 H62 V34.5 H30 Z' },
        { t: 'w', d: circle(46, 26.5, 3) },
      ],
      emblem: '<circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" stroke-width="2.2"/>' +
        [[20, 10.5, 3], [20, 30, 3], [11.5, 19, 2.6], [28.5, 17.5, 2.6], [24.5, 23.5, 1.7]].map(([x, y, s]) => `<path d="M${x},${y - s} L${x + s * 0.55},${y} L${x},${y + s} L${x - s * 0.55},${y} Z M${x - s},${y} L${x},${y - s * 0.55} L${x + s},${y} L${x},${y + s * 0.55} Z"/>`).join(''),
      flag: '<rect width="30" height="20" fill="#009c3b"/><path d="M15,2.4 L27,10 L15,17.6 L3,10 Z" fill="#ffdf00"/><circle cx="15" cy="10" r="4.5" fill="#002776"/>',
      pattern: '<pattern id="pat-bra" width="28" height="14" patternUnits="userSpaceOnUse"><path d="M0,3 Q7,-2 14,3 T28,3 V8 Q21,13 14,8 T0,8 Z" fill="#fff8e0"/></pattern>',
    },
    {
      at: [46, 62], spot: [61, 34],
      id: 'ind', name: 'India', stab: 4, inf: [1, 1],
      native: 'भारत', nativeFont: '"Kohinoor Devanagari", "Devanagari Sangam MN", serif', nativeWeight: 700,
      paper: { a: '#f6f3ea', b: '#d8cfc0', c: '#9a8a72', s: '#f2a03a', w: '#ffffff', d: '#d8cfc0', g: '#4f8f4a' },
      stamp: { bg: '#f6ead8', ink: '#b25a12', second: '#9cc59f' },
      motes: 'holi', motesNote: 'festival colours',
      landmark: [
        { t: 's', d: circle(24, 22, 8) },
        { t: 'b', d: 'M8,82 H92 V92 H8 Z' },
        { t: 'a', d: 'M12,40 H17 V82 H12 Z' },
        { t: 'a', d: 'M11,40 A3.5,3.5 0 0,1 18,40 Z' },
        { t: 'a', d: 'M83,40 H88 V82 H83 Z' },
        { t: 'a', d: 'M82,40 A3.5,3.5 0 0,1 89,40 Z' },
        { t: 'a', d: 'M30,56 H70 V82 H30 Z' },
        { t: 'a', d: 'M30,56 A5,5 0 0,1 40,56 Z' },
        { t: 'a', d: 'M60,56 A5,5 0 0,1 70,56 Z' },
        { t: 'a', d: 'M50,24 C58,31 63,38 63,46 L63,50 Q63,56 58,56 H42 Q37,56 37,50 L37,46 C37,38 42,31 50,24 Z' },
        { t: 'a', d: 'M49.3,16 H50.7 V25 H49.3 Z' },
        { t: 'c', d: 'M44,82 V68 Q50,60 56,68 V82 Z' },
      ],
      emblem: '<circle cx="20" cy="20" r="13.5" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="20" cy="20" r="2.6"/>' +
        Array.from({ length: 12 }, (_, i) => `<rect x="19.3" y="7.5" width="1.4" height="10.5" transform="rotate(${i * 30} 20 20)"/>`).join(''),
      flag: '<rect width="30" height="6.7" fill="#ff9933"/><rect y="6.7" width="30" height="6.7" fill="#fff"/><rect y="13.4" width="30" height="6.6" fill="#138808"/><circle cx="15" cy="10" r="2.5" fill="none" stroke="#000080" stroke-width="0.9"/>',
      pattern: '<pattern id="pat-ind" width="18" height="18" patternUnits="userSpaceOnUse"><g fill="none" stroke="#fff8e0" stroke-width="0.9">' +
        Array.from({ length: 8 }, (_, i) => `<ellipse cx="9" cy="4.6" rx="1.7" ry="3.6" transform="rotate(${i * 45} 9 9)"/>`).join('') + '</g><circle cx="9" cy="9" r="1.6" fill="#fff8e0"/><circle cx="0" cy="0" r="1.2" fill="#fff8e0"/><circle cx="18" cy="0" r="1.2" fill="#fff8e0"/><circle cx="0" cy="18" r="1.2" fill="#fff8e0"/><circle cx="18" cy="18" r="1.2" fill="#fff8e0"/></pattern>',
    },
  ];

  // shared definitions: the engraver's hatch and one traditional pattern per country
  const defs = document.createElement('div');
  defs.innerHTML =
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
    '<pattern id="hatch" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><line x1="0" y1="0" x2="0" y2="3.2" stroke="#4a3220" stroke-width="0.7"/></pattern>' +
    COUNTRIES.map((c) => c.pattern).join('') +
    '</defs></svg>';
  document.body.appendChild(defs);

  // ------------------------------------------------------------------ drawing helpers
  function landmark(c, mode, o) {
    let inner = '';
    if (mode === 'solid') {
      for (const s of c.landmark) {
        if (s.t === 's') continue;
        inner += `<path d="${s.d}" fill="${s.t === 'c' ? o.cut : o.color}"${s.t === 'b' ? ' opacity=".7"' : ''}/>`;
      }
    } else if (mode === 'paper') {
      // a white cut-paper edge behind everything, then the coloured layers
      inner += '<g fill="#fffdf6" stroke="#fffdf6" stroke-width="5" stroke-linejoin="round">' + c.landmark.filter((s) => s.t !== 's').map((s) => `<path d="${s.d}"/>`).join('') + '</g>';
      for (const s of c.landmark) if (s.t !== 's') inner += `<path d="${s.d}" fill="${s.f || c.paper[s.t]}"/>`;
    } else if (mode === 'ink') {
      for (const s of c.landmark) {
        if (s.t === 's') continue;
        inner += `<path d="${s.d}" pathLength="400" fill="${s.t === 'c' || s.t === 'w' ? 'none' : 'url(#hatch)'}" stroke="#4a3220" stroke-width="1.5" stroke-linejoin="round"/>`;
      }
      inner += '<path d="M-6,93 H106" pathLength="400" fill="none" stroke="#4a3220" stroke-width="1.2" stroke-dasharray="3 2.4"/>';
    } else {
      // two-colour print, as on a stamp
      for (const s of c.landmark) {
        const fill = s.t === 's' || s.t === 'w' ? c.stamp.second : s.t === 'c' ? c.stamp.bg : c.stamp.ink;
        inner += `<path d="${s.d}" fill="${fill}"${s.t === 'b' ? ' opacity=".45"' : ''}/>`;
      }
    }
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  }

  let uid = 0;
  function stamp(c) {
    const id = 'perf' + uid++;
    let holes = '';
    for (let x = 5; x <= 115; x += 10) holes += `<circle cx="${x}" cy="0" r="3.3"/><circle cx="${x}" cy="150" r="3.3"/>`;
    for (let y = 5; y <= 145; y += 10) holes += `<circle cx="0" cy="${y}" r="3.3"/><circle cx="120" cy="${y}" r="3.3"/>`;
    const style = `font-family:${c.nativeFont.replace(/"/g, "'")};font-weight:${c.nativeWeight}`;
    return (
      '<svg viewBox="-6 -6 132 162" xmlns="http://www.w3.org/2000/svg">' +
      `<mask id="${id}"><rect width="120" height="150" fill="#fff"/><g fill="#000">${holes}</g></mask>` +
      `<rect width="120" height="150" fill="#f6efdc" mask="url(#${id})"/>` +
      `<rect x="9" y="9" width="102" height="132" fill="${c.stamp.bg}"/>` +
      `<rect x="11.5" y="11.5" width="97" height="127" fill="none" stroke="${c.stamp.ink}" stroke-width="1"/>` +
      `<text x="60" y="31" text-anchor="middle" font-size="17" fill="${c.stamp.ink}" style="${style}">${c.native}</text>` +
      `<svg x="19" y="35" width="82" height="82" viewBox="0 0 100 100">${landmark(c, 'stamp').replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>` +
      `<text x="17" y="134" font-size="17" font-weight="800" fill="${c.stamp.ink}" font-family="Didot, Georgia, serif">5</text>` +
      `<text x="103" y="132" text-anchor="end" font-size="8" letter-spacing="1.5" fill="${c.stamp.ink}" font-family="Didot, Georgia, serif">1947</text>` +
      '<g class="postmark" fill="none" stroke="#2a2019" stroke-width="2"><circle cx="20" cy="120" r="24"/><circle cx="20" cy="120" r="17"/>' +
      '<path d="M38,100 q6,-4 12,0 t12,0 t12,0 t12,0 M40,110 q6,-4 12,0 t12,0 t12,0 t12,0"/></g>' +
      '</svg>'
    );
  }

  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  /** The node as it looks in the game: name, stability badge, two influence cells. */
  function plate(c, extraClass) {
    const p = el('div', 'plate' + (extraClass ? ' ' + extraClass : ''));
    p.style.left = c.at[0] + '%';
    p.style.top = c.at[1] + '%';
    p.appendChild(el('div', 'plate-name', c.name));
    const body = el('div', 'plate-body');
    body.append(el('span', 'stab', String(c.stab)), el('span', 'inf a' + (c.inf[0] ? ' on' : ''), String(c.inf[0])), el('span', 'inf b' + (c.inf[1] ? ' on' : ''), String(c.inf[1])));
    p.appendChild(body);
    return p;
  }
  function nativeName(c) {
    const n = el('div', 'native', c.native);
    n.style.fontFamily = c.nativeFont;
    n.style.fontWeight = c.nativeWeight;
    if (c.nativeItalic) n.style.fontStyle = 'italic';
    if (c.nativeSpacing) n.style.letterSpacing = c.nativeSpacing;
    if (c.id === 'egy') n.setAttribute('dir', 'rtl');
    return n;
  }
  function pennant(c) {
    return el('div', 'pennant', `<svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg">${c.flag}</svg>`);
  }
  /** Puts a piece of artwork on the country's own land, clear of its node. */
  function onLand(node, c) {
    node.style.left = c.spot[0] + '%';
    node.style.top = c.spot[1] + '%';
    return node;
  }
  function inkVignette(c) {
    return onLand(el('div', 'ink', landmark(c, 'ink')), c);
  }

  // ------------------------------------------------------------------ drifting particles (treatment 9)
  const MOTES = {
    petals: { n: 28, colors: ['#ffd1dc', '#ffb7c9', '#fff0f3'] },
    sand: { n: 90, colors: ['#f4dfa8', '#e3c27e', '#fff1c8'] },
    sparks: { n: 0, colors: ['#6f9dff', '#ffffff', '#ff6b6b'] },
    snow: { n: 70, colors: ['#ffffff', '#e9f1f8'] },
    confetti: { n: 46, colors: ['#19a54a', '#ffd400', '#2f6fe0', '#ff5a7a', '#ffffff'] },
    holi: { n: 14, colors: ['#ff5fa2', '#ffb300', '#35c2ff', '#7bd34f', '#b36bff'] },
  };
  function runMotes(canvas, kind) {
    const spec = MOTES[kind];
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const pick = () => spec.colors[(Math.random() * spec.colors.length) | 0];
    const parts = Array.from({ length: spec.n }, () => ({ x: rnd(0, w), y: rnd(0, h), s: rnd(0.6, 1.4), r: rnd(0, 6.28), p: rnd(0, 6.28), c: pick(), age: rnd(0, 1) }));
    let puffs = [];
    let sinceBurst = 9;
    let last = performance.now();
    let raf = 0;
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (kind === 'sparks' || kind === 'holi') {
        // bursts: fireworks fall and fade, colour puffs swell and fade
        sinceBurst += dt;
        if (sinceBurst > (kind === 'sparks' ? 0.55 : 0.4)) {
          sinceBurst = 0;
          const bx = rnd(w * 0.15, w * 0.85);
          const by = kind === 'sparks' ? rnd(h * 0.12, h * 0.5) : rnd(h * 0.3, h * 0.85);
          const c = pick();
          if (kind === 'sparks') for (let i = 0; i < 20; i++) puffs.push({ x: bx, y: by, vx: Math.cos(i * 0.314) * rnd(28, 46), vy: Math.sin(i * 0.314) * rnd(28, 46), life: 1, c });
          else puffs.push({ x: bx, y: by, vx: 0, vy: -6, life: 1, c });
        }
        for (const p of puffs) {
          p.life -= dt * (kind === 'sparks' ? 1.1 : 0.7);
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (kind === 'sparks') {
            p.vy += 34 * dt;
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.c;
            ctx.fillRect(p.x - 1, p.y - 1, 2.2, 2.2);
          } else {
            const r = 6 + (1 - p.life) * 30;
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
            g.addColorStop(0, p.c);
            g.addColorStop(1, 'transparent');
            ctx.globalAlpha = Math.max(0, p.life) * 0.75;
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, 6.3);
            ctx.fill();
          }
        }
        puffs = puffs.filter((p) => p.life > 0);
      }
      for (const p of parts) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = p.c;
        if (kind === 'sand') {
          p.x += (70 + 60 * p.s) * dt;
          p.y += Math.sin(t * 2 + p.p) * 6 * dt;
          ctx.globalAlpha = 0.55;
          ctx.fillRect(p.x, p.y, 5 * p.s, 1.1);
        } else if (kind === 'snow') {
          p.y += (16 + 16 * p.s) * dt;
          p.x += Math.sin(t * 1.3 + p.p) * 9 * dt;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.1 * p.s, 0, 6.3);
          ctx.fill();
        } else {
          // petals, confetti and holi petals tumble as they fall
          p.y += (kind === 'confetti' ? 34 : 20) * p.s * dt;
          p.x += (10 + Math.sin(t * 1.6 + p.p) * 16) * dt;
          p.r += dt * (kind === 'confetti' ? 5 : 1.6);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.r);
          if (kind === 'confetti') ctx.fillRect(-2.6, -1.2 * Math.abs(Math.cos(p.r * 1.7)), 5.2, 2.4 * Math.abs(Math.cos(p.r * 1.7)) + 0.4);
          else {
            ctx.beginPath();
            ctx.ellipse(0, 0, (kind === 'holi' ? 2.6 : 3.4) * p.s, 1.9 * p.s, 0, 0, 6.3);
            if (kind === 'holi') ctx.fillStyle = '#ffa826';
            ctx.fill();
          }
          ctx.restore();
        }
        if (p.y > h + 6) { p.y = -6; p.x = rnd(0, w); }
        if (p.x > w + 8) p.x = -8;
        if (p.x < -8) p.x = w + 8;
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }

  // ------------------------------------------------------------------ the ten treatments
  const OPTIONS = [
    {
      name: 'Low-poly miniature',
      desc: 'A small 3D model standing in the country. This is the version that was just removed from the game.',
      chips: [['Zoomed in only', ''], ['Cost: high', 'bad'], ['Clashes with the painted map', 'bad']],
      render(cell, c) {
        const img = el('img', 'lowpoly');
        img.src = `assets/lowpoly-${c.id}.png`;
        img.alt = '';
        cell.append(onLand(img, c), plate(c));
      },
    },
    {
      name: 'Paper stand-up',
      desc: 'A flat illustrated cut-out that folds up out of the map like a pop-up book. It lies nearly flat until its country is in focus.',
      chips: [['Zoomed in only', ''], ['Cost: medium', 'warn'], ['Suits the tabletop feel', 'good']],
      render(cell, c) {
        cell.append(onLand(el('div', 'standee', landmark(c, 'paper')), c), plate(c));
      },
    },
    {
      name: 'Landmark silhouette on the node',
      desc: 'A one-colour landmark icon built into the node itself, so identity never drifts away from the numbers.',
      chips: [['Always visible', 'good'], ['Cost: low', 'good'], ['Widens every node', 'warn']],
      render(cell, c) {
        const p = plate(c, 'has-glyph');
        p.querySelector('.plate-body').prepend(el('span', 'glyph', landmark(c, 'solid', { color: '#f1dca0', cut: '#2b2119' })));
        cell.append(p);
      },
    },
    {
      name: 'Antique-atlas ink vignette',
      desc: 'A pen-and-ink drawing laid flat on the land, like the illustrations on old charts. It redraws itself when its country is in focus.',
      chips: [['Zoomed in only', ''], ['Cost: medium', 'warn'], ['Matches the parchment areas', 'good']],
      render(cell, c) {
        cell.append(inkVignette(c), plate(c));
      },
    },
    {
      name: 'Emblem medallion',
      desc: 'A struck-coin emblem (a flower, a wheel, a star) fixed to the node. It turns over once on focus.',
      chips: [['Always visible', 'good'], ['Cost: low', 'good'], ['Symbol choices need care', 'warn']],
      render(cell, c) {
        const p = plate(c, 'has-medal');
        p.querySelector('.plate-body').prepend(el('span', 'medal', `<svg viewBox="0 0 40 40" fill="#4a2f12" color="#4a2f12" xmlns="http://www.w3.org/2000/svg">${c.emblem}</svg>`));
        cell.append(p);
      },
    },
    {
      name: 'Flag pennant',
      desc: 'A small flag flying from the node. The quickest thing of all to recognise; it flutters on focus.',
      chips: [['Always visible', 'good'], ['Cost: very low', 'good'], ['Period flags differ from today’s', 'warn']],
      render(cell, c) {
        const p = plate(c, 'has-pennant');
        p.querySelector('.plate-body').append(pennant(c));
        cell.append(p);
      },
    },
    {
      name: 'Name in its own script',
      desc: 'The country’s name in its own writing system, set in a typeface with local character, above the plain name.',
      chips: [['Zoomed in only', ''], ['Cost: low', 'good'], ['Needs a font for each script', 'warn']],
      render(cell, c) {
        const p = plate(c);
        p.prepend(nativeName(c));
        cell.append(p);
      },
    },
    {
      name: 'Pattern woven into the land',
      desc: 'A traditional textile, tile or paving pattern pressed faintly into the country’s territory.',
      chips: [['Zoomed in only', ''], ['Cost: low', 'good'], ['Competes with control colours', 'bad']],
      render(cell, c) {
        const weave = el('div', 'weave', `<svg xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="url(#pat-${c.id})"/></svg>`);
        // the pattern fades out around the country rather than stopping at a hard edge
        weave.style.maskImage = weave.style.webkitMaskImage = `radial-gradient(ellipse 52% 60% at ${c.at[0]}% ${c.at[1]}%, #000 50%, transparent 100%)`;
        cell.append(weave, plate(c));
      },
    },
    {
      name: 'Ambient motion',
      desc: 'Something drifts across the country while it is in focus: petals, blown sand, fireworks, snow, confetti.',
      chips: [['On focus only', ''], ['Cost: low', 'good'], ['Says nothing at rest', 'warn']],
      render(cell, c) {
        const canvas = el('canvas', 'motes');
        cell.append(canvas, el('div', 'idle-note', c.motesNote + ' on focus'), plate(c));
        cell.motes = { canvas, kind: c.motes };
      },
    },
    {
      name: 'Postage stamp in the info card',
      desc: 'Each country gets a period stamp, shown in its information card rather than on the map, and postmarked when the card is pinned.',
      chips: [['In the card only', ''], ['Cost: medium', 'warn'], ['No clutter on the map', 'good']],
      render(cell, c) {
        cell.append(el('div', 'stamp', stamp(c)), plate(c));
      },
    },
  ];

  // ------------------------------------------------------------------ build the sheet
  const sheet = document.getElementById('sheet');
  const cells = [];
  function makeCell(c, render) {
    const cell = el('div', 'cell');
    const bg = el('img', 'cell-bg');
    bg.src = `assets/terrain-${c.id}.jpg`;
    bg.alt = '';
    cell.appendChild(bg);
    render(cell, c);
    cells.push(cell);
    return cell;
  }
  sheet.appendChild(el('div', 'colhead', ''));
  for (const c of COUNTRIES) sheet.appendChild(el('div', 'colhead', c.name));
  OPTIONS.forEach((o, i) => {
    const head = el('div', 'rowhead');
    head.append(el('div', 'num', String(i + 1).padStart(2, '0')), el('h2', '', o.name), el('p', '', o.desc));
    const chips = el('div', 'chips');
    for (const [text, tone] of o.chips) chips.appendChild(el('span', 'chip' + (tone ? ' ' + tone : ''), text));
    head.appendChild(chips);
    sheet.appendChild(head);
    for (const c of COUNTRIES) sheet.appendChild(makeCell(c, o.render));
    sheet.appendChild(el('div', 'rule'));
  });

  // a combination, as a suggestion
  const section = el('div', 'section');
  section.append(
    el('h2', '', 'A combination worth trying'),
    el('p', '', 'Three layers that do not get in each other’s way: a flag pennant on the node for instant recognition at any zoom (6), the name in its own script and an ink vignette on the land once zoomed in (7 and 4), and the stamp in the information card (10). Nothing is added to the node’s width, and nothing uses the side colours.'),
  );
  sheet.appendChild(section);
  sheet.appendChild(el('div', 'rowhead', '<div class="num">6 + 7 + 4 + 10</div><h2>Pennant, script, ink, stamp</h2><p>Hover to see the in-focus state: the pennant flutters, the vignette redraws, the stamp is shown as it would be in the card.</p>'));
  for (const c of COUNTRIES) {
    sheet.appendChild(
      makeCell(c, (cell, cc) => {
        const p = plate(cc, 'has-pennant');
        p.prepend(nativeName(cc));
        p.querySelector('.plate-body').append(pennant(cc));
        cell.append(inkVignette(cc), el('div', 'stamp', stamp(cc)), p);
      }),
    );
  }

  // ------------------------------------------------------------------ focus state
  function setHot(cell, hot) {
    if (cell.classList.contains('hot') === hot) return;
    cell.classList.toggle('hot', hot);
    if (cell.motes) {
      if (hot) cell.motes.stop = runMotes(cell.motes.canvas, cell.motes.kind);
      else if (cell.motes.stop) cell.motes.stop();
    }
  }
  const force = document.getElementById('force');
  for (const cell of cells) {
    cell.addEventListener('mouseenter', () => setHot(cell, true));
    cell.addEventListener('mouseleave', () => setHot(cell, force.checked));
  }
  force.addEventListener('change', () => cells.forEach((cell) => setHot(cell, force.checked)));
  if (new URLSearchParams(location.search).get('focus') === '1') {
    force.checked = true;
    cells.forEach((cell) => setHot(cell, true));
  }
  window.prototypeReady = true;
})();
