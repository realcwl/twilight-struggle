import {getLanguage, setLanguage} from '../i18n/index.js';
import {mountLanguageSwitcher, translateShell} from '../i18n/switcher';
import { translateDictionary, text as displayText } from '../i18n/index.js';
// Map sandbox: the map module plus a panel for setting the situation by hand. No rules, no turns.
import { WorldMap } from '../map/WorldMap';
import type { Lang, MapState } from '../map/types';
import { Panel } from './panel';
import { type Override, deriveCountry, regionStatus } from './placeholderRule';
import './sandbox.css';
import {mountCardLibrary} from '../cards/library';

mountCardLibrary();

export type Cell = { influence: [number, number]; override: Override };
export type PresetName = 'empty' | 'demo' | 'random' | 'states';

setLanguage(getLanguage());
translateShell();
mountLanguageSwitcher();
const params = new URLSearchParams(location.search);
const scenarioId = params.get('scenario') ?? 'coldwar';
let lang: Lang = getLanguage();

const STATUS: Record<Lang, { none: string; ahead: string; behind: string; even: string }> = {
  zh: { none: '无', ahead: '领先', behind: '落后', even: '均势' },
  en: { none: 'none', ahead: 'ahead', behind: 'behind', even: 'even' },
 es: translateDictionary({ none: '无', ahead: '领先', behind: '落后', even: '均势' }, 'es') };

const loading = document.getElementById('loading')!;
const bar = loading.querySelector<HTMLElement>('.loading-bar i')!;

function fail(err: unknown): void {
  console.error(err);
  loading.classList.add('error');
  loading.querySelector('.loading-text')!.textContent = displayText(err instanceof Error ? err.message : String(err));
}

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function start(): Promise<void> {
  const map = await WorldMap.create(document.getElementById('map')!, `${import.meta.env.BASE_URL}maps/${scenarioId}`, {
    lang,
    legend: true,
    onProgress: (done, total) => (bar.style.width = `${Math.round((done / total) * 100)}%`),
  });
  const { scenario } = map.pack;
  const cells: Record<string, Cell> = {};
  for (const c of scenario.countries) cells[c.id] = { influence: [0, 0], override: 'auto' };

  const toState = (): MapState => {
    const state: MapState = { countries: {}, regions: {} };
    for (const c of scenario.countries) {
      const cell = cells[c.id];
      state.countries[c.id] = c.superpower !== undefined
        ? { influence: [0, 0], controller: c.superpower }
        : deriveCountry([cell.influence[0], cell.influence[1]], c.stability, cell.override);
    }
    for (const r of scenario.regions) {
      const held: [number, number] = [0, 0];
      for (const c of scenario.countries) {
        const ctrl = state.countries[c.id].controller;
        if (c.region === r.id && ctrl !== null) held[ctrl]++;
      }
      state.regions[r.id] = { status: regionStatus(held, STATUS[lang]) };
    }
    return state;
  };

  let state = toState();
  const push = (): void => {
    state = toState();
    map.setState(state);
    panel.render(state);
  };

  /** Filler situations for looking at the map. None of this is game setup. */
  const applyPreset = (name: PresetName): void => {
    for (const c of scenario.countries) cells[c.id] = { influence: [0, 0], override: 'auto' };
    if (name === 'demo' || name === 'random') {
      const rand = seeded(name === 'demo' ? 1947 : (Math.random() * 1e9) | 0);
      // rough lean of each region towards side 0, just so the picture has structure
      const lean: Record<string, number> = { camerica: 0.95, samerica: 0.7, europe: 0.6, mideast: 0.5, africa: 0.4, asia: 0.42 };
      for (const c of scenario.countries) {
        if (c.superpower !== undefined || c.region === null) continue;
        const roll = rand();
        if (roll < 0.3) continue;
        const bias = lean[c.region] ?? 0.5;
        const first = rand() < bias ? 0 : 1;
        const strong = Math.round(rand() * (c.stability + 2));
        const weak = rand() < 0.45 ? Math.round(rand() * 2) : 0;
        cells[c.id].influence[first] = strong;
        cells[c.id].influence[first === 0 ? 1 : 0] = weak;
      }
    } else if (name === 'states') {
      // every display state side by side in one screen
      const set = (id: string, a: number, b: number): void => {
        if (cells[id]) cells[id].influence = [a, b];
      };
      set('gbr', 5, 0); // controlled by side 0
      set('frg', 5, 1); // controlled by side 0, key country
      set('ben', 1, 0); // influence, no control
      set('ita', 1, 2); // influence from both, no control, key country
      set('gdr', 0, 4); // controlled by side 1, key country
      set('cze', 0, 3); // controlled by side 1
      set('hun', 1, 1); // influence from both, no control
      set('yug', 0, 1); // influence, no control
      // France, Spain, Poland and the rest stay empty: neutral, with and without the key marking
    }
    push();
    if (name === 'states') {
      map.select(null);
      map.flyTo('frg');
    }
  };

  const panel = new Panel(document.getElementById('panel')!, map, {
    lang,
    cells,
    onChange: push,
    onPreset: applyPreset,
    onLanguage: (next) => {
      lang = next;
      setLanguage(next);
      const url = new URL(location.href); url.searchParams.set('lang', next); location.assign(url.href);
      map.setLanguage(next);
      push();
    },
  });

  applyPreset('demo');
  loading.classList.add('done');
  setTimeout(() => loading.remove(), 700);

  // handle for poking at the sandbox from the console
  Object.assign(window, { sandbox: { map, cells, push, applyPreset, state: () => state } });
}

start().catch(fail);
