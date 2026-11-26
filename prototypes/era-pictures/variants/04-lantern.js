import './04-lantern.css';

export default {
  id: '04',
  name: '走马灯',
  ref: '一盏会转的十面灯',
  idea: '十个回合是一盏灯的十个面，灯从里面亮着。正对你的那一面是现在；刚过去的转到了左边，还看得见；要来的在右边的暗处。每过一个回合，灯转一面。',
  read: [['年份', '灯下面的大数字'], ['回合', '正面那一幅；面的左上角有序号'], ['时期', '年份右边'], ['行动轮', '一排圆点'], ['谁行动', '右下角']],
  pros: ['“往事像走马灯”：这个比喻中文玩家不用解释', '是十组里唯一有纵深的：换回合时整盏灯转过去，动作最好看', '正面一幅够大，左右各露出两幅，前后文都在'],
  cons: ['侧面的画是斜的，只能认个大概', '灯是东方的物件，放在冷战题材里是借喻，不是那个年代的器材'],
  mount(el, ctx) {
    const n = ctx.rules.turns;
    el.style.setProperty('--n', n);
    el.innerHTML =
      '<div class="l4-stage"><i class="l4-glow"></i>' +
      `<div class="l4-drum">${ctx.times(n, (i) => `<div class="l4-p" data-turn="${i + 1}" style="--k:${i}">${ctx.pic(i + 1)}<b>${i + 1}</b></div>`)}</div>` +
      '</div>' +
      ctx.cap();
    const panes = [...el.querySelectorAll('.l4-p')];
    let spin = null; // how far the lamp has turned, so it never turns back the long way
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
      for (const p of panes) {
        let d = +p.dataset.turn - v.turn;
        if (d > n / 2) d -= n;
        if (d < -n / 2) d += n;
        p.dataset.d = String(Math.max(-3, Math.min(3, d)));
        // a face that has come round from the other end of the game is not "the future"
        p.classList.toggle('past', +p.dataset.turn < v.turn);
        p.classList.toggle('next', +p.dataset.turn > v.turn);
      }
      void prev;
    };
  },
};
