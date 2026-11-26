# 地图沙盒计划

状态：草案，待审。本文只描述地图沙盒，不含规则引擎、卡牌和联机。

## 1. 目标

**做一个地图沙盒。** 它是一个可以独立打开的页面，里面只有 3D 世界地图和一个手动改局势的面板。它不是游戏：没有回合、卡牌和规则，每个国家的影响力和控制方都由你在面板里随意设置。

沙盒用来回答两个问题：

- 地图的画风和质感对不对。
- 在任意一种局势下，地图能不能让人一眼看清谁控制哪里、谁和谁相邻。

沙盒通过验证后，里面的地图模块原样接入正式游戏，局势改由规则引擎提供，沙盒本身保留下来做美术和交互的试验场。

沙盒里的地图要做到：

- 画面干净，地图本身是主角，画风参考《文明 6》的特征。
- 可以从全球视角连续缩放到局部视角。
- 鼠标悬停和点击时，清楚显示控制方、双方影响力和相邻关系。
- 完全由数据驱动：换一份剧本数据就是另一张地图。

本文用到的几个词：

- **国家**：地图上的一个可操作节点，对应一块领土。
- **大区**：若干国家组成的分组，例如欧洲、中东。
- **关键国**：对大区局势权重更高的国家。
- **影响力**：双方在一个国家里各自的点数。
- **控制方**：当前控制该国的一方，可以为空。

## 2. 范围

**做：**

| 部分 | 内容 |
|---|---|
| 地形 | 风格化的起伏地形、海洋、海岸线、湖泊 |
| 领土 | 国界线、按控制方染色、未参与国家的弱化处理 |
| 国家铭牌 | 每个国家一个小标记，显示双方影响力、稳定度、是否关键国 |
| 镜头 | 平移、缩放、缩放时自动调整俯角、飞到指定国家或大区 |
| 悬停与选中 | 高亮、相邻连线、信息卡（第 5 节） |
| 沙盒面板 | 手动改任意国家的影响力和控制方，用来在没有规则引擎时检查所有显示状态 |
| 素材管线 | 从公开地理数据生成全部贴图和数据文件的离线脚本 |

**不做（保持干净）：**

- 城市、地标、单位、树木等装饰模型。
- 昼夜、天气、云层动画。
- 政变、计分等动作的特效和音效。
- 小地图、回合信息、手牌等界面。
- 规则判定。地图只显示传进来的局势，不自己算规则。
- 手机触屏操作。第一版只保证桌面浏览器。

## 3. 画面方向

借鉴的是《文明 6》的画面特征，不使用它的任何素材。

**借鉴的特征：**

- 色彩饱和但柔和，草地、平原、沙漠、苔原、雪地之间颜色分明。
- 地形起伏夸张，山脉成块、轮廓清楚，拉远了也认得出。
- 地表有手绘笔触感，不追求卫星图式的真实细节。
- 浅海青绿过渡到深海深蓝，海岸线有一圈浅色描边。
- 领土边界是势力色的描边，加一条向内渐隐的色带。
- 未探索区域是羊皮纸底色加墨线的古地图。

**我们的做法：**

- **地图是平面的，不是地球。** 一眼能看到全局，更接近棋盘。
- **只用一盏暖色斜向主光。** 山脉的立体感来自预先烘焙的明暗，不做实时阴影。
- **未参与本剧本的地区画成羊皮纸古地图。** 这样玩家一眼知道哪些地方不在局内，画面也更安静。
- **轻微的移轴景深和暗角。** 让画面有桌面沙盘的微缩感。
- **地图上只有五种元素**：地形、水面、领土边界与染色、国家铭牌、文字标注。

**领土的五种显示状态：**

| 局势 | 领土表现 |
|---|---|
| 双方都没有影响力 | 中性的细墨线边界，无染色 |
| 有影响力但无人控制 | 细边界，加很淡的双色斜纹 |
| 蓝方控制 | 蓝色描边和向内色带 |
| 红方控制 | 红色描边和向内色带 |
| 关键国（叠加在以上任一状态上） | 额外一道金色内描边，铭牌带徽记 |

## 4. 缩放与镜头

缩放是连续的，但显示的信息分两档，中间平滑过渡：

