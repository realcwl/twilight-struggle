// Ten ways of showing one scoring. Each is given the same numbers (ctx.view) and the same stage (the map,
// the tokens, the points that leave them, the ending in the HUD), and decides only where the information
// is put and how it comes together. None has pages or buttons; each is over in three to four seconds.
import { BACK, IN, INOUT, beat, boxOf, bump, clamp, count, easeIn, easeInOut, enter, flash, fly, go, gone, hitStop, mid, mk, popIn, put, quake, rays, rem, ring, shake, sparks, sub, t, tween, wait, type Pt } from './kit';
import { slip } from './slip';
import type { CountryView, Ctx, Frame, Side, SideView, Variant } from './types';

const SIDES: Side[] = [0, 1];
const cl = (s: number): string => (s === 0 ? 'a' : 'b');
const sd = (s: SideView): string => `<i class="sc-sd ${cl(s.side)}">${s.short}</i>`;
const title = (c: Ctx): string => `<span class="sc-title"><b>${c.view.name}</b><span>计分</span></span>`;
const q = (root: Element, sel: string): HTMLElement => root.querySelector<HTMLElement>(sel)!;
/** How much larger than the HUD's own type a scoring is drawn: for a few seconds it is the main thing on screen. */
const Z = 1.16;
/** Something hung under the top edge, between the HUD's two top corners. */
const hang = (c: Ctx, cls: string, html: string): HTMLElement => {
  const el = mk(`sc-hang ${cls}`, html);
  el.style.setProperty('zoom', String(Z));
  // an element's own offsets are scaled with it
  el.style.top = `${c.free.top / Z}px`;
  // the middle of the room between the two top corners, which is not the middle of the screen
  el.style.left = `${(c.free.left + c.free.width / 2) / Z}px`;
  return el;
};
const rifles = (c: Ctx): string => `<i class="sc-rifles">${c.rifles}</i>`;
const quiet = (p: Promise<unknown>): void => void p.catch(() => undefined);
/** A band of light passes over something that has just won. The thing must be positioned and clip. */
const sheen = (over: Element, ms = 360): void => {
  const band = sub(over, 'sc-sheen');
  quiet(go(band, [{ translate: '-110% 0' }, { translate: '290% 0' }], { ms, ease: 'ease-in-out' }).then(() => band.remove()));
};
/** A few pieces thrown off the stretch between two boxes: something has been broken there. */
const crumble = (first: Element, last: Element, color: string | string[], n = 8): void => {
  const [a, b] = [boxOf(first), boxOf(last)];
  const l = Math.min(a.left, b.left);
  const r = Math.max(a.left + a.width, b.left + b.width);
  for (let i = 0; i < n; i++) sparks({ x: l + ((r - l) * (i + 0.5)) / n, y: a.top + a.height / 2 }, color, 3, rem(4.5), { ms: 440, size: 5, dir: Math.PI / 2, spread: Math.PI * 1.3 });
};

/** The area under a strip hung at the top. */
const UNDER_STRIP: Frame = { left: 0.27, top: 0.3, width: 0.56, height: 0.52 };
/** The area with room on both sides of it. */
const BETWEEN: Frame = { left: 0.36, top: 0.27, width: 0.36, height: 0.54 };
/** The area under something taller. */
const UNDER_TALL: Frame = { left: 0.27, top: 0.39, width: 0.56, height: 0.44 };

// ================================================================ 01 · 拔河条
const tug: Variant = {
  id: '01', name: '拔河条', sign: '一根横条，两头往中间长', feel: '稳 · 一眼看多少',
  blurb: '顶部一根横条，每一格是 1 分：蓝从左边长，红从右边长。档位是一整块，战场国和邻接是从地图上飞来的小格。两边一样长的部分一起划掉，剩下的那一段就是净得分，飞进胜利点。',
  risk: '条上不写国名，哪些国家加了分要看地图上谁跳了一下。',
  frame: UNDER_STRIP,
  async run(c) {
    const v = c.view;
    const [A, B] = v.sides;
    const units = Math.max(12, A.total + B.total + 1);
    const pane = hang(c, 'sc-pane v01', `
      <div class="v01-head"><span class="v01-who a">${sd(A)}<em>${A.name}</em><b class="v01-tier"></b></span>${title(c)}<span class="v01-who b"><b class="v01-tier"></b><em>${B.name}</em>${sd(B)}</span></div>
      <div class="v01-track" style="--u:${(48 / units).toFixed(3)}rem"><b class="v01-num a">0</b><div class="v01-bars"><div class="v01-bar a"><div class="v01-base"></div></div><div class="v01-bar b"><div class="v01-base"></div></div></div><b class="v01-num b">0</b></div>`);
    quiet(enter(pane, 200));
    const bars = SIDES.map((s) => q(pane, `.v01-bar.${cl(s)}`));
    const nums = SIDES.map((s) => q(pane, `.v01-num.${cl(s)}`));
    const shown = [0, 0];
    const cell = (into: Element, extra = ''): void => {
      const e = sub(into, `v01-cell ${extra}`);
      quiet(go(e, [{ width: '0', opacity: 0.4 }, { width: 'var(--u)', opacity: 1 }], { ms: 180 }));
    };
    await wait(150);
    // the standing: one block, as long as it is worth
    quiet(c.waves());
    for (const s of SIDES) {
      const S = v.sides[s];
      const tier = q(pane, `.v01-who.${cl(s)} .v01-tier`);
      tier.textContent = S.tier;
      quiet(popIn(tier, 220, 0.5));
      const base = q(bars[s], '.v01-base');
      for (let i = 0; i < S.base; i++) cell(base);
      if (S.base) sub(base, 'v01-label', `${S.tier} <b>${S.base}</b>`);
      shown[s] = S.base;
      quiet(count(nums[s], 0, S.base, 240));
    }
    c.sound.thud(0.6);
    await wait(400);
    // what the countries add: one cell each
    const tip = (s: Side): Pt => {
      const r = boxOf(bars[s]);
      return { x: s === 0 ? r.left + r.width : r.left, y: r.top + r.height / 2 };
    };
    await c.pips(tip, (s, k) => {
      for (let i = 0; i < k.pts; i++) cell(bars[s], 'plus');
      shown[s] += k.pts;
      nums[s].textContent = String(shown[s]);
      beat(nums[s], 1.25, 180);
    });
    await wait(280);
    // what both have is struck out of both
    const lo = Math.min(A.total, B.total);
    if (lo > 0) {
      const doomed = SIDES.flatMap((s) => [...bars[s].querySelectorAll('.v01-cell')].slice(-lo));
      for (const d of doomed) d.classList.add('x');
      for (const l of pane.querySelectorAll('.v01-label')) quiet(gone(l, 140));
      c.sound.clack(0);
      await wait(190);
      // and they break: both stretches go to pieces at once
      for (const s of SIDES) {
        const mine = doomed.filter((d) => bars[s].contains(d));
        if (mine.length) crumble(mine[0], mine[mine.length - 1], ['#8a7a62', '#c9b890', c.pal[s].light], Math.min(9, mine.length + 2));
      }
      c.sound.shatter();
      quake(2 + 2 * c.weight(), 200);
      await Promise.all([...doomed.map((d) => go(d, [{ width: 'var(--u)', margin: '0 1px', opacity: 1 }, { width: '0', margin: '0', opacity: 0 }], { ms: 260, ease: INOUT })), ...SIDES.map((s) => count(nums[s], v.sides[s].total, v.sides[s].total - lo, 260))]);
      for (const d of doomed) d.remove();
    }
    if (v.lead !== null) {
      // what is left standing is the result: it lights up
      bars[v.lead].classList.add('won');
      sheen(bars[v.lead]);
      nums[v.lead].textContent = `+${v.net}`;
      beat(nums[v.lead], 1.5, 240);
      quiet(go(nums[1 - v.lead], [{ opacity: 1 }, { opacity: 0.25 }], { ms: 200 }));
      c.sound.clink(2);
    }
    await wait(200);
    await c.land(v.lead === null ? mid(boxOf(q(pane, '.v01-bars'))) : mid(boxOf(nums[v.lead])));
  },
};

