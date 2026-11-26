import './08-reel.css';

export default {
  id: '08',
  name: '画片转盘',
  ref: '立体镜里那张一圈小画片的圆盘',
  idea: '现在这个回合转盘原地升级：盘沿上不再是十段金线，而是十张小画片；盘心的圆窗放着当前这张。每过一个回合，圆盘转一格，新的一张转到顶上的金色指针下面。右边还是现在主干那几行字，只多了年份。',
  read: [['年份', '右边的大数字'], ['回合', '转到顶上指针下面的那张小画片；盘心是它的放大'], ['时期', '年份旁边；盘沿外圈的三段弧线是三个时期'], ['行动轮', '右下一排圆点，和现在主干的一样'], ['谁行动', '右上，和现在主干的一样']],
  pros: ['改动最小：占地、布局、读法都和现在的转盘一样，并进主干最省事', '盘心有了一张真的画，时代不再只是“早期”两个字', '圆盘转一格的动作干脆'],
  cons: ['盘心的圆窗比别的几组小，写实画面被裁成圆形', '盘沿的小画片只有二十几像素，只能当色块看'],
  mount(el, ctx) {
    const n = ctx.rules.turns;
    // three arcs round the rim, one an era, with a gap where an era ends
    const arcs = ctx.rules.eras.map((e) => {
      const a0 = (e.from - 1.5) * 36 + 4;
      const a1 = (e.to - 0.5) * 36 - 4;
      const p = (deg) => [50 + 48.4 * Math.sin((deg * Math.PI) / 180), 50 - 48.4 * Math.cos((deg * Math.PI) / 180)].map((x) => x.toFixed(2)).join(',');
      return `<path data-era="${e.id}" d="M${p(a0)}A48.4,48.4 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)}"/>`;
    }).join('');
    el.innerHTML =
      '<div class="r8-disc"><div class="r8-wheel">' +
      `<svg class="r8-arcs" viewBox="0 0 100 100">${arcs}</svg>` +
      ctx.times(n, (i) => `<div class="r8-c" data-turn="${i + 1}" style="--k:${i}">${ctx.pic(i + 1)}<b>${i + 1}</b></div>`) +
      `</div><div class="r8-eye">${ctx.pic(1, 'on')}${ctx.pic(1)}<i></i></div><i class="r8-mark"></i></div>` +
      '<div class="r8-side">' +
      '<div class="r8-ph"><b class="ep-head" data-t="head"></b><span class="ep-hint" data-t="hint"></span></div>' +
      '<div class="r8-yr"><b class="ep-year" data-t="year"></b><div><b class="ep-era" data-t="era"></b><span class="ep-meta" data-t="turn"></span></div></div>' +
      '<div class="r8-rd"><span class="ep-lb">行动轮</span><span class="ep-pips" data-t="pips"></span></div>' +
      '</div>';
    const chips = [...el.querySelectorAll('.r8-c')];
    const eye = [...el.querySelectorAll('.r8-eye .ep-pic')];
    const arcEls = [...el.querySelectorAll('.r8-arcs path')];
    let spin = null;
    let front = 0;
    return (v, prev) => {
      const at = v.turn - 1;
      if (spin === null) spin = at;
      else {
        let step = at - (((spin % n) + n) % n);
        if (step > n / 2) step -= n;
        if (step < -n / 2) step += n;
        spin += step;
      }
      el.style.setProperty('--i', spin);
      for (const c of chips) c.className = 'r8-c ' + ctx.state3(+c.dataset.turn, v.turn);
      for (const a of arcEls) a.classList.toggle('now', a.dataset.era === v.era.id);
      if (!prev) ctx.setPic(eye[front], v.turn);
      else if (prev.turn !== v.turn) {
        // the new picture fades in over the old one
        front = 1 - front;
        ctx.setPic(eye[front], v.turn);
        eye[front].classList.add('on');
        eye[1 - front].classList.remove('on');
      }
    };
  },
};
