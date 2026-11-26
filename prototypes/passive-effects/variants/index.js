// The ten displays, in the order of the toolbar. Each is loaded when it is first shown, so a page
// that is looking at one never depends on the files of another. (The path is worked out at run
// time on purpose: the dev server then does not go looking for all ten files up front.)
const here = import.meta.url.replace(/[^/]*$/, '');
const lazy = (file) => () => import(/* @vite-ignore */ here + file);

export const VARIANTS = [
  { id: '01', name: '生效区', load: lazy('01-shelf.js') },
  { id: '02', name: '档案签', load: lazy('02-tabs.js') },
  { id: '03', name: '勋章', load: lazy('03-medals.js') },
  { id: '04', name: '就地标记', load: lazy('04-insitu.js') },
  { id: '05', name: '有效期', load: lazy('05-calendar.js') },
  { id: '06', name: '压角', load: lazy('06-tucked.js') },
  { id: '07', name: '对坐', load: lazy('07-sides.js') },
  { id: '08', name: '常设指令', load: lazy('08-orders.js') },
  { id: '09', name: '一枚印', load: lazy('09-seal.js') },
  { id: '10', name: '连线', load: lazy('10-threads.js') },
];