// ================================================================ 02 · 地图盖章
const stamps: Variant = {
  id: '02', name: '地图盖章', sign: '档位直接盖在地图上', feel: '轻 · 不挡地图',
  blurb: '没有面板。每一方的档位像印章一样盖在它控制的那片国家上方；加分的国家各自冒出 +1，飞进区域上方的一行比分；小的那边被大的吃掉，剩下的飞进胜利点。',
  risk: '印章会压住一两个国家约一秒；信息都在地图上，眼睛要跟着跑。',
  frame: UNDER_STRIP,
  async run(c) {
    const v = c.view;
    const [A, B] = v.sides;
    const area = c.area();
    const m = mid(area);
    const head = put('v02-head', { x: m.x, y: Math.max(c.free.top + rem(3.6), area.top - rem(9)) }, `${title(c)}<div class="v02-line"><span class="a">${sd(A)}<b class="v02-n">0</b></span><i>:</i><span class="b"><b class="v02-n">0</b>${sd(B)}</span></div>`);
    quiet(popIn(head, 220, 0.8));
    const nums = [...head.querySelectorAll<HTMLElement>('.v02-n')] as [HTMLElement, HTMLElement];
    const shown = [0, 0];
    const add = (s: Side, n: number): void => {
      shown[s] += n;
      nums[s].textContent = String(shown[s]);
      beat(nums[s], 1.3, 180);
    };
    await wait(160);
    // each side's standing is stamped over the countries that make it
    const spots = SIDES.map((s) => {
      const pts = v.sides[s].countries.map((k) => c.tok(k.id)?.box()).filter((b): b is NonNullable<typeof b> => !!b);
      if (!pts.length) return null;
      return { x: pts.reduce((n, b) => n + b.left + b.width / 2, 0) / pts.length, y: Math.min(...pts.map((b) => b.top)) - rem(4.6) };
    });
    // two stamps that would sit on each other step apart
    if (spots[0] && spots[1] && Math.abs(spots[0].x - spots[1].x) < rem(20) && Math.abs(spots[0].y - spots[1].y) < rem(7)) {
      const left = spots[0].x <= spots[1].x ? 0 : 1;
      const mx = (spots[0].x + spots[1].x) / 2;
      spots[left]!.x = mx - rem(10.5);
      spots[1 - left]!.x = mx + rem(10.5);
    }
    const made = SIDES.map((s) => {
      const p = spots[s];
      const S = v.sides[s];
      if (!p) return null;
      const el = put(`v02-stamp ${cl(s)}`, { x: clamp(p.x, c.free.left + rem(8), c.free.left + c.free.width - rem(8)), y: Math.max(p.y, c.free.top + rem(11)) }, `<em>${S.tier}</em>${S.base ? `<b>${S.base}</b>` : ''}`);
      quiet(go(el, [{ opacity: 0, scale: '2.1', rotate: '-10deg' }, { opacity: 1, scale: '1', rotate: '-4deg' }], { ms: 210, ease: IN, delay: s * 90 }));
      return el;
    });
    quiet(c.waves(35));
    await wait(230);
    c.sound.thud(0.8);
    for (const el of made) if (el) ring(mid(boxOf(el)), 'rgba(255,247,228,.7)', { from: rem(6), to: rem(17), ms: 360, width: 2 });
    await wait(260);
    // what the standing is worth goes up to the line
    await Promise.all(
      SIDES.map(async (s) => {
        const el = made[s];
        const S = v.sides[s];
        if (!el || !S.base) return;
        const from = mid(boxOf(el));
        const chip = put(`sc-pip ${cl(s)}`, from, String(S.base));
        await fly(chip, from, mid(boxOf(nums[s])), { ms: 260, scale: [1.3, 0.85] });
        chip.remove();
        add(s, S.base);
        c.sound.tick(s);
      }),
    );
    for (const el of made) if (el) quiet(go(el, [{ opacity: 1 }, { opacity: 0.4 }], { ms: 200 }));
    await c.pips((s) => mid(boxOf(nums[s])), (s, k) => add(s, k.pts));
    await wait(260);
    const at = await c.net(nums);
    const lead = v.lead;
    if (lead === null) {
      for (const el of made) if (el) quiet(gone(el, 220));
    } else {
      // the one that won is stamped again, hard; the other falls off the map
      const [win, lose] = [made[lead], made[1 - lead]];
      if (lose) quiet(go(lose, [{ opacity: 0.4, rotate: '-4deg', translate: '0 0' }, { opacity: 0, rotate: '-18deg', translate: '0 3rem' }], { ms: 280, ease: IN }));
      if (win) {
        await go(win, [{ opacity: 0.4, scale: '1.7' }, { opacity: 1, scale: '1' }], { ms: 150, ease: IN });
        c.sound.stamp(1.2);
        quake(2 + 2.5 * c.weight(), 200);
        ring(mid(boxOf(win)), c.pal[lead].light, { from: rem(6), to: rem(22), ms: 420, width: 3 });
        sparks(mid(boxOf(win)), [c.pal[lead].light, '#fff'], 12, rem(9), { ms: 480, size: 5 });
        await wait(60);
        quiet(gone(win, 420));
      }
    }
    await c.land(at);
  },
};

