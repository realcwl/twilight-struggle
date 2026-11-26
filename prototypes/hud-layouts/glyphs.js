// Pictograms for the fine meters: the things the numbers stand for. Flat silhouettes, one colour,
// drawn to be read at about 24 px. Three classes do all the work (see fine.css):
//   plain shapes are filled with the current colour
//   .s  a line in the current colour (antennae, legs, an orbit)
//   .k  a line in the background colour, to cut one shape out of another
const f = (n) => Math.round(n * 100) / 100;
const pt = (cx, cy, r, deg) => `${f(cx + r * Math.cos((deg * Math.PI) / 180))},${f(cy + r * Math.sin((deg * Math.PI) / 180))}`;
/** A round hole, for a path with fill-rule evenodd. */
const hole = (cx, cy, r) => `M${f(cx - r)},${cy}a${r},${r} 0 1 0 ${2 * r},0a${r},${r} 0 1 0 ${-2 * r},0Z`;

/** The three blades of the radiation sign. */
export function trefoil(cx, cy, r0, r1) {
  let d = '';
  for (const a of [-120, 0, 120]) {
    const s = a + 60;
    const e = a + 120;
    d += `M${pt(cx, cy, r0, s)}L${pt(cx, cy, r1, s)}A${r1},${r1} 0 0 1 ${pt(cx, cy, r1, e)}L${pt(cx, cy, r0, e)}A${r0},${r0} 0 0 0 ${pt(cx, cy, r0, s)}Z`;
  }
  return d;
}

/* ------------------------------------------------------------------ armour */
// Two profiles on a 40 x 20 grid, both facing right. Side a: a tall cast turret with a cupola and a
// bore evacuator halfway along the gun, six small road wheels. Side b: a low dome set forward, a
// longer gun with the evacuator at the muzzle, five large road wheels and a fuel drum on the tail.
const track = (wheels, r) => `M6.3,12.3H33.7A3.2,3.2 0 0 1 33.7,18.7H6.3A3.2,3.2 0 0 1 6.3,12.3Z${wheels.map((x) => hole(x, 15.5, r)).join('')}`;
const TANKS = {
  a:
    `<path fill-rule="evenodd" d="${track([7.2, 12.3, 17.4, 22.6, 27.7, 32.8], 1.15)}"/>` +
    '<path d="M4.6,11.6L7.4,9H30.6L35.6,11.6Z"/>' +
    '<path d="M12.4,9C12.4,6 14.2,4.4 17.2,4.4H22.4C25.2,4.4 26.8,6.2 27.4,9Z"/>' +
    '<path d="M15.8,4.6V3.5Q15.8,2.8 16.5,2.8H19Q19.7,2.8 19.7,3.5V4.6Z"/>' +
    '<path d="M26.4,5.9H38.2V7.3H27Z"/><path d="M31,5.4h2.8v2.4h-2.8Z"/><path d="M37.6,5.3h1.7v2.6h-1.7Z"/>',
  b:
    `<path fill-rule="evenodd" d="${track([7.6, 13.8, 20, 26.2, 32.4], 1.5)}"/>` +
    '<path d="M4.2,11.6L6,9.7H33L36.4,11.6Z"/>' +
    '<path d="M14.2,9.7C14.6,6.5 17.4,5.1 20.4,5.1C23.4,5.1 26.2,6.5 26.6,9.7Z"/>' +
    '<path d="M25.6,6.7H39.6V8H26Z"/><path d="M35,6.2h2.9v2.3h-2.9Z"/>' +
    '<path d="M3.2,8h3.800v1.9h-3.800Z"/>',
};
export const tank = (side, cls = '') => `<svg class="gl tk ${cls}" viewBox="0 0 40 20" aria-hidden="true">${TANKS[side]}</svg>`;

/* ------------------------------------------------------------------ the space race */
/** A rocket in flight, nose to the right, for a marker on a track. */
export const rocket = (cls = '') =>
  `<svg class="gl rk ${cls}" viewBox="0 0 22 10" aria-hidden="true"><path d="M21.6,5C18.6,3.3 16,3 13,3H7.4L3.2,0.5V3.7L1.4,5L3.2,6.3V9.5L7.4,7H13C16,7 18.6,6.7 21.6,5Z"/></svg>`;

