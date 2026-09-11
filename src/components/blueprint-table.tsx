import { useMemo, useState } from "react";
import { Download, ExternalLink, PenTool, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DOMAIN_LOOK, downloadHtml, extractHtml, openHtmlBody, shellSystemHtml, slugFile, type BlueprintSpec } from "@/game/blueprint";
import { DOMAINS, RACES, htmlArtifact, isWorkKind, workTruth } from "@/game/catalog";
import { useDistrict } from "@/game/store";
import { forgeSystem } from "@/lib/forge-app";
import type { Domain, Duty, Race } from "@/game/types";
import { cn } from "@/lib/utils";

const RACE_DOT: Record<Race | "all", string> = {
  claude: "bg-claude",
  grok: "bg-grok",
  gemini: "bg-gemini",
  meta: "bg-meta",
  all: "bg-energy",
};

const STEPS = ["Name", "Job", "District", "Who", "Forge"] as const;

const GUIDE = [
  "Lot is empty. Name the system. That name goes on the building and the file.",
  "What does it actually do? One job. If it will not do that, we do not raise it.",
  "Which district? This sets the look of the building.",
  "Who can run it? All four systems, or lock it to one race.",
  "Anything I should build into the file? Then we forge a real HTML app and save it here.",
];

export function BlueprintTable({
  buildingId,
  onClose,
  onDone,
  onAssignCrew,
}: {
  buildingId: string;
  onClose: () => void;
  onDone: (id: string) => void;
  onAssignCrew?: (agentId: string, duty: Duty) => void;
}) {
  const building = useDistrict((s) => s.buildings.find((b) => b.id === buildingId));
  const commitBlueprint = useDistrict((s) => s.commitBlueprint);
  const agents = useDistrict((s) => s.agents);
  const existing = building ? htmlArtifact(building) : undefined;

  const [step, setStep] = useState(existing ? 5 : 0);
  const [title, setTitle] = useState(building && isWorkKind(building.kind) && !building.title.startsWith("New ") ? building.title : "");
  const [job, setJob] = useState(building?.blurb && !building.blurb.includes("stands as") && !building.blurb.includes("Infrastructure") ? building.blurb : "");
  const [domain, setDomain] = useState<Domain>(
    building?.domain && building.domain !== "civic" ? building.domain : building?.kind === "system" ? "system" : building?.kind === "design" ? "idea" : "tool",
  );
  const [who, setWho] = useState<"all" | Race>("all");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [source, setSource] = useState<"grok" | "shell" | null>(existing ? "shell" : null);
  const [savedName, setSavedName] = useState(existing?.name ?? "");
  const [savedBody, setSavedBody] = useState(existing?.body ?? "");

  const spec: BlueprintSpec = useMemo(
    () => ({
      title: title.trim(),
      job: job.trim(),
      domain,
      kind: building?.kind ?? "app",
      who,
      notes: notes.trim(),
    }),
    [title, job, domain, who, notes, building?.kind],
  );

  if (!building) return null;

  const usableBy: Race[] = who === "all" ? ["claude", "grok", "gemini", "meta"] : [who];
  const builder = agents.find((a) => a.race === "grok" && a.kind === "bot" && a.duty === "build") ?? agents.find((a) => a.name === "Pike" || a.name === "Build");
  const done = Boolean(savedBody);

  const forge = async () => {
    if (!spec.title || !spec.job || busy) return;
    setBusy(true);
    setErr(null);
    let html = "";
    let from: "grok" | "shell" = "shell";
    try {
      const res = await forgeSystem({ data: spec });
      if (res.ok) {
        const extracted = extractHtml(res.html);
        if (extracted) {
          html = extracted;
          from = "grok";
        }
      } else {
        setErr(res.error);
      }
    } catch {
      setErr("Forge did not answer.");
    }
    if (!html) html = shellSystemHtml(spec);
    const item = commitBlueprint(building.id, {
      title: spec.title,
      blurb: spec.job,
      domain: spec.domain,
      look: DOMAIN_LOOK[spec.domain],
      race: who === "all" ? "grok" : who,
      usableBy,
      fileName: slugFile(spec.title),
      body: html,
    });
    if (!item?.body) {
      setErr("Could not save the file.");
      setBusy(false);
      return;
    }
    setSavedName(item.name);
    setSavedBody(item.body);
    setSource(from);
    setBusy(false);
    setStep(5);
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="blueprint-grid mx-auto max-h-[82vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-11 items-center justify-center rounded-md bg-surface-2">
              <PenTool className="size-5 text-muted" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.18em] text-subtle">Blueprint table</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-fg">Raise a working system</h2>
              <p className="mt-0.5 text-sm text-muted">Build sits with you. We write a real HTML file, save it on this lot, and you can keep it.</p>
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

        <ol className="mt-4 flex gap-1">
          {STEPS.map((label, i) => (
            <li key={label} className="min-w-0 flex-1">
              <p className={cn("h-1 rounded-full", i <= step && step < 5 ? "bg-energy" : i < 5 && done ? "bg-energy" : "bg-surface-2")} />
              <p className={cn("mt-1 truncate text-xs", i === step && !done ? "text-fg" : "text-subtle")}>{label}</p>
            </li>
          ))}
        </ol>

        <div className="mt-4 rounded-md bg-bg/90 px-3 py-3">
          <p className="text-xs uppercase tracking-wider text-subtle">Build · Grok bot</p>
          <p className="mt-1 text-sm leading-relaxed text-fg">{done ? "File is on the lot and in the Library. Open it. Download it. It is not hosted until you put it on GitHub or Drive." : GUIDE[Math.min(step, 4)]}</p>
        </div>

        {(title || job || step > 0) && !done ? (
          <dl className="mt-3 space-y-1 rounded-md bg-bg/80 px-3 py-3 text-sm">
            {title ? (
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-subtle">Name</dt>
                <dd className="min-w-0 text-fg">{title}</dd>
              </div>
            ) : null}
            {job ? (
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-subtle">Job</dt>
                <dd className="min-w-0 text-fg">{job}</dd>
              </div>
            ) : null}
            {step >= 2 ? (
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-subtle">District</dt>
                <dd className="text-fg">{DOMAINS[domain].name}</dd>
              </div>
            ) : null}
            {step >= 3 ? (
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-subtle">Who</dt>
                <dd className="text-fg">{who === "all" ? "All four" : RACES[who].name}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {done ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-md bg-bg px-3 py-3">
              <p className="text-sm font-medium text-fg">{savedName}</p>
              <p className="mt-1 text-xs text-muted">
                {source === "grok" ? "Forged with Grok from your spec." : "Working shell from your spec. Grok did not return a file — this one still runs."}
              </p>
              <p className="mt-1 text-xs text-subtle">{workTruth(building).label}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => openHtmlBody(savedBody)}>
                <ExternalLink className="size-4" />
                Open
              </Button>
              <Button variant="secondary" onClick={() => downloadHtml(savedName, savedBody)}>
                <Download className="size-4" />
                Download
              </Button>
            </div>
            {builder && onAssignCrew ? (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  onAssignCrew(builder.id, "build");
                  onDone(building.id);
                }}
              >
                Send {builder.name} to finish the lot
              </Button>
            ) : null}
            <Button className="w-full" variant="secondary" onClick={() => onDone(building.id)}>
              Sit at the lot
            </Button>
            <button type="button" className="w-full py-2 text-xs text-subtle" onClick={() => setStep(0)}>
              Revise the spec
            </button>
          </div>
        ) : (
          <div className="mt-4">
            {step === 0 ? (
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Name"
                className="h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && title.trim()) setStep(1);
                }}
              />
            ) : null}
            {step === 1 ? (
              <textarea
                autoFocus
                value={job}
                onChange={(e) => setJob(e.target.value)}
                placeholder="One job it actually does"
                rows={3}
                className="w-full resize-y rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              />
            ) : null}
            {step === 2 ? (
              <div className="flex flex-wrap gap-2">
                {(Object.keys(DOMAINS) as Domain[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDomain(d)}
                    className={cn(
                      "h-10 rounded-md px-3 text-sm",
                      domain === d ? "bg-accent text-accent-fg" : "bg-bg text-muted",
                    )}
                  >
                    {DOMAINS[d].name}
                  </button>
                ))}
              </div>
            ) : null}
            {step === 3 ? (
              <div className="flex flex-wrap gap-2">
                {(["all", "claude", "grok", "gemini", "meta"] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWho(w)}
                    className={cn(
                      "inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm",
                      who === w ? "bg-accent text-accent-fg" : "bg-bg text-muted",
                    )}
                  >
                    <span className={cn("size-2 rounded-full", RACE_DOT[w])} />
                    {w === "all" ? "All four" : RACES[w].name}
                  </button>
                ))}
              </div>
            ) : null}
            {step === 4 ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional — screens, fields, rules"
                rows={3}
                className="w-full resize-y rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              />
            ) : null}

            {err ? <p className="mt-2 text-xs text-muted">{err}. Saving a working shell from your spec.</p> : null}

            <div className="mt-3 flex gap-2">
              {step > 0 ? (
                <Button variant="secondary" onClick={() => setStep((s) => s - 1)} disabled={busy}>
                  Back
                </Button>
              ) : null}
              {step < 4 ? (
                <Button
                  className="flex-1"
                  disabled={step === 0 ? !title.trim() : step === 1 ? !job.trim() : false}
                  onClick={() => setStep((s) => s + 1)}
                >
                  Continue
                </Button>
              ) : (
                <Button className="flex-1" disabled={busy || !title.trim() || !job.trim()} onClick={() => void forge()}>
                  {busy ? "Forging file…" : "Forge and save"}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
