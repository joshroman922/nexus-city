// Live worker jobs. A job is a GitHub issue in the jobs repo (see worker/);
// the city files jobs, reads their state, and answers / approves from here.
import { create } from "zustand";
import REPOS from "@/data/repos.json";
import { SEED_CREW } from "./census";

export type JobState = "proposed" | "queued" | "working" | "needs-you" | "review" | "done" | "failed";
export type JobKind = "fix" | "finish" | "organize" | "cleanup" | "other";

export type Job = {
  n: number;
  title: string;
  text: string;
  lot: string;
  repo: string;
  kind: JobKind;
  worker: string;
  state: JobState;
  open: boolean;
  updatedAt: string;
  url: string;
};

export type JobLine = { id: number; who: string; status: string; text: string; at: string; mine: boolean };

export const OWNER: string = REPOS.owner;
const JOBS = `${REPOS.owner}/${REPOS.jobsRepo}`;
const LOT_REPO: Record<string, string> = REPOS.repos;
const TOKEN_KEY = "nexus:gh-token";

/** Jobs that are still on someone's plate — the worker walks to its module. */
export const ACTIVE: JobState[] = ["queued", "working", "needs-you", "review"];
/** Jobs that wait on Joshua. */
export const WAITING: JobState[] = ["proposed", "needs-you", "review"];

export const KIND_LABEL: Record<JobKind, string> = {
  fix: "Fix",
  finish: "Finish",
  organize: "Organize",
  cleanup: "Clean up",
  other: "Other",
};

export const STATE_LABEL: Record<JobState, string> = {
  proposed: "asking you",
  queued: "on the way",
  working: "working",
  "needs-you": "question",
  review: "needs OK",
  done: "done",
  failed: "failed",
};

export function repoForLot(lotId: string): string | null {
  return LOT_REPO[lotId] ?? null;
}

function readToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

async function call<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    cache: "no-store",
    headers: {
      accept: "application/vnd.github+json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const msg = await res.json().then((d) => d?.message, () => "");
    throw new Error(res.status === 401 ? "GitHub token rejected — set it again." : `GitHub ${res.status}${msg ? `: ${msg}` : ""}`);
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

type Issue = {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  labels: { name: string }[];
  updated_at: string;
  html_url: string;
  pull_request?: unknown;
};
type Comment = { id: number; body: string; created_at: string; user: { login: string; type: string } };

const JOB_RE = /<!--\s*nexus:job\s+(\{.*?\})\s*-->/s;
const MARK_RE = /<!--\s*nexus:\w+\s+\{.*?\}\s*-->/gs;

function toJob(i: Issue): Job | null {
  const m = JOB_RE.exec(i.body ?? "");
  if (!m || i.pull_request) return null;
  let meta: { lot?: string; repo?: string; kind?: JobKind; worker?: string };
  try {
    meta = JSON.parse(m[1]);
  } catch {
    return null;
  }
  const label = i.labels.find((l) => l.name.startsWith("nx:"))?.name.slice(3) as JobState | undefined;
  return {
    n: i.number,
    title: i.title.replace(/^\[[^\]]+\]\s*/, ""),
    text: (i.body ?? "").replace(MARK_RE, "").trim(),
    lot: meta.lot ?? "",
    repo: meta.repo ?? "",
    kind: meta.kind ?? "other",
    worker: meta.worker ?? "Crew",
    state: label ?? (i.state === "closed" ? "done" : "queued"),
    open: i.state === "open",
    updatedAt: i.updated_at,
    url: i.html_url,
  };
}

function toLine(c: Comment, worker: string): JobLine {
  const bot = c.user.type === "Bot" || c.user.login.endsWith("[bot]");
  const body = c.body.replace(MARK_RE, "").trim();
  const head = /^\*\*(.+?)\*\* · (.+?)\n/.exec(body);
  return {
    id: c.id,
    who: bot ? (head?.[1] ?? worker) : "You",
    status: bot ? (head?.[2] ?? "") : "",
    text: (head ? body.slice(head[0].length).trim() : body).replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1"),
    at: c.created_at,
    mine: !bot,
  };
}

/** Least-busy Claude crew member gets the job. */
export function pickWorker(jobs: Job[]): string {
  const claude = SEED_CREW.filter((c) => c.race === "claude").map((c) => c.name);
  const load = (name: string) => jobs.filter((j) => j.worker === name && ACTIVE.includes(j.state)).length;
  return [...claude].sort((a, b) => load(a) - load(b))[0] ?? "Ada";
}

