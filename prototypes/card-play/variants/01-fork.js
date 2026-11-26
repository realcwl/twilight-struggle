// 01 岔路口. The plain, complete way: the card comes to the middle and two roads lead away from it,
// the event on the left and operations on the right. Everything after that is said in one ribbon
// at the top. This is core/base.js as it stands, and the yardstick the other nine are measured by.
import { basePresenter } from '../core/base.js';

export default {
  id: '01',
  name: '岔路口',
  ref: '基准方案',
  idea: '牌到中间，左边是事件，右边是行动四选一；之后每一步都由顶部一条提示带着走。',
  notes: {
    choose: '点牌或拖出来 → 牌停在底部正中，左边一块牌子写着事件会发生什么，右边一块牌子是四种行动。指到某种行动上，地图立刻亮出它能用在哪。',
    target: '可选的国家亮起一圈会呼吸的光，其余压暗。政变的国家脚下写着成功所需的点数，被核危机封锁的地区打上锁并说明原因。',
    dice: '顶部弹出骰盘：一颗真的骰子翻滚落定，旁边列出加值，总数亮起，盖一个“成功 / 失败”的章。',
    guide: '每个后果单独演一拍：影响力在国家头上跳数字；核危机、军事行动、胜利点则有一颗光点从出事的国家飞到那个刻度，刻度亮框并挂出“核危机 4 → 3”。',
    opponent: '对手的牌先举到屏幕中上方给你读 1.5 秒，再走和你完全相同的流程。他改过的国家留一个红色数字角标，直到你出下一张牌。',
  },
  pros: ['所有选择一屏摆开，不用记快捷键也不用翻层级', '悬停即预览，选之前就知道能打哪', '后果一拍一拍地演，光点把视线从地图带到刻度'],
  cons: ['决策托盘占掉屏幕底部，这时看不到手里其他牌', '提示条、骰盘、刻度分在三处，视线要来回', '每一拍都要等，熟手会嫌慢（空格可跳过）'],
  mount(ctx) {
    return basePresenter(ctx);
  },
};
