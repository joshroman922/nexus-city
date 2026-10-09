import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, KeyRound, Loader2, Send, X } from "lucide-react";
import {
  ACTIVE,
  KIND_LABEL,
  OWNER,
  STATE_LABEL,
  WAITING,
  repoForLot,
  useJobs,
  type Job,
  type JobKind,
  type JobState,
} from "@/lib/jobs";
import { useNexus } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Lot } from "@/lib/types";
import { Panel } from "./panel";

const STATE_TONE: Record<JobState, string> = {
  proposed: "bg-ask/15 text-ask",
  queued: "bg-raised text-muted",
  working: "bg-energy/20 text-fg",
  "needs-you": "bg-ask/15 text-ask",
  review: "bg-ask/15 text-ask",
  done: "bg-live/15 text-live",
  failed: "bg-dead/15 text-dead",
};

export function StatePill({ state }: { state: JobState }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider", STATE_TONE[state])}>
      {state === "working" && <Loader2 className="size-3 animate-spin" />}
      {STATE_LABEL[state]}
    </span>
  );
}

const btn = "inline-flex h-10 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium disabled:opacity-50";
const btnMain = cn(btn, "bg-accent text-bg");
const btnLine = cn(btn, "border border-border text-fg hover:border-accent");

export function TokenSetup() {
  const setToken = useJobs((s) => s.setToken);
  const [val, setVal] = useState("");
  return (
    <div className="space-y-2 rounded-md border border-border bg-raised p-3 text-xs text-muted">
      <div className="flex items-center gap-1.5 text-fg">
        <KeyRound className="size-3.5" /> Connect the crew
      </div>
      <p>
        Paste a GitHub fine-grained token with <b className="text-fg">Issues: read &amp; write</b> on{" "}
        <span className="font-mono">{OWNER}/nexus-city</span> only. It stays on this phone.
      </p>
      <a
        className="inline-flex items-center gap-1 text-accent underline"
        href="https://github.com/settings/personal-access-tokens/new"
        target="_blank"
        rel="noreferrer"
      >
        Make a token <ExternalLink className="size-3" />
      </a>
      <div className="flex gap-2">
        <input
          type="password"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="github_pat_…"
          className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 font-mono text-fg"
        />
        <button type="button" className={btnMain} disabled={!val.trim()} onClick={() => setToken(val)}>
          Save
        </button>
      </div>
    </div>
  );
}

/** Inside a module: send a real worker to that repo. */
export function SendWorker({ lot }: { lot: Lot }) {
  const repo = repoForLot(lot.id);
  const token = useJobs((s) => s.token);
  const jobs = useJobs((s) => s.jobs);
  const busy = useJobs((s) => s.busy);
  const send = useJobs((s) => s.send);
  const setPanel = useNexus((s) => s.setPanel);
  const setFocus = useJobs((s) => s.setFocus);
  const [kind, setKind] = useState<JobKind>("fix");
  const [text, setText] = useState("");
  const [sent, setSent] = useState<number | null>(null);
  if (!repo) {
    return <p className="text-xs text-muted">No repo on GitHub yet — workers can't reach this module.</p>;
  }
  const here = jobs.filter((j) => j.lot === lot.id && (ACTIVE.includes(j.state) || j.state === "proposed"));
  const hints: Record<JobKind, string> = {
    fix: "What's broken?",
    finish: "What should be finished?",
    organize: "How should files be organized?",
    cleanup: "What looks like junk? (deletions wait for your OK)",
    other: "Tell the worker what you want",
  };
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        Send a worker · <span className="normal-case tracking-normal">{repo}</span>
      </div>
      {here.map((j) => (
        <button
          key={j.n}
          type="button"
          onClick={() => {
            setFocus(j.n);
            setPanel("work");
          }}
          className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-raised px-3 py-2 text-left text-xs"
        >
          <span className="min-w-0 truncate text-fg">
            {j.worker}: {j.title}
          </span>
          <StatePill state={j.state} />
        </button>
      ))}
      {!token ? (
        <TokenSetup />
      ) : (
        <>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(KIND_LABEL) as JobKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  "h-8 rounded-full border px-3 text-[11px]",
                  kind === k ? "border-accent bg-accent text-bg" : "border-border text-muted",
                )}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder={hints[kind]}
            className="w-full rounded-md border border-border bg-raised p-2 text-sm text-fg placeholder:text-subtle"
          />
          <button
            type="button"
            className={cn(btnMain, "w-full")}
            disabled={busy || !text.trim()}
            onClick={async () => {
              const job = await send(lot.id, kind, text);
              if (job) {
                setText("");
                setSent(job.n);
              }
            }}
          >
            <Send className="size-3.5" /> Send worker
          </button>
          {sent && <p className="text-[11px] text-live">Job #{sent} filed — the worker is on the way.</p>}
        </>
      )}
    </div>
  );
}

function JobRow({ job, onOpen }: { job: Job; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start justify-between gap-3 rounded-md border border-border bg-raised px-3 py-2 text-left"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm text-fg">{job.title}</span>
        <span className="block font-mono text-[10px] text-muted">
          {job.worker} · {job.repo} · {KIND_LABEL[job.kind]}
        </span>
      </span>
      <StatePill state={job.state} />
    </button>
  );
}

