// 08 Agitprop: a constructivist poster in three inks, all diagonals and photomontage.
(function () {
  const A = window.CardArt;
  const RED = '#c8281e';
  const BLACK = '#15110e';
  const CREAM = '#efe4c6';

  function front(c) {
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>
    <clipPath id="d08-disc"><circle cx="282" cy="214" r="160"/></clipPath>
    <clipPath id="d08-field"><path d="M0,0H500V318L0,452Z"/></clipPath>
    <pattern id="d08-dots" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><circle cx="2.500" cy="2.500" r="1.050" fill="${BLACK}"/></pattern>
  </defs>
  <rect width="500" height="700" fill="${CREAM}" filter="url(#f-grit)"/>
  <g filter="url(#f-rough)">
    <path d="M0,0H500V318L0,452Z" fill="${RED}"/>
    <g fill="${BLACK}" clip-path="url(#d08-field)"><path d="${A.burst(282, 214, 520, 18, 172, 0.24, -70).slice(9, -3)}" opacity=".9"/></g>
    <circle cx="282" cy="214" r="174" fill="${BLACK}"/>
    <circle cx="282" cy="214" r="166" fill="${CREAM}"/>
  </g>
  <g clip-path="url(#d08-disc)">
    <svg x="122" y="54" width="320" height="320">${A.scene('84 122 440 440')}</svg>
    <rect x="122" y="54" width="320" height="320" fill="url(#d08-dots)" opacity=".2"/>
  </g>
  <circle cx="282" cy="214" r="160" fill="none" stroke="${BLACK}" stroke-width="2"/>

  <!-- title bar -->
  <g transform="rotate(-15 250 420)" filter="url(#f-rough)">
    <rect x="-60" y="372" width="640" height="84" fill="${BLACK}"/>
    <rect x="-60" y="462" width="640" height="9" fill="${RED}"/>
    <text x="250" y="436" text-anchor="middle" class="d08-title">${c.title.toUpperCase()}</text>
    <text x="470" y="490" text-anchor="end" class="d08-cyr">哈瓦那 · 1959年1月</text>
  </g>

  <text x="462" y="46" text-anchor="end" class="d08-no">№ ${c.no}</text>
  <text transform="translate(473 92) rotate(90)" class="d08-era">${c.era.toUpperCase()} · ${c.eraSpan}</text>

  <!-- rules block furniture -->
  <rect x="38" y="520" width="11" height="104" fill="${BLACK}" filter="url(#f-rough)"/>
  <g filter="url(#f-rough)"><rect x="0" y="642" width="500" height="58" fill="${RED}"/><path d="M0,636H500" stroke="${BLACK}" stroke-width="4"/></g>
  <path d="${A.starD(452, 596, 17)}" fill="${RED}" filter="url(#f-rough)"/>

  <!-- value -->
  <g filter="url(#f-rough)">
    <circle cx="72" cy="76" r="56" fill="${CREAM}"/><circle cx="72" cy="76" r="48" fill="${BLACK}"/>
    <text x="72" y="100" text-anchor="middle" class="d08-value">${c.value}</text>
  </g>
</svg>
<div class="abs d08-text"><p class="rules">${c.text}</p></div>
<div class="abs d08-note">${CardZh.highlight(c.note)}</div>
<div class="abs d08-print"></div>`;
  }

  function back() {
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs><clipPath id="d08b-disc"><circle cx="250" cy="330" r="150"/></clipPath></defs>
  <rect width="500" height="700" fill="${CREAM}" filter="url(#f-grit)"/>
  <g filter="url(#f-rough)">
    <path d="M0,700L500,300V700Z" fill="${BLACK}"/>
    <path d="M0,0H180L0,150Z" fill="${RED}"/>
    <g fill="${BLACK}"><path d="${A.burst(250, 330, 520, 20, 190, 0.2, -118).slice(9, -3)}"/></g>
    <circle cx="250" cy="330" r="184" fill="${CREAM}"/>
    <circle cx="250" cy="330" r="172" fill="${BLACK}"/>
    <circle cx="250" cy="330" r="150" fill="${RED}"/>
  </g>
  <g clip-path="url(#d08b-disc)"><path d="M100,330H400V480H100Z" fill="#000" opacity=".16"/></g>
  <g stroke="${CREAM}">${A.globe(250, 330, 104, 4)}</g>
  <path d="${A.starD(250, 330, 40)}" fill="${CREAM}" filter="url(#f-rough)"/>
  <path d="${A.starD(250, 330, 24)}" fill="${RED}"/>
  <g transform="rotate(-38.700 250 560)" filter="url(#f-rough)">
    <rect x="-80" y="548" width="660" height="56" fill="${RED}"/>
    <text x="250" y="590" text-anchor="middle" class="d08-band">1945 — 1989</text>
  </g>

  <text x="462" y="662" text-anchor="end" class="d08-cyr light">东方 · 西方</text>
</svg>
<div class="abs d08-print"></div>`;
  }

  window.CardDesigns = window.CardDesigns || [];
  window.CardDesigns.push({
    id: '08',
    name: 'Agitprop',
    concept: 'A constructivist poster in three inks: red, black and paper, all diagonals and photomontage.',
    notes: [
      ['Frame', 'No frame at all: a red field, a halftone photo disc, a black title bar on the slant.'],
      ['Value', 'A black disc with the number knocked out, top left.'],
      ['Back', 'Red sun, globe and star over a black diagonal.'],
      ['Type', 'Russo One headlines, Oswald text, a line of Cyrillic for colour.'],
    ],
    front,
    back,
  });
})();