// ================================================================ 03 · 比分牌
const board: Variant = {
  id: '03', name: '比分牌', sign: '两行四列，一列一列亮', feel: '快 · 最好读',
  blurb: '像体育比赛的比分条：一行美国，一行苏联；列是「档位 · 战场国 · 邻接 · 合计」。一列一列从左到右填上，填哪一列，地图上对应的国家就跳一下、把 +1 送进那一格。最后小的合计并进大的，变成净得分。',
  risk: '是表格，比较“冷”；但每个数从哪来最清楚。',
  frame: UNDER_STRIP,
  async run(c) {
    const v = c.view;
    const cols: [string, string, string][] = v.rule ? [['tier', '档位', ''], ['key', '战场国', '各 +1'], ['adj', '邻接', '各 +1'], ['sum', '合计', '']] : [['tier', '控制', ''], ['key', '逐国得分', ''], ['sum', '合计', '']];
    const pane = hang(c, 'sc-pane v03', `<div class="v03-grid" style="--cols:${cols.length}">
      <div class="v03-corner">${title(c)}</div>${cols.map(([k, h, hint]) => `<div class="v03-h ${k}">${h}${hint ? `<small>${hint}</small>` : ''}</div>`).join('')}
      ${v.sides.map((S) => `<div class="v03-who ${cl(S.side)}">${sd(S)}<em>${S.name}</em></div>${cols.map(([k]) => `<div class="v03-c ${k} ${cl(S.side)}"></div>`).join('')}`).join('')}
    </div>`);
    quiet(enter(pane, 180));
    const cell = (k: string, s: Side): HTMLElement => q(pane, `.v03-c.${k}.${cl(s)}`);
    const head = (k: string): void => q(pane, `.v03-h.${k}`).classList.add('on');
    const dash = '<i class="v03-dash">—</i>';
    await wait(150);
    // the standing
    head('tier');
    quiet(c.waves());
    for (const s of SIDES) {
      const S = v.sides[s];
      const e = cell('tier', s);
      e.innerHTML = v.rule ? `<em>${S.tier}</em>${S.standing === 'none' ? '' : `<b>${S.base}</b>`}` : `<b>${S.countries.length}</b><em>国</em>`;
      quiet(popIn(e, 200, 0.6, s * 70));
    }
    c.sound.tick(0);
    await wait(330);
    // one column of what countries add
    const column = async (k: string, of: (x: CountryView) => number): Promise<void> => {
      head(k);
      const lists = SIDES.map((s) => v.sides[s].scoring.filter((x) => of(x) > 0));
      const cells = SIDES.map((s) => cell(k, s));
      const got = [0, 0];
      for (const s of SIDES) if (!lists[s].length) cells[s].innerHTML = dash;
      if (!lists[0].length && !lists[1].length) return wait(110);
      await Promise.all(
        SIDES.flatMap((s) =>
          lists[s].map((x, i) =>
            c.pip(x, s, () => mid(boxOf(cells[s])), { delay: i * 70, text: `+${of(x)}`, ms: 280 }).then(() => {
              got[s] += of(x);
              cells[s].innerHTML = `<b>+${got[s]}</b>`;
              beat(cells[s], 1.22, 160);
              c.sound.tick(i + s * 2);
            }),
          ),
        ),
      );
      await wait(110);
    };
    if (v.rule) {
      await column('key', (x) => Number(x.key));
      await column('adj', (x) => Number(x.adjacent));
    } else await column('key', (x) => x.pts);
    // the totals
    head('sum');
    const sums = SIDES.map((s) => {
      const e = cell('sum', s);
      e.innerHTML = '<b>0</b>';
      quiet(count(q(e, 'b'), 0, v.sides[s].total, 240));
      return q(e, 'b');
    }) as [HTMLElement, HTMLElement];
    c.sound.thud(0.5);
    await wait(360);
    const at = await c.net(sums);
    if (v.lead !== null) {
      // the winning row is lit from end to end; the other steps back
      q(pane, `.v03-who.${cl(v.lead)}`).classList.add('win');
      for (const e of pane.querySelectorAll(`.v03-c.${cl(1 - v.lead)}, .v03-who.${cl(1 - v.lead)}`)) e.classList.add('lost');
      const light = sub(q(pane, '.v03-grid'), `v03-row-light ${cl(v.lead)}`);
      light.style.gridRow = String(2 + v.lead);
      quiet(go(light, [{ opacity: 0 }, { opacity: 1 }], { ms: 140 }));
      sheen(light, 380);
      c.sound.clink(3);
      await wait(70);
    }
    await c.land(at);
  },
};