type JobsStore = {
  token: string;
  jobs: Job[];
  lines: Record<number, JobLine[]>;
  loaded: boolean;
  busy: boolean;
  error: string | null;
  lastSync: number;
  /** Job thread open in the Work panel. */
  focus: number | null;
  setFocus: (n: number | null) => void;
  setToken: (t: string) => void;
  refresh: () => Promise<void>;
  loadThread: (n: number) => Promise<void>;
  send: (lotId: string, kind: JobKind, text: string) => Promise<Job | null>;
  say: (n: number, text: string) => Promise<void>;
  /** Patrol proposals stay quiet until Joshua says go. */
  dismiss: (n: number) => Promise<void>;
};

export const useJobs = create<JobsStore>()((set, get) => {
  async function act<T>(fn: () => Promise<T>): Promise<T | null> {
    set({ busy: true, error: null });
    try {
      return await fn();
    } catch (e) {
      set({ error: (e as Error).message });
      return null;
    } finally {
      set({ busy: false });
    }
  }
  return {
    token: readToken(),
    jobs: [],
    lines: {},
    loaded: false,
    busy: false,
    error: null,
    lastSync: 0,
    focus: null,
    setFocus: (n) => set({ focus: n }),
    setToken: (t) => {
      const token = t.trim();
      try {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
      } catch {
        /* private mode — token lives for this visit only */
      }
      set({ token, error: null });
      void get().refresh();
    },
    refresh: async () => {
      try {
        const issues = await call<Issue[]>(
          get().token,
          "GET",
          `/repos/${JOBS}/issues?labels=nexus-job&state=all&sort=updated&per_page=60`,
        );
        set({
          jobs: issues.map(toJob).filter((j): j is Job => !!j),
          loaded: true,
          lastSync: Date.now(),
          error: null,
        });
      } catch (e) {
        set({ error: (e as Error).message, loaded: true });
      }
    },
    loadThread: async (n) => {
      try {
        const job = get().jobs.find((j) => j.n === n);
        const comments = await call<Comment[]>(get().token, "GET", `/repos/${JOBS}/issues/${n}/comments?per_page=100`);
        set({ lines: { ...get().lines, [n]: comments.map((c) => toLine(c, job?.worker ?? "Crew")) } });
      } catch (e) {
        set({ error: (e as Error).message });
      }
    },
    send: async (lotId, kind, text) => {
      const repo = repoForLot(lotId);
      if (!repo) return null;
      const worker = pickWorker(get().jobs);
      const first = text.trim().split("\n")[0].slice(0, 80) || KIND_LABEL[kind];
      const marker = { lot: lotId, repo, kind, worker };
      const issue = await act(() =>
        call<Issue>(get().token, "POST", `/repos/${JOBS}/issues`, {
          title: `[${repo}] ${first}`,
          body: `${text.trim()}\n\n<!-- nexus:job ${JSON.stringify(marker)} -->`,
          labels: ["nexus-job", "nx:queued"],
        }),
      );
      if (!issue) return null;
      const job = toJob(issue);
      if (job) set({ jobs: [{ ...job, state: "queued" }, ...get().jobs] });
      return job;
    },
    say: async (n, text) => {
      const ok = await act(() => call<Comment>(get().token, "POST", `/repos/${JOBS}/issues/${n}/comments`, { body: text }));
      if (!ok) return;
      // The worker picks it up within seconds; show it moving right away.
      const next: JobState | null = /^\/(approve|reject)\b/.test(text) ? null : "queued";
      if (next) set({ jobs: get().jobs.map((j) => (j.n === n ? { ...j, state: next, open: true } : j)) });
      await Promise.all([get().loadThread(n), get().refresh()]);
    },
    dismiss: async (n) => {
      await get().say(n, "/reject");
    },
  };
});

/** Poll while the page is visible: fast with a token, gentle without. */
export function startJobSync(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    if (document.visibilityState === "visible") await useJobs.getState().refresh();
    const busy = useJobs.getState().jobs.some((j) => j.state === "working" || j.state === "queued");
    const ms = useJobs.getState().token ? (busy ? 8000 : 20000) : 90000;
    timer = setTimeout(tick, ms);
  };
  const onVis = () => {
    if (document.visibilityState === "visible") {
      clearTimeout(timer);
      void tick();
    }
  };
  document.addEventListener("visibilitychange", onVis);
  void tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVis);
  };
}
