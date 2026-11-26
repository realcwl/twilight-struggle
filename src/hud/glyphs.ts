// Pictograms for the meters: the things the numbers stand for. Flat silhouettes in one colour,
// drawn to be read at about 24 px. Three classes do all the work (see hud.css):
//   plain shapes are filled with the current colour
//   .s  a line in the current colour (antennae, legs, an orbit)
//   .k  a line in the background colour, to cut one shape out of another
import type { SideIndex, SpaceGlyph } from './types';

const f = (n: number): number => Math.round(n * 100) / 100;
const pt = (cx: number, cy: number, r: number, deg: number): string => `${f(cx + r * Math.cos((deg * Math.PI) / 180))},${f(cy + r * Math.sin((deg * Math.PI) / 180))}`;
/** A round hole, for a path with fill-rule evenodd. */
const hole = (cx: number, cy: number, r: number): string => `M${f(cx - r)},${cy}a${r},${r} 0 1 0 ${2 * r},0a${r},${r} 0 1 0 ${-2 * r},0Z`;

/** The three blades of the radiation sign. */
export function trefoil(cx: number, cy: number, r0: number, r1: number): string {
  let d = '';
  for (const a of [-120, 0, 120]) {
    const s = a + 60;
    const e = a + 120;
    d += `M${pt(cx, cy, r0, s)}L${pt(cx, cy, r1, s)}A${r1},${r1} 0 0 1 ${pt(cx, cy, r1, e)}L${pt(cx, cy, r0, e)}A${r0},${r0} 0 0 0 ${pt(cx, cy, r0, s)}Z`;
  }
  return d;
}

/* ------------------------------------------------------------------ armour */
// Two profiles on a 40 x 20 grid, both facing right. Side 0: a tall cast turret with a cupola and a
// bore evacuator halfway along the gun, six small road wheels. Side 1: a low dome set forward, a
// longer gun with the evacuator at the muzzle, five large road wheels and a fuel drum on the tail.
const track = (wheels: number[], r: number): string => `M6.3,12.3H33.7A3.2,3.2 0 0 1 33.7,18.7H6.3A3.2,3.2 0 0 1 6.3,12.3Z${wheels.map((x) => hole(x, 15.5, r)).join('')}`;
const TANKS = [
  `<path fill-rule="evenodd" d="${track([7.2, 12.3, 17.4, 22.6, 27.7, 32.8], 1.15)}"/>` +
    '<path d="M4.6,11.6L7.4,9H30.6L35.6,11.6Z"/>' +
    '<path d="M12.4,9C12.4,6 14.2,4.4 17.2,4.4H22.4C25.2,4.4 26.8,6.2 27.4,9Z"/>' +
    '<path d="M15.8,4.6V3.5Q15.8,2.8 16.5,2.8H19Q19.7,2.8 19.7,3.5V4.6Z"/>' +
    '<path d="M26.4,5.9H38.2V7.3H27Z"/><path d="M31,5.4h2.8v2.4h-2.8Z"/><path d="M37.6,5.3h1.7v2.6h-1.7Z"/>',
  `<path fill-rule="evenodd" d="${track([7.6, 13.8, 20, 26.2, 32.4], 1.5)}"/>` +
    '<path d="M4.2,11.6L6,9.7H33L36.4,11.6Z"/>' +
    '<path d="M14.2,9.7C14.6,6.5 17.4,5.1 20.4,5.1C23.4,5.1 26.2,6.5 26.6,9.7Z"/>' +
    '<path d="M25.6,6.7H39.6V8H26Z"/><path d="M35,6.2h2.9v2.3h-2.9Z"/>' +
    '<path d="M3.2,8h3.8v1.9h-3.8Z"/>',
];
export const tank = (side: SideIndex): string => `<svg class="gl gl-tank" viewBox="0 0 40 20" aria-hidden="true">${TANKS[side]}</svg>`;

/* ------------------------------------------------------------------ the space race */
/** A rocket in flight, nose to the right, for a marker on a track. */
export const rocket = (): string =>
  '<svg class="gl gl-rocket" viewBox="0 0 22 10" aria-hidden="true"><path d="M21.6,5C18.6,3.3 16,3 13,3H7.4L3.2,0.5V3.7L1.4,5L3.2,6.3V9.5L7.4,7H13C16,7 18.6,6.7 21.6,5Z"/></svg>';

