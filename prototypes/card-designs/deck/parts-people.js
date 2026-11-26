// Deck illustrations: people and the things they hold. See deck/art.js for the conventions.
// Every part is drawn round the point it stands on (bottom centre), up is negative, and a standing
// adult is 120 tall. Mostly black, with a few lit shapes; colours come from classes only.
(function () {
  'use strict';
  const A = window.CardArt;
  const D = window.DeckArt;
  const f = A.f;

  const P = (cls, d, extra = '') => `<path class="${cls}" d="${d}"${extra}/>`;
  const C = (cls, x, y, r, extra = '') => `<circle class="${cls}" cx="${f(x)}" cy="${f(y)}" r="${f(r)}"${extra}/>`;
  const B = (cls, x, y, w, h, rx = 0, extra = '') =>
    `<rect class="${cls}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"${rx ? ` rx="${rx}"` : ''}${extra}/>`;
  const S = (cls, d, w, extra = '') => `<path class="${cls}" d="${d}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
  const G = (t, inner) => `<g transform="${t}">${inner}</g>`;

  // a head seen from the front, hair with a side parting
  const face = (x, y, r = 8.5) =>
    C('sc-skin', x, y, r) +
    P(
      'sc-fig-d',
      `M${f(x - r - 0.4)},${f(y - 1)}Q${f(x - r - 1)},${f(y - r - 3)} ${x},${f(y - r - 2.5)}Q${f(x + r + 1)},${f(y - r - 3)} ${f(x + r + 0.4)},${f(y - 1)}` +
        `Q${f(x + r * 0.5)},${f(y - r * 0.6)} ${f(x - r * 0.1)},${f(y - r * 0.55)}Q${f(x - r * 0.8)},${f(y - r * 0.5)} ${f(x - r - 0.4)},${f(y - 1)}Z`,
    );
  // a bare head in profile, looking right
  const profile = (x, y) =>
    P('sc-skin', `M${x - 3},${y - 8.5}Q${x + 7},${y - 9} ${x + 8},${y - 2}L${x + 11.5},${y + 1.5}L${x + 8},${y + 3.2}L${x + 7.5},${y + 7}Q${x + 3},${y + 10} ${x - 3},${y + 8}Z`) +
    P('sc-fig-d', `M${x + 7.5},${y - 4.5}Q${x + 4},${y - 11} ${x - 3},${y - 10.5}Q${x - 11},${y - 9} ${x - 10},${y}Q${x - 9.5},${y + 6} ${x - 4},${y + 8.5}L${x - 2.5},${y - 1.5}Q${x + 2},${y - 5} ${x + 7.5},${y - 4.5}Z`);
  // just the face of a head in profile, for figures that wear something on it
  const mask = (x, y) => P('sc-skin', `M${x - 1},${y - 7}H${x + 7.5}L${x + 8},${y - 2}L${x + 11.5},${y + 1.5}L${x + 8},${y + 3.2}L${x + 7.5},${y + 7}Q${x + 3},${y + 10} ${x - 2},${y + 8}Z`);

  const micro = (x0, y0, x1, y1) => {
    const a = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI + 90;
    return S('st-l', `M${x0},${y0}L${x1},${y1}`, 3) + `<rect class="sc-fig-l" x="-4" y="-13" width="8" height="14" rx="4" transform="translate(${x1} ${y1}) rotate(${f(a)})"/>`;
  };

  /* ------------------------------------------------------------------ figures */

  // 96 x 157. Speaker behind a lectern, three microphones, right fist raised.
  D.part(
    'orator',
    () =>
      P('sc-fig-d', 'M-26,-58L-24,-99Q-22,-109 -9,-111H9Q22,-109 24,-99L26,-58Z') +
      P('sc-fig-l', 'M-24,-99Q-22,-108 -11,-110.5L-15,-58H-26Z', ' opacity=".5"') +
      P('sc-accent', 'M-7,-111L0,-92L7,-111Z') +
      P('sc-hot', 'M-2.5,-105H2.5L3.4,-86L0,-80L-3.4,-86Z') +
      B('sc-skin-d', -4.5, -115, 9, 6) +
      face(0, -122, 9.5) +
      S('st-d', 'M20,-103L38,-117L35,-140', 11) +
      P('sc-accent', 'M29.5,-142.5L41,-141L40.4,-136L29,-137.5Z') +
      C('sc-skin', 35.5, -149, 7.5) +
      S('st-d', 'M-20,-103L-33,-86L-25,-72', 10) +
      C('sc-skin', -24, -71, 5) +
      // lectern
      P('sc-fig-d', 'M-48,-72H48V-64H42L36,0H-36L-42,-64H-48Z') +
      P('sc-fig-m', 'M-35,-58H35L31,-6H-31Z') +
      P('sc-accent', 'M0,-48L12,-33L0,-18L-12,-33Z') +
      micro(-14, -72, -20, -92) +
      micro(1, -72, 1, -97) +
      micro(15, -72, 21, -91),
  );

  // 52 x 129. Overcoat and hat, hands behind the back.  :cap = uniform and peaked cap (50 x 131).
  D.part('leader', ({ v }) =>
    v === 'cap'
      ? P('sc-fig-d', 'M-15,-52H-1L-3,-20H-13ZM1,-52H15L13,-20H3Z') +
        P('sc-fig-d', 'M-13,-24H-3L-2,0H-18Q-18,-5 -13,-6ZM3,-24H13L13,-6Q18,-5 18,0H2Z') +
        P('sc-fig-d', 'M-17,-100Q-22,-98 -23,-90L-25,-60Q-25,-54 -21,-52L-19,-46H19L21,-52Q25,-54 25,-60L23,-90Q22,-98 17,-100L8,-104H-8Z') +
        P('sc-fig-m', 'M-16,-94L-21,-58L-17,-55L-13,-90ZM16,-94L21,-58L17,-55L13,-90Z') +
        B('sc-fig-l', -18.5, -65, 37, 5) +
        B('sc-accent', -3.5, -66, 7, 7) +
        P('sc-accent', 'M-20,-99L-9,-102.5V-99L-20,-95.5ZM20,-99L9,-102.5V-99L20,-95.5Z') +
        C('sc-fig-l', 0, -92, 1.9) +
        C('sc-fig-l', 0, -83, 1.9) +
        C('sc-fig-l', 0, -74, 1.9) +
        B('sc-skin-d', -4, -107, 8, 5) +
        C('sc-skin', 0, -112, 8.5) +
        P('sc-fig-d', 'M-16,-121Q0,-134 16,-121L11,-116H-11Z') +
        P('sc-hot', 'M-11,-119.5H11V-115.5H-11Z') +
        P('sc-fig-d', 'M-10.5,-116H10.5Q9,-110.5 0,-111.5Q-9,-110.5 -10.5,-116Z')
      : P('sc-fig-d', 'M-13,-26H-2L-3,-3H-14ZM2,-26H13L14,-3H3Z') +
        P('sc-fig-d', 'M-18,0Q-18,-5 -12,-5H-2V0ZM2,0V-5H12Q18,-5 18,0Z') +
        P('sc-fig-d', 'M-17,-100Q-22,-98 -23,-90L-26,-58Q-26,-52 -23,-48V-22H23V-48Q26,-52 26,-58L23,-90Q22,-98 17,-100L8,-104H-8Z') +
        P('sc-fig-m', 'M-16,-94L-22,-58L-18,-54L-13,-90ZM16,-94L22,-58L18,-54L13,-90Z') +
        P('sc-accent', 'M-5,-104L0,-93L5,-104Z') +
        P('sc-fig-l', 'M-8,-104L0,-90L-2,-72L-12,-99Z', ' opacity=".75"') +
        C('sc-fig-l', 4, -78, 1.9) +
        C('sc-fig-l', 4, -66, 1.9) +
        C('sc-fig-l', 4, -54, 1.9) +
        B('sc-skin-d', -4, -107, 8, 5) +
        C('sc-skin', 0, -112, 8.5) +
        P('sc-fig-d', 'M-16,-115Q0,-110.5 16,-115Q16,-118.5 9.5,-119L8.5,-127Q0,-132 -8.5,-127L-9.5,-119Q-16,-118.5 -16,-115Z') +
        P('sc-fig-l', 'M-9.3,-120.5Q0,-118 9.3,-120.5L9.5,-118.2Q0,-115.7 -9.5,-118.2Z'),
  );

  // 70 x 140. Long robes, a tall plain staff, the other hand raised.
  // :turban = turbaned cleric, no staff (64 x 128).  :nun = veiled figure kneeling in profile (62 x 92).
  D.part('robed', ({ v }) => {
    if (v === 'nun')
      return (
        P('sc-fig-d', 'M-2,-72Q-22,-56 -34,0H24L21,-22Q23,-46 15,-64Z') +
        P('sc-fig-d', 'M-5,-88Q5,-98 15,-88L13,-70Q0,-66 -9,-48L-24,-8L-36,0L-30,-32Q-23,-72 -5,-88Z') +
        P('sc-fig-l', 'M-5,-88Q-21,-70 -28,-34L-23,-36Q-17,-66 -1,-84Z', ' opacity=".6"') +
        P('sc-accent', 'M3,-87Q10,-93 15,-87L14,-73L18,-58L6,-60L4,-72Z') +
        P('sc-skin', 'M8,-85H14.5L17.5,-79.5L14.8,-78L14.5,-73.5Q10,-72 8,-74Z') +
        S('st-d', 'M4,-64L18,-56L27,-62', 9) +
        P('sc-skin', 'M24.5,-60L27,-76L31.5,-75.5L31,-58Z')
      );
    if (v === 'turban')
      return (
        P('sc-fig-d', 'M-15,-98Q-23,-94 -25,-82L-32,0H32L25,-82Q23,-94 15,-98L7,-101H-7Z') +
        P('sc-fig-m', 'M-6,-100H6L11,0H-11Z') +
        S('st-d', 'M17,-92L30,-100L33,-116', 10) +
        P('sc-skin', 'M28.5,-116L29.5,-128Q33.5,-131 37.5,-127.5L37,-115Z') +
        C('sc-skin', 0, -108, 8.5) +
        P('sc-fig-l', 'M-8.6,-108Q-10,-92 0,-84Q10,-92 8.6,-108Q5,-102 0,-103Q-5,-102 -8.6,-108Z') +
        P('sc-fig-d', 'M-14,-111Q-19,-124 -8,-131Q0,-135 8,-131Q19,-124 14,-111Q0,-117 -14,-111Z') +
        S('st-l', 'M-13,-118Q-2,-129 9,-128', 3)
      );
    return (
      S('st-d', 'M-31,0V-136', 4.5) +
      C('sc-fig-d', -31, -137, 4.5) +
      P('sc-fig-d', 'M-14,-100Q-21,-97 -22,-88L-30,0H30L22,-88Q21,-97 14,-100L7,-103H-7Z') +
      P('sc-fig-m', 'M-20,-98Q-25,-84 -22,-74Q0,-64 22,-74Q25,-84 20,-98L7,-103H-7Z') +
      P('sc-accent', 'M-4.5,-102H4.5L7,0H-7Z') +
      S('st-d', 'M-17,-93L-27,-80L-30,-72', 9) +
      C('sc-skin', -31, -72, 5.2) +
      S('st-d', 'M17,-93L30,-102L33,-117', 9) +
      P('sc-skin', 'M28.5,-117L29.5,-129Q33.5,-132 37.5,-128.5L37,-116Z') +
      B('sc-skin-d', -4, -106, 8, 5) +
      C('sc-skin', 0, -111, 8.5) +
      P('sc-fig-d', 'M-8.9,-110Q-10,-116 -6,-118L-5,-113ZM8.9,-110Q10,-116 6,-118L5,-113Z') +
      P('sc-accent', 'M-7.5,-116Q0,-125 7.5,-116Q0,-119 -7.5,-116Z')
    );
  });

  // 100 x 123. Helmeted infantryman advancing right, rifle and bayonet forward.
  // :guard = standing at attention in a greatcoat, rifle slung (52 x 140).
  D.part('soldier', ({ v }) =>
    v === 'guard'
      ? S('st-d', 'M15,-58L24,-134', 4) +
        S('st-l', 'M24,-134L25.5,-146', 3) +
        P('sc-fig-d', 'M-13,-24H-3L-2,0H-18Q-18,-5 -13,-6ZM3,-24H13L13,-6Q18,-5 18,0H2Z') +
        P('sc-fig-d', 'M-17,-100Q-22,-98 -23,-90L-25,-58Q-25,-52 -22,-50L-24,-20H24L22,-50Q25,-52 25,-58L23,-90Q22,-98 17,-100L8,-104H-8Z') +
        P('sc-fig-m', 'M-16,-94L-21,-56L-17,-53L-13,-90ZM16,-94L21,-56L17,-53L13,-90Z') +
        B('sc-fig-l', -19, -66, 38, 5) +
        B('sc-accent', -3.5, -67, 7, 7) +
        S('st-l', 'M-9,-102L14,-68', 3) +
        B('sc-skin-d', -4, -107, 8, 5) +
        C('sc-skin', 0, -111, 8.5) +
        P('sc-fig-d', 'M-12,-112Q-12,-125 0,-125Q12,-125 12,-112L14,-109.5H-14Z') +
        S('st-l', 'M-7,-119Q-2,-123 4,-122', 3)
      : // pack, back leg, body, front leg, arms and rifle
        P('sc-fig-d', 'M-19,-97L-6,-100L-9,-70L-22,-72Z') +
        P('sc-fig-l', 'M-19,-97L-15,-98L-18,-71L-22,-72Z', ' opacity=".7"') +
        S('st-d', 'M-5,-58L-16,-31L-31,-8', 11) +
        P('sc-fig-d', 'M-39,-9L-27,-13L-24,0H-37Z') +
        P('sc-fig-d', 'M-7,-99L15,-96L9,-55L-15,-58Z') +
        S('st-d', 'M-1,-58L16,-33L14,-6', 11) +
        P('sc-fig-d', 'M8,-8H20L27,0H8Z') +
        P('sc-fig-l', 'M-13,-63L9.5,-60.5L9,-56L-14,-58.5Z') +
        S('st-d', 'M-7,-70L10,-76', 7.5) +
        S('st-d', 'M-9,-69L52,-92', 4.5) +
        S('st-paper', 'M52,-92L64,-96.5', 3) +
        S('st-d', 'M4,-93L7,-76', 8) +
        S('st-d', 'M11,-94L31,-84', 8) +
        C('sc-skin', 8, -75.5, 3.8) +
        C('sc-skin', 32, -84.5, 3.8) +
        mask(5, -107) +
        P('sc-fig-d', 'M-7,-110Q-6,-122 6,-122Q17,-122 18,-111L21,-108H-9Z') +
        S('st-l', 'M-1,-117Q4,-120 10,-119', 3),
  );

  // 92 x 160. Fighter in a soft hat, legs apart, one arm holding a rifle overhead.
  D.part(
    'guerrilla',
    () =>
      P('sc-fig-d', 'M-14,-60L-23,-4H-10L-2,-44H2L10,-4H23L14,-60Z') +
      P('sc-fig-d', 'M-27,0Q-27,-6 -21,-7H-9V0ZM9,0V-7H21Q27,-6 27,0Z') +
      P('sc-fig-d', 'M-17,-98Q0,-104 17,-98L14,-56H-14Z') +
      S('st-l', 'M-13,-97L11,-62', 4) +
      B('sc-fig-l', -14, -62, 28, 4.5) +
      S('st-d', 'M-17,-95L-29,-78L-19,-63', 9.5) +
      C('sc-skin', -18.5, -62, 4.6) +
      S('st-d', 'M17,-95L28,-116L27,-140', 9.5) +
      // rifle: stock, body, curved magazine, barrel
      P('sc-fig-d', 'M-9,-153L-31,-150L-29,-140L-8,-146Z') +
      S('st-d', 'M-10,-150L40,-140', 6) +
      S('st-d', 'M40,-140L61,-136', 3.5) +
      P('sc-fig-d', 'M30,-140Q37,-130 33,-121L26,-123Q29,-131 23,-141Z') +
      P('sc-fig-d', 'M55,-140.5L58,-145L60.5,-144.5L59,-139.5Z') +
      C('sc-skin', 27, -144, 5.2) +
      B('sc-skin-d', -4, -106, 8, 5) +
      C('sc-skin', 0, -110, 8.5) +
      P('sc-fig-d', 'M-18,-114Q0,-120 18,-114Q15,-110.5 0,-111.5Q-15,-110.5 -18,-114Z') +
      P('sc-fig-d', 'M-9.5,-115Q-10,-126 0,-126Q10,-126 9.5,-115Z') +
      S('st-l', 'M-9,-116.5Q0,-118.5 9,-116.5', 3),
  );

  // 112 x 112. Fighter kneeling, aiming a shoulder-fired tube up and to the right.
  D.part(
    'launcher',
    () =>
      S('st-d', 'M-14,-36L-8,-5L-40,-5', 11) +
      P('sc-fig-d', 'M-48,-12L-38,-12L-36,0H-48Z') +
      P('sc-fig-d', 'M-22,-38L-12,-78L8,-76L2,-34Z') +
      S('st-d', 'M-10,-37L21,-37L22,-6', 11) +
      P('sc-fig-d', 'M16,-8H28L35,0H16Z') +
      S('st-l', 'M-17,-58L4,-55', 3.5) +
      // tube, grip and sight
      S('st-d', 'M-43,-61L59,-109', 9.5) +
      S('st-d', 'M50,-105L62,-110.5', 13, ' stroke-linecap="butt"') +
      S('st-l', 'M-38,-66L46,-105.5', 3) +
      P('sc-fig-d', 'M9,-83L19,-88L26,-75L17,-71Z') +
      P('sc-fig-d', 'M24,-98L30,-109L35,-106.5L31,-98Z') +
      S('st-d', 'M-2,-74L13,-64L22,-82', 8) +
      C('sc-skin', 22, -83, 4.2) +
      mask(3, -89) +
      P('sc-fig-d', 'M-10,-93Q-10,-103 4,-103Q16,-103 16,-95L16,-93H2L-4,-86Q-8,-86 -10,-93Z') +
      S('st-l', 'M-6,-96.5H14', 3),
  );

  // 250 x 158. Six marchers behind one wide banner, two placards above them.
  D.part('marchers', ({ r }) => {
    let back = '';
    let front = '';
    const xs = [-100, -61, -21, 20, 60, 100];
    xs.forEach((x0, i) => {
      const x = x0 + (r() - 0.5) * 6;
      const h = 105 + r() * 11;
      const k = i % 2 ? 1 : -1;
      back += S('st-d', `M${f(x - 5)},-56L${f(x - 8 - 5 * k)},-3`, 10) + S('st-d', `M${f(x + 5)},-56L${f(x + 8 + 5 * k)},-3`, 10);
      back += P('sc-fig-d', `M${f(x - 15)},${f(-h + 14)}Q${f(x)},${f(-h + 8)} ${f(x + 15)},${f(-h + 14)}L${f(x + 12)},-52H${f(x - 12)}Z`);
      back += C('sc-skin', x, -h, 8);
      const hat = r();
      if (hat < 0.4) back += P('sc-fig-d', `M${f(x - 10)},${f(-h - 2)}Q${f(x - 9)},${f(-h - 12)} ${f(x)},${f(-h - 12)}Q${f(x + 10)},${f(-h - 12)} ${f(x + 10)},${f(-h - 3)}L${f(x + 14)},${f(-h - 1.5)}H${f(x - 10)}Z`);
      else back += P('sc-fig-d', `M${f(x - 8.4)},${f(-h - 1)}Q${f(x - 9)},${f(-h - 11)} ${f(x)},${f(-h - 10.5)}Q${f(x + 9)},${f(-h - 11)} ${f(x + 8.4)},${f(-h - 1)}Q${f(x)},${f(-h - 7)} ${f(x - 8.4)},${f(-h - 1)}Z`);
      if (i === 0 || i === 3) {
        back += S('st-d', `M${f(x - 13)},${f(-h + 16)}L${f(x - 21)},${f(-h - 10)}`, 8) + C('sc-skin', x - 21.5, -h - 15, 5);
      }
      front += C('sc-skin', x - 12, -79, 4) + C('sc-skin', x + 12, -79, 4);
    });
    const placard = (x, y, rot) =>
      S('st-d', `M${x},-80L${x},${y + 10}`, 3.5) +
      G(`translate(${x} ${y}) rotate(${rot})`, B('sc-fig-d', -26, -19, 52, 38, 2) + B('sc-accent', -23, -16, 46, 32, 1) + B('sc-fig-d', -16, -9, 32, 5) + B('sc-fig-d', -16, 1, 22, 5));
    return (
      placard(-42, -137, -5) +
      placard(81, -131, 6) +
      back +
      P('sc-hot', 'M-124,-80Q-60,-74 0,-79Q60,-84 124,-78L123,-44Q60,-50 0,-45Q-60,-40 -123,-46Z') +
      P('sc-accent', 'M-124,-68Q-60,-62 0,-67Q60,-72 124,-66L123.7,-58Q60,-64 0,-59Q-60,-54 -123.7,-60Z') +
      P('sc-ink', 'M-66,-74.5L-58,-74.8L-57,-40.6L-65,-40.2ZM28,-80.6L37,-81.4L38,-47.6L29,-46.8Z', ' opacity=".16"') +
      front
    );
  });

  // 104 x 80. Figure in a conical hat bending to plant.  :stand = upright with a sheaf (70 x 132).
  D.part('farmer', ({ v }) =>
    v === 'stand'
      ? P('sc-fig-d', 'M-13,-56L-15,-4H-4L-1,-40H1L4,-4H15L13,-56Z') +
        P('sc-fig-d', 'M-18,0Q-18,-5 -13,-5H-3V0ZM3,0V-5H13Q18,-5 18,0Z') +
        P('sc-fig-d', 'M-16,-97Q0,-102 16,-97L17,-52H-17Z') +
        // the sheaf, in the crook of one arm
        G('rotate(22 24 -60)', P('sc-accent', 'M19,-34L21,-78L8,-114L15,-110L18,-123L24,-114L30,-126L34,-115L42,-120L29,-78L29,-34Z') + B('sc-fig-l', 19, -83, 12, 6)) +
        S('st-d', 'M-16,-93L-24,-72L-17,-56', 9) +
        C('sc-skin', -16.5, -55, 4.4) +
        S('st-d', 'M16,-93L36,-80L26,-66', 9) +
        C('sc-skin-d', 25, -65, 4.4) +
        C('sc-skin', 0, -108, 8) +
        P('sc-accent', 'M-30,-108L0,-131L30,-108Q0,-113 -30,-108Z') +
        P('sc-fig-l', 'M0,-131L30,-108Q16,-110.5 6,-111.2Z', ' opacity=".6"')
      : S('st-d', 'M-12,-48L-17,-4', 10.5) +
        S('st-d', 'M-5,-48L2,-4', 10.5) +
        P('sc-fig-d', 'M-23,0V-5H-11V0ZM-3,0V-5H9Q12,-2 12,0Z') +
        P('sc-fig-d', 'M-19,-57Q6,-66 32,-54L30,-36Q8,-41 -9,-38Z') +
        S('st-d', 'M30,-44L45,-9', 7.5) +
        C('sc-skin', 45.5, -7, 4) +
        S('st-d', 'M25,-42L33,-18', 7.5) +
        C('sc-skin', 33.5, -16, 4) +
        P('sc-skin', 'M32,-48H46L44,-38Q39,-35 34,-39Z') +
        P('sc-accent', 'M8,-51L37,-73L64,-42Q36,-52 8,-51Z') +
        P('sc-fig-l', 'M37,-73L64,-42Q52,-46.5 42,-49Z', ' opacity=".6"') +
        S('st-paper', 'M53,0L50,-13M53,0L55,-14M53,0L59,-11', 3) +
        S('st-paper', 'M-33,0L-36,-12M-33,0L-31,-14M-33,0L-27,-11', 3) +
        S('st-paper', 'M72,0L69,-11M72,0L74,-12M72,0L78,-9', 3),
  );

  // 80 x 152. Trumpet player leaning back, the horn raised up and to the right.
  D.part(
    'musician',
    () =>
      S('st-d', 'M-6,-58L-10,-4', 11) +
      S('st-d', 'M-3,-58L17,-32L15,-4', 11) +
      P('sc-fig-d', 'M-17,0V-6H-4L-2,0ZM9,0V-6H21L27,0Z') +
      P('sc-fig-d', 'M-25,-100L-5,-103L7,-56L-15,-54Z') +
      P('sc-fig-l', 'M-9,-101L-5,-103L0,-84L-4,-83Z', ' opacity=".8"') +
      // trumpet
      S('st-paper', 'M-3,-113L40,-137', 4) +
      P('sc-accent', 'M36.5,-131.5L39.5,-138.5L45,-151L55,-133.5Z') +
      B('sc-accent', -5, -7, 13, 9, 1.5, ' transform="translate(17 -121) rotate(-29)"') +
      S('st-d', 'M-14,-96L3,-99L15,-119', 8.5) +
      S('st-d', 'M-19,-95L-6,-104L8,-115', 8.5) +
      C('sc-skin', 16, -121.5, 4.4) +
      C('sc-skin', 8, -116.5, 4.2) +
      G('rotate(-16 -14 -112)', mask(-17, -112) + P('sc-fig-d', 'M-27.5,-117H-4L-3.5,-119.5H-27ZM-25,-119Q-25,-127 -15.5,-127Q-6.5,-127 -6.5,-119Z') + P('sc-fig-d', 'M-18,-119L-26,-113Q-27,-106 -21,-103Z')),
  );

  // 150 x 124. Two men in suits shaking hands.
  D.part(
    'handshake',
    () =>
      // the taller man, left
      P('sc-fig-d', 'M-60,-58L-63,-4H-52L-48,-44L-44,-4H-33L-36,-58Z') +
      P('sc-fig-d', 'M-66,0V-6H-52V0ZM-45,0V-6H-33L-27,0Z') +
      P('sc-fig-d', 'M-62,-100Q-48,-106 -34,-100L-33,-54H-63Z') +
      P('sc-accent', 'M-41,-103L-36,-100L-37,-84Z') +
      S('st-d', 'M-40,-96L-22,-84L-5,-79', 9.5) +
      P('sc-accent', 'M-12.5,-85.5L-9,-84.5L-10.5,-74.5L-14,-75.5Z') +
      profile(-48, -113) +
      // the stockier man, right, in a hat
      P('sc-fig-d', 'M34,-54L32,-4H44L48,-40L52,-4H64L63,-54Z') +
      P('sc-fig-d', 'M27,0L32,-6H45V0ZM52,0V-6H66V0Z') +
      P('sc-fig-d', 'M33,-95Q48,-101 65,-95L67,-50H31Z') +
      P('sc-accent', 'M40,-98L35,-95L36.5,-80Z') +
      S('st-d', 'M39,-91L22,-82L5,-79', 10) +
      P('sc-accent', 'M12.5,-85.5L9,-84.5L10.5,-74.5L14,-75.5Z') +
      G('translate(96 0) scale(-1 1)', mask(47, -107)) +
      P('sc-fig-d', 'M58,-110Q58,-121 49,-121Q40,-121 40,-110L34,-109.5V-107H62V-109.5Z') +
      P('sc-skin', 'M-7,-84Q0,-87 7,-84L8,-76Q0,-72 -8,-76Z'),
  );

  // 344 x 106. A long table seen from the front, five delegates behind it, small flags on it.
  D.part('delegates', ({ r }) => {
    let s = '';
    [-124, -62, 0, 62, 124].forEach((x, i) => {
      const y = -90 - (i === 2 ? 4 : r() * 3);
      s += P('sc-fig-d', `M${x - 23},-48L${x - 18},${y + 17}Q${x - 16},${y + 10} ${x - 7},${y + 9}H${x + 7}Q${x + 16},${y + 10} ${x + 18},${y + 17}L${x + 23},-48Z`);
      s += P('sc-accent', `M${x - 5},${y + 9}L${x},${y + 21}L${x + 5},${y + 9}Z`);
      s += C('sc-skin', x, y, 8.5);
      if (i === 1) s += P('sc-fig-d', `M${x - 14},${f(y - 3)}Q${x},${f(y - 7)} ${x + 14},${f(y - 3)}Q${x + 13},${f(y - 6)} ${x + 8.5},${f(y - 6.5)}L${x + 8},${f(y - 13)}Q${x},${f(y - 17)} ${x - 8},${f(y - 13)}L${x - 8.5},${f(y - 6.5)}Q${x - 13},${f(y - 6)} ${x - 14},${f(y - 3)}Z`);
      else if (i === 3) s += P('sc-fig-d', `M${x - 9},${f(y + 1)}Q${x - 11},${f(y - 7)} ${x - 5},${f(y - 9)}L${x - 4},${f(y - 3)}ZM${x + 9},${f(y + 1)}Q${x + 11},${f(y - 7)} ${x + 5},${f(y - 9)}L${x + 4},${f(y - 3)}Z`);
      else s += P('sc-fig-d', `M${f(x - 8.9)},${f(y - 1)}Q${x - 10},${f(y - 12)} ${x},${f(y - 11.5)}Q${x + 10},${f(y - 12)} ${f(x + 8.9)},${f(y - 1)}Q${x + 3},${f(y - 6)} ${x - 2},${f(y - 5.5)}Q${x - 7},${f(y - 5)} ${f(x - 8.9)},${f(y - 1)}Z`);
    });
    // the table: a paper top, a dark cloth with folds
    s += P('sc-fig-d', 'M-168,-46H168L162,0H-162Z');
    for (let i = 0; i < 7; i++) s += P('sc-fig-m', `M${-150 + i * 46},-46h22l-2,46h-18Z`);
    s += B('sc-accent', -172, -55, 344, 10, 2);
    [-93, -31, 31, 93].forEach((x, i) => {
      s += S('st-d', `M${x},-55V-82`, 3) + P(i % 2 ? 'sc-accent' : 'sc-hot', `M${x + 1.5},-82h15l-3,5l3,5h-15Z`);
    });
    return s;
  });

  // 76 x 163. Worker in a flat cap, legs apart, a wrench in the raised fist.
  D.part(
    'worker',
    () =>
      P('sc-fig-d', 'M-14,-60L-23,-4H-10L-2,-44H2L10,-4H23L14,-60Z') +
      P('sc-fig-d', 'M-27,0Q-27,-6 -21,-7H-9V0ZM9,0V-7H21Q27,-6 27,0Z') +
      P('sc-fig-d', 'M-17,-98Q0,-104 17,-98L14,-56H-14Z') +
      P('sc-fig-l', 'M-9,-88H9L11,-58H-11Z') +
      S('st-l', 'M-8,-87L-12,-99M8,-87L12,-99', 3.5) +
      S('st-d', 'M-17,-95L-30,-79L-18,-63', 9.5) +
      C('sc-skin', -17.5, -62, 4.6) +
      // wrench
      S('st-d', 'M25,-128V-146', 6, ' stroke-linecap="butt"') +
      P('sc-fig-d', 'M21,-164.5L16.5,-160A10.5,10.5 0 1 0 33.5,-160L29,-164.5V-155H21Z') +
      S('st-d', 'M17,-95L27,-114L25,-130', 10) +
      P('sc-accent', 'M19.5,-126L31,-125V-120.5L19.5,-121.5Z') +
      C('sc-skin', 25, -133, 6.4) +
      B('sc-skin-d', -4, -106, 8, 5) +
      C('sc-skin', 0, -110, 8.5) +
      P('sc-fig-d', 'M-10,-112Q-10,-123 1,-123Q12,-123 13,-115L17.5,-112.5V-111H-10Z') +
      S('st-l', 'M-6,-118Q0,-121 7,-119', 3),
  );

  // 70 x 128. Trench coat with the collar up, a fedora, a briefcase. Walks right.
  D.part(
    'spy',
    () =>
      S('st-d', 'M-7,-32L-15,-5', 9.5) +
      S('st-d', 'M5,-32L13,-5', 9.5) +
      P('sc-fig-d', 'M-22,0L-19,-7H-8V0ZM7,0V-7H17L24,0Z') +
      P('sc-fig-d', 'M-12,-100Q-19,-96 -19,-86L-25,-30H19L15,-62L17,-86Q17,-97 9,-101Z') +
      P('sc-fig-m', 'M2,-100L9,-101Q17,-97 17,-86L15,-62L19,-30H8L5,-62Z') +
      B('sc-fig-l', -21.5, -67, 38, 4.5) +
      B('sc-accent', -3, -68.5, 7, 7.5) +
      // the arm and the case
      S('st-d', 'M7,-92L13,-70L22,-52', 9) +
      P('sc-fig-d', 'M12,-48H44V-24H12Z') +
      S('st-d', 'M22,-48V-53H34V-48', 3) +
      B('sc-accent', 25.5, -48, 5, 5) +
      B('sc-fig-l', 12, -41, 32, 3) +
      mask(-1, -109) +
      // collar up, hat down
      P('sc-fig-d', 'M-13,-99L-12,-112L-1,-103L2,-98ZM10,-99L10.5,-109L4,-103L2,-98Z') +
      P('sc-fig-d', 'M-18,-112Q-2,-118 18,-110V-108Q-2,-115 -18,-109ZM-10,-113Q-11,-127 -1,-127Q9,-127 9,-112Z') +
      P('sc-fig-l', 'M-10.3,-116.6Q0,-119 9.2,-114.6L9,-112Q0,-116 -10,-113.8Z'),
  );

  // 62 x 124. Spacesuit and backpack.  :float = drifting on a tether, drawn round its centre (150 x 150).
  D.part('astronaut', ({ v }) => {
    const helmet = C('sc-accent', 0, -108, 14.5) + P('sc-fig-d', 'M-10.5,-109Q-10.5,-118 0,-118Q10.5,-118 10.5,-109Q10.5,-100 0,-100Q-10.5,-100 -10.5,-109Z') + P('sc-hot', 'M-7,-111Q-5,-115.5 1,-115.5L0,-113Q-4,-113 -5,-109.5Z');
    const chest = B('sc-fig-l', -9, -84, 18, 13, 2) + C('sc-fig-d', -4, -77.5, 2) + C('sc-hot', 3.5, -77.5, 2.2);
    if (v === 'float')
      return (
        S('st-paper', 'M-6,2Q-40,44 -70,22Q-98,2 -86,-34', 3.2) +
        G(
          'rotate(-24) translate(0 74)',
          B('sc-fig-l', -22, -106, 44, 46, 5) +
            // legs, bent and apart
            S('st-paper', 'M-9,-54L-22,-30L-14,-8', 15, ' stroke-linecap="butt"') +
            S('st-paper', 'M9,-54L26,-36L40,-16', 15, ' stroke-linecap="butt"') +
            B('sc-fig-l', -8, -5, 16, 9, 2, ' transform="translate(-14 -6) rotate(-20)"') +
            B('sc-fig-l', -8, -5, 16, 9, 2, ' transform="translate(42 -14) rotate(-48)"') +
            P('sc-accent', 'M-18,-93Q-20,-70 -17,-50H17Q20,-70 18,-93Z') +
            // arms, one up, one out
            S('st-paper', 'M-16,-88L-36,-98L-44,-120', 13, ' stroke-linecap="butt"') +
            S('st-paper', 'M16,-88L38,-80L56,-90', 13, ' stroke-linecap="butt"') +
            C('sc-fig-l', -45, -124, 6) +
            C('sc-fig-l', 60, -92, 6) +
            chest +
            helmet,
        )
      );
    return (
      B('sc-fig-l', -22, -106, 44, 46, 5) +
      P('sc-accent', 'M-18,-54L-20,-8H-4L-2,-42H2L4,-8H20L18,-54Z') +
      P('sc-fig-l', 'M-24,0V-9H-3V0ZM3,0V-9H24V0Z') +
      P('sc-fig-l', 'M-19.5,-31H-3.4L-3.7,-27H-19.7ZM3.4,-31H19.5L19.7,-27H3.7Z', ' opacity=".7"') +
      P('sc-accent', 'M-18,-93Q-20,-70 -17,-50H17Q20,-70 18,-93Z') +
      P('sc-accent', 'M-17,-93Q-29,-90 -30,-74L-32,-54Q-27,-49 -21,-53L-19,-74ZM17,-93Q29,-90 30,-74L32,-54Q27,-49 21,-53L19,-74Z') +
      C('sc-fig-l', -27, -50, 6) +
      C('sc-fig-l', 27, -50, 6) +
      chest +
      helmet
    );
  });

  // 100 x 166. Torch-bearer running right, the torch raised.
  D.part(
    'runner',
    () =>
      S('st-d', 'M-6,-62L-22,-34L-46,-42', 10.5) +
      P('sc-fig-d', 'M-52,-50L-43,-47L-47,-36L-55,-39Z') +
      S('st-d', 'M-10,-84L-24,-72', 8) +
      S('st-d', 'M-2,-94L-14,-82L-24,-72', 8) +
      C('sc-skin', -25, -71, 4.2) +
      P('sc-fig-d', 'M0,-100L20,-96L8,-58L-13,-62Z') +
      P('sc-accent', 'M-1.5,-95.5L19,-92L14.5,-78L-6,-82Z') +
      S('st-d', 'M-2,-62L22,-44L31,-10', 10.5) +
      P('sc-fig-d', 'M25,-10H37L45,-1L44,0H26Z') +
      // torch arm
      S('st-d', 'M14,-95L31,-108L36,-126', 8.5) +
      P('sc-fig-d', 'M33,-124H40L45,-146H28Z') +
      B('sc-fig-l', 28, -147, 17, 4) +
      P('sc-hot', 'M36.5,-147Q22,-158 33,-176Q35,-166 41,-171Q52,-158 36.5,-147Z') +
      P('sc-accent', 'M36.5,-147Q30,-154 35,-163Q41,-155 36.5,-147Z') +
      C('sc-skin', 36.5, -127, 4.6) +
      profile(18, -110),
  );

  /* ------------------------------------------------------------------ objects */

  // Pole 207 tall, the flag 110 x 70 at its top, flying right.  :paper and :dark change the cloth.
  D.part('flag', ({ v }) => {
    const field = v === 'paper' ? 'sc-paper' : v === 'dark' ? 'sc-fig-d' : 'sc-hot';
    const band = v === 'paper' ? 'sc-hot' : 'sc-paper';
    const N = 12;
    const top = [];
    const bot = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const y = -198 + 7 * Math.sin(0.5 + t * Math.PI * 2.2) * (0.2 + 0.8 * t) + t * 3;
      top.push([3 + t * 108, y]);
      bot.push([3 + t * 108, y + 64 * (1 - 0.07 * t)]);
    }
    const at = (i, k) => [top[i][0], top[i][1] + (bot[i][1] - top[i][1]) * k];
    const strip = (k0, k1, i0 = 0, i1 = N) => {
      let d = '';
      for (let i = i0; i <= i1; i++) d += (i > i0 ? 'L' : 'M') + at(i, k0).map(f).join(',');
      for (let i = i1; i >= i0; i--) d += 'L' + at(i, k1).map(f).join(',');
      return d + 'Z';
    };
    return (
      B('sc-fig-d', -2.5, -204, 5, 204) +
      C('sc-fig-d', 0, -206, 4.5) +
      P(field, strip(0, 1)) +
      P(band, strip(0.56, 0.8)) +
      P('sc-ink', strip(0, 1, 3, 4) + strip(0, 1, 7, 8) + strip(0, 1, 10, 11), ' opacity=".15"')
    );
  });

  // 262 x 126. A wide blank banner strung between two poles.
  D.part(
    'banner',
    () =>
      S('st-d', 'M-127,0V-122M127,0V-122', 5) +
      C('sc-fig-d', -127, -124, 4.5) +
      C('sc-fig-d', 127, -124, 4.5) +
      P('sc-hot', 'M-126,-116Q-60,-108 0,-113Q62,-118 126,-112L126,-62Q62,-68 0,-63Q-60,-58 -126,-66Z') +
      P('sc-paper', 'M-126,-80Q-60,-72 0,-77Q62,-82 126,-76L126,-68.5Q62,-74.5 0,-69.5Q-60,-64.5 -126,-72.5Z') +
      P('sc-ink', 'M-78,-110.4L-66,-109.5L-66,-59.6L-78,-60.4ZM22,-114.6L34,-115.6L34,-65.6L22,-64.6ZM92,-116L101,-115L101,-64.6L92,-65.4Z', ' opacity=".15"'),
  );

  // 150 x 196. A typed sheet, slightly turned; its lines are bars.
  D.part('paper', ({ r }) => {
    let lines = B('sc-fig-d', -52, -166, 62, 8) + B('sc-hot', -52, -151, 36, 5);
    let y = -132;
    for (let i = 0; i < 11; i++) {
      if (i === 4 || i === 8) y += 7;
      lines += B('sc-fig-d', -52, y, i === 3 || i === 7 || i === 10 ? 44 + r() * 30 : 92 + r() * 16, 4.6);
      y += 10.6;
    }
    return G('rotate(-6)', B('sc-fig-d', -64, -184, 138, 186, 2) + B('sc-accent', -70, -190, 138, 186, 2) + lines);
  });

  // 214 x 132. An open document with a ribbon seal, and a pen laid across it.
  D.part('treaty', ({ r }) => {
    let lines = B('sc-fig-d', -34, -104, 68, 7);
    for (let i = 0; i < 5; i++) lines += B('sc-fig-d', -74, -86 + i * 10.5, i === 4 ? 70 + r() * 30 : 140 + r() * 8, 4.4);
    return (
      G(
        'rotate(-4)',
        B('sc-fig-d', -86, -114, 184, 116, 2) +
          B('sc-accent', -92, -120, 184, 116, 2) +
          lines +
          B('sc-fig-d', -74, -18, 54, 3) +
          S('st-d', 'M-70,-24q6,-9 11,0t11,0t11,-2', 3) +
          // seal and ribbons
          P('sc-hot', 'M52,-30L44,2L54,-4L62,4L64,-28Z') +
          C('sc-hot', 58, -38, 16) +
          C('sc-accent', 58, -38, 7),
      ) +
      // pen
      G('translate(-34 -36) rotate(38)', B('sc-fig-d', -62, -5.5, 96, 11, 5.5) + P('sc-fig-d', 'M-60,-5.5L-84,0L-60,5.5Z') + P('sc-accent', 'M-70,-3.2L-84,0L-70,3.2Z') + B('sc-fig-l', 4, -5.5, 6, 11) + B('sc-fig-l', -30, -2, 30, 3))
    );
  });

  // 214 x 122. A rotary desk telephone, its cord trailing right.
  D.part('phone', () => {
    let holes = '';
    for (let i = 0; i < 9; i++) {
      const a = A.rad(-250 + i * 32);
      holes += C('sc-fig-d', 18.5 * Math.cos(a), -36 + 18.5 * Math.sin(a), 3.6);
    }
    return (
      S('st-d', 'M70,-10q9,-12 14,0t14,0t14,0', 4) +
      P('sc-fig-d', 'M-78,0L-69,-36Q-62,-64 -36,-72H36Q62,-64 69,-36L78,0Z') +
      P('sc-fig-m', 'M-66,-6L-59,-36Q-53,-58 -33,-64H-12Q-38,-52 -44,-6Z') +
      B('sc-fig-d', -52, -84, 16, 14, 2) +
      B('sc-fig-d', 36, -84, 16, 14, 2) +
      // handset
      P('sc-fig-d', 'M-98,-92Q-102,-106 -88,-110Q0,-126 88,-110Q102,-106 98,-92L94,-80Q90,-72 78,-74L64,-78Q60,-92 42,-96Q0,-102 -42,-96Q-60,-92 -64,-78L-78,-74Q-90,-72 -94,-80Z') +
      S('st-l', 'M-80,-104Q0,-119 80,-104', 3.5) +
      // dial
      C('sc-accent', 0, -36, 27) +
      holes +
      C('sc-fig-d', 0, -36, 9) +
      C('sc-hot', 0, -36, 4.5)
    );
  });

  // 230 x 186. A king, a knight and a pawn on a strip of board.
  D.part('chess', () => {
    let board = '';
    for (let i = 0; i < 6; i++) {
      const x0 = -115 + i * 38.34;
      const t0 = -102 + i * 34;
      board += P(i % 2 ? 'sc-fig-d' : 'sc-accent', `M${f(x0)},0L${f(t0)},-20H${f(t0 + 34)}L${f(x0 + 38.34)},0Z`);
    }
    const KNIGHT = 'M20,-32Q10,-62 30,-84Q20,-100 27,-116L24,-134L38,-124Q58,-124 66,-104L80,-82Q83,-72 73,-70L55,-78Q49,-70 56,-60Q66,-46 64,-32Z';
    return (
      board +
      // king
      P('sc-fig-d', 'M-88,-20H-16L-21,-33H-83Z') +
      P('sc-fig-d', 'M-76,-33Q-60,-72 -63,-114H-41Q-44,-72 -28,-33Z') +
      B('sc-fig-d', -71, -122, 38, 9, 3) +
      P('sc-fig-d', 'M-66,-122L-71,-148Q-52,-155 -33,-148L-38,-122Z') +
      B('sc-fig-d', -55.5, -178, 7, 26) +
      B('sc-fig-d', -63, -171, 22, 7) +
      P('sc-fig-l', 'M-71,-33Q-56,-72 -59,-114H-53Q-50,-72 -63,-33Z', ' opacity=".8"') +
      P('sc-fig-l', 'M-64,-124L-68,-146Q-62,-149 -57,-150L-56,-124Z', ' opacity=".8"') +
      // knight, in paper with a black edge behind it
      P('sc-fig-d', KNIGHT, ' transform="translate(4 2)"') +
      P('sc-fig-d', 'M12,-20H78L73,-33H17Z') +
      P('sc-accent', KNIGHT) +
      P('sc-skin-d', 'M20,-32Q10,-62 30,-84Q20,-100 27,-116L24,-134L31,-129Q26,-112 36,-88Q22,-62 30,-32Z', ' opacity=".7"') +
      C('sc-fig-d', 50, -105, 3.2) +
      // pawn
      P('sc-fig-d', 'M82,-20H116L112,-31H86Z') +
      P('sc-fig-d', 'M89,-31Q97,-50 93.5,-64H104.5Q101,-50 109,-31Z') +
      B('sc-fig-d', 88.5, -70, 21, 6, 2) +
      C('sc-fig-d', 99, -81, 12) +
      P('sc-fig-l', 'M92,-87A9,9 0 0 1 99,-90.5V-87.5A6,6 0 0 0 94.6,-85Z', ' opacity=".8"')
    );
  });

  // 124 x 172. A table-tennis paddle and ball.
  D.part(
    'paddle',
    () =>
      G(
        'rotate(14)',
        P('sc-fig-d', 'M-13,-62L-15,-3Q-15,0 -12,0H12Q15,0 15,-3L13,-62Z') +
          C('sc-fig-d', 0, -112, 54) +
          P('sc-accent', 'M-10,-60L-12,-4H12L10,-60Z') +
          B('sc-fig-l', -2.5, -56, 5, 52) +
          C('sc-hot', 0, -112, 49) +
          P('sc-accent', 'M-17,-66Q0,-82 17,-66Q0,-61 -17,-66Z') +
          P('sc-ink', 'M-49,-112A49,49 0 0 0 34.6,-77.3A56,56 0 0 1 -49,-112Z', ' opacity=".18"'),
      ) +
      C('sc-fig-d', 74, -160, 12.5) +
      C('sc-accent', 72, -162, 11.5),
  );

  // 92 x 196. A raised hand holding up a ring of keys.
  D.part('keys', () => {
    const key = (rot) =>
      G(
        `translate(0 -124) rotate(${rot})`,
        P('sc-fig-d', 'M-3,-22H3V-66H-3Z') + P('sc-fig-d', 'M3,-66H13V-59H9V-55H13V-48H3Z') + S('st-d', 'M-7.5,-14A7.5,7.5 0 1 0 7.5,-14A7.5,7.5 0 1 0 -7.5,-14', 5),
      );
    return (
      key(-38) +
      key(0) +
      key(38) +
      S('st-d', 'M-12,-124A12,12 0 1 0 12,-124A12,12 0 1 0 -12,-124', 4.5) +
      P('sc-fig-d', 'M-15,0L-13,-80H13L15,0Z') +
      P('sc-fig-m', 'M2,-80H13L15,0H5Z') +
      B('sc-accent', -14, -90, 28, 11, 1.5) +
      P('sc-skin', 'M-13,-90V-110Q-13,-120 -4,-120H6Q14,-120 14,-110V-90Z') +
      P('sc-skin', 'M-13,-102Q-21,-106 -20,-114Q-16,-118 -11,-113Z') +
      P('sc-skin-d', 'M-6.5,-120H-4.5V-104H-6.5ZM0,-120H2V-104H0ZM6.5,-119.5H8.5V-104H6.5Z', ' opacity=".7"')
    );
  });
})();
