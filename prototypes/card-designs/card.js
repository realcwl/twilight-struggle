// The one sample card every design is mocked up on. It is an original stand-in written for this
// sheet (a real event, our own wording and numbers), with the slots a finished card needs:
// a value, an era, a serial number, an illustration, a title, rules text and a single-use note.
window.CARD = {
  no: '014',
  value: 2,
  era: '冷战早期',
  eraSpan: '1945–1961',
  side: '苏联',
  title: '革命',
  place: '哈瓦那',
  date: '1959年1月',
  // <b> marks the words a player scans for
  text: '起义军进入哈瓦那。古巴转为苏联控制，移除岛上全部美国影响力。',
  note: '一次性事件 · 使用后移出游戏',
  flavor: '蓄须的游击队走下山脉，城市向他们敞开大门。',
};

window.CARD.text = CardZh.highlight(window.CARD.text);
