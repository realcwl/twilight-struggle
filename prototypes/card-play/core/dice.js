// A die: a real cube with six faces, tumbling until it shows the number it was told to show.
// The number is decided before the throw (by the director); the cube only acts it out.
//
//   const die = makeDie({ side: 0 });       side 0 blue, 1 red, null ivory
//   host.append(die.el);                    its size is the CSS variable --die, set on the die or on anything above it
//   await die.roll(5, { ms: 1300 });        tumbles in place; resolves when it has come to rest
//   await die.throw(5, { from: { x: -1, y: 0.5 } });   thrown onto the table: see throwDie below
//   die.set(3);                             show a face without rolling
//
// The table is the screen and the die is seen from above. The cube is solid: inside the six faces
// sits a second, slightly smaller cube, so the rounded corners of the faces never open onto nothing.

// which way the cube has to be turned for each face to look at the viewer
const FACING = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };
// pips by cell of a 3 x 3 grid, row by row
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

const face = (n) => `<div class="cp-face f${n}">${Array.from({ length: 9 }, (_, i) => `<i${PIPS[n].includes(i) ? ' class="on"' : ''}></i>`).join('')}</div>`;
const core = (n) => `<i class="cp-core f${n}"></i>`;
const SIX = [1, 2, 3, 4, 5, 6];

