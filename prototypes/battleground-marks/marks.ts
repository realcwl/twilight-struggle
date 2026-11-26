// The ten battle marks this prototype compares, drawn as vector art. Nothing here is used by the game:
// mark 02 was the one picked, and the game has its own copy of it in src/map/battleMark.ts.
//
// A mark is one small picture a battleground country wears on its node, in place of the gold ring and
// gold stability badge the game used before. Three places to wear it:
//   corner   over the token's top-left corner, half on it and half off
//   halo     behind the token's left end, showing around the stability badge
//   foot     over the middle of the token's bottom edge
// Corner marks are drawn on a 32 x 32 field, halo marks on 48 x 48, foot marks on 40 x 20.
// Gradients (url(#bm-...)) are defined once for the page, in DEFS.

export type Place = 'corner' | 'halo' | 'foot';

export type Mark = {
  id: string;
  name: string;
  place: Place;
  /** What it is and why it could be the one. */
  blurb: string;
  /** What it costs. */
  risk: string;
  /** Moves a little when true: the flame flickers, the fuse sparks. */
  alive?: boolean;
  svg: string;
};

export const PLACE_NAME: Record<Place, string> = { corner: '左上角', halo: '稳定度背后', foot: '底边' };

export const DEFS = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <linearGradient id="bm-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde79a"/><stop offset=".5" stop-color="#f0bf4a"/><stop offset="1" stop-color="#b07f22"/></linearGradient>
  <radialGradient id="bm-lacquer" cx=".42" cy=".32" r=".8"><stop offset="0" stop-color="#54402b"/><stop offset=".6" stop-color="#2a1f15"/><stop offset="1" stop-color="#140e09"/></radialGradient>
  <linearGradient id="bm-steel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#eef0ee"/><stop offset="1" stop-color="#a9afb4"/></linearGradient>
  <linearGradient id="bm-fire" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffb52e"/><stop offset=".45" stop-color="#f26a22"/><stop offset="1" stop-color="#cf2a1f"/></linearGradient>
  <linearGradient id="bm-core" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fffbe0"/><stop offset="1" stop-color="#ffd24a"/></linearGradient>
  <radialGradient id="bm-burst" cx=".5" cy=".5" r=".5"><stop offset=".3" stop-color="#ffb52e"/><stop offset=".7" stop-color="#ee5a24"/><stop offset="1" stop-color="#c8281e"/></radialGradient>
  <linearGradient id="bm-helmet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2f5f3"/><stop offset=".5" stop-color="#b3bec0"/><stop offset="1" stop-color="#6d7a80"/></linearGradient>
  <radialGradient id="bm-iron" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#6d5c4d"/><stop offset=".5" stop-color="#2c221a"/><stop offset="1" stop-color="#120c08"/></radialGradient>
  <linearGradient id="bm-seal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2493a"/><stop offset="1" stop-color="#a91d17"/></linearGradient>
</defs></svg>`;

const INK = '#150e08';

/** A star whose points take their radius from the list, one after another. */
function star(cx: number, cy: number, radii: number[], turn = -90): string {
  return (
    radii
      .map((r, i) => {
        const a = ((turn + (i * 360) / radii.length) * Math.PI) / 180;
        return `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
      })
      .join('') + 'Z'
  );
}

// ---- 01: one sabre, point up, to be crossed with its mirror image
const SABRE =
  `<path d="M16 4.6C18.1 9.2 18.5 15 17.7 20.6H14.9C15.3 15 15.4 9.4 16 4.6Z" fill="url(#bm-steel)" stroke="${INK}" stroke-width=".7" stroke-linejoin="round"/>` +
  `<rect x="12.3" y="20.2" width="7.4" height="2.1" rx="1" fill="url(#bm-gold)" stroke="${INK}" stroke-width=".6"/>` +
  `<rect x="14.9" y="22.2" width="2.2" height="3.6" fill="#b07f22" stroke="${INK}" stroke-width=".6"/>` +
  `<circle cx="16" cy="26.6" r="1.55" fill="url(#bm-gold)" stroke="${INK}" stroke-width=".6"/>`;

