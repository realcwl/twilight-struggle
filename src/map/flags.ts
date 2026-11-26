// A small flag for every node, shown on the board when there is no room for the name.
// These are drawn for a size of a dozen pixels: fields, bands and one plain shape where an emblem
// would be, in the form each flag had for most of the period. A node that stands for several states
// flies two of their flags, halved along the diagonal. No DOM here, only markup.

const W = 30;
const H = 20;
const n = (v: number): string => String(Math.round(v * 100) / 100);

type Band = string | [color: string, weight: number];

const rect = (x: number, y: number, w: number, h: number, fill: string): string =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"/>`;
const bg = (fill: string): string => rect(0, 0, W, H, fill);
const disc = (cx: number, cy: number, r: number, fill: string): string => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}"/>`;
const ring = (cx: number, cy: number, r: number, stroke: string, width: number): string =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="none" stroke="${stroke}" stroke-width="${n(width)}"/>`;
const poly = (points: string, fill: string): string => `<polygon points="${points}" fill="${fill}"/>`;
const stroke = (d: string, color: string, width: number, round = false): string =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${n(width)}"${round ? ' stroke-linecap="round"' : ''}/>`;

function bands(vertical: boolean, parts: Band[]): string {
  const total = parts.reduce((s, p) => s + (typeof p === 'string' ? 1 : p[1]), 0);
  let at = 0;
  let out = '';
  for (const p of parts) {
    const [color, weight] = typeof p === 'string' ? [p, 1] : p;
    const size = (weight / total) * (vertical ? W : H);
    // a hair of overlap, so no background shows between two bands
    out += vertical ? rect(at, 0, size + 0.05, H, color) : rect(0, at, W, size + 0.05, color);
    at += size;
  }
  return out;
}
/** Horizontal bands, top to bottom. */
const h = (...parts: Band[]): string => bands(false, parts);
/** Vertical bands, hoist to fly. */
const v = (...parts: Band[]): string => bands(true, parts);
const stripes = (count: number, a: string, b: string): string => h(...Array.from({ length: count }, (_, i) => (i % 2 ? b : a)));

function starPoints(cx: number, cy: number, r: number, points: number, inner: number): string {
  const out: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 ? r * inner : r;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    out.push(`${n(cx + Math.cos(a) * rr)},${n(cy + Math.sin(a) * rr)}`);
  }
  return out.join(' ');
}
const star = (cx: number, cy: number, r: number, fill: string, points = 5, inner = 0.4): string => poly(starPoints(cx, cy, r, points, inner), fill);
const sun = (cx: number, cy: number, r: number, fill: string): string => star(cx, cy, r, fill, 12, 0.62) + disc(cx, cy, r * 0.58, fill);

/** A crescent: a disc of radius `r` with a bite of radius `bite` taken out, `dx` towards the fly. */
function crescent(cx: number, cy: number, r: number, bite: number, dx: number, fill: string, turn = 0): string {
  const a = (r * r - bite * bite + dx * dx) / (2 * dx);
  const hh = Math.sqrt(Math.max(0, r * r - a * a));
  const d = `M${n(cx + a)},${n(cy - hh)} A${n(r)},${n(r)} 0 1 0 ${n(cx + a)},${n(cy + hh)} A${n(bite)},${n(bite)} 0 ${a < dx ? 0 : 1} 1 ${n(cx + a)},${n(cy - hh)} Z`;
  return `<path d="${d}" fill="${fill}"${turn ? ` transform="rotate(${turn} ${n(cx)} ${n(cy)})"` : ''}/>`;
}

/** A cross set towards the hoist, as on the Nordic flags. */
function nordic(field: string, cross: string, inner?: string, width = 5): string {
  let out = bg(field) + rect(10 - width / 2, 0, width, H, cross) + rect(0, 10 - width / 2, W, width, cross);
  if (inner) out += rect(10 - width / 4, 0, width / 2, H, inner) + rect(0, 10 - width / 4, W, width / 2, inner);
  return out;
}

