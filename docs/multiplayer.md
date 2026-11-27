# 好友对战与部署

入口：<https://coldwar-duel.coldwar-table-0931.workers.dev>

创建房间，选择美／苏，把生成的 **8 位房间密码**发给朋友。朋友打开同一个网站、输入密码加入，双方分别进行初始部署、暗选头条与行动轮，直到胜负结算。房间仅容纳两名玩家，没有账号注册和公开大厅。原来的单机入口仍是 `/game.html`。

房间密码用于加入空位。加入后，每个浏览器获得独立的随机座位凭证；完整牌库、随机数和对方手牌始终保存在服务器。原浏览器刷新／重新打开可以继续，不能用房间密码冒领已占用的座位。清除浏览器数据或换设备会失去该座位的恢复凭证。7 天没有有效对局操作，房间到期；未提交的影响力预览在刷新时重置，已提交的决定不会重复执行。

## 一条命令重新部署

```sh
npm ci
npm run deploy
```

第一次在新电脑上需要登录（只需账号读取与 Workers 发布权限）：

```sh
npm run cf:login
```

也可在 CI 中提供 `CLOUDFLARE_API_TOKEN`，限定到 `infra/cloudflare.json` 的账号，授予 Workers Scripts Write 和 Account Read。不要提交凭证。没有要求依赖控制台里创建的数据库、手工绑定或隐藏设置。

- `infra/cloudflare.json`：账号与账户级 `workers.dev` 子域名的期望状态。
- `tools/cloudflare-bootstrap.mjs`：幂等创建／核对子域名。若现有子域名不同，停止而不修改其他项目的地址。[Cloudflare API](https://developers.cloudflare.com/api/resources/workers/subresources/subdomains/methods/update/)
- `wrangler.jsonc`：Worker、静态资源、房间 Durable Object 绑定、SQLite 类迁移、限流。
- `package-lock.json`：固定构建／部署工具依赖。
- `npm run deploy`：核对基础设施 → 构建前端 → 检查 Worker 类型 → 上传代码与资产、执行尚未执行的迁移。
- `npm run deploy:check`：构建与 dry-run，不修改云端。

保留 Worker 名称、`ROOMS` 绑定、`GameRoom` 类及迁移历史，就会沿用原有房间数据。不要删掉 `v1` 迁移。新增存储迁移用新的 tag，先验证旧房间恢复。更改规则或决定顺序时，也必须考虑正在进行中的 journal（版本 1）；不要在有玩家的房间中不兼容地修改 replay 顺序。

回滚代码：`npx wrangler rollback <version-id>`。回滚不会倒退已经保存的对局，也不能替代数据格式迁移。

## 本地运行及验证

```sh
npm run dev:online
# http://localhost:8787
```

该命令先构建静态文件，然后运行真实 Worker／Durable Object 的本地模拟器。修改前端后需重新构建并刷新；`.wrangler/` 中的本地数据库与线上数据相互独立。两个浏览器／浏览器配置文件可以分别作为两个玩家，同一浏览器中的多个标签会恢复同一个座位。

头条拖出后立即离开手牌，背面朝上停在揭示位置；另一方尚未提交时，对应位置留空。
对手提交后，牌背入场，再原位翻开双方头条。等待时仍能查看其余手牌和拖动地图，刷新或重连会恢复已提交的牌。
服务器通过 `View.headline` 发送自己选中的牌和对手是否已提交，未揭示的对手牌名不会出现在该字段中。

行动预览保持私密：选择政变／调整阵营后，可以查看国家数值并返回选择；只有确认首个目标国家才公开卡牌、扣除手牌并播放对手回顾。放置影响力在确认完整分配后公开，未确认前可逐点撤销，也可随时按 Esc／“返回选择”一次撤销全部分配，改选其他行动；还有可用点数时不能提前确认。预览、取消及重连不会生成战斗记录或泄露牌名。直接选择事件／太空竞赛即为确认；若主动选择先执行对手事件，该事件生效后只能更换剩余行动的用法，不能收回整张牌或撤销已掷出的骰子。

```sh
npm test
npm run test:online
ONLINE_CDP_PORT=9348 ONLINE_ORIGIN=http://localhost:8787 npm run test:online:browser
COMMIT_CHECK=1 ONLINE_CDP_PORT=9348 ONLINE_ORIGIN=http://localhost:8787 ONLINE_PACE=.5 node --import tsx tools/online-browser.mjs
npm run test:online:live -- http://localhost:8787 2
# 正式环境验证会创建并实际进行测试房间：
npm run test:online:live -- https://coldwar-duel.coldwar-table-0931.workers.dev 2
```

单元测试走与服务器相同的双人输入接口，覆盖 10 个种子的完整比赛、双方胜利、DEFCON 判负、第 10 回合最终计分、重放恢复、非法操作及中途认输。黑盒测试只使用普通 HTTP/WebSocket，验证创建／加入、第三人拒绝、身份隔离、隐藏头条、双端状态一致、断线重连、重复提交和实际胜负。

浏览器测试需要先启动使用独立临时配置目录、开放对应调试端口的 Chrome。它为双方创建隔离的浏览器上下文和测试房间，通过真实鼠标验证等待加入、交替部署、暗选头条、重连和刷新。等待期间可拖动地图、悬停查看手牌和使用房间菜单，但不能出牌；进入本方选择时恢复出牌操作。这项检查覆盖服务器黑盒测试无法发现的透明遮罩和鼠标拦截问题。

`COMMIT_CHECK=1` 额外验证双方行动提交时机：政变悬停预览、部分和完整影响力分配后按 Esc 返回，期间对手视图完全不变；点击目标国家后才显示对手回顾。`COMMIT_CHECK=place` 将最后一步改为确认完整影响力分配，验证此时才显示回顾。规则测试还覆盖非法分配、重连、首次调整后停止、对手事件先行，以及被动扣分不在预览时触发。

`SOLO_CDP_PORT=9348 npm run test:cards:browser` 在本地 Vite 页面检查国家名称与地图联动、实时影响力、关联卡牌浮层、弹窗内交互，以及桌面／手机宽度的政变演出；请仅指定独立测试 Chrome 端口。政变的前后局势由规则引擎随 `RollSpec.situation` 提供，客户端只负责展示，不提前修改地图上的影响力。

## 代码接口

`src/game/solo/engine.ts` 仍是唯一规则引擎。`remoteInputs(side)` 为两名真人分别提供输入，原单机 Agent / Observation 接口保留。没有在客户端另写一套判定规则。

`src/net/replay.ts` 在完整行动检查点上重放已验证的决策，遇到待选择项立即返回。服务器不保留等待用户的 JS Promise，因此 Durable Object 休眠／重启后可以恢复任意待选步骤。每个决定用检查点代次和序号定位，提交还带独立 requestId；已应用的请求可以安全重试。

`worker/index.ts` 每个房间用一个 Durable Object 串行处理操作，校验凭证、合法牌、目标和点数，先持久化，再分别发送两方可见的画面和选项。玩家只收到自己的手牌与选择；头条双方提交前不会公开。WebSocket 使用休眠 API、自动心跳回复；同源或指定 Pages 来源校验、创建／加入限流和房间连接上限在 Worker 中实现。

`src/net/client.ts` 将协议接入现有 WorldMap、Hud、Spotlight、卡牌库和 tooltip。`src/net/placement.ts` 仅负责本地放置预览；服务器重做并验证每一步。AI 不部署到浏览器的多人入口，不接管任何断线玩家。

这是供两位朋友对战的版本：无匹配系统、观战、跨设备找回座位、账号系统或自定义域名。长期公开运营时可在现有协议上扩展这些功能。