// ---- 02: one rifle, muzzle to the right
const RIFLE =
  '<path d="M2.6 17.8L3.4 13.6L10.2 14.1L11.8 14.8H20.5V13.4H21.9V14.8L29.6 15V16.3L21.4 16.5L20.6 17.3H17.4L16.7 21.2L14.1 20.8L14.8 17.3H12.7L11.7 19.5L9.9 19.2L10.2 17.1L7.4 16.7Z" fill="#f6ead0"/>' +
  '<path d="M2.6 17.8L3.4 13.6L10.2 14.1V17.1L7.4 16.7Z" fill="url(#bm-gold)"/>';

export const MARKS: Mark[] = [
  {
    id: '01',
    name: '军刀章',
    place: 'corner',
    blurb: '黑漆圆章上两把交叉的军刀，金边。交叉刀剑本来就是地图上“交战”的通用记号，和界面里的黑漆、金线是同一套材质。',
    risk: '最稳妥也最常见，没有惊喜。圆章会压住铭牌左上角一小块。',
    svg:
      `<circle cx="16" cy="16" r="14.6" fill="url(#bm-lacquer)" stroke="${INK}" stroke-width="1.2"/>` +
      '<circle cx="16" cy="16" r="12.9" fill="none" stroke="url(#bm-gold)" stroke-width="2.7"/>' +
      `<g transform="rotate(-45 16 16)">${SABRE}</g><g transform="rotate(45 16 16)">${SABRE}</g>`,
  },
  {
    id: '02',
    name: '交叉步枪',
    place: 'corner',
    blurb: '两支交叉的步枪，没有底章，只有一圈深色描边，像国名那样直接压在地图上。比刀剑更有冷战的年代感。',
    risk: '拉到最远时和交叉刀剑一样，只剩一个“X”；枪的细节要近看才有。',
    svg:
      `<g stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" paint-order="stroke">` +
      `<g transform="rotate(-38 16 16)">${RIFLE}</g><g transform="translate(32 0) scale(-1 1) rotate(-38 16 16)">${RIFLE}</g></g>`,
  },
  {
    id: '03',
    name: '烽火',
    place: 'corner',
    alive: true,
    blurb: '一盆点着的烽火，火苗会轻轻跳动。不直接画武器，意思是“这里烽烟未息”；暖色的火在冷色的海和陆地上很跳。',
    risk: '会动的东西有 29 个，虽然幅度很小，仍比静止的标志抢眼。红橙色和苏联的红靠得近。',
    svg:
      `<g class="bm-flick"><path d="M16 2.6C17.4 7.6 23.4 10.6 23.4 17.4C23.4 22 20.2 25.2 16 25.2C11.8 25.2 8.6 22 8.6 17.4C8.6 14.4 10.2 12.4 11.8 10.8C12.2 12.9 13 14 14.1 14.5C13.5 10.4 14.5 5.8 16 2.6Z" fill="url(#bm-fire)" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
      '<path d="M16 12.8C17 15.4 19.6 16.6 19.6 19.8C19.6 22.2 18 23.8 16 23.8C14 23.8 12.4 22.2 12.4 20C12.4 18.5 13.2 17.5 14 16.6C14.4 17.7 14.9 18.2 15.5 18.4C15.2 16.5 15.4 14.5 16 12.8Z" fill="url(#bm-core)"/></g>' +
      `<path d="M7 23.6H25L22.4 29.4H9.6Z" fill="url(#bm-lacquer)" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/><path d="M7.4 24.4H24.6" stroke="url(#bm-gold)" stroke-width="1.7" stroke-linecap="round"/>`,
  },
  {
    id: '04',
    name: '爆芒',
    place: 'halo',
    blurb: '铭牌左端背后炸开一团星芒，稳定度的数字正好坐在爆心。不占铭牌上任何位置，只从四周露出尖角。',
    risk: '面积最大、颜色最热，一屏 29 个会比较闹。尖角会伸到旗帜和相邻铭牌的边上。',
    svg:
      `<path d="${star(24, 24, [23, 14.5, 20, 13.5, 23.5, 14.5, 19.5, 13.5, 22.5, 14.5, 20.5, 13.5, 23, 14.5, 19, 13.5])}" fill="url(#bm-burst)" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
      `<path d="${star(24, 24, [17, 11.5, 15, 11, 17.5, 11.5, 14.5, 11, 16.5, 11.5, 15.5, 11, 17, 11.5, 14.5, 11], -78)}" fill="#ffe27a"/>`,
  },
  {
    id: '05',
    name: '准星',
    place: 'halo',
    blurb: '铭牌左端套一圈金色准星：一个断开的圆环加四道刻线。最克制的一个，像是这个国家被标成了“目标”。',
    risk: '线细，拉到最远只是一圈淡淡的金弧，比现在的金圈还弱。',
    svg:
      `<g fill="none" stroke-linecap="round"><g stroke="${INK}" stroke-width="5"><path d="M10.1 13.4A17.6 17.6 0 0 1 21.6 6.6M26.4 6.6A17.6 17.6 0 0 1 37.9 13.4M37.9 34.6A17.6 17.6 0 0 1 26.4 41.4M21.6 41.4A17.6 17.6 0 0 1 10.1 34.6M24 1.6V8.6M24 39.4V46.4M1.6 24H8.6M39.4 24H46.4"/></g>` +
      '<g stroke="url(#bm-gold)" stroke-width="2.4"><path d="M10.1 13.4A17.6 17.6 0 0 1 21.6 6.6M26.4 6.6A17.6 17.6 0 0 1 37.9 13.4M37.9 34.6A17.6 17.6 0 0 1 26.4 41.4M21.6 41.4A17.6 17.6 0 0 1 10.1 34.6M24 1.6V8.6M24 39.4V46.4M1.6 24H8.6M39.4 24H46.4"/></g></g>',
  },
  {
    id: '06',
    name: '钢盔',
    place: 'corner',
    blurb: '一顶钢盔扣在铭牌左上角，像有人把它搁在了这个国家上。形状圆，和方的铭牌、尖的旗帜都不一样，好认。',
    risk: '画的是士兵而不是战斗，含义比刀剑绕一点。银灰色不带任何阵营色，但也不如金色、红色醒目。',
    svg:
      `<path d="M4.4 21.2C4.1 12.4 9.4 6 16.4 6C23.1 6 27.3 10.8 27.9 17.5L30 20.3C30.4 20.9 30 21.7 29.3 21.9C21 24.1 11.6 24.2 3.5 22.7C2.7 22.5 2.5 21.6 3.1 21.2Z" fill="url(#bm-helmet)" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` +
      '<path d="M4.6 20.4C12.2 22.2 21.6 21.7 28.4 18.6" fill="none" stroke="#2a3338" stroke-width="1.1" opacity=".75"/>' +
      '<path d="M8.4 14.2C9.8 10.8 12.4 9 15.6 8.7" fill="none" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round" opacity=".9"/>' +
      `<path d="M9.6 23.4C10.6 26.4 13 28 16 28" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><path d="M9.6 23.4C10.6 26.4 13 28 16 28" fill="none" stroke="#8a6a3a" stroke-width="1.2" stroke-linecap="round"/>`,
  },
  {
    id: '07',
    name: '火药桶',
    place: 'corner',
    alive: true,
    blurb: '一枚拖着引信的圆炸弹，引信头上的火星一闪一闪。“火药桶”本来就是对这类国家的说法：一点就着。',
    risk: '有点俏皮，比其他几个更像游戏、不那么严肃。黑色弹体靠一圈浅色描边才能从深色地图上分出来。',
    svg:
      '<path d="M20.8 11.6C22.4 8 25 9.2 26.4 6.4" fill="none" stroke="#150e08" stroke-width="3" stroke-linecap="round"/><path d="M20.8 11.6C22.4 8 25 9.2 26.4 6.4" fill="none" stroke="#d9b877" stroke-width="1.5" stroke-linecap="round"/>' +
      '<rect x="17.2" y="9.4" width="6" height="4.4" rx="1" transform="rotate(38 20.2 11.6)" fill="url(#bm-gold)" stroke="#150e08" stroke-width=".9"/>' +
      '<circle cx="14.2" cy="19.4" r="9.4" fill="url(#bm-iron)" stroke="#f3e6c4" stroke-width="1.9"/>' +
      '<path d="M8.6 16.2C9.6 13.4 11.8 11.9 14 11.7" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".5"/>' +
      `<path class="bm-spark" d="${star(27, 5.6, [4.6, 1.5, 3.4, 1.5, 4.6, 1.5, 3.4, 1.5])}" fill="#fff3b0" stroke="#f26a22" stroke-width=".8" stroke-linejoin="round"/>`,
  },
  {
    id: '08',
    name: '对峙',
    place: 'foot',
    blurb: '铭牌底边挂一枚小牌：蓝、红两个箭头顶在一起，中间迸出一点火花。直接画出“两边在这里交锋”。',
    risk: '用了蓝和红，而这两个颜色在铭牌上已经表示影响力和控制方，可能被读成“双方各占一半”。挂在下面会碰到南边邻国的旗帜。',
    svg:
      `<rect x="1.2" y="3.2" width="37.6" height="13.6" rx="6.8" fill="url(#bm-lacquer)" stroke="${INK}" stroke-width="1.2"/><rect x="2.4" y="4.4" width="35.2" height="11.2" rx="5.6" fill="none" stroke="url(#bm-gold)" stroke-width="1.2"/>` +
      '<path d="M6.4 6.4L16.2 10L6.4 13.6L8.8 10Z" fill="#5b97f5"/><path d="M33.6 6.4L23.8 10L33.6 13.6L31.2 10Z" fill="#f2553f"/>' +
      `<path d="${star(20, 10, [5.6, 1.7, 3.6, 1.7, 5.6, 1.7, 3.6, 1.7])}" fill="#fff6c8"/>`,
  },
  {
    id: '09',
    name: '坦克',
    place: 'corner',
    blurb: '一辆小小的金色坦克停在铭牌左上角。右下角“军事行动”那一栏用的也是坦克，两处是同一种语言。',
    risk: '和军事行动栏的坦克太像，可能让人以为这个国家“有军事行动”。横长的轮廓在窄铭牌上比圆章占地方。',
    svg:
      `<g stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" paint-order="stroke">` +
      '<rect x="20.4" y="11.9" width="10" height="2" rx=".7" fill="url(#bm-gold)"/><rect x="29.2" y="11.3" width="1.9" height="3.2" rx=".5" fill="url(#bm-gold)"/>' +
      '<path d="M11.2 16.2L12.6 10.8H20.4L21.8 16.2Z" fill="url(#bm-gold)"/><path d="M4.8 20.4L7.6 15.8H25L27.8 20.4Z" fill="url(#bm-gold)"/>' +
      '<rect x="3.2" y="19.6" width="26" height="7" rx="3.5" fill="#b07f22"/></g>' +
      `<g fill="${INK}"><circle cx="7.6" cy="23.1" r="1.9"/><circle cx="12.6" cy="23.1" r="1.9"/><circle cx="17.6" cy="23.1" r="1.9"/><circle cx="22.6" cy="23.1" r="1.9"/><circle cx="26.2" cy="23.1" r="1.3"/></g>`,
  },
  {
    id: '10',
    name: '朱印',
    place: 'corner',
    blurb: '一方朱红印章，白文一个“战”字，微微斜盖在铭牌角上。和大区字签是同一种做法：近看是一个字，拉远是一块颜色。',
    risk: '红色方块和苏联的影响力格是同一个红，拉远后最容易看混。字在最远视角下小到看不清。',
    svg:
      `<g transform="rotate(-8 16 16)"><rect x="4.4" y="4.4" width="23.2" height="23.2" rx="3.4" fill="url(#bm-seal)" stroke="${INK}" stroke-width="1.3"/>` +
      '<rect x="6.9" y="6.9" width="18.2" height="18.2" rx="1.8" fill="none" stroke="#fff3e2" stroke-width="1.1" opacity=".9"/>' +
      '<text class="bm-glyph" x="16" y="21.4" text-anchor="middle" font-size="14.5" font-weight="900" fill="#fff3e2">战</text></g>',
  },
];

/** The one I would have picked; the README says why. */
export const RECOMMENDED = '01';
/** The one that was picked, and is in the game now. */
export const PICKED = '02';
