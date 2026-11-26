// Deck illustrations: machines and structures. See deck/art.js for the conventions.
// Each part is drawn round the point it stands on (bottom centre, up is negative y) unless its
// comment says "centre". Sizes are at scale 1, where a standing adult is 120 tall.
(function () {
  'use strict';
  const A = window.CardArt;
  const D = window.DeckArt;
  const f = A.f;

  const P = (cls, d, x = '') => `<path class="${cls}" d="${d}"${x}/>`;
  const B = (cls, x, y, w, h, rx = 0, x2 = '') => `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}"${rx ? ` rx="${rx}"` : ''}${x2}/>`;
  const C = (cls, cx, cy, r, x = '') => `<circle class="${cls}" cx="${cx}" cy="${cy}" r="${r}"${x}/>`;
  const E = (cls, cx, cy, rx, ry, x = '') => `<ellipse class="${cls}" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${x}/>`;
  /** A stroked path; the st-* classes already set fill to none. */
  const L = (cls, d, w, x = '') => `<path class="${cls}" d="${d}" stroke-width="${w}"${x}/>`;
  const ROUND = ' stroke-linecap="round" stroke-linejoin="round"';
  /** A crescent of light on the upper left of a round puff centred (x, y), radius rr. */
  const lit = (cls, x, y, rr, k = 0.8) => {
    const R = rr * k;
    const at = (deg) => f(x + R * Math.cos(A.rad(deg))) + ',' + f(y + R * Math.sin(A.rad(deg)));
    return P(cls, `M${at(168)}A${f(R)},${f(R)} 0 0 1 ${at(284)}A${f(R * 2.2)},${f(R * 2.2)} 0 0 0 ${at(168)}Z`);
  };

  /* ------------------------------------------------------------------ on land */

  // 230 x 95 (aerial to 112), gun to the right
  D.part('tank', () => {
    let s = L('st-d', 'M-32,-84L-44,-112', 3, ROUND);
    s += P('sc-fig-d', 'M-96,0H84Q100,-4 106,-20Q108,-34 94,-36H-100Q-114,-34 -112,-20Q-108,-4 -96,0Z');
    for (const x of [-82, -52, -22, 8, 38, 68]) s += C('sc-fig-l', x, -14, 11) + C('sc-fig-d', x, -14, 4.5);
    s += C('sc-fig-l', -101, -23, 6.5) + C('sc-fig-l', 95, -23, 6.5);
    s += P('sc-fig-d', 'M-112,-34L-100,-54H76L106,-36L100,-30H-108Z');
    s += P('sc-fig-l', 'M-100,-54H76L84,-49H-103Z');
    s += P('sc-fig-d', 'M-52,-52L-40,-76Q-36,-84 -26,-84H22Q34,-84 42,-74L56,-52Z');
    s += B('sc-fig-d', -18, -93, 24, 10, 3);
    s += B('sc-fig-d', 36, -73, 78, 8) + B('sc-fig-d', 105, -76, 10, 14, 2);
    s += P('sc-fig-l', 'M-38,-78Q-35,-82 -27,-82H21Q30,-82 36,-76Z');
    s += B('sc-hot', -14, -70, 15, 11);
    return s;
  });

  // 204 x 96, cab to the right
  D.part('truck', () => {
    let s = B('sc-fig-d', -96, -36, 194, 12);
    s += P('sc-fig-d', 'M-98,-32V-84Q-98,-96 -86,-96H14Q26,-96 26,-84V-32Z');
    for (const x of [-70, -38, -6]) s += B('sc-fig-l', x, -91, 4, 46);
    s += B('sc-fig-l', -98, -44, 124, 4);
    s += P('sc-fig-d', 'M32,-32V-82H60L82,-58H96Q103,-58 103,-50V-32Z');
    s += P('sc-accent', 'M40,-75H58L73,-58H40Z');
    s += B('sc-fig-d', 98, -38, 8, 9, 2);
    for (const x of [-64, -25, 66]) s += C('sc-fig-d', x, -18, 18) + C('sc-fig-l', x, -18, 7);
    return s;
  });

  // a rocket lying along +x: tail at 0, nose at `len`
  const rocket = (len, w) => {
    const h = w / 2;
    const b = len * 0.8;
    return (
      P('sc-fig-d', `M${f(-w * 0.3)},${f(-w * 1.3)}H${f(w * 1.1)}L${f(w * 2)},${-h}V${h}L${f(w * 1.1)},${f(w * 1.3)}H${f(-w * 0.3)}L0,${h}V${-h}Z`) +
      P('sc-fig-d', `M0,${-h}H${f(b)}Q${f(len * 0.94)},${-h} ${len},0Q${f(len * 0.94)},${h} ${f(b)},${h}H0Z`) +
      P('sc-fig-l', `M${f(w * 2.2)},${-h}H${f(b)}Q${f(len * 0.9)},${-h} ${f(len * 0.97)},${f(-h * 0.24)}Q${f(len * 0.9)},${f(-h * 0.45)} ${f(b)},${f(-h * 0.42)}H${f(w * 2.2)}Z`) +
      B('sc-accent', f(b * 0.74), -h, f(w * 0.45), w) +
      B('sc-accent', f(b * 0.3), -h, f(w * 0.2), w)
    );
  };
  // on its launcher, raised 70 degrees: 224 x 205. Variant `up`: standing on a pad, 62 x 220
  D.part('missile', ({ v }) => {
    if (v === 'up') return B('sc-fig-d', -30, -8, 60, 8) + `<g transform="translate(0 -8) rotate(-90)">${rocket(212, 24)}</g>`;
    let s = L('st-d', 'M16,-52L-27,-113', 6.5);
    s += `<g transform="translate(-64 -52) rotate(-70)">${B('sc-fig-d', -8, 11, 124, 7)}${rocket(162, 24)}</g>`;
    s += P('sc-fig-d', 'M-112,-52H66L78,-76H102L112,-56V-24H-112Z');
    s += P('sc-accent', 'M82,-70H99L106,-57H82Z');
    s += B('sc-fig-l', -106, -46, 164, 4);
    for (const x of [-86, -50, 34, 70]) s += C('sc-fig-d', x, -15, 15) + C('sc-fig-l', x, -15, 6);
    return s;
  });

  /* ------------------------------------------------------------------ in orbit */
  // These three are light on dark: they are meant for a night sky.

  // centre; sphere of radius 34, antennas trailing 150 to the left
  D.part('sputnik', () => {
    let s = '';
    for (const [a, y0] of [[202, -14], [188, -6], [172, 6], [158, 14]])
      s += L('st-paper', `M-20,${y0}L${f(-20 + 152 * Math.cos(A.rad(a)))},${f(y0 + 152 * Math.sin(A.rad(a)))}`, 3.5, ROUND);
    s += C('sc-accent', 0, 0, 34);
    s += P('sc-fig-l', 'M24,-24A34,34 0 0 1 -24,24A46,46 0 0 0 24,-24Z');
    s += B('sc-fig-l', -34, -2.5, 68, 5, 0, ' opacity=".55"');
    return s;
  });

  // 168 x 138, standing on its pads
  D.part('lander', () => {
    let s = L('st-paper', 'M-40,-40L-72,-6M40,-40L72,-6M-46,-62L-62,-22M46,-62L62,-22M0,-30V-6', 4.5, ROUND);
    s += E('sc-accent', -72, -4, 12, 4) + E('sc-accent', 72, -4, 12, 4) + E('sc-accent', 0, -4, 9, 3.5);
    s += P('sc-fig-d', 'M-9,-32L-16,-14H16L9,-32Z');
    s += P('sc-fig-m', 'M-36,-68H36L48,-58V-40L36,-30H-36L-48,-40V-58Z');
    s += P('sc-fig-l', 'M-36,-68H2V-30H-36L-48,-40V-58Z');
    s += B('sc-hot', -48, -53, 96, 8);
    s += P('sc-accent', 'M-30,-68L-36,-94L-22,-116H16L36,-100L30,-68Z');
    s += P('sc-fig-l', 'M8,-116H16L36,-100L30,-68H14Z');
    s += P('sc-fig-d', 'M-24,-106H0L-14,-87Z');
    s += B('sc-fig-m', -6, -84, 15, 16);
    s += B('sc-accent', -10, -124, 18, 8);
    s += L('st-paper', 'M24,-108L40,-128', 3.5, ROUND) + C('sc-accent', 43, -131, 8);
    return s;
  });

  // centre; 216 x 116, docking probe to the right
  D.part('station', () => {
    let s = '';
    for (const k of [-1, 1]) {
      s += P('sc-fig-l', `M-46,${k * 14}H-2L-24,${k * 58}H-68Z`);
      s += L('st-paper', `M-31,${k * 14}L-53,${k * 58}M-17,${k * 14}L-39,${k * 58}M-53,${k * 28}H-9M-60,${k * 43}H-16`, 3);
    }
    s += P('sc-fig-l', 'M-90,-10L-106,-15V15L-90,10Z');
    s += B('sc-accent', -90, -17, 84, 34, 3);
    s += P('sc-accent', 'M-8,-17L26,-22Q38,-20 40,-10V10Q38,20 26,22L-8,17Z');
    s += C('sc-accent', 64, 0, 25);
    s += P('sc-fig-l', 'M-90,6H-8V17H-87Q-90,17 -90,14Z') + P('sc-fig-l', 'M-8,8H40V10Q38,20 26,22L-8,17Z') + P('sc-fig-l', 'M40.3,8A25,25 0 0 0 87.7,8Z');
    s += B('sc-fig-d', -10, -18, 4, 36) + B('sc-fig-d', 38, -12, 4, 24) + C('sc-fig-d', 66, -5, 6);
    s += B('sc-hot', -70, -17, 9, 23);
    s += B('sc-accent', 88, -6, 14, 12) + B('sc-fig-l', 102, -10, 6, 20, 2);
    return s;
  });

  /* ------------------------------------------------------------------ in the air */

  // centre; 238 x 84, four-engine cargo plane flying right
  D.part('transport', () => {
    let s = P('sc-fig-d', 'M-116,-8L-108,-46Q-104,-52 -96,-48L-72,-12Z');
    s += P('sc-fig-d', 'M-118,-8L-84,-12L-78,-5L-116,0Z');
    s += P('sc-fig-d', 'M-118,-6Q-110,-13 -96,-14L64,-17Q100,-16 114,-4Q120,3 108,9Q92,15 62,15L-66,12Q-104,6 -118,-6Z');
    s += P('sc-fig-l', 'M-96,-14L64,-17Q92,-16 106,-8Q88,-12 64,-12L-96,-9Z');
    s += P('sc-accent', 'M86,-11L103,-6L99,-1L84,-5Z');
    for (let i = 0; i < 6; i++) s += C('sc-accent', -62 + i * 22, -3, 2.8);
    s += P('sc-fig-d', 'M-14,4H44L-2,30L-40,32Z');
    s += B('sc-fig-d', 24, 5, 34, 11, 5) + B('sc-fig-d', 4, 16, 32, 10, 5);
    s += E('sc-accent', 60, 10.5, 2.8, 18, ' opacity=".75"') + E('sc-accent', 38, 21, 2.6, 16, ' opacity=".75"');
    return s;
  });

  // centre; 172 x 76, climbing 10 degrees
  D.part('jet', () => {
    let s = '<g transform="rotate(-10)">';
    s += P('sc-fig-d', 'M-80,-4L-64,-38H-46L-34,-9Z');
    s += P('sc-fig-d', 'M-86,-3L-58,-5L-50,2L-90,8Z');
    s += P('sc-accent', 'M16,-10Q30,-25 54,-6Z');
    s += P('sc-fig-d', 'M-82,0Q-80,-8 -68,-9L28,-11Q62,-10 86,2Q62,11 28,11L-70,8Q-82,6 -82,0Z');
    s += P('sc-fig-l', 'M-66,-9L28,-11Q54,-10 74,-3Q50,-7 28,-7L-66,-5Z');
    s += P('sc-fig-d', 'M16,3L-38,34H-60L-22,3Z');
    s += B('sc-fig-l', -90, -3, 9, 8);
    return s + '</g>';
  });

  // centre; span 260, 68 tall, seen from in front and a little below
  D.part('spyplane', () => {
    let s = P('sc-fig-d', 'M-48,-23L0,-18L48,-23V-19.5L0,-11L-48,-19.5Z');
    s += P('sc-fig-d', 'M-5,-6L-1.8,-50H1.8L5,-6Z');
    s += P('sc-fig-d', 'M-130,-8L-22,0Q0,4 22,0L130,-8V-3L22,12Q0,17 -22,12L-130,-3Z');
    s += P('sc-fig-l', 'M-128,-7L-24,1Q0,5 24,1L128,-7L24,5Q0,9 -24,5Z');
    s += E('sc-fig-d', -17, 7, 7.5, 8.5) + E('sc-fig-d', 17, 7, 7.5, 8.5);
    s += E('sc-fig-d', 0, 5, 12, 15);
    s += C('sc-fig-l', -17, 7, 3.2) + C('sc-fig-l', 17, 7, 3.2);
    s += E('sc-accent', 0, -1, 6, 4.5);
    return s;
  });

  // centre; 224 x 96 with rotor. Variant `landed`: skids on y = 0
  D.part('heli', ({ v }) => {
    let s = P('sc-fig-d', 'M-36,-14L-108,-17L-110,-9L-36,10Z');
    s += P('sc-fig-d', 'M-112,-8L-102,-42H-91L-96,-14Z');
    s += L('st-d', 'M-104,-58L-97,-22', 3.5, ROUND);
    s += P('sc-fig-d', 'M-34,-22H26Q58,-20 68,2Q72,16 58,22H-22Q-42,20 -44,4Z');
    s += B('sc-fig-d', -5, -35, 12, 15) + P('sc-fig-d', 'M-112,-39L112,-37V-33L-112,-35Z') + B('sc-fig-d', -11, -40, 24, 7, 3);
    s += L('st-d', 'M-10,22L-14,37M38,22L42,37', 4) + L('st-d', 'M-36,38H54Q64,38 68,29', 4, ROUND);
    s += P('sc-accent', 'M32,-16Q54,-14 62,3H36Z') + B('sc-fig-l', 4, -14, 22, 17, 2);
    s += P('sc-fig-l', 'M-36,-14L-108,-17V-14L-36,-9Z');
    return v === 'landed' ? `<g transform="translate(0 -40)">${s}</g>` : s;
  });

  /* ------------------------------------------------------------------ at sea */

  // waterline centre; 302 x 102, bow to the right
  D.part('freighter', () => {
    let s = L('st-d', 'M72,-28V-90M-92,-28V-86', 4.5) + L('st-d', 'M72,-84L106,-42M72,-84L38,-42M-92,-80L-60,-42M-92,-80L-120,-46', 3.2);
    s += B('sc-fig-d', -36, -62, 58, 36) + B('sc-fig-d', -28, -76, 40, 14) + B('sc-fig-d', -148, -42, 32, 16);
    s += P('sc-fig-d', 'M-15,-76L-13,-102H7L9,-76Z') + B('sc-accent', -13.5, -95, 21, 6);
    s += P('sc-fig-d', 'M-150,-28H98L152,-38L134,0H-140Q-150,0 -150,-10Z');
    s += B('sc-accent', -30, -56, 46, 5);
    s += P('sc-fig-l', 'M-150,-28H98L152,-38L150,-33L98,-23H-150Z');
    s += P('sc-hot', 'M-149,-8H138L134,0H-140Q-148,0 -149,-8Z');
    return s;
  });

  // waterline centre; 322 x 100, destroyer, bow to the right
  D.part('warship', () => {
    let s = L('st-d', 'M46,-58V-100M30,-86H62', 3.5) + B('sc-fig-d', 36, -97, 20, 5.5);
    s += P('sc-fig-d', 'M-8,-22L-13,-56H5L10,-22Z') + P('sc-fig-d', 'M-58,-22L-62,-50H-45L-41,-22Z');
    s += B('sc-fig-l', -12.4, -50, 17.2, 5) + B('sc-fig-l', -61.4, -45, 16.2, 5);
    s += B('sc-fig-d', 26, -50, 46, 32) + B('sc-fig-d', 34, -63, 28, 13) + B('sc-fig-d', -112, -34, 34, 16) + B('sc-fig-d', -42, -33, 68, 14);
    s += B('sc-fig-d', 70, -30, 28, 11) + B('sc-fig-d', 76, -43, 16, 13, 2) + L('st-d', 'M88,-39L114,-48', 3.5);
    s += B('sc-fig-d', 98, -32, 18, 12, 2) + L('st-d', 'M110,-28L138,-37', 3.5);
    s += B('sc-fig-d', -138, -31, 18, 12, 2) + L('st-d', 'M-134,-27L-160,-35', 3.5);
    s += P('sc-fig-d', 'M-160,-20H118L162,-34L142,0H-150Q-158,0 -160,-8Z');
    s += B('sc-accent', 30, -45, 38, 4.5);
    s += P('sc-fig-l', 'M-160,-20H118L162,-34L160,-29.500L118,-15H-160Z');
    return s;
  });

  /* ------------------------------------------------------------------ structures */

  // 440 x 88: concrete slabs under a pipe. Grey, so that black figures read in front of it.
  D.part('wall', ({ r }) => {
    let s = B('sc-fig-l', -220, -80, 440, 80);
    const w = 440 / 9;
    for (let i = 0; i < 9; i++) {
      const x = f(-220 + i * w);
      if (r() < 0.45) s += B('sc-fig-m', x, -80, f(w), 80, 0, ' opacity=".25"');
      if (i) s += B('sc-fig-d', f(x - 1.6), -80, 3.2, 80);
    }
    s += B('sc-fig-m', -226, -88, 452, 14, 7) + B('sc-accent', -220, -86.500, 440, 3.2, 0, ' opacity=".6"');
    s += B('sc-fig-d', -220, -7, 440, 7);
    return s;
  });

  // 76 x 192, plus a searchlight beam reaching 150 to the right
  D.part('tower', () => {
    let s = P('sc-accent', 'M34,-153L150,-126V-78Z', ' opacity=".34"');
    s += L('st-d', 'M-30,0L-17,-130M30,0L17,-130', 5.5);
    s += L('st-d', 'M-27,-30L21,-80M27,-30L-21,-80M-22,-80L18,-126M22,-80L-18,-126M-27,-30H27M-22,-80H22', 3.2);
    s += B('sc-fig-d', -36, -135, 72, 7) + B('sc-fig-d', -30, -172, 60, 40) + P('sc-fig-d', 'M-38,-170L0,-192L38,-170Z');
    s += B('sc-accent', -24, -162, 48, 12) + B('sc-fig-d', -2, -162, 4, 12);
    s += B('sc-fig-d', 26, -161, 12, 17, 3) + C('sc-accent', 34, -152.500, 5);
    return s;
  });

  // 272 x 126: a wire fence with a gap, the gate leaf swung toward us
  D.part('gate', () => {
    let s = '';
    const post = (x) => B('sc-fig-d', f(x - 3.5), -100, 7, 100) + L('st-d', `M${f(x)},-98L${f(x - 12)},-113`, 3.5, ROUND);
    for (const [x0, x1, n] of [[-130, -42, 3], [62, 130, 2]]) {
      s += L('st-d', `M${x0},-92H${x1}M${x0},-74H${x1}M${x0},-56H${x1}M${x0},-38H${x1}M${x0},-20H${x1}`, 3.2);
      for (let i = 0; i <= n; i++) s += post(x0 + ((x1 - x0) * i) / n);
    }
    s += L('st-d', 'M-42,-98L6,-114V12L-42,0Z', 6.5, ROUND);
    s += L('st-d', 'M-42,0L6,-114M-26,-103V4M-10,-108V8', 3.5);
    return s;
  });

  // 104 x 212: lattice oil derrick
  D.part('derrick', () => {
    const ys = [0, -44, -84, -120, -152, -180];
    const hw = (y) => f(45 + (y / 190) * 35);
    let d = '';
    ys.forEach((y, i) => {
      d += `M${-hw(y)},${y}H${hw(y)}`;
      if (i < ys.length - 1) d += `M${-hw(y)},${y}L${hw(ys[i + 1])},${ys[i + 1]}M${hw(y)},${y}L${-hw(ys[i + 1])},${ys[i + 1]}`;
    });
    let s = L('st-d', d, 3.2) + L('st-d', 'M-45,0L-10,-190M45,0L10,-190', 6);
    s += L('st-d', 'M0,-190V-64', 3) + B('sc-fig-d', -6, -76, 12, 18, 2);
    s += B('sc-fig-d', -16, -202, 32, 12, 2) + B('sc-fig-d', -4, -212, 8, 10);
    s += B('sc-fig-d', -52, -8, 104, 8);
    return s;
  });

  // 440 x 60 (valve to 88): a trunk pipe on trestles
  D.part('pipeline', () => {
    let s = '';
    for (const x of [-176, -88, 0, 88, 176]) s += P('sc-fig-d', `M${x - 14},0L${x - 7},-24H${x + 7}L${x + 14},0Z`);
    s += B('sc-fig-d', -220, -54, 440, 32) + B('sc-fig-l', -220, -50, 440, 5.5);
    for (const x of [-132, -44, 44, 132]) s += B('sc-fig-d', x - 5, -59, 10, 42, 2);
    s += B('sc-fig-d', 42, -72, 4, 14) + `<circle class="st-d" cx="44" cy="-78" r="9.500" stroke-width="4"/>`;
    return s;
  });

  // 260 x 200: turbine hall, reactor hall with its roof blown open, banded stack
  D.part('reactor', () => {
    let s = B('sc-fig-d', 64, -200, 24, 200);
    for (const y of [-192, -164, -136]) s += B('sc-accent', 64, y, 24, 10);
    s += B('sc-fig-d', 59, -112, 34, 5);
    s += B('sc-fig-d', -130, -72, 100, 72);
    for (let i = 0; i < 5; i++) s += B('sc-accent', -122 + i * 18, -58, 9, 17);
    s += B('sc-fig-d', 86, -58, 44, 58);
    s += P('sc-fig-d', 'M-42,0V-126H-14L-6,-104L8,-116L18,-96L30,-110L38,-126H64V0Z');
    s += P('sc-accent', 'M-6,-104L8,-116L18,-96L30,-110L34,-88H-2Z');
    s += B('sc-fig-l', -42, -126, 7, 126);
    return s;
  });

  // 360 x 164: the bowl from outside, a cauldron on a mast
  D.part('stadium', () => {
    let s = P('sc-fig-m', 'M-180,-64Q0,-114 180,-64Q0,-30 -180,-64Z');
    s += P('sc-fig-l', 'M-152,-66Q0,-102 152,-66Q0,-42 -152,-66Z');
    s += P('sc-fig-d', 'M-180,0V-64Q0,-30 180,-64V0Z');
    for (let i = -7; i <= 7; i++) {
      const x = i * 23;
      const t = (x + 180) / 360;
      const top = f(-64 + 68 * t * (1 - t) + 7);
      s += B('sc-fig-l', x - 2.500, top, 5, f(-top));
    }
    s += B('sc-fig-d', 114, -124, 8, 70) + P('sc-fig-d', 'M100,-134H136L128,-121H108Z');
    s += P('sc-accent', 'M118,-134Q98,-148 114,-164Q116,-152 124,-158Q138,-144 118,-134Z');
    return s;
  });

  // mast 60 x 248, with three arcs of waves reaching 84 to each side
  D.part('radio', () => {
    const ys = [0, -38, -76, -114, -152, -190, -226];
    const hw = (y) => f(24 + (y / 226) * 20);
    let d = '';
    ys.forEach((y, i) => {
      if (i) d += `M${-hw(y)},${y}H${hw(y)}`;
      if (i < ys.length - 1) d += `M${-hw(y)},${y}L${hw(ys[i + 1])},${ys[i + 1]}M${hw(y)},${y}L${-hw(ys[i + 1])},${ys[i + 1]}`;
    });
    let s = L('st-d', d, 3) + L('st-d', 'M-24,0L-4,-226M24,0L4,-226', 5) + L('st-d', 'M0,-226V-248', 4, ROUND);
    s += B('sc-fig-d', -30, -6, 60, 6);
    for (const R of [30, 57, 84]) {
      const cx = f(R * Math.cos(A.rad(38)));
      const dy = f(R * Math.sin(A.rad(38)));
      s += L('st-paper', `M${cx},${f(-234 - dy)}A${R},${R} 0 0 1 ${cx},${f(-234 + dy)}M${-cx},${f(-234 - dy)}A${R},${R} 0 0 0 ${-cx},${f(-234 + dy)}`, 5.5, ROUND);
    }
    return s;
  });

  // 96 x 138: a tracking dish on a pedestal, looking up and to the right
  D.part('dish', () => {
    let s = B('sc-fig-d', -34, -8, 68, 8) + P('sc-fig-d', 'M-22,-8L-11,-66H11L22,-8Z') + P('sc-fig-l', 'M-22,-8L-11,-66H-5L-13,-8Z');
    s += C('sc-fig-d', 0, -70, 12);
    s += '<g transform="translate(4 -80) rotate(-40)">';
    s += P('sc-fig-d', 'M12,-62Q-46,0 12,62Z') + E('sc-fig-l', 12, 0, 11, 62);
    s += L('st-d', 'M12,-56L56,0L12,56M12,0H56', 3.5, ROUND) + C('sc-accent', 58, 0, 6.5);
    return s + '</g>';
  });

  /* ------------------------------------------------------------------ smoke and cargo */

  // 236 x 300: mushroom cloud standing on the ground
  D.part('cloud', () => {
    let s = P('sc-fig-d', 'M-96,0Q-56,-26 -24,-40Q-30,-100 -24,-160H24Q30,-100 24,-40Q56,-26 96,0Z');
    s += E('sc-fig-d', 0, -118, 46, 13);
    for (const [x, y, rr] of [[0, -214, 78], [-68, -204, 50], [68, -204, 50], [-36, -240, 52], [36, -240, 52], [0, -252, 48]]) s += C('sc-fig-d', x, y, rr);
    s += E('sc-fig-d', 0, -176, 92, 30);
    s += lit('sc-fig-l', -36, -240, 52, 0.84) + lit('sc-fig-l', -68, -204, 50, 0.84) + lit('sc-fig-l', 0, -252, 48, 0.84) + lit('sc-accent', 40, -236, 52, 0.62);
    s += P('sc-fig-l', 'M-24,-160H-9Q-15,-100 -11,-45L-24,-40Q-30,-100 -24,-160Z');
    return s;
  });

  // 118 x 240: a column of smoke rising from the origin and leaning right
  D.part('smoke', ({ r }) => {
    const puffs = [[0, -10, 13], [5, -34, 19], [12, -64, 25], [22, -100, 31], [36, -142, 37], [52, -192, 46]];
    let s = '';
    for (const [x, y, rr] of puffs) s += C('sc-fig-d', x, y, rr) + C('sc-fig-d', f(x + rr * 0.5 * (r() - 0.2)), f(y - rr * 0.34), f(rr * 0.72));
    for (const [x, y, rr] of puffs.slice(1)) s += lit('sc-fig-l', x, y, rr, 0.78);
    return s;
  });

  // 112 x 92: three oil drums, one on top
  const drum = (x, y, band) =>
    B('sc-fig-d', x, y - 46, 52, 46, 3) + B('sc-fig-l', x + 6, y - 42, 4.5, 38) + (band ? B('sc-hot', x, y - 31, 52, 12) : B('sc-fig-l', x, y - 32, 52, 3) + B('sc-fig-l', x, y - 16, 52, 3));
  D.part('barrels', () => drum(-56, 0) + drum(4, 0) + drum(-26, -46, true));

  // 60 x 50 crate. Variant `chute`: hanging under a parachute, 110 x 152, origin at the crate's foot
  const CRATE = B('sc-fig-d', -30, -50, 60, 50, 2) + P('sc-fig-l', 'M-23,-43H10L-23,-10Z') + P('sc-fig-l', 'M23,-7H-10L23,-40Z');
  D.part('crate', ({ v }) => {
    if (v !== 'chute') return CRATE;
    let s = L('st-d', 'M-55,-112L-22,-50M-27.500,-112L-10,-50M0,-112V-50M27.500,-112L10,-50M55,-112L22,-50', 3);
    s += P('sc-accent', 'M-55,-112Q-55,-152 0,-152Q55,-152 55,-112Q41,-121 27.500,-112Q13.750,-121 0,-112Q-13.750,-121 -27.500,-112Q-41,-121 -55,-112Z');
    s += P('sc-fig-l', 'M-27.500,-112Q-13.750,-121 0,-112V-152Q-22,-150 -27.500,-112Z') + P('sc-fig-l', 'M27.500,-112Q41,-121 55,-112Q55,-140 31,-148Q32,-130 27.500,-112Z');
    return s + CRATE;
  });
})();
