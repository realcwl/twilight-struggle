import type { SpaceAbilityId } from './types';

let serial = 0;
/** Small cast-gold mission orders with faction enamel; no raster dependency at HUD scale. */
export function spaceEmblem(kind: SpaceAbilityId): string {
  const id = `space-order-${++serial}`;
  const symbols: Record<SpaceAbilityId, string> = {
    'two-attempts': '<path d="M29,27Q36,33 34,44L29,49 24,44Q22,33 29,27ZM46,22Q53,28 51,39L46,44 41,39Q39,28 46,22Z"/><path d="M25,47L29,55 33,47M42,42L46,50 50,42"/><path fill="none" stroke-width="1.5" d="M18,48Q14,57 33,57Q53,57 59,40"/>',
    headline: '<path fill="none" stroke-width="2" d="M27,26L51,23 54,49 30,52Z M21,31L25,56 47,53"/><path d="M26,39Q39,24 52,36Q39,51 26,39Z"/><circle cx="39" cy="38" r="4.5" fill="#18242d"/><circle cx="40" cy="37" r="1.5" fill="#fff1c4"/>',
    'discard-held': '<path fill="none" stroke-width="2" d="M25,25H45V50H25Z M29,30H41 M29,35H39"/><path d="M38,54Q54,49 55,36L49,40 57,25 62,42 58,38Q58,54 40,59Z"/><path d="M30,42L35,37 40,42 35,47Z"/>',
    'eight-rounds': '<path fill="none" stroke-width="1.5" d="M40,20L54,27 59,41 52,55 40,61 26,55 21,41 27,27Z"/><path fill-rule="evenodd" d="M40,26C29,26 29,38 35,40C26,43 29,55 40,55C51,55 54,43 45,40C51,38 51,26 40,26ZM40,30C45,30 45,37 40,37C35,37 35,30 40,30ZM40,43C46,43 46,51 40,51C34,51 34,43 40,43Z"/>',
  };
  return `<svg class="so-order" viewBox="0 0 80 86" aria-hidden="true">
    <defs><linearGradient id="${id}-gold" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#fff2bd"/><stop offset=".27" stop-color="#d4ae59"/><stop offset=".48" stop-color="#83602c"/><stop offset=".65" stop-color="#f5d88b"/><stop offset="1" stop-color="#976c30"/></linearGradient><linearGradient id="${id}-enamel" x2=".7" y2="1"><stop stop-color="var(--c)"/><stop offset="1" stop-color="#10171f"/></linearGradient></defs>
    <path d="M10,20L40,8 70,20V45Q70,66 40,82Q10,66 10,45Z" fill="#080807" opacity=".65" transform="translate(0 3)"/>
    <g fill="url(#${id}-gold)"><path d="M10,19L40,7 70,19V45Q70,66 40,81Q10,66 10,45Z"/>
    <path d="M8,34Q0,27 2,23Q11,25 11,34M7,44Q-1,39 1,34Q10,35 11,43M10,55Q0,52 1,46Q10,46 14,54M17,65Q6,66 4,59Q14,56 21,64M72,34Q80,27 78,23Q69,25 69,34M73,44Q81,39 79,34Q70,35 69,43M70,55Q80,52 79,46Q70,46 66,54M63,65Q74,66 76,59Q66,56 59,64"/></g>
    <path d="M14,22L40,12 66,22V44Q66,62 40,75Q14,62 14,44Z" fill="url(#${id}-enamel)" stroke="#1c160d" stroke-width="1.4"/>
    <path d="M17,24L40,15 63,24" stroke="#fff4c7" opacity=".35" fill="none"/>
    <path d="M15,43Q34,29 65,31V23L40,13 15,23Z" fill="#fff" opacity=".05"/>
    <g fill="url(#${id}-gold)" stroke="url(#${id}-gold)" stroke-width=".4" stroke-linejoin="round">${symbols[kind]}</g>
    <path d="M34,6L40,2 46,6 40,10Z" fill="url(#${id}-gold)"/><circle cx="40" cy="66" r="1.6" fill="#f8dc97"/>
  </svg>`;
}