// Eight things that were firsts, in the order they happened. Names only: what a step is worth is a
// rules question and is not decided here.
const STEPS = [
  {
    name: '探空火箭',
    art:
      `<path fill-rule="evenodd" d="M12,1.6C14.4,4.2 15.2,7.4 15.2,10.8V16.2H8.8V10.8C8.8,7.4 9.6,4.2 12,1.6Z${hole(12, 8.2, 1.5)}"/>` +
      '<path d="M8.8,12.2L5.2,17.2V19.6L8.8,18.2Z"/><path d="M15.2,12.2L18.800,17.2V19.6L15.2,18.2Z"/><path d="M10.2,17.5H13.8L12,22.4Z"/>',
  },
  {
    name: '人造卫星',
    art: '<circle cx="8.8" cy="8.8" r="5"/><path class="s" d="M13.3,9.4L22.2,10.7M12.7,11.1L20.5,15.6M11.2,12.6L16,20.3M9.4,13.3L10.7,22.2"/>',
  },
  {
    name: '载人飞船',
    art:
      `<path fill-rule="evenodd" d="M12,2.6C13.3,2.6 14.2,3.3 14.7,4.500L19,15.2C19.5,16.4 18.800,17.4 17.6,17.4H6.4C5.2,17.4 4.5,16.4 5,15.2L9.300,4.500C9.800,3.300 10.7,2.6 12,2.6Z${hole(12, 10.6, 2.1)}"/>` +
      '<path d="M5,18.8H19C18.2,20.6 15.6,21.6 12,21.6C8.4,21.6 5.8,20.6 5,18.8Z"/>',
  },
  {
    name: '太空行走',
    art:
      '<circle cx="13.8" cy="5.800" r="3.500"/>' +
      '<path class="s" style="stroke-width:5.200" d="M12.4,10.6L10.6,14.4"/>' +
      '<path class="s" style="stroke-width:2.500" d="M13.2,10.8L18.2,12.8M11,9.800L6.4,7.6M10.2,15L6.800,19.6M10.800,15.4L12.800,20.6"/>' +
      '<path class="s" style="stroke-width:1" d="M13,13.6C16.6,14.6 16,19.4 22,20.2"/>',
  },
  {
    name: '轨道对接',
    art:
      '<path d="M1.6,9.2H7.4L10.800,10.9V13.1L7.4,14.8H1.6Z"/><path d="M3.4,4.6h2.6v3.400h-2.600ZM3.400,16h2.6v3.4h-2.600Z"/>' +
      '<path d="M22.4,8H15.6V10.4H13.2V13.6H15.600V16H22.400Z"/><path class="s" style="stroke-width:1" d="M18.900,8V4.2M18.900,16V19.800"/>',
  },
  {
    name: '绕月飞行',
    art:
      `<path fill-rule="evenodd" d="${hole(12, 12, 4.5)}${hole(10.6, 10.800, 1.05)}${hole(13.6, 13.4, 0.75)}"/>` +
      '<ellipse class="s" style="stroke-width:1.1" cx="12" cy="12" rx="10.6" ry="6" transform="rotate(-24 12 12)"/>' +
      '<circle cx="21.2" cy="7.2" r="1.8"/>',
  },
  {
    name: '载人登月',
    art:
      `<path fill-rule="evenodd" d="M9,6.4H15L17.2,9V12.2L15,14H9L6.800,12.2V9Z${hole(12, 10.1, 1.5)}"/>` +
      '<path d="M10.4,14H13.6L14.700,16.800H9.300Z"/>' +
      '<path class="s" d="M7.6,13.4L4.6,18.800M16.4,13.4L19.4,18.800M2.900,19H6.300M17.700,19H21.1M12,6.400V3.4M9.900,3.2H14.1"/>' +
      '<path class="s" style="stroke-width:1" d="M1.4,22.2Q12,20.2 22.6,22.2"/>',
  },
  {
    name: '空间站',
    art:
      '<path d="M1.4,6.4H6.800V17.600H1.400ZM17.200,6.400H22.600V17.600H17.200Z"/>' +
      '<path class="k" style="stroke-width:0.9" d="M1.4,10.1H6.8M1.4,13.900H6.8M17.2,10.1H22.6M17.2,13.900H22.6"/>' +
      '<path d="M6.800,11.2H17.200V12.800H6.800Z"/><path d="M10.9,2.800H13.1V21.200H10.900Z"/><path d="M9.2,8.800H14.800V15.200H9.200Z"/>',
  },
];
export const SPACE_STEPS = STEPS.map((s) => s.name);
export const spaceStep = (i, cls = '') => `<svg class="gl ${cls}" viewBox="0 0 24 24" aria-hidden="true">${STEPS[i]?.art ?? ''}</svg>`;
