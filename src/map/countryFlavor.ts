// Per-country flavour: a pen-and-ink vignette that lies on the land, and something that drifts across
// the country while it is in focus. Decoration only: none of this is game data, and a country without
// an entry here simply has neither.
//
// A vignette is a handful of shapes in a 100 x 100 box, ground at y = 92, drawn in order so later
// shapes cover earlier ones. Tones:
//   a  body: outline, medium hatching        b  distance: thin outline, light hatching
//   d  shadow side: outline, cross-hatching  w  light: outline, bare paper
//   c  opening (door, window): solid ink     s  sun or cloud: thin outline, bare paper
//   l  line only                             t  thin line only

export type Tone = 'a' | 'b' | 'd' | 'w' | 'c' | 's' | 'l' | 't';
export type Shape = [tone: Tone, d: string];

export type MoteKind =
  | 'petals' | 'leaves' | 'feathers' | 'snow' | 'rain' | 'sand' | 'dust' | 'seeds' | 'confetti'
  | 'sparks' | 'holi' | 'fireflies' | 'lanterns' | 'embers' | 'mist' | 'butterflies' | 'glints';

export type Flavor = {
  art: Shape[];
  /** What the drawing stands on: a dashed ground line (default), open water, or nothing. */
  ground?: 'land' | 'sea' | 'none';
  motes: { kind: MoteKind; colors: string[] };
};

// ------------------------------------------------------------------ path helpers

/** Template tag that rounds every number to one decimal, to keep path strings short. */
function P(strings: TemplateStringsArray, ...values: number[]): string {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < values.length) out += String(Math.round(values[i] * 10) / 10);
  });
  return out;
}
const circle = (cx: number, cy: number, r: number): string => P`M${cx - r},${cy} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 Z`;
const ellipse = (cx: number, cy: number, rx: number, ry: number): string =>
  P`M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${2 * rx},0 a${rx},${ry} 0 1,0 ${-2 * rx},0 Z`;
const rect = (x: number, y: number, w: number, h: number): string => P`M${x},${y} h${w} v${h} h${-w} Z`;
/** A round-topped opening; x is its left edge, y its foot. */
const arch = (x: number, y: number, w: number, h: number): string => P`M${x},${y} v${-h} q${w / 2},${-w * 0.75} ${w},0 v${h} Z`;
/** Several openings in one path. */
const arches = (xs: number[], y: number, w: number, h: number): string => xs.map((x) => arch(x, y, w, h)).join(' ');
const rects = (xs: number[], y: number, w: number, h: number): string => xs.map((x) => rect(x, y, w, h)).join(' ');
/** Vertical strokes at the given x positions. */
const bars = (xs: number[], y0: number, y1: number): string => xs.map((x) => P`M${x},${y0} V${y1}`).join(' ');
/** Horizontal strokes at the given y positions. */
const rules = (ys: number[], x0: number, x1: number): string => ys.map((y) => P`M${x0},${y} H${x1}`).join(' ');
const range = (from: number, to: number, step: number): number[] => {
  const out: number[] = [];
  for (let v = from; step > 0 ? v <= to + 1e-6 : v >= to - 1e-6; v += step) out.push(v);
  return out;
};

// ------------------------------------------------------------------ shared motifs

function sun(cx: number, cy: number, r: number): Shape[] {
  let rays = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + 0.2;
    rays += P`M${cx + Math.cos(a) * (r + 2.4)},${cy + Math.sin(a) * (r + 2.4)} L${cx + Math.cos(a) * (r + 6)},${cy + Math.sin(a) * (r + 6)} `;
  }
  return [['s', circle(cx, cy, r)], ['t', rays.trim()]];
}

function fronds(x: number, y: number, s: number): Shape[] {
  const leaf = (c1x: number, c1y: number, ex: number, ey: number, c2x: number, c2y: number, bx: number, by: number): Shape => [
    'a',
    P`M${x},${y} Q${x + c1x * s},${y + c1y * s} ${x + ex * s},${y + ey * s} Q${x + c2x * s},${y + c2y * s} ${x + bx * s},${y + by * s} Z`,
  ];
  return [
    leaf(-11.5, -8, -19.5, -2, -8.5, -4, 0, 2),
    leaf(10.5, -8, 14.5, 0, 7.5, -3, 0, 2),
    leaf(-5.5, -14, -13.5, -14, -5.5, -10, -1, 1),
    leaf(4.5, -14, 11.5, -13, 5.5, -9, 1, 1),
    leaf(-2, -12, 1, -19, 3, -10, 1, 0),
  ];
}

function palm(x: number, top: number, base: number, s = 1): Shape[] {
  const mid = (top + base) / 2;
  return [
    ['a', P`M${x - 1.8 * s},${base} Q${x - 3.5 * s},${mid} ${x - s},${top} L${x + s},${top} Q${x - 1.2 * s},${mid} ${x + 1.8 * s},${base} Z`],
    ...fronds(x, top, s),
  ];
}

function pine(x: number, base: number, h: number, w: number): Shape[] {
  const tier = (top: number, bottom: number, half: number): Shape => [
    'a',
    P`M${x},${base - h * top} L${x + half * w},${base - h * bottom} L${x - half * w},${base - h * bottom} Z`,
  ];
  return [['d', rect(x - w * 0.06, base - h * 0.14, w * 0.12, h * 0.14)], tier(0.58, 0.12, 0.5), tier(0.8, 0.38, 0.38), tier(1, 0.62, 0.26)];
}

function roundTree(x: number, base: number, h: number, r: number): Shape[] {
  const cy = base - h + r;
  return [
    ['d', P`M${x - r * 0.16},${base} L${x - r * 0.1},${cy} H${x + r * 0.1} L${x + r * 0.16},${base} Z`],
    [
      'a',
      P`M${x - r},${cy + r * 0.3} Q${x - r * 1.3},${cy - r * 0.5} ${x - r * 0.5},${cy - r * 0.8} Q${x},${cy - r * 1.5} ${x + r * 0.5},${cy - r * 0.8} Q${x + r * 1.3},${cy - r * 0.5} ${x + r},${cy + r * 0.3} Q${x},${cy + r * 0.9} ${x - r},${cy + r * 0.3} Z`,
    ],
  ];
}

function acacia(x: number, base: number, h: number, w: number): Shape[] {
  const top = base - h;
  return [
    ['l', P`M${x},${base} Q${x - 1},${base - h * 0.5} ${x - w * 0.4},${top + 4} M${x - 0.4},${base - h * 0.45} Q${x + 1},${base - h * 0.7} ${x + w * 0.45},${top + 4}`],
    ['a', P`M${x - w},${top + 3} Q${x - w * 0.5},${top - 4} ${x},${top - 3} Q${x + w * 0.5},${top - 4} ${x + w},${top + 3} Q${x},${top + 7} ${x - w},${top + 3} Z`],
  ];
}

function waves(y: number, x0: number, x1: number): Shape[] {
  let d = P`M${x0},${y}`;
  for (let x = x0; x < x1 - 4; x += 8) d += ' q2,-2 4,0 q2,2 4,0';
  return [['t', d]];
}
const birds = (x: number, y: number): Shape[] => [['t', P`M${x},${y} q2.5,-3 5,0 q2.5,-3 5,0 M${x + 9},${y + 6} q2,-2.4 4,0 q2,-2.4 4,0`]];
const cloud = (x: number, y: number, s = 1): Shape[] => [
  ['s', P`M${x},${y} q${-1 * s},${-5 * s} ${5 * s},${-5 * s} q${3 * s},${-5 * s} ${9 * s},${-2 * s} q${6 * s},${-1 * s} ${6 * s},${4 * s} q${4 * s},${1 * s} ${3 * s},${4 * s} Z`],
];
const smoke = (x: number, y: number): Shape[] => [['t', P`M${x},${y} q-4,-4 0,-8 q4,-4 0,-8 q-3,-3 1,-7`]];
const grass = (xs: number[]): Shape[] => [['t', xs.map((x) => P`M${x},92 l-1.5,-4 M${x},92 l0.5,-5 M${x},92 l2,-3.5`).join(' ')]];

/** A battlemented top edge from x0 to x1 standing on y; with `base`, the whole wall down to that line. */
function crenels(x0: number, x1: number, y: number, teeth: number, h = 3, base?: number): string {
  const w = (x1 - x0) / (2 * teeth - 1);
  let d = P`M${x0},${y}`;
  for (let i = 0; i < teeth; i++) d += P` v${-h} h${w} v${h}` + (i < teeth - 1 ? P` h${w}` : '');
  return d + (base === undefined ? ' Z' : P` V${base} H${x0} Z`);
}

function minaret(x: number, top: number, base: number): Shape[] {
  return [
    ['a', rect(x - 1.6, top + 10, 3.2, base - top - 10)],
    ['a', rect(x - 2.8, top + 22, 5.6, 2)],
    ['d', P`M${x - 2},${top + 10} L${x},${top} L${x + 2},${top + 10} Z`],
  ];
}

function hut(x: number, base: number, w: number, wallH: number, roofH: number): Shape[] {
  return [
    ['w', rect(x - w / 2, base - wallH, w, wallH)],
    ['a', P`M${x - w / 2 - 3},${base - wallH + 2} L${x},${base - wallH - roofH} L${x + w / 2 + 3},${base - wallH + 2} Z`],
    ['c', arch(x - w * 0.14, base, w * 0.28, wallH * 0.5)],
  ];
}

// ------------------------------------------------------------------ the countries

const SNOW = ['#ffffff', '#e6f0f8'];
// every palette of pale grains carries a darker tone too, or it would vanish over sunlit desert
const SAND = ['#fff3cf', '#e0b871', '#a97c3c'];

