// The ten variants, in the order of the toolbar. Each is loaded when it is first shown, so a page
// that is looking at one variant never depends on the files of another. (The path is worked out at
// run time on purpose: the dev server then does not go looking for all ten files up front.)
const here = import.meta.url.replace(/[^/]*$/, '');
const lazy = (file) => () => import(/* @vite-ignore */ here + file);

export const VARIANTS = [
  { id: '01', name: '岔路口', load: lazy('01-fork.js') },
  { id: '02', name: '落点即选择', load: lazy('02-drop.js') },
  { id: '03', name: '行动令', load: lazy('03-order.js') },
  { id: '04', name: '聚光灯', load: lazy('04-spotlight.js') },
  { id: '05', name: '指令环', load: lazy('05-ring.js') },
  { id: '06', name: '电传打字机', load: lazy('06-teleprinter.js') },
  { id: '07', name: '筹码与骰盅', load: lazy('07-chips.js') },
  { id: '08', name: '因果链', load: lazy('08-chain.js') },
  { id: '09', name: '沙盘推演', load: lazy('09-wargame.js') },
  { id: '10', name: '对局桌', load: lazy('10-duel.js') },
];
