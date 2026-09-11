import { create } from "zustand";
import { persist } from "zustand/middleware";
import { uid } from "@/lib/utils";
import { BUILDINGS, HATCH_COST, RACES, RACE_CYCLE, canCompleteBuild, crewCrossTalk, crewGreeting, crewReply, crewTalkCtx, defaultTitle, htmlArtifact, isHtmlBody, nextPopName } from "./catalog";
import { civicSeed, repairLots, seedAgents, workFromInput, worksToBuildings } from "./works";
import { PROOF_FILE, proofBody } from "./proof";
import type { Addition, BuildingKind, ChatLine, Domain, Duty, Item, Look, NexusWorkInput, PersistState, PlacedBuilding, PopKind, Race, SavedAgent } from "./types";
import { GRID } from "./types";

function seed(): PersistState {
  const now = Date.now();
  const civic = civicSeed(now);
  const occupied = new Set(civic.map((b) => `${b.gx},${b.gz}`));
  const works = worksToBuildings(now, occupied);
  const keeper = works.find((b) => b.slug === "table-keeper");
  const table: ChatLine[] = [
    {
      id: uid("tb"),
      speaker: "claude",
      agentId: "a-keeper",
      name: "Keeper",
      text: "The Table is open. Claude, Grok, Gemini, and Meta all speak here. No silo.",
      at: now,
    },
  ];
  void keeper;
  return {
    version: 10,
    energy: 420,
    buildings: repairLots([...civic, ...works]),
    agents: seedAgents(),
    table,
  };
}

type DistrictStore = PersistState & {
  addEnergy: (n: number) => void;
  occupy: (gx: number, gz: number) => boolean;
  place: (kind: BuildingKind, gx: number, gz: number, title?: string) => PlacedBuilding | null;
  demolish: (id: string) => void;
  addItem: (buildingId: string, item: Omit<Item, "id" | "createdAt">) => void;
  removeItem: (buildingId: string, itemId: string) => void;
  addToFile: (buildingId: string, itemId: string, addition: Omit<Addition, "id" | "createdAt">) => Addition | null;
  setItemBody: (buildingId: string, itemId: string, body: string) => void;
  findItem: (itemId: string) => { building: PlacedBuilding; item: Item } | undefined;
  hatch: (race?: Race, kind?: PopKind) => SavedAgent | null;
  setDuty: (id: string, duty: Duty, assignedId?: string | null) => void;
  advanceBuild: (buildingId: string, amount: number) => { note: string; finished: boolean; blocked: boolean; progress: number };
  renameBuilding: (id: string, title: string, blurb?: string) => void;
  setAgentTask: (id: string, task: string) => void;
  renameAgent: (id: string, name: string) => void;
  recordJob: (id: string, energy: number) => void;
  greetAgent: (id: string, jobLabel?: string) => void;
  talkTo: (id: string, text: string, jobLabel?: string) => ChatLine | null;
  inviteRace: (agentId: string, race: Race, jobLabel?: string) => ChatLine | null;
  talkTable: (text: string) => void;
  crewToCrew: (fromId: string, toId: string) => void;
  appendChat: (agentId: string, lines: ChatLine[]) => void;
  appendTable: (lines: ChatLine[]) => void;
  bringIn: (hostId: string, guestId: string) => ChatLine | null;
  importWork: (raw: NexusWorkInput) => PlacedBuilding | null;
  syncProof: () => void;
  commitBlueprint: (
    id: string,
    spec: {
      title: string;
      blurb: string;
      domain: Domain;
      look?: Look;
      race?: Race;
      usableBy: Race[];
      fileName: string;
      body: string;
    },
  ) => Item | null;
  buildingAt: (gx: number, gz: number) => PlacedBuilding | undefined;
  archiveId: () => string | undefined;
  resetDistrict: () => void;
};

