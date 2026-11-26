import { t as i18n, text as displayText } from '../../i18n/index.js';
import type { CardSource } from "../../hud/types";
import { ABORTED, type Presenter } from "../../play/types";
import type { Question, SoloPresenter } from "./engine";
import type { MatchState, Result } from "./model";
import "../../ui/sheet.css";
import "./solo.css";
import type { AudioPort } from "../../audio/cues";

/**
 * A sheet's heading (see src/ui/sheet.css). "导弹嫉妒：交出最高行动点牌" reads as a label and a title;
 * what is a sentence rather than a name is set smaller.
 */
function heading(text: string, label = ""): HTMLElement {
  text = displayText(text);
  const at = Math.max(text.indexOf("："), text.indexOf(": "));
  const split = at > 0 && at <= 14 && at < text.length - 1;
  const head = document.createElement("header");
  head.className = "sheet-head";
  const kicker = document.createElement("small");
  kicker.className = "sheet-kicker";
  kicker.textContent = displayText(split ? text.slice(0, at) : label);
  const h = document.createElement("h2");
  h.className = "sheet-title";
  h.textContent = displayText(split ? text.slice(at + 1) : text);
  if (h.textContent.length > 12) h.classList.add("is-long");
  head.append(kicker, h);
  return head;
}

/** Only decisions the existing map/card staging cannot express live here. */
export function completePresenter(
  base: Presenter,
  cards: CardSource,
  restart: () => void,
  audio?: AudioPort,
  player: 0 | 1 = 0,
): SoloPresenter {
  const pending = new Map<HTMLDialogElement, () => void>();
  let disposed = false;
  function dialog(title: string, label = ""): HTMLDialogElement {
    if (disposed) throw ABORTED;
    const node = document.createElement("dialog");
    node.className = "solo-dialog sheet";
    node.append(heading(title, label));
    node.addEventListener("cancel", (e) => e.preventDefault());
    document.body.append(node);
    return node;
  }
  function button(label: string, action: () => void, look = "sheet-btn"): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = look;
    b.textContent = displayText(label);
    b.onclick = action;
    return b;
  }
  /**
   * `hold`: the sheet itself takes the focus, not its first control. Nothing is then answered by a
   * stray key (Space skips animations elsewhere), and a card's title is not focused into opening
   * its story over the cards.
   */
  function wait<T>(
    node: HTMLDialogElement,
    build: (finish: (v: T) => void) => void,
    hold = false,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const close = () => {
        pending.delete(node);
        node.close();
        node.remove();
      };
      pending.set(node, () => {
        close();
        reject(ABORTED);
      });
      build((v) => {
        close();
        resolve(v);
      });
      if (hold) {
        node.tabIndex = -1;
        node.autofocus = true;
      }
      node.showModal();
      if (hold) node.focus({ preventScroll: true });
      requestAnimationFrame(() =>
        node
          .querySelectorAll<HTMLElement>(".slot")
          .forEach((el) => cards.fit(el)),
      );
    });
  }
  async function choose(q: Question): Promise<string> {
    q = {...q,title:displayText(q.title),options:q.options.map(o=>({...o,label:displayText(o.label)}))};
    const node = dialog(q.title, i18n("请选择")),
      list = document.createElement("div"),
      picks = q.options.filter((option) => option.card).length;
    // cards lie in a tray and what else can be answered goes under it; words alone are a list
    const extra = picks ? document.createElement("div") : null;
    list.className = picks ? "solo-options sheet-tray" : "solo-options sheet-list";
    if (picks > 5) list.dataset.many = "";
    node.classList.toggle("has-cards", picks > 0);
    node.append(list);
    if (extra) extra.className = "solo-extra";
    return wait(node, (finish) => {
      q.options.forEach((option) => {
        const b = button(option.label, () => finish(option.id), option.card ? "solo-card-option sheet-pick" : extra ? "sheet-btn" : "sheet-row");
        b.dataset.choice = option.id;
        if (option.card) {
          const face = cards.face(option.card);
          b.prepend(face);
          requestAnimationFrame(() => cards.fit(face));
        } else if (!extra) {
          // "参加：双方掷骰，主办方+2" is a name and what it means
          const at = option.label.indexOf("：");
          const split = at > 0 && at <= 8 && at < option.label.length - 1;
          const name = document.createElement("span");
          name.className = "sheet-row-title";
          name.textContent = displayText(split ? option.label.slice(0, at) : option.label);
          b.replaceChildren(name);
          if (split) {
            const note = document.createElement("span");
            note.className = "sheet-row-note";
            note.textContent = displayText(option.label.slice(at + 1));
            b.append(note);
          }
        }
        (option.card || !extra ? list : extra).append(b);
      });
      if (extra?.childElementCount) node.append(extra);
    }, true);
  }
  async function reveal(ids: string[], title: string): Promise<void> {
    const node = dialog(title, ids.length ? i18n("公开的牌") : i18n("提示")),
      list = document.createElement("div");
    node.classList.add(ids.length ? "has-cards" : "solo-notice");
    list.className = "solo-reveal sheet-tray";
    if (ids.length > 5) list.dataset.many = "";
    for (const id of ids) {
      const face = cards.face(id);
      list.append(face);
      requestAnimationFrame(() => cards.fit(face));
    }
    if (ids.length) node.append(list);
    return wait(node, (finish) =>
      node.append(button(i18n("继续"), () => finish(undefined), "sheet-btn is-primary")),
      ids.length > 0,
    );
  }
  async function result(r: Result, state: Pick<MatchState, "turn" | "vp" | "log">): Promise<void> {
    const node = dialog(
      r.winner === null ? i18n("对局平局") : r.winner === 0 ? i18n("美国获胜") : i18n("苏联获胜"),
      i18n("对局结束"),
    );
    node.classList.add("solo-result");
    audio?.duck(4500);
    audio?.play(r.winner === null ? 'draw' : r.winner === player ? 'victory' : 'defeat');
    node.dataset.winner = String(r.winner);
    node.dataset.reason = r.reason;
    const detail = document.createElement("p");
    detail.className = "solo-detail";
    detail.textContent = i18n("{0} · 第 {1} 回合", [r.detail, state.turn]);
    node.append(detail);
    const vp = document.createElement("strong");
    vp.className = "solo-score";
    vp.textContent =
      displayText(state.vp === 0
        ? "0 VP"
        : `${state.vp > 0 ? "美国" : "苏联"} ${Math.abs(state.vp)} VP`);
    node.append(vp);
    const log = document.createElement("details"),
      summary = document.createElement("summary"),
      ol = document.createElement("ol");
    summary.textContent = i18n("查看对局记录");
    log.append(summary, ol);
    for (const line of state.log) {
      const li = document.createElement("li");
      li.textContent = displayText(line);
      ol.append(li);
    }
    node.append(log);
    return wait(node, (finish) => {
      node.append(
        button(i18n("查看棋盘"), () => finish(undefined)),
        button(i18n("再来一局"), () => {
          finish(undefined);
          restart();
        }, "sheet-btn is-primary"),
      );
    }, true);
  }
  return {
    ...base,
    choose,
    reveal,
    result,
    dispose() {
      disposed = true;
      for (const cancel of [...pending.values()]) cancel();
      base.dispose();
    },
  };
}

