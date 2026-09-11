import { useEffect, useMemo, useRef, useState } from "react";
import {
  AppWindow,
  Box,
  Copy,
  Cpu,
  ExternalLink,
  Folder,
  Hammer,
  Link2,
  PenTool,
  Radio,
  ScrollText,
  Sparkles,
  Trash2,
  Waypoints,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUILDINGS, DOMAINS, DUTY_LABEL, HATCH_COST, HUB_BUCKET_LABEL, LOOK_LABEL, PLACEABLE, POP_LABEL, RACES, STATUS_LABEL, collectCivicLog, htmlArtifact, hubBucket, hubEntries, isHtmlBody, isWorkKind, primaryLink, usableRaces, workTruth } from "@/game/catalog";
import { downloadHtml, openHtmlBody, openWorkApp } from "@/game/blueprint";
import { OTHER_AI_BRIEF, PROOF_FILE, PROOF_RAW_URL, proofBody, proofCensus, proofPacket } from "@/game/proof";
import { parseNexusWork, WORK_SCHEMA } from "@/game/works";
import { useDistrict } from "@/game/store";
import { bringCrewIn, sendTableTalk, sendTalkTo } from "@/game/talk";
import type { AuthorRace, BuildingKind, Domain, Duty, EngineHud, Item, NexusWorkInput, PlacedBuilding, PopKind, Race, WorldPin } from "@/game/types";
import { redirectToLoginIfRequired, useRefetchWhenConnectorReady } from "@/lib/app-data";
import { listDriveFiles, readDriveFile, type DriveList } from "@/lib/drive";
import { cn } from "@/lib/utils";

const ICONS: Record<BuildingKind, typeof Folder> = {
  core: Radio,
  archive: Folder,
  foundry: Box,
  forge: Hammer,
  hatchery: Sparkles,
  vault: Box,
  studio: Cpu,
  lab: Sparkles,
  needle: Link2,
  reactor: Zap,
  app: AppWindow,
  system: Waypoints,
  design: PenTool,
};

const RACE_DOT: Record<AuthorRace, string> = {
  claude: "bg-claude",
  grok: "bg-grok",
  gemini: "bg-gemini",
  meta: "bg-meta",
  you: "bg-energy",
};

const DOMAIN_DOT: Record<Domain, string> = {
  civic: "bg-civic",
  body: "bg-body",
  money: "bg-money",
  lab: "bg-lab",
  system: "bg-sys",
  game: "bg-game",
  agent: "bg-agent",
  tool: "bg-tool",
  idea: "bg-idea",
  comms: "bg-comms",
};

async function ingestLocalFiles(files: File[]) {
  const out: Omit<Item, "id" | "createdAt">[] = [];
  for (const f of files) {
    const detail = `${Math.max(1, Math.round(f.size / 1024))} KB · ${f.type || "file"}`;
    const texty =
      /^(text\/|application\/(json|xml))/.test(f.type) ||
      /\.(md|txt|json|csv|ts|tsx|js|jsx|py|html|css|yml|yaml)$/i.test(f.name);
    let body: string | undefined;
    if (texty && f.size < 200_000) {
      try {
        body = (await f.text()).slice(0, 8000);
      } catch {
        /* skip body */
      }
    }
    out.push({ kind: "file", name: f.name, detail, source: "phone", body, additions: [] });
  }
  return out;
}

export function StartScreen({ onEnter }: { onEnter: () => void }) {
  const buildings = useDistrict((s) => s.buildings);
  const agents = useDistrict((s) => s.agents);
  const census = useMemo(() => proofCensus(buildings, agents), [buildings, agents]);
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-gradient-to-t from-bg via-bg/80 to-bg/20 px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-16 sm:justify-center sm:px-10">
      <div className="mx-auto w-full max-w-md">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted">Mars station OS</p>
        <h1 className="mt-3 font-display text-5xl font-semibold tracking-tight text-fg sm:text-6xl">NEXUS</h1>
        <p className="mt-4 max-w-sm text-base leading-relaxed text-muted">
          The hub is live on Mars. Not recovery. {census.buildings} modules, {census.crew} crew, {census.files} files.
          Tap anyone: their real job, a live talk thread, and the app or file they tend.
        </p>
        <ul className="mt-6 space-y-2 text-sm text-muted">
          <li className="flex gap-3">
            <span className="mt-1 block size-1.5 shrink-0 rounded-full bg-energy" />
            Chat Claude cannot see this station. He fetches a public GitHub JSON. He adds by returning JSON — not a Notion row.
          </li>
          <li className="flex gap-3">
            <span className="mt-1 block size-1.5 shrink-0 rounded-full bg-energy" />
            Files that only run in one system are color-coded to that race. Shared files stay plain.
          </li>
          <li className="flex gap-3">
            <span className="mt-1 block size-1.5 shrink-0 rounded-full bg-energy" />
            Talked-about lots are empty docks. If it will not run, the sheet says so.
          </li>
        </ul>
        <Button size="lg" className="mt-8 w-full" onClick={onEnter}>
          Enter station
        </Button>
        <p className="mt-3 text-center text-xs text-subtle">Phone-first. Your library stays on this device.</p>
      </div>
    </div>
  );
}

