// 09 · 结算小票, the way that was picked (2026-11-16), with what was asked for when it was picked:
//
//   1. slower. A line is printed, read, and only then the next one comes; every point a country adds is
//      seen leaving that country on the map and landing on its line. The paces are the constants below.
//   2. it stays. When the result has gone into the score, the slip remains, whole, with one button
//      (继续, or the space bar). Nothing is taken away until the player says so.
//   3. it explains itself, a layer at a time. The slip stays short: who, what standing, which countries
//      add a point, the totals, the result. Behind that:
//        - every rules word (计分, 存在, 支配, 控制, 战场国, 胜利点) is marked the way the cards mark them, and
//          under the pointer shows the game's own explanation;
//        - every country's name, under the pointer, shows that country's card and brings the map to it;
//        - each side has one line "控制 N 国 · 战场国 M/K" that says where its standing comes from; its
//          「明细」 opens the reason in a sentence and the full list of its countries.
//
// The words and the hover behaviour are the game's own (src/cards/terms.js, src/cards/tooltips.js): a
// span with data-term or data-country-ref is all it takes.
import { installTermHelp } from '../../src/cards/tooltips.js';
import { beat, boxOf, count, go, mid, mk, rem, sub, wait } from './kit';
import type { CountryView, Frame, SideView, Variant } from './types';
import { lead } from './view';

/** How long each kind of line is given before the next one. All of it is cut short by a click or the space bar. */
const PACE = {
  /** The heading: which area, and what each standing is worth. */
  head: 500,
  /** A side's standing. */
  standing: 380,
  /** Where the standing comes from. */
  why: 420,
  /** One country adding its point: the point leaves the map, flies, lands. */
  country: 420,
  /** A side's total, and the breath after it. */
  sum: 520,
  /** The two totals set against each other. */
  offset: 480,
  /** The result, before it is struck off and sent to the score. */
  result: 380,
};

const cl = (s: number): string => (s === 0 ? 'a' : 'b');
const quiet = (p: Promise<unknown>): void => void p.catch(() => undefined);
/** A rules word, marked as the cards mark it: under the pointer it shows the game's explanation. */
const GROUP: Record<string, string> = { battleground: 'influence' };
const term = (id: string, label: string): string => `<span class="game-term term-${GROUP[id] ?? 'scoring'}" data-term="${id}" tabindex="0" role="button" aria-label="${label}：查看解释">${label}</span>`;
/** A country's name: under the pointer it shows the country and brings the map to it. */
const land = (k: CountryView): string => `<span class="game-term game-ref term-influence" data-country-ref="${k.id}" tabindex="0" role="button" aria-label="${k.name}：查看地图局势">${k.name}</span>`;
const TIER: Record<string, string> = { presence: 'presence', domination: 'domination', control: 'region-control' };

/** The area with the right-hand side of the screen kept clear for the slip. */
const LEFT_OF_SLIP: Frame = { left: 0.26, top: 0.2, width: 0.44, height: 0.62 };