/** A separate menu does not consume or cancel the outstanding map/card decision. */
export async function gameMenu(
  hasSave: boolean,
): Promise<"resume" | "new" | "reload"> {
  const d = document.createElement("dialog");
  d.className = "solo-dialog solo-menu sheet";
  const head = document.createElement("header");
  head.className = "sheet-head";
  const h = document.createElement("h2");
  h.className = "sheet-title";
  h.textContent = i18n("单机对局");
  const p = document.createElement("p");
  p.className = "sheet-sub";
  p.textContent = i18n("每个行动结算后自动存档。重新载入会回到最近一次完整行动。");
  head.append(h, p);
  const list = document.createElement("div");
  list.className = "sheet-list";
  d.append(head, list);
  document.body.append(d);
  return new Promise((resolve) => {
    const finish = (value: "resume" | "new" | "reload") => {
      d.close();
      d.remove();
      resolve(value);
    };
    d.addEventListener("cancel", (e) => {
      e.preventDefault();
      finish("resume");
    });
    for (const [id, label] of [
      ["resume", i18n("继续对局")],
      ...(hasSave ? [["reload", i18n("载入最近存档")]] : []),
      ["new", i18n("开始新对局")],
    ] as const) {
      const b = document.createElement("button");
      b.className = "sheet-row";
      b.innerHTML = displayText('<span class="sheet-row-title"></span>');
      b.firstElementChild!.textContent = displayText(label);
      b.onclick = () => {
        if (id === "new") {
          h.textContent = i18n("开始新对局？");
          p.textContent = i18n("这会替换当前的单机存档。");
          list.remove();
          const yes = document.createElement("button");
          yes.className = "sheet-btn is-primary";
          yes.textContent = i18n("开始");
          yes.onclick = () => finish("new");
          const no = document.createElement("button");
          no.className = "sheet-btn";
          no.textContent = i18n("取消");
          no.onclick = () => finish("resume");
          d.append(no, yes);
        } else finish(id as "resume" | "reload");
      };
      list.append(b);
    }
    d.showModal();
  });
}
