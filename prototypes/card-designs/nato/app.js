(function () {
  'use strict';
  const c = window.NATOCard;
  const A = window.CardArt;
  const enamel = window.CardDesigns.find((d) => d.key === 'e01');
  const q = new URLSearchParams(location.search);
  const exportSide = ['front', 'back'].includes(q.get('export')) ? q.get('export') : null;
  if (exportSide) document.documentElement.dataset.export = exportSide;
  document.body.insertAdjacentHTML('afterbegin', A.defs());
  const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  const emphasize = CardZh.highlight;
  const description = `北大西洋公约组织，第21号牌。4行动点，美国事件，冷战早期。持续效果。 ${c.prerequisite} ${c.effects.join(' ')} ${c.note}`;

  function front(p) {
    return `<svg class="frame" viewBox="0 0 500 700" aria-hidden="true">
      <defs>
        <linearGradient id="${p}-blue" x2="0" y2="1"><stop stop-color="#163c65"/><stop offset="1" stop-color="#10273f"/></linearGradient>
        <linearGradient id="${p}-paper" x2="0" y2="1"><stop stop-color="#f7f2e5"/><stop offset="1" stop-color="#ede4d0"/></linearGradient>
        <clipPath id="${p}-inside"><rect x="13" y="13" width="474" height="674" rx="12"/></clipPath>
        <clipPath id="${p}-art"><rect x="23" y="25" width="454" height="303" rx="5"/></clipPath>
      </defs>
      <rect width="500" height="700" fill="url(#${p}-blue)"/>
      <image href="${c.art}" x="23" y="25" width="454" height="303" preserveAspectRatio="xMidYMid slice" clip-path="url(#${p}-art)"/>
      <text x="454" y="51" text-anchor="end" class="k-type n-era">${c.era}</text>
      <text x="454" y="72" text-anchor="end" class="k-type n-side">${c.side}</text>
      <g clip-path="url(#${p}-inside)"><g class="n-banner">
        <rect x="-20" y="330" width="540" height="74" fill="#111820"/>
        <path d="M-20,330H520M-20,404H520" stroke="#bda06a" stroke-width="1.4"/>
        <text x="240" y="380" text-anchor="middle" class="k-title n-title">${c.title}</text>
        ${c.once ? '<text x="433" y="361" class="k-title" style="font-size:27px">*</text>' : ''}
        ${c.persistent ? '<path d="M61,389H421" stroke="#cbb585" stroke-width="1.6"/>' : ''}
      </g></g>
      <rect x="24" y="425" width="452" height="250" rx="2" fill="url(#${p}-paper)" stroke="#baa67f" stroke-width="1"/>
      <rect x="10" y="10" width="480" height="680" rx="15" fill="none" stroke="#bda06a" stroke-width="2.5"/>
    </svg>
    <svg class="layer px" viewBox="0 0 500 700" style="--d:.4cqw" aria-hidden="true">
      <circle cx="60" cy="61" r="33" fill="#111b29" stroke="#d2bc8c" stroke-width="2"/>
      <text x="60" y="77" text-anchor="middle" class="k-value" style="font-size:44px">${c.value}</text>
    </svg>
    <div class="abs txt" lang="zh-CN">
      <p class="n-prerequisite">${emphasize(c.prerequisite)}</p>
      <div class="n-effects">${c.effects.map((s) => `<p class="rules">${emphasize(s)}</p>`).join('')}</div>
      <p class="note">${CardZh.highlight(c.note)}</p>
    </div>`;
  }

  const slots = [];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  function sync(slot) {
    const back = slot.classList.contains('is-flipped');
    slot.setAttribute('aria-label', `${back ? '统一背面：黑色珐琅与金色罗盘。' : description} 按下可翻面。`);
    slot.querySelector('.front').setAttribute('aria-hidden', String(back));
    slot.querySelector('.back').setAttribute('aria-hidden', String(!back));
    slot.closest('figure').querySelector('.n-view-label').textContent = `${slot.dataset.index} / ${back ? '统一背面' : '正面'}`;
    slot.closest('figure').querySelector('figcaption span:last-child').textContent = back ? '黑色珐琅 · 金色罗盘' : '4行动点 · 美国事件';
  }
  function turn(slot) { slot.classList.toggle('is-flipped'); sync(slot); }
  for (const [index, id, flipped] of [['01', 'front-slot', false], ['02', 'back-slot', true]]) {
    const target = document.getElementById(id);
    target.innerHTML = `<div class="slot v2 e01 nato${flipped ? ' is-flipped' : ''}" data-index="${index}" tabindex="0" role="button">
      <div class="slot-shadow"></div><div class="tilt"><div class="flip">
      <div class="face front">${front(id)}<div class="fx-glare"></div><div class="fx-edge"></div></div>
      <div class="face back">${enamel.back(null, id)}<div class="fx-glare"></div><div class="fx-edge"></div></div>
      </div></div></div>`;
    const slot = target.firstElementChild;
    slots.push(slot);
    sync(slot);
    if (exportSide) continue;
    slot.addEventListener('click', () => turn(slot));
    slot.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); turn(slot); }
    });
    let raf = 0;
    slot.addEventListener('pointermove', (e) => {
      if (!fine.matches || motion.matches) return;
      const r = slot.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, (e.clientX - r.left) / r.width * 2 - 1));
      const y = Math.max(-1, Math.min(1, (e.clientY - r.top) / r.height * 2 - 1));
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        slot.classList.add('is-live');
        slot.style.setProperty('--tx', x.toFixed(3));
        slot.style.setProperty('--ty', y.toFixed(3));
        slot.style.setProperty('--glare', '.55');
      });
    });
    slot.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf);
      slot.classList.remove('is-live');
      ['--tx', '--ty', '--glare'].forEach((key) => slot.style.setProperty(key, '0'));
    });
  }
  document.getElementById('turn-all').addEventListener('click', () => slots.forEach(turn));
  const viewer = document.getElementById('art-viewer');
  document.getElementById('show-art').addEventListener('click', () => viewer.showModal());
  document.getElementById('close-art').addEventListener('click', () => viewer.close());
  viewer.addEventListener('click', (e) => { if (e.target === viewer) viewer.close(); });
  Promise.all([document.fonts.ready, ...Array.from(document.images, (img) => img.decode())]).then(() => {
    document.documentElement.dataset.ready = '1';
  }).catch((error) => console.error('NATO artwork did not load:', error));
})();
