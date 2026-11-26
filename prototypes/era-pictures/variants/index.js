// The ten displays, in the order of the number keys. Loaded when first shown.
export const VARIANTS = [
  { id: '01', name: '胶片', load: () => import('./01-film.js') },
  { id: '02', name: '印样', load: () => import('./02-contact.js') },
  { id: '03', name: '幻灯片', load: () => import('./03-slides.js') },
  { id: '04', name: '走马灯', load: () => import('./04-lantern.js') },
  { id: '05', name: '显影', load: () => import('./05-darkroom.js') },
  { id: '06', name: '监视墙', load: () => import('./06-monitors.js') },
  { id: '07', name: '长卷', load: () => import('./07-scroll.js') },
  { id: '08', name: '画片转盘', load: () => import('./08-reel.js') },
  { id: '09', name: '小像章', load: () => import('./09-miniatures.js') },
  { id: '10', name: '取景器', load: () => import('./10-finder.js') },
];
