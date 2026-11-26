// Black-box HTTP/WebSocket test. Never uses internal server state or administrative endpoints.
import assert from "node:assert/strict";
import rawScenario from "../data/scenarios/coldwar/scenario.json";
import type { Scenario } from "../src/map/types";
import { decode, type Credential, type RoomMessage } from "../src/net/protocol";
import { testAnswer } from "../src/net/bot-test";
const base = (process.argv[2] ?? "http://localhost:8787").replace(/\/$/, "");
const games = Number(process.argv[3] ?? 1),
  scenario = rawScenario as unknown as Scenario;
async function post(path: string, body: unknown = {}) {
  return fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
class Seat {
  ws!: WebSocket;
  latest?: RoomMessage;
  error = "";
  maxBytes = 0;
  constructor(readonly c: Credential) {}
  async connect() {
    this.ws = new WebSocket(
      base.replace(/^http/, "ws") + `/api/room/${this.c.code}/socket`,
    );
    this.ws.onopen = () => this.send({ type: "auth", token: this.c.token });
    this.ws.onmessage = (e) => {
      if (e.data === "pong") return;
      this.maxBytes = Math.max(this.maxBytes, Buffer.byteLength(e.data));
      const m = decode<any>(e.data);
      if (m.type === "error") this.error = m.message;
      else this.latest = m;
    };
    await this.wait((s) => s.side === this.c.side);
  }
  send(msg: unknown) {
    this.ws.send(JSON.stringify(msg));
  }
  async wait(fn: (s: RoomMessage) => boolean) {
    const start = Date.now();
    while (Date.now() - start < 30000) {
      if (this.error) throw new Error(this.error);
      if (this.latest && fn(this.latest)) return this.latest;
      await new Promise((r) => setTimeout(r, 12));
    }
    throw new Error("server timed out");
  }
  async reopen() {
    this.ws.close();
    this.latest = undefined;
    await this.connect();
  }
}
function decision(m: RoomMessage) {
  const options = Object.values(m.options).filter((o) => !o.blocked),
    s = m.side;
  const scoring = options.find((o) => o.card.owner === "tally");
  if (scoring) return { card: scoring.card.id, use: "event" };
  // Favor safe events and influence, while exercising coup/space paths when available.
  const own = options
    .filter(
      (o) =>
        ["mine", "neutral"].includes(o.card.owner) &&
        o.event.ok &&
        !o.event.lethal,
    )
    .sort((a, b) => b.points - a.points)[0];
  if (own) return { card: own.card.id, use: "event" };
  const space = options.find((o) => o.space.ok);
  if (space) return { card: space.card.id, use: "space" };
  const o = options.sort((a, b) => b.points - a.points)[0];
  const coup = [...o.coup.targets]
    .filter(([, p]) => p.crisisTo > 1)
    .sort((a, b) => b[1].chance - a[1].chance)[0];
  if (coup && m.view.hud.milops[s] < m.view.hud.crisis)
    return { card: o.card.id, use: "ops", mode: "coup", target: coup[0] };
  if (o.place.ok) return { card: o.card.id, use: "ops", mode: "place" };
  if (coup)
    return { card: o.card.id, use: "ops", mode: "coup", target: coup[0] };
  return { card: o.card.id, use: "event" };
}
assert.equal((await fetch(base + "/api/health")).status, 200);
for (let game = 0; game < games; game++) {
  const a = (await (
    await post("/api/create", { side: game % 2 })
  ).json()) as Credential;
  const b = (await (
    await post(`/api/room/${a.code}/join`)
  ).json()) as Credential;
  assert.equal((await post(`/api/room/${a.code}/join`)).status, 409);
  const bad = new WebSocket(
    base.replace(/^http/, "ws") + `/api/room/${a.code}/socket`,
  );
  bad.onopen = () => bad.send(JSON.stringify({ type: "auth", token: "wrong" }));
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error("unauthorized socket stayed open")),
      10000,
    );
    bad.onclose = (e) => {
      clearTimeout(t);
      assert.equal(e.code, 4001);
      resolve();
    };
  });
  const seats = [new Seat(a), new Seat(b)].sort((a, b) => a.c.side - b.c.side);
  await Promise.all(seats.map((s) => s.connect()));
  let steps = 0,
    headlineVerified = false;
  while (!seats[0].latest!.view.result && steps++ < 1600) {
    const ready = seats.filter((s) => s.latest!.prompt);
    assert.ok(ready.length, "room stalled");
    const seat = ready[steps % ready.length],
      m = seat.latest!,
      p = m.prompt!;
    assert.equal(p.side, seat.c.side);
    assert.equal(Object.hasOwn(m.view, "rng"), false);
    assert.equal(Object.hasOwn(m, "state"), false);
    let value: unknown;
    if (p.method === "decide") value = decision(m);
    else if (p.method === "pickHeadline")
      value = Object.values(m.options)
        .filter(
          (o) =>
            m.view.hud.hand.includes(o.card.id) &&
            !["006", "032"].includes(o.card.id),
        )
        .sort(
          (a, b) =>
            (b.card.owner === "mine" ? 10 : 0) +
            b.points -
            ((a.card.owner === "mine" ? 10 : 0) + a.points),
        )[0].card.id;
    else value = await testAnswer(p, m.view, scenario);
    const msg = {
        type: "answer",
        promptId: p.id,
        value,
        requestId: crypto.randomUUID(),
      },
      rev = m.revision;
    seat.send(msg);
    await Promise.all(seats.map((s) => s.wait((x) => x.revision > rev)));
    assert.deepEqual(seats[0].latest!.view.map, seats[1].latest!.view.map);
    assert.equal(seats[0].latest!.view.hud.vp, seats[1].latest!.view.hud.vp);
    const publicLogs = seats.map((s) => (s.latest!.view.hud.battleLog ?? []).map((entry) => ({
      ...entry,
      lines: entry.lines.filter((line) => line.kind !== "reveal"),
    })));
    assert.deepEqual(publicLogs[0], publicLogs[1]);
    for (const s of seats) {
      for (const entry of s.latest!.view.hud.battleLog ?? []) {
        for (const line of entry.lines) {
          if (line.kind === "reveal") assert.equal(line.reveal.viewer, s.c.side, "revealed hand history stays private to its viewer");
        }
      }
    }
    assert.ok(seats[0].latest!.view.hud.battleLog?.length, 'public battle journal is present');
    assert.ok(seats.every(s => s.latest!.frames.every(f => f.view.hud.battleLog === undefined)), 'animation frames do not duplicate full history');
    if (p.method === "pickHeadline" && ready.length === 2) {
      const peer = seats[1 - p.side].latest!;
      assert.ok(peer.prompt?.method === "pickHeadline");
      assert.equal(
        peer.frames.some((f) => f.method === "showHeadline"),
        false,
      );
      headlineVerified = true;
    }
    if (steps === 12) {
      const before = structuredClone(seat.latest);
      await seat.reopen();
      assert.deepEqual(seat.latest!.view, before!.view);
      assert.deepEqual(seat.latest!.prompt, before!.prompt);
      seat.send(msg);
      await new Promise((r) => setTimeout(r, 100));
      assert.equal(seat.latest!.revision, before!.revision);
    }
    if (steps % 50 === 0)
      console.log(
        JSON.stringify({
          game: game + 1,
          steps,
          turn: seats[0].latest!.view.hud.turn,
        }),
      );
  }
  assert.ok(seats[0].latest!.view.result);
  assert.deepEqual(seats[0].latest!.view.result, seats[1].latest!.view.result);
  assert.ok(headlineVerified);
  console.log(
    JSON.stringify({
      game: game + 1,
      steps,
      turn: seats[0].latest!.view.hud.turn,
      result: seats[0].latest!.view.result,
      maxMessageBytes: Math.max(...seats.map((s) => s.maxBytes)),
      checks: [
        "room-full",
        "auth",
        "private-headlines",
        "reconnect",
        "duplicate-request",
        "public-state-agreement",
        "public-battle-log-agreement",
        "private-reveal-history",
      ],
    }),
  );
  for (const s of seats) s.ws.close();
}
