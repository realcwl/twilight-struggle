import './02-contact.css';

// a red grease-pencil ring, drawn by hand once: not quite closed, heavier where the stroke starts
const RING = '<svg class="c2-ring" viewBox="0 0 100 70" preserveAspectRatio="none"><path d="M12,36 C10,14 34,4 56,5 C80,6 94,18 92,36 C90,56 66,66 46,65 C24,64 9,54 13,30 C15,20 22,13 30,10"/></svg>';
const TICK = '<svg class="c2-tick" viewBox="0 0 20 20"><path d="M3,11 L8,16 L17,4"/></svg>';

/** The rounds as tally strokes: four upright, the fifth across them. */
function tally(rounds, round) {
  let out = '';
  let x = 4;
  for (let i = 1; i <= rounds; i++) {
    const cls = i < round ? 'done' : i === round ? 'now' : 'todo';
    if (i % 5 === 0) {
      out += `<path class="${cls}" d="M${x - 27},20 L${x - 1},6"/>`;
      x += 7;
    } else {
      const lean = (i % 3) - 1; // no two strokes quite alike
      out += `<path class="${cls}" d="M${x + lean},4 L${x - lean * 0.6},22"/>`;
      x += 6.5;
    }
  }
  // one unit of the drawing is 0.07rem, so the strokes keep their weight however many there are
  return `<svg class="c2-tally" viewBox="0 0 ${x + 2} 26" style="width:${((x + 2) * 0.07).toFixed(2)}rem;height:1.82rem">${out}</svg>`;
}

export default {
  id: '02',
  name: '印样',
  ref: '图片编辑桌上的一张印样',
  idea: '十个回合拍成一卷，印成一张印样。当前这格被红蜡笔圈出来，并且放大洗成了一张照片放在旁边；过去的打了勾，还没拍的是黑的。行动轮用蜡笔画“正”字那样的计数道。',
  read: [['年份', '左下的大数字；照片白边上手写着这张拍的是什么、哪几年'], ['回合', '印样上红圈圈住的那一格'], ['时期', '年份右边；早期的格子是黑白的，后期是彩色的'], ['行动轮', '蜡笔计数道：画到第几道就是第几轮'], ['谁行动', '右下角']],
  pros: ['十格全在眼前，又有一张够大的照片能看清画面', '红圈、对勾、计数道都是手画的记号，像真有人在这张纸上工作', '格子小也没关系：印样本来就是小的'],
  cons: ['是十组里最宽的之一', '印样上的小格只能当索引，看不出画的是什么'],
  mount(el, ctx) {
    const n = ctx.rules.turns;
    const half = Math.ceil(n / 2);
    const frame = (i) => `<div class="c2-f" data-turn="${i}">${ctx.pic(i)}<i>${i}</i>${TICK}</div>`;
    const strip = (from, to) => `<div class="c2-strip">${ctx.times(to - from + 1, (k) => frame(from + k))}</div>`;
    el.innerHTML =
      `<div class="c2-top"><div class="c2-sheet">${strip(1, half)}${strip(half + 1, n)}${RING}</div>` +
      `<div class="c2-print">${ctx.pic(1, 'c2-big')}<em><span data-t="title"></span><span class="c2-yr"></span></em></div></div>` +
      '<div class="c2-cap">' +
      '<b class="ep-year" data-t="year"></b>' +
      '<div class="c2-mid"><div><b class="ep-era" data-t="era"></b><span class="ep-meta" data-t="turn"></span></div><div><span class="ep-lb">行动轮</span><span class="c2-count"></span></div></div>' +
      '<div class="c2-ph"><b class="ep-head" data-t="head"></b><span class="ep-hint" data-t="hint"></span></div>' +
      '</div>';
    const cells = [...el.querySelectorAll('.c2-f')];
    const ring = el.querySelector('.c2-ring');
    const big = el.querySelector('.c2-big');
    const print = el.querySelector('.c2-print');
    return (v, prev) => {
      for (const f of cells) f.className = 'c2-f ' + ctx.state3(+f.dataset.turn, v.turn);
      // the ring rides on the frame it picks out, a little larger than it
      if (ring.parentElement !== cells[v.turn - 1]) cells[v.turn - 1].appendChild(ring);
      if (!prev || prev.turn !== v.turn) {
        ctx.setPic(big, v.turn);
        el.querySelector('.c2-yr').textContent = ctx.spanOf(v.turn);
        print.style.setProperty('--tilt', `${((v.turn * 37) % 5) - 2}deg`);
        if (prev) {
          ring.classList.remove('draw');
          print.classList.remove('drop');
          void ring.getBoundingClientRect();
          ring.classList.add('draw');
          print.classList.add('drop');
        }
      }
      el.querySelector('.c2-count').innerHTML = tally(v.rounds, v.round);
    };
  },
};
