// Five sample cards for this prototype only. The deck (prototypes/card-designs/deck) has eight events
// that last "this round" and none that last any other way, so the display would only ever be tried
// on one kind of ending. These add the other kinds: ended by a named card, ended by something that
// happens on the board, and counted down in action rounds. Real events, our own titles and effects,
// written here to exercise the screen; they are not part of the 81 and have not been balanced.
(function () {
  'use strict';
  const add = (no, side, era, value, title, place, date, once, text, art) =>
    window.DECK.push({ no, side, era, value, title, place, date, once, text: window.CardZh.highlight(text), art, sample: true });

  add('S01', 'us', 'early', 2, '哈尔斯坦主义', '波恩', '1955年12月', true,
    '波恩只承认一个德国。生效期间：苏联每取得一个欧洲国家的控制，美国获得 1 声望。《东方政策》取消本事件。',
    'sky:bars sun:220,170,100 far:oldtown delegates@220,408*1.25 flag@62,318*.85 flag@378,318*.85~');
  add('S02', 'neutral', 'middle', 2, '东方政策', '华沙', '1970年12月', true,
    '总理在纪念碑前跪下。取消《哈尔斯坦主义》。紧张度下降 1。',
    'sky:plain sun:220,150,90 far:city handshake@220,440*2.2 fore:crowd-low');
  add('S03', 'neutral', 'early', 2, '暂停核试验', '日内瓦', '1958年10月', false,
    '三个核国家同时停手。生效期间：紧张度不能上升。任何一方发动政变，本事件即告结束。',
    'sky:rings sun:220,150,70 far:mountains cloud@220,306*.7 dove@120,110*2^-10 dove@320,80*1.5~^-8');
  add('S04', 'us', 'early', 2, '和平队', '华盛顿', '1961年3月', false,
    '志愿者前往刚独立的国家。接下来 3 个行动轮：每轮结束时，在一个双方均无影响力的非洲国家增加 1 点美国影响力。',
    'sky:rays sun:220,210,130 far:savanna farmer@140,414*1.7 farmer@320,424*1.9~:stand palm@410,420*1.5');
  add('S05', 'ussr', 'middle', 2, '五角大楼文件', '华盛顿', '1971年6月', true,
    '七千页机密登上头版。本回合美国的手牌对苏联公开。',
    'night sky:bars sun:330,110,60 far:capitol paper@190,424*1.9^-7 spy@350,430*1.5~');
})();