export function makeDie({ side = null, cls = '' } = {}) {
  const el = document.createElement('div');
  el.className = `cp-die ${side === 0 ? 'a' : side === 1 ? 'b' : 'n'} ${cls}`;
  el.innerHTML = `<div class="cp-die-shadow"></div><div class="cp-die-fly"><div class="cp-cube">${SIX.map(core).join('')}${SIX.map(face).join('')}</div></div>`;
  const cube = el.querySelector('.cp-cube');
  const fly = el.querySelector('.cp-die-fly');
  const shadow = el.querySelector('.cp-die-shadow');
  let value = 1;
  let anim = null;
  let thrown = [];
  const turn = ([x, y], extra = [0, 0, 0]) => `rotateX(${x + extra[0]}deg) rotateY(${y + extra[1]}deg) rotateZ(${extra[2]}deg)`;

  function set(v) {
    anim?.cancel();
    for (const a of thrown) a.cancel();
    thrown = [];
    fly.style.transform = shadow.style.transform = shadow.style.opacity = '';
    value = v;
    cube.style.transform = turn(FACING[v]);
    el.dataset.value = v;
  }

  /**
   * Tumbles to `v`. ms: how long; turns: how many times round each axis; settle: the share of the
   * time spent on the last slow half-turn, which is where the suspense is.
   */
  function roll(v, { ms = 1300, turns = 3, settle = 0.34 } = {}) {
    anim?.cancel();
    const from = FACING[value];
    const to = FACING[v];
    const sx = (Math.random() < 0.5 ? -1 : 1) * 360 * turns;
    const sy = (Math.random() < 0.5 ? -1 : 1) * 360 * (turns + 1);
    value = v;
    el.dataset.value = '';
    el.classList.add('is-rolling');
    anim = cube.animate(
      [
        { transform: turn(from, [sx, sy, 0]), easing: 'cubic-bezier(0.2, 0.2, 0.4, 1)' },
        // nearly there: one face short, leaning
        { transform: turn(to, [90 * Math.sign(sx), 90 * Math.sign(sy), 12]), offset: 1 - settle, easing: 'cubic-bezier(0.3, 0, 0.2, 1.25)' },
        { transform: turn(to) },
      ],
      { duration: ms, fill: 'forwards' },
    );
    const hop = el.animate([{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-22%) scale(1.08)', offset: 0.3 }, { transform: 'translateY(0) scale(1)', offset: 0.62 }, { transform: 'translateY(-7%) scale(1.02)', offset: 0.8 }, { transform: 'translateY(0) scale(1)' }], { duration: ms, easing: 'ease-out' });
    return anim.finished.then(
      () => {
        cube.style.transform = turn(to);
        anim?.cancel();
        anim = null;
        el.classList.remove('is-rolling');
        el.classList.add('is-landed');
        el.dataset.value = v;
        setTimeout(() => el.classList.remove('is-landed'), 500);
      },
      () => hop.cancel(),
    );
  }

  /**
   * Throws the die onto the table so that it comes to rest where the element is, showing `v`.
   * It flies in from one side, lands, bounces twice, rolls on the way it was going and tips over
   * one last time. It only ever rolls about the line across its path, the way a thrown die does,
   * and it stops a few degrees askew.
   *   from      where it comes from, as a direction on screen: { x: -1, y: 0.5 } is the lower left
   *   ms        the whole throw
   *   reach     how far it travels, in die widths
   *   lift      how high it is when it is let go, in die widths
   *   onImpact(i)   each time it hits the table: 0, 1, 2 for the landing and the bounces, 3 when it falls flat
   * Resolves once it has stopped rocking.
   */
  function throwDie(v, { ms = 2000, from = { x: -1, y: 0.5 }, reach = 4.4, lift = 1.1, onImpact } = {}) {
    set(value);
    const size = el.offsetWidth || 60;
    const len = Math.hypot(from.x, from.y) || 1;
    const ux = -from.x / len;
    const uy = -from.y / len;
    const [fx, fy] = FACING[v];
    const yaw0 = (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 25);
    const yaw1 = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 4);
    // each stretch of the throw: its share of the time, how far it carries (die widths), quarter turns, peak height
    const stretches = [
      { t: 0.3, d: Math.max(0.6, reach - 2.3), q: 3, h: lift, kind: 'fall' },
      { t: 0.19, d: 0.9, q: 2, h: lift * 0.3, kind: 'hop' },
      { t: 0.12, d: 0.4, q: 1, h: lift * 0.09, kind: 'hop' },
      { t: 0.25, d: 1, q: 1, h: 0, kind: 'tip' },
      { t: 0.14, d: 0, q: 0, h: 0, kind: 'rest' },
    ];
    const way = stretches.reduce((a, x) => a + x.d, 0);
    const turns = stretches.reduce((a, x) => a + x.q, 0);
    // the last quarter turn: it climbs onto its edge, slowing, hangs there, then falls over
    const tip = (k) => (k < 0.56 ? 0.5 * (1 - Math.pow(1 - k / 0.56, 1.9)) : 0.5 + 0.5 * Math.pow((k - 0.56) / 0.44, 2.3));
    function at(t) {
      let t0 = 0;
      let done = 0;
      let turned = 0;
      for (const x of stretches) {
        if (t <= t0 + x.t || x === stretches[stretches.length - 1]) {
          const k = Math.min(1, Math.max(0, (t - t0) / x.t));
          let g = k;
          let h = 0;
          let twist = 0;
          let rock = 0;
          if (x.kind === 'fall') {
            h = x.h * (1 - k * k);
            twist = -360 * (1 - k);
          } else if (x.kind === 'hop') h = x.h * 4 * k * (1 - k);
          else if (x.kind === 'tip') {
            g = tip(k);
            h = 0.207 * Math.sin(Math.PI * g);
          } else rock = -6 * Math.sin(Math.PI * Math.min(1, k * 1.7)) * (1 - k);
          return { left: way - done - x.d * g, theta: -(turns - turned - x.q * g) * 90 + rock, h, twist, yaw: yaw1 + (yaw0 - yaw1) * Math.pow(1 - t, 2.4) };
        }
        t0 += x.t;
        done += x.d;
        turned += x.q;
      }
      return null;
    }
    const n = Math.max(40, Math.round(ms / 14));
    const body = [];
    const spin = [];
    const shade = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const f = at(t);
      const x = -ux * f.left * size;
      const y = -uy * f.left * size;
      body.push({ offset: t, transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${(1 + 0.2 * f.h).toFixed(3)})` });
      spin.push({ offset: t, transform: `rotateZ(${f.yaw.toFixed(2)}deg) rotate3d(${-uy}, ${ux}, 0, ${f.theta.toFixed(2)}deg) rotate3d(${ux}, ${uy}, 0, ${f.twist.toFixed(2)}deg) rotateX(${fx}deg) rotateY(${fy}deg)` });
      shade.push({ offset: t, transform: `translate(${(x + (0.06 + 0.42 * f.h) * size).toFixed(1)}px, ${(y + (0.09 + 0.6 * f.h) * size).toFixed(1)}px) scale(${(1 + 0.25 * f.h).toFixed(3)})`, opacity: (1 / (1 + 2.2 * f.h)).toFixed(3) });
    }
    value = v;
    el.dataset.value = '';
    el.style.visibility = '';
    el.classList.add('is-thrown');
    const opts = { duration: ms, easing: 'linear', fill: 'forwards' };
    thrown = [fly.animate(body, opts), cube.animate(spin, opts), shadow.animate(shade, opts)];
    let t0 = 0;
    const timers = stretches.slice(0, 4).map((x, i) => {
      t0 += x.t;
      return setTimeout(() => onImpact?.(i), ms * t0);
    });
    return thrown[1].finished.then(
      () => {
        cube.style.transform = spin[n].transform;
        fly.style.transform = '';
        shadow.style.transform = shadow.style.opacity = '';
        for (const a of thrown) a.cancel();
        thrown = [];
        el.classList.remove('is-thrown');
        el.dataset.value = v;
      },
      () => timers.forEach(clearTimeout),
    );
  }

  set(1);
  return {
    el, set, roll,
    throw: throwDie,
    get value() {
      return value;
    },
  };
}
