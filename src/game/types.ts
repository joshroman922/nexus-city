import type { CrewMember, Lot, Race } from "@/lib/types";

export type RenderMod = {
  id: string;
  title: string;
  gx: number;
  gz: number;
  race: Race | null;
  status: string;
  truth: string;
  files: string[];
  open: string | null;
  raise: number;
  look: string | null;
  kind: "lot" | "infra";
  archiveLen: number;
  archive?: { length: number };
};

export type StationSync = {
  modules: RenderMod[];
  crew: CrewMember[];
  lots: Lot[];
  selectedId: string | null;
  mode: "orbit" | "eva";
};

export type StationHandle = {
  dispose: () => void;
  sync: (s: StationSync) => void;
  setUiBlock: (v: boolean) => void;
  setKeys: (codes: string[]) => void;
  getYaw: () => number;
  getSpeed: () => number;
  getPitch: () => number;
  setMode: (m: "orbit" | "eva") => void;
};