export const FLAVOR: Record<string, Flavor> = {
  // ---------------------------------------------------------------- Europe
  can: {
    art: [
      ['b', 'M0,84 L26,40 L40,60 L58,30 L98,84 Z'],
      ['w', 'M26,40 L32,50 L27,48 L23,53 L20.5,49.5 Z'],
      ['w', 'M58,30 L66,42.5 L60,40 L56,46 L51.5,41 Z'],
      ...pine(13, 86, 40, 22),
      ...pine(89, 86, 34, 18),
      ...pine(75, 86, 22, 12),
      ['t', 'M0,86 H100'],
      ['a', 'M28,89 Q50,96 72,89 Q70,93 62,94.5 Q50,96.5 38,94.5 Q30,93 28,89 Z'],
      ...waves(99, 8, 92),
    ],
    ground: 'sea',
    motes: { kind: 'leaves', colors: ['#d8432b', '#e8792c', '#f0b23a'] },
  },
  gbr: {
    art: [
      ['b', rect(8, 74, 32, 18)],
      ['b', 'M13,74 L15,65 L17,74 Z M29,74 L31,65 L33,74 Z'],
      ['a', rect(54, 66, 40, 26)],
      ['a', 'M58,66 L60,56 L62,66 Z M72,66 L74,56 L76,66 Z M86,66 L88,54 L90,66 Z'],
      ['c', rects([58, 65, 72, 79, 86], 74, 3, 9)],
      ['a', rect(40, 30, 14, 62)],
      ['t', bars([43.5, 47, 50.5], 50, 90)],
      ['w', circle(47, 40, 5.2)],
      ['t', 'M47,40 V36.4 M47,40 L49.8,41.6'],
      ['d', 'M39,30 H55 L52,24 H42 Z'],
      ['a', 'M42,24 L47,6 L52,24 Z'],
      ['t', 'M47,6 V2'],
    ],
    motes: { kind: 'rain', colors: ['#eef6fc', '#9db9d0', '#587a98'] },
  },
  nor: {
    art: [
      ['l', 'M50,74 V16'],
      ['t', 'M50,18 L14,66 M50,18 L86,66'],
      ['w', 'M26,24 Q50,30 74,24 L72,58 Q50,64 28,58 Z'],
      ['a', 'M36,26.6 L45,27.8 L45.4,61.4 L37,60 Z'],
      ['a', 'M55,27.8 L64,26.6 L63,60 L54.6,61.4 Z'],
      ['l', 'M24,23 H76'],
      ['a', 'M6,52 Q11,58 14,70 Q50,82 86,70 Q89,58 94,52 Q95,66 88,78 Q50,90 12,78 Q5,66 6,52 Z'],
      ['a', 'M6,52 Q1,47 5,42 Q9,44 8,49 Z'],
      ['a', 'M94,52 Q99,47 95,42 Q91,44 92,49 Z'],
      ['w', [26, 36, 46, 56, 66, 76].map((x, i) => circle(x, [75.5, 78, 79.2, 79.2, 78, 75.5][i], 3)).join(' ')],
      ...waves(93, 4, 96),
      ...waves(98, 10, 90),
    ],
    ground: 'sea',
    motes: { kind: 'snow', colors: SNOW },
  },
  swe: {
    art: [
      ...roundTree(16, 92, 40, 11),
      ['a', rect(66, 74, 26, 18)],
      ['d', 'M63,75 L79,61 L95,75 Z'],
      ['c', rect(76.5, 81, 5, 11)],
      ['w', rects([69, 85.5], 79, 4.5, 4.5)],
      ['a', rect(44.5, 14, 3, 78)],
      ['a', rect(26, 28, 40, 3)],
      ['t', 'M46,14 L30,28 M46,14 L62,28'],
      ['l', circle(31, 38.5, 5.5)],
      ['l', circle(61, 38.5, 5.5)],
      ['t', 'M31,31 V33 M61,31 V33'],
      ['a', circle(46, 11, 3.6)],
      ['t', 'M44.5,22 l3,3 l-3,3 l3,3 l-3,3 l3,3 l-3,3 l3,3 l-3,3 l3,3 l-3,3 l3,3 l-3,3 l3,3 l-3,3 l3,3 l-3,3 l3,3 l-3,3 l3,3'],
      ...grass([8, 34, 56]),
    ],
    motes: { kind: 'petals', colors: ['#ffe36b', '#8fbaff', '#ffffff'] },
  },
  fin: {
    art: [
      ...pine(13, 92, 46, 22),
      ...pine(28, 92, 32, 16),
      ...pine(88, 92, 42, 20),
      ['a', rect(42, 72, 30, 20)],
      ['t', 'M42,77 H53 M62,77 H72 M42,82 H53 M62,82 H72 M42,87 H53 M62,87 H72'],
      ['a', rect(63, 58, 4, 9)],
      ['d', 'M39,73 L57,59 L75,73 Z'],
      ['c', rect(54, 78, 7, 14)],
      ['w', rect(45, 77, 4.5, 4.5)],
      ...smoke(65, 56),
      ['s', circle(76, 22, 6)],
    ],
    motes: { kind: 'snow', colors: ['#ffffff', '#eef4fb', '#dfeaf5'] },
  },
  dnk: {
    art: [
      ['b', 'M0,92 Q28,72 58,84 Q80,78 100,88 V92 Z'],
      ['w', 'M79,70 V52 L90,70 Z'],
      ['a', 'M74,71 H93 L90,76 H77 Z'],
      ['a', 'M38,86 L42,36 H54 L58,86 Z'],
      ['d', 'M41,50 H55 L56,63 H40 Z'],
      ['c', 'M46,86 V78 Q48,75 50,78 V86 Z'],
      ['c', rects([47], 42, 2.2, 3.4)],
      ['c', rects([47], 68, 2.2, 3.4)],
      ['a', rect(39, 32, 18, 4)],
      ['w', rect(43, 23, 10, 9)],
      ['t', 'M46.3,23 V32 M49.7,23 V32'],
      ['d', 'M41.5,23 L48,15 L54.5,23 Z'],
      ['t', 'M57,26 L70,21 M57,28.5 L71,29 M39,26 L26,21 M39,28.5 L25,29'],
      ...birds(14, 40),
      ...grass([12, 24, 66]),
    ],
    motes: { kind: 'glints', colors: ['#ffffff', '#d9efff'] },
  },
  ben: {
    art: [
      ['a', 'M36,92 L42,50 H58 L64,92 Z'],
      ['a', 'M33,70 H67 V73 H33 Z'],
      ['t', 'M36,73 L39,80 M64,73 L61,80'],
      ['c', 'M47,92 V82 Q50,78 53,82 V92 Z'],
      ['c', rect(48.5, 57, 3, 4.5)],
      ['d', 'M40,50 Q50,37 60,50 Z'],
      ['l', 'M50,45 L22,17 M50,45 L78,17 M50,45 L22,73 M50,45 L78,73'],
      ['w', 'M56,39 L78,17 L82.5,21.5 L60.5,43.5 Z'],
      ['w', 'M56,51 L78,73 L73.5,77.5 L51.5,55.5 Z'],
      ['w', 'M44,51 L22,73 L17.5,68.5 L39.5,46.5 Z'],
      ['w', 'M44,39 L22,17 L26.5,12.5 L48.5,34.5 Z'],
      ['t', 'M62,33 l4.5,4.5 M68,27 l4.5,4.5 M74,21 l4.5,4.5 M62,57 l-4.5,4.5 M68,63 l-4.5,4.5 M74,69 l-4.5,4.5 M38,57 l-4.5,-4.5 M32,63 l-4.5,-4.5 M26,69 l-4.5,-4.5 M38,33 l4.5,-4.5 M32,27 l4.5,-4.5 M26,21 l4.5,-4.5'],
      ['c', circle(50, 45, 1.6)],
      ['t', bars([8, 15, 22, 78, 85, 92], 84, 92)],
      ['a', [8, 15, 22, 78, 85, 92].map((x) => P`M${x - 2.4},${79} Q${x - 2.6},${84.5} ${x},${84.5} Q${x + 2.6},${84.5} ${x + 2.4},${79} L${x + 1.1},${81.5} L${x},${78.5} L${x - 1.1},${81.5} Z`).join(' ')],
    ],
    motes: { kind: 'petals', colors: ['#ff5a4f', '#ffc531', '#ff8fb0'] },
  },
  frg: {
    art: [
      ['b', 'M70,92 V66 L86,72 V92 Z'],
      ['b', 'M30,92 V66 L14,72 V92 Z'],
      ['a', rect(30, 58, 40, 34)],
      ['a', 'M44,58 L50,46 L56,58 Z'],
      ['a', rect(30, 40, 14, 52)],
      ['a', rect(56, 40, 14, 52)],
      ['d', 'M30,40 L37,8 L44,40 Z'],
      ['d', 'M56,40 L63,8 L70,40 Z'],
      ['t', 'M37,8 V3 M35.4,5.2 H38.6 M63,8 V3 M61.4,5.2 H64.6'],
      ['w', circle(50, 66, 3.8)],
      ['t', 'M50,62.2 V69.8 M46.2,66 H53.8'],
      ['c', 'M46.5,92 V82 Q50,75 53.5,82 V92 Z'],
      ['c', 'M34.5,92 V84 Q37,79 39.5,84 V92 Z M60.5,92 V84 Q63,79 65.5,84 V92 Z'],
      ['c', 'M35.5,62 V51 Q37,47 38.5,51 V62 Z M61.5,62 V51 Q63,47 64.5,51 V62 Z'],
      ['t', 'M30,70 H44 M56,70 H70'],
    ],
    motes: { kind: 'leaves', colors: ['#c9a23a', '#9fae4c', '#d98236'] },
  },
  gdr: {
    art: [
      ['a', rect(9, 88, 62, 4)],
      ['w', rects([13, 23, 33, 43, 53, 63], 62, 4.4, 26)],
      ['t', bars([15.2, 25.2, 35.2, 45.2, 55.2, 65.2], 63, 87)],
      ['a', rect(9, 54, 62, 8)],
      ['a', rect(20, 47, 40, 7)],
      ['d', 'M33,47 L35,40 H45 L47,47 Z'],
      ['t', 'M37,40 V35 M40,40 V33 M43,40 V35 M35,36 H45'],
      ['a', 'M81.5,92 L84.2,36 H86.8 L89.5,92 Z'],
      ['d', circle(85.5, 30, 6.6)],
      ['t', 'M79,30 H92'],
      ['l', 'M85.5,23.4 V4'],
      ['t', 'M84,18 H87 M84,13 H87 M84,8 H87'],
    ],
    motes: { kind: 'mist', colors: ['#e2ddd4', '#a9a39a'] },
  },
  pol: {
    art: [
      ['a', 'M44,92 V60 L50,50 L56,60 V92 Z'],
      ['c', 'M48,80 V69 Q50,64 52,69 V80 Z'],
      ['c', 'M47.5,92 V86 Q50,83 52.5,86 V92 Z'],
      ['a', rect(28, 36, 16, 56)],
      ['a', 'M27,36 L29,27 L31,36 Z M41,36 L43,27 L45,36 Z'],
      ['d', 'M29.5,36 L36,6 L42.5,36 Z'],
      ['t', 'M31.6,26 H40.4 M36,6 V2'],
      ['a', rect(56, 46, 16, 46)],
      ['d', 'M55,46 Q64,30 73,46 Z'],
      ['a', rect(62, 28, 4, 7)],
      ['d', 'M61,28 Q64,22 67,28 Z'],
      ['t', 'M64,23 V18'],
      ['c', 'M34.5,60 V51 Q36,47.5 37.5,51 V60 Z M62.5,66 V57 Q64,53.5 65.5,57 V66 Z'],
      ['c', 'M34.5,80 V72 Q36,68.5 37.5,72 V80 Z M62.5,84 V76 Q64,72.5 65.5,76 V84 Z'],
      ...birds(74, 18),
      ...grass([14, 84]),
    ],
    motes: { kind: 'seeds', colors: ['#f3d98a', '#fff3c4'] },
  },
  cze: {
    art: [
      ['b', 'M48,70 V56 H58 V48 L62,40 L66,48 V56 H80 V46 L83,37 L86,46 V56 H96 V70 Z'],
      ['a', rect(0, 76, 100, 16)],
      ['w', 'M6,92 V86 Q16,74 26,86 V92 Z M37,92 V86 Q47,74 57,86 V92 Z M68,92 V86 Q78,74 88,86 V92 Z'],
      ['a', rect(0, 70, 100, 6)],
      ['t', 'M48,70 V63 M62,70 V63 M76,70 V63 M90,70 V63 M46.6,64.6 H49.4 M60.6,64.6 H63.4 M74.6,64.6 H77.4 M88.6,64.6 H91.4'],
      ['a', rect(14, 36, 18, 34)],
      ['a', 'M12,36 L14,26 L16,36 Z M30,36 L32,26 L34,36 Z'],
      ['d', 'M14.5,36 L23,10 L31.5,36 Z'],
      ['t', 'M23,10 V5'],
      ['c', 'M19,70 V58 Q23,52 27,58 V70 Z'],
      ['c', rect(21.5, 42, 3, 5)],
      ...waves(97, 2, 98),
    ],
    ground: 'sea',
    motes: { kind: 'leaves', colors: ['#d9a441', '#c9622e', '#e8c35a'] },
  },
  fra: {
    art: [
      ['b', 'M4,92 Q8,80 15,84 Q21,75 28,86 L30,92 Z'],
      ['b', 'M70,92 L72,86 Q79,75 85,84 Q92,80 96,92 Z'],
      ['a', 'M50,4 L52.5,30 L56,52 L63,72 L76,92 L62,92 Q50,64 38,92 L24,92 L37,72 L44,52 L47.5,30 Z'],
      ['d', 'M41,50 H59 V54 H41 Z'],
      ['d', 'M33,70 H67 V75 H33 Z'],
      ['t', 'M50,4 V0'],
    ],
    motes: { kind: 'sparks', colors: ['#6f9dff', '#ffffff', '#ff6b6b'] },
  },
  aut: {
    art: [
      ['b', 'M0,92 L22,40 L36,58 L54,26 L74,60 L84,48 L100,76 V92 Z'],
      ['w', 'M54,26 L62,39.5 L56,37 L52,43 L47,37.5 Z'],
      ['w', 'M22,40 L28,50 L23,48 L18.5,52 L17,48.5 Z'],
      ...pine(15, 92, 30, 16),
      ...pine(87, 92, 26, 14),
      ['a', rect(38, 76, 26, 16)],
      ['d', 'M36,77 L51,65 L66,77 Z'],
      ['c', 'M48.5,92 V85 Q51,82 53.5,85 V92 Z'],
      ['w', rect(41.5, 80, 3.5, 4.5)],
      ['a', rect(62, 56, 9, 36)],
      ['c', rect(65, 66, 3, 5)],
      ['d', 'M61,56 Q61,51 64,49 Q60,44 66.5,38 Q73,44 69,49 Q72,51 72,56 Z'],
      ['t', 'M66.5,38 V31 M64.8,33.6 H68.2'],
    ],
    motes: { kind: 'snow', colors: SNOW },
  },
  ita: {
    art: [
      ['a', 'M8,92 V44 Q30,36 56,38 V51 Q76,53 92,59 V92 Z'],
      ['t', 'M8,56 Q30,49 56,51 M8,68 Q30,62 56,63 Q76,64.5 92,70 M8,80 Q30,75 56,76 Q76,77.5 92,82'],
      ['c', arches([11, 20, 29, 38, 47], 67, 5, 6)],
      ['c', arches([11, 20, 29, 38, 47, 59, 68, 77, 85], 79.5, 5, 6)],
      ['c', arches([11, 20, 29, 38, 47, 59, 68, 77, 85], 92, 5, 7)],
      ['c', rects([13, 22, 31, 40, 49], 44.5, 2.4, 3)],
      ['t', 'M56,38 V51'],
      ...birds(70, 30),
    ],
    motes: { kind: 'confetti', colors: ['#3fae5a', '#ffffff', '#e2463f', '#ffd35a'] },
  },
  esp: {
    art: [
      ['l', 'M40,70 V16 M62,70 V24 M24,66 L9,56'],
      ['w', 'M28,26 Q40,30 52,26 L53,54 Q40,60 27,54 Z'],
      ['d', 'M38.6,32 h2.8 v7 h7 v2.8 h-7 v10 h-2.8 v-10 h-7 v-2.8 h7 Z'],
      ['w', 'M57,60 L74,28 L78,58 Z'],
      ['a', 'M40,16 l9,2.4 l-9,3 Z M62,24 l8,2.2 l-8,2.8 Z'],
      ['t', 'M9,56 L28,26 M52,26 L62,24'],
      ['a', 'M14,66 L20,80 Q50,88 80,80 L90,58 L78,63 L76,70 H28 L26,62 Z'],
      ['t', 'M21,75 Q50,82 81,75 M78,63 V70'],
      ['c', rects([82, 85.5], 66, 2, 2.6)],
      ...waves(92, 4, 96),
      ...waves(97, 10, 90),
    ],
    ground: 'sea',
    motes: { kind: 'petals', colors: ['#e63b3b', '#ffffff', '#ffb347'] },
  },
  hun: {
    art: [
      ['a', rect(6, 70, 88, 22)],
      ['c', arches([10, 18, 26, 70.5, 78.5, 86.5], 88, 3.5, 9)],
      ['a', 'M27,70 L30,57 L33,70 Z M67,70 L70,57 L73,70 Z'],
      ['a', rect(14, 52, 6, 18)],
      ['d', 'M13,52 L17,32 L21,52 Z'],
      ['a', rect(80, 52, 6, 18)],
      ['d', 'M79,52 L83,32 L87,52 Z'],
      ['a', rect(36, 54, 28, 38)],
      ['c', arches([40, 48, 56], 88, 4, 12)],
      ['d', 'M38,54 Q38,30 50,24 Q62,30 62,54 Z'],
      ['t', 'M44,54 Q44,34 50,26 M56,54 Q56,34 50,26 M50,54 V26'],
      ['l', 'M50,24 V6'],
      ['t', 'M48.4,10 H51.6'],
      ...waves(97, 4, 96),
    ],
    motes: { kind: 'leaves', colors: ['#c0392b', '#e0a030', '#8fae3c'] },
  },
  yug: {
    art: [
      ['a', rect(6, 36, 14, 22)],
      ['d', 'M4,36 L13,25 L22,36 Z'],
      ['c', rect(11.5, 43, 3, 5)],
      ['a', rect(80, 40, 14, 18)],
      ['d', 'M78,40 L87,29 L96,40 Z'],
      ['c', rect(85.5, 46, 3, 5)],
      ['a', 'M0,92 V56 H22 V92 Z'],
      ['a', 'M78,92 V56 H100 V92 Z'],
      ['a', 'M16,56 L50,37 L84,56 V64 H78 Q50,16 22,64 H16 Z'],
      ['t', 'M20,56.5 L50,40 L80,56.5'],
      ['t', 'M4,66 H18 M2,76 H20 M4,86 H18 M82,66 H96 M80,76 H98 M82,86 H96'],
      ...waves(88, 26, 76),
      ...waves(94, 24, 78),
    ],
    ground: 'none',
    motes: { kind: 'petals', colors: ['#ffffff', '#ffe3ee'] },
  },
  rou: {
    art: [
      ['s', circle(20, 20, 7)],
      ['b', 'M4,92 L24,64 L40,58 H66 L82,70 L96,92 Z'],
      ...pine(15, 92, 22, 12),
      ...pine(88, 92, 20, 11),
      ['a', rect(32, 44, 9, 16)],
      ['d', 'M30.5,44 L36.5,30 L42.5,44 Z'],
      ['a', rect(40, 36, 22, 24)],
      ['d', 'M38,36 L51,20 L64,36 Z'],
      ['a', rect(60, 24, 9, 36)],
      ['d', 'M58.5,24 L64.5,6 L70.5,24 Z'],
      ['c', rects([45.5, 53.5], 44, 3, 5)],
      ['c', rect(63.2, 32, 2.6, 4.4)],
      ['c', rect(35.2, 50, 2.6, 4.4)],
      ['c', 'M48.5,60 V54 Q51,51 53.5,54 V60 Z'],
      ...birds(76, 16),
    ],
    motes: { kind: 'leaves', colors: ['#b5651d', '#d9a441', '#8c4a1e'] },
  },
  bgr: {
    art: [
      ['a', rect(8, 50, 10, 42)],
      ['d', 'M7,50 Q7,40 13,38 Q19,40 19,50 Z'],
      ['t', 'M13,38 V31 M11.4,33.6 H14.6'],
      ['c', arches([11.2], 64, 3.6, 6)],
      ['a', rect(22, 62, 60, 30)],
      ['d', 'M24,62 Q24,48 34,48 Q44,48 44,62 Z'],
      ['d', 'M60,62 Q60,48 70,48 Q80,48 80,62 Z'],
      ['a', rect(42, 44, 20, 18)],
      ['c', arches([45, 50.2, 55.4], 59, 2.6, 8)],
      ['d', 'M40,44 Q40,26 52,24 Q64,26 64,44 Z'],
      ['t', 'M52,24 V15 M50,18.4 H54'],
      ['c', arches([27, 35, 65, 73], 86, 4, 10)],
      ['c', 'M47.5,92 V80 Q52,73 56.5,80 V92 Z'],
    ],
    motes: { kind: 'petals', colors: ['#ff6f91', '#ff9bb3', '#d93b63'] },
  },
  tur: {
    art: [
      ...minaret(13, 8, 92),
      ...minaret(87, 8, 92),
      ...minaret(24, 20, 92),
      ...minaret(76, 20, 92),
      ['a', rect(28, 66, 44, 26)],
      ['a', 'M29,66 Q29,54 39.5,54 Q50,54 50,66 Z'],
      ['a', 'M50,66 Q50,54 60.5,54 Q71,54 71,66 Z'],
      ['d', 'M35,57 Q35,35 50,33 Q65,35 65,57 Z'],
      ['t', 'M50,33 V25'],
      ['l', 'M48.4,22.6 a2.2,2.2 0 1,0 3.2,0'],
      ['c', arches([31, 37.5, 59.5, 66], 86, 3, 7)],
      ['c', 'M45.5,92 V80 Q50,73 54.5,80 V92 Z'],
      ['t', 'M28,74 H72'],
    ],
    motes: { kind: 'petals', colors: ['#e02f2f', '#ff6a5a', '#ffd0c8'] },
  },
  grc: {
    art: [
      ...sun(84, 16, 6),
      ['a', rect(8, 86, 84, 6)],
      ['a', rect(11, 81, 78, 5)],
      ['w', rects(range(13.6, 86, 10.2), 50, 4.8, 31)],
      ['t', bars(range(16, 88, 10.2), 51, 80)],
      ['a', rect(11, 43, 78, 7)],
      ['t', bars(range(15, 86, 5), 44.5, 48.5)],
      ['d', 'M9,43 L50,24 L91,43 Z'],
      ['w', 'M19,41 L50,27.5 L81,41 Z'],
    ],
    motes: { kind: 'leaves', colors: ['#a9b88a', '#8fa36a', '#cfd6b4'] },
  },

  // ---------------------------------------------------------------- Middle East
  lby: {
    art: [
      ...sun(84, 18, 7),
      ['b', 'M0,92 Q22,78 46,86 Q72,76 100,88 V92 Z'],
      ...palm(9, 58, 92, 0.8),
      ['d', 'M30,32 L38,21 L46,32 Z M54,32 L62,21 L70,32 Z'],
      ['a', rect(22, 32, 56, 8)],
      ['a', 'M24,92 V40 H76 V92 H62 V66 Q50,52 38,66 V92 Z'],
      ['t', 'M20,40 H80 M26,48 H74'],
      ['w', rects([27, 69], 44, 4.4, 48)],
      ['w', rect(86, 74, 5.5, 18)],
      ['t', 'M86,80 H91.5 M86,86 H91.5'],
      ['w', 'M52,88 h11 v4 h-11 Z'],
    ],
    motes: { kind: 'sand', colors: SAND },
  },
  egy: {
    art: [
      ...sun(72, 22, 9),
      ['b', 'M40,92 L66,50 L92,92 Z'],
      ['a', 'M4,92 L36,34 L68,92 Z'],
      ['d', 'M36,34 L68,92 L48,92 Z'],
      ['t', 'M14,74 H40 M20,62 H38 M26,50 H36.5 M9,84 H43'],
      ...palm(85.5, 62, 92, 1),
    ],
    motes: { kind: 'sand', colors: SAND },
  },
  isr: {
    art: [
      ...sun(20, 20, 7),
      ['a', crenels(4, 70, 64, 7, 4, 92)],
      ['c', 'M29,92 V78 Q35,69 41,78 V92 Z'],
      ['t', 'M4,72 H27 M43,72 H70 M4,82 H27 M43,82 H70'],
      ['a', rect(52, 34, 12, 58)],
      ['a', rect(50, 30, 16, 4)],
      ['a', rect(54.5, 18, 7, 12)],
      ['d', 'M53.5,18 L58,8 L62.5,18 Z'],
      ['c', rects([56.6], 22, 2.8, 4.6)],
      ['c', rects([56.6], 44, 2.8, 5)],
      ['d', 'M82,92 Q80,84 83,78 L87,78 Q86,85 89,92 Z'],
      ['a', 'M73,74 Q68,62 78,58 Q84,50 92,58 Q100,62 97,72 Q90,80 85,77 Q78,80 73,74 Z'],
    ],
    motes: { kind: 'petals', colors: ['#fff4f6', '#ffd6e2'] },
  },
  lbn: {
    art: [
      ['b', 'M0,92 L30,54 L52,72 L74,44 L100,80 V92 Z'],
      ['w', 'M74,44 L81.5,55 L75.5,53 L71,58 L66.5,53 Z'],
      ['d', 'M47,92 L48.6,26 H51.4 L53,92 Z'],
      ['a', 'M12,80 Q30,66 50,70 Q70,66 88,80 Q68,76 50,80 Q32,76 12,80 Z'],
      ['a', 'M19,64 Q34,52 50,56 Q66,52 81,64 Q64,61 50,65 Q36,61 19,64 Z'],
      ['a', 'M27,49 Q38,39 50,43 Q62,39 73,49 Q60,47 50,51 Q40,47 27,49 Z'],
      ['a', 'M35,35 Q43,26 50,30 Q57,26 65,35 Q56,34 50,37 Q44,34 35,35 Z'],
      ['a', 'M42,24 Q50,13 58,24 Q50,22 42,24 Z'],
    ],
    motes: { kind: 'leaves', colors: ['#3f7d4f', '#5f9a62', '#8fbf8a'] },
  },
  syr: {
    art: [
      ['a', 'M56,92 V50 H100 V92 Z'],
      ['t', 'M56,56 H100'],
      ['w', 'M62,92 V70 Q70,58 78,70 V92 Z M84,92 V70 Q92,58 100,70 V92 Z'],
      ['a', 'M30,92 L33,56 H35 L38,92 Z'],
      ['l', circle(34, 54, 28)],
      ['l', circle(34, 54, 22.5)],
      ['t', Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        return P`M${34 + Math.cos(a) * 3.5},${54 + Math.sin(a) * 3.5} L${34 + Math.cos(a) * 28},${54 + Math.sin(a) * 28}`;
      }).join(' ')],
      ['t', Array.from({ length: 24 }, (_, i) => {
        const a = (i * Math.PI) / 12 + 0.13;
        return P`M${34 + Math.cos(a) * 28},${54 + Math.sin(a) * 28} L${34 + Math.cos(a) * 31},${54 + Math.sin(a) * 31}`;
      }).join(' ')],
      ['d', circle(34, 54, 3.6)],
      ...waves(97, 2, 98),
    ],
    motes: { kind: 'dust', colors: ['#f4e6c0', '#d9bd84', '#9a7a44'] },
  },
  irq: {
    art: [
      ...sun(82, 20, 7),
      ...palm(93, 66, 92, 0.7),
      ['a', 'M10,92 L16,70 H84 L90,92 Z'],
      ['t', bars([24, 32, 68, 76], 72, 90)],
      ['a', 'M24,70 L28,54 H72 L76,70 Z'],
      ['a', 'M38,54 L40,42 H60 L62,54 Z'],
      ['a', rect(45, 34, 10, 8)],
      ['c', rect(48.5, 37, 3, 5)],
      ['w', 'M44,92 L47,54 H53 L56,92 Z'],
      ['t', 'M44.6,86 H55.4 M45,80 H55 M45.5,74 H54.5 M46,68 H54 M46.5,62 H53.5 M47,56 H53'],
      ['t', 'M16,92 L40,70 M84,92 L60,70'],
    ],
    motes: { kind: 'dust', colors: ['#f6e4b8', '#d6b878', '#96743a'] },
  },
  irn: {
    art: [
      ['b', 'M0,84 L14,60 L28,74 L50,48 L72,74 L86,60 L100,84 V92 H0 Z'],
      ...roundTree(10, 92, 20, 6),
      ...roundTree(90, 92, 20, 6),
      ['a', 'M22,92 L30,70 Q36,50 40,34 L40,16 H60 L60,34 Q64,50 70,70 L78,92 H62 Q58,70 50,54 Q42,70 38,92 Z'],
      ['d', rect(40, 16, 20, 6)],
      ['t', 'M44,22 V36 M50,22 V42 M56,22 V36 M40,34 Q50,48 60,34'],
      ['t', 'M33,92 Q42,62 50,48 Q58,62 67,92'],
    ],
    motes: { kind: 'petals', colors: ['#b38cf0', '#e36aa0', '#f4c0d6'] },
  },
  jor: {
    art: [
      ['b', 'M4,92 V22 Q20,8 34,14 Q50,4 66,14 Q82,8 96,22 V92 Z'],
      ['t', 'M6,40 Q13,36 20,42 M80,40 Q88,34 94,40 M6,64 Q12,60 20,66 M80,66 Q88,60 94,64'],
      ['w', 'M22,92 V24 H78 V92 Z'],
      ['a', rect(25, 32, 10, 12)],
      ['d', 'M24,32 H35 V26.5 Z'],
      ['a', rect(65, 32, 10, 12)],
      ['d', 'M76,32 H65 V26.5 Z'],
      ['a', rect(43, 32, 14, 12)],
      ['d', 'M41,32 Q50,20 59,32 Z'],
      ['a', circle(50, 21, 2.2)],
      ['a', rect(23, 56, 54, 6)],
      ['d', 'M30,56 L50,45 L70,56 Z'],
      ['w', rects([26, 37, 59, 70], 62, 4.2, 26)],
      ['c', rect(46, 72, 8, 16)],
      ['a', rect(22, 88, 56, 4)],
    ],
    motes: { kind: 'sand', colors: ['#f8dcc4', '#d98f6f', '#a35a3c'] },
  },
  sau: {
    art: [
      ...sun(86, 18, 7),
      ['b', 'M0,92 Q20,80 44,86 Q70,78 100,86 V92 Z'],
      ...palm(48, 30, 60, 1),
      ...palm(61, 39, 60, 0.8),
      ['a', crenels(20, 76, 56, 8, 4, 92)],
      ['c', 'M42,92 V77 Q48,68 54,77 V92 Z'],
      ['c', [30, 36, 60, 66].map((x) => P`M${x},66 l1.6,-3.4 l1.6,3.4 Z`).join(' ')],
      ['a', 'M8,92 L11,40 H25 L28,92 Z'],
      ['a', crenels(10, 26, 40, 3, 4)],
      ['c', 'M16.4,54 l1.6,-3.4 l1.6,3.4 Z M16.4,66 l1.6,-3.4 l1.6,3.4 Z'],
      ['a', 'M70,92 L72.5,44 H85.5 L88,92 Z'],
      ['a', crenels(71.5, 86.5, 44, 3, 4)],
      ['c', 'M77.4,58 l1.6,-3.4 l1.6,3.4 Z M77.4,70 l1.6,-3.4 l1.6,3.4 Z'],
    ],
    motes: { kind: 'sand', colors: SAND },
  },
  gulf: {
    art: [
      ...sun(16, 18, 7),
      ['l', 'M46,68 L50,14 M20,58 L78,9'],
      ['w', 'M22,57 L77,11 Q72,40 62,63 Z'],
      ['t', 'M36,49 L65,57 M50,37 L69,46 M63,26 L73,33'],
      ['w', 'M72,62 L88,32 L87,60 Z'],
      ['l', 'M80,66 L88,30'],
      ['a', 'M10,64 Q14,78 26,82 H74 Q86,78 92,60 L80,68 H22 Z'],
      ['t', 'M17,73 Q50,80 84,72'],
      ...birds(84, 10),
      ...waves(88, 4, 96),
      ...waves(94, 10, 90),
    ],
    ground: 'sea',
    motes: { kind: 'glints', colors: ['#ffffff', '#fff3d6', '#d6f0ff'] },
  },

  // ---------------------------------------------------------------- Asia
  afg: {
    art: [
      ['b', 'M0,92 V56 L14,34 L26,54 L36,44 L44,92 Z'],
      ['w', 'M14,34 L19.5,43.5 L14.5,42 L11,46 L8.5,42.5 Z'],
      ['b', 'M58,92 L68,48 L78,60 L88,30 L100,52 V92 Z'],
      ['w', 'M88,30 L94,41 L89,39.5 L85.5,44 L83,39.5 Z'],
      ['a', 'M44,92 L46.5,40 H55.5 L58,92 Z'],
      ['t', 'M45.9,52 H56.1 M45.5,60 H56.5 M45.1,68 H56.9 M44.7,78 H57.3'],
      ['t', 'M45.7,56 l1.7,-2 l1.7,2 l1.7,-2 l1.7,2 l1.7,-2 l1.7,2 M45,73 l2,-2.4 l2,2.4 l2,-2.4 l2,2.4 l2,-2.4 l2,2.4'],
      ['a', rect(45, 37, 12, 3)],
      ['a', 'M47.5,37 L48.5,20 H53.5 L54.5,37 Z'],
      ['a', rect(48.5, 12, 5, 8)],
      ['c', rects([50], 14.5, 2, 4)],
      ['d', 'M48,12 Q51,5 54,12 Z'],
      ...waves(97, 30, 72),
    ],
    motes: { kind: 'dust', colors: ['#f2e8cf', '#cdbb92', '#8f7c52'] },
  },
  pak: {
    art: [
      ['a', 'M9,92 Q5,70 9.5,50 Q14,70 10,92 Z'],
      ['a', 'M90,92 Q86,70 90.5,50 Q95,70 91,92 Z'],
      ['a', 'M14,92 L20,84 H80 L86,92 Z'],
      ['a', 'M26,84 L30,78 H70 L74,84 Z'],
      ['a', 'M34,78 Q30,66 38,60 Q44,66 42,78 Z'],
      ['a', 'M66,78 Q70,66 62,60 Q56,66 58,78 Z'],
      ['w', 'M44,62 L46,22 H54 L56,62 Z'],
      ['t', 'M48,60 L48.8,24 M52,60 L51.2,24'],
      ['a', 'M42,78 Q40,62 50,56 Q60,62 58,78 Z'],
      ['a', rect(44.4, 44, 11.2, 2.2)],
      ['a', rect(45.2, 32, 9.6, 2.2)],
      ['d', 'M46,22 Q46,14 50,12 Q54,14 54,22 Z'],
      ['l', 'M50,12 V4'],
    ],
    motes: { kind: 'petals', colors: ['#ffe14d', '#fff7c2', '#ffffff'] },
  },
  ind: {
    art: [
      ...sun(22, 20, 7),
      ['a', 'M8,82 H92 V92 H8 Z'],
      ['w', rects([12, 83], 40, 5, 42)],
      ['a', 'M11,40 A3.5,3.5 0 0,1 18,40 Z M82,40 A3.5,3.5 0 0,1 89,40 Z'],
      ['t', 'M12,54 H17 M12,68 H17 M83,54 H88 M83,68 H88'],
      ['w', 'M30,56 H70 V82 H30 Z'],
      ['a', 'M30,56 A5,5 0 0,1 40,56 Z M60,56 A5,5 0 0,1 70,56 Z'],
      ['w', 'M50,24 C58,31 63,38 63,46 L63,50 Q63,56 58,56 H42 Q37,56 37,50 L37,46 C37,38 42,31 50,24 Z'],
      ['t', 'M50,24 V15 M37.4,49 H62.6'],
      ['c', 'M44,82 V68 Q50,60 56,68 V82 Z'],
      ['c', arches([33.5, 62.5], 80, 4, 9)],
    ],
    motes: { kind: 'holi', colors: ['#ff5fa2', '#ffb300', '#35c2ff', '#7bd34f', '#b36bff'] },
  },
  mmr: {
    art: [
      ['a', [9, 91].map((x) => P`M${x - 6},92 Q${x - 5},80 ${x - 1.5},76 L${x},64 L${x + 1.5},76 Q${x + 5},80 ${x + 6},92 Z`).join(' ')],
      ['a', 'M12,92 L16,84 H84 L88,92 Z'],
      ['a', 'M22,84 L26,76 H74 L78,84 Z'],
      ['d', 'M28,76 Q30,60 40,54 Q44,50 44,42 H56 Q56,50 60,54 Q70,60 72,76 Z'],
      ['a', 'M44,42 L46,30 H54 L56,42 Z'],
      ['t', 'M45,38 H55 M45.6,34 H54.4 M33,67 H67 M38,58 H62'],
      ['a', 'M46,30 Q46,24 50,22 Q54,24 54,30 Z'],
      ['a', 'M48,22 L50,7 L52,22 Z'],
      ['l', 'M50,7 V2'],
      ['t', 'M48,11 H52'],
    ],
    motes: { kind: 'glints', colors: ['#ffd45a', '#fff0a8', '#f2b53a'] },
  },
  lao: {
    art: [
      ...sun(86, 14, 6),
      ...[
        [12, 78, 22, 5], [88, 78, 22, 5], [30, 64, 26, 6], [70, 64, 26, 6], [50, 60, 40, 8],
      ].map(([x, base, h, w]): Shape => [
        'a',
        P`M${x - w},${base} Q${x - w * 1.15},${base - h * 0.45} ${x - w * 0.5},${base - h * 0.75} Q${x - w * 0.2},${base - h * 0.92} ${x},${base - h} Q${x + w * 0.2},${base - h * 0.92} ${x + w * 0.5},${base - h * 0.75} Q${x + w * 1.15},${base - h * 0.45} ${x + w},${base} Z`,
      ]),
      ['t', 'M43.6,50 H56.4 M44.6,42 H55.4 M46.4,34 H53.6 M25,56 H35 M26.4,49 H33.6 M65,56 H75 M66.4,49 H73.6'],
      ['a', rect(24, 64, 52, 10)],
      ['d', 'M22,64 H78 L76,60 H24 Z'],
      ['a', rect(6, 78, 88, 14)],
      ['t', bars(range(10, 90, 4), 80, 90)],
      ['d', 'M4,78 H96 L94,73 H6 Z'],
      ['c', 'M46.5,92 V84 Q50,80 53.5,84 V92 Z'],
    ],
    motes: { kind: 'petals', colors: ['#ff9ec4', '#ffd3e4', '#ffffff'] },
  },
  tha: {
    art: [
      ['a', 'M87,92 Q88,80 90.6,76 L92,58 L93.4,76 Q96,80 97,92 Z'],
      ['a', rect(14, 84, 72, 8)],
      ['w', rect(22, 60, 56, 24)],
      ['t', bars([27, 39, 61, 73], 61, 83)],
      ['c', 'M46,84 V68 L50,62 L54,68 V84 Z'],
      ['c', 'M30,78 V68 L32,65 L34,68 V78 Z M66,78 V68 L68,65 L70,68 V78 Z'],
      ['w', 'M42,92 L44,84 H56 L58,92 Z'],
      ['t', 'M43,88 H57'],
      ['a', 'M10,61 L50,36 L90,61 Z'],
      ['a', 'M18,54 L50,29 L82,54 Z'],
      ['d', 'M27,46 L50,21 L73,46 Z'],
      ['w', 'M39,45 L50,33 L61,45 Z'],
      ['l', 'M50,21 Q49,14 53,10 M10,61 Q5,60 4,55 M90,61 Q95,60 96,55 M18,54 Q14,53 13,49 M82,54 Q86,53 87,49'],
    ],
    motes: { kind: 'petals', colors: ['#c77dff', '#e9b8ff', '#ff8fd0'] },
  },
  vnm: {
    art: [
      ['b', 'M2,92 Q4,56 12,48 Q20,44 24,60 Q28,74 30,92 Z'],
      ['b', 'M70,92 Q72,50 80,40 Q90,36 94,58 Q98,76 98,92 Z'],
      ['b', 'M56,92 Q58,70 63,66 Q69,68 70,92 Z'],
      ['t', 'M8,60 q2,-3 4,0 M14,56 q2,-3 4,0 M78,52 q2,-3 4,0 M85,48 q2,-3 4,0 M82,62 q2,-3 4,0'],
      ['l', 'M32,74 V42 M44,76 V28 M58,76 V38'],
      ['w', 'M32,44 Q40,48 40,58 Q39,66 32,70 Z'],
      ['w', 'M58,40 Q68,44 69,54 Q68,64 58,70 Z'],
      ['w', 'M44,30 Q58,34 60,50 Q58,66 44,72 Z'],
      ['t', 'M44,38 L57.5,40 M44,46 L59.8,48 M44,54 L59.6,56 M44,62 L56,64 M58,48 L68.6,50 M58,56 L68.8,58 M58,63 L66,64.6 M32,52 L39.8,53.6 M32,60 L39.6,61.6'],
      ['a', 'M24,74 Q28,84 38,86 H62 Q70,84 74,70 L66,76 H34 Z'],
      ...waves(92, 6, 94),
      ...waves(97, 14, 86),
    ],
    ground: 'sea',
    motes: { kind: 'rain', colors: ['#e6f7fa', '#8fc3cf', '#4c8a99'] },
  },
  mys: {
    art: [
      ...palm(87, 38, 92, 1),
      ...palm(10, 50, 92, 0.8),
      ['l', bars([30, 42, 58, 70], 74, 92)],
      ['a', rect(26, 70, 48, 4)],
      ['w', rect(29, 52, 42, 18)],
      ['c', rects([34, 60], 57, 6, 8)],
      ['c', rect(47, 56, 7, 14)],
      ['a', 'M20,54 L38,26 H62 L80,54 Z'],
      ['t', 'M32,52 L42,30 M44,52 L47,30 M56,52 L53,30 M68,52 L58,30'],
      ['l', 'M38,26 L33,19 M62,26 L67,19'],
      ['a', 'M48,92 L46,74 H56 L54,92 Z'],
      ['t', 'M46.6,80 H55.4 M47.3,86 H54.7'],
    ],
    motes: { kind: 'fireflies', colors: ['#d8ff6a', '#b6ff3a', '#f4ffb0'] },
  },
  idn: {
    art: [
      ['b', 'M10,92 L40,34 Q44,30 48,34 L52,32 Q56,30 60,36 L92,92 Z'],
      ['t', 'M48,30 Q40,22 48,16 Q56,12 50,4 M54,30 Q62,24 58,15'],
      ['a', 'M4,92 L10,82 H90 L96,92 Z'],
      ['a', 'M16,82 L20,74 H80 L84,82 Z'],
      ...[[28, 74, 0.9], [72, 74, 0.9], [50, 74, 1.3]].flatMap(([x, base, s]): Shape[] => [
        ['a', P`M${x - 7 * s},${base} Q${x - 7 * s},${base - 10 * s} ${x - 2 * s},${base - 13 * s} L${x - s},${base - 18 * s} H${x + s} L${x + 2 * s},${base - 13 * s} Q${x + 7 * s},${base - 10 * s} ${x + 7 * s},${base} Z`],
        ['l', P`M${x},${base - 18 * s} V${base - 25 * s}`],
        ['t', P`M${x - 4.6 * s},${base - 4 * s} l${1.5 * s},${-2 * s} l${1.5 * s},${2 * s} l${1.5 * s},${-2 * s} l${1.5 * s},${2 * s} l${1.5 * s},${-2 * s} l${1.5 * s},${2 * s}`],
      ]),
      ['t', bars(range(14, 86, 6), 84, 90)],
    ],
    motes: { kind: 'embers', colors: ['#ff9a3a', '#ffd15a', '#ff5a2a'] },
  },
  phl: {
    art: [
      ['b', 'M6,92 Q32,66 46,30 Q50,26 54,30 Q68,66 94,92 Z'],
      ['t', 'M49,26 Q44,18 50,12 Q56,8 52,2'],
      ...palm(70, 60, 92, 0.7),
      ...palm(84, 48, 92, 1),
      ['l', bars([22, 30, 40, 48], 80, 92)],
      ['a', rect(19, 77, 32, 3)],
      ['w', rect(22, 64, 26, 13)],
      ['c', rect(26, 68, 5, 5)],
      ['c', rect(36, 67, 5, 10)],
      ['a', 'M15,66 L35,46 L55,66 Z'],
      ['t', 'M25,63 L35,50 M35,63 V50 M45,63 L35,50 M37,80 V92 M41,80 V92 M37,84 H41 M37,88 H41'],
    ],
    motes: { kind: 'petals', colors: ['#ffffff', '#f2ffe9', '#fff7d6'] },
  },
  twn: {
    art: [
      ['b', 'M0,92 V78 Q16,64 32,76 Q40,70 46,74 V92 Z'],
      ['b', 'M56,92 V76 Q72,62 86,74 Q94,70 100,76 V92 Z'],
      ['t', 'M4,82 Q16,72 30,80 M60,82 Q72,70 84,80'],
      ['a', rect(30, 86, 40, 6)],
      ...range(0, 4, 1).flatMap((i): Shape[] => {
        const hw = 14 - i * 2;
        const y = 86 - i * 12;
        return [
          ['w', rect(50 - hw, y - 10, hw * 2, 10)],
          ['c', arch(48.4, y, 3.2, 5)],
          ['d', P`M${50 - hw - 6},${y - 10} Q${50 - hw - 2},${y - 11} ${50 - hw + 1},${y - 15} H${50 + hw - 1} Q${50 + hw + 2},${y - 11} ${50 + hw + 6},${y - 10} Q${50},${y - 13} ${50 - hw - 6},${y - 10} Z`],
        ];
      }),
      ['l', 'M50,23 V7'],
      ['t', 'M48,18 H52 M48.4,14 H51.6 M48.8,10 H51.2'],
    ],
    motes: { kind: 'lanterns', colors: ['#ffb347', '#ff8a3a', '#ffd9a0'] },
  },
  jpn: {
    art: [
      ['s', circle(78, 22, 10)],
      ['b', 'M0,92 L36,36 Q40,31 44,34 L48,31 Q52,29 56,34 L60,32 L66,38 L100,92 Z'],
      ['w', 'M36,36 Q40,31 44,34 L48,31 Q52,29 56,34 L60,32 L66,38 L71,46 L64,43 L59,49 L53,43 L47,49 L41,43 L34,47 L30.5,45 Z'],
      ['a', 'M35,64 L39.4,64 L40.4,92 L34,92 Z'],
      ['a', 'M60.6,64 L65,64 L66,92 L59.6,92 Z'],
      ['a', rect(29, 68, 42, 3.6)],
      ['a', rect(48.2, 62, 3.6, 6)],
      ['d', 'M22,54 Q50,60 78,54 L76,61 Q50,65.5 24,61 Z'],
      ['t', 'M22,54 l-2.4,-2.4 M78,54 l2.4,-2.4'],
    ],
    motes: { kind: 'petals', colors: ['#ffc2d4', '#ff9fbb', '#ffe6ee'] },
  },
  kor: {
    art: [
      ['a', 'M10,92 V66 H90 V92 Z'],
      ['t', 'M10,74 H40 M60,74 H90 M10,83 H41 M59,83 H90 M24,66 V74 M36,74 V83 M70,66 V74 M80,74 V83 M18,83 V92 M30,83 V92 M68,83 V92 M84,83 V92'],
      ['c', 'M42,92 V78 Q50,68 58,78 V92 Z'],
      ['w', rect(22, 54, 56, 12)],
      ['t', bars([28, 39, 50, 61, 72], 55, 65)],
      ['d', 'M8,54 Q16,52 20,45 H80 Q84,52 92,54 Q50,49 8,54 Z'],
      ['w', rect(30, 37, 40, 8)],
      ['t', bars([36, 45, 55, 64], 38, 44)],
      ['d', 'M16,37 Q24,35 28,27 H72 Q76,35 84,37 Q50,32 16,37 Z'],
      ['l', 'M28,27 Q50,24 72,27'],
      ['t', 'M28,27 l-3,-3 M72,27 l3,-3'],
    ],
    motes: { kind: 'leaves', colors: ['#f4d03f', '#f7e27a', '#e6b422'] },
  },
  prk: {
    art: [
      ['b', 'M0,92 V74 L14,62 L26,72 L38,66 V92 Z'],
      ['b', 'M62,92 V68 L76,58 L88,70 L100,64 V92 Z'],
      ...roundTree(16, 92, 18, 6),
      ...roundTree(84, 92, 18, 6),
      ['a', 'M30,92 L34,80 H66 L70,92 Z'],
      ['a', 'M43,84 L46,24 H54 L57,84 Z'],
      ['t', 'M45.6,34 H54.4 M45.1,43 H54.9 M44.7,52 H55.3 M44.2,61 H55.8 M43.8,70 H56.2 M43.3,79 H56.7'],
      ['a', rect(44.5, 20, 11, 4)],
      ['d', 'M46,20 Q44,12 50,3 Q52,9 55,8 Q56,14 54,20 Z'],
      ['w', 'M48.5,20 Q47.5,15 50.5,10 Q52.5,15 51.5,20 Z'],
    ],
    motes: { kind: 'snow', colors: SNOW },
  },
  aus: {
    art: [
      ['l', 'M2,64 Q34,22 66,64 M2,64 H70'],
      ['t', 'M12,64 V53.5 M22,64 V46.5 M34,64 V43 M46,64 V46.5 M56,64 V53.5'],
      ['b', rect(64, 50, 6, 18)],
      ['a', 'M20,92 L25,82 H96 L99,92 Z'],
      ['w', 'M48,82 Q46,58 30,52 Q33,68 28,82 Z'],
      ['w', 'M38,82 Q36,64 24,60 Q27,72 24,82 Z'],
      ['w', 'M50,82 Q52,50 74,40 Q72,62 78,82 Z'],
      ['a', 'M74,40 Q72,62 78,82 H70 Q67,60 74,40 Z'],
      ['w', 'M64,82 Q67,56 85,48 Q83,66 88,82 Z'],
      ['a', 'M85,48 Q83,66 88,82 H81 Q79,64 85,48 Z'],
      ['w', 'M79,82 Q81,62 93,56 Q92,70 96,82 Z'],
      ...waves(97, 4, 96),
    ],
    motes: { kind: 'dust', colors: ['#d9774a', '#e89a6a', '#c85f38'] },
  },

  // ---------------------------------------------------------------- Africa
  mar: {
    art: [
      ...palm(92, 56, 92, 0.8),
      ['a', rect(64, 22, 16, 70)],
      ['a', crenels(63, 81, 22, 4, 4)],
      ['t', 'M64,28 H80 M64,34 H80'],
      ['c', arches([70], 46, 4, 7)],
      ['c', arches([70], 64, 4, 7)],
      ['a', rect(68.5, 9, 7, 9)],
      ['d', 'M68.5,9 Q72,2 75.5,9 Z'],
      ['a', crenels(8, 58, 46, 6, 4, 92)],
      ['w', 'M17,92 V50 H49 V92 Z'],
      ['c', 'M25,92 V72 Q19,58 33,54 Q47,58 41,72 V92 Z'],
      ['t', 'M21,72 Q15,56 33,51 Q51,56 45,72 M17,56 H49'],
    ],
    motes: { kind: 'dust', colors: ['#f2b84b', '#e58f3a', '#d9603a'] },
  },
  dza: {
    art: [
      ['b', 'M0,92 V80 Q30,70 50,78 Q70,70 100,80 V92 Z'],
      ['a', 'M14,92 Q30,70 44,34 L50,34 Q40,70 30,92 Z'],
      ['a', 'M86,92 Q70,70 56,34 L50,34 Q60,70 70,92 Z'],
      ['d', 'M42,92 Q46,64 47,34 H53 Q54,64 58,92 Z'],
      ['a', rect(44, 33, 12, 3)],
      ['a', rect(46, 22, 8, 11)],
      ['c', rects([48.8], 25, 2.4, 4)],
      ['d', 'M46,22 Q50,14 54,22 Z'],
      ['l', 'M50,16 V5'],
      ...sun(84, 18, 7),
    ],
    motes: { kind: 'sand', colors: SAND },
  },
  tun: {
    art: [
      ...palm(20, 40, 62, 0.75),
      ...palm(80, 44, 62, 0.7),
      ['a', 'M2,92 V62 H98 V92 Z'],
      ['a', rect(10, 58, 6, 34)],
      ['a', rect(84, 58, 6, 34)],
      ['c', arches([22, 72], 92, 6, 12)],
      ['a', 'M36,92 L38,34 H62 L64,92 Z'],
      ['a', crenels(37, 63, 34, 5, 3.4)],
      ['c', arches([46.5], 92, 7, 12)],
      ['c', arches([48], 68, 4, 7)],
      ['c', arches([48], 50, 4, 6)],
      ['a', rect(42, 19, 16, 12)],
      ['c', arches([48], 30, 4, 6)],
      ['a', rect(45.5, 10, 9, 9)],
      ['d', 'M45.5,10 Q50,2 54.5,10 Z'],
    ],
    motes: { kind: 'petals', colors: ['#ffffff', '#fff9e6'] },
  },
  saharan: {
    art: [
      ...sun(86, 16, 6),
      ['a', 'M6,92 V58 H94 V92 Z'],
      ['a', [10, 37, 63, 90].map((x) => P`M${x - 2.2},92 V54 L${x},48 L${x + 2.2},54 V92 Z`).join(' ')],
      ['c', arches([47, 22.5, 71.5], 92, 6, 10)],
      ...[[25, 34, 22], [75, 34, 22], [50, 26, 12]].flatMap(([x, y, tip]): Shape[] => {
        const hw = x === 50 ? 8 : 7;
        return [
          ['a', P`M${x - hw},58 L${x - hw + 1.5},${y} H${x + hw - 1.5} L${x + hw},58 Z`],
          ['d', P`M${x - hw + 2},${y} L${x},${tip} L${x + hw - 2},${y} Z`],
          ['s', circle(x, tip - 1.6, 1.5)],
          ['t', [y + 6, y + 13, y + 20].filter((yy) => yy < 58).map((yy) => P`M${x - hw - 2.6},${yy} H${x - hw + 1.6} M${x + hw - 1.6},${yy} H${x + hw + 2.6}`).join(' ')],
        ];
      }),
      ['t', 'M12,66 H16 M12,74 H16 M31,66 H35 M31,74 H35 M65,66 H69 M65,74 H69 M84,66 H88 M84,74 H88'],
    ],
    motes: { kind: 'sand', colors: ['#fff0c4', '#e0bf80', '#a8823f'] },
  },
  westafrica: {
    art: [
      ...sun(86, 20, 6),
      ['l', 'M30,52 Q24,40 14,36 M30,52 Q28,38 24,26 M40,50 Q38,36 32,22 M44,48 Q44,34 46,20 M52,50 Q54,36 60,24 M58,52 Q64,42 74,38 M58,52 Q62,40 68,30'],
      ['a', [[14, 36], [24, 26], [32, 22], [46, 20], [60, 24], [74, 38], [68, 30]].map(([x, y]) => circle(x, y, 3.2)).join(' ')],
      ['a', 'M26,92 Q30,70 28,52 Q34,46 40,50 Q46,44 52,50 Q56,46 60,52 Q58,70 62,92 Z'],
      ['t', 'M36,88 Q38,70 36,56 M44,90 Q45,70 44,54 M52,88 Q51,70 53,56'],
      ...hut(82, 92, 18, 14, 18),
      ['t', 'M76,76 L82,64 M88,76 L82,64'],
      ...grass([8, 16, 70]),
    ],
    motes: { kind: 'fireflies', colors: ['#ffd97a', '#ffe9a8'] },
  },
  civ: {
    art: [
      ...sun(84, 18, 6),
      ['d', rects([45, 66], 70, 7, 20)],
      ['a', 'M30,52 Q38,38 58,38 Q78,38 84,52 Q86,60 84,70 V90 H75 V74 Q62,78 46,74 L45,90 H36 V72 Q30,66 30,52 Z'],
      ['l', 'M84,52 Q90,58 88,68'],
      ['a', 'M34,42 Q22,36 16,46 Q13,54 18,62 L16,78 Q15,86 20,88 L22.5,86 Q20.5,82 22,76 L26,62 Q34,58 36,48 Z'],
      ['w', 'M24,62 Q18,71 11,69 Q18,66.5 21.5,60 Z'],
      ['d', 'M30,41 Q42,39 42,52 Q40,62 32,60 Q28,52 30,41 Z'],
      ['c', circle(22, 48, 1.1)],
      ...grass([8, 56, 62, 94]),
    ],
    motes: { kind: 'rain', colors: ['#e9f7f2', '#93c7b9', '#4f8f80'] },
  },
  nga: {
    art: [
      ['b', 'M30,92 Q28,50 46,34 Q62,26 78,36 Q94,48 92,92 Z'],
      ['t', 'M44,44 Q42,66 44,88 M56,36 Q54,60 56,88 M68,36 Q70,60 68,88 M80,46 Q84,66 82,88'],
      ...palm(86, 54, 92, 0.9),
      ...hut(40, 92, 13, 12, 15),
      ...hut(19, 92, 17, 14, 18),
      ['t', 'M12,77 L19,64 M26,77 L19,64 M35,79 L40,69 M45,79 L40,69'],
      ...grass([60, 68]),
    ],
    motes: { kind: 'butterflies', colors: ['#3fbf7f', '#ffffff', '#9fe6bf'] },
  },
  cmr: {
    art: [
      ...sun(84, 18, 6),
      ...roundTree(92, 92, 26, 7),
      ...[[14, 92, 16, 26], [74, 92, 24, 40], [40, 92, 34, 58]].flatMap(([x, base, w, h]): Shape[] => {
        const marks: string[] = [];
        for (let row = 0; row < 3; row++) {
          const y = base - h * (0.22 + row * 0.22);
          const half = w * (0.4 - row * 0.09);
          for (let mx = x - half; mx <= x + half - 2; mx += w * 0.2) marks.push(P`M${mx},${y} l${w * 0.07},${-h * 0.06} l${w * 0.07},${h * 0.06}`);
        }
        return [
          ['a', P`M${x - w / 2},${base} Q${x - w / 2},${base - h * 0.7} ${x - w * 0.12},${base - h} Q${x},${base - h - 2} ${x + w * 0.12},${base - h} Q${x + w / 2},${base - h * 0.7} ${x + w / 2},${base} Z`],
          ['t', marks.join(' ')],
          ['c', P`M${x - w * 0.09},${base} V${base - h * 0.14} Q${x},${base - h * 0.24} ${x + w * 0.09},${base - h * 0.14} V${base} Z`],
        ];
      }),
    ],
    motes: { kind: 'rain', colors: ['#e4f6ee', '#8ccab2', '#468b72'] },
  },
  cod: {
    art: [
      ...palm(34, 38, 80, 0.8),
      ...palm(68, 42, 80, 0.7),
      ...roundTree(50, 80, 42, 13),
      ...roundTree(15, 82, 52, 15),
      ...roundTree(85, 82, 56, 15),
      ['t', 'M0,82 Q50,78 100,82'],
      ['a', 'M20,86 Q50,93 80,86 Q78,90 70,91.5 Q50,95 30,91.5 Q22,90 20,86 Z'],
      ['l', 'M40,88 V80 M60,88 V80'],
      ['c', circle(40, 78.2, 1.6) + ' ' + circle(60, 78.2, 1.6)],
      ['t', 'M37,80 L45,91 M57,80 L65,91'],
      ...waves(99, 6, 94),
    ],
    ground: 'sea',
    motes: { kind: 'mist', colors: ['#eef7ef', '#a9cdb4'] },
  },
  ago: {
    art: [
      ...sun(84, 20, 6),
      ['d', 'M46,68 L46.5,90 H49.5 L50,68 Z M64,68 L65,90 H68 L68.5,68 Z'],
      ['a', 'M36,54 Q50,46 66,50 Q76,52 78,60 L78,66 Q72,70 62,68 Q50,70 42,68 Q36,64 36,54 Z'],
      ['a', 'M40,66 L39,90 H42.5 L44,67 Z'],
      ['a', 'M70,66 Q74,78 71,90 H74.5 Q78,78 76,64 Z'],
      ['l', 'M78,60 Q82,68 80,76'],
      ['a', 'M41,56 Q37,46 34,38 L27,35 Q21,37 19.5,42.5 L22.5,44.5 L29,42.5 Q32,52 36,62 Z'],
      ['a', 'M33,37 l6,-3 l-3,5.4 Z'],
      ['c', circle(27.5, 38.6, 0.9)],
      ['l', 'M29.5,35 Q30,14 52,9 M32,36 Q34,18 57,15'],
      ['t', 'M30,29 l3,0.6 M30.6,24 l3.2,1 M32.4,19.4 l3,1.6 M36,15 l2.4,2.4 M41,11.6 l1.6,3'],
      ...grass([8, 16, 56, 60]),
    ],
    motes: { kind: 'dust', colors: ['#f4d6b0', '#d09a6a', '#8f5f38'] },
  },
  zaf: {
    art: [
      ['b', 'M0,92 L8,70 L16,52 Q18,46 24,46 H70 Q76,46 78,52 L84,62 Q88,54 92,56 Q96,60 100,78 V92 Z'],
      ['t', 'M18,56 H76 M14,66 H82'],
      ['s', 'M20,46 Q22,38 32,40 Q38,34 48,38 Q58,34 64,40 Q72,40 72,46 Q60,50 46,48 Q30,50 20,46 Z'],
      ['w', rect(30, 74, 40, 18)],
      ['a', 'M26,76 L32,64 H68 L74,76 Z'],
      ['w', 'M42,76 V66 Q42,62 45,62 Q46,56 50,55 Q54,56 55,62 Q58,62 58,66 V76 Z'],
      ['c', rect(47.5, 80, 5, 12)],
      ['c', rects([35, 60], 79, 5, 6)],
      ['c', rect(48.5, 65, 3, 4)],
      ...grass([10, 18, 82, 90]),
    ],
    motes: { kind: 'petals', colors: ['#b79cff', '#9a7df0', '#d6c8ff'] },
  },
  bwa: {
    art: [
      ...sun(16, 22, 7),
      ...acacia(84, 92, 46, 13),
      ['b', 'M6,92 Q30,76 50,78 Q70,76 94,92 Z'],
      ...[[34, 84, 1], [66, 85, 0.9], [50, 82, 1.25]].flatMap(([x, base, s]): Shape[] => [
        ['l', P`M${x + 3.5 * s},${base - 2} q${6 * s},0 ${8 * s},${-6 * s}`],
        ['w', P`M${x - 4 * s},${base} Q${x - 5.5 * s},${base - 14 * s} ${x - 2.5 * s},${base - 24 * s} Q${x - 3.5 * s},${base - 30 * s} ${x},${base - 31 * s} Q${x + 3.5 * s},${base - 30 * s} ${x + 2.5 * s},${base - 24 * s} Q${x + 5.5 * s},${base - 14 * s} ${x + 4 * s},${base} Z`],
        ['c', circle(x - 2.9 * s, base - 29.4 * s, 0.9 * s) + ' ' + circle(x + 2.9 * s, base - 29.4 * s, 0.9 * s)],
        ['c', ellipse(x - 1.3 * s, base - 27 * s, 0.9 * s, 0.7 * s) + ' ' + ellipse(x + 1.3 * s, base - 27 * s, 0.9 * s, 0.7 * s)],
        ['t', P`M${x - 2.6 * s},${base - 18 * s} Q${x},${base - 14 * s} ${x + 2.6 * s},${base - 18 * s} M${x - 0.6 * s},${base - 25 * s} h${1.2 * s}`],
      ]),
      ...grass([10, 22, 78]),
    ],
    motes: { kind: 'rain', colors: ['#eef7ff', '#9cc6ea', '#4f84b3'] },
  },
  zwe: {
    art: [
      ...roundTree(91, 92, 30, 8),
      ['a', 'M4,92 V56 Q30,50 56,56 V92 Z'],
      ['t', 'M4,68 Q30,62 56,68 M4,78 Q30,72 56,78 M4,86 Q30,81 56,86'],
      ['t', 'M6,61 l3,-3 l3,3 l3,-3 l3,2.4 l3,-3 l3,2.6 l3,-3 l3,3 l3,-3 l3,3 l3,-2.6 l3,3 l3,-2.4 l3,3 l3,-3 l3,3'],
      ['c', 'M26,92 V72 H32 V92 Z'],
      ['a', 'M58,92 L62,36 Q68,32 74,36 L80,92 Z'],
      ['t', 'M59.4,80 H78.6 M60.3,68 H77.7 M61.2,56 H76.8 M62,46 H76 M62.6,40 l2,-2 l2,2 l2,-2 l2,2 l2,-2 l2,2'],
      ...birds(20, 26),
    ],
    motes: { kind: 'mist', colors: ['#ffffff', '#b9d3e6'] },
  },
  seafrica: {
    art: [
      ['b', 'M0,92 L22,56 Q34,36 46,36 H62 Q72,38 82,56 L100,84 V92 Z'],
      ['w', 'M33,42 Q40,36 46,36 H62 Q68,37 72,42 L66,46 L60,42 L54,47 L48,42 L42,46 L38,42 Z'],
      ['t', 'M8,64 q5,-3 10,0 t10,0 M62,62 q5,-3 10,0 t10,0'],
      ...acacia(78, 92, 22, 10),
      ...acacia(28, 92, 36, 17),
      ...birds(66, 16),
      ...grass([8, 50, 58, 92]),
    ],
    motes: { kind: 'seeds', colors: ['#f2e2a0', '#fff4c8'] },
  },
  ken: {
    art: [
      ['l', 'M18,90 L82,10 M82,90 L18,10'],
      ['d', 'M84,7 Q82,16 75,19 Q76,11 84,7 Z M16,7 Q18,16 25,19 Q24,11 16,7 Z'],
      ['w', 'M50,12 Q74,36 74,50 Q74,64 50,88 Q26,64 26,50 Q26,36 50,12 Z'],
      ['a', 'M50,12 Q58,36 58,50 Q58,64 50,88 Q42,64 42,50 Q42,36 50,12 Z'],
      ['d', 'M31,50 Q33,40 38,34 Q36,44 36,50 Q36,56 38,66 Q33,60 31,50 Z M69,50 Q67,40 62,34 Q64,44 64,50 Q64,56 62,66 Q67,60 69,50 Z'],
      ['w', circle(50, 50, 3.4)],
      ['t', 'M50,24 V44 M50,56 V76'],
    ],
    ground: 'none',
    motes: { kind: 'feathers', colors: ['#ff9fb5', '#ffc2d1', '#ff7d9c'] },
  },
  som: {
    art: [
      ...sun(84, 18, 7),
      ['b', 'M0,92 Q24,74 50,82 Q76,72 100,84 V92 Z'],
      ['d', 'M49,68 L49.5,90 H52.5 L53,68 Z M65,68 L66,90 H69 L69,68 Z'],
      ['a', 'M36,56 Q40,46 48,48 Q54,30 62,45 Q72,45 78,52 Q82,58 80,66 Q70,70 60,68 Q48,70 40,66 Q34,62 36,56 Z'],
      ['a', 'M42,66 L41,78 L42,90 H45 L45.5,78 L47,67 Z'],
      ['a', 'M72,66 L75,78 L73,90 H76 L79,78 L78,62 Z'],
      ['l', 'M80,58 Q84,64 82,72'],
      ['a', 'M39,60 Q30,57 27,46 L25.5,33 L18,30.5 Q13.5,31.5 12.5,35.5 L15.5,37.5 L21.5,36.5 L23,48 Q25,60 35,66 Z'],
      ['a', 'M24.6,32.4 l2.4,-4.4 l1.2,5.2 Z'],
      ['c', circle(19.6, 33, 0.9)],
      ['d', 'M47,49 Q54,35 62,46 L63,56 H46 Z'],
      ...grass([8, 92]),
    ],
    motes: { kind: 'mist', colors: ['#f4ecde', '#b9ab95'] },
  },
  eth: {
    art: [
      ...sun(86, 18, 6),
      ['b', 'M0,92 V70 Q30,58 60,68 Q80,60 100,70 V92 Z'],
      ...roundTree(20, 86, 28, 9),
      ['b', 'M4,88 L30,82 L31,86 L7,92 Z'],
      ['a', 'M68,92 L71,50 Q74,45 77,50 L79,92 Z'],
      ['t', 'M70.6,60 H77.4 M70,70 H78 M69.4,80 H78.6'],
      ['a', 'M43,92 L45,22 Q50,12 55,22 L57,92 Z'],
      ['t', 'M44.7,34 H55.3 M44.4,44 H55.6 M44.1,54 H55.9 M43.8,64 H56.2 M43.5,74 H56.5'],
      ['c', [37, 47, 57, 67].map((y) => rects([46.6, 51], y, 2.4, 4)).join(' ')],
      ['c', rect(47.5, 80, 5, 10)],
    ],
    motes: { kind: 'petals', colors: ['#ffd21f', '#ffe566', '#fff2a8'] },
  },
  sdn: {
    art: [
      ...sun(14, 16, 6),
      ['b', 'M0,92 Q26,82 54,88 Q78,82 100,88 V92 Z'],
      ...[[22, 84, 22, 40], [76, 84, 20, 36], [10, 92, 14, 24], [88, 92, 16, 28], [48, 92, 30, 58]].flatMap(([x, base, w, h]): Shape[] => [
        ['a', P`M${x - w / 2},${base} L${x - 1.2},${base - h} H${x + 1.2} L${x + w / 2},${base} Z`],
        ['d', P`M${x + 1.2},${base - h} L${x + w / 2},${base} H${x + w * 0.16} Z`],
        ['w', rect(x - w * 0.19, base - w * 0.3, w * 0.22, w * 0.3)],
        ['c', rect(x - w * 0.12, base - w * 0.2, w * 0.08, w * 0.2)],
      ]),
    ],
    motes: { kind: 'sand', colors: ['#f6dcc0', '#d99a6a', '#9c6238'] },
  },

  // ---------------------------------------------------------------- Central America
  mex: {
    art: [
      ...sun(16, 18, 7),
      ['a', 'M12,92 L18,82 H82 L88,92 Z'],
      ['a', 'M20,82 L25,72 H75 L80,82 Z'],
      ['a', 'M27,72 L31.5,62 H68.5 L73,72 Z'],
      ['a', 'M33.5,62 L37.5,53 H62.5 L66.5,62 Z'],
      ['a', 'M39.5,53 L42.5,45 H57.5 L60.5,53 Z'],
      ['w', rect(43, 34, 14, 11)],
      ['a', rect(41.5, 31, 17, 3.5)],
      ['c', rect(48, 38, 4, 7)],
      ['w', 'M44,92 L46.5,45 H53.5 L56,92 Z'],
      ['t', rules(range(49, 89, 4), 46.6, 53.4)],
      ['a', 'M89,92 V62 Q89,58 91.5,58 Q94,58 94,62 V92 Z'],
      ['a', 'M89,78 H86 Q83,78 83,74 V68 Q83,66 84.5,66 Q86,66 86,68 V74 H89 Z'],
      ['a', 'M94,72 H96 Q99,72 99,68 V64 Q99,62 97.8,62 Q96.5,62 96.5,64 V68.5 H94 Z'],
      ['t', 'M6,92 L1,81 M6,92 L4.5,77 M6,92 L8.5,77 M6,92 L12,81'],
    ],
    motes: { kind: 'butterflies', colors: ['#ff8a1f', '#ffb347'] },
  },
  gtm: {
    art: [
      ['b', 'M6,92 L40,30 Q50,24 60,30 L94,92 Z'],
      ['t', 'M48,26 Q42,18 50,12 Q56,8 52,2'],
      ['a', rect(43, 26, 14, 16)],
      ['d', 'M41,26 Q50,13 59,26 Z'],
      ['w', circle(50, 34, 3.6)],
      ['t', 'M50,34 V31.4 M50,34 L52,35 M50,14 V8'],
      ['a', 'M12,42 H88 V92 H68 V66 Q50,46 32,66 V92 H12 Z'],
      ['t', 'M12,49 H88 M12,56 H38 M62,56 H88'],
      ['c', arches([19, 75], 78, 6, 9)],
    ],
    motes: { kind: 'feathers', colors: ['#1fbf8f', '#4fe0b0', '#e03b3b'] },
  },
  slv: {
    art: [
      ['b', 'M58,92 L80,58 Q84,56 88,58 L100,80 V92 Z'],
      ['a', 'M8,92 L42,30 Q50,26 58,30 L92,92 Z'],
      ['t', 'M46,32 Q44,50 38,62 M52,31 Q54,48 60,64 M50,31 V52'],
      ['s', 'M40,27 Q36,18 44,16 Q46,8 56,12 Q64,10 62,20 Q66,26 58,28 Q50,24 40,27 Z'],
      ['a', 'M8,92 Q6,80 16,78 Q26,80 24,92 Z M76,92 Q74,82 83,80 Q92,82 90,92 Z'],
      ['c', [[12, 86], [17, 83], [20, 88], [80, 87], [85, 84], [87, 89]].map(([x, y]) => circle(x, y, 1)).join(' ')],
    ],
    motes: { kind: 'embers', colors: ['#ffb347', '#ff7a3a', '#ffd98a'] },
  },
  hnd: {
    art: [
      ['a', 'M50,70 L58,95 L54,96 L47,72 Z M53,69 L66,93 L62,95 L50,71 Z'],
      ['d', 'M4,74 Q40,66 96,72 L96,76 Q40,71 4,79 Z'],
      ['a', 'M76,72 Q84,60 96,60 Q92,70 80,74 Z M22,74 Q14,62 4,62 Q8,72 18,78 Z'],
      ['a', 'M44,30 Q56,26 60,40 Q62,54 54,66 L50,72 L46,66 Q40,52 42,40 Q42,34 44,30 Z'],
      ['d', 'M52,36 Q62,44 60,58 Q58,66 54,68 Q50,54 50,40 Z'],
      ['t', 'M53,44 Q57,50 57,58 M51.5,48 Q54,54 54.5,62'],
      ['w', 'M40,22 Q46,14 54,18 Q60,22 58,30 Q52,34 46,32 Q40,30 40,22 Z'],
      ['a', 'M40,22 Q46,11 57,18 Q50,17 44,24 Z'],
      ['d', 'M41,24 Q33,24 33,32 Q35,36 39,33 Q39,29 43,28 Z'],
      ['c', circle(47.5, 24.5, 1.2)],
      ['t', 'M48,70 v4 M53,69 v4'],
    ],
    ground: 'none',
    motes: { kind: 'feathers', colors: ['#e63b3b', '#ffd23f', '#2f7de0'] },
  },
  nic: {
    art: [
      ['b', 'M54,84 L74,46 Q80,42 86,46 L100,76 V84 Z'],
      ['a', 'M2,84 L34,28 Q38,24 42,28 L70,84 Z'],
      ['s', 'M29,29 Q28,20 38,20 Q48,20 47,29 Q38,32 29,29 Z'],
      ['t', 'M0,84 H100 M14,78 q2,-3 4,0 M22,80 q2,-3 4,0 M78,78 q2,-3 4,0 M88,80 q2,-3 4,0'],
      ['w', 'M27,90 V78 L35,90 Z'],
      ['a', 'M20,91 h16 l-2,3.6 h-12 Z'],
      ...waves(90, 44, 96),
      ...waves(98, 6, 94),
    ],
    ground: 'sea',
    motes: { kind: 'mist', colors: ['#f6f6f6', '#b4bcc2'] },
  },
  cri: {
    art: [
      ['d', 'M52,76 L58,94 L52,95 L48,78 Z'],
      ['d', 'M6,80 Q50,72 94,78 L94,82 Q50,77 6,85 Z'],
      ['a', 'M70,76 Q80,60 94,58 Q92,72 78,78 Z M22,78 Q14,64 4,62 Q6,74 18,82 Z'],
      ['t', 'M72,76 Q82,66 93,59 M21,79 Q13,70 5,63'],
      ['d', 'M44,40 Q58,38 62,52 Q64,66 54,78 L48,78 Q42,64 42,52 Z'],
      ['w', 'M43,42 Q52,42 54,52 Q52,60 46,60 Q42,52 43,42 Z'],
      ['d', 'M42,30 Q50,24 56,30 Q60,36 56,42 L44,44 Q40,38 42,30 Z'],
      ['w', 'M42,31 Q24,26 12,36 Q10,40 14,42 Q28,44 44,42 Z'],
      ['a', 'M12,36 Q10,40 14,42 L19,41.4 L18,35 Z'],
      ['t', 'M14,39 Q28,38.6 43,37'],
      ['w', circle(48.5, 33, 2.5)],
      ['c', circle(48.5, 33, 1.1)],
      ['t', 'M47,78 v4 M52,78 v4'],
    ],
    ground: 'none',
    motes: { kind: 'butterflies', colors: ['#2f9bff', '#6fc3ff'] },
  },
  pan: {
    art: [
      ...palm(9, 42, 74, 0.75),
      ['a', 'M0,92 V74 H22 V92 Z'],
      ['a', 'M78,92 V74 H100 V92 Z'],
      ['w', rect(82, 62, 12, 12)],
      ['d', 'M80,62 L88,54 L96,62 Z'],
      ['c', rect(86.5, 66, 3, 4)],
      ['l', 'M36,70 V48 M36,50 L47,62 M46,70 V56'],
      ['a', rect(31, 64, 11, 6)],
      ['w', rect(54, 58, 14, 12)],
      ['c', rects([56, 60, 64], 61, 2, 2.4)],
      ['w', rect(56, 52, 9, 6)],
      ['d', 'M58.6,52 L59.4,42 H63 L63.8,52 Z'],
      ['s', 'M62,40 Q58,34 64,32 Q66,26 74,30 Q82,28 80,36 Q76,40 68,38 Z'],
      ['a', 'M26,70 H76 L72,84 H30 Z'],
      ['t', 'M27.6,76 H74.4'],
      ...waves(89, 24, 78),
      ['t', 'M0,82 H22 M78,82 H100 M6,74 V92 M14,74 V92 M86,74 V92 M94,74 V92'],
    ],
    ground: 'none',
    motes: { kind: 'mist', colors: ['#ffffff', '#b6c4cc'] },
  },
  cub: {
    art: [
      ...sun(50, 18, 7),
      ...palm(18, 24, 84, 1),
      ...palm(84, 32, 84, 0.85),
      ['a', 'M10,68 L5,61 L17,66 Z'],
      ['a', 'M10,76 Q10,68 18,66 L32,64 Q38,52 50,52 H62 Q70,52 76,64 L86,66 Q92,68 92,76 L92,80 H10 Z'],
      ['w', 'M36,64 Q40,55 50,55 H54 V64 Z M57,55 H62 Q68,55 72,64 H57 Z'],
      ['t', 'M14,71 H88 M55.5,64 V79'],
      ['l', 'M7,79.5 H14 M88,79.5 H95'],
      ['w', circle(89.5, 71, 2)],
      ['d', circle(28, 81, 7.4)],
      ['w', circle(28, 81, 3.2)],
      ['d', circle(74, 81, 7.4)],
      ['w', circle(74, 81, 3.2)],
    ],
    motes: { kind: 'petals', colors: ['#ffffff', '#fff6e0'] },
  },
  hti: {
    art: [
      ...cloud(64, 16, 1),
      ['b', 'M0,92 L20,66 L36,58 L50,46 H78 L88,60 L100,72 V92 Z'],
      ['a', rect(60, 29, 14, 6)],
      ['d', 'M58,29 L67,22 L76,29 Z'],
      ['a', 'M30,56 L40,24 L52,34 H82 V56 Z'],
      ['d', 'M30,56 L40,24 L46,56 Z'],
      ['c', rects([54, 60, 66, 72], 40, 2.6, 2.6)],
      ['c', rects([51, 57, 63, 69, 75], 47.5, 2.6, 2.6)],
      ...roundTree(12, 90, 18, 6),
      ...roundTree(90, 90, 16, 5.5),
      ['t', 'M22,72 q3,-3 6,0 M70,66 q3,-3 6,0 M40,70 q3,-3 6,0 M56,76 q3,-3 6,0'],
    ],
    motes: { kind: 'petals', colors: ['#ff4f5e', '#ff8a8f', '#ffd0d0'] },
  },
  dom: {
    art: [
      ...sun(74, 30, 9),
      ['t', 'M44,58 H100'],
      ...birds(24, 18),
      ['b', 'M0,92 V84 Q30,78 60,86 Q80,90 100,88 V92 Z'],
      ['a', 'M22,90 Q24,70 38,50 Q42,44 48,40 L50,42 Q44,48 41,53 Q30,72 28,90 Z'],
      ...fronds(49, 40, 1.1),
      ['c', circle(46.6, 43.4, 1.6) + ' ' + circle(50.6, 44.4, 1.6)],
      ['l', 'M75,80 V60'],
      ['w', 'M75,61 L87,77 H75 Z'],
      ['a', 'M62,78 Q72,84 88,78 L86,82.5 Q74,87.5 64,82.5 Z'],
      ...waves(66, 52, 98),
      ...waves(72, 58, 98),
    ],
    ground: 'none',
    motes: { kind: 'glints', colors: ['#ffc84a', '#ffe6a0', '#ff9f2f'] },
  },

  // ---------------------------------------------------------------- South America
  col: {
    art: [
      ...cloud(60, 20, 1),
      ['b', 'M0,92 V72 Q20,58 40,68 Q60,54 80,64 Q92,58 100,64 V92 Z'],
      ...[[20, 76, 16], [34, 72, 24], [52, 68, 12], [70, 66, 22], [84, 70, 32]].flatMap(([x, base, top]): Shape[] => [
        ['l', P`M${x},${base} Q${x + 1.4},${(base + top) / 2} ${x},${top}`],
        ...fronds(x, top, 0.42),
      ]),
      ['w', rect(40, 80, 22, 12)],
      ['d', 'M37,81 L51,72 L65,81 Z'],
      ['c', rect(49, 85, 4, 7)],
      ['c', rects([43, 56], 84, 3, 3)],
      ['t', 'M4,86 h2 M10,84 h2 M16,86 h2 M22,84 h2 M28,86 h2 M70,86 h2 M76,84 h2 M82,86 h2 M88,84 h2 M94,86 h2'],
    ],
    motes: { kind: 'butterflies', colors: ['#ffe02f', '#fff27a'] },
  },
  ven: {
    art: [
      ...cloud(64, 20, 1),
      ...birds(22, 16),
      ['a', 'M10,92 L14,40 Q16,34 22,34 L40,32 L60,34 L80,32 Q86,33 87,40 L92,92 Z'],
      ['t', 'M24,38 V70 M34,36 V64 M66,37 V66 M76,36 V72 M18,50 V80 M84,48 V82'],
      ['w', 'M47,33 Q46,60 44,88 H56 Q54,60 53,33.4 Z'],
      ['t', 'M49,38 V84 M51,38 V84'],
      ['d', 'M0,92 Q4,82 10,84 Q14,78 20,84 Q26,80 30,88 L34,92 Z'],
      ['d', 'M66,92 L70,88 Q74,80 80,84 Q86,78 90,84 Q96,82 100,92 Z'],
      ['s', 'M34,89 Q32,80 42,80 Q46,74 54,78 Q62,74 64,82 Q70,84 66,90 Q50,95 34,89 Z'],
    ],
    motes: { kind: 'mist', colors: ['#ffffff', '#b3d0e4'] },
  },
  ecu: {
    art: [
      ['b', 'M10,92 L44,36 Q50,32 56,36 L90,92 Z'],
      ['w', 'M38.5,45 L44,36 Q50,32 56,36 L61.5,45 L56,43 L51,49 L46,43 Z'],
      ['t', 'M49,31 Q45,24 50,18'],
      ['a', 'M40,88 L38,92 H45.5 L46.5,87 Z M67,87 L68,92 H75.5 L74,88 Z'],
      ['a', 'M35,80 Q27,78 23,70 Q21,64 25,62 Q31,62 32,68 Q33,72 37,74 Z'],
      ['c', circle(26.4, 65.6, 0.9)],
      ['a', 'M34,84 Q36,62 57,60 Q78,62 80,84 Z'],
      ['t', 'M44,84 Q46,70 57,67 Q68,70 70,84 M57,60 V67 M39,72 L46.4,75 M75,72 L67.6,75 M50,84 L52,75 M64,84 L62,75'],
      ['d', 'M32,84 H82 L80,88 H34 Z'],
      ...grass([10, 18, 88]),
    ],
    motes: { kind: 'petals', colors: ['#ff5f7a', '#ffc23f', '#ffffff'] },
  },
  per: {
    art: [
      ['b', 'M0,92 V70 Q10,56 20,62 Q28,70 32,92 Z'],
      ['b', 'M64,92 Q70,66 78,52 Q84,48 88,56 Q94,74 100,92 Z'],
      ['b', 'M30,92 Q34,60 44,34 Q50,22 56,34 Q64,56 72,92 Z'],
      ['t', 'M38,58 q5,-3 10,0 t10,0 M70,64 q5,-3 10,0 t10,0'],
      ['a', 'M52,92 V84 H96 V92 Z'],
      ['a', 'M58,84 V77 H96 V84 Z'],
      ['a', 'M66,77 V71 H96 V77 Z'],
      ['w', 'M74,71 V64 L79,60 L84,64 V71 Z'],
      ['c', rect(77.6, 66, 2.8, 5)],
      ['a', 'M12,77 L12,91 H15 L16,78 Z M19,78 L19,91 H22 L22.5,78 Z M26,77 L26.5,91 H29.5 L30,76 Z'],
      ['w', 'M10,66 Q20,62 30,66 Q34,68 33,76 Q24,80 12,78 Q8,74 10,66 Z'],
      ['a', 'M10,66 Q6,66 6,71 Q8,71 10,69 Z'],
      ['w', 'M27,68 Q28,56 27,46 L26,42 L30,40 Q35,41 37,45 L37,48 L32,48 Q33,58 34,70 Z'],
      ['a', 'M27,42 L26,36 L29.5,40 Z M30,40 L31,35 L33,40.5 Z'],
      ['c', circle(32, 44, 0.8)],
      ['t', 'M14,70 q2,2 4,0 q2,2 4,0 q2,2 4,0 M15,75 q2,2 4,0 q2,2 4,0'],
    ],
    motes: { kind: 'seeds', colors: ['#f4dc8a', '#fff4c0'] },
  },
  bol: {
    art: [
      ...sun(86, 16, 6),
      ['b', 'M0,70 L16,44 L28,58 L44,34 L60,56 L74,42 L100,66 V72 H0 Z'],
      ['w', 'M44,34 L50,42.5 L45,41 L41.5,45 L38.5,41.6 Z M74,42 L79.5,48 L75,47.5 L71,51 L69.6,47.6 Z M16,44 L20.6,49.4 L16.4,49 L13.4,52.6 L12,50.4 Z'],
      ['l', 'M50,76 V24'],
      ['w', 'M34,29 H66 V62 H34 Z'],
      ['t', rules(range(35, 59, 6), 34, 66)],
      ['a', 'M10,72 Q14,62 8,54 Q14,56 20,66 Q50,80 80,66 Q86,56 92,54 Q86,62 90,72 Q80,84 50,86 Q20,84 10,72 Z'],
      ['t', 'M26,71.5 V82.5 M36,74.6 V85 M50,76 V86 M64,74.6 V85 M74,71.5 V82.5'],
      ['a', circle(8, 52, 3) + ' ' + circle(92, 52, 3)],
      ...waves(92, 4, 96),
      ...waves(98, 10, 90),
    ],
    ground: 'sea',
    motes: { kind: 'glints', colors: ['#ffffff', '#e6f6ff'] },
  },
  pry: {
    art: [
      ['t', range(31, 67, 4).map((x) => {
        const t = (x - 26) / 46;
        return P`M${x},${20.5 + 10 * Math.sin(Math.PI * t) * (0.55 + 0.45 * t)} V${86 - (x - 28) * 1.36}`;
      }).join(' ')],
      ['a', 'M71,25 L80,24 L35,90 L27,87 Z'],
      ['a', 'M22,17 L26.4,17 L27.4,88 L22.6,88 Z'],
      ['d', 'M21,18 Q22,9 31,11 Q39,13 46,20 Q58,31 72,22 Q78,19 81,24 Q79,29 73,28 Q58,37 44,26 Q36,19 28,20 Q24,21 21,18 Z'],
      ['a', 'M17,88 H41 L40,92 H18 Z'],
      ['t', 'M8,92 l-1.5,-5 M8,92 l1,-6 M8,92 l3,-4 M92,92 l-2,-5 M92,92 l1,-6 M92,92 l3.4,-4 M60,92 l-1.5,-4 M60,92 l1.6,-5'],
    ],
    motes: { kind: 'petals', colors: ['#ff8fc7', '#ffb8dc', '#ffd6ea'] },
  },
  chl: {
    art: [
      ...birds(10, 18),
      ['b', 'M0,92 Q30,78 60,84 Q80,80 100,86 V92 Z'],
      ...[[72, 92, 0.95, 0], [34, 92, 1.25, 1]].flatMap(([x, base, s, hat]): Shape[] => [
        ['a', P`M${x - 9 * s},${base} L${x - 8 * s},${base - 22 * s} Q${x - 9 * s},${base - 30 * s} ${x - 7 * s},${base - 44 * s} L${x - 6 * s},${base - 50 * s} H${x + 6 * s} L${x + 7 * s},${base - 44 * s} Q${x + 9 * s},${base - 30 * s} ${x + 8 * s},${base - 22 * s} L${x + 9 * s},${base} Z`],
        ['d', P`M${x - 7 * s},${base - 43 * s} H${x + 7 * s} L${x + 6.4 * s},${base - 38.5 * s} H${x - 6.4 * s} Z`],
        ['w', P`M${x - 1.7 * s},${base - 38.5 * s} L${x - 3.2 * s},${base - 26 * s} H${x + 3.2 * s} L${x + 1.7 * s},${base - 38.5 * s} Z`],
        ['l', P`M${x - 3.8 * s},${base - 20.5 * s} H${x + 3.8 * s}`],
        ['t', P`M${x - 8.2 * s},${base - 40 * s} V${base - 25 * s} M${x + 8.2 * s},${base - 40 * s} V${base - 25 * s} M${x - 6 * s},${base - 14 * s} Q${x},${base - 11 * s} ${x + 6 * s},${base - 14 * s}`],
        ...(hat ? [['d', P`M${x - 5 * s},${base - 50 * s} L${x - 5.6 * s},${base - 58 * s} H${x + 5.6 * s} L${x + 5 * s},${base - 50 * s} Z`] as Shape] : []),
      ]),
      ...grass([8, 54, 92]),
    ],
    motes: { kind: 'snow', colors: SNOW },
  },
  arg: {
    art: [
      ...sun(52, 20, 6),
      ['d', 'M22,92 Q28,76 26,62 H38 Q36,76 44,92 Z'],
      ['a', 'M2,60 Q4,40 22,36 Q30,26 44,34 Q58,32 60,48 Q64,58 54,62 Q40,68 26,64 Q10,68 2,60 Z'],
      ['l', 'M70,92 L76,40 L82,92'],
      ['t', 'M71.2,82 H80.8 M72.4,72 H79.6 M73.6,62 H78.4 M71.2,82 L79.6,72 M72.4,72 L78.4,62 M80.8,82 L72.4,72 M79.6,72 L73.6,62'],
      ['a', 'M76,36 L93,31 V41 Z'],
      ['w', circle(76, 36, 11)],
      ['t', Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        return P`M${76 + Math.cos(a) * 2},${36 + Math.sin(a) * 2} L${76 + Math.cos(a) * 11},${36 + Math.sin(a) * 11}`;
      }).join(' ')],
      ['c', circle(76, 36, 1.6)],
      ['l', bars([50, 58, 90, 97], 84, 92)],
      ['t', 'M50,86.5 H66 M50,89.5 H66 M86,86.5 H97 M86,89.5 H97'],
    ],
    motes: { kind: 'confetti', colors: ['#ffffff', '#9fd4ff', '#eaf6ff'] },
  },
  ury: {
    art: [
      ...sun(82, 18, 7),
      ...[[26, 92, 18, 40], [76, 92, 26, 44], [50, 92, 22, 50]].flatMap(([x, base, w, h]): Shape[] => [
        ['a', P`M${x - w * 0.4},${base} Q${x - w * 0.64},${base - h * 0.5} ${x - w * 0.5},${base - h} H${x + w * 0.5} Q${x + w * 0.64},${base - h * 0.5} ${x + w * 0.4},${base} Z`],
        ['t', P`M${x - w * 0.56},${base - h * 0.72} Q${x},${base - h * 0.66} ${x + w * 0.56},${base - h * 0.72} M${x - w * 0.55},${base - h * 0.26} Q${x},${base - h * 0.2} ${x + w * 0.55},${base - h * 0.26} M${x - w * 0.2},${base - h * 0.95} Q${x - w * 0.27},${base - h * 0.5} ${x - w * 0.17},${base - 1} M${x + w * 0.2},${base - h * 0.95} Q${x + w * 0.27},${base - h * 0.5} ${x + w * 0.17},${base - 1}`],
        ['w', ellipse(x, base - h, w * 0.5, w * 0.15)],
      ]),
      ['l', 'M52,39 L67,25'],
      ['c', circle(52.4, 38.6, 1.5)],
    ],
    motes: { kind: 'petals', colors: ['#e23b3b', '#ff7a6a', '#ffc2b8'] },
  },
  bra: {
    art: [
      ...sun(80, 22, 8),
      ['b', 'M54,92 Q60,56 73,52 Q88,57 96,92 Z'],
      ['a', 'M0,92 Q10,74 22,64 Q32,54 40,52 L52,52 Q60,58 66,72 L74,92 Z'],
      ['w', 'M43.5,30 H48.5 L49.5,52 H42.5 Z'],
      ['w', 'M30,31 H62 V34.5 H30 Z'],
      ['w', circle(46, 26.5, 3)],
      ...waves(98, 6, 94),
    ],
    motes: { kind: 'confetti', colors: ['#19a54a', '#ffd400', '#2f6fe0', '#ff5a7a', '#ffffff'] },
  },

  // ---------------------------------------------------------------- the two home spaces
  usa: {
    art: [
      ['l', 'M84,60 V44'],
      ['a', 'M84,44 h9 v5.4 h-9 Z'],
      ['a', rect(4, 66, 26, 22)],
      ['a', rect(70, 66, 26, 22)],
      ['t', bars([9, 14, 19, 25, 75, 81, 86, 91], 68, 86)],
      ['d', 'M8,66 L17,60 L26,66 Z M74,66 L83,60 L92,66 Z'],
      ['a', rect(30, 62, 40, 26)],
      ['w', rect(34, 66, 32, 18)],
      ['t', bars([38, 42, 46, 50, 54, 58, 62], 66, 84)],
      ['d', 'M32,66 L50,56 L68,66 Z'],
      ['a', 'M30,92 L34,86 H66 L70,92 Z'],
      ['a', rect(40, 44, 20, 14)],
      ['t', bars([43, 46.5, 50, 53.5, 57], 45, 57)],
      ['a', rect(38, 41, 24, 3)],
      ['w', 'M41,41 Q41,22 50,20 Q59,22 59,41 Z'],
      ['t', 'M45,41 Q45,26 50,21 M55,41 Q55,26 50,21 M50,41 V21'],
      ['a', rect(47.5, 13, 5, 7)],
      ['l', 'M50,13 V6'],
      ['c', circle(50, 5, 1.3)],
    ],
    motes: { kind: 'sparks', colors: ['#ff5a5a', '#ffffff', '#6fa8ff', '#ffd35a'] },
  },
  ussr: {
    art: [
      ['a', crenels(14, 86, 66, 10, 3, 92)],
      ['a', rect(22, 54, 8, 12)],
      ['a', rect(70, 54, 8, 12)],
      ['w', rect(41, 42, 18, 50)],
      ['a', 'M26,34 C31,41 35,46 35,49 C35,52 30,54 26,54 C22,54 17,52 17,49 C17,46 21,41 26,34 Z'],
      ['a', 'M74,34 C79,41 83,46 83,49 C83,52 78,54 74,54 C70,54 65,52 65,49 C65,46 69,41 74,34 Z'],
      ['d', 'M50,12 C57,23 63,30 63,35 C63,40 56,42 50,42 C44,42 37,40 37,35 C37,30 43,23 50,12 Z'],
      ['c', 'M46,92 V80 Q50,73 54,80 V92 Z'],
      ['c', arches([48.4], 60, 3.2, 6)],
      ['t', 'M50,12 V3 M48,6 H52 M26,34 V28 M24.6,30.2 H27.4 M74,34 V28 M72.6,30.2 H75.4'],
    ],
    motes: { kind: 'snow', colors: SNOW },
  },
};
