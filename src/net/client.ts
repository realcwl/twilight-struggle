import {getLanguage, setLanguage} from '../i18n/index.js';
import {mountLanguageSwitcher, translateShell} from '../i18n/switcher';
import { t as i18n, text as displayText } from '../i18n/index.js';
import {
  CARDS,
  connectCardMap,
  card,
  cardBack,
  cardFace,
  cardFontsReady,
  describeCard,
  fitCard,
} from "../cards/deck";
import { mountCardLibrary } from "../cards/library";
import { Hud } from "../hud/Hud";
import { WorldMap } from "../map/WorldMap";
import type { SideIndex } from "../map/types";
import { createSpotlight } from "../play/spotlight";
import { ABORTED, type PlayQueries } from "../play/types";
import type { SoloPresenter } from "../game/solo/engine";
import { completePresenter } from "../game/solo/presenter";
import {
  countryScoringFromCards,
  countryScores,
  regionStandings,
  scoringFromCards,
} from "../game/regions";
import { termSource } from "../game/terms";
import { COLDWAR_TRACKS } from "../game/tracks";
import {
  decode,
  type Credential,
  type Prompt,
  type RoomMessage,
  type View,
  type ChatPacket,
} from "./protocol";
import { mountRoomChat } from './chat';
import { previewPlacement } from "./placement";
import "../game/game.css";
import "./online.css";
import { GameAudio } from "../audio/GameAudio";
import { mountSoundControls } from "../audio/controls";
setLanguage(getLanguage());
translateShell();
mountLanguageSwitcher();
export const audio = new GameAudio();
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const roomApiOrigin = import.meta.env.VITE_ROOM_API_ORIGIN || location.origin;
const lobbyPath = import.meta.env.MODE === "pages" ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}online.html`;
const storageKey = (code: string) => `coldwar.online.v1.${code}`;
const saved = (code: string): Credential | null => {
  try {
    return JSON.parse(localStorage.getItem(storageKey(code)) ?? "null");
  } catch {
    return null;
  }
};
const last = localStorage.getItem("coldwar.online.last");
let started = false;
function notice(text: string) {
  $("room-notice").textContent = displayText(text);
  $("room-notice").hidden = false;
  setTimeout(() => ($("room-notice").hidden = true), 6000);
}
async function api(path: string, body: unknown = {}) {
  const res = await fetch(new URL(path, roomApiOrigin), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? i18n("连接失败"));
  return data as Credential;
}
async function enter(c: Credential) {
  if (started) return;
  started = true;
  audio.setFaction(c.side);
  localStorage.setItem(storageKey(c.code), JSON.stringify(c));
  localStorage.setItem("coldwar.online.last", c.code);
  history.replaceState(null, "", `${lobbyPath}?room=${c.code}&lang=${getLanguage()}`);
  $("lobby").hidden = true;
  $("game").hidden = false;
  $("loading").hidden = false;
  await start(c);
}
async function submit(form: HTMLFormElement, fn: () => Promise<Credential>) {
  const b = form.querySelector("button")!;
  b.disabled = true;
  $("lobby-error").textContent = displayText("");
  try {
    await enter(await fn());
  } catch (e) {
    $("lobby-error").textContent = displayText(e instanceof Error ? e.message : "连接失败");
    if (started) {
      $("loading").querySelector(".loading-text")!.textContent =
        i18n("载入失败，请刷新重试。");
      console.error(e);
    }
  } finally {
    b.disabled = false;
  }
}
$("create-room").onsubmit = (e) => {
  e.preventDefault();
  const form = e.currentTarget as HTMLFormElement;
  void submit(form, () =>
    api("/api/create", { side: Number(new FormData(form).get("side")) }),
  );
};
$("join-room").onsubmit = (e) => {
  e.preventDefault();
  const form = e.currentTarget as HTMLFormElement,
    code = $<HTMLInputElement>("room-code")
      .value.replace(/\s/g, "")
      .toUpperCase();
  void submit(form, async () => {
    if (!/^[A-Z2-9]{8}$/.test(code)) throw new Error(i18n("请输入 8 位房间密码"));
    return saved(code) ?? (await api(`/api/room/${code}/join`));
  });
};
if (last && saved(last)) {
  $("resume-room").hidden = false;
  $("resume-room").onclick = () =>
    void enter(saved(last)!).catch((e) => notice(String(e)));
}
const requested = new URLSearchParams(location.search).get("room");
if (requested) {
  $<HTMLInputElement>("room-code").value = requested;
  if (saved(requested))
    void enter(saved(requested)!).catch((e) => notice(String(e)));
}
async function start(credential: Credential) {
  const [map] = await Promise.all([
    WorldMap.create($("map"), `${import.meta.env.BASE_URL}maps/coldwar`, {
      lang: getLanguage(),
      onProgress: (n, t) => {
        $("loading").querySelector<HTMLElement>("i")!.style.width =
          `${(n / t) * 100}%`;
      },
    }),
    cardFontsReady(),
  ]);
  const scenario = map.pack.scenario,
    player = credential.side,
    cs = countryScoringFromCards(),
    cards = {
      face: cardFace,
      back: cardBack,
      fit: fitCard,
      describe: describeCard,
    };
  const hud = Hud.create($("game"), {
    lang: getLanguage(),
    player,
    rules: {
      ...COLDWAR_TRACKS,
      scoring: scoringFromCards(scenario.regions),
      countryScoring: cs,
    },
    sides: scenario.sides,
    cards,
    catalog: CARDS.length,
    term: termSource,
    demo: false,
    playFlight: false,
  });
  connectCardMap(map);
  const brief = hud.briefFor(map),
    library = mountCardLibrary({ trigger: false });
  mountSoundControls(audio, hud.root.querySelector<HTMLElement>('.hud-tl')!);
  mountLanguageSwitcher(hud.root.querySelector<HTMLElement>('.hud-tl')!);
  hud.on("catalog", () => void library.open());
  let view: View,
    packet: RoomMessage,
    ws: WebSocket,
    presenter: SoloPresenter,
    activePrompt: string | null = null,
    epoch = 0,
    queue = Promise.resolve(),
    queuedRevision = -1,
    finished = false,
    reconnectTimer: ReturnType<typeof setTimeout>,
    retry = 0,
    stopped = false,
    submitted = false,
    submittedHeadline = false;
  let firstView = true;
  const show = (v: View) => {
    view = v;
    hud.setState(v.hud);
    if (firstView && v.hud.phase === 'setup') void hud.dealOpening();
    firstView = false;
    map.setState(v.map);
    brief.setState(
      v.map,
      regionStandings(scenario, v.map),
      countryScores(cs, v.map),
    );
  };
  const queries: PlayQueries = {
    get crisis() {
      return view?.hud.crisis ?? 5;
    },
    country(id) {
      const c = scenario.countries.find((c) => c.id === id)!;
      return {
        id,
        name: c.name[getLanguage()],
        stability: c.stability,
        key: c.key,
        region: c.region,
        ...view.map.countries[id],
      };
    },
    card(id) {
      const c = card(id);
      return {
        id: c.id,
        title: c.title,
        value: c.value,
        once: c.once,
        owner:
          c.kind === "neutral"
            ? "neutral"
            : c.kind === "tally"
              ? "tally"
              : (c.kind === "us" ? 0 : 1) === player
                ? "mine"
                : "theirs",
      };
    },
    options(id) {
      return packet.options[id];
    },
    sideName(s) {
      return scenario.sides[s].name[getLanguage()];
    },
  };
  const makePresenter = () =>
    completePresenter(
      createSpotlight({
        audio,
        container: $("game"),
        map,
        hud,
        cards,
        lang: getLanguage(),
        game: queries,
        player,
        pace: Math.max(
          0.05,
          Number(new URLSearchParams(location.search).get("pace") ?? 1) || 1,
        ),
      }),
      cards,
      () => location.assign(lobbyPath),
      audio,
      player,
    );
  const reset = () => {
    epoch++;
    presenter?.dispose();
    hud.resetCardMotion(true);
    presenter = makePresenter();
    activePrompt = null;
    submitted = false;
    submittedHeadline = false;
    queue = Promise.resolve();
  };
  const send = (msg: unknown) => {
    if (ws.readyState !== WebSocket.OPEN) {
      notice(i18n("连接已断开，正在恢复…"));
      return false;
    }
    ws.send(JSON.stringify(msg));
    return true;
  };
  const chat = mountRoomChat({ container: $("game"), hud: hud.root, code: credential.code, side: player,
    send: message => {
      if (ws?.readyState !== WebSocket.OPEN) return false;
      ws.send(JSON.stringify(message));return true;
    },
  });
  async function prompt(p: Prompt) {
    activePrompt = p.id;
    submitted = false;
    const generation = epoch,
      P = presenter;
    try {
      let answer: unknown;
      if (p.method === "place") {
        const preview = previewPlacement(p.args[0], view, scenario, show);
        const accept = await P.place(preview.session, p.args[1]);
        answer = { accept, ids: preview.session.spent.map((s) => s.id) };
      } else if (p.method === "reveal") {
        await P.reveal(p.args[0], p.args[1]);
        answer = true;
      } else if (p.method === "choose") answer = await P.choose(p.args[0]);
      else if (p.method === "pickTarget")
        answer = await P.pickTarget(p.args[0]);
      else if (p.method === "decide") answer = await P.decide();
      else answer = await P.pickHeadline();
      if (generation !== epoch || activePrompt !== p.id) return;
      submitted = send({
        type: "answer",
        promptId: p.id,
        value: answer,
        requestId: crypto.randomUUID(),
      });
      submittedHeadline = submitted && p.method === 'pickHeadline';
      $("room-status").textContent = i18n("正在提交…");
    } catch (e) {
      if (e !== ABORTED && generation === epoch) {
        console.error(e);
        notice(i18n("操作未提交，正在恢复局面"));
        reset();
        queuedRevision = -1;
        send({ type: "sync" });
      }
    }
  }
  function receive(next: RoomMessage) {
    const other = (1 - player) as SideIndex;
    $("room-status").classList.toggle(
      "is-offline",
      next.joined && !next.connected[other],
    );
    $("room-status").textContent = displayText(!next.joined
      ? "等待朋友 · 分享左侧密码"
      : next.view.result
        ? "对局结束"
        : !next.connected[other]
          ? "朋友离线 · 进度已保存"
          : next.prompt
            ? "轮到你操作"
            : "等待对方");
    if (next.revision <= queuedRevision) return;
    queuedRevision = next.revision;
    const generation = epoch;
    queue = queue
      .then(async () => {
        if (generation !== epoch) return;
        packet = next;
        // Presence-only updates do not cancel a drag or a partially placed allocation.
        if (activePrompt && activePrompt !== next.prompt?.id) {
          // A sealed headline already occupies its reveal seat; keep that same stage on acknowledgement.
          if (!submittedHeadline) {
            presenter.dispose();
            presenter = makePresenter();
          }
          activePrompt = null;
          submitted = false;
          submittedHeadline = false;
        }
        for (const f of next.frames) {
          if (generation !== epoch) return;
          const P = presenter;
          if (f.method === "step")
            await P.step(f.args[0], () => show(f.view), f.args[1]);
          else if (f.method === "cardMove") {
            if (P.cardMove) await P.cardMove(f.args[0], () => show(f.view));
            else show(f.view);
          }
          else {
            if (f.method === 'settle' && f.args[0].transfer) hud.commitCardChange(() => show(f.view));
            else show(f.view);
            switch (f.method) {
              case "phase":
                await P.phase(f.args[0]);
                break;
              case "showHeadline":
                await P.showHeadline(f.args[0]);
                break;
              case "announce":
                await P.announce(f.args[0]);
                break;
              case "roll":
                await P.roll(f.args[0]);
                break;
              case "score":
                await P.score?.(f.args[0]);
                break;
              case "trigger":
                await P.trigger(f.args[0]);
                break;
              case "settle":
                await P.settle(f.args[0]);
                break;
              case "reveal":
                await P.reveal(f.args[0], f.args[1]);
                break;
            }
          }
        }
        if (generation !== epoch) return;
        show(next.view);
        // An older presence update may arrive while our answer is in flight. Only an
        // acknowledgement, rejection or reconnect may replace the optimistic sealed card.
        if (!submittedHeadline) presenter.waitHeadline?.(next.view.headline ?? null);
        await hud.waitForCards();
        if (next.view.result && !finished) {
          finished = true;
          void presenter.result(next.view.result, {
            turn: next.view.hud.turn,
            vp: next.view.hud.vp,
            log: next.view.log,
          });
        } else if (next.prompt && activePrompt !== next.prompt.id)
          void prompt(next.prompt);
        else if (!next.prompt) {
          activePrompt = null;
          await presenter.idle?.();
        }
      })
      .catch((e) => {
        if (e !== ABORTED && generation === epoch) {
          console.error(e);
          notice(i18n("画面同步中…"));
          reset();
          queuedRevision = -1;
          send({ type: "sync" });
        }
      });
  }
  function connect() {
    const socketUrl = new URL(`/api/room/${credential.code}/socket`, roomApiOrigin);
    socketUrl.protocol = socketUrl.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(socketUrl);
    ws.onopen = () => {
      retry = 0;
      reset();
      queuedRevision = -1;
      chat.setConnected(false);
      send({ type: "auth", token: credential.token, chat: true });
    };
    ws.onmessage = (e) => {
      if (e.data === "pong") return;
      const msg = decode<RoomMessage | ChatPacket | { type: "error"; message: string }>(
        e.data,
      );
      if (msg.type === 'chat' || msg.type === 'chat-history' || msg.type === 'chat-error') {
        if (msg.type === 'chat-history') chat.setConnected(true);
        chat.receive(msg);
      } else if (msg.type === "state") {
        receive(msg);
        $("loading").hidden = true;
        document.documentElement.dataset.ready = "true";
      } else {
        notice(msg.message);
        if (submitted) {
          reset();
          queuedRevision = -1;
          send({ type: "sync" });
        }
      }
    };
    ws.onclose = async (e) => {
      chat.setConnected(false);
      presenter?.dispose();
      hud.root.classList.add('play-readonly');
      epoch++;
      activePrompt = null;
      queuedRevision = -1;
      $("room-status").textContent = i18n("连接断开 · 正在恢复…");
      $("room-status").classList.add("is-offline");
      if (e.code === 4001 || e.code === 4004) {
        stopped = true;
        notice(e.reason || i18n("房间不可用，请返回大厅"));
        $("loading").hidden = true;
      }
      if (!stopped) {
        try {
          const status = await fetch(new URL(`/api/room/${credential.code}/status`, roomApiOrigin));
          if(status.status === 404) {
            stopped = true;
            $("room-status").textContent = i18n("房间已过期");
            $("loading").hidden = true;
            notice(i18n("房间已过期，请从房间菜单返回大厅。 "));
          }
        } catch { /* reconnect when the network returns */ }
      }
      if (!stopped)
        reconnectTimer = setTimeout(
          connect,
          Math.min(10000, 800 * 2 ** retry++),
        );
    };
  }
  $("room-bar").hidden = false;
  $("copy-code").textContent =
    i18n("{0} · {1}", [player === 0 ? "美" : "苏", credential.code]);
  hud.setTimeFooter($("room-bar"));
  $("copy-code").onclick = () =>
    void navigator.clipboard
      .writeText(credential.code)
      .then(() => notice(i18n("房间密码已复制，发给朋友即可加入。")));
  $("room-menu").onclick = () => {
    if (document.querySelector("dialog[open]")) return;
    const d = document.createElement("dialog");
    d.className = "solo-dialog solo-menu sheet";
    d.innerHTML =
      i18n("<header class=\"sheet-head\"><h2 class=\"sheet-title\">私人对局</h2><p class=\"sheet-sub\">双方的进度自动保存。离开后可在此浏览器继续。</p></header><div class=\"sheet-list\"></div>");
    const list = d.querySelector(".sheet-list")!;
    for (const [label, run] of [
      [i18n("继续对局"), () => d.close()],
      [i18n("返回大厅"), () => location.assign(lobbyPath)],
      [
        i18n("认输"),
        () => {
          d.querySelector("h2")!.textContent = i18n("确认认输？");
          d.querySelector("p")!.textContent = i18n("本局将结束，对方获胜。");
          list.remove();
          const cancel = document.createElement("button");
          cancel.className = "sheet-btn";
          cancel.textContent = i18n("取消");
          cancel.onclick = () => d.close();
          const yes = document.createElement("button");
          yes.className = "sheet-btn is-primary";
          yes.textContent = i18n("确认认输");
          yes.onclick = () => {
            send({ type: "resign", requestId: crypto.randomUUID() });
            d.close();
          };
          d.append(cancel, yes);
        },
      ],
    ] as const) {
      const b = document.createElement("button");
      b.className = "sheet-row";
      b.innerHTML = displayText('<span class="sheet-row-title"></span>');
      b.firstElementChild!.textContent = displayText(label);
      b.onclick = run;
      list.append(b);
    }
    d.onclose = () => d.remove();
    document.body.append(d);
    d.showModal();
  };
  window.addEventListener("keydown", (e) => {
    if (
      !e.defaultPrevented &&
      e.code === "Space" &&
      !e.ctrlKey &&
      !e.metaKey &&
      !(
        e.target instanceof Element &&
        e.target.closest("input,textarea,button,dialog")
      )
    ) {
      e.preventDefault();
      presenter?.skip();
    }
  });
  const heartbeat = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) ws.send("ping");
  }, 25000);
  window.addEventListener("pagehide", () => {
    chat.destroy();
    stopped = true;
    clearTimeout(reconnectTimer);
    clearInterval(heartbeat);
    ws?.close();
  });
  connect();
}