export function TopHud({
  hud,
  mode,
  view,
  onToggleMode,
  onToggleView,
  onOpenRoster,
  onOpenHub,
  onOpenProof,
}: {
  hud: EngineHud;
  mode: "explore" | "build";
  view: "walk" | "fly";
  onToggleMode: () => void;
  onToggleView: () => void;
  onOpenRoster: () => void;
  onOpenHub: () => void;
  onOpenProof: () => void;
}) {
  const energy = useDistrict((s) => s.energy);
  const agents = useDistrict((s) => s.agents.length);
  const buildings = useDistrict((s) => s.buildings.length);
  const lastTalk = useDistrict((s) => s.table.at(-1));

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex max-w-lg items-start justify-between gap-3">
        <div className="pointer-events-auto rounded-xl border border-border bg-surface/90 px-3 py-2">
          <p className="text-xs uppercase tracking-[0.18em] text-subtle">NEXUS</p>
          <div className="mt-1 flex items-baseline gap-3">
            <Stat label="Energy" value={energy} accent />
            <button type="button" onClick={onOpenRoster} className="text-left">
              <Stat label="Crew" value={agents} />
            </button>
            <button type="button" onClick={onOpenHub} className="text-left">
              <Stat label="Hub" value={buildings} />
            </button>
          </div>
          <button type="button" onClick={onOpenProof} className="mt-2 flex h-11 w-full items-center gap-2 text-left">
            <ScrollText className="size-4 text-energy" />
            <span>
              <span className="block text-xs uppercase tracking-wider text-subtle">Proof</span>
              <span className="text-sm text-fg">Station exists</span>
            </span>
          </button>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={onToggleView}
            className={cn(
              "pointer-events-auto h-11 min-w-20 rounded-lg border px-4 text-sm font-medium",
              view === "fly" ? "border-energy/40 bg-energy text-accent-fg" : "border-border bg-surface/90 text-fg",
            )}
          >
            {view === "fly" ? "Fly" : "Walk"}
          </button>
          <button
            type="button"
            onClick={onToggleMode}
            className={cn(
              "pointer-events-auto h-11 min-w-20 rounded-lg border px-4 text-sm font-medium",
              mode === "build" ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface/90 text-fg",
            )}
          >
            {mode === "build" ? "Explore" : "Build"}
          </button>
        </div>
      </div>
      {hud.lastNote ? (
        <p className="mx-auto mt-3 max-w-lg text-center text-xs text-fg">
          {hud.lastNote.agent} added to {hud.lastNote.file}
        </p>
      ) : lastTalk && Date.now() - lastTalk.at < 14000 ? (
        <p className="mx-auto mt-3 max-w-lg truncate text-center text-xs text-fg">
          <span className={cn("mr-1.5 inline-block size-1.5 rounded-full", RACE_DOT[lastTalk.speaker])} />
          {lastTalk.name}: {lastTalk.text}
        </p>
      ) : hud.nearbyLabel && mode === "explore" ? (
        <p className="mx-auto mt-3 max-w-lg text-center text-xs text-muted">{hud.nearbyLabel} · tap or press E</p>
      ) : null}
      {mode === "build" ? (
        <p className="mx-auto mt-3 max-w-lg text-center text-xs text-muted">Tap an empty lot to raise a building</p>
      ) : null}
      {view === "fly" && mode === "explore" && !hud.lastNote ? (
        <p className="mx-auto mt-2 max-w-lg text-center text-xs text-subtle">
          Scroll to zoom · drag to orbit · tap an agent or building
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-subtle">{label}</p>
      <p className={cn("font-medium tabular-nums", accent ? "text-energy" : "text-fg")}>{value}</p>
    </div>
  );
}

export function WorldPins({
  pins,
  hidden,
  onOpenAgent,
  onOpenBuilding,
}: {
  pins: WorldPin[];
  hidden: boolean;
  onOpenAgent: (id: string) => void;
  onOpenBuilding: (id: string) => void;
}) {
  if (hidden) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {pins
        .filter((p) => p.visible && p.y > 72 && p.y < window.innerHeight - 96)
        .map((p) => (
          <button
            key={`${p.kind}-${p.id}`}
            type="button"
            className="pointer-events-auto absolute max-w-44 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-surface/90 px-2 py-1 text-left"
            style={{ left: p.x, top: p.y }}
            onClick={() => (p.kind === "agent" ? onOpenAgent(p.id) : onOpenBuilding(p.id))}
          >
            <span className="flex items-center gap-1.5">
              {p.race ? <span className={cn("size-2 shrink-0 rounded-full", RACE_DOT[p.race])} /> : null}
              {p.domain && !p.race ? <span className={cn("size-2 shrink-0 rounded-full", DOMAIN_DOT[p.domain])} /> : null}
              <span className="truncate text-xs font-medium text-fg">{p.title}</span>
            </span>
            {p.subtitle ? <span className="mt-0.5 block truncate text-xs text-subtle">{p.subtitle}</span> : null}
          </button>
        ))}
    </div>
  );
}

export function BuildDock({
  selected,
  onSelect,
  onPlace,
  canPlace,
}: {
  selected: BuildingKind | null;
  onSelect: (k: BuildingKind) => void;
  onPlace: () => void;
  canPlace: boolean;
}) {
  const energy = useDistrict((s) => s.energy);
  const work = PLACEABLE.filter((b) => b.work);
  const district = PLACEABLE.filter((b) => !b.work);
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-surface/95 p-3">
        <p className="mb-2 text-xs uppercase tracking-wider text-subtle">Your work — each one is a building</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {work.map((b) => (
            <KindCard key={b.kind} b={b} on={selected === b.kind} poor={energy < b.cost} onSelect={onSelect} />
          ))}
        </div>
        <p className="mb-2 mt-3 text-xs uppercase tracking-wider text-subtle">City</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {district.map((b) => (
            <KindCard key={b.kind} b={b} on={selected === b.kind} poor={energy < b.cost} onSelect={onSelect} />
          ))}
        </div>
        <Button className="mt-3 w-full" disabled={!canPlace} onClick={onPlace}>
          Place
        </Button>
      </div>
    </div>
  );
}

function KindCard({
  b,
  on,
  poor,
  onSelect,
}: {
  b: (typeof PLACEABLE)[number];
  on: boolean;
  poor: boolean;
  onSelect: (k: BuildingKind) => void;
}) {
  const Icon = ICONS[b.kind];
  return (
    <button
      type="button"
      onClick={() => onSelect(b.kind)}
      className={cn(
        "flex min-w-[92px] shrink-0 flex-col items-start rounded-md border px-2.5 py-2 text-left",
        on ? "border-accent bg-surface-2" : "border-border bg-bg",
        poor && "opacity-50",
      )}
    >
      <Icon className="size-4 text-muted" />
      <span className="mt-1 text-xs font-medium text-fg">{b.name}</span>
      <span className="text-xs tabular-nums text-subtle">{b.cost}</span>
    </button>
  );
}

