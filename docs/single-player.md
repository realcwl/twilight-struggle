# 单机对局

打开 `/game.html`。玩家执美国，电脑执苏联；使用现有的 110 张牌目录，包括可选牌。
先在西欧部署 7 点影响力，再拖出头条牌。之后仍然用原有的拖牌、行动选择、地图目标、撤销和掷骰交互。
点击左上角回合圆盘或按 `R` 打开菜单；`Space` 跳过当前演出等待。

对局包括初始发牌、三时代牌库、头条顺序、双方交替行动、影响力、政变、调整阵营、太空竞赛及其四项能力、军事行动、地区计分、中国牌传递和最终计分。109 张事件/计分牌各有显式处理器，中国牌由通用行动规则处理。
胜负由 20 VP、欧洲控制、战争游戏和第十回合最终计分决定。最终 0 VP 是平局。

当前使用简化规则（单机和联机共用）：

- 计分牌数量达到剩余行动数时，只能打出计分牌；其他牌仍可悬停查看，但不能拖出。额外行动轮、困境和导弹嫉妒也遵守此优先级。特殊效果或旧存档留下的计分牌在回合末、军事行动结算前自动打出，不因漏出计分牌判负。
- 核危机最低为 2。会降至 1 的政变在用途和国家选择阶段禁用；可安全进行的非战场国政变和核潜艇例外保留。事件导致的下降也不会突破 2 级；主动选择核战的选项不再提供。
- 古巴导弹危机期间，只开放能先支付解除代价的政变；执行前先移除指定国家的 2 点影响力。
- 计分牌直接出牌；用途、事件选项或必选国家只有一个时自动执行。可以取消或跳过的选择仍保留。
- `SoloGame.options` 同时供给手牌高亮、AI 和服务端验证；界面不能绕过限制。

规则参考：[GMT Deluxe 2015 官方规则](https://s3-us-west-2.amazonaws.com/gmtwebsiteassets/nnts/TS_Rules-2015.pdf)，事件参数来自项目内 `src/cards/catalog.json`。这不是经过官方认证的数字版；启发式电脑也不是高水平棋力 AI。

## 状态与界面

- `src/game/solo/model.ts`：版本化、可序列化的 `MatchState`，包含国家影响力、牌所在位置、轨道、事件状态、随机数状态、日志和结果。`validate()` 检查牌数守恒、重复牌、轨道与影响力。
- `src/game/solo/engine.ts`：回合流程、规则与合法选择，唯一负责决定局面变化的模块。
- `src/game/solo/events.ts`：按卡号明确执行事件，不在运行时解析中文规则文本。
- `src/play/spotlight.ts`：继续负责原有视觉与交互。引擎通过 `Presenter` / `PlayQueries` 接入。
- `src/game/solo/presenter.ts`：仅补充原界面缺少的弃牌/地区/事件顺序选择、公开手牌、结果与重开。
- `src/game/solo/headless.ts`：无动画测试适配器，运行同一引擎与同一合法选择流程。

每个完整行动后、初始部署结束和回合切换时自动保存到浏览器的 `coldwar.solo.v1.coldwar`。刷新会恢复最近的完整行动；未完成的动画或选择回退到这个检查点。种子及随机数进度也被保存，重载不会重新洗牌或重掷已结算的骰子。重新开局会替换当前单机存档。

没有服务器、账号或外部 AI 服务。浏览器清除网站数据会删除存档；界面在写入失败时会在回合圆盘的提示中标明。不同 origin 的存档独立，例如 `localhost` 与 `127.0.0.1`。

## 替换 AI

`src/game/ai/types.ts` 是独立于界面和规则引擎的 JSON 数据接口。当前实现在 `heuristic.ts`。

```ts
import type { Agent } from './src/game/ai/types';

const myAgent: Agent = {
  id: 'my-agent-v2',
  chooseAction(observation) {
    // 返回 { card, use, mode?, target? }；应从 legalActions 选择。
    return observation.legalActions[0];
  },
  chooseHeadline(observation) {
    return observation.headlineCandidates[0];
  },
  chooseOption({ observation, title, options }) {
    // 初始部署、国家、弃牌、事件顺序及额外行动也使用此接口。
    return options[0].id;
  },
};

// 在构建 SoloGame 时传入 agent: myAgent；三个方法均可返回 Promise。
```

`Observation` 给出自己的手牌、对手手牌数量、公开地图与轨道、已生效事件、公开牌堆和合法行动。只有规则允许查看的对手牌才出现在 `revealedOpponentCards`。它不含对手完整隐藏手牌、未来抽牌顺序或随机数状态，而且是分离的数据副本。引擎验证 AI 返回的卡号、目标和选项，拒绝非法输出。

`MatchState` 是完整存档，不能直接交给 AI。默认 AI 无内部状态，可从同一 observation 复现选择；有内部记忆的替代实现应自行管理其序列化。替换 AI 不需要改地图、卡牌、动画或规则处理器。

## 验证

```sh
npm test                        # 全部规则、地图与状态测试
npm run test:solo                # 单机规则、109 事件覆盖、整局与恢复测试
npm run solo:simulate -- 500      # 种子 1..500 的完整对局，输出每局胜负及汇总
npm run cards:check              # 卡牌、中文词汇与帮助媒体回归
npm run build
```

浏览器测试使用隔离的 Chrome profile，**不要指向自己的日常浏览器端口**：

```sh
npm run dev -- --host 127.0.0.1
# 另一个终端启动测试浏览器（macOS）
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --remote-debugging-port=9344 \
  --user-data-dir=/tmp/coldwar-solo-browser --no-first-run about:blank
npm run test:solo:browser
```

浏览器检查使用真实指针拖牌和国家点击，覆盖部署、头条、行动选择/取消、事件生效、存档恢复、双方胜利、最终计分与再开局。临近胜利的浏览器场景使用合法存档夹具；整局从发牌到结束由 headless 对局测试覆盖。截图写入 `/tmp/solo-check/`。可通过 `SOLO_CDP_PORT` 和 `SOLO_ORIGIN` 改测试地址。