// ================================================================ 04 · 天平
const scale: Variant = {
  id: '04', name: '天平', sign: '两个托盘，谁重往谁倾', feel: '直观 · 有分量',
  blurb: '顶部一架天平。档位是一块大砝码，先落到两边托盘上；战场国和邻接是从地图上飞来的小砝码。天平随着砝码一点点倾斜，倾向谁、差多少，支点上的数字就是净得分。',
  risk: '不需要“抵消”这一步，所以比较短；但天平占的高度最多，地图要往下让。',
  frame: UNDER_TALL,
  async run(c) {
    const v = c.view;
    const root = hang(c, 'sc-pane v04', `<div class="v04-head">${title(c)}</div><div class="v04-rig">
        <div class="v04-beam"><i class="v04-rod"></i>${v.sides.map((S) => `<div class="v04-pan ${cl(S.side)}"><i class="v04-chain"></i><div class="v04-stack"></div><i class="v04-plate"></i><div class="v04-foot">${sd(S)}<b class="v04-num">0</b></div></div>`).join('')}</div>
        <i class="v04-post"></i><div class="v04-dial"><b></b></div></div>`);
    root.style.setProperty('--ms', `${Math.round(t(340))}ms`);
    quiet(enter(root, 200));
    const stacks = SIDES.map((s) => q(root, `.v04-pan.${cl(s)} .v04-stack`));
    const nums = SIDES.map((s) => q(root, `.v04-pan.${cl(s)} .v04-num`));
    const shown = [0, 0];
    const lean = (): void => root.style.setProperty('--tilt', `${clamp((shown[1] - shown[0]) * 1.5, -10, 10).toFixed(1)}deg`);
    const weigh = (s: Side, n: number, html: string, cls: string): void => {
      const w = sub(stacks[s], `v04-w ${cls} ${cl(s)}`, html);
      quiet(go(w, [{ opacity: 0, translate: '0 -2.6rem' }, { opacity: 1, translate: '0 0' }], { ms: 170, ease: IN }));
      shown[s] += n;
      nums[s].textContent = String(shown[s]);
      beat(nums[s], 1.25, 180);
      lean();
    };
    await wait(170);
    // the standing: one large weight on each pan
    quiet(c.waves());
    for (const s of SIDES) {
      const S = v.sides[s];
      if (v.rule && S.standing !== 'none') weigh(s, S.base, `<em>${S.tier}</em><b>${S.base}</b>`, 'base');
      else if (!S.total) sub(stacks[s], 'v04-none', '无');
    }
    c.sound.thud(0.9);
    await wait(430);
    // the small ones come off the map
    await c.pips((s) => {
      const r = boxOf(stacks[s]);
      return { x: r.left + r.width / 2, y: r.top + r.height - rem(1) };
    }, (s, k) => weigh(s, k.pts, `+${k.pts}`, 'plus'));
    await wait(420);
    // what the scale says
    const dial = q(root, '.v04-dial');
    if (v.lead !== null) {
      // the heavier pan comes down hard, past where it will rest, and the table feels it
      const rest = clamp((shown[1] - shown[0]) * 1.5, -10, 10);
      root.style.setProperty('--tilt', `${(rest + Math.sign(rest) * 5).toFixed(1)}deg`);
      await wait(170);
      c.sound.thud(1 + 0.3 * c.weight());
      bump(3 + 3 * c.weight(), 220);
      const plate = boxOf(q(root, `.v04-pan.${cl(v.lead)} .v04-plate`));
      sparks({ x: plate.left + plate.width / 2, y: plate.top + plate.height }, ['#d8c28a', '#fff7e4', c.pal[v.lead].light], 14, rem(7), { ms: 480, size: 5, dir: Math.PI / 2, spread: Math.PI * 1.2 });
      root.style.setProperty('--tilt', `${rest.toFixed(1)}deg`);
      dial.classList.add(cl(v.lead), 'on');
      q(dial, 'b').textContent = `+${v.net}`;
      quiet(popIn(dial, 220, 0.4));
      c.sound.clink(2);
      await wait(170);
    }
    await c.land(mid(boxOf(dial)));
  },
};

// ================================================================ 05 · 对撞
const clash: Variant = {
  id: '05', name: '对撞', sign: '两枚徽章，撞一下定胜负', feel: '有打击感',
  blurb: '区域两侧各一枚徽章，写着这一方的档位和分数；加分从地图上飞进徽章。数完，两枚徽章对冲相撞：小的碎掉，大的被撞掉同样多的分，剩下的就是净得分，飞进胜利点。',
  risk: '最热闹的一个；连着计好几个区域时可能嫌吵。',
  frame: BETWEEN,
  async run(c) {
    const v = c.view;
    const area = c.area();
    const m = mid(area);
    const y = clamp(m.y, c.under + rem(8), innerHeight - rem(30));
    const xs = [Math.max(rem(42), area.left - rem(10)), Math.min(innerWidth - rem(12), area.left + area.width + rem(10))];
    const head = put('v05-head', { x: m.x, y: Math.max(c.free.top + rem(1.6), area.top - rem(7.5)) }, title(c));
    quiet(popIn(head, 200, 0.8));
    const meds = SIDES.map((s) => {
      const S = v.sides[s];
      const el = put(`v05-med ${cl(s)}`, { x: xs[s], y }, `<i class="v05-top">${S.short}</i><b class="v05-num">${S.base}</b><em class="v05-tier">${S.tier}</em>`);
      quiet(popIn(el, 240, 0.4, s * 60));
      return el;
    });
    const nums = meds.map((e) => q(e, '.v05-num'));
    const shown = v.sides.map((S) => S.base);
    quiet(c.waves());
    c.sound.thud(0.7);
    await wait(380);
    await c.pips((s) => mid(boxOf(meds[s])), (s, k) => {
      shown[s] += k.pts;
      nums[s].textContent = String(shown[s]);
      beat(meds[s], 1.1, 170);
    });
    await wait(300);
    // one side with nothing: there is no one to run into
    if (v.lead !== null && v.sides[1 - v.lead].total === 0) {
      quiet(gone(meds[1 - v.lead], 240));
      quiet(gone(q(meds[v.lead], '.v05-tier'), 160));
      nums[v.lead].textContent = `+${v.net}`;
      beat(meds[v.lead], 1.18, 240);
      c.sound.tick(4);
      await wait(360);
      quiet(gone(meds[v.lead], 160));
      return c.land({ x: xs[v.lead], y }, { delay: 160 });
    }
    // they charge
    const meet = { x: m.x, y: Math.max(c.free.top + rem(9), area.top - rem(1)) };
    const half = rem(5.4);
    quiet(gone(head, 160));
    await Promise.all(meds.map((el, s) => go(el, [{ translate: '0 0' }, { translate: `${s === 0 ? -1.6 : 1.6}rem 0` }], { ms: 150, ease: 'ease-out' })));
    c.sound.whoosh(0.16);
    await Promise.all(meds.map((el, s) => fly(el, { x: xs[s], y }, { x: meet.x + (s === 0 ? -half : half), y: meet.y }, { ms: 230, lift: 0, ease: easeIn })));
    c.sound.thud(1.2);
    c.sound.crack();
    flash('#fff7e4', 0.3, 220);
    ring(meet, '#fff7e4', { from: rem(3), to: rem(24), ms: 400, width: 5 });
    sparks(meet, ['#ffe9a8', '#fff', c.pal[0].light, c.pal[1].light], 22, rem(13), { ms: 560, size: 6 });
    // the frame of the blow is held
    await hitStop(80);
    quake(6 + 4 * c.weight(), 320);
    shake(meds, 7, 240);
    if (v.lead === null) {
      await wait(120);
      for (const [s, el] of meds.entries()) {
        sparks(mid(boxOf(el)), c.pal[s as Side].light, 10, rem(7));
        quiet(go(el, [{ opacity: 1, scale: '1' }, { opacity: 0, scale: '.5' }], { ms: 260 }));
      }
      await wait(240);
      return c.land(meet);
    }
    const hi = v.lead;
    const lo = 1 - hi;
    // the smaller one goes to pieces
    c.sound.shatter();
    sparks(mid(boxOf(meds[lo])), [c.pal[lo as Side].light, c.pal[lo as Side].main, '#fff'], 22, rem(12), { ms: 600, size: 8, dir: lo === 0 ? Math.PI : 0, spread: Math.PI * 1.4 });
    quiet(go(meds[lo], [{ opacity: 1, scale: '1', rotate: '0deg' }, { opacity: 0, scale: '.35', rotate: `${lo === 0 ? -40 : 40}deg`, translate: `${lo === 0 ? -5 : 5}rem 2rem` }], { ms: 300, ease: 'ease-out' }));
    quiet(gone(q(meds[hi], '.v05-tier'), 160));
    await count(nums[hi], v.sides[hi].total, v.net, 280);
    // the one left standing takes the middle, in light
    nums[hi].textContent = `+${v.net}`;
    meds[hi].classList.add('won');
    quiet(go(meds[hi], [{ translate: '0 0', scale: '1' }, { translate: `${hi === 0 ? half : -half}px 0`, scale: '1.2' }], { ms: 200, ease: BACK }));
    rays(meet, hi === 0 ? '#ffe9a8' : c.pal[hi].light, rem(26), 700);
    c.sound.clink(3);
    await wait(280);
    quiet(gone(meds[hi], 140));
    await c.land(meet, { delay: 200 });
  },
};