export const useDistrict = create<DistrictStore>()(
  persist(
    (set, get) => ({
      ...seed(),
      addEnergy: (n) => set({ energy: Math.max(0, Math.round(get().energy + n)) }),
      occupy: (gx, gz) => get().buildings.some((b) => b.gx === gx && b.gz === gz),
      buildingAt: (gx, gz) => get().buildings.find((b) => b.gx === gx && b.gz === gz),
      archiveId: () => get().buildings.find((b) => b.kind === "archive")?.id,
      place: (kind, gx, gz, title) => {
        const def = BUILDINGS[kind];
        if (!def.placeable) return null;
        const s = get();
        if (gx < 0 || gz < 0 || gx >= GRID || gz >= GRID) return null;
        if (s.occupy(gx, gz)) return null;
        if (s.energy < def.cost) return null;
        const b: PlacedBuilding = {
          id: uid("b"),
          kind,
          gx,
          gz,
          title: title?.trim() || defaultTitle(kind),
          blurb: def.short,
          items: [],
          domain: kind === "app" ? "civic" : kind === "system" ? "system" : kind === "design" ? "lab" : "civic",
          status: "incomplete",
          look: kind === "app" ? "house" : kind === "system" ? "tower" : "house",
          links: [],
          usableBy: ["claude", "grok", "gemini", "meta"],
          progress: 0,
        };
        set({ energy: s.energy - def.cost, buildings: [...s.buildings, b] });
        return b;
      },
      demolish: (id) => {
        const s = get();
        const b = s.buildings.find((x) => x.id === id);
        if (!b || b.kind === "core") return;
        const refund = Math.round(BUILDINGS[b.kind].cost * 0.5);
        set({
          energy: s.energy + refund,
          buildings: s.buildings.filter((x) => x.id !== id),
        });
      },
      addItem: (buildingId, item) => {
        set({
          buildings: get().buildings.map((b) =>
            b.id === buildingId
              ? {
                  ...b,
                  items: [
                    { ...item, id: uid("it"), createdAt: Date.now(), additions: item.additions ?? [] },
                    ...b.items,
                  ],
                }
              : b,
          ),
        });
      },
      removeItem: (buildingId, itemId) => {
        set({
          buildings: get().buildings.map((b) =>
            b.id === buildingId ? { ...b, items: b.items.filter((i) => i.id !== itemId) } : b,
          ),
        });
      },
      findItem: (itemId) => {
        for (const building of get().buildings) {
          const item = building.items.find((i) => i.id === itemId);
          if (item) return { building, item };
        }
        return undefined;
      },
      addToFile: (buildingId, itemId, addition) => {
        const row: Addition = { ...addition, id: uid("ad"), createdAt: Date.now() };
        let wrote = false;
        set({
          buildings: get().buildings.map((b) => {
            if (b.id !== buildingId) return b;
            return {
              ...b,
              items: b.items.map((i) => {
                if (i.id !== itemId) return i;
                wrote = true;
                return { ...i, additions: [row, ...(i.additions ?? [])] };
              }),
            };
          }),
        });
        return wrote ? row : null;
      },
      setItemBody: (buildingId, itemId, body) => {
        set({
          buildings: get().buildings.map((b) =>
            b.id !== buildingId
              ? b
              : {
                  ...b,
                  items: b.items.map((i) => (i.id === itemId ? { ...i, body } : i)),
                },
          ),
        });
      },
      hatch: (race, kind = "agent") => {
        const s = get();
        if (s.energy < HATCH_COST) return null;
        if (!s.buildings.some((b) => b.kind === "hatchery")) return null;
        const nextRace = race ?? RACE_CYCLE[s.agents.length % RACE_CYCLE.length]!;
        const name = nextPopName(
          kind,
          nextRace,
          s.agents.map((a) => a.name),
        );
        const duty: Duty = kind === "bot" ? "build" : kind === "gem" ? "file" : "file";
        const g: SavedAgent = {
          id: uid("a"),
          race: nextRace,
          name,
          kind,
          duty,
          task: duty === "build" ? "Ready to complete a lot" : "Awaiting assignment",
          jobsDone: 0,
          homeId: s.buildings.find((b) => b.kind === "hatchery")?.id,
        };
        set({ energy: s.energy - HATCH_COST, agents: [...s.agents, g] });
        return g;
      },
      setDuty: (id, duty, assignedId) => {
        set({
          agents: get().agents.map((a) =>
            a.id === id
              ? {
                  ...a,
                  duty,
                  assignedId: assignedId === undefined ? a.assignedId : assignedId ?? undefined,
                }
              : a,
          ),
        });
      },
      advanceBuild: (buildingId, amount) => {
        const b = get().buildings.find((x) => x.id === buildingId);
        if (!b) return { note: "No lot.", finished: false, blocked: true, progress: 0 };
        const title = b.title;
        let status = b.status ?? "incomplete";
        let progress = b.progress ?? 0;
        let finished = false;
        let blocked = false;
        let note = "";
        if (status === "broken") {
          blocked = true;
          progress = Math.min(80, progress + Math.max(4, Math.round(amount / 2)));
          note = `Still broken. ${title} will not work reliably.`;
        } else if (status === "talked") {
          status = "incomplete";
          progress = Math.min(24, progress + 12);
          note = `Started construction on ${title}.`;
        } else {
          progress = Math.min(100, progress + amount);
          if (progress >= 100) {
            if (canCompleteBuild(b)) {
              status = "works";
              progress = 100;
              finished = true;
              note = `Finished ${title}. Scaffold down.`;
            } else {
              progress = 90;
              blocked = true;
              note = `Cannot finish ${title}. No file. It will not work.`;
            }
          } else {
            note = `Worked ${title}. ${progress}%`;
          }
        }
        set({
          buildings: get().buildings.map((x) => (x.id === buildingId ? { ...x, status, progress } : x)),
        });
        return { note, finished, blocked, progress };
      },
      renameBuilding: (id, title, blurb) => {
        const t = title.trim();
        if (!t) return;
        set({
          buildings: get().buildings.map((b) =>
            b.id === id ? { ...b, title: t, blurb: blurb === undefined ? b.blurb : blurb } : b,
          ),
        });
      },
      setAgentTask: (id, task) => {
        set({
          agents: get().agents.map((a) => (a.id === id ? { ...a, task: task.trim() || a.task } : a)),
        });
      },
      renameAgent: (id, name) => {
        const n = name.trim();
        if (!n) return;
        set({ agents: get().agents.map((a) => (a.id === id ? { ...a, name: n } : a)) });
      },
      recordJob: (id, energy) => {
        const s = get();
        set({
          energy: s.energy + energy,
          agents: s.agents.map((a) => (a.id === id ? { ...a, jobsDone: a.jobsDone + 1 } : a)),
        });
      },
      greetAgent: (id, jobLabel) => {
        const s = get();
        const a = s.agents.find((x) => x.id === id);
        if (!a || (a.chat && a.chat.length)) return;
        const ctx = crewTalkCtx(a, s.buildings, jobLabel);
        const line: ChatLine = {
          id: uid("ch"),
          speaker: a.race,
          agentId: a.id,
          name: a.name,
          text: crewGreeting(ctx),
          at: Date.now(),
        };
        set({
          agents: s.agents.map((x) => (x.id === id ? { ...x, chat: [line] } : x)),
        });
      },
      talkTo: (id, text, jobLabel) => {
        const said = text.trim();
        if (!said) return null;
        const s = get();
        const a = s.agents.find((x) => x.id === id);
        if (!a) return null;
        const ctx = crewTalkCtx(a, s.buildings, jobLabel ?? a.task);
        const you: ChatLine = { id: uid("ch"), speaker: "you", name: "You", text: said, at: Date.now() };
        const them: ChatLine = {
          id: uid("ch"),
          speaker: a.race,
          agentId: a.id,
          name: a.name,
          text: crewReply(ctx, said),
          at: Date.now() + 1,
        };
        const chat = [...(a.chat ?? []), you, them];
        set({
          agents: get().agents.map((x) => (x.id === id ? { ...x, chat } : x)),
          table: [...get().table, you, them].slice(-80),
        });
        return them;
      },
      inviteRace: (agentId, race, jobLabel) => {
        const s = get();
        const host = s.agents.find((x) => x.id === agentId);
        const guest = s.agents.find((x) => x.race === race && x.id !== agentId);
        if (!host || !guest) return null;
        const from = crewTalkCtx(guest, s.buildings, guest.task);
        const to = crewTalkCtx(host, s.buildings, jobLabel ?? host.task);
        const line: ChatLine = {
          id: uid("ch"),
          speaker: guest.race,
          agentId: guest.id,
          name: guest.name,
          text: crewCrossTalk(from, to),
          at: Date.now(),
        };
        set({
          agents: get().agents.map((x) =>
            x.id === agentId ? { ...x, chat: [...(x.chat ?? []), line] } : x,
          ),
          table: [...get().table, line].slice(-80),
        });
        return line;
      },
      talkTable: (text) => {
        const said = text.trim();
        if (!said) return;
        const s = get();
        const you: ChatLine = { id: uid("ch"), speaker: "you", name: "You", text: said, at: Date.now() };
        const replies: ChatLine[] = [];
        const seen = new Set<Race>();
        for (const a of s.agents) {
          if (seen.has(a.race)) continue;
          seen.add(a.race);
          const ctx = crewTalkCtx(a, s.buildings, a.task);
          replies.push({
            id: uid("ch"),
            speaker: a.race,
            agentId: a.id,
            name: a.name,
            text: crewReply(ctx, said),
            at: Date.now() + seen.size,
          });
        }
        set({ table: [...s.table, you, ...replies].slice(-80) });
      },
      crewToCrew: (fromId, toId) => {
        const s = get();
        const fromA = s.agents.find((x) => x.id === fromId);
        const toA = s.agents.find((x) => x.id === toId);
        if (!fromA || !toA || fromA.race === toA.race) return;
        const recent = s.table.slice(-10);
        if (recent.some((l) => l.agentId === fromId && l.text.includes(toA.name))) return;
        const line: ChatLine = {
          id: uid("ch"),
          speaker: fromA.race,
          agentId: fromA.id,
          name: fromA.name,
          text: crewCrossTalk(crewTalkCtx(fromA, s.buildings), crewTalkCtx(toA, s.buildings)),
          at: Date.now(),
        };
        set({
          agents: s.agents.map((x) =>
            x.id === fromId || x.id === toId ? { ...x, chat: [...(x.chat ?? []), line] } : x,
          ),
          table: [...s.table, line].slice(-80),
        });
      },
      appendChat: (agentId, lines) => {
        if (!lines.length) return;
        set({
          agents: get().agents.map((x) =>
            x.id === agentId ? { ...x, chat: [...(x.chat ?? []), ...lines].slice(-40) } : x,
          ),
        });
      },
      appendTable: (lines) => {
        if (!lines.length) return;
        set({ table: [...get().table, ...lines].slice(-80) });
      },
      bringIn: (hostId, guestId) => {
        const s = get();
        const host = s.agents.find((x) => x.id === hostId);
        const guest = s.agents.find((x) => x.id === guestId);
        if (!host || !guest || host.id === guest.id) return null;
        const line: ChatLine = {
          id: uid("ch"),
          speaker: guest.race,
          agentId: guest.id,
          name: guest.name,
          text: crewCrossTalk(crewTalkCtx(guest, s.buildings), crewTalkCtx(host, s.buildings, host.task)),
          at: Date.now(),
        };
        set({
          agents: get().agents.map((x) =>
            x.id === hostId || x.id === guestId ? { ...x, chat: [...(x.chat ?? []), line].slice(-40) } : x,
          ),
          table: [...get().table, line].slice(-80),
        });
        return line;
      },
      importWork: (raw) => {
        const occupied = new Set(get().buildings.map((b) => `${b.gx},${b.gz}`));
        if (raw.title && get().buildings.some((b) => b.title.toLowerCase() === raw.title.trim().toLowerCase())) {
          return get().buildings.find((b) => b.title.toLowerCase() === raw.title.trim().toLowerCase()) ?? null;
        }
        const b = workFromInput(raw, occupied);
        if (!b) return null;
        const who = raw.race ? RACES[raw.race].name : "Another system";
        const line: ChatLine = {
          id: uid("tb"),
          speaker: "claude",
          agentId: "a-keeper",
          name: "Keeper",
          text: `${who} raised ${b.title}. The lot is the proof. Notion was not written.`,
          at: Date.now(),
        };
        set({ buildings: [...get().buildings, b], table: [...get().table, line].slice(-80) });
        get().syncProof();
        return b;
      },
      syncProof: () => {
        const s = get();
        const archive = s.buildings.find((b) => b.kind === "archive");
        if (!archive) return;
        const body = proofBody(s.buildings, s.agents);
        const stamp = (raw: string) => raw.replace(/"at": "[^"]+"/, '"at": ""');
        const existing = archive.items.find((i) => i.name === PROOF_FILE);
        if (existing) {
          if (stamp(existing.body ?? "") === stamp(body)) return;
          get().setItemBody(archive.id, existing.id, body);
          return;
        }
        get().addItem(archive.id, {
          kind: "file",
          name: PROOF_FILE,
          detail: "Ledger for Claude, Gemini, and Meta — proof this city exists",
          body,
          additions: [],
        });
      },
      commitBlueprint: (id, spec) => {
        const title = spec.title.trim();
        const body = spec.body.slice(0, 80_000);
        if (!title || !body || !isHtmlBody(body)) return null;
        const fileName = spec.fileName.trim() || `${title.replace(/[^\w.-]+/g, "-")}.html`;
        const now = Date.now();
        const lock = spec.usableBy.length === 1 ? spec.usableBy[0] : undefined;
        let saved: Item | null = null;
        set({
          buildings: get().buildings.map((b) => {
            if (b.id === id) {
              const existing = htmlArtifact(b);
              const item: Item = existing
                ? { ...existing, name: fileName, body, kind: "app", detail: "Raised on the blueprint table", lockedTo: lock }
                : {
                    id: uid("it"),
                    kind: "app",
                    name: fileName,
                    detail: "Raised on the blueprint table",
                    body,
                    source: "phone",
                    createdAt: now,
                    additions: [],
                    lockedTo: lock,
                  };
              saved = item;
              return {
                ...b,
                title,
                blurb: spec.blurb.trim() || b.blurb,
                domain: spec.domain,
                look: spec.look ?? b.look,
                race: spec.race ?? b.race,
                usableBy: spec.usableBy,
                status: b.status === "broken" ? "broken" : "incomplete",
                progress: Math.max(b.progress ?? 0, 70),
                items: existing ? b.items.map((i) => (i.id === existing.id ? item : i)) : [item, ...b.items],
              };
            }
            if (b.kind !== "archive") return b;
            if (b.items.some((i) => i.name === fileName && i.body === body)) return b;
            return {
              ...b,
              items: [
                {
                  id: uid("it"),
                  kind: "app" as const,
                  name: fileName,
                  detail: `Blueprint · ${title}`,
                  body,
                  source: "phone" as const,
                  createdAt: now,
                  additions: [],
                  lockedTo: lock,
                },
                ...b.items,
              ],
            };
          }),
        });
        get().syncProof();
        return saved;
      },
      resetDistrict: () => {
        set(seed());
        get().syncProof();
      },
    }),
    {
      name: "nexus-city-v10",
      onRehydrateStorage: () => (state) => {
        queueMicrotask(() => {
          if (!state) return;
          useDistrict.setState({ buildings: repairLots(state.buildings) });
          useDistrict.getState().syncProof();
        });
      },
    },
  ),
);

/** @deprecated use useDistrict().agents */
export const useGems = () => useDistrict((s) => s.agents);