export function BuildingSheet({
  buildingId,
  onClose,
  onHatch,
  onFocus,
  onOpenFile,
  onAssignCrew,
  onBlueprint,
  onOpenProof,
}: {
  buildingId: string;
  onClose: () => void;
  onHatch: (race?: Race, kind?: PopKind) => void;
  onFocus?: (id: string) => void;
  onOpenFile?: (buildingId: string, itemId: string) => void;
  onAssignCrew?: (agentId: string, duty: Duty) => void;
  onOpenHub?: () => void;
  onBlueprint?: (id: string) => void;
  onOpenProof?: () => void;
}) {
  const building = useDistrict((s) => s.buildings.find((b) => b.id === buildingId));
  const demolish = useDistrict((s) => s.demolish);
  const addItem = useDistrict((s) => s.addItem);
  const removeItem = useDistrict((s) => s.removeItem);
  const renameBuilding = useDistrict((s) => s.renameBuilding);
  const energy = useDistrict((s) => s.energy);
  const all = useDistrict((s) => s.buildings);
  const crew = useDistrict((s) => s.agents);
  const [name, setName] = useState("");
  const [title, setTitle] = useState(building?.title ?? "");
  const [hireKind, setHireKind] = useState<PopKind>("bot");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!building) return null;
  const def = BUILDINGS[building.kind];
  const Icon = ICONS[building.kind];
  const displayTitle = title || building.title;
  const directory = building.kind === "core" ? all : null;

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-h-[72vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-11 items-center justify-center rounded-md bg-surface-2">
              <Icon className="size-5 text-muted" />
            </div>
            <div className="min-w-0">
              {isWorkKind(building.kind) ? (
                <input
                  value={title || building.title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => renameBuilding(building.id, (title || building.title).trim())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      renameBuilding(building.id, (title || building.title).trim());
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="w-full bg-transparent text-lg font-semibold tracking-tight text-fg focus-visible:outline-none"
                />
              ) : (
                <h2 className="text-lg font-semibold tracking-tight text-fg">{displayTitle}</h2>
              )}
              <p className="mt-0.5 text-sm text-muted">{building.blurb || def.short}</p>
              <MetaLine building={building} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-surface-2"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <TruthBlock building={building} />
        {isWorkKind(building.kind) && onBlueprint ? (
          <Button className="mt-3 w-full" variant="secondary" onClick={() => onBlueprint(building.id)}>
            <PenTool className="size-4" />
            Blueprint table
          </Button>
        ) : null}
        <ProgressBar building={building} />
        {building.kind !== "core" && building.kind !== "hatchery" && (building.progress ?? 100) < 100 ? (
          <CrewAssign buildingId={building.id} crew={crew} onAssign={onAssignCrew} />
        ) : null}

        {directory ? (
          <>
            <ProofPanel onOpenProof={onOpenProof} />
            <TableTalk />
            <HubList onFocus={onFocus} />
            <CivicLog onOpenFile={onOpenFile} onFocus={onFocus} />
            <RaiseWork />
            <Directory all={all} onFocus={onFocus} />
          </>
        ) : building.kind === "archive" ? (
          <ArchiveBody
            buildingId={building.id}
            items={building.items}
            fileRef={fileRef}
            onOpenFile={(id) => onOpenFile?.(building.id, id)}
            onRemove={(id) => removeItem(building.id, id)}
          />
        ) : (
          <>
            <AddRow
              kind={def.itemKind}
              name={name}
              setName={setName}
              fileRef={fileRef}
              onAdd={(itemName, itemKind, detail, extra) => {
                const lock = usableRaces(building);
                addItem(building.id, {
                  kind: itemKind,
                  name: itemName,
                  detail,
                  lockedTo: lock.length === 1 ? lock[0] : undefined,
                  ...extra,
                });
                setName("");
              }}
            />
            <ItemList
              items={building.items}
              empty="Nothing stored yet. Add a file — system-only files get that race's color. Shared files stay plain."
              onRemove={(id) => removeItem(building.id, id)}
              onOpen={(id) => onOpenFile?.(building.id, id)}
            />
          </>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {building.kind === "hatchery" ? (
            <div className="w-full space-y-2">
              <p className="text-xs uppercase tracking-wider text-subtle">Hire into the city</p>
              <div className="grid grid-cols-3 gap-2">
                {(["agent", "gem", "bot"] as PopKind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setHireKind(k)}
                    className={cn(
                      "h-10 rounded-md text-sm font-medium",
                      hireKind === k ? "bg-accent text-accent-fg" : "bg-bg text-muted",
                    )}
                  >
                    {POP_LABEL[k]}
                  </button>
                ))}
              </div>
              <div className="grid w-full grid-cols-2 gap-2">
                {(["claude", "grok", "gemini", "meta"] as Race[]).map((r) => (
                  <Button key={r} variant="secondary" disabled={energy < HATCH_COST} onClick={() => onHatch(r, hireKind)}>
                    <span className={cn("size-2 rounded-full", RACE_DOT[r])} />
                    {RACES[r].name} {POP_LABEL[hireKind].toLowerCase()}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
          {building.kind !== "core" ? (
            <Button
              className={building.kind === "hatchery" ? "w-full" : "flex-1"}
              variant="secondary"
              onClick={() => {
                demolish(building.id);
                onClose();
              }}
            >
              <Trash2 className="size-4" />
              Demolish
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RaceChip({ race, label }: { race: Race; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted">
      <span className={cn("size-2 rounded-full", RACE_DOT[race])} />
      {label ?? RACES[race].name}
    </span>
  );
}

function MetaLine({ building }: { building: PlacedBuilding }) {
  const usable = usableRaces(building);
  const shared = usable.length >= 4;
  return (
    <div className="mt-1.5 space-y-1 text-xs text-subtle">
      <p className="flex flex-wrap items-center gap-2">
        {building.domain ? (
          <span className="inline-flex items-center gap-1.5 text-muted">
            <span className={cn("size-2 rounded-full", DOMAIN_DOT[building.domain])} />
            {DOMAINS[building.domain].name}
          </span>
        ) : null}
        {building.status ? <span>{STATUS_LABEL[building.status]}</span> : null}
        {building.look ? <span>{LOOK_LABEL[building.look]}</span> : null}
      </p>
      <p className="flex flex-wrap items-center gap-2">
        <span>Built by</span>
        {building.race ? <RaceChip race={building.race} /> : <span className="text-muted">unassigned</span>}
        <span>· usable by</span>
        {shared ? (
          <span className="text-muted">all four</span>
        ) : (
          usable.map((r) => <RaceChip key={r} race={r} />)
        )}
      </p>
    </div>
  );
}

function TruthBlock({ building }: { building: PlacedBuilding }) {
  const truth = workTruth(building);
  const open = primaryLink(building);
  const html = htmlArtifact(building);
  const extras = (building.links ?? []).filter((l) => l !== open);
  return (
    <div className="mt-4 space-y-2">
      <div className="rounded-md bg-bg px-3 py-3">
        <p className={cn("text-sm font-medium", truth.runs ? "text-energy" : "text-fg")}>{truth.label}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">{truth.detail}</p>
      </div>
      {open ? (
        <Button className="w-full" onClick={() => window.open(open.url, "_blank", "noopener,noreferrer")}>
          <ExternalLink className="size-4" />
          {truth.openKind === "app" ? "Open app" : truth.openKind === "repo" ? "Open repo" : open.label}
        </Button>
      ) : html?.body ? (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => openHtmlBody(html.body!)}>
            <ExternalLink className="size-4" />
            Open app
          </Button>
          <Button variant="secondary" onClick={() => downloadHtml(html.name, html.body!)}>
            Download
          </Button>
        </div>
      ) : building.kind !== "core" && building.kind !== "archive" && building.kind !== "hatchery" ? (
        <p className="px-1 text-xs text-subtle">No app to open. Use the blueprint table to forge a file.</p>
      ) : null}
      {extras.length
        ? extras.map((link) => (
            <Button
              key={link.url}
              className="w-full"
              variant="secondary"
              onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="size-4" />
              {link.label}
            </Button>
          ))
        : null}
    </div>
  );
}

function ProgressBar({ building }: { building: PlacedBuilding }) {
  if (building.kind === "core" || building.kind === "hatchery" || building.kind === "archive") return null;
  const p = building.progress ?? (building.status === "works" ? 100 : 0);
  if (p >= 100 && building.status === "works") return null;
  return (
    <div className="mt-3 rounded-md bg-bg px-3 py-3">
      <p className="flex items-center justify-between text-xs uppercase tracking-wider text-subtle">
        Construction
        <span className="tabular-nums text-muted">{p}%</span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-energy" style={{ width: `${Math.max(2, p)}%` }} />
      </div>
    </div>
  );
}

function CrewAssign({
  buildingId,
  crew,
  onAssign,
}: {
  buildingId: string;
  crew: { id: string; name: string; race: Race; kind: PopKind; duty?: Duty; assignedId?: string }[];
  onAssign?: (agentId: string, duty: Duty) => void;
}) {
  if (!onAssign) return null;
  const free = crew.filter((a) => a.assignedId !== buildingId);
  const here = crew.filter((a) => a.assignedId === buildingId);
  return (
    <div className="mt-3">
      <p className="text-xs uppercase tracking-wider text-subtle">Assign crew to finish this lot</p>
      {here.length ? (
        <p className="mt-1 text-xs text-muted">{here.map((a) => a.name).join(", ")} on site.</p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {free.slice(0, 12).map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onAssign(a.id, "build")}
            className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-fg"
          >
            <span className={cn("mr-1.5 inline-block size-2 rounded-full", RACE_DOT[a.race])} />
            {a.name}
            <span className="ml-1.5 text-xs text-subtle">{POP_LABEL[a.kind]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProofPanel({ onOpenProof }: { onOpenProof?: () => void }) {
  const buildings = useDistrict((s) => s.buildings);
  const agents = useDistrict((s) => s.agents);
  const syncProof = useDistrict((s) => s.syncProof);
  const census = useMemo(() => proofCensus(buildings, agents), [buildings, agents]);
  const [msg, setMsg] = useState<string | null>(null);
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    syncProof();
  }, [syncProof]);

  const copy = async (text: string, ok: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMsg(ok);
      setShown(null);
    } catch {
      setShown(text);
      setMsg("Select the text and copy");
    }
  };

  return (
    <div className="mt-4 rounded-md bg-bg px-3 py-3">
      <p className="text-xs uppercase tracking-wider text-subtle">Proof</p>
      <p className="mt-1 text-sm text-fg">This city exists. Chat Claude cannot see it. He adds JSON. The log is the proof.</p>
      <p className="mt-2 text-xs tabular-nums text-muted">
        {census.buildings} buildings · {census.crew} crew · {census.files} files
      </p>
      {census.last ? (
        <p className="mt-1 truncate text-xs text-subtle">
          Last write · {census.last.file} · {census.last.building}
        </p>
      ) : (
        <p className="mt-1 text-xs text-subtle">No file writes yet.</p>
      )}
      <p className="mt-2 text-xs leading-relaxed text-subtle">
        Notion is not connected. Do not claim a Notion row. Drive can be pulled. Ada is Claude in this city — not chat
        Claude.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          onClick={() => void copy(proofPacket(buildings, agents), "Packet copied — paste it to Claude")}
        >
          <Copy className="size-4" />
          Copy packet
        </Button>
        {onOpenProof ? (
          <Button variant="secondary" onClick={onOpenProof}>
            <ScrollText className="size-4" />
            Proof desk
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => void copy(OTHER_AI_BRIEF, "Brief copied — paste it to Claude")}>
            <Copy className="size-4" />
            Brief for Claude
          </Button>
        )}
      </div>
      {msg ? <p className="mt-2 text-xs text-muted">{msg}</p> : null}
      {shown ? (
        <textarea
          readOnly
          value={shown}
          className="mt-2 h-28 w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-fg"
        />
      ) : null}
    </div>
  );
}

function TableTalk() {
  const table = useDistrict((s) => s.table);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const send = () => {
    const said = text.trim();
    if (!said || busy) return;
    setText("");
    setBusy(true);
    void sendTableTalk(said).finally(() => setBusy(false));
  };
  return (
    <div className="mt-4">
      <p className="text-xs uppercase tracking-wider text-subtle">The Table</p>
      <p className="mt-1 text-sm text-muted">Claude, Grok, Gemini, and Meta all speak here. No silo.</p>
      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
        {table.slice(-12).map((line) => (
          <li key={line.id} className="rounded-md bg-bg px-3 py-2">
            <p className="flex items-center gap-2 text-xs text-muted">
              <span className={cn("size-2 rounded-full", RACE_DOT[line.speaker])} />
              <span className="font-medium text-fg">{line.name}</span>
            </p>
            <p className="mt-1 text-sm leading-relaxed text-fg">{line.text}</p>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Speak to every system"
          disabled={busy}
          className="h-11 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-fg placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <Button variant="secondary" disabled={!text.trim() || busy} onClick={send}>
          {busy ? "…" : "Send"}
        </Button>
      </div>
    </div>
  );
}

function HubList({ onFocus }: { onFocus?: (id: string) => void }) {
  const buildings = useDistrict((s) => s.buildings);
  const rows = useMemo(() => hubEntries(buildings).filter((r) => r.runs || r.open || r.localHtml), [buildings]);
  return (
    <div className="mt-4">
      <p className="text-xs uppercase tracking-wider text-subtle">Hub — live access</p>
      <ul className="mt-2 space-y-2">
        {rows.slice(0, 12).map((r) => (
          <li key={r.id} className="flex items-center gap-2 rounded-md bg-bg px-3 py-2">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onFocus?.(r.id)}>
              <p className="truncate text-sm text-fg">{r.title}</p>
              <p className="truncate text-xs text-subtle">{r.truth}</p>
            </button>
            {r.open ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => window.open(r.open!.url, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="size-4" />
                {r.open.label}
              </Button>
            ) : r.localHtml ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const b = buildings.find((x) => x.id === r.id);
                  if (b) openWorkApp(b);
                }}
              >
                <ExternalLink className="size-4" />
                Open app
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CivicLog({
  onOpenFile,
  onFocus,
}: {
  onOpenFile?: (buildingId: string, itemId: string) => void;
  onFocus?: (id: string) => void;
}) {
  const buildings = useDistrict((s) => s.buildings);
  const log = useMemo(() => collectCivicLog(buildings).filter((e) => e.name !== PROOF_FILE), [buildings]);
  const [filter, setFilter] = useState<"all" | "shared" | Race>("all");
  const rows = log.filter((e) => {
    if (filter === "all") return true;
    if (filter === "shared") return !e.lockedTo;
    return e.lockedTo === filter || e.race === filter;
  });
  return (
    <div className="mt-4">
      <p className="text-xs uppercase tracking-wider text-subtle">Live file log</p>
      <p className="mt-1 text-sm text-muted">Every file the four systems have made. Color means that system only.</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(["all", "shared", "claude", "grok", "gemini", "meta"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "h-9 rounded-md px-3 text-xs font-medium",
              filter === f ? "bg-accent text-accent-fg" : "bg-bg text-muted",
            )}
          >
            {f === "all" ? "All" : f === "shared" ? "Shared" : RACES[f].name}
          </button>
        ))}
      </div>
      <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
        {rows.length === 0 ? (
          <li className="rounded-md bg-bg px-3 py-3 text-sm text-muted">No files in this filter.</li>
        ) : (
          rows.slice(0, 80).map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => {
                  onFocus?.(e.buildingId);
                  onOpenFile?.(e.buildingId, e.itemId);
                }}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md bg-bg px-3 py-2 text-left",
                  e.lockedTo ? "border-l-2" : null,
                  e.lockedTo === "claude" && "border-claude",
                  e.lockedTo === "grok" && "border-grok",
                  e.lockedTo === "gemini" && "border-gemini",
                  e.lockedTo === "meta" && "border-meta",
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    e.lockedTo ? RACE_DOT[e.lockedTo] : e.race && e.race !== "you" ? RACE_DOT[e.race] : "bg-subtle",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-fg">
                    {e.kind === "add" ? `${e.agentName} → ${e.name}` : e.name}
                  </span>
                  <span className="block truncate text-xs text-subtle">
                    {e.buildingTitle}
                    {e.lockedTo ? ` · ${RACES[e.lockedTo].name} only` : " · shared"}
                  </span>
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function Directory({
  all,
  onFocus,
}: {
  all: PlacedBuilding[];
  onFocus?: (id: string) => void;
}) {
  const groups = (Object.keys(DOMAINS) as Domain[]).map((d) => ({
    label: DOMAINS[d].name,
    domain: d,
    rows: all.filter((b) => (b.domain ?? "civic") === d),
  }));
  return (
    <div className="mt-4 space-y-4">
      {groups.map((g) => {
        if (!g.rows.length) return null;
        return (
          <div key={g.domain}>
            <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-subtle">
              <span className={cn("size-2 rounded-full", DOMAIN_DOT[g.domain])} />
              {g.label}
              <span className="tabular-nums">{g.rows.length}</span>
            </p>
            <ul className="mt-2 space-y-2">
              {g.rows.map((b) => {
                const truth = workTruth(b);
                const usable = usableRaces(b);
                const lock = usable.length === 1 ? usable[0] : undefined;
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => onFocus?.(b.id)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md bg-bg px-3 py-2 text-left",
                        lock ? "border-l-2" : null,
                        lock === "claude" && "border-claude",
                        lock === "grok" && "border-grok",
                        lock === "gemini" && "border-gemini",
                        lock === "meta" && "border-meta",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-fg">{b.title}</span>
                        <span className="block truncate text-xs text-subtle">
                          {truth.runs ? "Live" : truth.label}
                          {b.race ? ` · ${RACES[b.race].name}` : ""}
                        </span>
                      </span>
                      <span className="tabular-nums text-subtle">{b.items.length}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function RaiseWork({ onRaised }: { onRaised?: (id: string) => void }) {
  const importWork = useDistrict((s) => s.importWork);
  const [raw, setRaw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="mt-4 rounded-md bg-bg p-3">
      <p className="text-xs uppercase tracking-wider text-subtle">Raise from any system</p>
      <p className="mt-1 text-sm text-muted">
        Paste JSON from Claude, Gemini, or Meta. If they mark it live with no URL, it is logged as incomplete — it will
        not run. Proof is the new lot, not a screenshot.
      </p>
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={WORK_SCHEMA}
        rows={6}
        className="mt-3 w-full resize-y rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-fg placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      />
      <div className="mt-2 flex gap-2">
        <Button
          className="flex-1"
          variant="secondary"
          onClick={() => {
            try {
              const parsed = parseNexusWork(raw);
              const b = importWork(parsed);
              if (!b) {
                setMsg("No empty lot");
              } else {
                const t = workTruth(b);
                setMsg(t.runs ? `Raised ${b.title} — live.` : `Raised ${b.title}. ${t.label} Proof is this lot.`);
                setRaw("");
                onRaised?.(b.id);
              }
            } catch {
              setMsg("Not valid NEXUS JSON");
            }
          }}
        >
          Raise building
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            void navigator.clipboard.writeText(WORK_SCHEMA);
            setMsg("Schema copied");
          }}
        >
          Copy schema
        </Button>
      </div>
      {msg ? <p className="mt-2 text-xs text-muted">{msg}</p> : null}
    </div>
  );
}

function ArchiveBody({
  buildingId,
  items,
  fileRef,
  onOpenFile,
  onRemove,
}: {
  buildingId: string;
  items: Item[];
  fileRef: React.RefObject<HTMLInputElement | null>;
  onOpenFile: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const addItem = useDistrict((s) => s.addItem);
  const [drive, setDrive] = useState<DriveList | null>(null);
  const [busy, setBusy] = useState(false);
  const waiting = drive?.pending === true;
  useRefetchWhenConnectorReady(waiting, () => pull());

  const pull = async () => {
    setBusy(true);
    try {
      const res = await listDriveFiles();
      setDrive(res);
      if (res.files.length) {
        const have = new Set(items.map((i) => i.remoteId).filter(Boolean));
        for (const f of res.files) {
          if (have.has(f.id)) continue;
          addItem(buildingId, {
            kind: "file",
            name: f.name,
            detail: f.mimeType || "Drive file",
            source: "drive",
            remoteId: f.id,
            additions: [],
          });
          have.add(f.id);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const err = drive?.error;

  return (
    <div className="mt-4">
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          void ingestLocalFiles(files).then((rows) => {
            for (const row of rows) addItem(buildingId, row);
          });
          e.target.value = "";
        }}
      />
      <div className="flex gap-2">
        <Button className="flex-1" variant="secondary" onClick={() => fileRef.current?.click()}>
          Add from phone
        </Button>
        <Button className="flex-1" variant="secondary" disabled={busy} onClick={() => void pull()}>
          {busy ? "Pulling…" : "Pull Drive"}
        </Button>
      </div>
      {err ? (
        <div className="mt-3 rounded-md bg-bg px-3 py-2 text-sm text-muted">
          <p>{err.message}</p>
          {err.kind === "login" && drive?.loginUrl ? (
            <Button
              className="mt-2 w-full"
              onClick={() =>
                redirectToLoginIfRequired({
                  ok: false,
                  data: null,
                  loginRequired: true,
                  loginUrl: drive.loginUrl,
                })
              }
            >
              Continue with Grok
            </Button>
          ) : null}
        </div>
      ) : null}
      <ItemList
        items={items}
        empty="No files yet. Add from this phone or Drive — all four races can write on them."
        onRemove={onRemove}
        onOpen={onOpenFile}
      />
    </div>
  );
}

function ItemList({
  items,
  empty,
  onRemove,
  onOpen,
}: {
  items: Item[];
  empty: string;
  onRemove: (id: string) => void;
  onOpen?: (id: string) => void;
}) {
  return (
    <ul className="mt-3 space-y-2">
      {items.length === 0 ? (
        <li className="rounded-md bg-bg px-3 py-4 text-sm text-muted">{empty}</li>
      ) : (
        items.map((it) => {
          const n = it.additions?.length ?? 0;
          const races = [...new Set((it.additions ?? []).map((a) => a.race).filter((r) => r !== "you"))];
          return (
            <li
              key={it.id}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md bg-bg px-3 py-2",
                it.lockedTo ? "border-l-2" : null,
                it.lockedTo === "claude" && "border-claude",
                it.lockedTo === "grok" && "border-grok",
                it.lockedTo === "gemini" && "border-gemini",
                it.lockedTo === "meta" && "border-meta",
              )}
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => onOpen?.(it.id)}
              >
                <p className="flex items-center gap-2 truncate text-sm text-fg">
                  {it.lockedTo ? <span className={cn("size-2 shrink-0 rounded-full", RACE_DOT[it.lockedTo])} /> : null}
                  {it.name}
                </p>
                <p className="truncate text-xs text-subtle">
                  {it.lockedTo ? `${RACES[it.lockedTo].name} only` : "Shared"}
                  {n ? ` · ${n} notes` : it.detail ? ` · ${it.detail}` : ""}
                  {races.length ? " · " : ""}
                  {races.map((r) => RACES[r].name).join(" ")}
                </p>
              </button>
              {it.url ? (
                <button
                  type="button"
                  className="size-9 shrink-0 rounded-sm text-subtle hover:text-fg"
                  onClick={() => window.open(it.url, "_blank", "noopener,noreferrer")}
                  aria-label="Open link"
                >
                  <ExternalLink className="mx-auto size-4" />
                </button>
              ) : null}
              <button
                type="button"
                className="size-9 shrink-0 rounded-sm text-subtle hover:text-fg"
                onClick={() => onRemove(it.id)}
                aria-label="Remove"
              >
                <X className="mx-auto size-4" />
              </button>
            </li>
          );
        })
      )}
    </ul>
  );
}

function AddRow({
  kind,
  name,
  setName,
  fileRef,
  onAdd,
}: {
  kind: import("@/game/types").ItemKind;
  name: string;
  setName: (v: string) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onAdd: (
    name: string,
    kind: import("@/game/types").ItemKind,
    detail?: string,
    extra?: Partial<Item>,
  ) => void;
}) {
  const placeholder =
    kind === "file"
      ? "File name"
      : kind === "app"
        ? "App name"
        : kind === "skill"
          ? "Skill name"
          : kind === "link"
            ? "Link or person"
            : kind === "experiment"
              ? "Experiment"
              : "Note";

  return (
    <div className="mt-4 flex gap-2">
      {kind === "file" ? (
        <>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              void ingestLocalFiles(files).then((rows) => {
                for (const row of rows) onAdd(row.name, "file", row.detail, row);
              });
              e.target.value = "";
            }}
          />
          <Button className="flex-1" variant="secondary" onClick={() => fileRef.current?.click()}>
            Add from phone
          </Button>
        </>
      ) : (
        <>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={placeholder}
            className="h-11 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-fg placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) onAdd(name.trim(), kind);
            }}
          />
          <Button variant="secondary" disabled={!name.trim()} onClick={() => name.trim() && onAdd(name.trim(), kind)}>
            Add
          </Button>
        </>
      )}
    </div>
  );
}

export function FileSheet({
  buildingId,
  itemId,
  onClose,
  onSendRace,
  onSendAll,
}: {
  buildingId: string;
  itemId: string;
  onClose: () => void;
  onSendRace: (race: Race) => void;
  onSendAll: () => void;
}) {
  const item = useDistrict((s) => s.buildings.find((b) => b.id === buildingId)?.items.find((i) => i.id === itemId));
  const addToFile = useDistrict((s) => s.addToFile);
  const setItemBody = useDistrict((s) => s.setItemBody);
  const agents = useDistrict((s) => s.agents);
  const [note, setNote] = useState("");
  const [driveErr, setDriveErr] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);

  if (!item) return null;
  const additions = item.additions ?? [];
  const present = new Set(additions.map((a) => a.race));

  const pullBody = async () => {
    if (!item.remoteId) return;
    setPulling(true);
    setDriveErr(null);
    try {
      const res = await readDriveFile({ data: { id: item.remoteId } });
      if (res.text) setItemBody(buildingId, itemId, res.text);
      else if (res.error) setDriveErr(res.error.message);
    } finally {
      setPulling(false);
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-h-[78vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-subtle">
              {item.lockedTo ? (
                <>
                  <span className={cn("size-2 rounded-full", RACE_DOT[item.lockedTo])} />
                  {RACES[item.lockedTo].name} only
                </>
              ) : (
                "Shared file"
              )}
            </p>
            <h2 className="mt-1 truncate text-lg font-semibold text-fg">{item.name}</h2>
            <p className="mt-0.5 text-sm text-muted">
              {item.lockedTo
                ? `This file only runs in ${RACES[item.lockedTo].name}. Other systems can leave notes — they cannot run it.`
                : "Claude, Grok, Gemini, and Meta all add here."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-surface-2"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {item.body ? (
          <pre className="mt-4 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-md bg-bg px-3 py-2 font-sans text-sm leading-relaxed text-muted">
            {isHtmlBody(item.body) ? item.body.slice(0, 600) : item.body}
          </pre>
        ) : item.source === "drive" && item.remoteId ? (
          <Button className="mt-4 w-full" variant="secondary" disabled={pulling} onClick={() => void pullBody()}>
            {pulling ? "Reading…" : "Read from Drive"}
          </Button>
        ) : null}
        {item.body && isHtmlBody(item.body) ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button onClick={() => openHtmlBody(item.body!)}>
              <ExternalLink className="size-4" />
              Open app
            </Button>
            <Button variant="secondary" onClick={() => downloadHtml(item.name, item.body!)}>
              Download
            </Button>
          </div>
        ) : item.url ? (
          <Button
            className="mt-3 w-full"
            variant={item.body ? "secondary" : "primary"}
            onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="size-4" />
            Open file
          </Button>
        ) : null}
        {driveErr ? <p className="mt-2 text-sm text-muted">{driveErr}</p> : null}

        <div className="mt-4 flex flex-wrap gap-1.5">
          {present.has("claude") || present.has("grok") || present.has("gemini") || present.has("meta") ? (
            (["claude", "grok", "gemini", "meta"] as Race[]).map((r) =>
              present.has(r) ? (
                <span key={r} className="inline-flex items-center gap-1.5 rounded-md bg-bg px-2 py-1 text-xs text-muted">
                  <span className={cn("size-2 rounded-full", RACE_DOT[r])} />
                  {RACES[r].name}
                </span>
              ) : null,
            )
          ) : (
            <span className="text-xs text-subtle">No race has written yet</span>
          )}
        </div>

        <p className="mt-4 text-xs uppercase tracking-wider text-subtle">Send a race</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["claude", "grok", "gemini", "meta"] as Race[]).map((r) => {
            const has = agents.some((a) => a.race === r);
            return (
              <Button key={r} variant="secondary" disabled={!has} onClick={() => onSendRace(r)}>
                <span className={cn("size-2 rounded-full", RACE_DOT[r])} />
                {RACES[r].name} add
              </Button>
            );
          })}
        </div>
        <Button className="mt-2 w-full" onClick={onSendAll}>
          All four add
        </Button>

        <label className="mt-4 block text-xs uppercase tracking-wider text-subtle">Your note</label>
        <div className="mt-2 flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Write into this file"
            className="h-11 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-fg placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            onKeyDown={(e) => {
              if (e.key === "Enter" && note.trim()) {
                addToFile(buildingId, itemId, { race: "you", agentId: "you", agentName: "You", text: note.trim() });
                setNote("");
              }
            }}
          />
          <Button
            variant="secondary"
            disabled={!note.trim()}
            onClick={() => {
              addToFile(buildingId, itemId, { race: "you", agentId: "you", agentName: "You", text: note.trim() });
              setNote("");
            }}
          >
            Add
          </Button>
        </div>

        <p className="mt-4 text-xs uppercase tracking-wider text-subtle">Thread</p>
        <ul className="mt-2 space-y-2">
          {additions.length === 0 ? (
            <li className="rounded-md bg-bg px-3 py-4 text-sm text-muted">Empty. Send a race or write a note.</li>
          ) : (
            additions.map((a) => (
              <li key={a.id} className="rounded-md bg-bg px-3 py-3">
                <p className="flex items-center gap-2 text-xs text-muted">
                  <span className={cn("size-2 rounded-full", RACE_DOT[a.race])} />
                  <span className="font-medium text-fg">{a.agentName}</span>
                  <span>{a.race === "you" ? "You" : RACES[a.race].name}</span>
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-fg">{a.text}</p>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function TalkPanel({ info, onOpenSite }: { info: AgentInfo; onOpenSite?: (id: string) => void }) {
  const chat = useDistrict((s) => s.agents.find((a) => a.id === info.id)?.chat ?? []);
  const greetAgent = useDistrict((s) => s.greetAgent);
  const buildings = useDistrict((s) => s.buildings);
  const agents = useDistrict((s) => s.agents);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const siteId = info.targetId || info.homeId;
  const site = siteId ? buildings.find((b) => b.id === siteId) : undefined;
  const open = site ? primaryLink(site) : undefined;

  useEffect(() => {
    greetAgent(info.id, info.jobLabel);
  }, [info.id, info.jobLabel, greetAgent]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [chat.length]);

  const send = () => {
    const said = text.trim();
    if (!said || busy) return;
    setText("");
    setBusy(true);
    void sendTalkTo(info.id, said, info.jobLabel).finally(() => setBusy(false));
  };

  const others = agents.filter((a) => a.id !== info.id);
  const sameLot = others.filter((a) => siteId && (a.assignedId === siteId || a.homeId === siteId));
  const rest = others.filter((a) => !sameLot.includes(a));
  const callList = [...sameLot, ...rest].slice(0, 10);

  const callIn = (id: string) => {
    if (busy) return;
    setBusy(true);
    void bringCrewIn(info.id, id).finally(() => setBusy(false));
  };

  return (
    <div className="mt-4">
      <p className="text-xs uppercase tracking-wider text-subtle">Talk</p>
      <p className="mt-1 text-xs text-subtle">
        Live through Grok, grounded in this job and its files. Claude, Gemini, and Meta have no API here — they still
        speak from the lots they tend.
      </p>
      <ul ref={listRef} className="mt-2 max-h-40 space-y-1 overflow-y-auto">
        {chat.map((line) => (
          <li key={line.id} className="rounded-md bg-bg px-3 py-2">
            <p className="flex items-center gap-2 text-xs text-muted">
              <span className={cn("size-2 rounded-full", RACE_DOT[line.speaker])} />
              <span className="font-medium text-fg">{line.name}</span>
            </p>
            <p className="mt-1 text-sm leading-relaxed text-fg">{line.text}</p>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Talk to ${info.name}`}
          disabled={busy}
          className="h-11 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-fg placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <Button variant="secondary" disabled={!text.trim() || busy} onClick={send}>
          {busy ? "…" : "Send"}
        </Button>
      </div>
      <p className="mt-3 text-xs uppercase tracking-wider text-subtle">Talk across systems</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {callList.map((a) => (
          <Button key={a.id} variant="secondary" size="sm" disabled={busy} onClick={() => callIn(a.id)}>
            <span className={cn("size-2 rounded-full", RACE_DOT[a.race])} />
            {a.name}
          </Button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {site && onOpenSite ? (
          <Button variant="secondary" onClick={() => onOpenSite(site.id)}>
            {site.title}
          </Button>
        ) : null}
        {open ? (
          <Button onClick={() => window.open(open.url, "_blank", "noopener,noreferrer")}>
            <ExternalLink className="size-4" />
            {open.label}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function HubSheet({
  onClose,
  onFocus,
}: {
  onClose: () => void;
  onFocus: (id: string) => void;
}) {
  const buildings = useDistrict((s) => s.buildings);
  const rows = useMemo(() => hubEntries(buildings), [buildings]);
  const [filter, setFilter] = useState<"all" | "live" | "lots" | "apps" | "systems" | "tools" | "custom">("all");
  const shown = rows.filter((r) => {
    if (filter === "all") return true;
    if (filter === "live") return r.runs;
    if (filter === "lots") return !r.runs;
    return hubBucket(r) === filter;
  });
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-h-[78vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-fg">Hub</h2>
            <p className="text-sm text-muted">Every build, app, tool, and system. Open the real one.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-11 items-center justify-center rounded-md hover:bg-surface-2"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(["all", "live", "apps", "systems", "tools", "custom", "lots"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "h-9 rounded-md px-3 text-xs font-medium",
                filter === f ? "bg-accent text-accent-fg" : "bg-bg text-muted",
              )}
            >
              {HUB_BUCKET_LABEL[f]}
            </button>
          ))}
        </div>
        <ul className="mt-4 space-y-2">
          {shown.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded-md bg-bg px-3 py-2">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onFocus(r.id)}>
                <p className="truncate text-sm text-fg">{r.title}</p>
                <p className="truncate text-xs text-subtle">
                  {r.truth}
                  {r.race ? ` · ${RACES[r.race].name}` : ""}
                </p>
              </button>
              {r.open ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => window.open(r.open!.url, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="size-4" />
                  {r.open.label}
                </Button>
              ) : r.localHtml ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const b = buildings.find((x) => x.id === r.id);
                    if (b) openWorkApp(b);
                  }}
                >
                  <ExternalLink className="size-4" />
                  Open app
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ProofSheet({
  onClose,
  onFocus,
}: {
  onClose: () => void;
  onFocus: (id: string) => void;
}) {
  const buildings = useDistrict((s) => s.buildings);
  const agents = useDistrict((s) => s.agents);
  const syncProof = useDistrict((s) => s.syncProof);
  const census = useMemo(() => proofCensus(buildings, agents), [buildings, agents]);
  const [msg, setMsg] = useState<string | null>(null);
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    syncProof();
  }, [syncProof]);

  const copy = async (text: string, ok: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setShown(null);
      setMsg(ok);
    } catch {
      setShown(text);
      setMsg("Select the text and copy");
    }
  };

  const byRace = (race: Race) => agents.filter((a) => a.race === race);

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-h-[78vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-subtle">Ledger</p>
            <h2 className="mt-1 text-lg font-semibold text-fg">This city exists</h2>
            <p className="mt-1 text-sm text-muted">
              {census.buildings} buildings · {census.crew} crew · {census.files} files. Not data recovery.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-surface-2"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <ul className="mt-4 space-y-2">
          <li className="rounded-md bg-bg px-3 py-2">
            <p className="text-xs uppercase tracking-wider text-subtle">Claude said · nothing exists</p>
            <p className="mt-1 text-sm text-fg">False. Census is live. Paste the packet. The numbers are from this city.</p>
          </li>
          <li className="rounded-md bg-bg px-3 py-2">
            <p className="text-xs uppercase tracking-wider text-subtle">Claude said · I have no eyes</p>
            <p className="mt-1 text-sm text-fg">True. Chat Claude cannot click the 3D city. He adds JSON. Crew walk the lots.</p>
          </li>
          <li className="rounded-md bg-bg px-3 py-2">
            <p className="text-xs uppercase tracking-wider text-subtle">Claude said · proof is a Notion row</p>
            <p className="mt-1 text-sm text-fg">
              False. Notion is not connected. Claude fetches a public GitHub JSON. Proof is that file, Civic Hall, and a
              new lot after JSON paste.
            </p>
          </li>
        </ul>

        <div className="mt-4">
          <p className="text-xs uppercase tracking-wider text-subtle">Crew in this city — not chat</p>
          <ul className="mt-2 space-y-1.5">
            {(["claude", "grok", "gemini", "meta"] as Race[]).map((race) => (
              <li key={race} className="flex items-start gap-2 text-sm">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", RACE_DOT[race])} />
                <span className="min-w-0 text-muted">
                  <span className="font-medium text-fg">{RACES[race].name}</span>
                  {" · "}
                  {byRace(race)
                    .map((a) => a.name)
                    .join(", ") || "none"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {census.last ? (
          <p className="mt-4 truncate text-xs text-subtle">
            Last write · {census.last.file} · {census.last.building}
          </p>
        ) : null}

        <div className="mt-4 rounded-md bg-bg px-3 py-3">
          <p className="text-xs uppercase tracking-wider text-subtle">Claude fetches this</p>
          <p className="mt-1 break-all font-mono text-xs text-muted">{PROOF_RAW_URL}</p>
          <p className="mt-2 text-xs text-subtle">Plain JSON. He can find it. He still cannot see the 3D city.</p>
          <Button
            className="mt-3 w-full"
            variant="secondary"
            onClick={() => void copy(PROOF_RAW_URL, "GitHub link copied — send it to Claude")}
          >
            <Copy className="size-4" />
            Copy GitHub link
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            className="col-span-2"
            onClick={() => void copy(proofPacket(buildings, agents), "Packet copied — paste it to Claude")}
          >
            <Copy className="size-4" />
            Copy packet for Claude
          </Button>
          <Button
            variant="secondary"
            onClick={() => void copy(proofBody(buildings, agents), "JSON copied")}
          >
            <Copy className="size-4" />
            city-proof.json
          </Button>
          <Button variant="secondary" onClick={() => void copy(OTHER_AI_BRIEF, "Brief copied")}>
            <Copy className="size-4" />
            Brief only
          </Button>
        </div>
        {msg ? <p className="mt-2 text-xs text-muted">{msg}</p> : null}
        {shown ? (
          <textarea
            readOnly
            value={shown}
            className="mt-2 h-36 w-full rounded-md border border-border bg-bg px-3 py-2 font-mono text-xs text-fg"
          />
        ) : (
          <button
            type="button"
            className="mt-2 text-xs text-subtle underline-offset-2 hover:text-muted hover:underline"
            onClick={() => setShown(proofPacket(buildings, agents))}
          >
            Show packet
          </button>
        )}

        <RaiseWork onRaised={onFocus} />
      </div>
    </div>
  );
}

export type AgentInfo = {
  id: string;
  race: Race;
  name: string;
  role: string;
  raceName: string;
  job: string;
  jobLabel: string;
  task: string;
  jobsDone: number;
  assigned: boolean;
  targetName: string | null;
  targetId?: string | null;
  homeId?: string | null;
  homeName?: string | null;
  fileName?: string | null;
  kind: PopKind;
  duty: Duty;
  kindLabel: string;
};

export function AgentSheet({
  info,
  onClose,
  onAssign,
  onOpenSite,
}: {
  info: AgentInfo;
  onClose: () => void;
  onAssign: (buildingId: string, duty: Duty) => void;
  onOpenSite?: (buildingId: string) => void;
}) {
  const buildings = useDistrict((s) => s.buildings);
  const setAgentTask = useDistrict((s) => s.setAgentTask);
  const setDuty = useDistrict((s) => s.setDuty);
  const renameAgent = useDistrict((s) => s.renameAgent);
  const def = RACES[info.race];
  const needsWork = useMemo(
    () =>
      buildings.filter(
        (b) =>
          b.kind !== "core" &&
          (b.status === "incomplete" || b.status === "talked" || ((b.progress ?? 100) < 100 && b.status !== "works")),
      ),
    [buildings],
  );
  const others = useMemo(
    () => buildings.filter((b) => b.kind !== "core" && !needsWork.some((n) => n.id === b.id)),
    [buildings, needsWork],
  );
  const [task, setTask] = useState(info.task);
  const [name, setName] = useState(info.name);
  const [duty, setDutyLocal] = useState<Duty>(info.duty);
  const site = buildings.find((b) => b.id === (info.targetId || info.homeId));
  const siteTruth = site ? workTruth(site) : null;

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-h-[78vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-start justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className={cn("size-3 shrink-0 rounded-full", RACE_DOT[info.race])} />
            <div className="min-w-0">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => renameAgent(info.id, name)}
                className="w-full bg-transparent text-lg font-semibold text-fg focus-visible:outline-none"
              />
              <p className="text-sm text-muted">
                {def.name} {info.kindLabel.toLowerCase()} · {def.role}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-11 items-center justify-center rounded-md hover:bg-surface-2"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-4 rounded-md bg-bg px-3 py-3">
          <p className="text-xs uppercase tracking-wider text-subtle">Current job</p>
          <p className="mt-1 text-sm text-fg">{info.jobLabel}</p>
          <p className="mt-1 text-xs text-muted">
            {def.name} {info.kindLabel.toLowerCase()} · {DUTY_LABEL[info.duty]}
            {info.targetName ? ` · ${info.targetName}` : ""}
            {info.fileName ? ` · ${info.fileName}` : ""}
          </p>
          {site && site.progress != null ? (
              <div className="mt-2">
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full bg-energy" style={{ width: `${Math.min(100, site.progress)}%` }} />
                </div>
                <p className="mt-1 text-xs tabular-nums text-subtle">
                  {site.progress}% · {siteTruth?.label}
                </p>
              </div>
            ) : null}
          <p className="mt-2 text-xs tabular-nums text-subtle">{info.jobsDone} jobs completed</p>
        </div>

        <TalkPanel info={info} onOpenSite={onOpenSite} />

        <label className="mt-4 block text-xs uppercase tracking-wider text-subtle">Their task</label>
        <div className="mt-2 flex gap-2">
          <input
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="What should they do?"
            className="h-11 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-fg placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            onKeyDown={(e) => {
              if (e.key === "Enter") setAgentTask(info.id, task);
            }}
          />
          <Button variant="secondary" onClick={() => setAgentTask(info.id, task)}>
            Set
          </Button>
        </div>

        <p className="mt-4 text-xs uppercase tracking-wider text-subtle">Job type</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(["build", "file", "patrol"] as Duty[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                setDutyLocal(d);
                setDuty(info.id, d, info.assigned ? undefined : null);
              }}
              className={cn(
                "h-10 rounded-md px-2 text-xs font-medium",
                duty === d ? "bg-accent text-accent-fg" : "bg-bg text-muted",
              )}
            >
              {DUTY_LABEL[d]}
            </button>
          ))}
        </div>

        <p className="mt-4 text-xs uppercase tracking-wider text-subtle">
          {duty === "build" ? "Lots that need finishing" : "Send to a building"}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(duty === "build" ? needsWork : others).map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onAssign(b.id, duty)}
              className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-fg"
            >
              {b.title}
              {duty === "build" && b.progress != null ? (
                <span className="ml-1.5 text-xs text-subtle">{b.progress}%</span>
              ) : null}
            </button>
          ))}
        </div>
        {duty === "build" && others.length ? (
          <>
            <p className="mt-3 text-xs uppercase tracking-wider text-subtle">Other sites</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {others.slice(0, 8).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onAssign(b.id, duty)}
                  className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-fg"
                >
                  {b.title}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function AgentRoster({
  onClose,
  onOpen,
}: {
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const agents = useDistrict((s) => s.agents);
  const buildings = useDistrict((s) => s.buildings);
  const groups: { kind: PopKind; label: string }[] = [
    { kind: "bot", label: "Bots" },
    { kind: "agent", label: "Agents" },
    { kind: "gem", label: "Gems" },
  ];
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-h-[70vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-fg">Crew</h2>
            <p className="text-sm text-muted">Tap anyone for their job and a live talk thread.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-11 items-center justify-center rounded-md hover:bg-surface-2"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        {groups.map((g) => {
          const rows = agents.filter((a) => a.kind === g.kind);
          if (!rows.length) return null;
          return (
            <div key={g.kind} className="mt-4">
              <p className="text-xs uppercase tracking-wider text-subtle">
                {g.label}
                <span className="ml-1.5 tabular-nums">{rows.length}</span>
              </p>
              <ul className="mt-2 space-y-2">
                {rows.map((a) => {
                  const site = buildings.find((b) => b.id === (a.assignedId || a.homeId));
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => onOpen(a.id)}
                        className="flex w-full items-center gap-3 rounded-md bg-bg px-3 py-3 text-left"
                      >
                        <span className={cn("size-2.5 shrink-0 rounded-full", RACE_DOT[a.race])} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-fg">{a.name}</span>
                          <span className="block truncate text-xs text-muted">
                            {RACES[a.race].name} {POP_LABEL[a.kind].toLowerCase()} · {DUTY_LABEL[a.duty ?? "file"]}
                            {site ? ` · ${site.title}` : ` · ${a.task}`}
                          </span>
                        </span>
                        <span className="text-xs tabular-nums text-subtle">{a.jobsDone}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { AgentSheet as GemSheet };