// ================================================================ 06 · 档位台阶
const steps: Variant = {
  id: '06', name: '档位台阶', sign: '三级台阶，各自站上去', feel: '讲理 · 看得出为什么',
  blurb: '顶部三级台阶：存在、支配、控制，写着各值多少分。台阶下面一行是决定档位的两个数：国家数和战场国数。两方的棋子各自跳到自己那一级，头上顶着分数；加分从地图上飞来。最后小的并进大的。',
  risk: '信息最全的动画版，所以也最“满”；逐国计分的区域没有台阶，退成一块平台。',
  frame: UNDER_TALL,
  async run(c) {
    const v = c.view;
    const [A, B] = v.sides;
    const ranks = ['presence', 'domination', 'control'] as const;
    const words = { presence: '存在', domination: '支配', control: '控制' };
    const hints = { presence: '有国家', domination: '国家、战场国都更多', control: '国家更多 + 全部战场国' };
    const stairs = v.rule
      ? ranks.map((r, i) => `<div class="v06-step" data-rank="${r}" style="--i:${i}"><em>${words[r]}</em><b>${v.rule![r] === 'win' ? '胜' : v.rule![r]}</b><small>${hints[r]}</small></div>`).join('')
      : '<div class="v06-step flat" data-rank="presence" style="--i:0"><em>逐国计分</em><small>控制一个国家得一份分</small></div>';
    const facts = v.rule ? `<div class="v06-facts"><span>国家 <b class="a">${A.held}</b> : <b class="b">${B.held}</b></span><span>${rifles(c)}战场国 <b class="a">${A.keys}</b> : <b class="b">${B.keys}</b><small>/ ${v.keyIds.length}</small></span></div>` : `<div class="v06-facts"><span>国家 <b class="a">${A.held}</b> : <b class="b">${B.held}</b></span></div>`;
    const pane = hang(c, 'sc-pane v06', `<div class="v06-head">${title(c)}${facts}</div><div class="v06-stairs${v.rule ? '' : ' flat'}"><div class="v06-ground"></div><div class="v06-zero"><em>无</em><b>0</b></div>${stairs}</div>`);
    quiet(enter(pane, 200));
    await wait(170);
    // each side's piece goes to the step it has earned
    const stairsEl = q(pane, '.v06-stairs');
    const zero = boxOf(q(stairsEl, '.v06-zero'));
    const home = (s: Side): Pt => ({ x: zero.left + zero.width / 2 + (s === 0 ? -rem(3.4) : rem(3.4)), y: zero.top - rem(2.6) });
    const spot = (s: Side): Pt => {
      const S = v.sides[s];
      const same = v.sides[1 - s].standing === S.standing || !v.rule;
      const dx = same ? (s === 0 ? -rem(3.4) : rem(3.4)) : 0;
      if (S.standing === 'none' || (!v.rule && !S.held)) return home(s);
      const r = boxOf(q(stairsEl, `.v06-step[data-rank="${v.rule ? S.standing : 'presence'}"]`));
      return { x: r.left + r.width / 2 + dx, y: r.top - rem(2.6) };
    };
    const pucks = SIDES.map((s) => {
      const S = v.sides[s];
      const start = home(s);
      const el = put(`v06-puck ${cl(s)}`, start, `<b class="v06-num">${S.base}</b><i>${S.short}</i>`);
      quiet(popIn(el, 180, 0.5, s * 50));
      return { el, start };
    });
    quiet(c.waves());
    await wait(260);
    await Promise.all(
      SIDES.map(async (s) => {
        const to = spot(s);
        const { el, start } = pucks[s];
        if (Math.hypot(to.x - start.x, to.y - start.y) < 4) return;
        await fly(el, start, to, { ms: 320, lift: rem(4.5) });
        c.sound.clack(s * 2);
        const S = v.sides[s];
        if (v.rule && S.standing !== 'none') q(stairsEl, `.v06-step[data-rank="${S.standing}"]`).classList.add(`on-${cl(s)}`);
      }),
    );
    await wait(200);
    const nums = pucks.map((p) => q(p.el, '.v06-num')) as [HTMLElement, HTMLElement];
    const shown = v.sides.map((S) => S.base);
    await c.pips((s) => mid(boxOf(nums[s])), (s, k) => {
      shown[s] += k.pts;
      nums[s].textContent = String(shown[s]);
      beat(nums[s], 1.3, 180);
    });
    await wait(280);
    const at = await c.net(nums);
    if (v.lead !== null) {
      // the one that came out on top jumps for it, and its step lights up under it
      const S = v.sides[v.lead];
      const step = !v.rule ? q(stairsEl, '.v06-step') : S.standing !== 'none' ? q(stairsEl, `.v06-step[data-rank="${S.standing}"]`) : null;
      if (step) sheen(step, 340);
      pucks[1 - v.lead].el.classList.add('lost');
      quiet(go(pucks[v.lead].el, [{ translate: '0 0' }, { translate: '0 -1.7rem', offset: 0.4 }, { translate: '0 0' }], { ms: 290, ease: 'ease-out', fill: 'none' }));
      sparks(at, [c.pal[v.lead].light, '#ffe9a8'], 10, rem(6), { ms: 420, size: 4 });
      c.sound.clink(3);
      await wait(90);
    }
    await c.land(at);
  },
};

