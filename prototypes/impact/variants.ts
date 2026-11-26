// The ten sets. Each is one idea of what a hit is, carried through the four moments main.ts stages:
// control() a plinth goes under a token, wipe() a coup destroys the other side's number, bonus() one
// extra point reaches a die's total, win() the winning die beats the losing one, and tap() a small
// hit of the same family for any number that changes. Nothing here is used by the game.
import { BACK, IN, OUT, anim, bands, bolt, boxOf, bump, burst, chip, cracks, dim, easeIn, easeInOut, easeOut, flash, fly, ghost, go, halves, hitStop, mid, mk, nudge, punch, put, rand, rays, ring, scorch, shake, slam, streak, toBack, wait, type Box, type Pt } from './kit';
import { sfx } from './sfx';
import type { ControlCtx, Variant, WinCtx } from './types';

const quiet = (): undefined => undefined;
const drop = (el: Element) => (): void => el.remove();
const PAPER = '#efe2c4';

/** A plinth of our own, exactly where the game's is or will be: something that can fall, break or be knocked away. */
function plinthOf(b: Box, colour: string, under = true): HTMLElement {
  const el = mk('fx-at fx-plinth', { left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` }, under);
  el.innerHTML = `<svg viewBox="0 0 100 12" preserveAspectRatio="none"><path d="M6 0.5H94L99.4 11.5H0.6Z" fill="${colour}"/></svg>`;
  return el;
}
/** The token takes the blow: it is pressed down and springs back. */
const press = (c: ControlCtx, depth = 5, ms = 240): void => {
  void nudge(c.tok.root, [{ transform: `translateY(${-depth * 1.6}px) scale(1.1)` }, { transform: `translateY(${depth * 0.4}px) scale(.97)`, offset: 0.45 }, { transform: 'none' }], ms).catch(quiet);
  if (c.tok.plinth) void nudge(c.tok.plinth, [{ transform: 'scale(1.18,.5)' }, { transform: 'scale(.96,1.15)', offset: 0.5 }, { transform: 'none' }], ms + 40).catch(quiet);
};
/** Tokens nearby jump as the blow passes under them. speed: ms per px of distance. */
const ripple = (c: ControlCtx, height: number, speed: number, reach = 560): void => {
  for (const n of c.near) {
    if (n.dist > reach) continue;
    const h = Math.max(2, height * (1 - n.dist / reach));
    wait(n.dist * speed).then(() => nudge(n.tok.root, [{ transform: 'translateY(0)' }, { transform: `translateY(${-h}px)`, offset: 0.35 }, { transform: 'translateY(0)' }], 280), quiet).catch(quiet);
  }
};
/** Every token on the map hops once, nearest to the point first. */
const quake = (p: Pt, height: number, speed: number): void => {
  for (const el of document.querySelectorAll<HTMLElement>('.wm-plate[data-id]')) {
    if (el.style.display === 'none') continue;
    const r = el.getBoundingClientRect();
    const d = Math.hypot(r.left - p.x, r.top - p.y);
    wait(d * speed).then(() => nudge(el, [{ transform: 'translateY(0)' }, { transform: `translateY(${-Math.max(2, height * (1 - d / 1100))}px)`, offset: 0.35 }, { transform: 'translateY(0)' }], 300), quiet).catch(quiet);
  }
};
const dirOf = (c: WinCtx): number => Math.sign(c.loseAt().x - c.winAt().x) || 1;
const total = (c: WinCtx, text = `+${c.margin}`, colour = '#ffe08a', cls = 'im-margin'): void => {
  const w = c.winAt();
  const l = c.loseAt();
  slam({ x: (w.x + l.x) / 2, y: Math.min(w.y, l.y) - 118 }, text, { cls, color: colour, size: 76, rot: -5, ms: 1300 });
  sfx.fanfare();
};
/** Four brackets that close on a point. */
function reticle(p: Pt, size: number, colour: string): HTMLElement {
  const el = mk('fx-at lk-ret', { left: `${p.x}px`, top: `${p.y}px`, width: `${size}px`, height: `${size}px`, color: colour });
  el.innerHTML = '<i></i><i></i><i></i><i></i>';
  return el;
}
async function lockOn(p: Pt, size: number, colour: string, beat = 140): Promise<HTMLElement> {
  const r = reticle(p, size, colour);
  void go(r, [{ transform: 'translate(-50%,-50%) scale(2.4) rotate(45deg)', opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', opacity: 1 }], { ms: beat * 3, ease: OUT }).catch(quiet);
  sfx.beep(0);
  await wait(beat * 1.15);
  sfx.beep(2);
  await wait(beat);
  sfx.beep(4);
  await wait(beat * 0.85);
  r.classList.add('locked');
  sfx.lock();
  return r;
}
const fade = (el: Element, ms = 260, delay = 0): void => void go(el, [{ opacity: 1 }, { opacity: 0 }], { ms, delay }).then(drop(el), quiet);

export const VARIANTS: Variant[] = [
  // ================================================================ 01 · 盖章
  {
    id: '01',
    name: '盖章',
    sign: '一枚铜章砸下来，墨迹四溅',
    feel: '沉 · 钝 · 有分量',
    blurb: '所有的“成了”都是一枚章盖下去：控制是盖在国家上的章，清场是把对方的数字像废纸一样撕成两半，赢骰子是自己的骰子抬起来把对方的拍成一滩墨。',
    risk: '章落下的那一下会把铭牌整个盖住约 0.1 秒；纸和墨的质感和现在偏金属、珐琅的界面不完全是一路。',
    async control(c) {
      const b = c.tok.box();
      const p = c.tok.at();
      const foot = mid(c.tok.base());
      const head = put('st-stamp', { x: p.x, y: p.y - 6 }, b.width + 44, b.height + 62);
      sfx.whoosh(0.13);
      await go(head, [{ transform: 'translateY(-300px) rotate(-9deg)', opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: 'translateY(0) rotate(0deg)', opacity: 1 }], { ms: 190, ease: IN });
      c.commit();
      sfx.stamp(1.15);
      bump(8, 260);
      punch(1.025, 280, foot);
      burst(foot, { kind: 'ink', n: 26, colors: [c.pal.main, c.pal.deep], speed: [70, 340], gravity: 0, drag: 0.02, life: [0.9, 1.7], size: [2, 6] });
      burst(foot, { kind: 'dust', n: 10, colors: ['#e9dcc0'], speed: [50, 150], angle: -90, spread: 200, gravity: -30, drag: 0.2, life: [0.4, 0.8], size: [6, 12], grow: 18 });
      ring(foot, { to: b.width * 2.1, color: c.pal.main, width: 6, ms: 420, under: true });
      press(c, 6);
      ripple(c, 6, 0.25, 320);
      await hitStop(80);
      await go(head, [{ transform: 'translateY(0) rotate(0deg)', opacity: 1 }, { transform: 'translateY(-22px) rotate(3deg)', opacity: 1, offset: 0.35 }, { transform: 'translateY(-280px) rotate(8deg)', opacity: 0 }], { ms: 330, ease: 'cubic-bezier(.4,0,.9,.5)' });
      head.remove();
      slam({ x: p.x + b.width * 0.78, y: p.y - 30 }, '控制', { cls: 'st-ink', color: c.pal.main, size: 30, rot: -12, ms: 1300, from: 2 });
      await wait(550);
    },
    async wipe(c) {
      const p = mid(c.cell);
      const theirs = c.hadControl ? plinthOf(c.base, c.pal.main) : null;
      const head = put('st-stamp small', { x: p.x, y: p.y - 4 }, 62, 62);
      sfx.whoosh(0.11);
      await go(head, [{ transform: 'translateY(-240px) rotate(10deg)', opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: 'translateY(0) rotate(0deg)', opacity: 1 }], { ms: 160, ease: IN });
      const scrap = chip(c.cell, c.pal.main, c.digit);
      c.commit();
      sfx.stamp(1);
      bump(6, 220);
      burst(p, { kind: 'ink', n: 18, colors: [c.by.deep, '#1a120b'], speed: [50, 260], gravity: 0, drag: 0.02, life: [0.8, 1.5], size: [2, 5] });
      await hitStop(70);
      await go(head, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-240px) rotate(-8deg)', opacity: 0 }], { ms: 260, ease: IN });
      head.remove();
      // what is left under the stamp is a scrap of paper, and it is torn in two
      sfx.rip();
      const [a, b2] = halves(scrap, rand(-28, 28));
      scrap.remove();
      void go(a, [{ transform: 'none', opacity: 1 }, { transform: 'translate(-30px, 74px) rotate(-44deg)', opacity: 0 }], { ms: 640, ease: IN }).then(drop(a), quiet);
      void go(b2, [{ transform: 'none', opacity: 1 }, { transform: 'translate(34px, 86px) rotate(52deg)', opacity: 0 }], { ms: 700, ease: IN }).then(drop(b2), quiet);
      burst(p, { kind: 'confetti', n: 16, colors: [c.pal.main, PAPER, c.pal.deep], speed: [80, 280], angle: -90, spread: 220, gravity: 760, life: [0.5, 1], size: [4, 8] });
      if (theirs) {
        const [l, r] = halves(theirs, 78);
        theirs.remove();
        void go(l, [{ transform: 'none', opacity: 1 }, { transform: 'translate(-26px, 60px) rotate(-26deg)', opacity: 0 }], { ms: 620, ease: IN }).then(drop(l), quiet);
        void go(r, [{ transform: 'none', opacity: 1 }, { transform: 'translate(30px, 66px) rotate(22deg)', opacity: 0 }], { ms: 680, ease: IN }).then(drop(r), quiet);
      }
      slam({ x: p.x + 74, y: p.y - 36 }, '清除', { cls: 'st-ink', color: c.by.main, size: 26, rot: 9, ms: 1200, from: 2 });
      await wait(520);
    },
    async bonus(c) {
      const mark = put('st-post', c.from, 30, 30, { borderColor: c.pal.main, color: c.pal.main });
      mark.textContent = '+1';
      await fly(mark, c.from, c.to, { ms: 230, lift: 44, ease: easeIn, spin: rand(-40, 40), scale: [1, 1.25] });
      mark.remove();
      c.land();
      sfx.stamp(0.55);
      sfx.tick(c.i);
      burst(c.to, { kind: 'ink', n: 7, colors: [c.pal.main, c.pal.deep], speed: [40, 190], gravity: 0, drag: 0.03, life: [0.5, 0.9], size: [1.5, 4] });
      ring(c.to, { to: 58, color: c.pal.main, width: 3, ms: 240 });
      void nudge(c.die, [{ transform: 'translateY(0)' }, { transform: 'translateY(5px)', offset: 0.3 }, { transform: 'translateY(0)' }], 160).catch(quiet);
      bump(2, 120);
      await wait(150);
    },
    async win(c) {
      const w = c.winAt();
      const l = c.loseAt();
      const dx = l.x - w.x;
      const dy = l.y - w.y;
      sfx.whoosh(0.22);
      await go(c.win, [{ translate: '0 0', scale: '1', rotate: '0deg' }, { translate: `${dx * 0.55}px -170px`, scale: '1.55', rotate: `${-dirOf(c) * 10}deg` }], { ms: 320, ease: OUT });
      await wait(110);
      await go(c.win, [{ translate: `${dx * 0.55}px -170px`, scale: '1.55', rotate: `${-dirOf(c) * 10}deg` }, { translate: `${dx}px ${dy}px`, scale: '1.2', rotate: '0deg' }], { ms: 120, ease: IN });
      c.hideLoser();
      sfx.stamp(1.6);
      sfx.boom(0.5);
      shake(13, 400);
      punch(1.045, 320, l);
      flash('#fff', 0.3, 120);
      const blot = put('st-blot', { x: l.x, y: l.y + 12 }, 210, 150, { background: c.losePal.main }, false);
      toBack(blot);
      void go(blot, [{ transform: 'scale(.2)', opacity: 0.95 }, { transform: 'scale(1)', opacity: 0.9, offset: 0.12 }, { transform: 'scale(1.04)', opacity: 0 }], { ms: 1700, ease: 'ease-out' }).then(drop(blot), quiet);
      burst(l, { kind: 'ink', n: 46, colors: [c.losePal.main, c.losePal.deep, '#1a120b'], speed: [120, 620], gravity: 0, drag: 0.03, life: [0.8, 1.6], size: [2, 8] });
      burst(l, { kind: 'pip', n: 7, colors: ['#fff'], speed: [200, 520], gravity: 1300, life: [0.6, 1], size: [3, 5] });
      await hitStop(100);
      await go(c.win, [{ translate: `${dx}px ${dy}px`, scale: '1.2' }, { translate: `${dx}px ${dy - 12}px`, scale: '1.12', offset: 0.4 }, { translate: `${dx}px ${dy}px`, scale: '1.08' }], { ms: 260 });
      slam({ x: l.x + dirOf(c) * 96, y: l.y - 96 }, '胜', { cls: 'st-ink', color: c.pal.main, size: 66, rot: -11, ms: 1300 });
      sfx.fanfare();
      await wait(800);
    },
    tap(p, pal, i) {
      sfx.stamp(0.5);
      sfx.tick(i);
      ring(p, { to: 46, color: pal.main, width: 3, ms: 240 });
      burst(p, { kind: 'ink', n: 5, colors: [pal.main, pal.deep], speed: [30, 150], gravity: 0, drag: 0.03, life: [0.4, 0.8], size: [1.5, 3.5] });
    },
  },

  // ================================================================ 02 · 炮击
  {
    id: '02',
    name: '炮击',
    sign: '炮弹飞过来，炸开',
    feel: '响 · 烈 · 火药味',
    blurb: '你说的那个：赢了的骰子后坐、开炮，把对方的骰子轰成碎块。控制是一发炮弹落地、烟散开底座已经立着；清场是把对方的数字直接炸飞。',
    risk: '最吵的一套。一回合里放置影响力很频繁，每次控制都炸一下会累；可能要只留给政变和骰子。',
    async control(c) {
      const foot = mid(c.tok.base());
      const from = { x: foot.x + (c.side === 0 ? -1 : 1) * 560, y: -40 };
      const shell = put('cn-shell', from, 14, 14);
      sfx.whistle(0.42);
      let n = 0;
      await fly(shell, from, foot, { ms: 430, lift: 70, ease: easeIn, each: (q) => { if (n++ % 2 === 0) burst(q, { kind: 'ember', n: 2, colors: ['#ffb36b', '#fff1c9'], speed: [0, 40], gravity: 0, life: [0.18, 0.4], size: [2, 4] }); } });
      shell.remove();
      c.commit();
      sfx.boom(0.9);
      flash('#ffd9a0', 0.45, 150);
      shake(12, 440);
      punch(1.04, 320, foot);
      burst(foot, { kind: 'spark', n: 30, colors: ['#ffd27a', '#ff8a3d', '#fff'], speed: [220, 780], angle: -90, spread: 210, gravity: 950, life: [0.3, 0.7], size: [2, 3.5] });
      burst(foot, { kind: 'debris', n: 16, colors: ['#3a2c1e', '#6b5137', c.pal.deep], speed: [180, 560], angle: -90, spread: 150, gravity: 1500, life: [0.7, 1.2], size: [4, 8], floor: foot.y + 30 });
      burst({ x: foot.x, y: foot.y - 10 }, { kind: 'smoke', n: 9, colors: ['rgba(70,60,52,1)', 'rgba(120,106,94,1)'], speed: [60, 190], angle: -90, spread: 200, gravity: -170, drag: 0.3, life: [0.5, 1.1], size: [9, 16], grow: 30 });
      ring(foot, { to: 320, color: 'rgba(255,220,170,.9)', width: 6, ms: 440, under: true });
      scorch(foot, 200, 2400);
      void nudge(c.tok.root, [{ transform: 'translateY(-18px) rotate(-3deg) scale(1.1)' }, { transform: 'translateY(3px) rotate(1deg)', offset: 0.6 }, { transform: 'none' }], 360).catch(quiet);
      if (c.tok.plinth) void nudge(c.tok.plinth, [{ transform: 'scale(1.6,1.9)' }, { transform: 'scale(.95,.9)', offset: 0.6 }, { transform: 'none' }], 300, BACK).catch(quiet);
      ripple(c, 10, 0.35, 420);
      await hitStop(60);
      await wait(700);
    },
    async wipe(c) {
      const p = mid(c.cell);
      const from = { x: p.x + (c.loser === 1 ? -1 : 1) * 520, y: -40 };
      const shell = put('cn-shell', from, 14, 14);
      sfx.whistle(0.36);
      let n = 0;
      await fly(shell, from, p, { ms: 360, lift: 60, ease: easeIn, each: (q) => { if (n++ % 2 === 0) burst(q, { kind: 'ember', n: 2, colors: ['#ffb36b', '#fff1c9'], speed: [0, 40], gravity: 0, life: [0.18, 0.4], size: [2, 4] }); } });
      shell.remove();
      c.commit();
      sfx.boom(1);
      sfx.shatter();
      flash('#ffd9a0', 0.5, 150);
      shake(13, 460);
      burst(p, { kind: 'shard', n: 24, colors: [c.pal.main, c.pal.light, c.pal.deep], speed: [220, 760], spread: 360, gravity: 1400, life: [0.7, 1.2], size: [4, 10] });
      burst(p, { kind: 'spark', n: 26, colors: ['#ffd27a', '#ff8a3d', '#fff'], speed: [200, 760], spread: 360, gravity: 900, life: [0.3, 0.7], size: [2, 3.5] });
      burst({ x: p.x, y: p.y - 12 }, { kind: 'smoke', n: 8, colors: ['rgba(70,60,52,1)', 'rgba(120,106,94,1)'], speed: [60, 190], angle: -90, spread: 200, gravity: -170, drag: 0.3, life: [0.5, 1.1], size: [9, 16], grow: 30 });
      if (c.hadControl) burst(mid(c.base), { kind: 'debris', n: 22, colors: [c.pal.main, c.pal.deep, '#fff'], speed: [120, 480], angle: -90, spread: 170, gravity: 1500, life: [0.7, 1.2], size: [5, 10], area: [c.base.width, c.base.height], floor: c.base.top + 40 });
      scorch(mid(c.base), 190, 2400);
      void nudge(c.tok.root, [{ transform: `translate(${c.loser === 1 ? 8 : -8}px,-10px) rotate(${c.loser === 1 ? 5 : -5}deg)` }, { transform: 'translate(0,2px) rotate(0deg)', offset: 0.6 }, { transform: 'none' }], 380).catch(quiet);
      await hitStop(70);
      await wait(650);
    },
    async bonus(c) {
      sfx.thud(0.5 + c.i * 0.04);
      await streak(c.from, c.to, { color: '#ffd27a', width: 3, ms: 100, hold: 50, glow: '#ff9a3d' });
      c.land();
      sfx.crack();
      sfx.tick(c.i);
      burst(c.to, { kind: 'spark', n: 12, colors: ['#ffd27a', '#fff', '#ff8a3d'], speed: [120, 420], spread: 360, gravity: 600, life: [0.2, 0.45], size: [1.5, 2.5] });
      void nudge(c.die, [{ transform: 'translateX(0)' }, { transform: `translateX(${c.side === 0 ? -6 : 6}px) rotate(${c.side === 0 ? -4 : 4}deg)`, offset: 0.25 }, { transform: 'none' }], 180).catch(quiet);
      shake(2, 100);
      await wait(170);
    },
    async win(c) {
      const w = c.winAt();
      const l = c.loseAt();
      const dir = dirOf(c);
      await go(c.win, [{ translate: '0 0', rotate: '0deg' }, { translate: `${-dir * 20}px 0`, rotate: `${-dir * 9}deg` }], { ms: 280, ease: OUT });
      await wait(140);
      // fire: the die kicks back
      sfx.boom(0.6);
      flash('#ffe2b0', 0.28, 90);
      shake(6, 200, 'x');
      const muzzle = { x: w.x + dir * 58, y: w.y };
      burst(muzzle, { kind: 'spark', n: 16, colors: ['#ffd27a', '#fff', '#ff8a3d'], speed: [200, 700], angle: dir > 0 ? 0 : 180, spread: 60, gravity: 300, life: [0.15, 0.4], size: [2, 3] });
      burst(muzzle, { kind: 'smoke', n: 7, colors: ['rgba(120,108,96,1)'], speed: [20, 120], angle: dir > 0 ? 0 : 180, spread: 90, gravity: -40, life: [0.5, 0.9], size: [8, 14], grow: 22 });
      void go(c.win, [{ translate: `${-dir * 20}px 0`, rotate: `${-dir * 9}deg` }, { translate: `${-dir * 54}px 0`, rotate: `${-dir * 16}deg`, offset: 0.14 }, { translate: '0 0', rotate: '0deg' }], { ms: 520, ease: 'ease-out' }).catch(quiet);
      const ball = put('cn-ball', muzzle, 28, 28);
      let n = 0;
      await fly(ball, muzzle, l, { ms: 170, lift: 16, each: (q) => { if (n++ % 2 === 0) burst(q, { kind: 'ember', n: 1, colors: ['#ffb36b'], speed: [0, 30], gravity: 0, life: [0.15, 0.3], size: [3, 5] }); } });
      ball.remove();
      c.hideLoser();
      sfx.boom(1.25);
      sfx.shatter();
      flash('#fff', 0.55, 170);
      shake(17, 540);
      punch(1.055, 360, l);
      burst(l, { kind: 'shard', n: 38, colors: [c.losePal.main, c.losePal.light, c.losePal.deep], speed: [240, 960], angle: dir > 0 ? -20 : 200, spread: 250, gravity: 1400, life: [0.8, 1.4], size: [6, 17], floor: l.y + 66 });
      burst(l, { kind: 'pip', n: 9, colors: ['#fff'], speed: [240, 700], spread: 360, gravity: 1400, life: [0.7, 1.2], size: [3, 5], floor: l.y + 66 });
      burst(l, { kind: 'spark', n: 34, colors: ['#ffd27a', '#ff8a3d', '#fff'], speed: [260, 900], spread: 360, gravity: 900, life: [0.3, 0.8], size: [2, 4] });
      burst(l, { kind: 'smoke', n: 16, colors: ['rgba(60,50,44,1)', 'rgba(110,96,84,1)'], speed: [30, 150], angle: -90, spread: 260, gravity: -70, drag: 0.25, life: [0.9, 1.8], size: [12, 24], grow: 34 });
      ring({ x: l.x, y: l.y + 30 }, { to: 420, color: 'rgba(255,220,170,.85)', width: 7, ms: 460, squash: 0.45 });
      await hitStop(120);
      await wait(520);
      total(c, `+${c.margin}`, '#ffd27a');
      await wait(700);
    },
    tap(p, _pal, i) {
      sfx.crack();
      sfx.tick(i);
      burst(p, { kind: 'spark', n: 9, colors: ['#ffd27a', '#fff', '#ff8a3d'], speed: [100, 360], spread: 360, gravity: 600, life: [0.2, 0.4], size: [1.5, 2.5] });
      shake(2.5, 110);
    },
  },

  // ================================================================ 03 · 碎玻璃
  {
    id: '03',
    name: '碎玻璃',
    sign: '顿一帧，然后碎成一地',
    feel: '脆 · 冷 · 干净利落',
    blurb: '打击感最“标准”的做法：命中那一帧整个画面停住约 0.1 秒，再炸开成带棱角的碎片。底座不是掉下来的，是“啪”一下就在那儿，地面裂开；对方的数字先冻住、裂两道、再碎。',
    risk: '靠顿帧取胜，顿得太频繁会觉得卡；碎片是冷色的，和地图的暖色调有反差。',
    async control(c) {
      const b = c.tok.base();
      const foot = mid(b);
      c.commit();
      sfx.thud(1.1);
      sfx.clink(2);
      flash('#eaf6ff', 0.5, 120);
      cracks(foot, { n: 9, len: 170, color: 'rgba(255,255,255,.92)', width: 2, hold: 800, under: true, glow: 'rgba(160,210,255,.8)' });
      burst(foot, { kind: 'glass', n: 22, colors: ['#dff1ff', '#fff', c.pal.light], speed: [160, 520], angle: -90, spread: 180, gravity: 1300, life: [0.5, 1], size: [4, 10], area: [b.width, 4] });
      if (c.tok.plinth) void nudge(c.tok.plinth, [{ transform: 'scale(1.4,2.2)' }, { transform: 'none' }], 130).catch(quiet);
      void nudge(c.tok.root, [{ transform: 'scale(1.2)' }, { transform: 'none' }], 170).catch(quiet);
      await hitStop(110);
      shake(8, 280);
      punch(1.03, 260, foot);
      ring(foot, { to: 300, color: 'rgba(220,240,255,.9)', width: 2, ms: 520, under: true });
      ripple(c, 5, 0.3, 300);
      await wait(650);
    },
    async wipe(c) {
      const p = mid(c.cell);
      const ice = chip(c.cell, c.pal.main, c.digit);
      anim(ice, [{ filter: 'brightness(1) saturate(1)' }, { filter: 'brightness(2.1) saturate(.25)' }], { ms: 150 });
      sfx.crack();
      cracks(p, { n: 4, len: 24, color: '#fff', width: 1.5, hold: 700, under: false, squash: 1, rough: 5 });
      await wait(190);
      sfx.crack();
      cracks(p, { n: 6, len: 46, color: '#fff', width: 1.5, hold: 500, under: false, squash: 1, rough: 7 });
      void nudge(c.tok.root, [{ transform: 'translateX(0)' }, { transform: 'translateX(-2px)', offset: 0.3 }, { transform: 'translateX(2px)', offset: 0.6 }, { transform: 'none' }], 150).catch(quiet);
      await wait(210);
      c.commit();
      ice.remove();
      sfx.shatter();
      sfx.thud(0.9);
      flash('#fff', 0.42, 100);
      burst(p, { kind: 'shard', n: 28, colors: [c.pal.main, c.pal.light, '#fff'], speed: [180, 680], spread: 360, gravity: 1500, life: [0.6, 1.2], size: [4, 11], area: [c.cell.width, c.cell.height] });
      burst(p, { kind: 'glass', n: 18, colors: ['#dff1ff', '#fff'], speed: [120, 520], spread: 360, gravity: 1300, life: [0.5, 1], size: [3, 8] });
      if (c.hadControl) burst(mid(c.base), { kind: 'shard', n: 26, colors: [c.pal.main, c.pal.deep, '#fff'], speed: [80, 420], angle: 90, spread: 190, gravity: 1500, life: [0.6, 1.1], size: [4, 10], area: [c.base.width, c.base.height] });
      await hitStop(90);
      shake(9, 320);
      await wait(600);
    },
    async bonus(c) {
      const bead = put('gl-bead', c.from, 12, 12, { background: c.pal.light });
      await fly(bead, c.from, c.to, { ms: 210, lift: 64, ease: easeIn });
      bead.remove();
      c.land();
      sfx.clink(c.i);
      burst(c.to, { kind: 'glass', n: 7, colors: ['#fff', c.pal.light], speed: [80, 300], spread: 360, gravity: 900, life: [0.25, 0.5], size: [2, 5] });
      ring(c.to, { to: 48, color: '#fff', width: 1.5, ms: 220 });
      anim(c.die, [{ filter: 'brightness(1.9)' }, { filter: 'brightness(1)' }], { ms: 200, fill: 'none' });
      await wait(140);
    },
    async win(c) {
      const w = c.winAt();
      const l = c.loseAt();
      const dir = dirOf(c);
      const reach = Math.abs(l.x - w.x) - boxOf(c.win).width * 0.92;
      await go(c.win, [{ translate: '0 0' }, { translate: `${-dir * 34}px 0` }], { ms: 240, ease: OUT });
      await wait(90);
      sfx.whoosh(0.1);
      await go(c.win, [{ translate: `${-dir * 34}px 0` }, { translate: `${dir * reach}px 0` }], { ms: 100, ease: IN });
      flash('#fff', 0.7, 130);
      sfx.crack();
      cracks(l, { n: 11, len: 78, color: '#fff', width: 2, hold: 260, under: false, squash: 1, rough: 9 });
      await hitStop(160);
      c.hideLoser();
      sfx.shatter();
      sfx.thud(1.3);
      shake(14, 480);
      punch(1.05, 340, l);
      burst(l, { kind: 'shard', n: 48, colors: [c.losePal.main, c.losePal.light, c.losePal.deep, '#fff'], speed: [220, 940], angle: dir > 0 ? 0 : 180, spread: 230, gravity: 1300, life: [0.9, 1.6], size: [6, 18], floor: l.y + 70 });
      burst(l, { kind: 'glass', n: 26, colors: ['#dff1ff', '#fff'], speed: [160, 700], spread: 360, gravity: 1200, life: [0.6, 1.2], size: [4, 10] });
      burst(l, { kind: 'pip', n: 9, colors: ['#fff'], speed: [200, 640], spread: 360, gravity: 1400, life: [0.7, 1.2], size: [3, 5], floor: l.y + 70 });
      void go(c.win, [{ translate: `${dir * reach}px 0` }, { translate: `${dir * (reach + 30)}px 0` }], { ms: 420, ease: OUT }).catch(quiet);
      await wait(700);
      total(c, `+${c.margin}`, '#eaf6ff');
      await wait(700);
    },
    tap(p, pal, i) {
      sfx.clink(i);
      burst(p, { kind: 'glass', n: 6, colors: ['#fff', pal.light], speed: [70, 260], spread: 360, gravity: 900, life: [0.25, 0.5], size: [2, 5] });
      ring(p, { to: 40, color: '#fff', width: 1.5, ms: 200 });
    },
  },

  // ================================================================ 04 · 冲击波
  {
    id: '04',
    name: '冲击波',
    sign: '一圈波纹扫过整张地图，邻国依次被震起',
    feel: '广 · 沉 · 余波长',
    blurb: '打击不止打在一个点上，而是传出去：底座落地，波纹贴着地面扩开，路过的铭牌按距离先后跳一下。清场是从内部把对方的数字崩飞；赢骰子是腾空砸下，把对方的骰子震上天。',
    risk: '别的国家会动，等于把注意力从目标国分散出去；地图拉远、节点很密的时候会显得乱。',
    async control(c) {
      const b = c.tok.base();
      const foot = mid(b);
      const g = plinthOf(b, c.pal.main);
      sfx.whoosh(0.16);
      await go(g, [{ transform: 'translateY(-170px) scale(1.6)', opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], { ms: 200, ease: IN });
      g.remove();
      c.commit();
      sfx.thud(1.5);
      sfx.rumble(0.8);
      bump(10, 320);
      punch(1.03, 340, foot);
      for (let i = 0; i < 3; i++) ring(foot, { to: 380 + i * 300, color: i ? 'rgba(255,255,255,.5)' : c.pal.light, width: 6 - i * 1.5, ms: 640 + i * 180, under: true, delay: i * 90 });
      for (const way of [180, 0]) burst({ x: foot.x + (way ? -1 : 1) * b.width * 0.5, y: foot.y + b.height / 2 }, { kind: 'dust', n: 7, colors: ['#d9cbb0', '#bfae8e'], speed: [160, 460], angle: way, spread: 44, gravity: 30, drag: 0.07, life: [0.4, 0.8], size: [4, 7], grow: 10 });
      press(c, 7, 280);
      ripple(c, 18, 0.8);
      await hitStop(50);
      await wait(950);
    },
    async wipe(c) {
      const at = c.tok.at();
      const dir = c.loser === 1 ? 1 : -1;
      const theirs = c.hadControl ? plinthOf(c.base, c.pal.main) : null;
      ring(at, { from: 4, to: 70, color: c.by.light, width: 4, ms: 210, ease: IN });
      sfx.whoosh(0.2);
      await wait(210);
      const piece = chip(c.cell, c.pal.main, c.digit);
      c.commit();
      sfx.thud(1.35);
      sfx.rumble(0.6);
      shake(10, 380);
      void go(piece, [{ transform: 'none', opacity: 1 }, { transform: `translate(${dir * 560}px, -280px) rotate(${dir * 760}deg) scale(.6)`, opacity: 0.9 }], { ms: 720, ease: 'cubic-bezier(.1,.6,.4,1)' }).then(drop(piece), quiet);
      ring(at, { to: 460, color: 'rgba(255,255,255,.7)', width: 4, ms: 580, under: true });
      ring(at, { to: 260, color: c.by.light, width: 6, ms: 440, under: true });
      cracks(mid(c.base), { n: 8, len: 130, color: 'rgba(20,14,9,.85)', width: 2.5, hold: 1300, under: true });
      if (theirs) void go(theirs, [{ transform: 'none', opacity: 1 }, { transform: `translate(${dir * 60}px, 10px) rotate(${dir * 12}deg)`, opacity: 1, offset: 0.4 }, { transform: `translate(${dir * 190}px, 46px) rotate(${dir * 40}deg)`, opacity: 0 }], { ms: 560, ease: OUT }).then(drop(theirs), quiet);
      void nudge(c.tok.root, [{ transform: 'scale(1.16)' }, { transform: 'none' }], 240).catch(quiet);
      quake(at, 12, 0.8);
      await hitStop(50);
      await wait(800);
    },
    async bonus(c) {
      ring(c.from, { to: 80, color: c.pal.light, width: 3, ms: 320, under: !!c.src });
      const dot = put('sw-pulse', c.from, 14, 14, { background: c.pal.light, boxShadow: `0 0 14px ${c.pal.main}` });
      await fly(dot, c.from, c.to, { ms: 250, ease: easeInOut });
      dot.remove();
      c.land();
      sfx.thud(0.45 + c.i * 0.03);
      sfx.tick(c.i);
      ring(c.to, { to: 100, color: c.pal.light, width: 3, ms: 320 });
      void nudge(c.die, [{ transform: 'translateY(0)' }, { transform: 'translateY(-9px)', offset: 0.35 }, { transform: 'translateY(0)' }], 220).catch(quiet);
      await wait(130);
    },
    async win(c) {
      const w = c.winAt();
      const l = c.loseAt();
      const dx = l.x - w.x;
      const dir = dirOf(c);
      sfx.whoosh(0.3);
      await go(c.win, [{ translate: '0 0', scale: '1' }, { translate: `${dx * 0.3}px -200px`, scale: '1.75' }], { ms: 380, ease: OUT });
      await go(c.win, [{ translate: `${dx * 0.3}px -200px`, scale: '1.75' }, { translate: `${dx * 0.42}px 0px`, scale: '1' }], { ms: 140, ease: IN });
      const hit = { x: w.x + dx * 0.42, y: w.y + 34 };
      sfx.thud(1.6);
      sfx.rumble(1);
      bump(15, 380);
      shake(9, 420);
      punch(1.045, 360, hit);
      for (let i = 0; i < 3; i++) ring(hit, { to: 420 + i * 320, color: i ? 'rgba(255,255,255,.5)' : c.pal.light, width: 7 - i * 2, ms: 620 + i * 160, squash: 0.36, delay: i * 80 });
      for (const way of [180, 0]) burst(hit, { kind: 'dust', n: 10, colors: ['#d9cbb0', '#bfae8e'], speed: [200, 620], angle: way, spread: 50, gravity: 30, drag: 0.07, life: [0.5, 1], size: [5, 9], grow: 14 });
      // the other die is thrown up and off the table
      const up = ghost(c.lose);
      c.hideLoser();
      void go(up, [{ transform: 'translate(0,0) rotate(0deg)', easing: 'cubic-bezier(.2,.7,.4,1)' }, { transform: `translate(${dir * 230}px, -380px) rotate(${dir * 420}deg)`, offset: 0.48, easing: 'cubic-bezier(.6,0,.9,.5)' }, { transform: `translate(${dir * 480}px, 760px) rotate(${dir * 950}deg)` }], { ms: 1050, ease: 'linear' }).then(drop(up), quiet);
      quake(hit, 16, 0.6);
      await hitStop(60);
      await wait(1050);
      total(c, `+${c.margin}`, '#fff');
      await wait(700);
    },
    tap(p, pal, i) {
      sfx.thud(0.5);
      sfx.tick(i);
      ring(p, { to: 90, color: pal.light, width: 3, ms: 340, under: true });
      ring(p, { to: 44, color: '#fff', width: 2, ms: 220 });
    },
  },

  // ================================================================ 05 · 一闪
  {
    id: '05',
    name: '一闪',
    sign: '一道白光划过，停一拍，才裂开',
    feel: '快 · 利 · 有余韵',
    blurb: '剑戟片的打法：出手只有两帧，然后画面压暗、屏住一口气，被砍的东西过了半拍才沿着刀口错开、滑落。控制是一刀横过去，底座就是那道刀痕；骰子是穿身而过。',
    risk: '那半拍的停顿是它的味道，也是它的代价：每次多等约 0.4 秒；风格偏东方武侠，和冷战题材隔了一层。',
    async control(c) {
      const b = c.tok.base();
      const foot = mid(b);
      const veil = dim(0.42, 90);
      const a = { x: b.left - 170, y: foot.y + 12 };
      const z = { x: b.left + b.width + 170, y: foot.y - 12 };
      sfx.slash();
      await streak(a, z, { color: '#fff', width: 5, ms: 80, hold: 280, glow: c.pal.light });
      c.commit();
      if (c.tok.plinth) anim(c.tok.plinth, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }], { ms: 110, fill: 'backwards' });
      for (const way of [0, 180]) burst(foot, { kind: 'spark', n: 12, colors: ['#fff', c.pal.light], speed: [300, 980], angle: way, spread: 26, gravity: 200, life: [0.2, 0.45], size: [1.5, 3] });
      await hitStop(140);
      veil.off(220);
      sfx.thud(0.9);
      sfx.sheath();
      shake(5, 200, 'x');
      void nudge(c.tok.root, [{ transform: 'scale(1.14)' }, { transform: 'none' }], 220).catch(quiet);
      ring(foot, { to: 220, color: c.pal.light, width: 2, ms: 420, under: true });
      await wait(600);
    },
    async wipe(c) {
      const p = mid(c.cell);
      const theirs = c.hadControl ? plinthOf(c.base, c.pal.main) : null;
      const veil = dim(0.5, 80);
      sfx.slash();
      await streak({ x: p.x - 130, y: p.y + 50 }, { x: p.x + 130, y: p.y - 50 }, { color: '#fff', width: 4, ms: 70, hold: 460, glow: c.by.light });
      // the number is already gone underneath; what stands there is whole for one more breath
      const piece = chip(c.cell, c.pal.main, c.digit);
      c.commit();
      await wait(340);
      sfx.sheath();
      await wait(150);
      const [u, d] = halves(piece, -21);
      piece.remove();
      sfx.crack();
      sfx.thud(0.8);
      void go(u, [{ transform: 'none', opacity: 1 }, { transform: 'translate(-7px,-6px)', opacity: 1, offset: 0.22 }, { transform: 'translate(-36px, 80px) rotate(-32deg)', opacity: 0 }], { ms: 760, ease: 'cubic-bezier(.3,0,.9,.5)' }).then(drop(u), quiet);
      void go(d, [{ transform: 'none', opacity: 1 }, { transform: 'translate(8px, 7px)', opacity: 1, offset: 0.22 }, { transform: 'translate(42px, 96px) rotate(26deg)', opacity: 0 }], { ms: 820, ease: 'cubic-bezier(.3,0,.9,.5)' }).then(drop(d), quiet);
      burst(p, { kind: 'spark', n: 14, colors: ['#fff', c.by.light], speed: [200, 700], angle: -21, spread: 24, gravity: 200, life: [0.2, 0.45], size: [1.5, 2.5] });
      if (theirs) {
        const [l, r] = halves(theirs, 70);
        theirs.remove();
        void go(l, [{ transform: 'none', opacity: 1 }, { transform: 'translate(-8px, 3px)', opacity: 1, offset: 0.25 }, { transform: 'translate(-40px, 70px) rotate(-20deg)', opacity: 0 }], { ms: 800, ease: 'cubic-bezier(.3,0,.9,.5)' }).then(drop(l), quiet);
        void go(r, [{ transform: 'none', opacity: 1 }, { transform: 'translate(8px, 3px)', opacity: 1, offset: 0.25 }, { transform: 'translate(44px, 76px) rotate(18deg)', opacity: 0 }], { ms: 860, ease: 'cubic-bezier(.3,0,.9,.5)' }).then(drop(r), quiet);
      }
      veil.off(260);
      shake(4, 180);
      await wait(750);
    },
    async bonus(c) {
      await streak(c.from, c.to, { color: 'rgba(255,255,255,.6)', width: 1.5, ms: 90, hold: 30 });
      // one stroke beside the total for each point: a tally cut in the air
      const x = c.to.x + (c.side === 0 ? -1 : 1) * (48 + c.k * 13);
      sfx.slash();
      void streak({ x: x - 7, y: c.to.y + 20 }, { x: x + 7, y: c.to.y - 20 }, { color: c.pal.light, width: 4, ms: 60, hold: 2600, glow: c.pal.main });
      await wait(60);
      c.land();
      sfx.tick(c.i);
      await wait(170);
    },
    async win(c) {
      const w = c.winAt();
      const l = c.loseAt();
      const dx = l.x - w.x;
      const dir = dirOf(c);
      const veil = dim(0.6, 130);
      await go(c.win, [{ translate: '0 0', scale: '1' }, { translate: `${-dir * 28}px 6px`, scale: '.94' }], { ms: 260, ease: OUT });
      await wait(160);
      sfx.slash();
      // through and past, in two frames
      void go(c.win, [{ translate: `${-dir * 28}px 6px`, scale: '.94' }, { translate: `${dx + dir * 150}px 0`, scale: '1' }], { ms: 70, ease: 'linear' }).catch(quiet);
      void streak({ x: w.x, y: w.y }, { x: l.x + dir * 150, y: l.y }, { color: '#fff', width: 8, ms: 60, hold: 420, glow: c.pal.light });
      await wait(60);
      void streak({ x: l.x - dir * 90, y: l.y + 56 }, { x: l.x + dir * 90, y: l.y - 56 }, { color: '#fff', width: 2.5, ms: 40, hold: 560 });
      burst(l, { kind: 'spark', n: 16, colors: ['#fff', c.pal.light], speed: [300, 1000], angle: dir > 0 ? 0 : 180, spread: 20, gravity: 100, life: [0.2, 0.5], size: [1.5, 3] });
      // the held breath
      await wait(520);
      sfx.sheath();
      await wait(190);
      const [u, d] = halves(c.lose, -32 * dir);
      c.hideLoser();
      sfx.crack();
      sfx.thud(1.2);
      flash('#fff', 0.28, 110);
      shake(9, 340);
      void go(u, [{ transform: 'none', opacity: 1 }, { transform: `translate(${-dir * 12}px,-10px)`, opacity: 1, offset: 0.2 }, { transform: `translate(${-dir * 70}px, 240px) rotate(${-dir * 52}deg)`, opacity: 0 }], { ms: 950, ease: 'cubic-bezier(.4,0,.9,.6)' }).then(drop(u), quiet);
      void go(d, [{ transform: 'none', opacity: 1 }, { transform: `translate(${dir * 12}px, 10px)`, opacity: 1, offset: 0.2 }, { transform: `translate(${dir * 80}px, 260px) rotate(${dir * 44}deg)`, opacity: 0 }], { ms: 1000, ease: 'cubic-bezier(.4,0,.9,.6)' }).then(drop(d), quiet);
      veil.off(320);
      await wait(650);
      total(c, `+${c.margin}`, '#fff');
      await wait(700);
    },
    tap(p, pal, i) {
      sfx.slash();
      sfx.tick(i);
      void streak({ x: p.x - 26, y: p.y + 14 }, { x: p.x + 26, y: p.y - 14 }, { color: '#fff', width: 3, ms: 50, hold: 120, glow: pal.light });
    },
  },

  // ================================================================ 06 · 头奖
  {
    id: '06',
    name: '头奖',
    sign: '灯在转，筹码在跳，数字一格一格往上蹦',
    feel: '亮 · 脆 · 赌赢了',
    blurb: '把“赌赢了”当主题：加成点是一枚枚翻着飞进来的筹码，每进一枚音高升一级、旁边跳出 ×2 ×3；赢的时候金光转起来、筹码喷出来，对方的骰子灰掉、掉下去。清场是把对方的点数像筹码一样耙到自己这边。',
    risk: '是“奖励感”，不是“打击感”：没有重量、没有破坏。赌场味和冷战的严肃气质冲突最大。',
    async control(c) {
      const b = c.tok.base();
      const p = c.tok.at();
      c.commit();
      sfx.ding(4);
      sfx.coin(1);
      if (c.tok.plinth) void nudge(c.tok.plinth, [{ transform: 'translateY(22px) scale(.3,.4)' }, { transform: 'translateY(-3px) scale(1.14,1.3)', offset: 0.6 }, { transform: 'none' }], 340, BACK).catch(quiet);
      rays(p, { color: 'rgba(255,214,110,.5)', size: 560, ms: 950, under: true, spokes: 16, turn: 30 });
      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * Math.PI * 2;
        const bulb = put('jp-bulb', { x: p.x + Math.cos(ang) * (b.width * 0.66), y: p.y + 6 + Math.sin(ang) * 36 }, 8, 8);
        void go(bulb, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1.4)', offset: 0.3 }, { opacity: 0, transform: 'scale(.6)' }], { ms: 420, delay: i * 34 }).then(drop(bulb), quiet);
      }
      burst(p, { kind: 'chip', n: 18, colors: ['#f6c84c', '#f0b429', c.pal.main], speed: [240, 600], angle: -90, spread: 110, gravity: 1500, life: [0.8, 1.4], size: [6, 10], spin: 14, floor: p.y + 64 });
      burst(p, { kind: 'confetti', n: 20, colors: [c.pal.main, c.pal.light, '#fff', '#f6c84c'], speed: [160, 440], angle: -90, spread: 170, gravity: 600, drag: 0.3, life: [0.9, 1.6], size: [5, 9] });
      void nudge(c.tok.root, [{ transform: 'scale(1)' }, { transform: 'scale(1.22)', offset: 0.3 }, { transform: 'scale(1)' }], 320, BACK).catch(quiet);
      shake(3, 160);
      await wait(260);
      sfx.coin(4);
      await wait(750);
    },
    async wipe(c) {
      const p = mid(c.cell);
      const mine = mid(c.tok.cell(c.loser === 1 ? 0 : 1));
      const n = Math.max(1, Number(c.digit) || 1) * 3;
      const theirs = c.hadControl ? plinthOf(c.base, c.pal.main) : null;
      const dark = chip(c.cell, '#241c15', '');
      c.commit();
      sfx.thud(0.7);
      slam(p, '✕', { color: '#fff', size: 24, rot: 0, ms: 650, from: 2.2 });
      fade(dark, 400, 500);
      if (theirs) void go(theirs, [{ transform: 'none', opacity: 1, filter: 'none' }, { transform: 'none', opacity: 1, filter: 'grayscale(1) brightness(.5)', offset: 0.4 }, { transform: 'translateY(34px)', opacity: 0, filter: 'grayscale(1) brightness(.5)' }], { ms: 520, ease: IN }).then(drop(theirs), quiet);
      // their points, as chips, are raked across to the other side
      const all: Promise<void>[] = [];
      for (let i = 0; i < n; i++) {
        const coin = put('jp-coin', p, 13, 13, { background: c.pal.main });
        const from = { x: p.x + rand(-9, 9), y: p.y + rand(-6, 6) };
        all.push(wait(120 + i * 55).then(() => fly(coin, from, mine, { ms: 300, lift: 40 + rand(0, 34), ease: easeInOut, spin: 540 })).then(() => {
          coin.remove();
          sfx.coin(i);
          ring(mine, { to: 36, color: '#ffe08a', width: 2, ms: 200 });
        }));
      }
      void nudge(c.tok.root, [{ transform: 'rotate(0deg)' }, { transform: `rotate(${c.loser === 1 ? -3 : 3}deg)`, offset: 0.4 }, { transform: 'rotate(0deg)' }], 500).catch(quiet);
      await Promise.all(all);
      burst(mine, { kind: 'chip', n: 8, colors: ['#f6c84c', '#ffe08a'], speed: [140, 340], angle: -90, spread: 100, gravity: 1300, life: [0.5, 0.9], size: [3, 5], spin: 14 });
      await wait(450);
    },
    async bonus(c) {
      const coin = put('jp-coin big', c.from, 20, 20, { background: c.pal.main });
      sfx.whoosh(0.12);
      await fly(coin, c.from, c.to, { ms: 270, lift: 96, spin: 720, ease: easeInOut });
      coin.remove();
      c.land();
      sfx.coin(c.i);
      ring(c.to, { to: 64, color: '#ffe08a', width: 3, ms: 260 });
      burst(c.to, { kind: 'ember', n: 7, colors: ['#ffe08a', '#fff'], speed: [80, 260], spread: 360, gravity: 300, life: [0.25, 0.5], size: [2, 3.5] });
      if (c.k > 0) slam({ x: c.to.x + (c.side === 0 ? -1 : 1) * 78, y: c.to.y - 34 }, `×${c.k + 1}`, { cls: 'jp-combo', color: '#ffe08a', size: 20 + c.k * 7, ms: 560, rot: c.side === 0 ? -8 : 8, from: 1.9 });
      await wait(120);
    },
    async win(c) {
      const w = c.winAt();
      const dir = dirOf(c);
      sfx.jackpot();
      rays(w, { color: 'rgba(255,214,110,.6)', size: 820, ms: 1900, back: true, spokes: 18, turn: 60, alpha: 0.9 });
      void go(c.win, [{ scale: '1' }, { scale: '1.4' }], { ms: 320, ease: BACK }).catch(quiet);
      flash('#ffe9b0', 0.26, 220);
      // the other die's light goes out, and it drops through the floor
      void go(c.lose, [{ filter: 'none', translate: '0 0', opacity: 1, rotate: '0deg' }, { filter: 'grayscale(1) brightness(.5)', translate: '0 0', opacity: 1, rotate: `${dir * 8}deg`, offset: 0.35 }, { filter: 'grayscale(1) brightness(.4)', translate: '0 190px', opacity: 0, rotate: `${dir * 30}deg` }], { ms: 700, ease: IN }).then(() => c.hideLoser(), quiet);
      for (let i = 0; i < 4; i++) {
        burst({ x: w.x, y: w.y - 10 }, { kind: 'chip', n: 18, colors: ['#f6c84c', '#f0b429', '#ffe08a'], speed: [340, 820], angle: -90, spread: 84 + i * 16, gravity: 1500, life: [1, 1.7], size: [8, 13], spin: 16, floor: w.y + 92 });
        sfx.coin(i * 2);
        shake(3, 140);
        await wait(170);
      }
      burst({ x: w.x, y: w.y - 40 }, { kind: 'confetti', n: 40, colors: [c.pal.main, c.pal.light, '#fff', '#f6c84c'], speed: [200, 620], angle: -90, spread: 200, gravity: 520, drag: 0.3, life: [1.2, 2], size: [5, 10] });
      total(c, `+${c.margin}`, '#ffe08a', 'im-margin jp-gold');
      await wait(1200);
      void go(c.win, [{ scale: '1.4' }, { scale: '1.12' }], { ms: 300 }).catch(quiet);
    },
    tap(p, _pal, i) {
      sfx.coin(i);
      ring(p, { to: 44, color: '#ffe08a', width: 2, ms: 240 });
      burst(p, { kind: 'ember', n: 5, colors: ['#ffe08a', '#fff'], speed: [60, 220], spread: 360, gravity: 300, life: [0.25, 0.45], size: [2, 3] });
    },
  },

  // ================================================================ 07 · 闪电
  {
    id: '07',
    name: '闪电',
    sign: '一道电劈下来，屏幕白一帧',
    feel: '炸 · 亮 · 带电',
    blurb: '加成点最好看的一套：每个邻国向骰子打一道电弧，骰子越充越亮，赢的那一下把攒的电一次放出去，对方的骰子抽搐两下化成灰。控制是一道雷劈在国家上，底座带着余电立住。',
    risk: '全屏白闪对光敏的玩家不友好，正式用需要一个“减弱闪光”的开关；闪电偏奇幻，不那么写实。',
    async control(c) {
      const b = c.tok.base();
      const foot = mid(b);
      const p = c.tok.at();
      flash('#cfe6ff', 0.2, 70);
      await wait(100);
      bolt({ x: p.x + rand(-140, 140), y: -20 }, p, { color: c.pal.light, width: 5, ms: 250, rough: 64, branches: 3 });
      sfx.zap(1.2);
      sfx.thunder();
      flash('#fff', 0.75, 140);
      c.commit();
      shake(10, 320);
      punch(1.03, 260, p);
      if (c.tok.plinth) anim(c.tok.plinth, [{ filter: 'brightness(3) drop-shadow(0 0 10px #fff)' }, { filter: `brightness(1.5) drop-shadow(0 0 7px ${c.pal.light})`, offset: 0.4 }, { filter: 'brightness(1) drop-shadow(0 0 0 transparent)' }], { ms: 800, fill: 'none' });
      anim(c.tok.body, [{ filter: 'brightness(2.6)' }, { filter: 'brightness(1)' }], { ms: 380, fill: 'none' });
      burst(foot, { kind: 'spark', n: 26, colors: ['#fff', '#bfe0ff', c.pal.light], speed: [220, 820], spread: 360, gravity: 500, life: [0.25, 0.6], size: [1.5, 3] });
      ring(foot, { to: 240, color: '#dff0ff', width: 3, ms: 400, under: true });
      scorch(foot, 160, 2000, 'rgba(10,14,22,.7)');
      press(c, 4, 220);
      await hitStop(70);
      for (let i = 0; i < 4; i++) {
        await wait(95);
        const q = { x: p.x + rand(-b.width / 2, b.width / 2), y: p.y + rand(-14, 24) };
        bolt(q, { x: q.x + rand(-44, 44), y: q.y + rand(-28, 28) }, { color: c.pal.light, width: 1.6, ms: 110, rough: 10, branches: 0 });
        sfx.buzz(i);
      }
      await wait(380);
    },
    async wipe(c) {
      const p = mid(c.cell);
      bolt({ x: p.x + rand(-90, 90), y: -20 }, p, { color: c.by.light, width: 5, ms: 230, rough: 60, branches: 3 });
      sfx.zap(1.2);
      flash('#fff', 0.62, 120);
      shake(9, 300);
      const piece = chip(c.cell, c.pal.main, c.digit);
      const theirs = c.hadControl ? plinthOf(c.base, c.pal.main) : null;
      c.commit();
      if (theirs) void go(theirs, [{ filter: 'none' }, { filter: 'invert(1)', offset: 0.25 }, { filter: 'none', offset: 0.5 }, { filter: 'grayscale(1) brightness(.45)' }], { ms: 330, ease: 'steps(5)' }).catch(quiet);
      await go(piece, [{ filter: 'none' }, { filter: 'invert(1)', offset: 0.2 }, { filter: 'none', offset: 0.4 }, { filter: 'invert(1) brightness(2)', offset: 0.6 }, { filter: 'grayscale(1) brightness(.5)' }], { ms: 330, ease: 'steps(5)' });
      piece.remove();
      theirs?.remove();
      sfx.thunder();
      burst(p, { kind: 'ash', n: 50, colors: ['#6b6660', '#3b3632', '#9a948c', c.pal.deep], speed: [20, 160], angle: -90, spread: 210, gravity: -80, drag: 0.3, life: [0.8, 1.8], size: [2, 5], area: [c.cell.width, c.cell.height] });
      burst(p, { kind: 'ember', n: 12, colors: ['#ffb36b', '#fff'], speed: [30, 140], angle: -90, spread: 120, gravity: -120, life: [0.5, 1.1], size: [1.5, 3] });
      if (c.hadControl) burst(mid(c.base), { kind: 'ash', n: 56, colors: ['#6b6660', '#3b3632', c.pal.deep], speed: [20, 130], angle: -90, spread: 200, gravity: -70, drag: 0.3, life: [0.8, 1.7], size: [2, 5], area: [c.base.width, c.base.height] });
      scorch(mid(c.base), 150, 2000, 'rgba(10,14,22,.7)');
      await wait(700);
    },
    async bonus(c) {
      bolt(c.from, c.to, { color: c.pal.light, width: 3, ms: 160, rough: 30, branches: 1 });
      sfx.zap(0.6);
      sfx.buzz(c.i);
      await wait(95);
      c.land();
      // the die holds the charge: brighter with every point
      anim(c.die, [{ filter: `brightness(2) drop-shadow(0 0 ${16 + c.k * 10}px ${c.pal.light})` }, { filter: `brightness(${1.12 + c.k * 0.08}) drop-shadow(0 0 ${8 + c.k * 7}px ${c.pal.light})` }], { ms: 420 });
      burst(c.to, { kind: 'spark', n: 9, colors: ['#fff', c.pal.light], speed: [100, 380], spread: 360, gravity: 400, life: [0.2, 0.4], size: [1.5, 2.5] });
      shake(2, 90);
      await wait(180);
    },
    async win(c) {
      const w = c.winAt();
      const l = c.loseAt();
      anim(c.win, [{ filter: 'brightness(1.2)' }, { filter: `brightness(2.6) drop-shadow(0 0 34px ${c.pal.light})` }], { ms: 400 });
      for (let i = 0; i < 4; i++) {
        const q = { x: w.x + rand(-50, 50), y: w.y + rand(-50, 50) };
        bolt(w, q, { color: c.pal.light, width: 1.8, ms: 100, rough: 14, branches: 0 });
        sfx.buzz(i + 2);
        await wait(100);
      }
      bolt(w, l, { color: c.pal.light, width: 9, ms: 340, rough: 38, branches: 4 });
      sfx.zap(1.6);
      sfx.thunder();
      flash('#fff', 0.8, 160);
      shake(15, 500);
      punch(1.045, 320, l);
      const husk = ghost(c.lose);
      c.hideLoser();
      await go(husk, [{ transform: 'translate(0,0)', filter: 'none' }, { transform: 'translate(-7px,3px)', filter: 'invert(1)', offset: 0.25 }, { transform: 'translate(8px,-4px)', filter: 'brightness(3)', offset: 0.5 }, { transform: 'translate(-5px,2px)', filter: 'invert(1)', offset: 0.75 }, { transform: 'translate(0,0)', filter: 'grayscale(1) brightness(.4)' }], { ms: 320, ease: 'steps(8)' });
      husk.remove();
      burst(l, { kind: 'ash', n: 80, colors: ['#6b6660', '#3b3632', '#9a948c', c.losePal.deep], speed: [20, 200], angle: -90, spread: 260, gravity: -70, drag: 0.3, life: [0.9, 2], size: [3, 7], area: [90, 90] });
      burst(l, { kind: 'ember', n: 24, colors: ['#ffb36b', '#fff'], speed: [40, 220], angle: -90, spread: 200, gravity: -130, life: [0.6, 1.3], size: [2, 3.5] });
      anim(c.win, [{ filter: `brightness(2.6) drop-shadow(0 0 34px ${c.pal.light})` }, { filter: 'brightness(1) drop-shadow(0 0 0 transparent)' }], { ms: 600 });
      await wait(800);
      total(c, `+${c.margin}`, '#dff0ff');
      await wait(700);
    },
    tap(p, pal, i) {
      sfx.buzz(i);
      bolt({ x: p.x + rand(-26, 26), y: p.y - 44 }, p, { color: pal.light, width: 2, ms: 110, rough: 12, branches: 0 });
      burst(p, { kind: 'spark', n: 6, colors: ['#fff', pal.light], speed: [80, 300], spread: 360, gravity: 400, life: [0.2, 0.4], size: [1.5, 2.5] });
    },
  },

  // ================================================================ 08 · 实木棋子
  {
    id: '08',
    name: '实木棋子',
    sign: '像真有人把一块木头拍在桌上',
    feel: '实 · 短 · 不加戏',
    blurb: '什么都不炸。底座是被一只看不见的手“啪”地拍在桌上的，落下来歪了一点、晃一下才稳；桌面一震，旁边的棋子跟着跳。清场是一指头把对方的数字弹出桌外；赢骰子是台球：撞上去，自己停住，对方滚走。',
    risk: '最克制的一套，爽感来自“真”而不是“大”；单看一次可能觉得不够过瘾，要靠音效撑。',
    async control(c) {
      const b = c.tok.base();
      const foot = mid(b);
      const g = plinthOf(b, c.pal.main);
      await go(g, [{ transform: 'translate(16px,-130px) rotate(8deg) scale(1.3)', opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 }], { ms: 170, ease: IN });
      g.remove();
      c.commit();
      sfx.thock(0.9);
      bump(7, 230);
      if (c.tok.plinth) void nudge(c.tok.plinth, [{ transform: 'rotate(2.6deg) scale(1.05,.78)' }, { transform: 'rotate(-1.5deg) scale(1,1.08)', offset: 0.4 }, { transform: 'rotate(.7deg)', offset: 0.7 }, { transform: 'none' }], 340, 'ease-out').catch(quiet);
      void nudge(c.tok.root, [{ transform: 'translateY(-8px)' }, { transform: 'translateY(1.5px)', offset: 0.5 }, { transform: 'none' }], 230).catch(quiet);
      for (const way of [180, 0]) burst({ x: foot.x + (way ? -1 : 1) * b.width * 0.4, y: foot.y + b.height / 2 }, { kind: 'dust', n: 5, colors: ['#e2d5b8'], speed: [60, 170], angle: way, spread: 50, gravity: -10, drag: 0.1, life: [0.35, 0.7], size: [4, 8], grow: 12 });
      ripple(c, 8, 0.14, 380);
      await wait(240);
      sfx.clack(0);
      await wait(600);
    },
    async wipe(c) {
      const p = mid(c.cell);
      const dir = c.loser === 1 ? 1 : -1;
      const theirs = c.hadControl ? plinthOf(c.base, c.pal.main) : null;
      const piece = chip(c.cell, c.pal.main, c.digit, { radius: '5px' });
      // the finger draws back
      await go(piece, [{ transform: 'translateX(0)' }, { transform: `translateX(${-dir * 5}px)` }], { ms: 150, ease: OUT });
      c.commit();
      sfx.thock(1.35);
      bump(3, 160);
      void streak({ x: p.x, y: p.y }, { x: p.x + dir * 230, y: p.y - 52 }, { color: 'rgba(255,255,255,.8)', width: 3, ms: 110, hold: 380 });
      ring(p, { to: 64, color: 'rgba(255,255,255,.85)', width: 3, ms: 240 });
      burst(p, { kind: 'dust', n: 6, colors: ['#e2d5b8'], speed: [60, 190], angle: dir > 0 ? 180 : 0, spread: 70, gravity: -10, drag: 0.1, life: [0.3, 0.6], size: [4, 7], grow: 10 });
      void nudge(c.tok.root, [{ transform: 'rotate(0deg)' }, { transform: `rotate(${dir * 3}deg) translateX(${dir * 3}px)`, offset: 0.25 }, { transform: `rotate(${-dir}deg)`, offset: 0.6 }, { transform: 'none' }], 320).catch(quiet);
      if (theirs) {
        wait(90).then(() => sfx.clack(1), quiet);
        void go(theirs, [{ transform: 'none', opacity: 1 }, { transform: `translate(${dir * 46}px, 5px) rotate(${dir * 16}deg)`, opacity: 1, offset: 0.4 }, { transform: `translate(${dir * 150}px, 16px) rotate(${dir * 88}deg)`, opacity: 0 }], { ms: 520, ease: OUT, delay: 60 }).then(drop(theirs), quiet);
      }
      await go(piece, [{ transform: `translateX(${-dir * 5}px) rotate(0deg)` }, { transform: `translate(${dir * 700}px, -160px) rotate(${dir * 1080}deg)` }], { ms: 760, ease: 'cubic-bezier(.12,.5,.4,1)' });
      piece.remove();
      sfx.clack(3);
      await wait(380);
    },
    async bonus(c) {
      const disc = put('tb-disc fx-keep', c.from, 22, 22, { background: c.pal.main });
      disc.textContent = '+1';
      // slid across the table to a stack beside the die
      const stack = { x: c.to.x + (c.side === 0 ? -1 : 1) * (66 + c.k * 3), y: c.to.y + 12 - c.k * 11 };
      await fly(disc, c.from, stack, { ms: 310, ease: easeOut });
      c.land();
      sfx.clack(c.i);
      void nudge(c.die, [{ transform: 'translateX(0)' }, { transform: `translateX(${c.side === 0 ? 3 : -3}px)`, offset: 0.3 }, { transform: 'none' }], 150).catch(quiet);
      bump(1.5, 110);
      await wait(150);
    },
    async win(c) {
      const w = c.winAt();
      const l = c.loseAt();
      const dir = dirOf(c);
      const gap = Math.abs(l.x - w.x) - boxOf(c.win).width * 0.97;
      await go(c.win, [{ translate: '0 0' }, { translate: `${-dir * 36}px 0` }], { ms: 320, ease: OUT });
      await wait(130);
      sfx.whoosh(0.09);
      await go(c.win, [{ translate: `${-dir * 36}px 0` }, { translate: `${dir * gap}px 0` }], { ms: 120, ease: 'cubic-bezier(.6,0,1,1)' });
      sfx.thock(0.7);
      sfx.clack(3);
      bump(6, 220);
      shake(4, 170, 'x');
      // it stops dead: all it had has gone into the other one
      void go(c.win, [{ translate: `${dir * gap}px 0` }, { translate: `${dir * (gap - 8)}px 0`, offset: 0.4 }, { translate: `${dir * (gap - 3)}px 0` }], { ms: 280 }).catch(quiet);
      const away = ghost(c.lose);
      c.hideLoser();
      const spin = away.querySelector('.sp-die-fly');
      if (spin) anim(spin, [{ transform: 'rotate(0deg)' }, { transform: `rotate(${dir * 800}deg)` }], { ms: 950, ease: OUT });
      burst({ x: l.x - dir * 30, y: l.y + 30 }, { kind: 'dust', n: 7, colors: ['#e2d5b8'], speed: [60, 200], angle: dir > 0 ? 0 : 180, spread: 60, gravity: -10, drag: 0.1, life: [0.35, 0.7], size: [5, 9], grow: 12 });
      await go(away, [{ transform: 'translate(0,0)' }, { transform: `translate(${dir * innerWidth * 0.62}px, ${rand(-70, 30)}px)` }], { ms: 950, ease: 'cubic-bezier(.1,.7,.3,1)' });
      away.remove();
      sfx.clack(0);
      wait(110).then(() => sfx.clack(2), quiet);
      await wait(350);
      total(c, `+${c.margin}`, PAPER);
      await wait(700);
    },
    tap(p, _pal, i) {
      sfx.clack(i);
      bump(2, 120);
      ring(p, { to: 38, color: 'rgba(255,255,255,.6)', width: 2, ms: 200 });
    },
  },

  // ================================================================ 09 · 宣传画
  {
    id: '09',
    name: '宣传画',
    sign: '画面定格成一张海报：放射光芒，大字标题',
    feel: '正 · 响亮 · 有仪式感',
    blurb: '不靠碎片，靠构图：命中的一刻全屏定住半秒，从国家身后射出阵营色的光芒，铭牌放大，一条斜标语“控制 · 意大利”拍上来。清场是两笔粗白线打个叉，剪纸掉下去；赢骰子是胜者放大成海报主角。',
    risk: '每次占半秒到一秒的全屏，最打断节奏；适合留给少数大场面（比如控制战场国、政变翻盘），不适合每次放置都来。',
    async control(c) {
      const p = c.tok.at();
      c.commit();
      sfx.brass();
      sfx.drum(2);
      const paper = mk('ps-paper');
      void go(paper, [{ opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { ms: 1000, ease: 'linear' }).then(drop(paper), quiet);
      rays(p, { color: c.pal.main, size: 1700, ms: 1000, under: true, spokes: 18, alpha: 0.8, turn: 7 });
      punch(1.04, 900, p);
      shake(5, 180);
      void nudge(c.tok.root, [{ transform: 'scale(1.7)' }, { transform: 'scale(1.42)', offset: 0.12 }, { transform: 'scale(1.42)', offset: 0.8 }, { transform: 'scale(1)' }], 1000, 'ease-out').catch(quiet);
      const band = slam({ x: p.x, y: p.y + 96 }, `控制 · ${c.tok.name}`, { cls: 'ps-band', color: '#fff', size: 34, rot: -5, ms: 950, from: 1.7 });
      band.style.background = c.pal.main;
      await wait(1050);
    },
    async wipe(c) {
      const p = mid(c.cell);
      const at = c.tok.at();
      const theirs = c.hadControl ? plinthOf(c.base, c.pal.main) : null;
      const paper = mk('ps-paper');
      void go(paper, [{ opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.82 }, { opacity: 0 }], { ms: 1150, ease: 'linear' }).then(drop(paper), quiet);
      rays(at, { color: c.by.main, size: 1700, ms: 1150, under: true, spokes: 18, alpha: 0.75, turn: 7 });
      const s = 26;
      sfx.drum(0);
      await streak({ x: p.x - s, y: p.y - s }, { x: p.x + s, y: p.y + s }, { color: '#fff', width: 7, ms: 70, hold: 520 });
      shake(3, 120);
      await wait(70);
      sfx.drum(3);
      await streak({ x: p.x + s, y: p.y - s }, { x: p.x - s, y: p.y + s }, { color: '#fff', width: 7, ms: 70, hold: 440 });
      shake(4, 140);
      const piece = chip(c.cell, c.pal.main, c.digit, { cls: 'ps-cut' });
      c.commit();
      sfx.brass();
      // the cut-out comes unstuck and drops off the page
      void go(piece, [{ transform: 'none', opacity: 1 }, { transform: 'rotate(-9deg) translateY(4px)', opacity: 1, offset: 0.25 }, { transform: 'translate(-22px, 170px) rotate(-70deg)', opacity: 0 }], { ms: 720, ease: IN }).then(drop(piece), quiet);
      if (theirs) void go(theirs, [{ transform: 'none', opacity: 1 }, { transform: 'rotate(6deg) translateY(5px)', opacity: 1, offset: 0.3 }, { transform: 'translate(26px, 150px) rotate(48deg)', opacity: 0 }], { ms: 760, ease: IN, delay: 90 }).then(drop(theirs), quiet);
      const band = slam({ x: at.x, y: at.y + 92 }, '清除', { cls: 'ps-band', color: '#fff', size: 34, rot: 5, ms: 800, from: 1.7 });
      band.style.background = c.by.main;
      await wait(850);
    },
    async bonus(c) {
      // a star for each point, in a row beside the total, each to a drum tap
      const at = { x: c.to.x + (c.side === 0 ? -1 : 1) * (52 + c.k * 27), y: c.to.y - 2 };
      void streak(c.from, at, { color: c.pal.light, width: 2, ms: 120, hold: 30 });
      await wait(110);
      const star = put('ps-star fx-keep', at, 28, 28, { color: c.pal.light });
      star.textContent = '★';
      await go(star, [{ transform: 'scale(3.2) rotate(-50deg)', opacity: 0 }, { transform: 'scale(1) rotate(0deg)', opacity: 1 }], { ms: 140, ease: IN });
      c.land();
      sfx.drum(c.i);
      ring(at, { to: 54, color: c.pal.light, width: 3, ms: 240 });
      shake(2, 90);
      await wait(130);
    },
    async win(c) {
      const w = c.winAt();
      const l = c.loseAt();
      const dir = dirOf(c);
      sfx.brass();
      sfx.drum(4);
      const paper = mk('ps-paper');
      void go(paper, [{ opacity: 0 }, { opacity: 1, offset: 0.06 }, { opacity: 1, offset: 0.86 }, { opacity: 0 }], { ms: 1700, ease: 'linear' }).then(drop(paper), quiet);
      rays(w, { color: c.pal.main, size: 1900, ms: 1700, back: true, spokes: 18, alpha: 0.85, turn: 9 });
      shake(5, 200);
      void go(c.win, [{ scale: '1', rotate: '0deg' }, { scale: '1.8', rotate: `${-dir * 9}deg`, offset: 0.1 }, { scale: '1.65', rotate: `${-dir * 7}deg` }], { ms: 1300, ease: 'ease-out' }).catch(quiet);
      void go(c.lose, [{ filter: 'none', rotate: '0deg' }, { filter: 'grayscale(1) contrast(1.3) brightness(.7)', rotate: `${dir * 14}deg` }], { ms: 150 }).catch(quiet);
      await wait(190);
      const s = 54;
      sfx.drum(0);
      await streak({ x: l.x - s, y: l.y - s }, { x: l.x + s, y: l.y + s }, { color: '#fff', width: 10, ms: 70, hold: 700 });
      await wait(60);
      sfx.drum(3);
      await streak({ x: l.x + s, y: l.y - s }, { x: l.x - s, y: l.y + s }, { color: '#fff', width: 10, ms: 70, hold: 620 });
      slam({ x: w.x - dir * 30, y: w.y - 150 }, '胜', { cls: 'ps-head', color: '#fff', size: 100, rot: -7, ms: 1250 });
      const band = slam({ x: l.x, y: l.y + 118 }, `差 ${c.margin}`, { cls: 'ps-band', color: '#fff', size: 30, rot: 4, ms: 1150, from: 1.6 });
      band.style.background = c.pal.main;
      sfx.fanfare();
      await wait(620);
      await go(c.lose, [{ translate: '0 0', rotate: `${dir * 14}deg`, opacity: 1 }, { translate: `${dir * 34}px 280px`, rotate: `${dir * 84}deg`, opacity: 0 }], { ms: 520, ease: IN });
      c.hideLoser();
      sfx.thud(0.8);
      shake(5, 200);
      await wait(350);
      void go(c.win, [{ scale: '1.65', rotate: `${-dir * 7}deg` }, { scale: '1.15', rotate: '0deg' }], { ms: 320 }).catch(quiet);
      await wait(450);
    },
    tap(p, pal, i) {
      sfx.drum(i);
      ring(p, { to: 50, color: pal.light, width: 4, ms: 240 });
      rays(p, { color: pal.light, size: 150, ms: 320, under: true, spokes: 10, alpha: 0.6, turn: 10 });
    },
  },

  // ================================================================ 10 · 锁定
  {
    id: '10',
    name: '锁定',
    sign: '准星收拢，滴、滴、滴——锁定，然后才是那一下',
    feel: '稳 · 蓄力 · 一击必中',
    blurb: '爽感来自“等”：四个括号向目标收拢，提示音越来越急，锁定之后才是那一下。加成点是雷达回波：邻国闪一圈，虚线连到骰子，总数旁亮起一格。被清除的东西不是炸掉，而是像信号一样被切成几条、错位、消失。',
    risk: '每次命中前多出约 0.4 秒的锁定；雷达、故障的语汇偏电子，和手绘地图的质感要再调和。',
    async control(c) {
      const b = c.tok.base();
      const foot = mid(b);
      const p = c.tok.at();
      const r = await lockOn(p, b.width + 56, c.pal.light);
      await wait(120);
      void streak({ x: p.x, y: -10 }, foot, { color: c.pal.light, width: 3, ms: 70, hold: 90, glow: c.pal.main });
      await wait(70);
      c.commit();
      sfx.thud(1.2);
      flash(c.pal.light, 0.2, 120);
      shake(7, 260);
      punch(1.03, 280, foot);
      // the plinth opens out from its middle
      if (c.tok.plinth) anim(c.tok.plinth, [{ clipPath: 'inset(0 50% 0 50%)' }, { clipPath: 'inset(0 0% 0 0%)' }], { ms: 170, fill: 'backwards' });
      ring(foot, { to: 300, color: c.pal.light, width: 2, ms: 540, under: true });
      ring(foot, { to: 160, color: c.pal.light, width: 2, ms: 400, under: true, delay: 90 });
      burst(foot, { kind: 'pixel', n: 24, colors: [c.pal.light, '#fff', c.pal.main], speed: [110, 460], angle: -90, spread: 210, gravity: 520, life: [0.3, 0.7], size: [2, 4] });
      press(c, 4, 200);
      slam({ x: p.x + b.width * 0.5 + 74, y: p.y - 34 }, '已控制', { cls: 'lk-mono', color: c.pal.light, size: 14, rot: 0, ms: 1100, from: 1.25 });
      void go(r, [{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.25)', opacity: 0 }], { ms: 280, delay: 220 }).then(drop(r), quiet);
      await wait(750);
    },
    async wipe(c) {
      const p = mid(c.cell);
      const theirs = c.hadControl ? plinthOf(c.base, c.pal.main) : null;
      const r = await lockOn(p, 58, c.by.light, 105);
      await wait(100);
      const piece = chip(c.cell, c.pal.main, c.digit);
      c.commit();
      sfx.glitch();
      sfx.thud(0.9);
      shake(6, 240, 'x');
      flash('#fff', 0.2, 80);
      // it is cut into strips that slip sideways, and then it is not there
      for (const [i, s] of bands(piece, 4).entries()) {
        const way = i % 2 ? 1 : -1;
        void go(s, [{ transform: 'translateX(0)', filter: 'none', opacity: 1 }, { transform: `translateX(${way * rand(8, 22)}px)`, filter: 'hue-rotate(120deg) brightness(1.7)', opacity: 1, offset: 0.3 }, { transform: `translateX(${-way * rand(10, 30)}px)`, filter: 'none', opacity: 1, offset: 0.6 }, { transform: `translateX(${way * 46}px) scaleX(2.2)`, filter: 'brightness(2)', opacity: 0 }], { ms: 380, ease: 'steps(6)' }).then(drop(s), quiet);
      }
      piece.remove();
      if (theirs) {
        for (const [i, s] of bands(theirs, 3).entries()) void go(s, [{ transform: 'translateX(0)', opacity: 1 }, { transform: `translateX(${(i % 2 ? 1 : -1) * rand(14, 40)}px)`, opacity: 1, offset: 0.4 }, { transform: `translateX(${(i % 2 ? -1 : 1) * 70}px) scaleX(1.8)`, opacity: 0 }], { ms: 420, ease: 'steps(6)' }).then(drop(s), quiet);
        theirs.remove();
        burst(mid(c.base), { kind: 'pixel', n: 36, colors: [c.pal.main, c.pal.light, '#fff'], speed: [40, 300], spread: 360, gravity: 240, life: [0.4, 0.9], size: [2, 5], area: [c.base.width, c.base.height] });
      }
      burst(p, { kind: 'pixel', n: 30, colors: [c.pal.main, c.pal.light, '#fff'], speed: [60, 380], spread: 360, gravity: 200, life: [0.4, 0.9], size: [2, 5], area: [c.cell.width, c.cell.height] });
      slam({ x: p.x + 86, y: p.y - 34 }, '目标清除', { cls: 'lk-mono', color: c.by.light, size: 14, rot: 0, ms: 1000, from: 1.25 });
      void go(r, [{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.3)', opacity: 0 }], { ms: 260, delay: 160 }).then(drop(r), quiet);
      await wait(700);
    },
    async bonus(c) {
      ring(c.from, { to: 96, color: c.pal.light, width: 2, ms: 400, under: !!c.src });
      sfx.beep(c.i);
      await streak(c.from, c.to, { color: c.pal.light, width: 1.6, ms: 150, hold: 70, dash: '5 6' });
      c.land();
      sfx.beep(c.i + 2);
      // one more segment lit beside the total
      const seg = put('lk-seg fx-keep', { x: c.to.x + (c.side === 0 ? -1 : 1) * (46 + c.k * 12), y: c.to.y }, 8, 28, { background: c.pal.light, boxShadow: `0 0 10px ${c.pal.main}` });
      void go(seg, [{ opacity: 0, transform: 'scaleY(.2)' }, { opacity: 1, transform: 'scaleY(1)' }], { ms: 120 }).catch(quiet);
      await wait(150);
    },
    async win(c) {
      const w = c.winAt();
      const l = c.loseAt();
      const r = await lockOn(l, 150, c.pal.light, 150);
      await wait(150);
      sfx.whoosh(0.1);
      void go(c.win, [{ translate: '0 0' }, { translate: `${-dirOf(c) * 16}px 0`, offset: 0.2 }, { translate: '0 0' }], { ms: 320 }).catch(quiet);
      await streak(w, l, { color: '#fff', width: 5, ms: 80, hold: 100, glow: c.pal.light });
      const husk = ghost(c.lose);
      c.hideLoser();
      sfx.glitch();
      sfx.boom(0.8);
      flash('#fff', 0.5, 130);
      shake(13, 440);
      punch(1.045, 320, l);
      for (const [i, s] of bands(husk, 5).entries()) {
        const way = i % 2 ? 1 : -1;
        void go(s, [{ transform: 'translateX(0)', filter: 'none', opacity: 1 }, { transform: `translateX(${way * rand(14, 40)}px)`, filter: 'hue-rotate(120deg) brightness(1.8)', opacity: 1, offset: 0.3 }, { transform: `translateX(${-way * rand(16, 50)}px)`, filter: 'none', opacity: 1, offset: 0.6 }, { transform: `translateX(${way * 120}px) scaleX(2.6)`, filter: 'brightness(2)', opacity: 0 }], { ms: 440, ease: 'steps(7)' }).then(drop(s), quiet);
      }
      husk.remove();
      burst(l, { kind: 'pixel', n: 90, colors: [c.losePal.main, c.losePal.light, c.losePal.deep, '#fff'], speed: [120, 760], spread: 360, gravity: 320, life: [0.4, 1.1], size: [3, 6], area: [80, 80] });
      burst(l, { kind: 'shard', n: 14, colors: [c.losePal.main, c.losePal.deep], speed: [200, 700], spread: 360, gravity: 1200, life: [0.6, 1.1], size: [5, 12] });
      void go(r, [{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.3)', opacity: 0 }], { ms: 300, delay: 200 }).then(drop(r), quiet);
      await wait(750);
      total(c, `+${c.margin}`, c.pal.light, 'im-margin lk-mono');
      await wait(700);
    },
    tap(p, pal, i) {
      sfx.beep(i);
      ring(p, { to: 56, color: pal.light, width: 2, ms: 300 });
      burst(p, { kind: 'pixel', n: 6, colors: [pal.light, '#fff'], speed: [60, 240], spread: 360, gravity: 240, life: [0.25, 0.5], size: [2, 3] });
    },
  },
];

/** Decided after watching all ten; see README.md. */
export const RECOMMENDED: string[] = ['03'];

