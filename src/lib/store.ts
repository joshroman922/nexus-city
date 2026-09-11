import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  CENSUS,
  CLAIMS,
  findEmptyCell,
  GITHUB_META,
  SEED_CREW,
  SEED_LOG,
  SEED_LOTS,
} from "./census";
import { asRace, honestNewWork, isPlaceholderFile } from "./honest";
import { SOURCE_ON_GITHUB } from "./persistence";
import { slug } from "./utils";
import type {
  ArchiveFile,
  CrewMember,
  LedgerRow,
  LogEntry,
  Lot,
  NexusWork,
  PanelId,
} from "./types";

type RaiseMap = Record<string, number>;
type ArchiveMap = Record<string, ArchiveFile[]>;
type AssignMap = Record<string, string | null>;

type State = {
  extraLots: Lot[];
  raise: RaiseMap;
  archive: ArchiveMap;
  assigned: AssignMap;
  ledger: LedgerRow[];
  log: LogEntry[];
  entered: boolean;
  panel: PanelId;
  selectedId: string | null;
  talkingCrew: string | null;
  sourceOnGithub: boolean;
  pasteError: string | null;
  enter: () => void;
  setPanel: (p: PanelId) => void;
  select: (id: string | null) => void;
  talkCrew: (name: string | null) => void;
  assignCrew: (name: string, lotId: string | null) => void;
  raiseLot: (id: string) => void;
  forgeFile: (id: string) => ArchiveFile | null;
  pasteWork: (raw: string) => Lot | null;
  addLedger: (title: string, note: string) => void;
  markPushed: () => void;
  clearPasteError: () => void;
};

function nowIso() {
  return new Date().toISOString();
}

function overlayLot(l: Lot, s: Pick<State, "raise" | "archive">): Lot {
  return {
    ...l,
    raise: s.raise[l.id] ?? l.raise,
    archive: s.archive[l.id] ?? l.archive,
  };
}

export function lotsOf(s: Pick<State, "extraLots" | "raise" | "archive">): Lot[] {
  return [...SEED_LOTS.map((l) => overlayLot(l, s)), ...s.extraLots.map((l) => overlayLot(l, s))];
}

export function crewOf(s: Pick<State, "assigned">): CrewMember[] {
  return SEED_CREW.map((c) => ({
    ...c,
    assignedTo: s.assigned[c.name] ?? null,
  }));
}

export function logOf(s: Pick<State, "log">): LogEntry[] {
  return [...s.log].sort((a, b) => (a.at < b.at ? 1 : -1));
}

