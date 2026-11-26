export type SideIndex = 0 | 1;
export type AgentAction = {
  card: string;
  use: "event" | "ops" | "space";
  mode?: "place" | "coup" | "realign";
  target?: string;
};

export type AgentCard = {
  id: string;
  title: string;
  ops: number;
  owner: SideIndex | null;
  scoring: boolean;
  eventAllowed: boolean;
  eventValue: number;
  scoringDelta: number;
};
export type AgentCountry = {
  id: string;
  region: string | null;
  stability: number;
  battleground: boolean;
  influence: [number, number];
  controller: SideIndex | null;
  neighbors: string[];
};
export type LegalAction = AgentAction & {
  ops: number;
  success?: number;
  expectedSwing?: number;
  milopsNeeded?: number;
  eventRisk?: number;
  targetValue?: number;
};
/** JSON-only, seat-relative information. Never contains the opponent's hand or draw order. */
export type Observation = {
  version: 1;
  side: SideIndex;
  revealedOpponentCards: string[];
  turn: number;
  round: number;
  phase: string;
  vp: number;
  defcon: number;
  actionsRemaining: number;
  opponentHandCount: number;
  hand: AgentCard[];
  countries: AgentCountry[];
  space: [number, number];
  milops: [number, number];
  china: { owner: SideIndex; available: boolean };
  activeEvents: Record<string, number | string | boolean>;
  discard: string[];
  removed: string[];
  legalActions: LegalAction[];
  headlineCandidates: string[];
};
export type AgentChoice = {
  observation: Observation;
  title: string;
  options: { id: string; label: string; card?: string; score?: number }[];
};
export interface Agent {
  readonly id: string;
  chooseAction(observation: Observation): AgentAction | Promise<AgentAction>;
  chooseHeadline(observation: Observation): string | Promise<string>;
  chooseOption(choice: AgentChoice): string | Promise<string>;
}
