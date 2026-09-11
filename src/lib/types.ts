export type Race = "claude" | "grok" | "gemini" | "meta";

export type LotStatus = "works" | "incomplete" | "talked" | "broken";

export type ArchiveFile = {
  name: string;
  html: string;
  at: string;
};

export type LotLink = {
  kind: string;
  label: string;
  url: string;
};

export type Lot = {
  id: string;
  title: string;
  status: LotStatus;
  truth: string;
  runs: boolean;
  open: string | null;
  race: Race | null;
  files: string[];
  gx: number;
  gz: number;
  seeded: boolean;
  kind: "lot" | "infra";
  raise: number;
  archive: ArchiveFile[];
  blurb: string;
  domain: string | null;
  usableBy: Race[];
  look: string | null;
  links: LotLink[];
};

export type Infra = {
  id: string;
  title: string;
  blurb: string;
  gx: number;
  gz: number;
  look: string;
};

export type CrewMember = {
  name: string;
  kind: string;
  race: Race;
  duty: string;
  task: string;
  assignedTo: string | null;
};

export type LogEntry = {
  at: string;
  kind: string;
  file: string;
  building: string;
  by: string | null;
};

export type Claims = {
  nothingExists: boolean;
  chatHasNoBrowser: boolean;
  canFindThisFile: boolean;
  canSeeTheCity: boolean;
  notionConnected: boolean;
  notionIsProof: boolean;
  proofIs: string;
};

export type NexusWork = {
  nexusWork: number;
  title: string;
  blurb: string;
  domain: string;
  status: string;
  look?: string;
  race?: string | null;
  usableBy?: string[];
  links?: LotLink[];
};

export type LedgerRow = {
  id: string;
  title: string;
  note: string;
  at: string;
};

export type PanelId =
  | "ops"
  | "table"
  | "proof"
  | "forge"
  | "factory"
  | "roster"
  | "archive"
  | null;
