// The palette, the region metadata and the ten treatments this prototype compares.
// Nothing here is used by the game.

export type RegionMeta = {
  /** Region colour. Chosen clear of the two side colours (blue, red) and of the gold that marks key countries. */
  color: string;
  /** One character that stands for the region on a node. */
  letter: string;
  /** 1..6, used by the ground shader to pick a hatch pattern and to tell regions apart. */
  code: number;
  /** What the hatch pattern of treatment 08 looks like, for the legend. */
  pattern: string;
};

export const REGIONS: Record<string, RegionMeta> = {
  // Europe and Asia have the most coastline, so they get the two colours furthest from the sea's
  // own blue-green; the Middle East's teal sits on desert, where it stands out.
  europe: { color: '#ab8fff', letter: '欧', code: 1, pattern: '横线' },
  mideast: { color: '#2fc6b4', letter: '东', code: 2, pattern: '圆点' },
  africa: { color: '#b4d23c', letter: '非', code: 3, pattern: '斜线' },
  asia: { color: '#f27ab1', letter: '亚', code: 4, pattern: '竖线' },
  camerica: { color: '#dc9058', letter: '中', code: 5, pattern: '方格' },
  samerica: { color: '#4fc272', letter: '南', code: 6, pattern: '波纹' },
};

export type Variant = {
  id: string;
  name: string;
  /** Where the region is shown. */
  where: '节点' | '地面' | '连线' | '—';
  blurb: string;
  risk: string;
};

export const VARIANTS: Variant[] = [
  { id: '00', name: '现状', where: '—', blurb: '对照组：现在的地图，没有任何大区标识。', risk: '' },
  {
    id: '01',
    name: '铭牌底色',
    where: '节点',
    blurb: '铭牌整块换成大区色，影响力格嵌在里面。色块面积最大，拉到最远也认得出。',
    risk: '铭牌不再是统一的深色，蓝、红两格要和底色抢对比度。',
  },
  {
    id: '02',
    name: '彩色底座',
    where: '节点',
    blurb: '铭牌下面露出一道大区色的底边，像筹码的厚度。铭牌本身一个像素都不改。',
    risk: '色块只有一条边，拉远后变细；铭牌整体高了几个像素。',
  },
  {
    id: '03',
    name: '稳定度徽章',
    where: '节点',
    blurb: '左端的稳定度圆章换成大区色。不增加任何新元素，铭牌尺寸不变。',
    risk: '战场国原来靠金色圆章区分，现在只剩金色外圈和章内的金环。',
  },
  {
    id: '04',
    name: '大区字签',
    where: '节点',
    blurb: '铭牌右端加一格：近看是“欧、亚、非”这样一个字，拉远后收成一条色边。颜色之外多一个字，色弱也能读。',
    risk: '铭牌宽了一点，最远视角下相邻铭牌更挤。',
  },
  {
    id: '05',
    name: '名签旗框',
    where: '节点',
    blurb: '近看时国名印在大区色的名签上；拉远后国名变成旗帜，旗帜加一圈大区色边框。',
    risk: '名签比现在的描边文字更占地方；旗框面积小，远看偏弱。',
  },
  {
    id: '06',
    name: '领土染色',
    where: '地面',
    blurb: '整块领土薄薄罩一层大区色，像政区图。一眼能看出大区的形状和范围。',
    risk: '和控制方的蓝、红染色抢同一块面积；地貌的自然色被盖住一部分。',
  },
  {
    id: '07',
    name: '大区描边',
    where: '地面',
    blurb: '只沿大区的外缘和海岸描一圈色带，区内保持自然地貌，像旧地图册的分区描色。',
    risk: '内陆小国离大区边缘远，自己身上没有颜色；和控制方的内描边挨在一起。',
  },
  {
    id: '08',
    name: '大区纹理',
    where: '地面',
    blurb: '每个大区一种线纹（横线、圆点、斜线、竖线、方格、波纹），颜色之外多一重编码。',
    risk: '拉远后线纹细过像素，只剩一层淡色；和“有影响力但无人控制”的斜纹容易混。',
  },
  {
    id: '09',
    name: '连线着色',
    where: '连线',
    blurb: '区内连线改用大区色，跨区连线仍是红色虚线。大区就是一团同色的网。',
    risk: '线只有两三个像素宽，颜色不如色块好认；孤立看一个节点时要顺着线找。',
  },
  {
    id: '10',
    name: '大区底板',
    where: '地面',
    blurb: '沿节点和连线铺一块半透明的色板，把同一大区的节点圈在一起，不管国界怎么走。',
    risk: '色板跟着连线走，会盖到海面和别国领土上，和真实地理不完全重合。',
  },
];

/** The combination suggested in the README. */
export const RECOMMENDED = ['03', '09'];
