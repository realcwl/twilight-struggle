// Data contracts for the map module. Shared by the runtime and tools/mapgen.
import type { Language } from '../i18n/index.js';
import type { ScoringSummary } from '../play/types';

export type Lang = Language;
export type Localized = Record<Lang, string>;
export type SideIndex = 0 | 1;
export type LinkKind = 'land' | 'sea' | 'regional' | 'inter-regional' | 'superpower';

export type Side = { id: string; name: Localized; short: Localized; color: string };
export type Region = { id: string; name: Localized; labelAt?: [lon: number, lat: number] };

export type Country = {
  id: string;
  name: Localized;
  /** Scoring region; superpowers are outside all scoring regions. */
  region: string | null;
  /** The corresponding node in the audited board reference, when supplied. */
  referenceId?: string;
  subregions?: ('western-europe' | 'eastern-europe' | 'southeast-asia')[];
  /** Fixed home side. Superpowers have no playable influence or stability (stored as 0). */
  superpower?: SideIndex;
  /** Geographic polygons that make up this node. `adm0:XXX`, `unit:XXX` (Natural Earth codes) or `custom:id`. */
  shapes: string[];
  stability: number;
  key: boolean;
  /** A point well inside the country, used for framing. Computed by mapgen when omitted. */
  anchor?: [lon: number, lat: number];
  /** Where the country's node sits on the board. By default mapgen starts at the anchor and eases crowded nodes apart. */
  node?: [lon: number, lat: number];
};

export type Link = {
  a: string;
  b: string;
  kind: LinkKind;
  /** Draw one connection in two pieces at the map edges, e.g. USA–Japan across the Pacific. */
  wrap?: boolean;
};

/** Static scenario data: decides what the map looks like. */
export type Scenario = {
  id: string;
  name: Localized;
  sides: [Side, Side];
  regions: Region[];
  countries: Country[];
  links: Link[];
};

/** What a scenario author writes. */
export type ScenarioSource = Scenario & {
  note?: string;
  customShapes?: string;
  /**
   * 'derive' (default): every shared border becomes a land link, and `links` only adds sea links.
   * 'thinned': as 'derive', then the longest side of every triangle of bordering countries is dropped,
   *   which leaves a much sparser board that is still connected.
   * 'manual': `links` is the whole connection graph, for a designed board where not every border connects.
   */
  landLinks?: 'derive' | 'thinned' | 'manual';
};

export type CountryState = {
  influence: [number, number];
  controller: SideIndex | null;
  /** Effective scoring status. Event bonuses do not change coup/DEFCON rules. */
  scoringKey?: boolean;
  /** How many more points the other side needs to flip control. */
  flipMargin?: number;
};

export const isScoringBattleground = (country: Country, state: MapState): boolean =>
  state.countries[country.id]?.scoringKey ?? country.key;

/** Dynamic situation data. Supplied by the sandbox panel today, by the rules engine later. */
export type MapState = {
  countries: Record<string, CountryState>;
  regions: Record<string, { status: [string, string]; scoring?: ScoringSummary }>;
};

export type HighlightKind = 'target' | 'warn';

export type TextureInfo = { file: string; width: number; height: number };

/** Output of tools/mapgen for one scenario: everything the runtime loads. */
export type MapPack = {
  format: 1;
  scenario: Scenario;
  /** World-space size of the map plane. x runs east, z runs south, y is up. */
  world: { width: number; height: number; relief: number };
  projection: { kind: 'miller'; lon0: number; latSouth: number; latNorth: number };
  textures: {
    /** R = territory index (0 = water), G = index of the territory across the nearest border. */
    ids: TextureInfo;
    /** Distance to the nearest territory border or coast, 0..encoding.edgeRange. */
    edge: TextureInfo;
    /** Signed distance to the coast, +land, clamped to +-encoding.coastRange. */
    coast: TextureInfo;
    /** Distance from open water to the nearest land, 0..encoding.seaRange. */
    sea: TextureInfo;
    /** Terrain height, 0..1 of world.relief. */
    height: TextureInfo;
    /** Sea-floor depth, 0..1 (square root of depth / 6000 m). */
    depth: TextureInfo;
    albedo: TextureInfo;
    shade: TextureInfo;
  };
  /** Ranges of the distance textures, in world units. */
  encoding: { edgeRange: number; coastRange: number; seaRange: number };
  /** Number of territory indices in use, including land that is not part of the scenario. */
  indexCount: number;
  countries: {
    id: string;
    index: number;
    /** A point well inside the country. */
    anchor: [x: number, z: number];
    /** Where the node is drawn; links run between these. */
    node: [x: number, z: number];
    /** Bounds of the main landmass, used for framing. */
    bbox: [x0: number, z0: number, x1: number, z1: number];
    area: number;
  }[];
  regions: {
    id: string;
    center: [x: number, z: number];
    bbox: [x0: number, z0: number, x1: number, z1: number];
  }[];
  fonts: { display: string; text: string };
  /** FNV-1a hash of the decoded index pixels, so the runtime can prove the browser decoded them exactly. */
  checks: { ids: number };
};
