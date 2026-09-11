import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Copy,
  Radio,
  Stamp,
  Users,
  Wrench,
  X,
  Hexagon,
  Factory,
  Plane,
} from "lucide-react";
import { CENSUS, CLAIMS, INFRA } from "@/lib/census";
import { crewLine, tableTalk } from "@/lib/dialogue";
import { RACE_CSS, stageOf } from "@/lib/honest";
import { GITHUB_RAW, GITHUB_REPO, GITHUB_V2 } from "@/lib/persistence";
import {
  crewOf,
  logOf,
  lotsOf,
  makeProofPacket,
  useNexus,
} from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Lot, Race } from "@/lib/types";

export function Overlays() {
  const entered = useNexus((s) => s.entered);
  const panel = useNexus((s) => s.panel);
  const selectedId = useNexus((s) => s.selectedId);
  const talkingCrew = useNexus((s) => s.talkingCrew);
  const extraLots = useNexus((s) => s.extraLots);
  const raise = useNexus((s) => s.raise);
  const archive = useNexus((s) => s.archive);
  const assigned = useNexus((s) => s.assigned);
  const log = useNexus((s) => s.log);
  const sourceOnGithub = useNexus((s) => s.sourceOnGithub);
  const setPanel = useNexus((s) => s.setPanel);
  const select = useNexus((s) => s.select);

  const lots = useMemo(
    () => lotsOf({ extraLots, raise, archive }),
    [extraLots, raise, archive],
  );
  const crew = useMemo(() => crewOf({ assigned }), [assigned]);
  const selected = lots.find((l) => l.id === selectedId) ?? null;
  const infraHit = INFRA.find((i) => i.id === selectedId) ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest("input, textarea, select, [contenteditable]")) return;
      if (e.code === "Escape") {
        setPanel(null);
        select(null);
        useNexus.getState().talkCrew(null);
      }
      if (!useNexus.getState().entered) return;
      if (e.code === "Digit1") setPanel("ops");
      if (e.code === "Digit2") setPanel("archive");
      if (e.code === "Digit3") setPanel("table");
      if (e.code === "Digit4") setPanel("proof");
      if (e.code === "Digit5") setPanel("forge");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPanel, select]);

  return (
    <>
      {!entered && <StartScreen lots={lots} crewCount={crew.length} />}
      {entered && (
        <>
          <TopBar
            extra={extraLots.length}
            sourceOnGithub={sourceOnGithub}
            lots={lots}
          />
          <Dock panel={panel} setPanel={setPanel} />
          <FlyHint />
          <TouchStick />
          {selected && !panel && <ModuleInspect lot={selected} crew={crew} />}
          {infraHit && !selected && !panel && (
            <InfraInspect title={infraHit.title} blurb={infraHit.blurb} />
          )}
          {panel === "ops" && <CivicHall lots={lots} log={logOf({ log })} />}
          {panel === "proof" && <ProofDesk lots={lots} extra={extraLots.length} />}
          {panel === "table" && <TheTable lots={lots} crew={crew} />}
          {panel === "forge" && <Construction lots={lots} />}
          {panel === "factory" && <AssetFactory lot={lots.find((l) => l.id === "asset-factory")} />}
          {panel === "archive" && <Archive lots={lots} />}
          {panel === "roster" && <CrewTalk lots={lots} crew={crew} focus={talkingCrew} />}
        </>
      )}
    </>
  );
}

