export const GRID = 15;
export const CELL = 5.4;
export const MAX_SPEED = 8.4;
export const TURN_RATE = 2.8;

export type BuildingKind =
  | "core"
  | "archive"
  | "foundry"
  | "forge"
  | "hatchery"
  | "vault"
  | "studio"
  | "lab"
  | "needle"
  | "reactor"
  | "app"
  | "system"
  | "design";

export type Race = "claude" | "grok" | "gemini" | "meta";
export type GemKind = Race;
export type PopKind = "agent" | "gem" | "bot";
export type Duty = "build" | "file" | "patrol";

export type Domain =
  | "civic"
  | "body"
  | "money"
  | "lab"
  | "system"
  | "game"
  | "agent"
  | "tool"
  | "idea"
  | "comms";

export type WorkStatus = "works" | "incomplete" | "broken" | "talked";

export type Look =
  | "hall"
  | "library"
  | "clinic"
  | "vault"
  | "tower"
  | "house"
  | "factory"
  | "spire"
  | "scaffold"
  | "mill"
  | "arcade"
  | "antenna"
  | "chapel"
  | "labglass"
  | "clocktower"
  | "greenhouse"
  | "radio"
  | "labtank"
  | "mint"
  | "exchange"
  | "storefront"
  | "fortress"
  | "theatre"
  | "globe"
  | "radar"
  | "kiosk"
  | "command"
  | "townhouse"
  | "forge"
  | "observatory"
  | "monument"
  | "table"
  | "bunker"
  | "phone";

export type ItemKind = "file" | "app" | "skill" | "note" | "link" | "experiment" | "wip";

export type FileSource = "phone" | "drive" | "github" | "notion";

export type AuthorRace = Race | "you";

export type Addition = {
  id: string;
  race: AuthorRace;
  agentId: string;
  agentName: string;
  text: string;
  createdAt: number;
};

export type WorkLink = {
  kind: "html" | "github" | "drive" | "notion" | "pages" | "file";
  label: string;
  url: string;
};

export type DistrictMode = "explore" | "build";
export type CameraView = "walk" | "fly";

export type Item = {
  id: string;
  kind: ItemKind;
  name: string;
  detail?: string;
  source?: FileSource;
  remoteId?: string;
  url?: string;
  body?: string;
  additions?: Addition[];
  createdAt: number;
  /** When set, this file only runs in that system — color-coded. Shared files leave this empty. */
  lockedTo?: Race;
};

export type PlacedBuilding = {
  id: string;
  kind: BuildingKind;
  gx: number;
  gz: number;
  title: string;
  blurb?: string;
  items: Item[];
  slug?: string;
  domain?: Domain;
  status?: WorkStatus;
  look?: Look;
  links?: WorkLink[];
  race?: Race;
  /** Which systems can actually use this. Empty/omit = all four. */
  usableBy?: Race[];
  /** 0–100. Crew assigned to complete the lot push this. */
  progress?: number;
};

export type ChatLine = {
  id: string;
  speaker: AuthorRace;
  agentId?: string;
  name: string;
  text: string;
  at: number;
};

export type SavedAgent = {
  id: string;
  race: Race;
  name: string;
  task: string;
  jobsDone: number;
  homeId?: string;
  kind: PopKind;
  duty?: Duty;
  assignedId?: string;
  chat?: ChatLine[];
};

/** @deprecated persisted v1 shape */
export type SavedGem = SavedAgent;

export type PersistState = {
  version: 10;
  energy: number;
  buildings: PlacedBuilding[];
  agents: SavedAgent[];
  table: ChatLine[];
};

export type WorldPin = {
  id: string;
  kind: "agent" | "building";
  race?: Race;
  domain?: Domain;
  title: string;
  subtitle: string;
  x: number;
  y: number;
  visible: boolean;
};

export type EngineHud = {
  nearbyId: string | null;
  nearbyLabel: string | null;
  nearbyKind: "building" | "agent" | null;
  canPlace: boolean;
  hoverGx: number | null;
  hoverGz: number | null;
  jobsLive: number;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  playerSpeed: number;
  view: CameraView;
  pins: WorldPin[];
  lastNote: { agent: string; race: AuthorRace; file: string } | null;
};

export type NexusWorkInput = {
  nexusWork?: 1;
  title: string;
  blurb?: string;
  domain?: Domain;
  status?: WorkStatus;
  look?: Look;
  race?: Race;
  usableBy?: Race[];
  links?: WorkLink[];
};

export type ControlsProbe = {
  getYaw: () => number;
  getSpeed: () => number;
  setSteer?: (v: number) => void;
  setKeys?: (codes: string[]) => void;
};

declare global {
  interface Window {
    __controlsTest?: ControlsProbe;
    __nexus?: {
      placeAt: (gx: number, gz: number) => boolean;
      interact: () => void;
      setView: (view: CameraView) => void;
      getView: () => CameraView;
      importWork: (work: NexusWorkInput) => string | null;
      exportWorks: () => unknown;
    };
  }
}