| | 全球视角 | 局部视角 |
|---|---|---|
| 俯角 | 接近正上方 | 倾斜约 45–55 度 |
| 地形 | 细节收敛，染色更醒目 | 起伏和笔触细节充分展示 |
| 文字 | 只显示大区名 | 显示国家名 |
| 铭牌 | 收成一个小圆点，颜色表示控制方 | 完整显示影响力数字 |
| 悬停对象 | 大区 | 国家 |

操作：拖拽平移，滚轮以鼠标位置为中心缩放，双击大区飞到该大区，镜头不能移出地图边界。

## 5. 悬停与选中

这是地图模块的核心功能。

**悬停一个国家（局部视角）：**

1. 该国领土提亮并略微浮起，边界发光，其他国家轻微压暗。
2. 画出到每个相邻国家的连线：当前冷战地图按第 11 节的棋盘审计，区域内用棕色实线，跨区域用红色虚线，超级大国用黑线加浅色描边。美国—日本是一条跨太平洋连线，在地图左右边缘各显示一段。
3. 相邻国家次级高亮。
4. 显示国家信息卡：
   - 名称、所属大区、稳定度、是否关键国
   - 双方影响力
   - 控制方，以及对方还差几点可以翻转控制
   - 相邻国家列表，每个带控制方色标

**悬停一个大区（全球视角）：**

1. 大区内的国家整体提亮，大区外轮廓发光，其他地区压暗。
2. 显示大区信息卡：
   - 名称、国家总数
   - 双方各控制几个国家，其中几个是关键国
   - 大区局势标签（由传入的局势数据给出）

**选中：** 点击后固定高亮和信息卡，镜头缓动到合适位置；点空白处或按 Esc 取消。

**悬停效果随局势变化：** 高亮的颜色跟随第 3 节的五种状态，例如蓝方控制的国家悬停时蓝色色带加亮并缓慢呼吸，无人控制的国家是中性的暖白色提亮。

## 6. 数据接口

地图模块吃两份数据，对外给出一组很小的接口。

```ts
// 剧本数据：静态，决定地图长什么样
type Scenario = {
  sides: [Side, Side];                      // 双方的名称和颜色
  regions: { id: string; name: string }[];
  countries: {
    id: string;
    name: string;
    region: string;
    shapes: string[];                       // 对应的地理多边形，可以合并多个
    stability: number;
    key: boolean;
    anchor?: [lon: number, lat: number];    // 铭牌位置，缺省自动计算
  }[];
  links: { a: string; b: string; kind: 'land' | 'sea' }[];
};

// 局势数据：动态，以后由规则引擎提供
type MapState = {
  countries: Record<string, {
    influence: [number, number];
    controller: 0 | 1 | null;
    flipMargin?: number;                    // 对方还差几点翻转控制
  }>;
  regions: Record<string, { status: [string, string] }>;
};

// 地图对外接口
map.setState(state);
map.setHighlights(ids, kind);               // 预留：以后用来标出合法目标
map.on('hover' | 'select', handler);
map.flyTo(id);
```

几点说明：

- **冷战剧本采用第 11 节审计的数据**：84 个国家、29 个战场国、6 个计分大区，另有美国和苏联两个超级大国空间；121 条无向连线全部显式列出，使用 `landLinks: manual`，不从真实国界推导或删减。
- **地理与棋盘分开**：复合国家空间用现代地理轮廓近似显示，轮廓不决定相邻关系。中国、蒙古不并入苏联。超级大国不属于计分大区，不放置影响力；可选中国内战空间不在默认地图中启用。沙盒局势预设仍用于测试显示，不代表正式开局。
- **历史国界靠合并和自定义多边形解决。** 现成数据是当代国界；苏联、南斯拉夫这类由多个现代国家合并得到，东西德这类需要拆分的在剧本包里附自定义多边形。
- **`setHighlights` 现在只留接口。** 以后做放影响力、政变的操作界面时，规则引擎用它标出合法目标。

## 7. 素材

原则：地理形状全部来自公开数据，质感来自 shader 和少量贴图，不从任何商业游戏里取素材。每个素材的来源、版本和许可记录在 `assets/SOURCES.md`。

| 用途 | 来源 | 许可 |
|---|---|---|
| 国界、海岸线、湖泊、河流 | Natural Earth 矢量数据 | 公有领域 |
| 陆地高程和海底深度 | NOAA ETOPO 2022 | 公有领域 |
| 地表类型和底色参考 | Natural Earth II 栅格图 | 公有领域 |
| 笔触、纸纹、水面法线等细节贴图 | 程序化生成为主，辅以 ambientCG、Poly Haven | CC0 |
| 标注字体 | 拉丁文衬线标题体，中文用思源宋体 | OFL |