function forgeHtml(lot: Lot): string {
  const links = lot.links
    .map((l) => `<li><a href="${l.url}">${l.label}</a></li>`)
    .join("");
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${lot.title} — NEXUS Archive</title>
<body style="margin:0;background:#140c0a;color:#efe6d8;font-family:ui-sans-serif,system-ui;padding:32px">
  <p style="letter-spacing:.2em;text-transform:uppercase;font-size:11px;color:#a89480">NEXUS Archive · Mars</p>
  <h1 style="font-weight:500">${lot.title}</h1>
  <p>${lot.blurb || lot.truth}</p>
  <p style="color:#a89480">${lot.truth}</p>
  <p>Forged on-station. This file exists in the Archive. It is not a live app unless a hosted URL exists.</p>
  <ul>${links}</ul>
</body>
</html>`;
}

export const useNexus = create<State>()(
  persist(
    (set, get) => ({
      extraLots: [],
      raise: {},
      archive: {},
      assigned: {},
      ledger: [],
      log: SEED_LOG,
      entered: false,
      panel: null,
      selectedId: null,
      talkingCrew: null,
      sourceOnGithub: SOURCE_ON_GITHUB,
      pasteError: null,
      enter: () => set({ entered: true }),
      setPanel: (p) =>
        set({
          panel: p,
          talkingCrew: p === "roster" || p === "table" ? get().talkingCrew : null,
        }),
      select: (id) => set({ selectedId: id, talkingCrew: null }),
      talkCrew: (name) =>
        set({ talkingCrew: name, panel: name ? "roster" : get().panel }),
      assignCrew: (name, lotId) => {
        const assigned = { ...get().assigned, [name]: lotId };
        set({ assigned });
        if (lotId) {
          const lot = lotsOf(get()).find((l) => l.id === lotId);
          const log: LogEntry = {
            at: nowIso(),
            kind: "crew",
            file: `${name} assigned`,
            building: lot?.title ?? lotId,
            by: name,
          };
          set({ log: [log, ...get().log] });
        }
      },
      raiseLot: (id) => {
        const lots = lotsOf(get());
        const lot = lots.find((l) => l.id === id);
        if (!lot) return;
        const cur = get().raise[id] ?? lot.raise ?? 0;
        const next = Math.min(3, Math.max(1, cur + 1));
        set({
          raise: { ...get().raise, [id]: next },
          log: [
            {
              at: nowIso(),
              kind: "raise",
              file:
                next === 1
                  ? "scaffold truss"
                  : next === 2
                    ? "framed hull"
                    : "pressurize / light",
              building: lot.title,
              by: "Build",
            },
            ...get().log,
          ],
        });
      },
      forgeFile: (id) => {
        const lot = lotsOf(get()).find((l) => l.id === id);
        if (!lot) return null;
        const file: ArchiveFile = {
          name: `${slug(lot.title)}-forged.html`,
          html: forgeHtml(lot),
          at: nowIso(),
        };
        const archive = {
          ...get().archive,
          [id]: [...(get().archive[id] ?? lot.archive), file],
        };
        const cur = get().raise[id] ?? lot.raise ?? 0;
        const raise = { ...get().raise, [id]: Math.min(3, Math.max(cur, 1) + (cur >= 1 ? 1 : 0) || 1) };
        if ((raise[id] ?? 0) < 1) raise[id] = 1;
        set({
          archive,
          raise,
          log: [
            {
              at: nowIso(),
              kind: "file",
              file: file.name,
              building: lot.title,
              by: "Build",
            },
            ...get().log,
          ],
          panel: "archive",
        });
        return file;
      },
      pasteWork: (raw) => {
        let data: NexusWork;
        try {
          data = JSON.parse(raw) as NexusWork;
        } catch {
          set({ pasteError: "Not JSON." });
          return null;
        }
        if (!data || data.nexusWork !== 1 || !data.title) {
          set({ pasteError: "Needs nexusWork: 1 and a title." });
          return null;
        }
        const links = Array.isArray(data.links) ? data.links : [];
        const url = links[0]?.url ?? null;
        const files = links.map((l) => l.label || l.kind);
        const judged = honestNewWork({
          status: data.status || "incomplete",
          open: url,
          truth: data.blurb,
          files,
        });
        const lots = lotsOf(get());
        let id = slug(data.title);
        if (lots.some((l) => l.id === id) || id === "civic-hall") {
          id = `${id}-${Math.floor(Math.random() * 90 + 10)}`;
        }
        const cell = findEmptyCell(lots);
        const race = asRace(data.race);
        const lot: Lot = {
          id,
          title: data.title,
          status: judged.status,
          truth: judged.truth,
          runs: judged.runs,
          open: url,
          race,
          files: files.length ? files : ["No file yet"],
          gx: cell.gx,
          gz: cell.gz,
          seeded: false,
          kind: "lot",
          raise: judged.status === "talked" || !files.length ? 0 : 1,
          archive: [],
          blurb: data.blurb || "",
          domain: data.domain || null,
          usableBy: (data.usableBy as Lot["usableBy"]) ?? (race ? [race] : []),
          look: data.look || null,
          links,
        };
        set({
          extraLots: [...get().extraLots, lot],
          raise: { ...get().raise, [id]: lot.raise },
          selectedId: id,
          pasteError: null,
          panel: null,
          log: [
            {
              at: nowIso(),
              kind: "lot",
              file: "nexusWork paste",
              building: lot.title,
              by: null,
            },
            ...get().log,
          ],
        });
        return lot;
      },
      addLedger: (title, note) => {
        const row: LedgerRow = {
          id: slug(title) + "-" + Date.now().toString(36),
          title,
          note,
          at: nowIso(),
        };
        set({
          ledger: [row, ...get().ledger],
          log: [
            {
              at: nowIso(),
              kind: "ledger",
              file: title,
              building: "Asset Factory",
              by: "Oracle",
            },
            ...get().log,
          ],
        });
      },
      markPushed: () => set({ sourceOnGithub: true }),
      clearPasteError: () => set({ pasteError: null }),
    }),
    {
      name: "nexus-city-v10",
      skipHydration: true,
      partialize: (s) => ({
        extraLots: s.extraLots,
        raise: s.raise,
        archive: s.archive,
        assigned: s.assigned,
        ledger: s.ledger,
        log: s.log,
        sourceOnGithub: s.sourceOnGithub,
      }),
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<State>;
        const extra = [...(p.extraLots ?? [])];
        const oldLots = (p as { lots?: Lot[] }).lots;
        if (Array.isArray(oldLots)) {
          const ids = new Set([
            ...SEED_LOTS.map((l) => l.id),
            ...extra.map((l) => l.id),
          ]);
          for (const l of oldLots) {
            if (l?.title && l.id && !l.seeded && !ids.has(l.id)) extra.push(l);
          }
        }
        return {
          ...current,
          extraLots: extra,
          raise: p.raise ?? {},
          archive: p.archive ?? {},
          assigned: p.assigned ?? {},
          ledger: p.ledger ?? [],
          log: p.log && p.log.length ? p.log : current.log,
          entered: p.entered ?? false,
          sourceOnGithub: p.sourceOnGithub ?? current.sourceOnGithub,
        };
      },
    },
  ),
);

export function makeProofPacket(s: Pick<State, "extraLots" | "raise" | "archive" | "log">) {
  const lots = lotsOf(s).map((l) => ({
    title: l.title,
    status: l.status,
    truth: l.truth,
    runs: l.runs,
    open: l.open,
    race: l.race,
    files: [
      ...l.files.filter((f) => !isPlaceholderFile(f) || l.files.length === 1),
      ...l.archive.map((a) => a.name),
    ],
  }));
  const files = lots.reduce((n, l) => {
    return (
      n +
      l.files.filter((f) => f && f !== "Talked about" && f !== "No file yet").length
    );
  }, 0);
  return {
    nexusProof: 1,
    exists: true,
    city: "NEXUS",
    at: nowIso(),
    buildings: CENSUS.buildings + s.extraLots.length,
    crew: CENSUS.crew,
    files: Math.max(CENSUS.files, files),
    github: GITHUB_META,
    claims: CLAIMS,
    freshness:
      "Snapshot of the shipped inventory. Lots raised on Joshua's screen are in the city immediately; they appear in this file the next time it is published.",
    crewRoster: SEED_CREW.map(({ assignedTo: _a, ...c }) => c),
    lastWrites: s.log.slice(0, 24),
    lots,
    honesty: CENSUS.honesty,
  };
}
