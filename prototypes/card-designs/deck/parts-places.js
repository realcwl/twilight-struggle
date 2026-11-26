// Deck illustrations: places. Skylines that sit on the horizon and foregrounds for the bottom strip.
// See deck/art.js for the conventions.
(function () {
  'use strict';
  const A = window.CardArt;
  const D = window.DeckArt;
  const f = A.f;

  const P = (d, cls = 'sc-far', extra = '') => `<path class="${cls}" d="${d}"${extra}/>`;
  const pt = (p) => f(p[0]) + ',' + f(p[1]);

  /** A run of ordinary buildings from x0 to x1: flat, gabled and mansard roofs, chimneys, lit windows. */
  function blocks(r, x0, x1, lo, hi) {
    let d = '';
    let win = '';
    let x = x0;
    while (x < x1) {
      const w = 26 + r() * 30;
      const h = lo + r() * (hi - lo);
      const t = r();
      if (t < 0.34) d += `M${f(x)},40V${f(-h)}L${f(x + w / 2)},${f(-h - w * 0.34)}L${f(x + w)},${f(-h)}V40Z`;
      else if (t < 0.6) d += `M${f(x)},40V${f(-h)}L${f(x + 5)},${f(-h - 13)}H${f(x + w - 5)}L${f(x + w)},${f(-h)}V40Z`;
      else d += `M${f(x)},40V${f(-h)}H${f(x + w)}V40Z`;
      if (r() < 0.55) {
        const cx = x + 5 + r() * (w - 16);
        d += `M${f(cx)},${f(-h + 2)}v${f(-18 - r() * 8)}h6V${f(-h + 2)}Z`;
      }
      const cols = Math.max(1, Math.floor((w - 8) / 10));
      const rows = Math.floor((h - 12) / 14);
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if (r() < 0.34) win += `M${f(x + 6 + i * 10)},${f(-h + 8 + j * 14)}h4.4v7.5h-4.4Z`;
      x += w - 0.5;
    }
    return P(d) + P(win, 'sc-far2');
  }

  /** Palm crown and trunk as one path `d`: the trunk rises from (x, y0) to the crown at (tx, ty). */
  function palmD(x, y0, tx, ty, L, r, wTrunk = 3) {
    const mx = (x + tx) / 2 + (tx - x) * 0.6;
    const my = (y0 + ty) / 2;
    let d = `M${f(x - wTrunk)},${f(y0)}Q${f(mx - wTrunk)},${f(my)} ${f(tx - wTrunk * 0.6)},${f(ty)}L${f(tx + wTrunk * 0.6)},${f(ty)}Q${f(mx + wTrunk)},${f(my)} ${f(x + wTrunk)},${f(y0)}Z`;
    for (const a of [-188, -160, -132, -106, -80, -54, -26, 6]) {
      const len = L * (0.82 + 0.36 * r());
      const c = Math.cos(A.rad(a));
      const s = Math.sin(A.rad(a));
      const ex = tx + len * c;
      const ey = ty + len * s + len * 0.62 * (1 - Math.abs(s));
      const qx = tx + 0.52 * len * c;
      const qy = ty + 0.52 * len * s - len * 0.16;
      d += `M${f(tx)},${f(ty)}Q${f(qx)},${f(qy)} ${f(ex)},${f(ey)}Q${f(qx)},${f(qy + len * 0.26)} ${f(tx)},${f(ty)}Z`;
    }
    return d;
  }

  const onion = (x, y, b, h) =>
    `M${f(x - b)},${y}C${f(x - b * 2.3)},${f(y - h * 0.42)} ${f(x - b * 0.5)},${f(y - h * 0.7)} ${x},${f(y - h)}C${f(x + b * 0.5)},${f(y - h * 0.7)} ${f(x + b * 2.3)},${f(y - h * 0.42)} ${f(x + b)},${y}Z` +
    `M${f(x - 1)},${f(y - h + 3)}v-12h2v12Z`;
  const onionLit = (x, y, b, h) =>
    `M${f(x - b * 1.1)},${f(y - h * 0.22)}Q${f(x - b * 1.5)},${f(y - h * 0.45)} ${f(x - b * 0.5)},${f(y - h * 0.72)}Q${f(x - b * 0.95)},${f(y - h * 0.45)} ${f(x - b * 0.62)},${f(y - h * 0.2)}Z`;

  /* ------------------------------------------------------------------ cities */

  D.far('city', ({ r }) => {
    let s = blocks(r, -4, 444, 44, 88);
    // a town-hall tower and a factory stack break the roofline
    s += P('M98,40V-112H124V40ZM94,-112L111,-146L128,-112ZM110,-146h2v-14h-2ZM330,40L333,-128H342L345,40ZM330,-128h15v-5h-15Z');
    s += '<circle class="sc-far2" cx="111" cy="-96" r="7"/>';
    return s;
  });

  D.far('skyline', ({ r }) => {
    let d = '';
    let l = '';
    const tower = (x, w, h) => (d += `M${x},40V${-h}H${x + w}V40Z`);
    const lights = (x, w, h, p = 0.4) => {
      for (let cx = x + 5; cx < x + w - 6; cx += 9) for (let y = -h + 8; y < -10; y += 12) if (r() < p) l += `M${cx},${y}h3.8v6.5h-3.8Z`;
    };
    tower(-4, 40, 84);
    lights(-4, 40, 84);
    // stepped tower with a mast
    d += 'M34,40V-96H40V-122H47V-142H53V-154H55V-180H57V-154H59V-142H65V-122H72V-96H78V40Z';
    lights(40, 32, 96);
    tower(80, 36, 64);
    d += 'M90,-64v-13h15v13Z';
    lights(80, 36, 64);
    // the glass slab
    tower(120, 52, 156);
    for (let y = -148; y < -8; y += 10) l += `M125,${y}h42v4h-42Z`;
    tower(174, 36, 98);
    lights(174, 36, 98);
    // tower with a pointed crown
    d += 'M210,40V-118H216V-132H222V-144L236,-178L250,-144V-132H256V-118H262V40ZM235,-178h2v-12h-2Z';
    lights(212, 48, 118);
    tower(264, 32, 72);
    lights(264, 32, 72);
    d += 'M296,40V-110H304V-122H334V-110H342V40ZM318,-122h2.4v-28h-2.4Z';
    lights(298, 42, 110);
    tower(344, 42, 58);
    lights(344, 42, 58);
    d += 'M386,40V-94H394V-106H402V-118H424V-106H432V-94H444V40Z';
    lights(388, 54, 94);
    return P(d) + P(l, 'sc-far2');
  });

  D.far('berlin', ({ r }) => {
    let s = blocks(r, -4, 46, 44, 72) + blocks(r, 294, 444, 42, 78);
    // the gate: six columns, five passages (the middle one wider), entablature, attic, the quadriga
    let d = '';
    for (const x of [106, 129, 152, 179, 202, 225]) d += `M${x},40V-62h9V40Z`;
    d += 'M101,-62H239V-77H101ZM112,-77H228V-91H112ZM140,-91H200V-99H140Z';
    d += 'M150,-99h40v-7l-4,-9l-5,5l-4,-10l-6,7l-5,-9l-5,9l-6,-5v19ZM172,-112h3v-22h-3Z';
    // the two gatehouses
    d += 'M72,40V-36H102V40ZM68,-36L87,-49L106,-36ZM238,40V-36H268V40ZM234,-36L253,-49L272,-36Z';
    let l = 'M103,-72H237v-3H103Z';
    for (const x of [106, 129, 152, 179, 202, 225]) l += `M${x},-58h3v54h-3Z`;
    for (const x of [78, 87, 96, 244, 253, 262]) l += `M${x - 1.5},-32h3v30h-3Z`;
    return s + `<g transform="translate(170 0) scale(1.2) translate(-170 0)">${P(d)}<circle class="sc-far" cx="173.5" cy="-137" r="4.5"/>${P(l, 'sc-far2')}</g>`;
  });

  D.far('kremlin', () => {
    // the wall with its merlons
    let d = 'M0,40V-34';
    for (let x = 0; x < 440; x += 14) d += `H${x + 4}V-43H${x + 10}V-34`;
    d += 'H440V40Z';
    // gate tower with a tented spire and a star
    d += 'M64,40V-80H104V40ZM60,-80H108V-87H60ZM72,-87V-108H96V-87ZM69,-108L84,-160L99,-108Z';
    d += A.starD(84, -166, 7);
    // lesser tower
    d += 'M358,40V-58H388V40ZM355,-58H391V-64H355ZM363,-64V-76H383V-64ZM361,-76L373,-116L385,-76Z';
    // the cathedrals
    d += 'M194,40V-58H294V40Z';
    d += 'M200,-58V-66H212V-58ZM218,-58V-72H232V-58ZM234,-58V-80H254V-58ZM256,-58V-72H270V-58ZM276,-58V-66H288V-58Z';
    d += onion(206, -66, 7, 20) + onion(225, -72, 8, 24) + onion(244, -80, 12, 36) + onion(263, -72, 8, 24) + onion(282, -66, 7, 20);
    // the bell tower
    d += 'M310,40V-112H328V40ZM307,-112H331V-117H307ZM313,-117V-132H325V-117Z' + onion(319, -132, 7.5, 22);
    let l = onionLit(206, -66, 7, 20) + onionLit(225, -72, 8, 24) + onionLit(244, -80, 12, 36) + onionLit(263, -72, 8, 24) + onionLit(282, -66, 7, 20) + onionLit(319, -132, 7.5, 22);
    for (const x of [206, 225, 244, 263, 282]) l += `M${x - 2},-38v-12a2,2 0 0 1 4,0v12Z`;
    l += 'M317,-60v-14a2,2 0 0 1 4,0v14ZM317,-88v-14a2,2 0 0 1 4,0v14ZM370,-30v-14a3,3 0 0 1 6,0v14Z';
    return P(d) + P(l, 'sc-far2') + '<circle class="sc-far2" cx="84" cy="-62" r="8"/>';
  });

  D.far('capitol', () => {
    let d = 'M66,40V-8H394V40Z';
    // wings with end pavilions
    d += 'M84,-8V-44H184V-8ZM276,-8V-44H376V-8ZM78,-44L101,-60L124,-44ZM336,-44L359,-60L382,-44Z';
    // centre block, pediment, drum, dome, lantern
    d += 'M176,-8V-58H284V-8ZM182,-58L230,-78L278,-58Z';
    d += 'M199,-66V-98H261V-66ZM195,-98H265V-103H195Z';
    d += 'M201,-103C201,-152 259,-152 259,-103Z';
    d += 'M223,-136V-156H237V-136ZM220,-156L230,-168L240,-156ZM229,-168h2v-11h-2Z';
    // the obelisk, and trees to either side
    d += 'M38,40L42,-126L47,-138L52,-126L56,40Z';
    d += 'M0,40V-10Q8,-28 20,-16Q28,-22 32,-8V40ZM398,40V-12Q406,-30 418,-18Q430,-32 440,-14V40Z';
    let l = '';
    for (let x = 128; x < 176; x += 9) l += `M${x},-40h3.6v28h-3.6Z`;
    for (let x = 289; x < 336; x += 9) l += `M${x},-40h3.6v28h-3.6Z`;
    for (let x = 193; x < 268; x += 11.5) l += `M${f(x)},-54h4.4v42h-4.4Z`;
    for (let x = 204; x < 258; x += 8) l += `M${x},-94h3v24h-3Z`;
    l += 'M207,-106C208,-130 219,-142 229,-143C219,-136 214,-124 213,-106Z';
    l += 'M96,-36v-14a5,5 0 0 1 10,0v14ZM354,-36v-14a5,5 0 0 1 10,0v14Z';
    return P(d) + P(l, 'sc-far2');
  });

  D.far('oldtown', ({ r }) => {
    let d = '';
    let l = '';
    // steep gables
    let x = -4;
    while (x < 262) {
      const w = 20 + r() * 12;
      const h = 30 + r() * 24;
      d += `M${f(x)},40V${f(-h)}L${f(x + w / 2)},${f(-h - w * 0.78)}L${f(x + w)},${f(-h)}V40Z`;
      if (r() < 0.7) l += `M${f(x + w / 2 - 2.2)},${f(-h + 4)}h4.4v7h-4.4Z`;
      if (r() < 0.5) l += `M${f(x + 4)},${f(-h + 16)}h4.4v7h-4.4ZM${f(x + w - 8.4)},${f(-h + 16)}h4.4v7h-4.4Z`;
      x += w - 0.5;
    }
    // the twin-spired church
    d += 'M100,40V-72H146V40ZM98,-72L123,-98L148,-72ZM96,40V-106H114V40ZM132,40V-106H150V40Z';
    d += 'M94,-106L105,-164L116,-106ZM130,-106L141,-164L152,-106Z';
    for (const px of [94, 112, 130, 148]) d += `M${px},-104l2,-17l2,17Z`;
    l += 'M103,-70v-22a2,2 0 0 1 4,0v22ZM139,-70v-22a2,2 0 0 1 4,0v22Z';
    // a baroque dome
    d += 'M202,40V-58H240V40ZM204,-58C204,-88 238,-88 238,-58ZM217,-78V-92H225V-78Z' + onion(221, -92, 4, 10);
    l += 'M209,-60C210,-74 216,-80 221,-80C216,-76 214,-70 214,-60Z';
    // castle hill
    d += 'M256,40V-18Q300,-32 330,-64Q358,-84 392,-78Q420,-72 440,-54V40Z';
    d += 'M322,-60V-94H414V-60ZM322,-94L329,-103H407L414,-94Z';
    d += 'M312,-66V-106H330V-66ZM309,-106L321,-128L333,-106ZM404,-66V-102H422V-66ZM401,-102L413,-122L425,-102Z';
    d += 'M350,-100V-116H388V-100ZM362,-116V-132H374V-116ZM360,-132L368,-174L376,-132Z';
    for (let wx = 336; wx < 402; wx += 11) l += `M${wx},-84h4.4v8h-4.4Z`;
    return P(d) + P(l, 'sc-far2') + '<circle class="sc-far2" cx="123" cy="-58" r="6"/>';
  });

  D.far('palace', () => {
    // terrace, long body, cornice
    let d = 'M26,40V-8H414V40ZM44,-8V-62H396V-8ZM40,-62H400V-67H40Z';
    for (let x = 98; x < 344; x += 12) if (x < 164 || x > 268) d += `M${x},-67v-7h6v7Z`;
    // end pavilions, the portico and its pediment
    d += 'M40,-8V-76H94V-8ZM36,-76H98V-81H36ZM346,-8V-76H400V-8ZM342,-76H404V-81H342Z';
    d += 'M170,-8V-78H270V-8ZM162,-78L220,-108L278,-78Z';
    // flagpole and flag
    d += 'M218.800,-108h2.4v-50h-2.4ZM221,-158h30l-7,8l7,8h-30Z';
    // clipped trees at the flanks
    d += 'M-6,40V-18Q2,-40 14,-28Q24,-36 28,-16V40ZM412,40V-16Q418,-36 428,-28Q438,-40 446,-18V40Z';
    let l = '';
    for (let x = 102; x < 164; x += 12) l += `M${x},-58h5v48h-5Z`;
    for (let x = 274; x < 340; x += 12) l += `M${x},-58h5v48h-5Z`;
    for (let i = 0; i < 6; i++) l += `M${f(179 + i * 15.200)},-73h6.4v63h-6.4Z`;
    for (const x of [52, 72, 358, 378]) l += `M${x},-14v-44a5,5 0 0 1 10,0v44Z`;
    l += 'M214,-86L220,-98L226,-86Z';
    return P(d) + P(l, 'sc-far2');
  });

  D.far('mosque', () => {
    // flat roofs to either side
    let d = 'M0,40V-30H36V-46H72V-26H96V40ZM346,40V-28H374V-48H408V-34H440V40ZM36,-46h8v-5h-8ZM64,-46h8v-5h-8ZM374,-48h8v-5h-8ZM400,-48h8v-5h-8Z';
    d += 'M300,40V-22A14,14 0 0 1 328,-22V40Z';
    // prayer hall, drum, dome and half-domes
    d += 'M116,40V-52H324V40ZM174,-52V-68H266V-52ZM177,-68A43,43 0 0 1 263,-68Z';
    d += 'M122,-52A25,25 0 0 1 172,-52ZM268,-52A25,25 0 0 1 318,-52Z';
    d += 'M219,-110h2v-16h-2Z';
    const minaret = (x, h, w) =>
      `M${x - w / 2},40V${-h}H${x + w / 2}V40Z` +
      `M${x - w / 2 - 3.500},${f(-h * 0.56)}h${w + 7}v-5h${-(w + 7)}Z` +
      `M${x - w / 2 - 3},${f(-h * 0.86)}h${w + 6}v-5h${-(w + 6)}Z` +
      `M${x - w / 2 - 1},${-h}L${x},${-h - 26}L${x + w / 2 + 1},${-h}Z`;
    d += minaret(106, 146, 9) + minaret(334, 146, 9) + minaret(52, 96, 7) + minaret(394, 104, 7);
    let l = '';
    for (let i = 0; i < 6; i++) l += `M${138 + i * 31},-12v-20a5.500,5.500 0 0 1 11,0v20Z`;
    l += 'M184,-70A37,37 0 0 1 214,-104A46,46 0 0 0 192,-70Z';
    l += 'M10,-14h5v8h-5ZM22,-14h5v8h-5ZM80,-14h5v8h-5ZM356,-16h5v8h-5ZM420,-22h5v8h-5Z';
    return P(d) + '<circle class="sc-far" cx="220" cy="-129" r="4"/>' + P(l, 'sc-far2');
  });

  D.far('pagoda', () => {
    const eave = (cx, y, w, h, lift) => {
      const a = cx - w / 2;
      const b = cx + w / 2;
      return `M${f(a)},${f(y - lift)}Q${f(a + w * 0.1)},${y} ${f(a + w * 0.2)},${y}H${f(b - w * 0.2)}Q${f(b - w * 0.1)},${y} ${f(b)},${f(y - lift)}L${f(b - w * 0.24)},${f(y - h)}H${f(a + w * 0.24)}Z`;
    };
    // the outer wall
    let d = 'M0,40V-18H440V40ZM0,-18H440V-22H0Z';
    // gate tower: battered base, hall, two eaves, ridge
    d += 'M166,40L173,-46H351L358,40ZM170,-46H354V-51H170Z';
    d += 'M196,-51V-68H328V-51Z' + eave(262, -64, 204, 17, 8);
    d += 'M210,-81V-93H314V-81Z' + eave(262, -89, 178, 27, 9);
    d += 'M212,-116H312V-121H212ZM212,-116l-4,-11l10,5ZM312,-116l4,-11l-10,5Z';
    // tiered pagoda
    for (let i = 0; i < 5; i++) {
      const w = 46 - i * 7;
      const y = -22 - i * 25;
      d += `M${f(78 - w / 2)},${y + 4}V${y - 17}H${f(78 + w / 2)}V${y + 4}Z` + eave(78, y - 15, w + 30, 10, 5);
    }
    d += 'M76.800,-147h2.4v-36h-2.4Z';
    let l = '';
    for (let x = 201; x < 324; x += 14) l += `M${x},-66h5v13h-5Z`;
    for (let x = 217; x < 308; x += 14) l += `M${x},-91h5v9h-5Z`;
    for (let i = 0; i < 5; i++) l += `M76,${-32 - i * 25}h4v8h-4Z`;
    // the three gateways are cut out of the base
    const gates = 'M250,0V-22a12,12 0 0 1 24,0V0ZM208,0V-16a9,9 0 0 1 18,0V0ZM298,0V-16a9,9 0 0 1 18,0V0Z';
    return (
      P(d) +
      '<circle class="sc-far" cx="78" cy="-152" r="4"/><circle class="sc-far" cx="78" cy="-162" r="3.2"/><circle class="sc-far" cx="78" cy="-171" r="2.4"/>' +
      P(l, 'sc-far2') +
      P(gates, 'sc-far2')
    );
  });

  /* --------------------------------------------------------------- landscapes */

  D.far('mountains', () => {
    const back = 'M0,40V-70L36,-98L66,-74L110,-120L150,-84L186,-108L240,-90L290,-134L330,-100L372,-124L410,-88L440,-106V40Z';
    const pts = [[0, -52], [34, -92], [58, -72], [96, -142], [124, -98], [146, -114], [178, -62], [204, -88], [250, -170], [282, -112], [300, -128], [336, -70], [364, -104], [398, -152], [424, -108], [440, -120]];
    const front = `M0,40V${pts[0][1]}` + pts.slice(1).map((p) => 'L' + pt(p)).join('') + 'V40Z';
    const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    // snow from the summit down both flanks, with a ragged lower edge
    const cap = (i, drop) => {
      const p = pts[i];
      const a = lerp(p, pts[i - 1], Math.min(0.85, drop / (pts[i - 1][1] - p[1])));
      const b = lerp(p, pts[i + 1], Math.min(0.85, drop / (pts[i + 1][1] - p[1])));
      let d = `M${pt(p)}L${pt(b)}`;
      [0.22, 0.42, 0.62, 0.82].forEach((k, n) => {
        const q = lerp(b, a, k);
        d += `L${f(q[0])},${f(q[1] + (n % 2 ? 9 : -7))}`;
      });
      return d + `L${pt(a)}Z`;
    };
    const snow = cap(3, 34) + cap(8, 44) + cap(13, 36) + cap(1, 16) + cap(5, 12) + cap(10, 12);
    return P(back, 'sc-far', ' opacity=".5"') + P(front) + P(snow, 'sc-far2');
  });

  D.far('hills', () => {
    const y = (x) => -(36 + 17 * Math.sin(x / 68 + 1) + 8 * Math.sin(x / 29));
    let d = `M0,40V${f(y(0))}`;
    for (let x = 0; x < 440; x += 16) d += `A10,8 0 0 1 ${x + 16},${f(y(x + 16))}`;
    d += 'V40Z';
    let l = '';
    for (const [x, s] of [[46, 1.15], [118, 0.8], [138, 1.05], [258, 1.25], [284, 0.85], [384, 1.05], [408, 0.75]]) {
      const b = y(x) + 6;
      for (const [w, lo, hi] of [[12, 0, 22], [9.5, 14, 35], [7, 27, 50]]) {
        d += `M${f(x - w * s)},${f(b - lo * s)}L${x},${f(b - hi * s)}L${f(x + w * s)},${f(b - lo * s)}Z`;
        l += `M${f(x - w * s)},${f(b - lo * s)}L${x},${f(b - hi * s)}L${f(x - w * s * 0.35)},${f(b - lo * s)}Z`;
      }
    }
    return P('M0,40V-60Q70,-100 150,-66T300,-76Q370,-108 440,-70V40Z', 'sc-far', ' opacity=".5"') + P(d) + P(l, 'sc-far2', ' opacity=".7"');
  });

  D.far('jungle', ({ r }) => {
    // palms first, so the canopy closes over their feet
    let d = '';
    for (const [x, h, L] of [[58, 150, 40], [168, 118, 34], [298, 166, 42], [392, 128, 36]]) d += palmD(x, -30, x + (r() - 0.5) * 22, -h, L, r, 3.2);
    let y = -52;
    let c = `M0,40V${y}`;
    let l = '';
    let x = 0;
    while (x < 440) {
      const w = 20 + r() * 26;
      const yn = -(46 + r() * 36);
      const top = Math.min(y, yn) - w * 0.5;
      c += `Q${f(x + w / 2)},${f(top)} ${f(x + w)},${f(yn)}`;
      if (r() < 0.5) l += `M${f(x + w * 0.16)},${f((y + top) / 2)}Q${f(x + w * 0.4)},${f(top + 2)} ${f(x + w * 0.74)},${f((yn + top) / 2 + 1)}Q${f(x + w * 0.42)},${f(top + 8)} ${f(x + w * 0.16)},${f((y + top) / 2)}Z`;
      x += w;
      y = yn;
    }
    return P(d) + P(c + 'V40Z') + P(l, 'sc-far2', ' opacity=".8"');
  });

  D.far('dunes', ({ r }) => {
    let s = P('M0,40V-42Q80,-90 170,-52Q230,-28 300,-66Q370,-102 440,-62V40Z', 'sc-far', ' opacity=".5"');
    let d = 'M0,40V-22Q50,-54 120,-30Q170,-14 230,-36Q310,-72 380,-34Q410,-20 440,-28V40Z';
    // flat-roofed houses stepping up the near dune
    d += 'M34,40V-54H66V40ZM62,40V-70H92V40ZM90,40V-48H126V40ZM30,-54h7v-5h-7ZM59,-70h7v-5h-7ZM86,-70h8v-5h-8ZM120,-48h8v-5h-8ZM66,-54l-10,0v-6Z';
    // date palms at the well
    d += palmD(292, -44, 286, -104, 26, r, 2.4) + palmD(318, -48, 324, -124, 30, r, 2.6) + palmD(350, -40, 356, -92, 23, r, 2.2);
    s += P(d);
    // light along the crests
    let l = 'M230,-36Q310,-72 380,-34Q336,-52 304,-50Q264,-48 230,-36ZM126,-30Q170,-14 230,-36Q196,-22 170,-21Q146,-21 126,-30Z';
    l += 'M41,-46h5v8h-5ZM52,-46h5v8h-5ZM70,-60h5v9h-5ZM80,-60h5v9h-5ZM100,-40h5v8h-5ZM112,-40h5v8h-5Z';
    return s + P(l, 'sc-far2');
  });

  D.far('volcano', ({ r }) => {
    // smoke drifting from the crater
    let s = '';
    for (const [x, y, q] of [[282, -160, 9], [290, -176, 12], [304, -192, 15], [324, -202, 14], [344, -198, 10]]) s += `<circle class="sc-far2" cx="${x}" cy="${y}" r="${q}"/>`;
    // the small cone, then the great one with its notched crater
    let d = 'M10,40Q64,10 84,-68L90,-72L96,-66L102,-70Q124,10 190,40Z';
    d += 'M96,40Q214,-14 266,-146L273,-153L281,-147L288,-154L297,-146Q352,-24 440,6V40Z';
    // low growth and palms along the foot
    let y = -14;
    let c = `M0,40V${y}`;
    for (let x = 0; x < 440; ) {
      const w = 22 + r() * 20;
      const yn = -(10 + r() * 14);
      c += `Q${f(x + w / 2)},${f(Math.min(y, yn) - 9)} ${f(x + w)},${f(yn)}`;
      x += w;
      y = yn;
    }
    d += c + 'V40Z' + palmD(30, -10, 26, -62, 22, r, 2.2) + palmD(210, -10, 216, -50, 18, r, 2) + palmD(410, -10, 414, -58, 21, r, 2.2);
    // gullies catching the light
    const l = 'M266,-146L273,-153L262,-96L248,-70ZM281,-147L288,-154L292,-112L284,-84ZM297,-146L322,-88L306,-104ZM84,-68L90,-72L86,-40L76,-26Z';
    return s + P(d) + P(l, 'sc-far2', ' opacity=".8"');
  });

  D.far('port', () => {
    // quay and saw-toothed warehouses
    let d = 'M0,40V-10H440V40ZM0,-10V-38L20,-52V-38L40,-52V-38L60,-52V-38L80,-52V-38L100,-52V-10Z';
    // freighter: hull with raised bow and stern, bridge, funnel, mast
    d += 'M206,-10L196,-42H232V-34H384V-46H428L412,-10Z';
    d += 'M250,-34V-60H304V-34ZM258,-60V-72H294V-60ZM268,-72L270,-100H286L288,-72Z';
    d += 'M344,-34h3.4v-52h-3.4ZM330,-74h32v2.6h-32Z';
    // harbour cranes: portal, machine house, mast, jib, hoist
    let st = '';
    const crane = (x, k, dir) => {
      const X = (dx) => f(x + dx * k * dir);
      const Y = (dy) => f(-10 - dy * k);
      d += `M${X(-18)},${Y(54)}H${X(16)}V${Y(76)}H${X(-18)}Z`;
      d += `M${X(60)},${Y(84)}h${f(6 * k)}v${f(9 * k)}h${f(-6 * k)}Z`;
      st += `<path class="st-far" stroke-width="${f(5 * k)}" stroke-linecap="square" d="M${X(-14)},${Y(0)}L${X(-7)},${Y(54)}M${X(14)},${Y(0)}L${X(7)},${Y(54)}M${X(-11)},${Y(26)}H${X(11)}M${X(8)},${Y(72)}L${X(64)},${Y(142)}M${X(-8)},${Y(76)}L${X(-14)},${Y(112)}"/>`;
      st += `<path class="st-far" stroke-width="${f(2 * k)}" d="M${X(-14)},${Y(112)}L${X(64)},${Y(142)}V${Y(92)}"/>`;
    };
    crane(128, 1, -1);
    crane(180, 1.1, 1);
    crane(404, 0.8, -1);
    let l = 'M269,-90h18v-7h-18Z';
    for (let x = 10; x < 96; x += 20) l += `M${x},-30h8v8h-8Z`;
    for (let x = 258; x < 300; x += 10) l += `M${x},-52h5v6h-5Z`;
    for (let x = 240; x < 384; x += 16) l += `M${x},-26h4v4h-4Z`;
    return P(d) + st + P(l, 'sc-far2');
  });

  D.far('savanna', ({ r }) => {
    let s = P('M0,40V-30H38L52,-48H150L166,-30H252L268,-56H334L350,-36H440V40Z', 'sc-far', ' opacity=".5"');
    // the plain, with grass
    let d = 'M0,40V-8';
    for (let x = 0; x < 440; x += 8) d += `L${f(x + 3 + r() * 2)},${f(-12 - r() * 7)}L${x + 8},-8`;
    d += 'V40Z';
    let l = '';
    const acacia = (x, h, w) => {
      const t = w * 0.07 + 1.6;
      d += `M${f(x - t)},0L${f(x - t * 0.7)},${f(-h * 0.5)}L${f(x - w * 0.6)},${f(-h + 5)}L${f(x - w * 0.46)},${f(-h + 4)}L${x},${f(-h * 0.62)}L${f(x + w * 0.46)},${f(-h + 4)}L${f(x + w * 0.6)},${f(-h + 5)}L${f(x + t * 0.7)},${f(-h * 0.5)}L${f(x + t)},0Z`;
      d += `M${f(x - w)},${f(-h + 7)}Q${x},${f(-h - w * 0.34)} ${f(x + w)},${f(-h + 7)}Q${x},${f(-h + 13)} ${f(x - w)},${f(-h + 7)}Z`;
      l += `M${f(x - w * 0.78)},${f(-h + 3)}Q${f(x - w * 0.2)},${f(-h - w * 0.24)} ${f(x + w * 0.3)},${f(-h - w * 0.1)}Q${f(x - w * 0.2)},${f(-h - w * 0.1)} ${f(x - w * 0.78)},${f(-h + 3)}Z`;
    };
    acacia(74, 92, 56);
    acacia(336, 70, 42);
    acacia(412, 46, 27);
    // the baobab: a swollen trunk and a crown of stubby branches
    d += 'M182,0Q192,-46 188,-80H214Q210,-46 220,0Z';
    for (const [a, len] of [[-158, 30], [-128, 36], [-98, 32], [-72, 38], [-42, 34], [-16, 28]]) {
      const c = Math.cos(A.rad(a));
      const sn = Math.sin(A.rad(a));
      const bx = 201 + c * 9;
      const by = -78 + sn * 3;
      const ex = bx + c * len;
      const ey = by + sn * len;
      d += `M${f(bx + sn * 5)},${f(by - c * 5)}L${f(ex + sn * 1.6)},${f(ey - c * 1.6)}L${f(ex - sn * 1.6)},${f(ey + c * 1.6)}L${f(bx - sn * 5)},${f(by + c * 5)}Z`;
      s += `<circle class="sc-far" cx="${f(ex + c * 3)}" cy="${f(ey + sn * 3)}" r="${f(5 + r() * 2.5)}"/>`;
    }
    l += 'M184,-4Q193,-46 190,-78H196Q198,-44 191,-4Z';
    return s + P(d) + P(l, 'sc-far2', ' opacity=".8"');
  });

  D.far('ice', () => {
    // the glacier front, one great berg, a small one, floes
    let d = 'M0,40V-64L22,-78L42,-62V-52L64,-70L88,-54V-40L108,-52L130,-38V-24L150,-36L172,-22L192,-28V40Z';
    d += 'M214,40L236,-42L252,-34L286,-134L310,-98L326,-108L354,-30L372,-38L384,40Z';
    d += 'M394,40L404,-22L420,-48L432,-28L440,-32V40ZM196,40V-6H214V40Z';
    // lit tops and left-hand faces
    let l = 'M0,-64L22,-78V-2H0ZM42,-52L64,-70V-2H42ZM88,-40L108,-52V-2H88ZM130,-24L150,-36V-2H130Z';
    l += 'M286,-134L252,-34L246,-2H268L274,-40L294,-96ZM236,-42L226,-2H240L250,-36ZM326,-108L310,-98L320,-60L332,-2H342L336,-60Z';
    l += 'M420,-48L404,-22L400,-2H410L414,-22Z';
    return P(d) + P(l, 'sc-far2');
  });

  /* -------------------------------------------------------------- foregrounds */

  D.fore('wire', () => {
    let s = '';
    const posts = [[50, -7], [226, 5], [396, -4]];
    // strands sag between the posts
    const xs = [-30, 50, 226, 396, 470];
    [364, 389, 414].forEach((y0, k) => {
      const at = (x) => {
        let i = 1;
        while (i < xs.length - 1 && x > xs[i]) i++;
        const u = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
        return y0 + (10 + k * 2) * 4 * u * (1 - u);
      };
      let d = '';
      for (let x = -10; x <= 450; x += 10) d += (d ? 'L' : 'M') + x + ',' + f(at(x));
      let barbs = '';
      for (let x = 6 + k * 9; x < 440; x += 23) {
        const y = at(x);
        barbs += `M${x - 4},${f(y - 5)}L${x + 4},${f(y + 5)}M${x - 4},${f(y + 5)}L${x + 4},${f(y - 5)}`;
      }
      s += `<path class="st-d" stroke-width="3" d="${d}"/><path class="st-d" stroke-width="2.400" stroke-linecap="round" d="${barbs}"/>`;
      s += `<path class="st-paper" stroke-width="1" opacity=".42" transform="translate(0 -1.3)" d="${d}"/>`;
    });
    for (const [x, a] of posts)
      s +=
        `<g transform="rotate(${a} ${x} 440)"><path class="sc-crowd-b" d="M${x - 5.500},446V346L${x},337L${x + 5.500},346V446Z"/>` +
        `<path class="sc-accent" opacity=".45" d="M${x - 5.500},440V348h2.2V440Z"/></g>`;
    return s;
  });

  D.fore('wheat', ({ r }) => {
    let s = '';
    for (let i = 0; i < 17; i++) {
      const x = 12 + i * 26 + (r() - 0.5) * 14;
      const top = 350 + r() * 34;
      const lean = (r() - 0.5) * 30;
      const tx = x + lean;
      const lit = i % 3 !== 2;
      s += `<path class="st-d" stroke-width="3" d="M${f(x)},446Q${f(x)},${f(top + 74)} ${f(tx)},${f(top + 42)}"/>`;
      // a blade of leaf low on the stem
      s += `<path class="sc-crowd-b" d="M${f(x)},${f(top + 92)}Q${f(x + (i % 2 ? 16 : -16))},${f(top + 70)} ${f(x + (i % 2 ? 26 : -26))},${f(top + 78)}Q${f(x + (i % 2 ? 14 : -14))},${f(top + 82)} ${f(x)},${f(top + 98)}Z"/>`;
      let ear = '<ellipse class="sc-crowd-b" cx="0" cy="-40" rx="3.2" ry="6.5"/>';
      let awn = 'M0,-44L0,-64';
      let hi = '';
      for (let j = 0; j < 5; j++) {
        const cy = -6 - j * 7.200;
        for (const sd of [-1, 1]) {
          ear += `<ellipse class="sc-crowd-b" cx="${f(sd * 4.2)}" cy="${f(cy)}" rx="3.4" ry="6" transform="rotate(${sd * 24} ${f(sd * 4.2)} ${f(cy)})"/>`;
          awn += `M${f(sd * 5.500)},${f(cy - 4)}L${f(sd * 11)},${f(cy - 22)}`;
        }
        if (lit) hi += `<ellipse class="sc-accent" opacity=".55" cx="-5" cy="${f(cy - 0.5)}" rx="1.4" ry="3.800" transform="rotate(-24 -5 ${f(cy)})"/>`;
      }
      s += `<g transform="translate(${f(tx)} ${f(top + 44)}) rotate(${f(lean * 0.9)})">${ear}<path class="st-d" stroke-width="1.100" d="${awn}"/>${hi}</g>`;
    }
    return s;
  });

  D.fore('rubble', () => {
    // two heaps, loose blocks on top, a bent beam and a length of rebar
    let s = '<path class="sc-crowd-b" d="M-4,444V408L30,394L74,382L118,374L150,386L190,400L236,404L270,390L316,374L352,368L392,382L444,400V444Z"/>';
    const stones = [[40, 388, 36, 20, -18, 1], [94, 370, 42, 24, 12, 0], [142, 378, 28, 18, -30, 1], [198, 398, 36, 16, 8, 0], [284, 380, 44, 22, -14, 1], [336, 360, 38, 24, 20, 0], [386, 374, 30, 18, -8, 1], [422, 392, 34, 20, 26, 0], [250, 394, 22, 14, 40, 0], [64, 404, 26, 14, 6, 0]];
    for (const [x, y, w, h, a, lit] of stones) {
      s += `<g transform="rotate(${a} ${x} ${y})"><rect class="sc-crowd-b" x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}"/>`;
      if (lit) s += `<rect class="sc-accent" opacity=".5" x="${x - w / 2 + 2}" y="${y - h / 2 + 1.500}" width="${w - 4}" height="2.600"/>`;
      s += '</g>';
    }
    s += '<path class="st-paper" stroke-width="1.600" opacity=".4" d="M0,408L30,394L74,382L118,374L150,386L190,400L236,404L270,390L316,374L352,368L392,382L440,400"/>';
    s += '<path class="st-d" stroke-width="8" stroke-linejoin="miter" d="M212,432L230,352L272,334"/><path class="st-paper" stroke-width="1.400" opacity=".45" d="M209,418L227,350L270,331"/>';
    s += '<path class="st-d" stroke-width="2.600" stroke-linecap="round" d="M304,404Q314,358 334,346M120,400Q112,360 96,352"/>';
    return s;
  });
})();
