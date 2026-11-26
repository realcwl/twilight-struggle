// The deck's card: design 01 (Red Enamel) driven by data. One layout, four colourways, so the field
// colour alone says what kind of card it is: red Soviet, blue US, ivory neutral, black tally.
// front(card, uid) and back(uid) return the markup for one face; fit(face) sizes the title and rules
// once the face is in the page.
(function () {
  'use strict';
  const A = window.CardArt;
  const K = window.V2;
  const f = A.f;
  const E01 = window.CardDesigns.find((d) => d.key === 'e01');

  const SIDES = {
    ussr: { name: '苏联事件', type: '苏联事件', enamel: ['#d8242a', '#a50f18', '#55040a'], rays: '#15110e', raysO: 0.88, hair: '#f3d27a' },
    us: { name: '美国事件', type: '美国事件', enamel: ['#3b7bd0', '#1b4f9c', '#0a2452'], rays: '#081223', raysO: 0.8, hair: '#f3d27a' },
    neutral: { name: '中立事件', type: '中立事件', enamel: ['#fdf8e6', '#eadfbd', '#bfae80'], rays: '#15110e', raysO: 0.86, hair: '#a8842c' },
    tally: { name: '结算牌', type: '结算牌', enamel: ['#3a342f', '#1b1816', '#080706'], rays: '#c8962e', raysO: 0.36, hair: '#f3d27a' },
  };
  const ERAS = {
    early: { name: '冷战早期', span: '1945–1961', pips: 1 },
    middle: { name: '冷战中期', span: '1962–1978', pips: 2 },
    late: { name: '冷战晚期', span: '1979–1991', pips: 3 },
  };
  const note = (c) =>
    c.side === 'tally' ? '结算牌 · 必须在抽到的回合打出' : c.once ? '一次性事件 · 使用后移出游戏' : '可重复事件 · 使用后放入弃牌堆';

  const BAND = `<path fill-rule="evenodd" d="${K.band(7, 14, 19, 9)}" fill="url(#g-gold-d)" filter="url(#f-bevel)"/>`;
  const PLATE = 'M48,477.1L452,427.4V626H48Z';
  const ROSE = A.orderStar(74, 82, 31, 4, 0.3, 0.68);
  const FOOT = {
    ussr: A.starD(250, 656, 9),
    us: A.starD(250, 656, 9),
    neutral: 'M250,646L259,656L250,666L241,656Z',
    tally: A.orderStar(250, 656, 10.5, 4, 0.3, 0.68).d,
  };

  // one line up to 9 Chinese characters, two balanced lines beyond that; "|" in a title forces the break
  function titleLines(t) {
    if (t.includes('|')) return t.split('|');
    if (t.length <= 9) return [t];
    const words = /[\u3400-\u9fff]/.test(t) ? [...t] : t.split(' ');
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join('');
      const b = words.slice(i).join('');
      const score = Math.max(a.length, b.length);
      if (!best || score < best[0]) best = [score, a, b];
    }
    return best ? [best[1], best[2]] : [t];
  }
  function title(t) {
    const lines = titleLines(t.toUpperCase());
    const size = lines.length === 1 ? 48 : 33;
    const gap = size;
    return (
      '<g class="k-titles">' +
      lines.map((l, i) => `<text x="250" y="${f(392 + 0.36 * size + (lines.length === 1 ? 0 : (i - 0.5) * gap))}" text-anchor="middle" class="k-title" style="font-size:${size}px">${l}</text>`).join('') +
      '</g>'
    );
  }
  // era: one, two or three lit pips, top right
  function pips(n) {
    let s =
      '<rect x="402" y="41" width="64" height="22" rx="11" fill="#15110e" opacity=".85"/>' +
      '<rect x="402.6" y="41.6" width="62.800" height="20.800" rx="10.400" fill="none" stroke="#e9c766" stroke-opacity=".75" stroke-width="1.2"/>';
    for (let i = 0; i < 3; i++) s += `<circle cx="${418 + i * 16}" cy="52" r="4.6" fill="${i < n ? '#f1cd68' : 'none'}" stroke="#f1cd68" stroke-opacity="${i < n ? 1 : 0.45}" stroke-width="1.2"/>`;
    return s;
  }

  function front(c, p) {
    const S = SIDES[c.side];
    const era = ERAS[c.era];
    const where = `${c.place.toUpperCase()} · ${c.date.toUpperCase()}`;
    // the foot ornament sits midway between the number and the place, which is set from the right
    const ox = Math.min(250, (106 + 452 - where.length * 8.4) / 2);
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>
    <radialGradient id="${p}-enamel" cx=".5" cy=".3" r=".9"><stop offset="0" stop-color="${S.enamel[0]}"/><stop offset=".55" stop-color="${S.enamel[1]}"/><stop offset="1" stop-color="${S.enamel[2]}"/></radialGradient>
    <linearGradient id="${p}-cream" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf5e0"/><stop offset=".6" stop-color="#efe4c6"/><stop offset="1" stop-color="#dccb9f"/></linearGradient>
    <clipPath id="${p}-rays"><path d="M14,14H486V328L14,385Z"/></clipPath>
    <clipPath id="${p}-in"><rect x="14" y="14" width="472" height="672" rx="14"/></clipPath>
    <clipPath id="${p}-disc"><circle cx="250" cy="206" r="139"/></clipPath>
  </defs>
  <rect width="500" height="700" fill="url(#${p}-enamel)"/>
  <g clip-path="url(#${p}-rays)"><path d="${K.burstD(250, 206, 520, 18, 150, 0.24, -70)}" fill="${S.rays}" opacity="${S.raysO}"/></g>
  <rect x="29.5" y="29.5" width="441" height="641" rx="5" fill="none" stroke="${S.hair}" stroke-opacity=".7" stroke-width="1.2"/>
  ${pips(era.pips)}
  <g filter="url(#f-drop)"><circle cx="250" cy="206" r="160" fill="#15110e"/><circle cx="250" cy="206" r="153" fill="url(#g-gold)" filter="url(#f-bevel)"/></g>
  <g clip-path="url(#${p}-disc)"><svg x="111" y="67" width="278" height="278">${window.DeckArt.scene(c.art)}</svg><rect x="111" y="67" width="278" height="278" fill="url(#v2-dots)" opacity=".2"/></g>
  <circle cx="250" cy="206" r="139" fill="#000" filter="url(#f-inset)" opacity=".7"/>
  <circle cx="250" cy="206" r="139" fill="none" stroke="#15110e" stroke-width="2.5"/>

  <!-- rules plate, its top cut to the slant of the title -->
  <g filter="url(#f-drop)"><path fill-rule="evenodd" d="M40,470L460,418.4V634H40Z${PLATE}" fill="url(#g-gold)" filter="url(#f-bevel-s)"/></g>
  <path d="${PLATE}" fill="url(#${p}-cream)"/>
  <path d="${PLATE}" fill="#000" filter="url(#f-inset)" opacity=".3"/>
  <g transform="rotate(-7 62 496)">
    <text x="62" y="496" class="k-type hot">${S.type}</text>
    <text x="441" y="496" text-anchor="end" class="k-type">${era.name.toUpperCase()} · ${era.span}</text>
    <path d="M62,503.5H441" class="k-rule" stroke-width="1.5"/>
  </g>

  <!-- title bar -->
  <g clip-path="url(#${p}-in)"><g filter="url(#f-drop)"><g transform="rotate(-7 250 392)">
    <rect x="-40" y="351" width="580" height="82" fill="url(#g-gold)" filter="url(#f-bevel-s)"/>
    <rect x="-40" y="356" width="580" height="72" fill="#15110e"/>
    ${title(c.title)}
  </g></g></g>

  <text x="48" y="661" class="k-foot">№ ${c.no}</text>
  <text x="452" y="661" text-anchor="end" class="k-foot">${where}</text>
  <path d="${FOOT[c.side]}" transform="translate(${f(ox - 250)} 0)" fill="url(#g-gold)" filter="url(#f-bevel-s)"/>
  <circle cx="79" cy="92" r="48" fill="#000" opacity=".55" filter="url(#v2-blur-s)"/>
  ${BAND}
</svg>
<svg class="layer px" viewBox="0 0 500 700" style="--d:1cqw">
  <circle cx="74" cy="82" r="48" fill="url(#g-gold-d)" filter="url(#f-bevel)"/>
  <circle cx="74" cy="82" r="38" fill="#15110e"/>
  <path d="M46,72A30,30 0 0 1 92,56A36,36 0 0 0 46,72Z" fill="#fff" opacity=".22"/>
  <circle cx="74" cy="82" r="38" fill="none" stroke="#6b4508" stroke-width="1.5"/>
  ${c.side === 'tally' ? `<g filter="url(#f-bevel-s)"><path d="${ROSE.d}" fill="url(#g-gold-d)"/>${ROSE.facets}</g>` : `<text x="74" y="102" text-anchor="middle" class="k-value">${c.value}</text>`}
</svg>
<div class="abs txt"><p class="rules">${c.text}</p><p class="note">${CardZh.highlight(note(c))}</p></div>
<div class="abs v2-gloss"></div>`;
  }

  const back = (p) => E01.back(null, p);

  /** Call once the face is in the page and the fonts are loaded. */
  function fit(face) {
    const g = face.querySelector('.k-titles');
    if (g && !g.dataset.fit) {
      const texts = [...g.querySelectorAll('text')];
      const base = texts.length === 1 ? 48 : 33;
      const widest = Math.max(...texts.map((t) => t.getComputedTextLength()));
      if (widest > 0) {
        const size = Math.min(base, (base * 424) / widest);
        const gap = size;
        texts.forEach((t, i) => {
          t.style.fontSize = f(size) + 'px';
          t.setAttribute('y', f(392 + 0.36 * size + (texts.length === 1 ? 0 : (i - 0.5) * gap)));
        });
        g.dataset.fit = '1';
      }
    }
    const txt = face.querySelector('.txt');
    if (txt)
      for (const fs of [4.5, 4.2, 3.9, 3.7, 3.5, 3.3]) {
        txt.style.setProperty('--fs', fs + 'cqw');
        if (txt.scrollHeight <= txt.clientHeight + 1) break;
      }
  }

  const plain = (html) => html.replace(/<[^>]+>/g, '');
  /** One sentence for screen readers and captions. */
  const describe = (c) =>
    `№ ${c.no}, ${c.title}. ${SIDES[c.side].name}${c.side === 'tally' ? '' : ', value ' + c.value}, ${ERAS[c.era].name} ${ERAS[c.era].span}. ${plain(c.text)} ${note(c)}.`;

  window.DeckCard = { SIDES, ERAS, front, back, fit, note, describe, plain };
})();
