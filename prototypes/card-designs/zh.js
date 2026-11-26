// Shared Chinese game vocabulary. Escape plain input before highlighting; keep complete terms intact.
(function () {
  const terms = ['核战危机等级','所需军事行动点','军事行动点','调整阵营','太空竞赛','最终计分','头条阶段','非战场国家','战场国家','非计分牌','计分牌','行动点','行动轮','影响力','胜利点','稳定度','紧张度','声望','政变','支配','存在','控制','计分','结算','手牌','弃牌堆','牌堆','弃牌','抽牌','移出游戏','回合'];
  const re = new RegExp('《[^》]*》|' + terms.sort((a,b)=>b.length-a.length).join('|'), 'g');
  const escape = s => String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mark = s => s.replace(re, t => t.startsWith('《') ? t : `<span class="game-term">${t}</span>`);
  const highlight = s => mark(escape(s));
  const highlightSVG = s => highlight(s).replaceAll('<span', '<tspan').replaceAll('</span>', '</tspan>');
  // For the trusted legacy card data only: preserve its original emphasis tags.
  const highlightHTML = s => String(s).split(/(<[^>]*>)/g).map(t=>t.startsWith('<')?t:mark(t)).join('');
  globalThis.CardZh = Object.freeze({terms, escape, highlight, highlightHTML, highlightSVG});
})();
