import { t as i18n, text as displayText } from '../i18n/index.js';
import { GameAudio } from './GameAudio';
import { SCORE } from './cues';
import '../ui/sheet.css';
import './sound.css';
const SPEAKER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4 6 8H3v8h3l5 4Z"/><path class="sound-waves" d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/><path class="sound-cross" d="m15 9 6 6m0-6-6 6"/></svg>';
/** A small control inside the existing time panel, with a top-layer popover on demand. */
export function mountSoundControls(audio: GameAudio, host: HTMLElement): () => void {
  const root = document.createElement('div'); root.className = 'sound-control';
  const toggle = document.createElement('button'); toggle.className = 'sound-toggle'; toggle.type = 'button';
  toggle.innerHTML = displayText(SPEAKER); toggle.setAttribute('aria-label', i18n("声音设置")); toggle.setAttribute('aria-expanded', 'false');
  const pane = document.createElement('section'); pane.className = 'sound-panel sheet is-small'; pane.setAttribute('popover', 'auto');
  pane.setAttribute('role', 'dialog'); pane.setAttribute('aria-label', i18n("声音设置"));
  pane.innerHTML = i18n("<header><div class=\"sheet-head\"><h2 class=\"sheet-title\">声音</h2></div><button class=\"sound-close sheet-x\" type=\"button\" aria-label=\"关闭声音设置\">×</button></header>\n    <div class=\"sound-track\"><span class=\"sound-faction\"></span><strong></strong><small></small></div>\n    <label class=\"sound-mute\"><span>静音</span><input type=\"checkbox\" aria-label=\"静音\"></label>\n    <label class=\"sound-volume\"><span>背景音乐</span><output></output><input type=\"range\" min=\"0\" max=\"100\" step=\"1\" data-volume=\"music\" aria-label=\"背景音乐音量\"></label>\n    <label class=\"sound-volume\"><span>音效</span><output></output><input type=\"range\" min=\"0\" max=\"100\" step=\"1\" data-volume=\"effects\" aria-label=\"音效音量\"></label>\n    <div class=\"sound-audition\"><span>试听</span><button type=\"button\" class=\"sheet-btn\" data-sound=\"card\">打牌</button><button type=\"button\" class=\"sheet-btn\" data-sound=\"influence\">影响力</button><button type=\"button\" class=\"sheet-btn\" data-sound=\"coup\">政变</button></div>\n    <p class=\"sound-status\" role=\"status\"></p>\n    <details class=\"sound-credits\"><summary>音乐与声音署名</summary><p>“<a href=\"{0}\" target=\"_blank\" rel=\"noreferrer\">Signal to Noise</a>” & “<a href=\"{1}\" target=\"_blank\" rel=\"noreferrer\">Katabasis I</a>” by <a href=\"https://www.scottbuckley.com.au\" target=\"_blank\" rel=\"noreferrer\">Scott Buckley</a> — <a href=\"https://creativecommons.org/licenses/by/4.0/\" target=\"_blank\" rel=\"noreferrer\">CC BY 4.0</a>.<br>游戏版作响度处理、压缩及循环淡化。</p><p>Foley: <a href=\"https://kenney.nl/assets/casino-audio\" target=\"_blank\" rel=\"noreferrer\">Kenney Casino Audio</a> & <a href=\"https://kenney.nl/assets/impact-sounds\" target=\"_blank\" rel=\"noreferrer\">Impact Sounds</a> — CC0。分层混音与共鸣声为本游戏制作。</p></details>", [SCORE[0].url, SCORE[1].url]);
  // Anchor visually to the existing HUD, but stay above the cinematic input shield.
  // Muting must remain possible while the opponent's dice/action is animating.
  root.append(toggle); document.body.append(root, pane);
  const muted = pane.querySelector<HTMLInputElement>('[type="checkbox"]')!;
  const close = () => { if (pane.matches(':popover-open')) pane.hidePopover(); };
  function position(): void {
    const anchor = host.getBoundingClientRect();
    root.style.left = `${Math.max(6, Math.min(innerWidth - toggle.offsetWidth - 6, anchor.right - toggle.offsetWidth - 6))}px`;
    root.style.top = `${Math.max(6, anchor.top + 6)}px`;
    if (!pane.matches(':popover-open')) return;
    const r = toggle.getBoundingClientRect(), p = pane.getBoundingClientRect();
    pane.style.left = `${Math.max(8, Math.min(innerWidth - p.width - 8, r.left))}px`;
    pane.style.top = `${Math.max(8, Math.min(innerHeight - p.height - 8, r.bottom + 10))}px`;
  }
  const update = () => {
    const prefs = audio.preferences, track = SCORE[audio.faction ?? 0];
    toggle.classList.toggle('is-muted', prefs.muted); toggle.classList.toggle('is-locked', audio.status === 'locked');
    toggle.title = displayText(prefs.muted ? '声音设置 · 已静音' : audio.status === 'locked' ? '点击启用声音' : '声音设置');
    muted.checked = prefs.muted;
    for (const input of pane.querySelectorAll<HTMLInputElement>('[data-volume]')) {
      const key = input.dataset.volume as 'music' | 'effects';
      input.value = String(Math.round(prefs[key] * 100));
      input.parentElement!.querySelector('output')!.textContent = displayText(input.value + '%');
    }
    pane.querySelector('.sound-faction')!.textContent = displayText(track.faction + '配乐');
    pane.querySelector('.sound-track strong')!.textContent = displayText(track.title);
    pane.querySelector('.sound-track small')!.textContent = displayText(track.mood);
    pane.querySelector('.sound-status')!.textContent = displayText(audio.status === 'muted' ? '已静音' : audio.status === 'locked' ? '点击任意位置启用声音' : audio.status === 'unavailable' ? '音乐暂未载入，调整音量可重试' : '切到后台时自动暂停');
    position();
  };
  toggle.onclick = () => {
    void audio.unlock();
    if (pane.matches(':popover-open')) close(); else { pane.showPopover(); update(); }
  };
  pane.addEventListener('toggle', () => toggle.setAttribute('aria-expanded', String(pane.matches(':popover-open'))));
  pane.querySelector<HTMLButtonElement>('.sound-close')!.onclick = close;
  muted.onchange = () => { audio.configure({ muted: muted.checked }); if (!muted.checked) void audio.unlock(); };
  pane.addEventListener('input', e => {
    const input = e.target as HTMLInputElement;
    if (input.dataset.volume) audio.configure({ [input.dataset.volume]: Number(input.value) / 100 });
  });
  pane.addEventListener('click', async e => {
    const button = (e.target as Element).closest<HTMLElement>('[data-sound]');
    if (!button) return;
    await audio.unlock(); await audio.preload();
    if (!pane.matches(':popover-open')) return;
    audio.duck(1000); audio.play(button.dataset.sound as 'card' | 'influence' | 'coup');
  });
  // Keep volume controls from spending an action, skipping a roll, or opening another menu.
  pane.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') close(); });
  root.addEventListener('keydown', e => e.stopPropagation());
  const resize = new ResizeObserver(position); resize.observe(pane); resize.observe(host);
  window.addEventListener('resize', position); audio.addEventListener('change', update); update();
  return () => { resize.disconnect(); window.removeEventListener('resize', position); audio.removeEventListener('change', update); root.remove(); pane.remove(); };
}