// ================================================================ 07 · 点兵
const muster: Variant = {
  id: '07', name: '点兵', sign: '国旗飞出来排成两队', feel: '像在桌上数棋子',
  blurb: '双方控制的国家，国旗从地图上飞出来，在顶部排成两队：战场国带金框和步枪排在前面。谁的队伍长、谁的金框多，一眼就知道档位。然后带分的旗子各弹出 +1，汇进队尾的总分，小的并进大的。',
  risk: '国家多的时候（一方十来个）旗子会缩小；这是唯一能看到“具体是哪些国家”的动画。',
  frame: UNDER_TALL,
  async run(c) {
    const v = c.view;
    const most = Math.max(4, ...v.sides.map((S) => S.countries.length));
    const size = clamp(30 / most, 2.5, 4.6);
    const pane = hang(c, 'sc-pane v07', `<div class="v07-head">${title(c)}</div><div class="v07-rows" style="--f:${size.toFixed(2)}rem">${v.sides
      .map((S) => `<div class="v07-row ${cl(S.side)}"><div class="v07-total"><b class="v07-num">0</b><span>${sd(S)}<em class="v07-tier"></em></span></div><div class="v07-line">${S.countries.map((k) => `<span class="v07-flag${k.key ? ' key' : ''}${k.excluded ? ' out' : ''}" data-id="${k.id}"><i class="v07-cloth">${c.flag(k.id)}</i>${k.key ? rifles(c) : ''}${k.adjacent && k.pts ? '<u>邻</u>' : ''}<small>${k.name}</small></span>`).join('') || `<span class="v07-empty">${v.rule ? '没有国家' : '没有国家'}</span>`}</div><div class="v07-count"></div></div>`)
      .join('')}</div>`);
    quiet(enter(pane, 180));
    await wait(150);
    // every flag leaves its country and takes its place in the line
    const flagOf = new Map<string, HTMLElement>();
    for (const f of pane.querySelectorAll<HTMLElement>('.v07-flag')) {
      flagOf.set(f.dataset.id!, f);
      f.style.visibility = 'hidden';
    }
    await Promise.all(
      SIDES.flatMap((s) =>
        v.sides[s].countries.map(async (k, i) => {
          await wait(i * 36);
          const slot = flagOf.get(k.id)!;
          const tok = c.tok(k.id);
          const to = mid(boxOf(q(slot, '.v07-cloth')));
          c.pulse(k.id, s, 0.6);
          if (tok) {
            const ghost = put(`v07-ghost${k.key ? ' key' : ''} ${cl(s)}`, tok.at(), c.flag(k.id), { width: `${size * 1.25}rem`, height: `${size * 0.85}rem` });
            await fly(ghost, { x: tok.at().x, y: tok.box().top - rem(1) }, to, { ms: 250, scale: [0.6, 1] });
            ghost.remove();
          }
          slot.style.visibility = '';
          quiet(go(slot, [{ scale: '1.25' }, { scale: '1' }], { ms: 160, ease: BACK, fill: 'none' }));
          c.sound.clack(Math.min(6, i));
        }),
      ),
    );
    await wait(120);
    // the count, and the standing it makes
    const nums = SIDES.map((s) => q(pane, `.v07-row.${cl(s)} .v07-num`)) as [HTMLElement, HTMLElement];
    const shown = [0, 0];
    for (const s of SIDES) {
      const S = v.sides[s];
      q(pane, `.v07-row.${cl(s)} .v07-count`).innerHTML = v.rule ? `<b>${S.held}</b> 国${S.keys ? ` · ${rifles(c)}<b>${S.keys}</b>` : ''}` : `<b>${S.held}</b> 国`;
      const tier = q(pane, `.v07-row.${cl(s)} .v07-tier`);
      tier.textContent = S.tier;
      quiet(popIn(tier, 220, 0.4, 90));
      shown[s] = S.base;
      quiet(count(nums[s], 0, S.base, 220));
    }
    c.sound.thud(0.6);
    await wait(380);
    // the flags that count step forward
    await Promise.all(
      SIDES.flatMap((s) =>
        v.sides[s].scoring.map(async (k, i) => {
          await wait(i * 75);
          const slot = flagOf.get(k.id)!;
          const from = mid(boxOf(slot));
          const chip = put(`sc-pip ${cl(s)}`, { x: from.x, y: from.y - rem(2) }, `+${k.pts}`);
          c.pulse(k.id, s, 0.6);
          quiet(go(slot, [{ translate: '0 0' }, { translate: '0 -.5rem', offset: 0.4 }, { translate: '0 0' }], { ms: 240, fill: 'none' }));
          await popIn(chip, 130, 0.5);
          await fly(chip, { x: from.x, y: from.y - rem(2) }, mid(boxOf(nums[s])), { ms: 260, scale: [1.1, 0.8] });
          chip.remove();
          shown[s] += k.pts;
          nums[s].textContent = String(shown[s]);
          beat(nums[s], 1.3, 170);
          c.sound.tick(i + s * 2);
        }),
      ),
    );
    await wait(280);
    const at = await c.net(nums);
    if (v.lead !== null) {
      // the winning line answers down its length; the other stands down
      q(pane, `.v07-row.${cl(1 - v.lead)}`).classList.add('lost');
      const line = [...pane.querySelectorAll<HTMLElement>(`.v07-row.${cl(v.lead)} .v07-flag`)];
      line.forEach((f, i) => {
        quiet(go(f, [{ translate: '0 0', scale: '1' }, { translate: '0 -1rem', scale: '1.14', offset: 0.4 }, { translate: '0 0', scale: '1' }], { ms: 260, delay: i * 32, ease: 'ease-out', fill: 'none' }));
        quiet(wait(i * 32).then(() => c.sound.clink(Math.min(7, i))));
      });
      await wait(90);
    }
    await c.land(at);
  },
};

