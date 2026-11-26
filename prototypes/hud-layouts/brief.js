// The country card, cut down to what a glance needs: whose it is, how hard it is to take, and the
// two numbers. It stands in for the map's own card (src/map/infoCard.ts), which this page hides.
// Left out on purpose: the list of neighbours (the map already dims everything that is not one),
// the English name, and the hints.
import { regionStyles } from '../../src/map/regionStyle.ts';
import './brief.css';

const h = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function mountBrief(map, state, host) {
  const { scenario } = map.pack;
  const styles = regionStyles(scenario.regions);
  const short = (i) => scenario.sides[i].short.zh;
  const el = document.createElement('div');
  el.className = 'brief';
  el.hidden = true;
  host.appendChild(el);

  let hovered = null;
  let selected = map.selection;
  let right = false;

  const badge = (regionId) => {
    const st = styles.get(regionId);
    return st ? `<i class="bf-badge" style="--region:${st.color}">${h(st.mark.zh)}</i>` : '';
  };
  const pair = (a, b) => `<span class="bf-inf"><i class="a${a.on ? ' on' : ''}">${short(0)}<b>${a.text}</b></i><i class="b${b.on ? ' on' : ''}">${short(1)}<b>${b.text}</b></i></span>`;

  function country(id) {
    const c = scenario.countries.find((x) => x.id === id);
    if (!c) return null;
    if (c.superpower !== undefined) return { side: c.superpower, html: `<div class="bf-top"><b class="bf-name">${h(c.name.zh)}</b><span class="bf-meta">超级大国</span></div>` };
    const st = state.countries[id] ?? { influence: [0, 0], controller: null };
    const who = st.controller === null ? '无人控制' : `${scenario.sides[st.controller].name.zh}控制`;
    return {
      side: st.controller,
      html:
        `<div class="bf-top">${badge(c.region)}<b class="bf-name">${h(c.name.zh)}</b>${c.key ? '<i class="bf-key" title="战场国">★</i>' : ''}<span class="bf-meta">稳定度<b>${c.stability}</b></span></div>` +
        `<div class="bf-row"><span class="bf-ctrl">${who}</span>${pair({ text: st.influence[0], on: st.influence[0] > 0 }, { text: st.influence[1], on: st.influence[1] > 0 })}</div>`,
    };
  }

  function region(id) {
    const r = scenario.regions.find((x) => x.id === id);
    if (!r) return null;
    const members = scenario.countries.filter((c) => c.region === id);
    const held = [0, 1].map((i) => members.filter((c) => state.countries[c.id]?.controller === i).length);
    // the spine takes the colour of whoever holds more; what that is worth is for the rules to say
    const side = held[0] === held[1] ? null : held[0] > held[1] ? 0 : 1;
    const who = '控制国数';
    return {
      side,
      html:
        `<div class="bf-top">${badge(id)}<b class="bf-name">${h(r.name.zh)}</b><span class="bf-meta"><b>${members.length}</b>国</span></div>` +
        `<div class="bf-row"><span class="bf-ctrl">${who}</span>${pair({ text: held[0], on: held[0] > 0 }, { text: held[1], on: held[1] > 0 })}</div>`,
    };
  }

  function render() {
    const t = selected ?? hovered;
    const view = !t ? null : t.kind === 'country' ? country(t.id) : region(t.id);
    el.hidden = !view;
    if (!view) return;
    el.className = `brief ${t.kind} ${view.side === 0 ? 'a' : view.side === 1 ? 'b' : 'none'}${selected ? ' pinned' : ''}${right ? ' right' : ''}`;
    el.innerHTML = view.html;
  }

  // like the map's own card: it keeps to one corner and steps aside when the pointer comes for it
  function follow(e) {
    if (el.hidden) return;
    const box = host.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const near = (pad) => e.clientX > r.left - pad * rem && e.clientX < r.right + pad * rem && e.clientY > r.top - pad * rem && e.clientY < r.bottom + pad * rem;
    const onLeftHalf = e.clientX < box.left + box.width / 2;
    if (!right && near(5)) right = true;
    else if (right && near(5) && !onLeftHalf) right = false;
    else return;
    el.classList.toggle('right', right);
  }
  host.addEventListener('pointermove', follow);

  const offHover = map.on('hover', (t) => {
    hovered = t;
    render();
  });
  const offSelect = map.on('select', (t) => {
    selected = t;
    render();
  });
  render();
  return () => {
    offHover();
    offSelect();
    host.removeEventListener('pointermove', follow);
    el.remove();
  };
}