const SPACE: Record<SpaceGlyph, string> = {
  animal: '<path d="M5,14L5,8 8,4 9,7 13,8 13,11 17,11 19,8 20,9 18,14 16,15 16,20 13,20 13,16 8,16 7,20 4,20Z"/><circle cx="9" cy="10" r=".8" fill="var(--gl-bg,#17120e)"/><path class="s" d="M2,5Q12,-1 21,7M21,7v-4"/>',
  'earth-orbit': '<circle class="s" cx="12" cy="12" r="6"/><path class="s" style="stroke-width:.8" d="M6,12h12M12,6C8,9 8,15 12,18C16,15 16,9 12,6Z"/><ellipse class="s" cx="12" cy="12" rx="11" ry="4" transform="rotate(-35 12 12)"/><circle cx="20" cy="6" r="2"/>',
  shuttle: '<path fill-rule="evenodd" d="M12,1C14,3 14.5,6 14.5,10L21,18V20L14,18 14,22 10,22 10,18 3,20V18L9.5,10C9.5,6 10,3 12,1ZM10.6,7V9H13.4V7Z"/>',
  rocket:
    `<path fill-rule="evenodd" d="M12,1.6C14.4,4.2 15.2,7.4 15.2,10.8V16.2H8.8V10.8C8.8,7.4 9.6,4.2 12,1.6Z${hole(12, 8.2, 1.5)}"/>` +
    '<path d="M8.8,12.2L5.2,17.2V19.6L8.8,18.2Z"/><path d="M15.2,12.2L18.8,17.2V19.6L15.2,18.2Z"/><path d="M10.2,17.5H13.8L12,22.4Z"/>',
  satellite: '<circle cx="8.8" cy="8.8" r="5"/><path class="s" d="M13.3,9.4L22.2,10.7M12.7,11.1L20.5,15.6M11.2,12.6L16,20.3M9.4,13.3L10.7,22.2"/>',
  capsule:
    `<path fill-rule="evenodd" d="M12,2.6C13.3,2.6 14.2,3.3 14.7,4.5L19,15.2C19.5,16.4 18.8,17.4 17.6,17.4H6.4C5.2,17.4 4.5,16.4 5,15.2L9.3,4.5C9.8,3.3 10.7,2.6 12,2.6Z${hole(12, 10.6, 2.1)}"/>` +
    '<path d="M5,18.8H19C18.2,20.6 15.6,21.6 12,21.6C8.4,21.6 5.8,20.6 5,18.8Z"/>',
  spacewalk:
    '<circle cx="13.8" cy="5.8" r="3.5"/>' +
    '<path class="s" style="stroke-width:5.2" d="M12.4,10.6L10.6,14.4"/>' +
    '<path class="s" style="stroke-width:2.5" d="M13.2,10.8L18.2,12.8M11,9.8L6.4,7.6M10.2,15L6.8,19.6M10.8,15.4L12.8,20.6"/>' +
    '<path class="s" style="stroke-width:1" d="M13,13.6C16.6,14.6 16,19.4 22,20.2"/>',
  docking:
    '<path d="M1.6,9.2H7.4L10.8,10.9V13.1L7.4,14.8H1.6Z"/><path d="M3.4,4.6h2.6v3.4h-2.6ZM3.4,16h2.6v3.4h-2.6Z"/>' +
    '<path d="M22.4,8H15.6V10.4H13.2V13.6H15.6V16H22.4Z"/><path class="s" style="stroke-width:1" d="M18.9,8V4.2M18.9,16V19.8"/>',
  'lunar-orbit':
    `<path fill-rule="evenodd" d="${hole(12, 12, 4.5)}${hole(10.6, 10.8, 1.05)}${hole(13.6, 13.4, 0.75)}"/>` +
    '<ellipse class="s" style="stroke-width:1.1" cx="12" cy="12" rx="10.6" ry="6" transform="rotate(-24 12 12)"/>' +
    '<circle cx="21.2" cy="7.2" r="1.8"/>',
  landing:
    `<path fill-rule="evenodd" d="M9,6.4H15L17.2,9V12.2L15,14H9L6.8,12.2V9Z${hole(12, 10.1, 1.5)}"/>` +
    '<path d="M10.4,14H13.6L14.7,16.8H9.3Z"/>' +
    '<path class="s" d="M7.6,13.4L4.6,18.8M16.4,13.4L19.4,18.8M2.9,19H6.3M17.7,19H21.1M12,6.4V3.4M9.9,3.2H14.1"/>' +
    '<path class="s" style="stroke-width:1" d="M1.4,22.2Q12,20.2 22.6,22.2"/>',
  station:
    '<path d="M1.4,6.4H6.8V17.6H1.4ZM17.2,6.4H22.6V17.6H17.2Z"/>' +
    '<path class="k" style="stroke-width:0.9" d="M1.4,10.1H6.8M1.4,13.9H6.8M17.2,10.1H22.6M17.2,13.9H22.6"/>' +
    '<path d="M6.8,11.2H17.2V12.8H6.8Z"/><path d="M10.9,2.8H13.1V21.2H10.9Z"/><path d="M9.2,8.8H14.8V15.2H9.2Z"/>',
};
export const spaceGlyph = (name: SpaceGlyph): string => `<svg class="gl" viewBox="0 0 24 24" aria-hidden="true">${SPACE[name]}</svg>`;

/** Three cards held in a fan, for the way to all of them. */
export const fanGlyph = (): string =>
  '<svg class="gl gl-fan" viewBox="0 0 24 24" aria-hidden="true">' +
  '<rect x="8" y="4.5" width="8" height="12" rx="1.3" transform="rotate(-24 12 21.5)" opacity="0.55"/>' +
  '<rect x="8" y="4.5" width="8" height="12" rx="1.3" transform="rotate(24 12 21.5)" opacity="0.55"/>' +
  '<rect class="k" x="8" y="4.5" width="8" height="12" rx="1.3"/><rect x="8" y="4.5" width="8" height="12" rx="1.3"/></svg>';

/** A cross, for the pile of cards that are out of the game. */
export const crossGlyph = (): string =>
  '<svg class="gl" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5,6.3L6.3,4.5L12,10.2L17.7,4.5L19.5,6.3L13.8,12L19.5,17.7L17.7,19.5L12,13.8L6.3,19.5L4.5,17.7L10.2,12Z"/></svg>';