export const slip: Variant = {
  id: '09', name: '结算小票', sign: '右上角打出一张小票，打完留着', feel: '看得清 · 自己点继续',
  blurb: '右上角胜利点下面打出一张象牙色小票，一行一行出：档位、每个加分的国家（分数从地图上那个国家飞到这一行）、小计，最后是净得分。净得分砸下来记进胜利点以后，小票留在原处，点「继续」才收走。带虚线的词和国家，鼠标移上去能看解释、地图会转到那个国家；每一方的「明细」可以展开看档位是怎么来的。',
  risk: '比别的方案慢（欧洲约 7 秒，另加自己读的时间）；着急的时候点一下或按空格直接到结果。',
  frame: LEFT_OF_SLIP,
  async run(c) {
    const v = c.view;
    const mark = `<i class="sc-rifles">${c.rifles}</i>`;
    const sd = (S: SideView): string => `<i class="sc-sd ${cl(S.side)}">${S.short}</i>`;
    const tr = boxOf(document.querySelector('.hud-tr')!);
    // drawn larger than the HUD's type (zoom in style.css); an element's own offsets are scaled with it
    const Z = 1.22;
    const paper = mk('v09', '', { right: `${(innerWidth - tr.left - tr.width) / Z}px`, top: `${(tr.top + tr.height + rem(1.2)) / Z}px`, maxHeight: `${(innerHeight - tr.top - tr.height - rem(3)) / Z}px` });
    const list = sub(paper, 'v09-list');
    let printed = 0;
    /** A line comes out of the slip. */
    const print = (into: Element, cls: string, html: string): HTMLElement => {
      const row = sub(into, cls, html);
      quiet(go(row, [{ height: '0', opacity: 0 }, { height: `${row.scrollHeight}px`, opacity: 1 }], { ms: 150, fill: 'none' }));
      c.sound.clack(printed++ % 6);
      paper.scrollTop = paper.scrollHeight;
      return row;
    };
    quiet(go(paper, [{ opacity: 0, translate: '0 -1rem' }, { opacity: 1, translate: '0 0' }], { ms: 180 }));
    // The game's explanation is placed beside the word that asked for it, which here would be on the
    // slip. It belongs beside the whole slip, as it stands beside a whole card. (Merged into the game,
    // this is one line in src/cards/tooltips.js; from here it is done by moving the pane after the fact.)
    const help = document.getElementById('card-term-help');
    const aside = (): void => {
      if (!help || help.hidden || !paper.isConnected || !paper.querySelector('[aria-describedby="card-term-help"]')) return;
      const [slipBox, pane] = [boxOf(paper), boxOf(help)];
      const left = `${Math.max(12, slipBox.left - pane.width - 14)}px`;
      if (help.style.left !== left) help.style.left = left;
    };
    const watch = new ResizeObserver(aside);
    if (help) watch.observe(help);
    document.addEventListener('card-term-open', aside);
    const letGo = (): void => {
      watch.disconnect();
      document.removeEventListener('card-term-open', aside);
    };
    await wait(160);

    // ---- which area, and what each standing is worth
    const worth = v.rule
      ? `${term('presence', '存在')} ${v.rule.presence} · ${term('domination', '支配')} ${v.rule.domination} · ${term('region-control', '控制')} ${v.rule.control === 'win' ? '直接获胜' : v.rule.control}`
      : '逐国计分，没有档位';
    print(list, 'v09-line head', `<b>${v.name}${term('scoring', '计分')}</b><span>${worth}</span>`);
    await wait(PACE.head);

    // ---- each side in turn: its standing, where that comes from, the countries that add to it, its total
    for (const S of v.sides) {
      const side = S.side;
      const block = sub(list, `v09-block ${cl(side)}`);
      const ranked = v.rule !== null && S.standing !== 'none';
      quiet(c.wave(S.countries, side, 55));
      print(block, `v09-line side ${cl(side)}`, `<span>${sd(S)}${S.name}${ranked ? term(TIER[S.standing], S.tier) : `<em>${S.tier}</em>`}</span><b>${ranked ? S.base : S.countries.length ? '' : '0'}</b>`);
      await wait(PACE.standing);
      if (S.countries.length) {
        // the two numbers a standing comes from; the sentence and the full list are behind 明细
        const why = print(block, `v09-line why ${cl(side)}`, `<span>控制 <b>${S.countries.length}</b> 国${v.rule ? ` · ${term('battleground', '战场国')} <b>${S.keys}</b>/${v.keyIds.length}` : ''}</span><button type="button" class="v09-toggle" aria-expanded="false">明细</button>`);
        const more = sub(block, `v09-more ${cl(side)}`, `<p>${S.why}。</p><p class="v09-all">${S.countries.map((k) => `<span class="${k.excluded ? 'out' : ''}">${k.key ? mark : ''}${land(k)}${k.adjacent && k.pts ? '<u title="与对手的超级大国相邻：再加 1 分">邻</u>' : ''}${k.excluded ? '<small>本次不计</small>' : ''}</span>`).join('')}</p>`);
        more.hidden = true;
        const toggle = why.querySelector<HTMLButtonElement>('.v09-toggle')!;
        toggle.addEventListener('click', () => {
          more.hidden = !more.hidden;
          toggle.setAttribute('aria-expanded', String(!more.hidden));
          if (!more.hidden) {
            quiet(go(more, [{ height: '0', opacity: 0 }, { height: `${more.scrollHeight}px`, opacity: 1 }], { ms: 180, fill: 'none' }));
            quiet(c.wave(S.countries, side, 35, 0.9));
          }
        });
        // pointing at the line points at the countries it counts
        why.addEventListener('pointerenter', () => quiet(c.wave(S.countries, side, 30, 0.6)));
        await wait(PACE.why);
      } else {
        print(block, `v09-line why ${cl(side)}`, '<span class="v09-none">没有控制任何国家</span>');
        await wait(PACE.why * 0.7);
      }
      // every country that adds points: the points leave it on the map and land on its line
      for (const k of S.scoring) {
        const row = print(block, `v09-line item ${cl(side)}`, `<span>${k.key ? mark : ''}${land(k)}${k.adjacent ? '<u title="与对手的超级大国相邻：再加 1 分">邻</u>' : ''}</span><b class="v09-amount">+${k.pts}</b>`);
        const amount = row.querySelector<HTMLElement>('.v09-amount')!;
        amount.style.visibility = 'hidden';
        await c.pip(k, side, () => mid(boxOf(amount)), { text: `+${k.pts}`, ms: 220 });
        amount.style.visibility = '';
        beat(amount, 1.45, 200);
        c.sound.tick(Math.min(9, S.scoring.indexOf(k) + side * 2));
        await wait(Math.max(50, PACE.country - 370));
      }
      const sum = print(block, `v09-line sum ${cl(side)}`, `<span>小计</span><b>${ranked ? S.base : 0}</b>`);
      const total = sum.querySelector('b')!;
      if (S.total !== (ranked ? S.base : 0)) quiet(count(total, ranked ? S.base : 0, S.total, 220));
      else total.textContent = String(S.total);
      beat(total, 1.3, 220);
      c.sound.thock(1.1);
      await wait(PACE.sum);
    }
    for (const note of v.notes) print(list, 'v09-line note', `<span>${note}</span>`);

    // ---- the two totals set against each other, and what is left
    const hi = Math.max(v.sides[0].total, v.sides[1].total);
    const lo = Math.min(v.sides[0].total, v.sides[1].total);
    print(list, 'v09-line offset', `<span>两边相抵</span><b>${hi} − ${lo}</b>`);
    await wait(PACE.offset);
    const foot = sub(paper, `v09-foot ${v.lead === null ? 'none' : cl(v.lead)}`, v.lead === null ? '<span>双方抵消</span><b>±0</b>' : `<span>${v.sides[v.lead].name} 净得</span><b>+${v.net}</b>`);
    quiet(go(foot, [{ height: '0', opacity: 0 }, { height: `${foot.scrollHeight}px`, opacity: 1 }], { ms: 160, fill: 'none' }));
    paper.scrollTop = paper.scrollHeight;
    c.sound.thud(0.6);
    const band = sub(foot, 'sc-sheen');
    quiet(go(band, [{ translate: '-110% 0' }, { translate: '290% 0' }], { ms: 380, ease: 'ease-in-out', delay: 140 }).then(() => band.remove()));
    await wait(PACE.result);

    // ---- the result is struck off the line and goes into the score; the line stays to be read
    const at = mid(boxOf(foot));
    await c.land({ x: at.x - rem(3), y: at.y }, { delay: 260 });
    print(paper, 'v09-vp', `<span>${term('vp', '胜利点')}</span><b>${v.lead === null ? `不变 · ${lead(v.vpAfter, c.names)}` : `${lead(v.vpBefore, c.names)} → ${lead(v.vpAfter, c.names)}`}</b>`);

    // ---- and it stays until the player has read it
    const bar = print(paper, 'v09-go', '<span>带虚线的词和国家，移上去看解释</span><button type="button" class="v09-continue">继续<kbd>空格</kbd></button>');
    paper.scrollTop = paper.scrollHeight;
    await c.proceed(bar.querySelector<HTMLButtonElement>('.v09-continue')!).finally(letGo);
    installTermHelp().hide();
    c.sound.rip();
    await go(paper, [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '0 -1.6rem' }], { ms: 220, ease: 'ease-in' });
    paper.remove();
  },
};