// ================================================================ 08 · 轨道推拉
const track: Variant = {
  id: '08', name: '轨道推拉', sign: '一条胜利点轨道，被两边各推一把', feel: '直接 · 结果就是过程',
  blurb: '顶部放大一条胜利点轨道，游标停在当前比分。美国先把它往自己那头推（档位 + 加分那么多格），苏联再往回推；两段重叠的部分自己抵消，游标最后停的地方就是新比分，再收回右上角。',
  risk: '两次推是先后发生的，不能同时，所以稍慢一点；但不需要解释什么叫“相抵”。',
  frame: UNDER_STRIP,
  async run(c) {
    const v = c.view;
    const max = 20;
    const pos = (vp: number): string => `${(((max - clamp(vp, -max, max)) / (2 * max)) * 100).toFixed(2)}%`;
    const ticks = Array.from({ length: 2 * max + 1 }, (_, i) => `<i class="v08-t${i % 10 === 0 ? ' x' : i % 5 === 0 ? ' v' : ''}" style="left:${(i / (2 * max)) * 100}%"></i>`).join('');
    const marks = [max, max / 2, 0, max / 2, max].map((n, i) => `<i class="v08-n" style="left:${i * 25}%">${n}</i>`).join('');
    const pane = hang(c, 'sc-pane v08', `<div class="v08-head">${title(c)}<span class="v08-say"></span></div>
      <div class="v08-row">${sd(v.sides[0])}<div class="v08-rail"><i class="v08-groove"></i>${ticks}<i class="v08-zero"></i><i class="v08-band a"></i><i class="v08-band b"></i><b class="v08-ghost"></b><b class="v08-rider"></b>${marks}</div>${sd(v.sides[1])}</div>
      <div class="v08-notes"><span class="v08-note a"></span><span class="v08-note b"></span></div>`);
    quiet(enter(pane, 200));
    const rider = q(pane, '.v08-rider');
    const ghost = q(pane, '.v08-ghost');
    rider.style.left = ghost.style.left = pos(v.vpBefore);
    rider.dataset.lead = v.vpBefore === 0 ? '0' : v.vpBefore > 0 ? 'a' : 'b';
    await wait(240);
    // each side pushes the marker its own way, by all it scored
    let at = v.vpBefore;
    for (const s of SIDES) {
      const S = v.sides[s];
      const note = q(pane, `.v08-note.${cl(s)}`);
      note.innerHTML = `${sd(S)}<em>${S.tier}</em>${S.standing === 'none' && v.rule ? '' : `<b>${v.rule ? S.base : ''}</b>`}${S.bonus && v.rule ? `<i>+${S.bonus}</i>` : ''}<strong>${s === 0 ? '←' : '→'} ${S.total}</strong>`;
      quiet(popIn(note, 200, 0.7));
      if (!S.total) {
        await wait(160);
        continue;
      }
      quiet(c.wave(S.countries, s, 40));
      const to = at + (s === 0 ? S.total : -S.total);
      const band = q(pane, `.v08-band.${cl(s)}`);
      const [l, r] = [Math.max(at, to), Math.min(at, to)];
      band.style.left = pos(l);
      band.style.width = `${(((l - r) / (2 * max)) * 100).toFixed(2)}%`;
      c.sound.whoosh(0.14);
      await Promise.all([go(band, [{ clipPath: s === 0 ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { ms: 380, ease: INOUT }), go(ghost, [{ left: pos(at) }, { left: pos(to) }], { ms: 380, ease: INOUT })]);
      ghost.style.left = pos(to);
      c.sound.clack(s * 2);
      at = to;
      await wait(220);
    }
    // what both pushed cancels; what is left is the move
    const say = q(pane, '.v08-say');
    for (const b of pane.querySelectorAll('.v08-band')) quiet(go(b, [{ opacity: 1 }, { opacity: 0.22 }], { ms: 220 }));
    if (v.lead !== null) {
      const net = sub(q(pane, '.v08-rail'), `v08-band net ${cl(v.lead)}`);
      const [l, r] = [Math.max(v.vpBefore, v.vpAfter), Math.min(v.vpBefore, v.vpAfter)];
      net.style.left = pos(l);
      net.style.width = `${(((l - r) / (2 * max)) * 100).toFixed(2)}%`;
      say.className = `v08-say ${cl(v.lead)}`;
      say.innerHTML = `${v.sides[v.lead].name} <b>+${v.net}</b>`;
    } else say.innerHTML = '双方抵消';
    quiet(popIn(say, 220, 0.6));
    // the marker is dragged there one notch at a time, and every notch is heard
    const notches = Math.abs(v.vpAfter - v.vpBefore);
    const way = Math.sign(v.vpAfter - v.vpBefore);
    let passed = 0;
    await tween(
      Math.min(540, 200 + 46 * notches),
      (k) => {
        const now = v.vpBefore + (v.vpAfter - v.vpBefore) * k;
        rider.style.left = pos(now);
        while (passed < Math.floor(Math.abs(now - v.vpBefore) + 1e-6)) {
          passed++;
          const here = v.vpBefore + way * passed;
          rider.dataset.lead = here === 0 ? '0' : here > 0 ? 'a' : 'b';
          c.sound.tick(Math.min(9, passed));
          // thrown out behind it
          if (v.lead !== null) sparks(mid(boxOf(rider)), c.pal[v.lead].light, 2, rem(2.6), { ms: 260, size: 3, dir: way > 0 ? 0 : Math.PI, spread: 1.5 });
        }
      },
      easeInOut,
    );
    rider.style.left = pos(v.vpAfter);
    rider.dataset.lead = v.vpAfter === 0 ? '0' : v.vpAfter > 0 ? 'a' : 'b';
    quiet(gone(ghost, 120));
    if (v.lead !== null) {
      c.sound.thock(1.1);
      ring(mid(boxOf(rider)), c.pal[v.lead].light, { from: rem(1.5), to: rem(10), ms: 400, width: 3 });
      sparks(mid(boxOf(rider)), [c.pal[v.lead].light, '#fff'], 10, rem(5), { ms: 420, size: 4 });
    }
    beat(rider, 1.8, 260);
    await wait(300);
    if (v.lead === null) return wait(600);
    await c.land(mid(boxOf(say)), { delay: 120 });
  },
};

// 09 · 结算小票 is the way that was picked: it has a file of its own, slip.ts.

// ================================================================ 10 · 战场席位
const seats: Variant = {
  id: '10', name: '战场席位', sign: '战场国排成一排席位', feel: '抓重点 · 老手最快',
  blurb: '计分其实主要看战场国。顶部把这个区域的战场国排成一排席位：美国占的靠左变蓝，苏联占的靠右变红，没人占的留在中间发灰；席位下面一条细线是双方的国家总数。档位从这两样里“长”出来，然后每个占住的席位弹出 +1。',
  risk: '非战场国只是一条细线上的数字，不出现名字。逐国计分的区域改成“每个国家一个席位”。',
  frame: UNDER_TALL,
  async run(c) {
    const v = c.view;
    const [A, B] = v.sides;
    const owner = new Map<string, Side>();
    for (const S of v.sides) for (const k of S.countries) if (!k.excluded) owner.set(k.id, S.side);
    const ids = v.rule ? v.keyIds : v.members;
    const name = (id: string): string => c.tok(id)?.name ?? id;
    // the first side's seats to the left, the second's to the right, the unheld between them
    const order = [...ids.filter((id) => owner.get(id) === 0), ...ids.filter((id) => !owner.has(id)), ...ids.filter((id) => owner.get(id) === 1)];
    const size = clamp(40 / Math.max(5, ids.length), 3, 6.4);
    const all = Math.max(1, A.held + B.held);
    const pane = hang(c, 'sc-pane v10', `<div class="v10-head">${title(c)}<span>${v.rule ? `${rifles(c)}战场国 ${ids.length} 席` : '每个国家一席'}</span></div>
      <div class="v10-body">
        ${[A, B].map((S) => `<div class="v10-side ${cl(S.side)}"><b class="v10-num">0</b><span>${sd(S)}<em class="v10-tier"></em></span></div>`).join('<div class="v10-mid"><div class="v10-seats" style="--f:' + size.toFixed(2) + 'rem">' + order.map((id) => `<span class="v10-seat" data-id="${id}"><i class="v10-cloth">${c.flag(id)}</i><small>${name(id)}</small></span>`).join('') + `</div>${v.rule ? `<div class="v10-held"><b class="a">${A.held}</b><i class="v10-share"><u class="a" style="--w:${(A.held / all) * 100}%"></u><u class="b" style="--w:${(B.held / all) * 100}%"></u></i><b class="b">${B.held}</b><em>控制的国家</em></div>` : ''}</div>`)}
      </div>`);
    quiet(enter(pane, 200));
    await wait(170);
    // the seats are taken
    const seatOf = new Map([...pane.querySelectorAll<HTMLElement>('.v10-seat')].map((e) => [e.dataset.id!, e]));
    let n = 0;
    for (const id of order) {
      const s = owner.get(id);
      if (s === undefined) continue;
      const seat = seatOf.get(id)!;
      const delay = n++ * 55;
      quiet(
        wait(delay).then(() => {
          seat.classList.add(cl(s));
          c.pulse(id, s, 0.8);
          quiet(go(seat, [{ scale: '1.22' }, { scale: '1' }], { ms: 180, ease: BACK, fill: 'none' }));
          c.sound.clack(Math.min(6, n));
        }),
      );
    }
    await wait(n * 55 + 160);
    if (v.rule) {
      pane.classList.add('counted');
      quiet(c.waves(30));
      await wait(260);
    }
    // the standing those two facts make
    const nums = SIDES.map((s) => q(pane, `.v10-side.${cl(s)} .v10-num`)) as [HTMLElement, HTMLElement];
    const shown = [0, 0];
    for (const s of SIDES) {
      const S = v.sides[s];
      const tier = q(pane, `.v10-side.${cl(s)} .v10-tier`);
      tier.textContent = S.tier;
      quiet(popIn(tier, 220, 0.4));
      shown[s] = S.base;
      quiet(count(nums[s], 0, S.base, 220));
    }
    c.sound.thud(0.6);
    await wait(360);
    // every seat held is worth one more; a border with the other superpower one more again
    await Promise.all(
      SIDES.flatMap((s) =>
        v.sides[s].scoring.map(async (k, i) => {
          await wait(i * 75);
          const seat = seatOf.get(k.id);
          const land = (): void => {
            shown[s] += k.pts;
            nums[s].textContent = String(shown[s]);
            beat(nums[s], 1.3, 170);
            c.sound.tick(i + s * 2);
          };
          // a country with no seat (it scores by its border alone) sends its point from the map
          if (!seat) return c.pip(k, s, () => mid(boxOf(nums[s])), { text: `+${k.pts}` }).then(land);
          const from = mid(boxOf(seat));
          const chip = put(`sc-pip ${cl(s)}`, { x: from.x, y: from.y - rem(1.6) }, `+${k.pts}`);
          c.pulse(k.id, s, 0.6);
          await popIn(chip, 130, 0.5);
          await fly(chip, { x: from.x, y: from.y - rem(1.6) }, mid(boxOf(nums[s])), { ms: 260, scale: [1.1, 0.8] });
          chip.remove();
          land();
        }),
      ),
    );
    await wait(280);
    const at = await c.net(nums);
    if (v.lead !== null) {
      // the seats that won it light up one after another
      const won = order.filter((id) => owner.get(id) === v.lead).map((id) => seatOf.get(id)!);
      won.forEach((seat, i) =>
        quiet(
          wait(i * 45).then(() => {
            sheen(q(seat, '.v10-cloth'), 260);
            quiet(go(seat, [{ scale: '1', translate: '0 0' }, { scale: '1.2', translate: '0 -.5rem', offset: 0.4 }, { scale: '1', translate: '0 0' }], { ms: 240, ease: 'ease-out', fill: 'none' }));
            c.sound.clink(Math.min(7, i));
          }),
        ),
      );
      await wait(90);
    }
    await c.land(at);
  },
};

export const VARIANTS: Variant[] = [tug, stamps, board, scale, clash, steps, muster, track, slip, seats];
/** Marked on the page. Why: README.md. */
export const RECOMMENDED: string[] = ['01'];
/** The way the user picked (2026-11-16): the page opens on it. */
export const CHOSEN = '09';