质量把关的做法：

- 每类素材先出 2–3 个候选，做成并排对比图由你选，不直接定稿。
- 如果找不到合格的 CC0 手绘笔触贴图，后备方案是由你用 AI 生成可平铺的笔触纹理，我负责接入和调色。

## 8. 技术方案

- **运行时**：TypeScript + three.js，Vite 构建，以 WebGL 2 为基线。信息卡和沙盒面板用普通网页元素。
- **离线生成脚本**：把地理数据处理成运行时用的文件，包括高度图、烘焙好的明暗、国家编号贴图、国界和海岸的距离场、铭牌位置和相邻关系。
- **地形**：一块按高度图位移的网格加一个自定义 shader，底色、国界、染色、高亮都在这个 shader 里完成。
- **染色**：局势写进一张很小的数据贴图，shader 按国家编号查色。局势变化只更新这张贴图。
- **拾取**：鼠标射线打到地面后，直接查国家编号贴图得到国家。结果精确到像素，岛屿和飞地也准确。

性能目标：

- 集显笔记本 1080p 下稳定 60 帧。
- 首屏下载压缩后不超过 5MB。

目录结构：

```
tools/mapgen/      离线生成脚本
data/scenarios/    剧本数据
assets/            源数据的下载清单和 SOURCES.md
src/map/           地图模块
src/sandbox/       沙盒页面和沙盒面板
```

## 9. 里程碑与验收

每个里程碑结束时停下来给你看结果，通过后再继续。

| 里程碑 | 产出 | 验收标准 |
|---|---|---|
| M0 定调 | 素材候选对比图；全球和局部各一张静态画面 | 你认可画风方向 |
| M1 地图底座 | 地形、水面、国界、文字标注、镜头 | 两档视角都清晰可读；达到性能目标 |
| M2 局势与交互 | 染色、铭牌、悬停与选中、信息卡、相邻连线、沙盒面板 | 不懂规则的人看截图能说出谁控制哪里、谁和谁相邻 |
| M3 打磨 | 过渡动画、景深、加载画面、窗口缩放适配 | 五种领土状态和两种悬停在沙盒面板里逐一检查无误 |

## 10. 待你确认

| 决定 | 我的默认 | 备选 |
|---|---|---|
| 渲染技术 | three.js，Web 原生 | Godot 导出 Web |
| 地图范围 | 全球 | 某个区域性战场 |
| 悬停对象 | 局部视角是国家，全球视角是大区 | 始终是国家 |
| 地图形态 | 平面，不做左右循环，切在太平洋中线 | 平面加左右循环滚动；或地球 |
| 双方配色 | 蓝对红，兼顾色弱可辨 | 你指定 |
| 装饰模型 | 第一版完全不放 | 每个大区放一两个地标 |
| 标注语言 | 数据里中英双语，界面默认中文 | 只做一种 |

## 11. Audit

Transcribed and audited against the user-provided map and the matching full-resolution GMT image. Audit date: 2026-11-13.

### Result

84 country spaces + 2 superpowers = **86 standard nodes**. There are **121 undirected standard connections**: 104 regional, 8 inter-regional, and 9 to superpowers. The printed optional USSR–Chinese Civil War connection is separate: including it gives 87 spaces and 122 connections.

Every country row and every connection below was visually reviewed. The two manually entered passes agree exactly. Programmatic checks found no unknown endpoints, missing reciprocal entries, duplicate edges, self-loops, or misclassified connection types. All 86 standard nodes form one connected graph. No unresolved lines remain in this transcription. These checks establish internal consistency; visual tracing supplies the map evidence.

### Sources and interpretation

