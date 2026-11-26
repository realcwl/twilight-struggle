import {guardLanguageNavigation,flushLanguageChange} from '../i18n/navigation';
import {getLanguage, setLanguage} from '../i18n/index.js';
import {mountLanguageSwitcher, translateShell} from '../i18n/switcher';
import { t as i18n, text as displayText } from '../i18n/index.js';
// Single-player match. The existing spotlight still owns every card/map interaction.
import {
  CARDS,
  connectCardMap,
  cardBack,
  cardFace,
  cardFontsReady,
  describeCard,
  fitCard,
} from "../cards/deck";
import { Hud } from "../hud/Hud";
import { WorldMap } from "../map/WorldMap";
import { scoringAreas } from "../map/scoringAreas";
import type { Lang } from "../map/types";
import type { HudState } from "../hud/types";
import type { MapState } from "../map/types";
import { createSpotlight } from "../play/spotlight";
import { SoloGame, type SoloPresenter } from "./solo/engine";
import { Match, type MatchState } from "./solo/model";
import { completePresenter, gameMenu } from "./solo/presenter";
import {
  countryScoringFromCards,
  countryScores,
  regionStandings,
  scoringFromCards,
} from "./regions";
import { termSource } from "./terms";
import { COLDWAR_TRACKS } from "./tracks";
import "./game.css";
import { mountCardLibrary } from "../cards/library";
import { GameAudio } from "../audio/GameAudio";
import { mountSoundControls } from "../audio/controls";

setLanguage(getLanguage());
translateShell();
mountLanguageSwitcher();
const audio = new GameAudio();
audio.setFaction(0);

// every card, with search and filters; the HUD's cards corner opens it, so it gets no button of its own
const library = mountCardLibrary({ trigger: false });

const params = new URLSearchParams(location.search);
const scenarioId = params.get("scenario") ?? "coldwar";
const lang: Lang = getLanguage();
setLanguage(lang);

const loading = document.getElementById("loading")!;
const bar = loading.querySelector<HTMLElement>(".loading-bar i")!;

function fail(err: unknown): void {
  console.error(err);
  loading.classList.add("error");
  loading.querySelector(".loading-text")!.textContent =
    displayText(err instanceof Error ? err.message : String(err));
}

