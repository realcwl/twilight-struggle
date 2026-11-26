// 07 Eyes Only: a manila file with a clipped photograph, a typed sheet and rubber stamps.
(function () {
  const A = window.CardArt;
  const RED = '#b3261e';
  const FOLDER = (p) => `
    <linearGradient id="${p}-manila" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3c686"/><stop offset=".5" stop-color="#d6b46c"/><stop offset="1" stop-color="#c9a45c"/></linearGradient>
    <pattern id="${p}-fibre" width="140" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(3)"><path d="M0,1H60M70,3H128M20,5H96" stroke="#8a6a2c" stroke-opacity=".13" stroke-width=".6"/></pattern>`;

  function front(c) {
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>
    ${FOLDER('d07')}
    <clipPath id="d07-photo"><rect x="72" y="92" width="356" height="232"/></clipPath>
    <path id="d07-ring" d="M70,70m-33,0a33,33 0 1,1 66,0a33,33 0 1,1 -66,0"/>
  </defs>
  <rect width="500" height="700" fill="url(#d07-manila)" filter="url(#f-grit)"/>
  <rect width="500" height="700" fill="url(#d07-fibre)"/>
  <path d="M0,16H300L318,0" fill="none" stroke="#7a5a22" stroke-opacity=".35" stroke-width="1.2"/>
  <path d="M10,0V700" stroke="#7a5a22" stroke-opacity=".25" stroke-width="1"/><path d="M12,0V700" stroke="#fff" stroke-opacity=".3" stroke-width="1"/>

  <!-- file label -->
  <g transform="rotate(-.8 310 44)" filter="url(#f-drop-s)">
    <rect x="150" y="26" width="322" height="38" fill="#f6f1e2"/>
    <rect x="150" y="26" width="322" height="6" fill="${RED}" opacity=".85"/>
    <text x="162" y="54" class="d07-typed">档案 ${c.no} · ${c.era.toUpperCase()} ${c.eraSpan}</text>
  </g>

  <!-- the photograph -->
  <g transform="rotate(-2.200 250 210)">
    <g filter="url(#f-drop)"><rect x="60" y="80" width="380" height="270" fill="#f4f1e6"/></g>
    <g clip-path="url(#d07-photo)">
      <svg x="72" y="92" width="356" height="232">${A.scene('0 146 600 391')}</svg>
      <rect x="72" y="92" width="356" height="232" fill="#8a8a8a" filter="url(#f-grit)" opacity=".4" style="mix-blend-mode:overlay"/>
    </g>
    <rect x="72" y="92" width="356" height="232" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="1"/>
    <text x="74" y="342" class="d07-caption">${c.place}, ${c.date}. 对象正向群众发表演说。</text>
    <!-- paper clip -->
    <g fill="none" stroke-linecap="round">
      <path d="M392,116V70A11,11 0 0 1 414,70V128A7,7 0 0 1 400,128V78" stroke="#3a3f44" stroke-opacity=".5" stroke-width="5" transform="translate(1.500 2)"/>
      <path d="M392,116V70A11,11 0 0 1 414,70V128A7,7 0 0 1 400,128V78" stroke="url(#g-steel-h)" stroke-width="3.6"/>
    </g>
  </g>
</svg>

<div class="abs d07-sheet">
  <span class="hole"></span><span class="hole b"></span>
  <p class="head">主题</p>
  <h3>${c.title.toUpperCase()}</h3>
  <p class="rules">${c.text}</p>
  <p class="src">来源： <i></i> &nbsp; 副本 2 / 4</p>
  <p class="note">${CardZh.highlight(c.note)}</p>
</div>

<svg class="layer d07-stamps" viewBox="0 0 500 700">
  <!-- value: a priority stamp -->
  <g filter="url(#f-stamp-l)" transform="rotate(-9 70 70)">
    <circle cx="70" cy="70" r="46" fill="none" stroke="${RED}" stroke-width="4.5"/>
    <circle cx="70" cy="70" r="26" fill="none" stroke="${RED}" stroke-width="1.6"/>
    <text class="d07-ring"><textPath href="#d07-ring" startOffset="2%">优先 · 优先 · 优先 ·</textPath></text>
    <text x="70" y="87" text-anchor="middle" class="d07-value">${c.value}</text>
  </g>
  <g filter="url(#f-stamp-l)" transform="rotate(-11 356 352)">
    <rect x="262" y="328" width="190" height="50" rx="4" fill="none" stroke="${RED}" stroke-width="4"/>
    <text x="357" y="366" text-anchor="middle" class="d07-stamp">限阅</text>
  </g>
  <ellipse cx="418" cy="634" rx="38" ry="36" fill="none" stroke="#6b4a1c" stroke-opacity=".2" stroke-width="5" filter="url(#f-stamp)"/>
</svg>`;
  }

  function back() {
    return `
<svg class="frame" viewBox="0 0 500 700">
  <defs>
    ${FOLDER('d07b')}
    <pattern id="d07b-stripe" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="16" fill="${RED}"/></pattern>
    <path id="d07b-ring" d="M250,330m-104,0a104,104 0 1,1 208,0a104,104 0 1,1 -208,0"/>
  </defs>
  <rect width="500" height="700" fill="url(#d07b-manila)" filter="url(#f-grit)"/>
  <rect width="500" height="700" fill="url(#d07b-fibre)"/>
  <path fill-rule="evenodd" d="M18,18H482V682H18ZM34,34V666H466V34Z" fill="url(#d07b-stripe)" opacity=".88"/>
  <rect x="18" y="18" width="464" height="664" fill="none" stroke="${RED}" stroke-width="1.4"/><rect x="34" y="34" width="432" height="632" fill="none" stroke="${RED}" stroke-width="1.4"/>

  <rect x="96" y="70" width="308" height="62" fill="#17130e"/>
  <text x="250" y="114" text-anchor="middle" class="d07-cover">机密</text>
  <text x="250" y="158" text-anchor="middle" class="d07-typed sm">本封面单独存放时不涉密</text>

  <!-- printed seal -->
  <g fill="none" stroke="#17130e">
    <circle cx="250" cy="330" r="128" stroke-width="3"/><circle cx="250" cy="330" r="121" stroke-width="1"/><circle cx="250" cy="330" r="88" stroke-width="1.4"/>
  </g>
  <text class="d07-seal"><textPath href="#d07b-ring" startOffset="0">分裂的世界 · 1945 · 1989 · 分裂的世界 ·</textPath></text>
  <g fill="#17130e">${A.laurel(250, 336, 70, 11, 0.24, 138)}<path d="${A.starD(250, 266, 11)}"/></g>
  <g stroke="#17130e">${A.globe(250, 336, 42, 1.8)}</g>

  <g class="d07-form"><text x="70" y="514">档案号 ____________</text><text x="430" y="514" text-anchor="end">副本 ____ / ____</text>
  <text x="70" y="544">请于 ____ 小时内归还档案室</text></g>

  <!-- string and button closure -->
  <g filter="url(#f-drop-s)"><circle cx="210" cy="606" r="17" fill="#9a5a34"/><circle cx="290" cy="606" r="17" fill="#9a5a34"/></g>
  <g fill="none" stroke="#5a2f18" stroke-opacity=".5"><circle cx="210" cy="606" r="11"/><circle cx="290" cy="606" r="11"/></g>
  <path d="M196,594C230,560 270,652 304,618C320,596 286,580 270,600C248,628 222,640 196,618C180,598 210,580 228,598" fill="none" stroke="#7a1712" stroke-width="2.6" stroke-linecap="round" filter="url(#f-drop-s)"/>
  ${A.rivet(210, 606, 3, 'brass')}${A.rivet(290, 606, 3, 'brass')}
</svg>
<svg class="layer" viewBox="0 0 500 700">
  <g filter="url(#f-stamp-l)" transform="rotate(-8 250 440)">
    <rect x="128" y="412" width="244" height="58" rx="4" fill="none" stroke="${RED}" stroke-width="4.5"/>
    <text x="250" y="456" text-anchor="middle" class="d07-stamp lg">限阅</text>
  </g>
</svg>`;
  }

  window.CardDesigns = window.CardDesigns || [];
  window.CardDesigns.push({
    id: '07',
    name: 'Eyes Only',
    concept: 'A manila file from the registry: a clipped photograph, a typed sheet and rubber stamps.',
    notes: [
      ['Frame', 'Kraft folder, a paper-clipped black-and-white print, typing paper with punch holes.'],
      ['Value', 'A red PRIORITY stamp with the number, top left.'],
      ['Back', 'The cover sheet: hatched red border, printed seal, string-and-button closure.'],
      ['Type', 'Special Elite typewriter; Oswald for the stamps.'],
    ],
    front,
    back,
  });
})();
