# 好友对战首页 · 美苏对峙

首页的呈现集中在 `online.html` 和 `src/net/online.css`，建房、加入、继续房间的 DOM ID 和客户端协议保持不变。游戏内房间控件样式与首页分开。手机采用较小的背景资源与顶部构图，短屏允许纵向滚动；动画遵守 `prefers-reduced-motion`。不依赖第三方字体或图片服务。

## 图像资产

使用内置 image_gen 工具生成原创背景；原始文件保存到 `assets/lobby/confrontation.png`。经 sharp 编码为：

- `public/lobby/confrontation.webp`：1672 × 941，223,868 字节。
- `public/lobby/confrontation-mobile.webp`：960 × 540，70,612 字节。

英文背景提示词（生成图像内没有 UI 或文字）：

> Use case: stylized-concept. Asset type: premium Cold War strategy game main-menu full-bleed background, wide 16:9 landscape, 2560x1440 or higher. Create cinematic painterly realistic game key art with the imposing, tense atmosphere of classic military strategy games. A divided world, American and Soviet confrontation, 1960s-1980s technology. Left third in deep midnight blue and cold steel light: imposing American military officer in peaked cap seen in 3/4 profile looking inward to the right, weathered face, period uniform, with the US Capitol silhouette, a billowing weathered American flag, distant jet aircraft and an American tank in foreground. Right third in dark crimson and ember light: Soviet officer in peaked cap facing left, period Soviet uniform with a restrained star, Kremlin tower, weathered Soviet red banner with simple gold hammer and sickle, a heavy Soviet tank and missile silhouettes below. Their faces are natural and human, high fidelity and sober, not caricatures. The enormous opposing figures are integrated into the architecture and smoky battlefield like an oil-painted movie poster, not two portrait boxes. Deep perspective, detailed metal and fabric, beautiful subdued rim light, atmospheric smoke. Center 35 percent stays relatively dark and quiet with smoky pale-gold horizon line and distant city silhouettes, usable negative space for a vertical game menu. The lower middle is very dark textured navy charcoal. Strong polished art direction: asymmetric details within a balanced two-side composition, dramatic deep shadow, rich navy/crimson/antique-gold palette, restrained film grain, no neon cyberpunk. Outer edges contain the strong recognizable visual subjects; central quiet region has no large objects or faces. NO WORDS, NO LETTERS, NO NUMBERS, NO UI, no panels or buttons, no game logos, no watermark. Beautiful original premium strategy-game cover art.

## 发布

沿用 `npm run deploy`（IaC 核对、构建、Worker 类型检查、Wrangler 发布），不改变 Durable Object 绑定或迁移。

## 本次验证（2026-11-15）

- `npm run deploy` 成功；前端与 Worker 类型检查、Vite 构建通过。
- 发布版本：`790ebc75-f1ec-40d2-9013-03c40e295c7f`。
- 线上首页与两张 WebP 资源均返回 200；Chrome 无页面警告或错误。
- Chrome 和独立 IAB 浏览器实际创建／密码加入同一房间，分别获得美／苏座位并进入初始部署；继续房间恢复同一座位，非法房间码显示校验提示。
- 390 × 844 手机视口没有溢出；320 × 568 窄屏仅纵向滚动。默认桌面视口、双方阵营选中状态均已检查。
- 线上黑盒完整对战：112 次决策，第 3 回合苏联达到 20 VP 获胜；满房、身份隔离、隐藏头条、断线重连、重复提交、公开状态一致性检查全部通过。
- 线上截图：`docs/validation/lobby-v2.jpg`、`docs/validation/lobby-v2-mobile.jpg`。
