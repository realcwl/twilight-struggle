import type { HudState, SideIndex } from "../hud/types";
import type { MapState } from "../map/types";
import type { Result } from "../game/solo/model";
import type { CardOptions, WaitingHeadline } from "../play/types";
/** Only protocol payloads cross the wire; MatchState must never be sent to a browser. */
export type View = {
  hud: HudState;
  map: MapState;
  result: Result | null;
  log: string[];
  headline?: WaitingHeadline;
};
export type Prompt = {
  id: string;
  side: SideIndex;
  method:
    | "decide"
    | "pickHeadline"
    | "choose"
    | "pickTarget"
    | "place"
    | "reveal";
  args: any[];
};
export type Frame = {
  method: string;
  args: any[];
  audience: SideIndex | "all";
  views: [View, View];
};
export type SeatFrame = Omit<Frame, "views" | "audience"> & { view: View };
export type RoomMessage = {
  type: "state";
  code: string;
  revision: number;
  side: SideIndex;
  joined: boolean;
  connected: [boolean, boolean];
  view: View;
  prompt: Prompt | null;
  options: Record<string, CardOptions>;
  frames: SeatFrame[];
};
export type Credential = { code: string; token: string; side: SideIndex };
export type ChatEntry = {
  seq: number;
  requestId: string;
  side: SideIndex;
  text: string;
  at: number;
};
export type ChatPacket =
  | { type: "chat"; entry: ChatEntry }
  | { type: "chat-history"; entries: ChatEntry[] }
  | { type: "chat-error"; requestId: string; message: string };
export function encode(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v instanceof Map ? { $map: [...v] } : v,
  );
}
export function decode<T>(s: string): T {
  return JSON.parse(s, (_k, v) =>
    v && Array.isArray(v.$map) ? new Map(v.$map) : v,
  );
}
