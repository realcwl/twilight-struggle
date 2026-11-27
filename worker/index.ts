import type * as CF from "@cloudflare/workers-types/index";
type Request = CF.Request;
type Response = CF.Response;
type WebSocket = CF.WebSocket;
type DurableObjectState = CF.DurableObjectState;
type DurableObjectNamespace = CF.DurableObjectNamespace;
type Fetcher = CF.Fetcher;
type RateLimit = CF.RateLimit;
type ExportedHandler<E> = CF.ExportedHandler<E>;
declare const Request: typeof CF.Request,
  Response: typeof CF.Response,
  Headers: typeof CF.Headers;
declare const WebSocketPair: typeof CF.WebSocketPair,
  WebSocketRequestResponsePair: typeof CF.WebSocketRequestResponsePair;
import rawScenario from "../data/scenarios/coldwar/scenario.json";
import type { Scenario } from "../src/map/types";
import {
  evaluate,
  newJournal,
  resign,
  type Evaluation,
  type Journal,
} from "../src/net/replay";
import { encode, type RoomMessage } from "../src/net/protocol";
import type { SideIndex } from "../src/hud/types";
import { byteRange } from "./range";
import { acceptChat, type ChatState } from "../src/net/chat-state";
const scenario = rawScenario as unknown as Scenario;
interface Env {
  PAGES_ORIGIN: string;
  ROOMS: DurableObjectNamespace;
  ASSETS: Fetcher;
  ROOM_LIMIT: RateLimit;
}
type RoomData = {
  version: 1;
  code: string;
  host: SideIndex;
  tokens: [string | null, string | null];
  joined: boolean;
  journal: Journal;
  revision: number;
  updated: number;
  receipts: string[];
};
const ttl = 7 * 24 * 60 * 60 * 1000;
const random = () => crypto.randomUUID() + crypto.randomUUID();
const hash = async (s: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export class GameRoom {
  private room?: RoomData;
  private cache?: Evaluation;
  private serial: Promise<unknown> = Promise.resolve();
  private chat: ChatState = { seq: 0, entries: [] };
  constructor(private ctx: DurableObjectState) {
    ctx.blockConcurrencyWhile(async () => {
      this.room = await ctx.storage.get<RoomData>("room");
      this.chat = (await ctx.storage.get<ChatState>("chat")) ?? this.chat;
    });
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong"),
    );
  }
  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const task = this.serial.then(fn);
    this.serial = task.catch(() => {});
    return task;
  }
  private async save() {
    this.room!.updated = Date.now();
    await this.ctx.storage.put("room", this.room!);
    await this.ctx.storage.setAlarm(this.room!.updated + ttl);
  }
  private async current() {
    return (this.cache ??= await evaluate(scenario, this.room!.journal));
  }
  private packet(
    side: SideIndex,
    e: Evaluation,
    animate: boolean,
  ): RoomMessage {
    const r = this.room!;
    const connected = ([0, 1] as SideIndex[]).map((s) =>
      this.ctx
        .getWebSockets()
        .some((w) => w.deserializeAttachment()?.side === s),
    ) as [boolean, boolean];
    return {
      type: "state",
      code: r.code,
      revision: r.revision,
      side,
      joined: r.joined,
      connected,
      view: e.views[side],
      options: e.options[side],
      prompt: r.joined
        ? (e.prompts.find((p) => p.side === side) ?? null)
        : null,
      frames: animate
        ? e.frames
            .filter((f) => f.audience === "all" || f.audience === side)
            .map((f) => ({
              method: f.method,
              args: f.args,
              view: f.views[side],
            }))
        : [],
    };
  }
  private async broadcast(animate = false) {
    if (!this.room) return;
    const e = await this.current();
    for (const ws of this.ctx.getWebSockets()) {
      const side = ws.deserializeAttachment()?.side;
      if (side === 0 || side === 1) {
        try {
          ws.send(encode(this.packet(side, e, animate)));
        } catch {
          /* disconnected */
        }
      }
    }
  }
  fetch(request: Request): Promise<Response> {
    return this.exclusive(async () => {
      const path = new URL(request.url).pathname;
      if (path.endsWith("/create") && request.method === "POST") {
        if (this.room) return json({ error: "房间码冲突" }, 409);
        const { code, side } = (await request.json()) as {
          code: string;
          side: SideIndex;
        };
        const token = random();
        this.chat = { seq: 0, entries: [] };
        this.room = {
          version: 1,
          code,
          host: side,
          tokens: [null, null],
          joined: false,
          journal: newJournal(
            scenario,
            crypto.getRandomValues(new Uint32Array(1))[0],
          ),
          revision: 0,
          updated: Date.now(),
          receipts: [],
        };
        this.room.tokens[side] = await hash(token);
        await this.save();
        return json({ code, side, token });
      }
      if (!this.room || Date.now() - this.room.updated > ttl)
        return json({ error: "房间不存在或已过期" }, 404);
      if (path.endsWith("/status") && request.method === "GET") return json({exists:true});
      if (path.endsWith("/join") && request.method === "POST") {
        if (this.room.joined)
          return json({ error: "房间已满。原玩家请在原浏览器继续对局。" }, 409);
        const side = (1 - this.room.host) as SideIndex,
          token = random();
        this.room.tokens[side] = await hash(token);
        this.room.joined = true;
        this.cache = await evaluate(scenario, this.room.journal);
        this.room.journal = this.cache.journal;
        this.room.revision++;
        await this.save();
        await this.broadcast();
        return json({ code: this.room.code, side, token });
      }
      if (
        path.endsWith("/socket") &&
        request.headers.get("Upgrade")?.toLowerCase() === "websocket"
      ) {
        if (this.ctx.getWebSockets().length >= 16)
          return json({ error: "连接过多，请稍后重试" }, 429);
        const pair = new WebSocketPair();
        this.ctx.acceptWebSocket(pair[1]);
        pair[1].serializeAttachment({ side: null });
        return new Response(null, { status: 101, webSocket: pair[0] });
      }
      return json({ error: "Not found" }, 404);
    });
  }
  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    await this.exclusive(async () => {
      try {
        if (typeof raw !== "string" || raw.length > 16384 || !this.room)
          throw new Error("消息格式错误");
        const msg = JSON.parse(raw);
        if (msg.type === "auth") {
          if (typeof msg.token !== "string" || msg.token.length > 200)
            throw new Error("身份凭证无效");
          const digest = await hash(msg.token),
            side = this.room.tokens.indexOf(digest);
          if (side !== 0 && side !== 1) {
            ws.close(4001, "身份凭证无效");
            return;
          }
          ws.serializeAttachment({ side, chat: msg.chat === true });
          await this.broadcast();
          // Opt-in keeps already-open clients from interpreting chat packets as game errors.
          if (msg.chat === true) ws.send(encode({ type: "chat-history", entries: this.chat.entries }));
          return;
        }
        const side: SideIndex | undefined = ws.deserializeAttachment()?.side;
        if (side !== 0 && side !== 1) {
          ws.close(4001, "请先验证身份");
          return;
        }
        if (msg.type === "chat-send") {
          try {
            if (!ws.deserializeAttachment()?.chat) throw new Error("请刷新页面后使用聊天");
            const next = acceptChat(this.chat, side, msg, Date.now());
            if (!next.duplicate) {
              await this.ctx.storage.put("chat", next.state);
              this.chat = next.state;
            }
            const packet = encode({ type: "chat", entry: next.entry });
            for (const peer of next.duplicate ? [ws] : this.ctx.getWebSockets()) {
              const seat = peer.deserializeAttachment();
              if (seat?.chat && (seat.side === 0 || seat.side === 1)) {
                try { peer.send(packet); } catch { /* disconnected; history restores delivery */ }
              }
            }
          } catch (e) {
            ws.send(encode({ type: "chat-error", requestId: typeof msg.requestId === 'string' ? msg.requestId : '', message: e instanceof Error ? e.message : '发送失败，请重试' }));
          }
          return;
        }
        if (msg.type === "sync") {
          ws.send(encode(this.packet(side, await this.current(), false)));
          return;
        }
        if (typeof msg.requestId !== "string" || msg.requestId.length > 100)
          throw new Error("请求编号无效");
        if (this.room.receipts.includes(msg.requestId)) {
          ws.send(encode(this.packet(side, await this.current(), false)));
          return;
        }
        if (!this.room.joined) throw new Error("等待另一名玩家加入");
        const before = await this.current();
        if (before.views[side].result) throw new Error("对局已结束");
        let next: Evaluation;
        if (msg.type === "resign") {
          next = resign(scenario, before, side);
        } else if (msg.type === "answer") {
          const p = before.prompts.find(
            (p) => p.id === msg.promptId && p.side === side,
          );
          if (!p) throw new Error("这个选择已处理，请等待最新局面");
          const journal = structuredClone(this.room.journal);
          journal.answers[p.id] = msg.value;
          // Validation and all random outcomes run on an isolated candidate before commit.
          next = await evaluate(scenario, journal);
        } else throw new Error("未知请求");
        const candidate = {
          ...this.room,
          journal: next.journal,
          revision: this.room.revision + 1,
          receipts: [...this.room.receipts.slice(-127), msg.requestId],
        };
        await this.ctx.storage.put("room", {
          ...candidate,
          updated: Date.now(),
        });
        this.room = candidate;
        this.cache = next;
        await this.save();
        await this.broadcast(true);
      } catch (e) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: e instanceof Error ? e.message : "操作失败",
          }),
        );
      }
    });
  }
  async webSocketClose(ws: WebSocket) {
    try {
      ws.close();
    } catch {}
    await this.exclusive(() => this.broadcast());
  }
  async webSocketError(ws: WebSocket) {
    try {
      ws.close(1011, "连接中断");
    } catch {}
  }
  async alarm() {
    await this.exclusive(async () => {
      if (this.room && Date.now() - this.room.updated >= ttl) {
        for (const ws of this.ctx.getWebSockets()) ws.close(4004, "房间已过期");
        await this.ctx.storage.deleteAll();
        this.room = undefined;
        this.cache = undefined;
        this.chat = { seq: 0, entries: [] };
      }
    });
  }
}
async function asset(request: Request, env: Env) {
  const url = new URL(request.url);
  if (url.pathname === "/") url.pathname = "/online.html";
  const response = await env.ASSETS.fetch(new Request(url, request));
  // Safari's MP4/AAC decoders expect byte-range support, including tail requests.
  const range = request.headers.get("Range");
  if (
    response.ok &&
    range &&
    /\.(mp4|m4a)$/.test(url.pathname) &&
    request.method === "GET" &&
    /^bytes=(?:\d+-\d*|-\d+)$/.test(range) &&
    response.status === 200
  ) {
    const data = await response.arrayBuffer(),
      bounds = byteRange(range, data.byteLength);
    if (!bounds)
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${data.byteLength}` },
      });
    const { start, end } = bounds;
    const headers = new Headers(response.headers);
    headers.set("Content-Range", `bytes ${start}-${end}/${data.byteLength}`);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Content-Length", String(end - start + 1));
    return new Response(data.slice(start, end + 1), { status: 206, headers });
  }
  return response;
}
async function roomRequest(request: Request, env: Env, url: URL): Promise<Response> {
  if (+(request.headers.get("Content-Length") ?? 0) > 16384)
    return json({ error: "请求过大" }, 413);
  if (url.pathname === "/api/create" || url.pathname.endsWith("/join")) {
    if (
      !(
        await env.ROOM_LIMIT.limit({
          key: request.headers.get("CF-Connecting-IP") ?? "local",
        })
      ).success
    )
      return json({ error: "请求过于频繁，请稍后再试" }, 429);
  }
  if (url.pathname === "/api/create" && request.method === "POST") {
    const body = (await request.json()) as { side?: number };
    const side = body.side === 1 ? 1 : 0;
    const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    for (let i = 0; i < 3; i++) {
      const code = Array.from(
        crypto.getRandomValues(new Uint8Array(8)),
        (n) => alphabet[n % alphabet.length],
      ).join("");
      const result = await env.ROOMS.getByName(code).fetch(
        new Request(`${url.origin}/create`, {
          method: "POST",
          body: JSON.stringify({ code, side }),
        }),
      );
      if (result.status !== 409) return result;
    }
    return json({ error: "创建失败，请重试" }, 503);
  }
  const match = /^\/api\/room\/([A-Z2-9]{8})\/(join|socket|status)$/.exec(
    url.pathname,
  );
  if (match) return env.ROOMS.getByName(match[1]).fetch(request);
  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return asset(request, env);
    const origin = request.headers.get("Origin");
    const fromPages = !!origin && origin === env.PAGES_ORIGIN;
    if (origin && origin !== url.origin && !fromPages)
      return json({ error: "来源不允许" }, 403);

    if (fromPages && request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST",
        "Access-Control-Allow-Headers": "Content-Type",
        "Vary": "Origin",
      } });

    const response = url.pathname === "/api/health"
      ? json({ ok: true, protocol: 1 })
      : await roomRequest(request, env, url);
    // The upgrade response owns the live socket and must be returned intact.
    if (!fromPages || response.status === 101) return response;
    const corsResponse = new Response(response.body, response);
    corsResponse.headers.set("Access-Control-Allow-Origin", origin);
    corsResponse.headers.append("Vary", "Origin");
    return corsResponse;
  },
} satisfies ExportedHandler<Env>;
