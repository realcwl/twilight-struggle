# 冷战热斗 · 110 张卡牌审阅原型

在仓库根目录运行 `npm run cards:review`，打开 <http://localhost:4311>。

- 完整经典 Deluxe 卡组：103 张基础牌 + 7 张官方可选牌。
- V2 插图覆盖人物、城市、工业、军事设备、生活与自然景观；统一水平标题条及中立背面。
- 全部牌名、规则、前置条件与移除提示均以中文显示。游戏术语按五类着色，保持完整词组不拆行；悬停、键盘聚焦或手机点按可打开文字与短片解释。
- 点击卡牌查看大图。点击“标注位置”，在牌面定位后评论。
- 评论支持图片粘贴、拖入和文件上传，也可只发图片。
- 评论可编辑、标记已处理及重新打开，刷新与服务重启后保留。

下一轮处理反馈时，先读 `data/card-review/pending-comments.md`。完整记录和图片分别在 `data/card-review/comments.json` 与 `data/card-review/uploads/`。

`cards.json` 链接到主项目唯一的数据源 `src/cards/catalog.json`；`assets/v2/` 是最终插图；`art-manifest.json` 记录每张图的生成提示词与来源。详细来源、核对说明和处理评论的操作见 [SOURCES.md](SOURCES.md)。

后续按评论直接更新 `cards.json` 与对应插图，无需重跑初始整理脚本。背面是全牌组共用的中立资产。

中文内容在 `titleZh`、`effectsZh`、`prerequisiteZh`、`noteZh` 字段；英文原文保留供核对。主项目与审阅室共用 `src/cards/render.js`、`glossary.json`、`terms.js`、`terms.css` 与 `tooltips.js`。高亮分为青色影响与控制、砖红冲突与危机、金色计分、紫色阶段与时机、蓝色行动与卡牌；头条阶段使用独立的时机颜色。旧版样例牌和概念牌仍使用 `../zh.js` 与 `../zh.css`。原有行动点、事件效果和评论记录保持不变。

新增中文字符后，在仓库根目录运行 `node tools/card-review/build-zh-font.mjs` 更新本地字体子集；字体为思源宋体（Noto Serif SC），授权文件随字体附带。运行 `npm run cards:check` 检查中文覆盖、术语高亮、卡牌数据和评论持久化。

## 主项目与素材同步

主项目入口为 <http://localhost:5173/game.html>，地图沙盒为 <http://localhost:5173/>。两处的「牌库」都能查看全部 110 张牌，支持搜索、时期和阵营筛选。主项目的手牌、桌面和弃牌堆使用相同的牌面渲染器。`?card=21` 可直接打开指定卡牌。

运行时素材均在 `public/cards/`；执行 `npm run cards:assets` 同步所有插图、背面和字体。`save-art.mjs` 与 `build-zh-font.mjs` 也会同步对应运行时文件。打包后的主项目不依赖 `prototypes/`。

短片源文件在 `videos/card-help/`，成片和海报在 `public/cards/help/`。短片使用实际地图、国家节点、卡牌与 HUD 素材。页面初次加载不请求视频；解释关闭即停止并释放视频。系统选择减少动态效果时只展示海报，点击才播放。规则文字依据 [GMT 规则手册](https://s3-us-west-2.amazonaws.com/gmtwebsiteassets/nnts/TS_Rules-2015.pdf)。

主项目的出牌仍由既有演示状态驱动；本次接入卡牌内容和呈现，不等于实现全部事件的规则引擎。
