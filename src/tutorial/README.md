# 新手教程

## 入口与实现

大厅的「新手教程」链接为 `./game.html?tutorial=1`。`src/game/main.ts` 仅在该参数为 `1` 时加载教程运行时，并在普通单机初始化前返回。大厅保留创建、加入、继续房间及单机练习入口；其样式文件是 `src/net/online.css`。

| 文件 | 职责 |
| --- | --- |
| `scenario.ts` | 固定开局、双方手牌与行动、合法目标检查、剧本 Agent；调用真实 `SoloGame` 规则，不另建规则引擎。 |
| `lessons.ts` | 开场和结束课程的中文文案、HUD／国家目标、视频引用。 |
| `runtime.ts` | 包装现有 presenter，串联课程与实战，限制操作，保存检查点，恢复、退出及交接普通 AI。 |
| `coach.ts` / `coach.css` | 目标高亮、其他区域遮罩、图标、说明面板、输入白名单和短视频播放。 |

教程直接使用现有手牌拖放、用途选择、地图点击及结果演出。每步先解释，再只开放指定操作；运行时还检查返回的牌、用途与目标，影响力放置按固定顺序验证。未编排的选择会报错并进入恢复流程，不能靠跳过遮罩推进。

## 实际剧本：一整个回合

参考 [GMT 2015 规则书](https://www.gmtgames.com/nnts/TS_Rules-2015.pdf) Extended Example of Play 章节改编，并非逐步照录示例。使用 **seed 79**，采用示例的**美国额外 5 点影响力**开局；初始部署已完成，玩家直接从头条开始。玩家为美国，电脑为苏联，各有 8 张早期牌，苏联另持中国牌。骰子仍由真实引擎的种子随机数生成。

开场先讲胜利条件、地图布局、控制与战场国，再解释卡牌、回合／行动轮和牌堆。双方头条分别为美国《美日安保条约》（027）、苏联《奥运会》（020）；玩家按指引参加奥运会。

之后完整执行第 1 回合：**双方各 6 个行动轮（共 12 次常规出牌）**，每轮苏联先行动。

| 行动轮 | 电脑（苏联） | 玩家（美国）与教学重点 |
| --- | --- | --- |
| 1 | 021，行动点在伊朗 `irn` 政变 | 035《台湾决议》用于行动点，依次在马来西亚 `mys`、哥伦比亚 `col` 放影响力；相邻与控制。 |
| 2 | 012，执行事件 | 004《卧倒与掩护》用于行动点，在伊拉克 `irq` 政变；稳定度、骰点、军事行动与 DEFCON。 |
| 3 | 034，执行事件 | 015《纳赛尔》用于行动点，在黎巴嫩 `lbn` 放影响力；选择先行动，再执行苏联事件。 |
| 4 | 013，执行事件 | 028《苏伊士运河危机》用于太空竞赛；不触发对手事件，检查门槛、成功结果与尝试次数。 |
| 5 | 031，行动点在巴拿马 `pan` 政变 | 019《杜鲁门主义》在埃及 `egy` 调整阵营；只移除影响力，不增加军事行动。 |
| 6 | 003，中东计分 | 001，亚洲计分；存在／支配／控制与净胜利点。 |

随后真实结算军事行动不足、DEFCON 恢复及补牌，到**第 2 回合头条开始前**结束强制教学。最后复习中国牌、太空能力、持续事件、对手事件的例外和最终计分，选择「继续与 AI 对战」或「退出到首页」。继续会保留当前局面，移除 coach 与操作限制；剧本 Agent 从第 2 回合起委托普通 heuristic AI，不重开比赛。

## 存档与隔离

教程专用 localStorage key：`coldwar.tutorial.v1.coldwar`，保存 `{ version: 1, mode: 'guided' | 'free', snapshot, read }`。引擎检查点保存完整局面与已读课程；刷新恢复最近完成的行动，继续自由对战后仍使用此教程存档。普通单机 `coldwar.solo.v1.coldwar` 和联机房间存档不共用此 key。

恢复失败可恢复最近一步、重开教程或退出。退出返回 `online.html`；退出／重开会停止当前游戏和 presenter，清理 coach、监听、视频、手牌限制与局势高亮。普通入口不会加载教程引导。

教学文案只说明当前可执行的规则和操作，不比较不同版本或解释实现细节。DEFCON 最低 2、禁止致命政变的现有机制不变。

## 复用媒体

`public/cards/help/manifest.json` 为媒体清单：v2，22 段 H.264、960 × 540、24 fps、静音、每段 6 秒。每个 ID 对应 `/cards/help/<id>.mp4` 和同名 `.webp` 海报；`lessons.ts` 的 `media()` 使用 `BASE_URL` 构造路径。

| 内容 | 可复用 ID |
| --- | --- |
| 胜负与区域计分 | `vp`、`scoring`、`region-status`、`region-control`、`final-scoring` |
| 国家与影响力 | `influence`、`control`、`battleground` |
| 手牌与流程 | `hand`、`operations`、`headline`、`action-round`、`turn` |
| 军事与太空 | `coup`、`realignment`、`defcon`、`milops`、`space` |
| 牌堆与去向 | `draw`、`discard`、`removed` |
| 不用于标准教程 | `draft-meter`（旧概念规则的紧张度／声望） |

素材来自本项目地图、HUD 和卡牌截图，说明见 `videos/card-help/assets/real/README.md`。coach 按步骤加载视频，支持暂停／重试，关闭时停止播放，尊重减弱动态效果设置；不一次预载全部视频。并非所有素材都会在本剧本中单独播放。

术语文字和悬停说明继续复用 `src/cards/glossary.json`、`terms.js` 的 `highlight()` 及 `tooltips.js` 的 `#card-term-help`，包括国家高亮和关联卡牌预览。

## HUD 定位

运行时使用当前节点的实时边界；局势详情由 `Hud.setStatusSpotlight(true)` 临时展开，结束后恢复。

| 目标 | 选择器／API |
| --- | --- |
| 入口、回合 | `#tutorial-start`、`.hud-tl`、`[data-part="dial"]` |
| 胜利点／核危机／军事行动／太空 | `[data-part="scoreRead"]`、`[data-part="crisis"]`、`[data-part="milops"]`、`[data-part="space"]` |
| 手牌可视节点／命中节点 | `.hd-card[data-card="NNN"]` / `.hd-hit[data-card="NNN"]` |
| 事件／行动点／具体用途 | `.sp-half.ev`、`.sp-half.ops`、`.sp-band[data-key]` |
| 国家 | `.wm-plate[data-id="irn"]`（伊朗 ID 为 `irn`，不是 `iran`）；镜头使用 `WorldMap.frameCountries()`。 |
| 完成放置 | `.sp-sub-keys .primary` |
| 持续效果、牌堆 | `.ps-shelf:not([hidden])`、`.hud-bl` |
| 术语、国家、卡牌引用 | `[data-term]`、`[data-country-ref]`、`[data-card-ref]` |

## 本地验证状态

- `npx tsx --test src/game/tutorial.test.ts`：**10 项通过**。覆盖固定开局与牌守恒、完整 6 行动轮、骰点可重复、真实事件／计分／军事结算、检查点恢复、非法选择拒绝及 AI 交接；普通 AI 续局在 **第 8 回合分出胜负**。
- `TUTORIAL_ORIGIN=http://127.0.0.1:5176 npm run test:tutorial:browser`：**完整通过**，在本地构建预览中实际完成 71 个引导步骤、24 次拖牌／选择／国家操作，17 段既有视频解码成功。核对错误牌、错误用途、错误国家、提前确认与快捷键拦截；刷新恢复、存档隔离、继续自由头条并接普通 AI、退出大厅、重开及普通单机入口均通过，浏览器无错误。测试使用隔离 Chrome context，不使用用户存档或真实房间。
- 大厅入口此前已检查 1440 × 1100、390 × 844、320 × 568 布局、链接、键盘焦点与减弱动画；无横向溢出。22 对视频／海报文件存在。

- 普通单机回归 147 项、联机回归 23 项通过；生产构建和 Worker 类型检查通过。
- 浏览器完整对局在 1600 × 1000 验收；390 × 844 检查讲解布局、退出及视频播放／暂停，减弱动态效果下不自动播放。未宣称完成手机端整局或 Safari／Firefox 验收。

复现：先运行 `npm run build`，再运行 `npm run preview -- --host 127.0.0.1 --port 5176`。另启隔离 Chrome 调试端口 9348，然后执行上述浏览器测试；可通过 `TUTORIAL_CDP_PORT` 覆盖端口。

**仅本地开发与验证，不部署。**
