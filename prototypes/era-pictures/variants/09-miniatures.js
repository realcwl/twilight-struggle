import './09-miniatures.css';

const polar = (r, deg) => [50 + r * Math.sin((deg * Math.PI) / 180), 50 - r * Math.cos((deg * Math.PI) / 180)].map((x) => x.toFixed(2)).join(',');

/** The rounds as a broken ring round the current miniature, starting at twelve o'clock. */
function ring(rounds, round, state3) {
  const gap = 7;
  const each = (360 - gap * rounds) / rounds;
  let out = '';
  for (let i = 0; i < rounds; i++) {
    const a0 = gap / 2 + i * (each + gap);
    out += `<path class="${state3(i + 1, round)}" d="M${polar(47, a0)}A47,47 0 0 1 ${polar(47, a0 + each)}"/>`;
  }
  return out;
}

export default {
  id: '09',
  name: '小像章',
  ref: '一串镶在金圈里的微型画',
  idea: '每个回合是一枚金圈小像，十枚串成一串，三个时期之间留一道空。当前这枚放大到跟前，离它越远的越小；过去的还看得见，没到的蒙着。当前这枚外面的一圈弧线是行动轮。',
  read: [['年份', '下面的大数字'], ['回合', '最大的那一枚；它在这一串里的位置就是第几回合'], ['时期', '年份右边；这一串分成三段，中间的空就是时期的分界'], ['行动轮', '大圆外面那一圈弧线：亮到第几段就是第几轮'], ['谁行动', '右下角；弧线亮的那一段也是行动方的颜色']],
  pros: ['最直接地回答了“每个年代一个图标”：十枚像章就是十个图标', '金圈、深色漆面，和其它三个角是同一种东西，换上去最不突兀', '行动轮画在像章的圈上，不另占一行'],
  cons: ['圆形裁掉了画面的四角，横幅的画面损失最多', '两头的小像只有二十来像素，只能数个数'],
  mount(el, ctx) {
    const groups = ctx.rules.eras
      .map((e) => `<div class="m9-g" data-era="${e.id}">${ctx.times(e.to - e.from + 1, (k) => `<div class="m9-m" data-turn="${e.from + k}"><span class="m9-in">${ctx.pic(e.from + k)}<i></i></span><b>${e.from + k}</b></div>`)}</div>`)
      .join('');
    el.innerHTML =
      `<div class="m9-rail"><i class="m9-chain"></i>${groups}<svg class="m9-ring" viewBox="0 0 100 100"></svg></div>` +
      '<div class="ep-cap"><b class="ep-year" data-t="year"></b>' +
      '<div class="ep-cap-mid"><div><b class="ep-era" data-t="era"></b><span class="ep-meta" data-t="turn"></span></div><div><span class="ep-meta m9-rd" data-t="round"></span></div></div>' +
      '<div class="ep-cap-ph"><b class="ep-head" data-t="head"></b><span class="ep-hint" data-t="hint"></span></div></div>';
    const ms = [...el.querySelectorAll('.m9-m')];
    const svg = el.querySelector('.m9-ring');
    return (v) => {
      for (const m of ms) {
        const t = +m.dataset.turn;
        m.className = `m9-m ${ctx.state3(t, v.turn)} d${Math.min(3, Math.abs(t - v.turn))}`;
      }
      const now = ms[v.turn - 1];
      if (svg.parentElement !== now) now.appendChild(svg);
      svg.innerHTML = ring(v.rounds, v.round, ctx.state3);
    };
  },
};