async function start(): Promise<void> {
  const [map] = await Promise.all([
    WorldMap.create(
      document.getElementById("map")!,
      `${import.meta.env.BASE_URL}maps/${scenarioId}`,
      {
        lang,
        onProgress: (done, total) =>
          (bar.style.width = `${Math.round((done / total) * 100)}%`),
      },
    ),
    // card faces size their text by measuring it, so the hand waits for their fonts
    cardFontsReady(),
  ]);
  const { scenario } = map.pack;
  connectCardMap(map);
  const countryScoring = countryScoringFromCards();

  const hud = Hud.create(document.getElementById("game")!, {
    lang,
    // what a region is worth is printed on its scoring card, so it is read from there
    rules: {
      ...COLDWAR_TRACKS,
      scoring: scoringFromCards(scenario.regions),
      countryScoring,
    },
    sides: scenario.sides,
    cards: {
      face: cardFace,
      back: cardBack,
      fit: fitCard,
      describe: describeCard,
    },
    catalog: CARDS.length,
    term: termSource,
    // the meters move because of what is played now, not because they are clicked
    demo: false,
    // how a card leaves the hand is staged by src/play
    playFlight: false,
  });

  const brief = hud.briefFor(map);
  mountSoundControls(audio, hud.root.querySelector<HTMLElement>('.hud-tl')!);
  mountLanguageSwitcher(hud.root.querySelector<HTMLElement>('.hud-tl')!);
  /** Everything the screen shows comes through here. */
  const show = (hudState: HudState, mapState: MapState): void => {
    hud.setState(hudState);
    map.setState(mapState);
    brief.setState(
      mapState,
      regionStandings(scenario, mapState),
      countryScores(countryScoring, mapState),
    );
  };
  const area = params.get("area");
  if (area && scoringAreas(scenario).some((r) => r.id === area)) {
    map.select({ kind: "region", id: area });
    map.flyTo(area, { fit: true });
  }

  hud.on("catalog", () => void library.open());
  if (params.get("tutorial") === "1") {
    const { startTutorial } = await import('../tutorial/runtime');
    startTutorial({ container: document.getElementById('game')!, map, hud, audio, lang, show,
      pace: Math.max(0.05, Number(params.get('pace') ?? 1) || 1) });
    loading.classList.add('done');
    setTimeout(() => loading.remove(), 700);
    document.documentElement.dataset.ready = 'true';
    return;
  }

  const saveKey = `coldwar.solo.v1.${scenarioId}`;
  let canSwitchLanguage=false;
  guardLanguageNavigation(() => !storageWarning && (canSwitchLanguage || !!game?.result));
  let game: SoloGame;
  let presenter: SoloPresenter | null = null;
  let lastSave: MatchState | undefined;
  let storageWarning = false;
  const menuButton = hud.root.querySelector<HTMLElement>('[data-part="dial"]')!;
  menuButton.setAttribute("role", "button");
  menuButton.tabIndex = 0;
  menuButton.setAttribute("aria-label", i18n("单机对局菜单"));
  menuButton.title = i18n("单机对局菜单 · R");
  menuButton.style.cursor = "pointer";
  const load = (): MatchState | undefined => {
    try {
      const text = localStorage.getItem(saveKey);
      if (!text) return;
      const saved = JSON.parse(text) as MatchState;
      new Match(scenario, undefined, saved);
      return saved;
    } catch (error) {
      console.warn(i18n("无法读取单机存档"), error);
      menuButton.title = i18n("存档无效 · 已开始新局");
      return;
    }
  };
  const begin = (snapshot?: MatchState): void => {
    game?.stop();
    presenter?.dispose();
    lastSave = snapshot;
    game = new SoloGame({
      scenario,
      lang,
      snapshot,
      onChange: show,
      onCheckpoint: (saved) => {
        lastSave = saved;
        try {
          localStorage.setItem(saveKey, JSON.stringify(saved));
          storageWarning = false;
          flushLanguageChange();
        } catch {
          storageWarning = true;
          menuButton.title = i18n("无法保存 · 请勿关闭页面");
        }
      },
    });
    if (!snapshot) {
      // A restart replaces the old save immediately; setup itself is replayed if interrupted.
      lastSave = game.snapshot;
      try {
        localStorage.setItem(saveKey, JSON.stringify(lastSave));
      } catch {
        storageWarning = true;
      }
    }
    const base = createSpotlight({
      audio,
      container: document.getElementById("game")!,
      map,
      hud,
      cards: {
        face: cardFace,
        back: cardBack,
        fit: fitCard,
        describe: describeCard,
      },
      lang,
      game,
      pace: Math.max(0.05, Number(params.get("pace") ?? 1) || 1),
    });
    presenter = completePresenter(
      base,
      { face: cardFace, back: cardBack, fit: fitCard, describe: describeCard },
      () => begin(),
      audio,
    );
    const atDecision = <T>(choose: () => Promise<T>) => async (): Promise<T> => {
      canSwitchLanguage = true;
      if (!storageWarning) flushLanguageChange();
      try { return await choose(); }
      finally { canSwitchLanguage = false; }
    };
    presenter.decide = atDecision(presenter.decide.bind(presenter));
    presenter.pickHeadline = atDecision(presenter.pickHeadline.bind(presenter));
    const current = game,
      currentPresenter = presenter;
    Object.assign(window, {
      game: { map, hud, play: game, audio, presenter: () => presenter },
    });
    hud.resetCardMotion(true);
    show(game.state, game.mapState);
    const opening = snapshot ? Promise.resolve() : hud.dealOpening();
    void opening.then(() => current === game ? current.start(currentPresenter) : null).catch(async (error) => {
      if (current !== game) return;
      console.error(i18n("单机对局错误"), error);
      await currentPresenter.reveal(
        [],
        i18n("本次行动未完成。将恢复至最近一次完整行动。"),
      );
      begin(lastSave);
    });
    if (!storageWarning) menuButton.title = i18n("单机对局 · 菜单 R");
  };
  let menuOpen = false;
  const menu = async (): Promise<void> => {
    if (menuOpen || document.querySelector("dialog[open]")) return;
    menuOpen = true;
    const selection = await gameMenu(!!lastSave);
    menuOpen = false;
    if (selection === "new") begin();
    else if (selection === "reload") begin(lastSave);
  };
  menuButton.onclick = () => void menu();
  menuButton.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void menu();
    }
  };
  window.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (
      document.querySelector("dialog[open]") ||
      (e.target instanceof Element &&
        e.target.closest(
          'input,textarea,select,button,[data-term],[contenteditable="true"]',
        ))
    )
      return;
    if (e.key === " ") {
      e.preventDefault();
      presenter?.skip();
    } else if (e.key.toLowerCase() === "r") void menu();
  });
  begin(load());

  loading.classList.add("done");
  setTimeout(() => loading.remove(), 700);
  document.documentElement.dataset.ready = "true";
}

start().catch(fail);
