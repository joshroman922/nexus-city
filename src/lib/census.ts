import laid from "@/data/lots-laid.json";
import { SOURCE_ON_GITHUB } from "./persistence";
import { linksFromOpen } from "./honest";
import type { Claims, CrewMember, Infra, LogEntry, Lot, Race } from "./types";

export const GRID = 15;
export const CELL = 5.4;

export const CENSUS = {
  buildings: laid.buildings as number,
  crew: laid.crewCount as number,
  files: laid.files as number,
  at: laid.at as string,
  honesty: laid.honesty as string,
  freshness: laid.freshness as string,
};

export const CLAIMS = laid.claims as Claims;

export const GITHUB_META = laid.github as {
  repo: string;
  raw: string;
  public: boolean;
};

export function cellToWorld(gx: number, gz: number): { x: number; z: number } {
  const c = (GRID - 1) / 2;
  return { x: (gx - c) * CELL, z: (gz - c) * CELL };
}

function seedLot(raw: (typeof laid.lots)[number]): Lot {
  const open = (raw.open as string | null) ?? null;
  const files = [...raw.files];
  let truth = raw.truth;
  let status = raw.status as Lot["status"];

  if (raw.id === "nexus" && SOURCE_ON_GITHUB) {
    truth = "Source on GitHub — still incomplete as a hosted app";
  }

  return {
    id: raw.id,
    title: raw.title,
    status,
    truth,
    runs: raw.runs,
    open: raw.id === "nexus" && SOURCE_ON_GITHUB ? GITHUB_META.repo : open,
    race: (raw.race as Race | null) ?? null,
    files:
      raw.id === "nexus" && SOURCE_ON_GITHUB && !files.includes("GitHub")
        ? [...files, "GitHub"]
        : files,
    gx: raw.gx,
    gz: raw.gz,
    seeded: true,
    kind: "lot",
    raise: 0,
    archive: [],
    blurb: raw.blurb || raw.truth,
    domain: (raw.domain as string | null) ?? null,
    usableBy: (raw.usableBy as Race[]) ?? [],
    look: (raw.look as string | null) ?? null,
    links: linksFromOpen(raw.title, open, files),
  };
}

export const SEED_LOTS: Lot[] = laid.lots.map(seedLot);

export const INFRA: Infra[] = laid.infra.map((i) => ({
  id: i.id,
  title: i.title,
  blurb: i.blurb,
  gx: i.gx,
  gz: i.gz,
  look: i.look,
}));

export const SEED_CREW: CrewMember[] = laid.crew.map((c) => ({
  name: c.name,
  kind: c.kind,
  race: c.race as Race,
  duty: c.duty,
  task: c.task,
  assignedTo: null,
}));

export const SEED_LOG: LogEntry[] = laid.lastWrites.map((w) => ({
  at: w.at,
  kind: w.kind,
  file: w.file,
  building: w.building,
  by: w.by,
}));

export function occupiedCells(lots: Lot[]): Set<string> {
  const s = new Set<string>();
  for (const i of INFRA) {
    if (i.id !== "archive-vault") s.add(`${i.gx},${i.gz}`);
  }
  for (const l of lots) s.add(`${l.gx},${l.gz}`);
  return s;
}

export function findEmptyCell(lots: Lot[]): { gx: number; gz: number } {
  const used = occupiedCells(lots);
  const pads: [number, number][] = [
    [1, 1],
    [13, 1],
    [13, 13],
  ];
  for (const [gx, gz] of pads) {
    if (!used.has(`${gx},${gz}`)) return { gx, gz };
  }
  const c = 7;
  for (let r = 0; r < GRID; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (r > 0 && Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const gx = c + dx;
        const gz = c + dz;
        if (gx < 0 || gz < 0 || gx >= GRID || gz >= GRID) continue;
        if (!used.has(`${gx},${gz}`)) return { gx, gz };
      }
    }
  }
  return { gx: 0, gz: 0 };
}

export function fileCount(lots: Lot[], extraArchive: number): number {
  let n = 0;
  for (const l of lots) {
    for (const f of l.files) {
      if (f && f !== "Talked about" && f !== "No file yet") n += 1;
    }
    n += l.archive.length;
  }
  return Math.max(CENSUS.files, n) + extraArchive;
}

export function buildingCount(extraLots: number): number {
  return CENSUS.buildings + extraLots;
}