function StartScreen({ lots, crewCount }: { lots: Lot[]; crewCount: number }) {
  const enter = useNexus((s) => s.enter);
  const extra = useNexus((s) => s.extraLots.length);
  const buildings = CENSUS.buildings + extra;
  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end bg-bg/50 p-6 sm:p-10">
      <div className="max-w-xl space-y-5">
        <p className="font-mono text-xs tracking-[0.28em] text-muted uppercase">
          NEXUS Station · Mars · sol inventory
        </p>
        <h1 className="font-display text-5xl leading-none tracking-tight text-fg sm:text-6xl">
          NEXUS
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-muted">
          Pressurized inventory of Joshua's systems. Same lots. New hull.
          Claude cannot see this station.
        </p>
        <div className="flex gap-6 font-mono text-sm tabular-nums">
          <Stat n={buildings} l="modules" />
          <Stat n={crewCount} l="crew" />
          <Stat n={CENSUS.files} l="files" />
        </div>
        <p className="font-mono text-[11px] tracking-wide text-muted">
          {lots.filter((l) => l.status === "works").length} sealed ·{" "}
          {lots.filter((l) => l.id === "ghost-hunter")[0]?.truth} Ghost Hunter ·
          Craigslist file-only
        </p>
        <button
          type="button"
          onClick={enter}
          className="mt-2 inline-flex h-12 items-center gap-2 rounded-md bg-accent px-6 text-sm font-medium text-bg transition-transform duration-[var(--motion-quick)] ease-[var(--ease-out)] hover:brightness-110 active:scale-[0.98]"
        >
          <Plane className="size-4" strokeWidth={1.75} />
          Begin EVA
        </button>
        <p className="font-mono text-[11px] text-muted">
          W/S thrust · A/D yaw left/right · Space up · Shift down · mouse look
        </p>
      </div>
    </div>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return (
    <div>
      <div className="text-2xl text-fg">{n}</div>
      <div className="text-[11px] uppercase tracking-widest text-muted">{l}</div>
    </div>
  );
}

function TopBar({
  extra,
  sourceOnGithub,
  lots,
}: {
  extra: number;
  sourceOnGithub: boolean;
  lots: Lot[];
}) {
  const buildings = CENSUS.buildings + extra;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3 sm:p-4">
      <div className="pointer-events-auto rounded-lg border border-border bg-surface/95 px-3 py-2">
        <div className="font-display text-lg tracking-wide text-fg">NEXUS</div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          Mars station
        </div>
      </div>
      <div className="pointer-events-auto rounded-lg border border-border bg-surface/95 px-3 py-2 font-mono text-xs tabular-nums text-fg">
        {buildings} / {CENSUS.crew} / {CENSUS.files}
        <span className="ml-2 text-muted">
          {lots.filter((l) => l.status === "works").length} live
        </span>
      </div>
      <div
        className={cn(
          "pointer-events-auto max-w-[14rem] rounded-lg border px-3 py-2 font-mono text-[10px] leading-snug",
          sourceOnGithub
            ? "border-border bg-surface/95 text-muted"
            : "border-dead/40 bg-surface/95 text-dead",
        )}
      >
        {sourceOnGithub
          ? "Source on GitHub"
          : "Artifact only — will not survive if the chat is gone"}
      </div>
    </div>
  );
}

