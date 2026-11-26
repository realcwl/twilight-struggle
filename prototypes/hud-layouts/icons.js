// Small glyphs for the meters, drawn on a 24 x 24 grid in the current text colour.
const f = (n) => Math.round(n * 100) / 100;
const pt = (cx, cy, r, deg) => `${f(cx + r * Math.cos((deg * Math.PI) / 180))},${f(cy + r * Math.sin((deg * Math.PI) / 180))}`;

function star(cx, cy, R, inner = 0.42) {
  let d = '';
  for (let i = 0; i < 10; i++) d += (i ? 'L' : 'M') + pt(cx, cy, i % 2 ? R * inner : R, -90 + i * 36);
  return d + 'Z';
}
// the three blades of the radiation sign
function trefoil(cx, cy, r0, r1) {
  let d = '';
  for (const a of [-120, 0, 120]) {
    const s = a + 60;
    const e = a + 120;
    d += `M${pt(cx, cy, r0, s)}L${pt(cx, cy, r1, s)}A${r1},${r1} 0 0 1 ${pt(cx, cy, r1, e)}L${pt(cx, cy, r0, e)}A${r0},${r0} 0 0 0 ${pt(cx, cy, r0, s)}Z`;
  }
  return d;
}

const PATHS = {
  vp: `<path d="${star(12, 12.6, 10.4)}"/>`,
  crisis: `<circle cx="12" cy="12" r="2.3"/><path d="${trefoil(12, 12, 4.1, 10.6)}"/>`,
  // two chevrons, as on a sleeve
  milops: '<path d="M3.2,9.4L12,3.6l8.8,5.8v4.1L12,7.7L3.2,13.5Z"/><path d="M3.2,16.6L12,10.8l8.8,5.800v4.1L12,14.900L3.200,20.700Z"/>',
  space: '<path d="M12,1.6c3.1,2.6 4.5,6.2 4.500,9.800l2.500,3.300v4.400l-3.800,-1.900h-6.400l-3.800,1.900v-4.400l2.500,-3.300c0,-3.600 1.400,-7.200 4.500,-9.800Z"/><circle cx="12" cy="9.300" r="1.9" fill="var(--icon-hole, #1b1510)"/><path d="M9.900,18.400h4.200l-2.100,4.200Z"/>',
  turn: '<path d="M5.200,2.400h13.600v2.200h-1.700c0,3.700 -1.800,5.600 -3.600,7.400c1.800,1.800 3.600,3.700 3.600,7.400h1.700v2.200H5.200v-2.200h1.700c0,-3.700 1.800,-5.600 3.600,-7.400c-1.800,-1.800 -3.600,-3.700 -3.600,-7.400H5.200Z"/>',
  deck: '<rect x="4.200" y="2.800" width="12.600" height="17" rx="1.800" opacity=".45"/><rect x="7.200" y="4.800" width="12.600" height="17" rx="1.800"/>',
  discard: '<path d="M6.600,2.600h10.800v9.600h3.200L12,20.400L3.400,12.200h3.200Z"/><rect x="3.400" y="21" width="17.200" height="1.800" rx=".9" opacity=".6"/>',
  removed: '<path d="M4.500,6.300L6.300,4.500L12,10.200L17.700,4.500L19.500,6.300L13.800,12L19.500,17.700L17.700,19.500L12,13.800L6.300,19.500L4.500,17.700L10.200,12Z"/>',
  hand: '<rect x="2.600" y="6.800" width="9.600" height="13.600" rx="1.500" transform="rotate(-14 7.400 13.600)" opacity=".5"/><rect x="7.200" y="5" width="9.600" height="13.600" rx="1.500" opacity=".75"/><rect x="11.800" y="6.800" width="9.600" height="13.600" rx="1.500" transform="rotate(14 16.600 13.600)"/>',
};

export const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${PATHS[name] ?? ''}</svg>`;
export const starPath = star;