- Primary: the image supplied by the user (GMT Games LLC © 2024).
- Matching publisher image: [TS20_Game Board_1E_Web.jpg](https://gmtwebsiteassets.s3.us-west-2.amazonaws.com/Twilight+Struggle+20th+Anniversary+HOF+Edition/TS20_Game+Board_1E_Web.jpg) (10198 × 6601 pixels). The image is linked from [GMT’s 20th Anniversary product page](https://www.gmtgames.com/p-1138-twilight-struggle-20th-anniversary-hall-of-fame-edition.aspx), where GMT labels the sample as work in progress. This audit transcribes that supplied image; it does not assert that every production printing is identical.
- Rules context: [GMT 2015 rules, §2.1.5–2.1.6 and §12](https://s3-us-west-2.amazonaws.com/gmtwebsiteassets/nnts/TS_Rules-2015.pdf).
- Only a printed line establishes adjacency; proximity, geographic borders, and line crossings do not add connections.
- All entries are direct neighbors. All standard edges are undirected. The USA/Japan arrows are the two ends of one connection.
- Solid brown = regional; red dashed = inter-regional; black = superpower.
- The board’s combined spaces remain single nodes. `Czech.` is Czechoslovakia; `Port./Spain` is Portugal/Spain; `Dominican R.` is Dominican Republic; `SE African States` is Southeast African States.
- Canada and Turkey are in Europe; Libya and Egypt are in the Middle East. Southeast Asia is a subregion of Asia.
- The optional Chinese Civil War space and its USSR link are recorded separately, outside the standard adjacency lists. Under rule 12.1 it is in Asia (not Southeast Asia), but does not affect scoring cards.
- The application scenario now uses this audit through `data/scenarios/coldwar/scenario.json`; `npm test` checks both the source and generated map against the reference.

### Country-by-country audit

Each country row includes the printed stability number, printed battleground status, and all direct neighbors, including links outside its scoring region and to superpowers. Degree is the total number of listed neighbors; it is not the stability number. Battleground status is the printed baseline, before any event effects. “Checked” means the row was traced visually and matched against the connection-by-connection pass.

#### Europe

| Space | Stability | Battleground | Degree | All direct neighbors | Audit |
|---|---:|---|---:|---|---|
| Canada | 4 | No | 2 | UK, USA | Checked |
| UK | 5 | No | 4 | Canada, Norway, Benelux, France | Checked |
| Norway | 4 | No | 2 | UK, Sweden | Checked |
| Sweden | 4 | No | 3 | Norway, Finland, Denmark | Checked |
| Finland | 4 | No | 2 | Sweden, USSR | Checked |
| Denmark | 3 | No | 2 | Sweden, W. Germany | Checked |
| Benelux | 3 | No | 2 | UK, W. Germany | Checked |
| W. Germany | 4 | Yes | 5 | Denmark, Benelux, E. Germany, France, Austria | Checked |
| E. Germany | 3 | Yes | 4 | W. Germany, Poland, Czech., Austria | Checked |
| Poland | 3 | Yes | 3 | E. Germany, Czech., USSR | Checked |
| Czech. | 3 | No | 3 | E. Germany, Poland, Hungary | Checked |
| France | 3 | Yes | 5 | UK, W. Germany, Port./Spain, Italy, Algeria | Checked |
| Austria | 4 | No | 4 | W. Germany, E. Germany, Hungary, Italy | Checked |
| Italy | 2 | Yes | 5 | France, Austria, Port./Spain, Yugoslavia, Greece | Checked |
| Port./Spain | 2 | No | 3 | France, Italy, Morocco | Checked |
| Hungary | 3 | No | 4 | Czech., Austria, Romania, Yugoslavia | Checked |
| Yugoslavia | 3 | No | 4 | Hungary, Romania, Italy, Greece | Checked |
| Romania | 3 | No | 4 | Hungary, Yugoslavia, Turkey, USSR | Checked |
| Bulgaria | 3 | No | 2 | Greece, Turkey | Checked |
| Turkey | 2 | No | 4 | Romania, Bulgaria, Greece, Syria | Checked |
| Greece | 2 | No | 4 | Italy, Yugoslavia, Bulgaria, Turkey | Checked |

#### Middle East

| Space | Stability | Battleground | Degree | All direct neighbors | Audit |
|---|---:|---|---:|---|---|
| Libya | 2 | Yes | 2 | Tunisia, Egypt | Checked |
| Egypt | 2 | Yes | 3 | Libya, Israel, Sudan | Checked |
| Israel | 4 | Yes | 4 | Egypt, Lebanon, Syria, Jordan | Checked |
| Lebanon | 1 | No | 3 | Israel, Syria, Jordan | Checked |
| Syria | 2 | No | 3 | Turkey, Lebanon, Israel | Checked |
| Iraq | 3 | Yes | 4 | Iran, Jordan, Saudi Arabia, Gulf States | Checked |
| Iran | 2 | Yes | 3 | Iraq, Afghanistan, Pakistan | Checked |
| Jordan | 2 | No | 4 | Lebanon, Israel, Iraq, Saudi Arabia | Checked |
| Saudi Arabia | 3 | Yes | 3 | Jordan, Iraq, Gulf States | Checked |
| Gulf States | 3 | No | 2 | Iraq, Saudi Arabia | Checked |

#### Asia

| Space | Stability | Battleground | Degree | All direct neighbors | Audit |
|---|---:|---|---:|---|---|
| Afghanistan | 2 | No | 3 | USSR, Iran, Pakistan | Checked |
| Pakistan | 2 | Yes | 3 | Iran, Afghanistan, India | Checked |
| India | 3 | Yes | 2 | Pakistan, Burma | Checked |
| Burma | 2 | No | 2 | India, Laos/Cambodia | Checked |
| Laos/Cambodia | 1 | No | 3 | Burma, Thailand, Vietnam | Checked |
| Thailand | 2 | Yes | 3 | Laos/Cambodia, Vietnam, Malaysia | Checked |
| Vietnam | 1 | No | 2 | Laos/Cambodia, Thailand | Checked |
| Malaysia | 2 | No | 3 | Thailand, Indonesia, Australia | Checked |
| Indonesia | 1 | No | 2 | Malaysia, Philippines | Checked |
| Philippines | 2 | No | 2 | Indonesia, Japan | Checked |
| Taiwan | 3 | No | 2 | South Korea, Japan | Checked |
| Japan | 4 | Yes | 4 | South Korea, Taiwan, Philippines, USA | Checked |
| South Korea | 3 | Yes | 3 | North Korea, Japan, Taiwan | Checked |
| North Korea | 3 | Yes | 2 | USSR, South Korea | Checked |
| Australia | 4 | No | 1 | Malaysia | Checked |

#### Africa

| Space | Stability | Battleground | Degree | All direct neighbors | Audit |
|---|---:|---|---:|---|---|
| Morocco | 3 | No | 3 | Port./Spain, Algeria, West African States | Checked |
| Algeria | 2 | Yes | 4 | France, Morocco, Tunisia, Saharan States | Checked |
| Tunisia | 2 | No | 2 | Algeria, Libya | Checked |
| Saharan States | 1 | No | 2 | Algeria, Nigeria | Checked |
| West African States | 2 | No | 2 | Morocco, Ivory Coast | Checked |
| Ivory Coast | 2 | No | 2 | West African States, Nigeria | Checked |
| Nigeria | 1 | Yes | 3 | Saharan States, Ivory Coast, Cameroon | Checked |
| Cameroon | 1 | No | 2 | Nigeria, Zaire | Checked |
| Zaire | 1 | Yes | 3 | Cameroon, Angola, Zimbabwe | Checked |
| Angola | 1 | Yes | 3 | Zaire, Botswana, South Africa | Checked |
| South Africa | 3 | Yes | 2 | Angola, Botswana | Checked |
| Botswana | 2 | No | 3 | Angola, Zimbabwe, South Africa | Checked |
| Zimbabwe | 1 | No | 3 | Zaire, Botswana, SE African States | Checked |
| SE African States | 1 | No | 2 | Zimbabwe, Kenya | Checked |
| Kenya | 2 | No | 2 | SE African States, Somalia | Checked |
| Somalia | 2 | No | 2 | Kenya, Ethiopia | Checked |
| Ethiopia | 1 | No | 2 | Somalia, Sudan | Checked |
| Sudan | 1 | No | 2 | Ethiopia, Egypt | Checked |

#### Central America

| Space | Stability | Battleground | Degree | All direct neighbors | Audit |
|---|---:|---|---:|---|---|
| Mexico | 2 | Yes | 2 | USA, Guatemala | Checked |
| Guatemala | 1 | No | 3 | Mexico, El Salvador, Honduras | Checked |
| El Salvador | 1 | No | 2 | Guatemala, Honduras | Checked |
| Honduras | 2 | No | 4 | Guatemala, El Salvador, Nicaragua, Costa Rica | Checked |
| Nicaragua | 1 | No | 3 | Honduras, Costa Rica, Cuba | Checked |
| Costa Rica | 3 | No | 3 | Honduras, Nicaragua, Panama | Checked |
| Panama | 2 | Yes | 2 | Costa Rica, Colombia | Checked |
| Cuba | 3 | Yes | 3 | USA, Nicaragua, Haiti | Checked |
| Haiti | 1 | No | 2 | Cuba, Dominican R. | Checked |
| Dominican R. | 1 | No | 1 | Haiti | Checked |

#### South America

| Space | Stability | Battleground | Degree | All direct neighbors | Audit |
|---|---:|---|---:|---|---|
| Colombia | 1 | No | 3 | Panama, Venezuela, Ecuador | Checked |
| Venezuela | 2 | Yes | 2 | Colombia, Brazil | Checked |
| Ecuador | 2 | No | 2 | Colombia, Peru | Checked |
| Peru | 2 | No | 3 | Ecuador, Bolivia, Chile | Checked |
| Bolivia | 2 | No | 2 | Peru, Paraguay | Checked |
| Paraguay | 2 | No | 3 | Bolivia, Argentina, Uruguay | Checked |
| Chile | 3 | Yes | 2 | Peru, Argentina | Checked |
| Argentina | 2 | Yes | 3 | Chile, Paraguay, Uruguay | Checked |
| Uruguay | 2 | No | 3 | Paraguay, Argentina, Brazil | Checked |
| Brazil | 2 | Yes | 2 | Venezuela, Uruguay | Checked |


#### Superpower

| Space | Degree | All direct neighbors | Audit |
|---|---:|---|---|
| USA | 4 | Canada, Mexico, Cuba, Japan | Checked |
| USSR | 5 | Finland, Poland, Romania, Afghanistan, North Korea | Checked |

#### Optional variant

| Space | Direct printed connection | Audit |
|---|---|---|
| Chinese Civil War | USSR only | Checked; excluded from standard graph |

### Connection-by-connection audit

Every standard connection appears exactly once in this checklist. Edge IDs match the JSON file.

#### Europe

| Edge | Endpoint A | Endpoint B | Printed line | Audit |
|---|---|---|---|---|
| E001 | Canada | UK | solid brown | Checked |
| E002 | UK | Norway | solid brown | Checked |
| E003 | UK | Benelux | solid brown | Checked |
| E004 | UK | France | solid brown | Checked |
| E005 | Norway | Sweden | solid brown | Checked |
| E006 | Sweden | Finland | solid brown | Checked |
| E007 | Sweden | Denmark | solid brown | Checked |
| E008 | Denmark | W. Germany | solid brown | Checked |
| E009 | Benelux | W. Germany | solid brown | Checked |
| E010 | W. Germany | E. Germany | solid brown | Checked |
| E011 | W. Germany | France | solid brown | Checked |
| E012 | W. Germany | Austria | solid brown | Checked |
| E013 | E. Germany | Poland | solid brown | Checked |
| E014 | E. Germany | Czech. | solid brown | Checked |
| E015 | E. Germany | Austria | solid brown | Checked |
| E016 | Poland | Czech. | solid brown | Checked |
| E017 | Czech. | Hungary | solid brown | Checked |
| E018 | France | Port./Spain | solid brown | Checked |
| E019 | France | Italy | solid brown | Checked |
| E020 | Austria | Hungary | solid brown | Checked |
| E021 | Austria | Italy | solid brown | Checked |
| E022 | Port./Spain | Italy | solid brown | Checked |
| E023 | Italy | Yugoslavia | solid brown | Checked |
| E024 | Italy | Greece | solid brown | Checked |
| E025 | Hungary | Romania | solid brown | Checked |
| E026 | Hungary | Yugoslavia | solid brown | Checked |
| E027 | Yugoslavia | Romania | solid brown | Checked |
| E028 | Yugoslavia | Greece | solid brown | Checked |
| E029 | Romania | Turkey | solid brown | Checked |
| E030 | Bulgaria | Turkey | solid brown | Checked |
| E031 | Bulgaria | Greece | solid brown | Checked |
| E032 | Turkey | Greece | solid brown | Checked |

#### Middle East

| Edge | Endpoint A | Endpoint B | Printed line | Audit |
|---|---|---|---|---|
| E033 | Libya | Egypt | solid brown | Checked |
| E034 | Egypt | Israel | solid brown | Checked |
| E035 | Israel | Lebanon | solid brown | Checked |
| E036 | Israel | Syria | solid brown | Checked |
| E037 | Israel | Jordan | solid brown | Checked |
| E038 | Lebanon | Syria | solid brown | Checked |
| E039 | Lebanon | Jordan | solid brown | Checked |
| E040 | Iran | Iraq | solid brown | Checked |
| E041 | Iraq | Jordan | solid brown | Checked |
| E042 | Iraq | Saudi Arabia | solid brown | Checked |
| E043 | Iraq | Gulf States | solid brown | Checked |
| E044 | Jordan | Saudi Arabia | solid brown | Checked |
| E045 | Saudi Arabia | Gulf States | solid brown | Checked |

#### Asia

| Edge | Endpoint A | Endpoint B | Printed line | Audit |
|---|---|---|---|---|
| E046 | Afghanistan | Pakistan | solid brown | Checked |
| E047 | Pakistan | India | solid brown | Checked |
| E048 | India | Burma | solid brown | Checked |
| E049 | Burma | Laos/Cambodia | solid brown | Checked |
| E050 | Laos/Cambodia | Thailand | solid brown | Checked |
| E051 | Laos/Cambodia | Vietnam | solid brown | Checked |
| E052 | Thailand | Vietnam | solid brown | Checked |
| E053 | Thailand | Malaysia | solid brown | Checked |
| E054 | Malaysia | Indonesia | solid brown | Checked |
| E055 | Malaysia | Australia | solid brown | Checked |
| E056 | Indonesia | Philippines | solid brown | Checked |
| E057 | Philippines | Japan | solid brown | Checked |
| E058 | Japan | Taiwan | solid brown | Checked |
| E059 | Japan | South Korea | solid brown | Checked |
| E060 | Taiwan | South Korea | solid brown | Checked |
| E061 | South Korea | North Korea | solid brown | Checked |

#### Africa

| Edge | Endpoint A | Endpoint B | Printed line | Audit |
|---|---|---|---|---|
| E062 | Morocco | Algeria | solid brown | Checked |
| E063 | Morocco | West African States | solid brown | Checked |
| E064 | Algeria | Tunisia | solid brown | Checked |
| E065 | Algeria | Saharan States | solid brown | Checked |
| E066 | Saharan States | Nigeria | solid brown | Checked |
| E067 | West African States | Ivory Coast | solid brown | Checked |
| E068 | Ivory Coast | Nigeria | solid brown | Checked |
| E069 | Nigeria | Cameroon | solid brown | Checked |
| E070 | Cameroon | Zaire | solid brown | Checked |
| E071 | Zaire | Angola | solid brown | Checked |
| E072 | Zaire | Zimbabwe | solid brown | Checked |
| E073 | Angola | Botswana | solid brown | Checked |
| E074 | Angola | South Africa | solid brown | Checked |
| E075 | Botswana | South Africa | solid brown | Checked |
| E076 | Botswana | Zimbabwe | solid brown | Checked |
| E077 | Zimbabwe | SE African States | solid brown | Checked |
| E078 | SE African States | Kenya | solid brown | Checked |
| E079 | Kenya | Somalia | solid brown | Checked |
| E080 | Somalia | Ethiopia | solid brown | Checked |
| E081 | Ethiopia | Sudan | solid brown | Checked |

#### Central America

| Edge | Endpoint A | Endpoint B | Printed line | Audit |
|---|---|---|---|---|
| E082 | Mexico | Guatemala | solid brown | Checked |
| E083 | Guatemala | El Salvador | solid brown | Checked |
| E084 | Guatemala | Honduras | solid brown | Checked |
| E085 | El Salvador | Honduras | solid brown | Checked |
| E086 | Honduras | Nicaragua | solid brown | Checked |
| E087 | Honduras | Costa Rica | solid brown | Checked |
| E088 | Nicaragua | Costa Rica | solid brown | Checked |
| E089 | Nicaragua | Cuba | solid brown | Checked |
| E090 | Costa Rica | Panama | solid brown | Checked |
| E091 | Cuba | Haiti | solid brown | Checked |
| E092 | Haiti | Dominican R. | solid brown | Checked |

#### South America

| Edge | Endpoint A | Endpoint B | Printed line | Audit |
|---|---|---|---|---|
| E093 | Colombia | Venezuela | solid brown | Checked |
| E094 | Colombia | Ecuador | solid brown | Checked |
| E095 | Ecuador | Peru | solid brown | Checked |
| E096 | Peru | Bolivia | solid brown | Checked |
| E097 | Peru | Chile | solid brown | Checked |
| E098 | Bolivia | Paraguay | solid brown | Checked |
| E099 | Chile | Argentina | solid brown | Checked |
| E100 | Paraguay | Argentina | solid brown | Checked |
| E101 | Paraguay | Uruguay | solid brown | Checked |
| E102 | Argentina | Uruguay | solid brown | Checked |
| E103 | Uruguay | Brazil | solid brown | Checked |
| E104 | Brazil | Venezuela | solid brown | Checked |

#### Inter-regional

| Edge | Endpoint A | Endpoint B | Printed line | Audit |
|---|---|---|---|---|
| E105 | Port./Spain | Morocco | red dashed | Checked |
| E106 | France | Algeria | red dashed | Checked |
| E107 | Turkey | Syria | red dashed | Checked |
| E108 | Tunisia | Libya | red dashed | Checked |
| E109 | Egypt | Sudan | red dashed | Checked |
| E110 | Iran | Afghanistan | red dashed | Checked |
| E111 | Iran | Pakistan | red dashed | Checked |
| E112 | Panama | Colombia | red dashed | Checked |

#### Superpower

| Edge | Endpoint A | Endpoint B | Printed line | Audit |
|---|---|---|---|---|
| E113 | USA | Canada | black | Checked |
| E114 | USA | Mexico | black | Checked |
| E115 | USA | Cuba | black | Checked |
| E116 | USA | Japan | black | Checked |
| E117 | USSR | Finland | black | Checked |
| E118 | USSR | Poland | black | Checked |
| E119 | USSR | Romania | black | Checked |
| E120 | USSR | Afghanistan | black | Checked |
| E121 | USSR | North Korea | black | Checked |

| Edge | Endpoint A | Endpoint B | Printed line | Audit |
|---|---|---|---|---|
| V001 | USSR | Chinese Civil War | black | Checked; optional variant |

### Ambiguities explicitly checked

| Location | Confirmed interpretation |
|---|---|
| East Germany → Austria | The line descends beside West Germany and bends into Austria. It is a direct connection. |
| West Germany / Czechoslovakia | No direct connection; both connect to East Germany. |
| Austria / Czechoslovakia / Yugoslavia | Austria connects to neither Czechoslovakia nor Yugoslavia. |
| France / Benelux | No direct connection. Both connect to UK and West Germany. |
| Romania / Bulgaria | No direct connection. Romania connects to Turkey; Bulgaria connects to Turkey and Greece. |
| Norway / Denmark / Finland | Norway connects only to UK and Sweden. |
| Port./Spain → Italy | The brown line crosses France–Algeria’s dashed line without making a junction. |
| Israel → Syria and Lebanon → Jordan | The two lines cross without making a junction. Israel does not connect directly to Iraq. |
| Syria / Iraq and Iran / USSR | Neither pair has a direct connection. The long black line beside Iran terminates at Afghanistan. |
| Burma / Thailand | No direct connection; Burma connects to India and Laos/Cambodia. |
| Australia → Malaysia | The long diagonal reaches Malaysia. There is no Australia–Indonesia connection. |
| Philippines | Connects only to Japan and Indonesia; not Taiwan or Malaysia. |
| South Korea → Taiwan | The near-vertical line is a direct connection. Japan is also connected to both. |
| Honduras → Costa Rica | Direct connection, in addition to both countries connecting to Nicaragua. |
| Cuba | Connects to USA, Nicaragua, and Haiti; not Mexico. |
| Ethiopia / Kenya | No direct connection; the route passes through Somalia. |
| Angola / Zimbabwe | No direct connection; both connect to Zaire and Botswana. |
| Brazil | Connects only to Venezuela and Uruguay. |
| USA → Japan | Two map-edge arrows represent one undirected connection, counted once. |
| Chinese Civil War | One black link to USSR only; no links to surrounding Asian countries. |

### Machine-readable reference

[twilight-struggle-connectivity.json](../data/reference/twilight-struggle-connectivity.json) contains named nodes, reciprocal neighbor lists, uniquely identified edges with printed-line types, source metadata, audit counts, and the separate optional variant connection.
