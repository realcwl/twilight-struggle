// The user's supplied Twilight Struggle card, kept separate from the original concept deck.
window.NATOCard = Object.freeze({
  no: '021',
  title: '北大西洋公约组织',
  value: 4,
  side: '美国事件',
  era: '冷战早期',
  place: '华盛顿',
  date: '1949年4月4日',
  persistent: true,
  once: true,
  prerequisite: '须在《马歇尔计划》或《华沙条约组织》生效后打出。',
  effects: [
    '苏联不得在美国控制的欧洲国家进行政变或调整阵营掷骰。',
    '美国控制的欧洲国家不受《局部战争》事件攻击。',
  ],
  note: '作为事件使用后，移出游戏。',
  art: 'nato/nato-flag.png',
  artAlt: 'A blue NATO flag with its large white compass rose clearly visible on softly folded fabric.',
});