function Thread({ job, onBack }: { job: Job; onBack: () => void }) {
  const lines = useJobs((s) => s.lines[job.n]);
  const loadThread = useJobs((s) => s.loadThread);
  const say = useJobs((s) => s.say);
  const dismiss = useJobs((s) => s.dismiss);
  const busy = useJobs((s) => s.busy);
  const select = useNexus((s) => s.select);
  const setPanel = useNexus((s) => s.setPanel);
  const [reply, setReply] = useState("");

  // Re-read the thread whenever the job changes state upstream.
  useEffect(() => {
    void loadThread(job.n);
  }, [job.n, job.updatedAt, loadThread]);

  const answer = async (text: string) => {
    await say(job.n, text);
    setReply("");
  };

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="text-xs text-muted hover:text-fg">
          ‹ All jobs
        </button>
        <StatePill state={job.state} />
      </div>
      <div>
        <div className="text-fg">{job.title}</div>
        <div className="font-mono text-[10px] text-muted">
          #{job.n} · {job.worker} · {job.repo} ·{" "}
          <button
            type="button"
            className="underline"
            onClick={() => {
              setPanel(null);
              select(job.lot);
            }}
          >
            go to module
          </button>{" "}
          ·{" "}
          <a className="underline" href={job.url} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
      </div>
      {job.text && <p className="whitespace-pre-wrap rounded-md bg-raised px-3 py-2 text-xs text-muted">{job.text}</p>}
      <ol className="space-y-2">
        {(lines ?? []).map((l) => (
          <li
            key={l.id}
            className={cn("rounded-md px-3 py-2 text-xs", l.mine ? "ml-6 bg-accent/15 text-fg" : "mr-2 border border-border text-fg")}
          >
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted">
              {l.who}
              {l.status && ` · ${l.status}`}
            </div>
            <div className="whitespace-pre-wrap break-words">{linkify(l.text)}</div>
          </li>
        ))}
        {job.state === "working" && (
          <li className="flex items-center gap-2 text-xs text-muted">
            <Loader2 className="size-3 animate-spin" /> {job.worker} is working in {job.repo}…
          </li>
        )}
      </ol>

      {job.state === "proposed" && (
        <div className="flex gap-2">
          <button type="button" className={cn(btnMain, "flex-1")} disabled={busy} onClick={() => answer("/go")}>
            <Check className="size-3.5" /> Yes, do it
          </button>
          <button type="button" className={cn(btnLine, "flex-1")} disabled={busy} onClick={() => dismiss(job.n)}>
            <X className="size-3.5" /> No
          </button>
        </div>
      )}
      {job.state === "review" && (
        <div className="flex gap-2">
          <button type="button" className={cn(btnMain, "flex-1")} disabled={busy} onClick={() => answer("/approve")}>
            <Check className="size-3.5" /> Approve
          </button>
          <button type="button" className={cn(btnLine, "flex-1")} disabled={busy} onClick={() => answer("/reject")}>
            <X className="size-3.5" /> Reject
          </button>
        </div>
      )}
      {job.state === "failed" && (
        <button type="button" className={cn(btnLine, "w-full")} disabled={busy} onClick={() => answer("Try again.")}>
          Retry
        </button>
      )}
      <div className="flex gap-2">
        <input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && reply.trim() && answer(reply.trim())}
          placeholder={job.state === "needs-you" ? "Answer the question…" : `Tell ${job.worker} something…`}
          className="h-10 min-w-0 flex-1 rounded-md border border-border bg-raised px-2 text-sm text-fg placeholder:text-subtle"
        />
        <button type="button" className={btnMain} disabled={busy || !reply.trim()} onClick={() => answer(reply.trim())}>
          <Send className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function linkify(text: string) {
  return text.split(/(https?:\/\/\S+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noreferrer" className="text-accent underline">
        {part.replace(/^https:\/\/github\.com\//, "")}
      </a>
    ) : (
      part
    ),
  );
}

export function WorkPanel() {
  const jobs = useJobs((s) => s.jobs);
  const token = useJobs((s) => s.token);
  const error = useJobs((s) => s.error);
  const loaded = useJobs((s) => s.loaded);
  const lastSync = useJobs((s) => s.lastSync);
  const setToken = useJobs((s) => s.setToken);
  const setPanel = useNexus((s) => s.setPanel);
  const openN = useJobs((s) => s.focus);
  const setOpenN = useJobs((s) => s.setFocus);

  const groups = useMemo(
    () => [
      { title: "Waiting on you", list: jobs.filter((j) => WAITING.includes(j.state)) },
      { title: "Working", list: jobs.filter((j) => j.state === "queued" || j.state === "working") },
      { title: "Recent", list: jobs.filter((j) => j.state === "done" || j.state === "failed").slice(0, 12) },
    ],
    [jobs],
  );
  const open = jobs.find((j) => j.n === openN);

  return (
    <Panel title="Work" kicker="live crew jobs" wide onClose={() => setPanel(null)}>
      <div className="space-y-4">
        {error && <p className="rounded-md bg-dead/15 px-3 py-2 text-xs text-dead">{error}</p>}
        {!token && <TokenSetup />}
        {open ? (
          <Thread job={open} onBack={() => setOpenN(null)} />
        ) : (
          <>
            {!loaded && <p className="text-xs text-muted">Reading the job board…</p>}
            {loaded && jobs.length === 0 && (
              <p className="text-xs text-muted">
                No jobs yet. Walk up to a module and tap <b className="text-fg">Send worker</b>. The patrol also
                files suggestions here every morning.
              </p>
            )}
            {groups.map(
              (g) =>
                g.list.length > 0 && (
                  <section key={g.title} className="space-y-2">
                    <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                      {g.title} · {g.list.length}
                    </h3>
                    {g.list.map((j) => (
                      <JobRow key={j.n} job={j} onOpen={() => setOpenN(j.n)} />
                    ))}
                  </section>
                ),
            )}
            <div className="flex items-center justify-between font-mono text-[10px] text-subtle">
              <span>{lastSync ? `synced ${new Date(lastSync).toLocaleTimeString()}` : ""}</span>
              {token && (
                <button type="button" className="underline" onClick={() => setToken("")}>
                  forget token
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