function Dock({
  panel,
  setPanel,
}: {
  panel: ReturnType<typeof useNexus.getState>["panel"];
  setPanel: (p: typeof panel) => void;
}) {
  const items = [
    { id: "ops" as const, label: "Ops", icon: Radio },
    { id: "archive" as const, label: "Archive", icon: BookOpen },
    { id: "table" as const, label: "Table", icon: Users },
    { id: "proof" as const, label: "Airlock", icon: Stamp },
    { id: "forge" as const, label: "Forge", icon: Wrench },
    { id: "factory" as const, label: "Factory", icon: Factory },
    { id: "roster" as const, label: "Crew", icon: Hexagon },
  ];
  return (
    <nav className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1 rounded-xl border border-border bg-surface/95 p-1">
      {items.map((it) => {
        const Icon = it.icon;
        const on = panel === it.id;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => setPanel(on ? null : it.id)}
            className={cn(
              "flex h-11 min-w-11 flex-col items-center justify-center rounded-lg px-2.5 text-[10px] uppercase tracking-wider transition-colors duration-[var(--motion-quick)]",
              on ? "bg-raised text-fg" : "text-muted hover:text-fg",
            )}
          >
            <Icon className="size-4" strokeWidth={1.6} />
            <span className="hidden sm:block">{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function FlyHint() {
  return (
    <div className="pointer-events-none absolute bottom-16 left-3 z-10 hidden rounded-md border border-border bg-surface/95 px-2 py-1.5 font-mono text-[10px] text-muted sm:block">
      EVA drone · A yaw left · D yaw right · W thrust
    </div>
  );
}

function TouchStick() {
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const up = () => {
      setOrigin(null);
      const t = (window as unknown as { __controlsTest?: { setKeys: (c: string[]) => void } })
        .__controlsTest;
      t?.setKeys([]);
    };
    window.addEventListener("touchend", up);
    window.addEventListener("touchcancel", up);
    return () => {
      window.removeEventListener("touchend", up);
      window.removeEventListener("touchcancel", up);
    };
  }, []);
  return (
    <div
      className="absolute bottom-20 left-3 z-10 size-28 rounded-full border border-border bg-surface/80 sm:hidden"
      onTouchStart={(e) => {
        const t = e.changedTouches[0];
        setOrigin({ x: t.clientX, y: t.clientY });
      }}
      onTouchMove={(e) => {
        if (!origin) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - origin.x;
        const dy = t.clientY - origin.y;
        const codes: string[] = [];
        if (dy < -18) codes.push("KeyW");
        if (dy > 18) codes.push("KeyS");
        if (dx < -18) codes.push("KeyA");
        if (dx > 18) codes.push("KeyD");
        const probe = (
          window as unknown as { __controlsTest?: { setKeys: (c: string[]) => void } }
        ).__controlsTest;
        probe?.setKeys(codes);
      }}
    />
  );
}

function Panel({
  title,
  kicker,
  children,
  onClose,
  wide,
}: {
  title: string;
  kicker?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <aside
      className={cn(
        "absolute right-3 top-20 z-20 flex max-h-[min(72dvh,640px)] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-[0_12px_40px_rgba(0,0,0,0.35)]",
        wide ? "w-[min(100%-1.5rem,28rem)]" : "w-[min(100%-1.5rem,22rem)]",
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          {kicker && (
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              {kicker}
            </div>
          )}
          <h2 className="font-display text-xl tracking-wide text-fg">{title}</h2>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="grid size-9 place-items-center rounded-md text-muted hover:bg-raised hover:text-fg"
        >
          <X className="size-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
    </aside>
  );
}

function ModuleInspect({ lot, crew }: { lot: Lot; crew: ReturnType<typeof crewOf> }) {
  const setPanel = useNexus((s) => s.setPanel);
  const assignCrew = useNexus((s) => s.assignCrew);
  const raiseLot = useNexus((s) => s.raiseLot);
  const select = useNexus((s) => s.select);
  const here = crew.filter((c) => c.assignedTo === lot.id);
  const stage = stageOf(lot);
  const race = (lot.race ?? "shared") as Race | "shared";
  return (
    <Panel
      title={lot.title}
      kicker={lot.race ? lot.race : "shared hull"}
      onClose={() => select(null)}
    >
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <span
            className="size-2 rounded-full"
            style={{ background: RACE_CSS[race] }}
          />
          <StatusPill status={lot.status} truth={lot.truth} />
        </div>
        <p className="text-muted">{lot.truth}</p>
        {lot.id === "asset-factory" && (
          <p className="rounded-md border border-border bg-raised px-3 py-2 text-xs text-muted">
            Tools Index — not the ledger. The 52-entry book is lost. Empty is honest.
          </p>
        )}
        {lot.id === "craigslist-deal-finder" && (
          <p className="text-xs text-muted">File only — will not run as an app.</p>
        )}
        <div className="font-mono text-[11px] text-muted">
          stage {stage} · {stageLabel(stage)} · gx {lot.gx},{lot.gz}
        </div>
        {lot.files.length > 0 && (
          <ul className="space-y-1 font-mono text-xs text-fg">
            {lot.files.map((f) => (
              <li key={f}>{f}</li>
            ))}
            {lot.archive.map((a) => (
              <li key={a.name}>{a.name}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          {lot.links.map((l) => (
            <a
              key={l.url + l.label}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center rounded-md border border-border bg-raised px-3 text-xs text-fg hover:border-accent"
            >
              {l.label}
            </a>
          ))}
          {lot.open && lot.links.length === 0 && (
            <a
              href={lot.open}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center rounded-md border border-border bg-raised px-3 text-xs text-fg hover:border-accent"
            >
              Open
            </a>
          )}
        </div>
        {here.length > 0 && (
          <p className="text-xs text-muted">
            At airlock: {here.map((c) => c.name).join(", ")}
          </p>
        )}
        <label className="block text-xs text-muted">
          Assign crew
          <select
            className="mt-1 h-10 w-full rounded-md border border-border bg-raised px-2 text-sm text-fg"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) assignCrew(e.target.value, lot.id);
              e.target.value = "";
            }}
          >
            <option value="">Stand at this module</option>
            {crew.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} · {c.task}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => raiseLot(lot.id)}
            className="h-10 flex-1 rounded-md bg-accent text-xs font-medium text-bg"
          >
            Raise hull
          </button>
          {lot.id === "asset-factory" && (
            <button
              type="button"
              onClick={() => setPanel("factory")}
              className="h-10 flex-1 rounded-md border border-border text-xs text-fg"
            >
              Ledger
            </button>
          )}
        </div>
      </div>
    </Panel>
  );
}

function InfraInspect({ title, blurb }: { title: string; blurb: string }) {
  const select = useNexus((s) => s.select);
  return (
    <Panel title={title} kicker="station" onClose={() => select(null)}>
      <p className="text-sm text-muted">{blurb}</p>
    </Panel>
  );
}

function StatusPill({ status, truth }: { status: string; truth: string }) {
  const live = status === "works";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        live ? "bg-live/15 text-live" : "bg-raised text-muted",
      )}
    >
      {status} · {truth}
    </span>
  );
}

function stageLabel(s: number) {
  if (s <= 0) return "survey stakes";
  if (s === 1) return "scaffold truss";
  if (s === 2) return "framed hull";
  return "pressurized / lit";
}

function CivicHall({ lots, log }: { lots: Lot[]; log: ReturnType<typeof logOf> }) {
  const [filter, setFilter] = useState<"all" | Race | "shared">("all");
  const setPanel = useNexus((s) => s.setPanel);
  const files = lots.flatMap((l) => {
    const race: Race | "shared" = l.race ?? "shared";
    const rows = [
      ...l.files.filter(Boolean).map((f) => ({ file: f, building: l.title, race })),
      ...l.archive.map((a) => ({ file: a.name, building: l.title, race })),
    ];
    return rows;
  });
  const shown = files.filter((f) => {
    if (filter === "all") return true;
    if (filter === "shared") return f.race === "shared";
    return f.race === filter;
  });
  const tabs: Array<"all" | Race | "shared"> = ["all", "shared", "claude", "grok", "gemini", "meta"];
  return (
    <Panel title="Command Ops" kicker="Civic Hall" onClose={() => setPanel(null)} wide>
      <div className="mb-3 flex flex-wrap gap-1">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilter(t)}
            className={cn(
              "h-8 rounded-md px-2.5 font-mono text-[10px] uppercase tracking-wider",
              filter === t ? "bg-raised text-fg" : "text-muted",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <ul className="space-y-1.5">
        {shown.map((f, i) => (
          <li
            key={f.building + f.file + i}
            className="flex items-baseline justify-between gap-2 border-b border-border/80 py-1.5 font-mono text-xs"
          >
            <span className="text-fg">{f.file}</span>
            <span className="text-muted">{f.building}</span>
          </li>
        ))}
      </ul>
      <h3 className="mt-4 font-display text-lg text-fg">Last writes</h3>
      <ul className="mt-1 space-y-1 font-mono text-[11px] text-muted">
        {log.slice(0, 12).map((w, i) => (
          <li key={w.at + w.file + i}>
            {w.file} · {w.building}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function ProofDesk({ extra }: { lots: Lot[]; extra: number }) {
  const setPanel = useNexus((s) => s.setPanel);
  const pasteWork = useNexus((s) => s.pasteWork);
  const pasteError = useNexus((s) => s.pasteError);
  const extraLots = useNexus((s) => s.extraLots);
  const raise = useNexus((s) => s.raise);
  const archive = useNexus((s) => s.archive);
  const log = useNexus((s) => s.log);
  const sourceOnGithub = useNexus((s) => s.sourceOnGithub);
  const [raw, setRaw] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const packet = makeProofPacket({ extraLots, raise, archive, log });

  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      setCopied("blocked");
    }
  }

  return (
    <Panel title="Airlock customs" kicker="Proof desk" onClose={() => setPanel(null)} wide>
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-3 gap-2 font-mono text-xs tabular-nums">
          <div className="rounded-md border border-border bg-raised p-2">
            <div className="text-muted">modules</div>
            <div className="text-lg text-fg">{CENSUS.buildings + extra}</div>
          </div>
          <div className="rounded-md border border-border bg-raised p-2">
            <div className="text-muted">crew</div>
            <div className="text-lg text-fg">{CENSUS.crew}</div>
          </div>
          <div className="rounded-md border border-border bg-raised p-2">
            <div className="text-muted">files</div>
            <div className="text-lg text-fg">{packet.files}</div>
          </div>
        </div>
        <table className="w-full font-mono text-[11px]">
          <tbody>
            {Object.entries(CLAIMS).map(([k, v]) => (
              <tr key={k} className="border-b border-border">
                <td className="py-1 pr-2 text-muted">{k}</td>
                <td className="py-1 text-right text-fg">{String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => copy("packet", JSON.stringify(packet, null, 2))}
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-medium text-bg"
          >
            <Copy className="size-3.5" /> Copy packet
          </button>
          <button
            type="button"
            onClick={() => copy("raw", GITHUB_RAW)}
            className="inline-flex h-10 items-center rounded-md border border-border px-3 text-xs text-fg"
          >
            Copy census URL
          </button>
        </div>
        {copied && <p className="font-mono text-[11px] text-live">{copied}</p>}
        <p className="break-all font-mono text-[10px] text-muted">{GITHUB_RAW}</p>
        <p className="break-all font-mono text-[10px] text-muted">{GITHUB_V2}</p>
        <p className="text-xs text-muted">
          {sourceOnGithub
            ? `Source: ${GITHUB_REPO}`
            : "Source is still artifact-only until the push lands."}
        </p>
        <label className="block text-xs text-muted">
          Paste nexusWork JSON
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={7}
            className="mt-1 w-full rounded-md border border-border bg-raised p-2 font-mono text-xs text-fg"
            placeholder='{ "nexusWork": 1, "title": "Name", ... }'
          />
        </label>
        {pasteError && <p className="text-xs text-dead">{pasteError}</p>}
        <button
          type="button"
          onClick={() => {
            const lot = pasteWork(raw);
            if (lot) setRaw("");
          }}
          className="h-10 w-full rounded-md bg-accent text-xs font-medium text-bg"
        >
          Stamp dock
        </button>
        <p className="text-[11px] text-muted">
          works with no URL becomes incomplete. Talked with no file is a marked pad.
        </p>
      </div>
    </Panel>
  );
}

function TheTable({ lots, crew }: { lots: Lot[]; crew: ReturnType<typeof crewOf> }) {
  const setPanel = useNexus((s) => s.setPanel);
  const talkCrew = useNexus((s) => s.talkCrew);
  const lines = tableTalk(crew, lots);
  return (
    <Panel title="The Table" kicker="mess / briefing ring" onClose={() => setPanel(null)} wide>
      <ul className="space-y-2 text-sm leading-relaxed text-fg">
        {lines.map((l) => (
          <li key={l} className="border-l-2 border-border pl-3 text-muted">
            <span className="text-fg">{l}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {crew.map((c) => (
          <button
            key={c.name}
            type="button"
            onClick={() => talkCrew(c.name)}
            className="rounded-md border border-border bg-raised px-2 py-2 text-left"
          >
            <div className="text-xs text-fg">{c.name}</div>
            <div className="font-mono text-[10px] text-muted">{c.task}</div>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function CrewTalk({
  lots,
  crew,
  focus,
}: {
  lots: Lot[];
  crew: ReturnType<typeof crewOf>;
  focus: string | null;
}) {
  const setPanel = useNexus((s) => s.setPanel);
  const talkCrew = useNexus((s) => s.talkCrew);
  const assignCrew = useNexus((s) => s.assignCrew);
  const person = crew.find((c) => c.name === focus) ?? crew[0];
  return (
    <Panel title={person.name} kicker={`${person.race} · ${person.kind}`} onClose={() => setPanel(null)}>
      <p className="text-sm text-muted">{person.task}</p>
      <p className="mt-2 text-sm leading-relaxed text-fg">{crewLine(person, lots, true)}</p>
      {person.assignedTo && (
        <p className="mt-2 text-xs text-muted">
          Assigned: {lots.find((l) => l.id === person.assignedTo)?.title}
        </p>
      )}
      <label className="mt-3 block text-xs text-muted">
        Send to dock
        <select
          className="mt-1 h-10 w-full rounded-md border border-border bg-raised px-2 text-sm text-fg"
          value={person.assignedTo ?? ""}
          onChange={(e) => assignCrew(person.name, e.target.value || null)}
        >
          <option value="">Unassigned</option>
          {lots.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-3 flex flex-wrap gap-1">
        {crew.map((c) => (
          <button
            key={c.name}
            type="button"
            onClick={() => talkCrew(c.name)}
            className={cn(
              "h-8 rounded-md px-2 font-mono text-[10px]",
              c.name === person.name ? "bg-raised text-fg" : "text-muted",
            )}
          >
            {c.name}
          </button>
        ))}
      </div>
    </Panel>
  );
}

function Construction({ lots }: { lots: Lot[] }) {
  const setPanel = useNexus((s) => s.setPanel);
  const raiseLot = useNexus((s) => s.raiseLot);
  const forgeFile = useNexus((s) => s.forgeFile);
  const select = useNexus((s) => s.select);
  const [id, setId] = useState(lots[0]?.id ?? "");
  const lot = lots.find((l) => l.id === id);
  return (
    <Panel title="Blueprint table" kicker="construction" onClose={() => setPanel(null)}>
      <p className="mb-3 text-sm text-muted">
        Forges a real HTML file into the Archive, then raises scaffold → frame → pressure.
      </p>
      <select
        className="h-10 w-full rounded-md border border-border bg-raised px-2 text-sm text-fg"
        value={id}
        onChange={(e) => setId(e.target.value)}
      >
        {lots.map((l) => (
          <option key={l.id} value={l.id}>
            {l.title}
          </option>
        ))}
      </select>
      {lot && (
        <div className="mt-3 space-y-2 text-sm">
          <p className="text-muted">
            {stageLabel(stageOf(lot))} · {lot.truth}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const f = forgeFile(lot.id);
                if (f) {
                  const blob = new Blob([f.html], { type: "text/html" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = f.name;
                  a.click();
                  URL.revokeObjectURL(url);
                }
              }}
              className="h-10 flex-1 rounded-md bg-accent text-xs font-medium text-bg"
            >
              Forge file
            </button>
            <button
              type="button"
              onClick={() => {
                raiseLot(lot.id);
                select(lot.id);
              }}
              className="h-10 flex-1 rounded-md border border-border text-xs text-fg"
            >
              Raise
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}

function AssetFactory({ lot }: { lot?: Lot }) {
  const setPanel = useNexus((s) => s.setPanel);
  const ledger = useNexus((s) => s.ledger);
  const addLedger = useNexus((s) => s.addLedger);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const notion = lot?.links.find((l) => l.kind === "notion") ?? (lot?.open
    ? { label: "Tools Index — not the ledger", url: lot.open }
    : null);
  return (
    <Panel title="Asset Factory" kicker="ledger" onClose={() => setPanel(null)} wide>
      <h3 className="font-display text-lg text-fg">Ledger lost — rebuild here</h3>
      <p className="mt-1 text-sm text-muted">
        The 52-entry book did not survive. An empty ledger is honest. Fake rows are a lie.
      </p>
      {notion && (
        <a
          href={notion.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex h-10 items-center rounded-md border border-border px-3 text-xs text-fg"
        >
          {notion.label}
        </a>
      )}
      {ledger.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted">
          No rows. Add a real asset when you have one.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {ledger.map((r) => (
            <li key={r.id} className="rounded-md border border-border bg-raised px-3 py-2">
              <div className="text-sm text-fg">{r.title}</div>
              <div className="text-xs text-muted">{r.note}</div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Asset name"
          className="h-10 w-full rounded-md border border-border bg-raised px-3 text-sm text-fg"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="One-line truth"
          className="h-10 w-full rounded-md border border-border bg-raised px-3 text-sm text-fg"
        />
        <button
          type="button"
          onClick={() => {
            if (!title.trim()) return;
            addLedger(title.trim(), note.trim());
            setTitle("");
            setNote("");
          }}
          className="h-10 w-full rounded-md bg-accent text-xs font-medium text-bg"
        >
          Add row
        </button>
      </div>
    </Panel>
  );
}

function Archive({ lots }: { lots: Lot[] }) {
  const setPanel = useNexus((s) => s.setPanel);
  const files = lots.flatMap((l) => [
    ...l.files.filter((f) => f && f !== "Talked about").map((f) => ({ name: f, building: l.title, html: null as string | null })),
    ...l.archive.map((a) => ({ name: a.name, building: l.title, html: a.html })),
  ]);
  return (
    <Panel title="Archive vault" kicker="The Library" onClose={() => setPanel(null)} wide>
      <p className="mb-3 text-sm text-muted">
        city-charter.md lives here. Forged files land in this vault.
      </p>
      <ul className="space-y-1.5 font-mono text-xs">
        {files.map((f, i) => (
          <li key={f.name + f.building + i} className="flex items-center justify-between gap-2 border-b border-border py-1.5">
            <span className="text-fg">{f.name}</span>
            <span className="text-muted">{f.building}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