/** A triangle on the hoist. */
const hoist = (depth: number, fill: string): string => poly(`0,0 ${n(depth)},10 0,20`, fill);

const UNION =
  bg('#012169') +
  stroke('M0,0 L30,20 M30,0 L0,20', '#fff', 4) +
  stroke('M0,0 L30,20 M30,0 L0,20', '#c8102e', 1.5) +
  stroke('M15,0 V20 M0,10 H30', '#fff', 6.4) +
  stroke('M15,0 V20 M0,10 H30', '#c8102e', 3.6);
/** The Union flag as the upper hoist quarter. */
const unionCanton = `<svg x="0" y="0" width="15" height="10" viewBox="0 0 30 20" preserveAspectRatio="none">${UNION}</svg>`;

const ARAB = h('#ce1126', '#fff', '#000'); // the red, white and black of the Arab republics

type Flag = string | [upperHoist: string, lowerFly: string];

const FLAGS: Record<string, Flag> = {
  // ---- North America, Europe
  can:
    v(['#d52b1e', 1], ['#fff', 2], ['#d52b1e', 1]) +
    poly('15,4.2 16.1,6.4 17.6,5.7 17.2,8.6 18.9,7.6 19.3,9 20.6,9.2 18.4,11.6 18.9,12.6 15.5,12.3 15.5,15.6 14.5,15.6 14.5,12.3 11.1,12.6 11.6,11.6 9.4,9.2 10.7,9 11.1,7.6 12.8,8.6 12.4,5.7 13.9,6.4', '#d52b1e'),
  usa:
    stripes(13, '#b22234', '#fff') +
    rect(0, 0, 12.6, 10.8, '#3c3b6e') +
    Array.from({ length: 20 }, (_, i) => disc(1.7 + (i % 5) * 2.3, 1.6 + Math.floor(i / 5) * 2.5, 0.55, '#fff')).join(''),
  gbr: UNION,
  nor: nordic('#ba0c2f', '#fff', '#00205b'),
  swe: nordic('#006aa7', '#fecc02', undefined, 4),
  fin: nordic('#fff', '#002f6c'),
  dnk: nordic('#c8102e', '#fff', undefined, 3.4),
  ben: [v('#000', '#fdda24', '#ef3340'), h('#ae1c28', '#fff', '#21468b')],
  frg: h('#000', '#dd0000', '#ffce00'),
  gdr: h('#000', '#dd0000', '#ffce00') + disc(15, 10, 3.5, '#dd0000') + ring(15, 10, 3.5, '#f0c020', 1.4) + rect(14.3, 8.3, 1.4, 3.4, '#f0c020'),
  pol: h('#fff', '#dc143c'),
  cze: h('#fff', '#d7141a') + hoist(15, '#11457e'),
  fra: v('#0055a4', '#fff', '#ef4135'),
  aut: h('#ed2939', '#fff', '#ed2939'),
  ita: v('#009246', '#fff', '#ce2b37'),
  esp: [v(['#006600', 2], ['#ff0000', 3]) + disc(12, 10, 3, '#ffcc00'), h(['#aa151b', 1], ['#f1bf00', 2], ['#aa151b', 1])],
  hun: h('#ce2939', '#fff', '#477050'),
  yug: h('#003893', '#fff', '#de0000') + star(15, 10, 5.4, '#fcd115') + star(15, 10, 4, '#de0000'),
  rou: v('#002b7f', '#fcd116', '#ce1126') + disc(15, 10, 2.8, '#a8782a') + disc(15, 10, 1.7, '#5b9bd5'),
  bgr: h('#fff', '#00966e', '#d62612') + disc(4.6, 3.4, 2, '#d62612') + ring(4.6, 3.4, 2, '#e0a526', 0.9),
  grc: stripes(9, '#0d5eaf', '#fff') + rect(0, 0, 11.11, 11.11, '#0d5eaf') + rect(4.44, 0, 2.22, 11.11, '#fff') + rect(0, 4.44, 11.11, 2.22, '#fff'),
  tur: bg('#e30a17') + crescent(11.5, 10, 5, 4, 1.4, '#fff') + star(17.6, 10, 2.5, '#fff'),
  ussr:
    bg('#cc0000') +
    star(6.2, 4, 1.9, '#ffd700') +
    star(6.2, 4, 1.05, '#cc0000') +
    stroke('M4.2,9.6 A3.2,3.2 0 1 0 8.8,11.6', '#ffd700', 1.2, true) +
    stroke('M3.8,12.8 L7.6,8.6', '#ffd700', 1) +
    stroke('M6.9,7.6 L8.9,9.5', '#ffd700', 1.8),

  // ---- Middle East
  lby: h(['#e70013', 1], ['#000', 2], ['#239e46', 1]) + crescent(13.8, 10, 2.9, 2.4, 0.9, '#fff') + star(17.4, 10, 1.5, '#fff'),
  egy: ARAB + poly('13.1,8 16.9,8 16.3,11.6 15,12.6 13.7,11.6', '#c09300'),
  isr: bg('#fff') + rect(0, 2.4, W, 2.7, '#0038b8') + rect(0, 14.9, W, 2.7, '#0038b8') + stroke('M15,6.4 L18.1,11.8 H11.9 Z M15,13.6 L11.9,8.2 H18.1 Z', '#0038b8', 0.9),
  lbn: h(['#ed1c24', 1], ['#fff', 2], ['#ed1c24', 1]) + poly('15,5.6 19.6,13 16.1,13 16.1,14.4 13.9,14.4 13.9,13 10.4,13', '#00a651'),
  syr: ARAB + star(10.5, 10, 2.1, '#007a3d') + star(19.5, 10, 2.1, '#007a3d'),
  irq: ARAB + star(8.6, 10, 1.9, '#007a3d') + star(15, 10, 1.9, '#007a3d') + star(21.4, 10, 1.9, '#007a3d'),
  irn: h('#239f40', '#fff', '#da0000') + disc(15, 9.4, 1.9, '#e0a526') + stroke('M12.4,11.6 H17.6', '#e0a526', 1.2, true),
  jor: h('#000', '#fff', '#007a3d') + hoist(14, '#ce1126') + star(4.8, 10, 1.8, '#fff', 7, 0.5),
  sau: bg('#006c35') + stroke('M7.6,8.6 q1.8,-2.8 3.7,0 t3.7,0 t3.7,0 t3.7,0', '#fff', 1.5, true) + stroke('M8.6,13.4 H21.6 M10,12.3 V14.5', '#fff', 1.1, true),
  gulf: [
    h('#007a3d', '#fff', '#ce1126') + poly('0,0 7.5,6.67 7.5,13.33 0,20', '#000'),
    rect(0, 0, 7.5, H, '#ff0000') + rect(7.5, 0, 22.5, 6.72, '#00732f') + rect(7.5, 6.67, 22.5, 6.72, '#fff') + rect(7.5, 13.33, 22.5, 6.67, '#000'),
  ],

  // ---- Asia
  afg: v('#000', '#d32011', '#007a36') + ring(15, 10, 3, '#fff', 1) + disc(15, 10, 1.1, '#fff'),
  pak: rect(0, 0, 7.5, H, '#fff') + rect(7.5, 0, 22.5, H, '#01411c') + crescent(18.4, 10.2, 4.5, 3.8, 1.4, '#fff', -35) + star(21, 7.9, 1.6, '#fff'),
  ind: h('#ff9933', '#fff', '#138808') + ring(15, 10, 2.5, '#000080', 0.9),
  mmr:
    bg('#de2110') +
    rect(0, 0, 13, 9.6, '#0033a0') +
    `<circle cx="6.5" cy="4.8" r="3.3" fill="none" stroke="#fff" stroke-width="1" stroke-dasharray="0.9 1.17"/>` +
    star(6.5, 4.8, 1.7, '#fff'),
  lao: [
    h(['#ce1126', 1], ['#002868', 2], ['#ce1126', 1]) + disc(15, 10, 3.4, '#fff'),
    h(['#032ea1', 1], ['#e00025', 2], ['#032ea1', 1]) + poly('10.6,12.8 10.6,10.6 12,10.6 12,8.6 13,7.4 14,8.6 14,7.6 15,6 16,7.6 16,8.6 17,7.4 18,8.6 18,10.6 19.4,10.6 19.4,12.8', '#fff'),
  ],
  tha: h(['#a51931', 1], ['#f4f5f8', 1], ['#2d2a4a', 2], ['#f4f5f8', 1], ['#a51931', 1]),
  vnm: bg('#da251d') + star(15, 10, 5.2, '#ffff00'),
  mys: stripes(14, '#cc0001', '#fff') + rect(0, 0, 15, 11.43, '#010066') + crescent(6.4, 5.7, 3.7, 3.1, 1.1, '#ffcc00') + star(9.9, 5.7, 2.2, '#ffcc00', 8, 0.5),
  idn: h('#e70011', '#fff'),
  phl: h('#0038a8', '#ce1126') + hoist(13, '#fff') + disc(4.4, 10, 1.8, '#fcd116'),
  twn: bg('#fe0000') + rect(0, 0, 15, 10, '#000095') + star(7.5, 5, 3.7, '#fff', 12, 0.62) + disc(7.5, 5, 2.2, '#000095') + disc(7.5, 5, 1.8, '#fff'),
  jpn: bg('#fff') + disc(15, 10, 6, '#bc002d'),
  kor:
    bg('#fff') +
    `<g transform="rotate(33.7 15 10)"><path d="M10.4,10 a4.6,4.6 0 0 1 9.2,0 z" fill="#cd2e3a"/><path d="M10.4,10 a4.6,4.6 0 0 0 9.2,0 z" fill="#0047a0"/></g>` +
    [[6.4, 4.6, -56], [23.6, 4.6, 56], [6.4, 15.4, 56], [23.6, 15.4, -56]]
      .map(([x, y, a]) => `<path d="M-2,-1.1 H2 M-2,0 H2 M-2,1.1 H2" stroke="#000" stroke-width="0.7" transform="translate(${x} ${y}) rotate(${a})"/>`)
      .join(''),
  prk: bg('#024fa2') + rect(0, 3.3, W, 13.4, '#fff') + rect(0, 4.1, W, 11.8, '#ed1c27') + disc(10, 10, 3.9, '#fff') + star(10, 10, 3.6, '#ed1c27'),
  aus:
    bg('#00008b') +
    unionCanton +
    star(7.5, 15, 2.7, '#fff', 7, 0.5) +
    [[22.5, 16.4, 1.5], [22.5, 3.9, 1.5], [18.7, 9.1, 1.5], [26.1, 7.7, 1.5], [24, 11.4, 0.9]].map(([x, y, r]) => star(x, y, r, '#fff', 7, 0.5)).join(''),

  // ---- Africa
  mar: bg('#c1272d') + `<polygon points="${starPoints(15, 10.3, 4.8, 5, 0.382)}" fill="none" stroke="#006233" stroke-width="1.1"/>`,
  dza: rect(0, 0, 15, H, '#006233') + rect(15, 0, 15, H, '#fff') + crescent(15.4, 10, 4.7, 3.8, 1.6, '#d21034') + star(17.6, 10, 2.1, '#d21034'),
  tun: bg('#e70013') + disc(15, 10, 5.4, '#fff') + crescent(14.6, 10, 3.7, 3, 1.2, '#e70013') + star(16.5, 10, 1.7, '#e70013'),
  saharan: [v('#14b53a', '#fcd116', '#ce1126'), h('#e05206', '#fff', '#0db02b') + disc(15, 10, 2.4, '#e05206')],
  westafrica: [h('#ce1126', '#fcd116', '#006b3f') + star(15, 10, 2.8, '#000'), v('#00853f', '#fdef42', '#e31b23') + star(15, 10, 2.6, '#00853f')],
  civ: v('#f77f00', '#fff', '#009e60'),
  nga: v('#008751', '#fff', '#008751'),
  cmr: v('#007a5e', '#ce1126', '#fcd116') + star(15, 10, 2.5, '#fcd116'),
  cod: bg('#009543') + disc(15, 10, 6, '#f7d618') + stroke('M12.3,13.8 L15.6,9.6', '#6b3e1f', 1.8, true) + poly('15,9.8 16.1,5.4 17.6,8.4 17,10.4', '#d21034'),
  ago: h('#cc092f', '#000') + stroke('M11.2,10.4 A4.3,4.3 0 0 0 18.8,12.2', '#ffcb00', 1.2) + stroke('M12,13.6 L18.4,8.8', '#ffcb00', 0.9) + star(14.1, 8.2, 1.7, '#ffcb00'),
  zaf: h('#e8772e', '#fff', '#00267f') + rect(11.4, 8.2, 2.4, 3.6, '#012169') + rect(13.8, 8.2, 2.4, 3.6, '#e8772e') + rect(16.2, 8.2, 2.4, 3.6, '#007749'),
  bwa: bg('#75aadb') + rect(0, 7.2, W, 5.6, '#fff') + rect(0, 8, W, 4, '#000'),
  zwe:
    h('#006400', '#ffd200', '#d40000', '#000', '#d40000', '#ffd200', '#006400') +
    poly('0,0 12.6,10 0,20', '#000') +
    poly('0,1.3 11,10 0,18.7', '#fff') +
    star(4, 10, 2.7, '#d40000') +
    disc(4, 10, 1.1, '#ffd200'),
  seafrica: [
    bg('#1eb53a') + poly('30,0 30,20 0,20', '#00a3dd') + stroke('M0,20 L30,0', '#fcd116', 7.6) + stroke('M0,20 L30,0', '#000', 5),
    h(['#007168', 6], ['#fff', 0.7], ['#000', 6], ['#fff', 0.7], ['#fce100', 6]) + hoist(11, '#d21034') + star(3.6, 10, 2, '#fce100'),
  ],
  ken:
    h(['#000', 6], ['#fff', 1], ['#bb0000', 6], ['#fff', 1], ['#006600', 6]) +
    stroke('M11,3.6 L19,16.4 M19,3.6 L11,16.4', '#fff', 0.6) +
    `<ellipse cx="15" cy="10" rx="2.5" ry="5.2" fill="#bb0000" stroke="#000" stroke-width="0.8"/>` +
    disc(15, 10, 0.9, '#fff'),
  som: bg('#4189dd') + star(15, 10, 4.4, '#fff'),
  eth: h('#078930', '#fcdd09', '#da121a'),
  sdn: ARAB + hoist(10, '#007229'),

  // ---- the Americas
  mex: v('#006847', '#fff', '#ce1126') + disc(15, 9.6, 2.2, '#8a5a2b') + stroke('M12.5,11.6 Q15,13.9 17.5,11.6', '#4a7c2a', 0.9),
  gtm: v('#4997d0', '#fff', '#4997d0') + ring(15, 10, 2.4, '#3f8f3f', 1) + disc(15, 10, 1, '#c9a84a'),
  slv: h('#0f47af', '#fff', '#0f47af') + ring(15, 10, 2.1, '#c8a13a', 0.8) + poly('15,8.8 16.4,11 13.6,11', '#3f8f3f'),
  hnd: h('#0073cf', '#fff', '#0073cf') + [[15, 10], [11.8, 8.7], [18.2, 8.7], [11.8, 11.3], [18.2, 11.3]].map(([x, y]) => star(x, y, 1.05, '#0073cf')).join(''),
  nic: h('#0067c6', '#fff', '#0067c6') + `<path d="M15,7.8 L17.5,11.7 H12.5 Z" fill="#9fd3f0" stroke="#c8a13a" stroke-width="0.7"/>`,
  cri: h(['#002b7f', 1], ['#fff', 1], ['#ce1126', 2], ['#fff', 1], ['#002b7f', 1]),
  pan: bg('#fff') + rect(15, 0, 15, 10, '#d21034') + rect(0, 10, 15, 10, '#005293') + star(7.5, 5, 2.7, '#005293') + star(22.5, 15, 2.7, '#d21034'),
  cub: h('#002a8f', '#fff', '#002a8f', '#fff', '#002a8f') + hoist(13, '#cf142b') + star(4.3, 10, 2.3, '#fff'),
  hti: h('#00209f', '#d21034') + rect(11.2, 6.6, 7.6, 6.8, '#fff') + disc(15, 9.5, 1.5, '#016a16') + rect(13.6, 11.1, 2.8, 1.1, '#f1b517'),
  dom:
    rect(0, 0, 15, 10, '#002d62') +
    rect(15, 0, 15, 10, '#ce1126') +
    rect(0, 10, 15, 10, '#ce1126') +
    rect(15, 10, 15, 10, '#002d62') +
    rect(12.6, 0, 4.8, H, '#fff') +
    rect(0, 7.6, W, 4.8, '#fff') +
    disc(15, 10, 1.3, '#3f8f3f'),
  col: h(['#fcd116', 2], ['#003893', 1], ['#ce1126', 1]),
  ven:
    h('#ffcc00', '#00247d', '#cf142b') +
    Array.from({ length: 7 }, (_, i) => {
      const a = ((-160 + (i * 140) / 6) * Math.PI) / 180;
      return disc(15 + Math.cos(a) * 4.6, 13 + Math.sin(a) * 4.6, 0.6, '#fff');
    }).join(''),
  ecu:
    h(['#ffdd00', 2], ['#034ea2', 1], ['#ed1c24', 1]) +
    `<ellipse cx="15" cy="10.2" rx="2.2" ry="2.9" fill="#6fb7e0" stroke="#7a5a2b" stroke-width="0.7"/>` +
    stroke('M12.2,6.8 Q15,5.2 17.8,6.8', '#3a2a1a', 0.9),
  per: v('#d91023', '#fff', '#d91023'),
  bol: h('#d52b1e', '#f9e300', '#007934'),
  pry: h('#d52b1e', '#fff', '#0038a8') + ring(15, 10, 2.1, '#2e7d32', 0.7) + star(15, 10, 1.2, '#f1b517'),
  chl: h('#fff', '#d52b1e') + rect(0, 0, 10, 10, '#0039a6') + star(5, 5, 2.7, '#fff'),
  arg: h('#74acdf', '#fff', '#74acdf') + sun(15, 10, 2.9, '#f6b40e'),
  ury: stripes(9, '#fff', '#0038a8') + rect(0, 0, 11.11, 11.11, '#fff') + sun(5.55, 5.55, 4.1, '#fcd116') + ring(5.55, 5.55, 2.4, '#b8860b', 0.35),
  bra: bg('#009c3b') + poly('15,2.4 27,10 15,17.6 3,10', '#ffdf00') + disc(15, 10, 4.5, '#002776') + stroke('M10.7,9 Q15,7.9 19.4,11.2', '#fff', 0.9),
};

const svg = (inner: string, half = ''): string => `<svg${half} viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${inner}</svg>`;

/** Markup for a node's flag: one drawing, or two halves laid over each other. Plain cloth for an unknown node. */
export function flagMarkup(id: string): string {
  const flag = FLAGS[id] ?? bg('#d9c9a3');
  return typeof flag === 'string' ? svg(flag) : svg(flag[0], ' class="upper"') + svg(flag[1], ' class="lower"');
}

/** Ids that have a flag drawn for them. */
export const flagIds = (): string[] => Object.keys(FLAGS);
