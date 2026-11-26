// The ten ways this prototype shows that a country is controlled by one side. Nothing here is used by
// the game. Today the game says "controlled" twice: the country's land is tinted in the side's colour,
// and its token wears a thin ring of that colour inside the battleground's gold ring. Each variant
// adds one clearer sign to the token, the ground under it or the links; style.css draws them.

export type Variant = {
  id: string;
  name: string;
  /** Where the sign is drawn. */
  where: string;
  /** What it is and why it could be the one. */
  blurb: string;
  /** What it costs. */
  risk: string;
};

export const VARIANTS: Variant[] = [
  {
    id: '01',
    name: '整块染色',
    where: '整块铭牌',
    blurb: '被控制的国家，整块铭牌变成控制方的颜色，数字全部反白，稳定度变成一个白圈；没被控制的保持深色。',
    risk: '稳定度不再是米色圆章；对方在这里是 0 时，只剩一个淡淡的数字。拉远以后数字占了大半，色块没有想象的大。',
  },
  {
    id: '02',
    name: '加粗色框',
    where: '铭牌外框',
    blurb: '控制色从夹在金圈里面的细线，换到最外层：一道粗框加一圈光晕，金圈退到里面变细。',
    risk: '还是只靠颜色，只是更粗；节点挤在一起时光晕会碰到邻国。',
  },
  {
    id: '03',
    name: '阵营徽章',
    where: '右上角',
    blurb: '右上角钉一枚控制方的圆徽，写着“美”或“苏”，和左上角的步枪对称。',
    risk: '拉远以后字看不清，只剩一个色点。',
  },
  {
    id: '04',
    name: '垂旗',
    where: '数字下方',
    blurb: '控制方的那格数字下面垂下一面燕尾旗。蓝旗永远挂在左边那格，红旗永远挂在右边那格，位置和颜色一起说话。',
    risk: '旗子伸到铭牌下面，会盖住一小段往南的连线。',
  },
  {
    id: '05',
    name: '底座',
    where: '铭牌下方',
    blurb: '铭牌站在一块控制方颜色的底座上，比铭牌宽一圈。远看是铭牌下面一道粗色条。',
    risk: '比较含蓄；红蓝相邻时只是两道色条的区别。',
  },
  {
    id: '06',
    name: '地面色盘',
    where: '地图上',
    blurb: '节点脚下的地图上铺一块控制方颜色的圆盘。相邻的同色圆盘连成一片，一眼看出势力范围。',
    risk: '圆盘会压住节点附近的地形和连线；和国土染色是同一类信息，叠在一起偏重。',
  },
  {
    id: '07',
    name: '同盟连线',
    where: '连线',
    blurb: '两端都被同一方控制的连线，换成那一方的颜色。蓝网和红网各自连成一片，孤立的据点一眼可见。',
    risk: '单独一个被控制的国家没有变化，需要和别的方案搭配。',
  },
  {
    id: '08',
    name: '胜方数字凸起',
    where: '控制方的数字',
    blurb: '控制方的那格数字从铭牌里凸出来：更高、更大、带白边。不看颜色，看大小就知道谁控制。',
    risk: '铭牌不再是整齐的一条；拉远以后凸起只比原来的格子高一点，冲击力小很多。',
  },
  {
    id: '09',
    name: '盾牌',
    where: '铭牌背后',
    blurb: '铭牌背后垫一面控制方颜色的盾牌，上面露出一道边，下面露出盾尖。有盾就是有主。',
    risk: '盾尖往下伸，节点密的地方会碰到南边邻国的旗子。',
  },
  {
    id: '10',
    name: '只有控制才满色',
    where: '数字格',
    blurb: '不加东西，改含义：没控制时，影响力只是彩色数字加一道底线；控制了，那一格才整格涂满。满色格子就等于控制。',
    risk: '最安静的一个；只有影响力、没控制的国家会比现在暗一些。',
  },
];

/** Decided after looking at all ten on the map; see README.md. */
export const RECOMMENDED: string[] = ['09'];
