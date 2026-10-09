// Shared helpers for NEXUS workers (GitHub REST + job protocol).
// A job is an issue in the jobs repo labelled `nexus-job`. Its body carries a
// hidden marker with the target repo; its state lives in one `nx:*` label.
import { appendFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

export const MAP = JSON.parse(
  readFileSync(new URL("../src/data/repos.json", import.meta.url), "utf8"),
);
export const OWNER = MAP.owner;
export const JOBS_REPO = MAP.jobsRepo;
export const KNOWN_REPOS = [...new Set(Object.values(MAP.repos))];

export const STATES = ["proposed", "queued", "working", "needs-you", "review", "done", "failed"];
const STATE_COLORS = {
  proposed: "c5def5",
  queued: "ededed",
  working: "fbca04",
  "needs-you": "d93f0b",
  review: "0e8a16",
  done: "5319e7",
  failed: "b60205",
};

const JOB_RE = /<!--\s*nexus:job\s+(\{.*?\})\s*-->/s;
const PR_RE = /<!--\s*nexus:pr\s+(\{.*?\})\s*-->/s;

export function parseJob(body) {
  const m = JOB_RE.exec(body || "");
  if (!m) return null;
  try {
    const job = JSON.parse(m[1]);
    if (!KNOWN_REPOS.includes(job.repo)) return null;
    return job;
  } catch {
    return null;
  }
}

export function stripMarkers(body) {
  return (body || "").replace(JOB_RE, "").replace(PR_RE, "").trim();
}

export function lastPrMarker(comments) {
  for (let i = comments.length - 1; i >= 0; i--) {
    const m = PR_RE.exec(comments[i].body || "");
    if (m) {
      try {
        return JSON.parse(m[1]);
      } catch {
        /* keep looking */
      }
    }
  }
  return null;
}

export function prMarker(pr) {
  return `<!-- nexus:pr ${JSON.stringify(pr)} -->`;
}

export function stateOf(issue) {
  for (const l of issue.labels || []) {
    const name = typeof l === "string" ? l : l.name;
    if (name?.startsWith("nx:")) return name.slice(3);
  }
  return null;
}

/**
 * Deterministic merge policy — never left to the model.
 * Small, additive changes land on their own; anything that deletes files,
 * is large, or asks a question waits for Joshua.
 */
export function judgeChange({ files, deleted, lines, question }) {
  const reasons = [];
  if (deleted.length) reasons.push(`deletes ${deleted.length} file${deleted.length === 1 ? "" : "s"}`);
  if (files > 10) reasons.push(`touches ${files} files`);
  if (lines > 300) reasons.push(`changes ${lines} lines`);
  if (question) reasons.push("has a question for you");
  return { auto: reasons.length === 0, reasons };
}

export function gh(token) {
  async function call(method, path, body) {
    const res = await fetch(`${process.env.GITHUB_API_URL || "https://api.github.com"}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "nexus-worker",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const err = new Error(`${method} ${path} → ${res.status}: ${data?.message ?? text}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }
  return {
    get: (p) => call("GET", p),
    post: (p, b) => call("POST", p, b),
    put: (p, b) => call("PUT", p, b),
    patch: (p, b) => call("PATCH", p, b),
    del: (p) => call("DELETE", p),
  };
}

export function jobsApi(token) {
  const api = gh(token);
  const base = `/repos/${OWNER}/${JOBS_REPO}`;
  return {
    api,
    issue: (n) => api.get(`${base}/issues/${n}`),
    async comments(n) {
      const all = [];
      for (let page = 1; page < 10; page++) {
        const batch = await api.get(`${base}/issues/${n}/comments?per_page=100&page=${page}`);
        all.push(...batch);
        if (batch.length < 100) break;
      }
      return all;
    },
    comment: (n, body) => api.post(`${base}/issues/${n}/comments`, { body }),
    close: (n, reason = "completed") =>
      api.patch(`${base}/issues/${n}`, { state: "closed", state_reason: reason }),
    reopen: (n) => api.patch(`${base}/issues/${n}`, { state: "open" }),
    async ensureLabels() {
      const want = [["nexus-job", "b07a4a"], ...STATES.map((s) => [`nx:${s}`, STATE_COLORS[s]])];
      for (const [name, color] of want) {
        try {
          await api.post(`${base}/labels`, { name, color });
        } catch (e) {
          if (e.status !== 422) throw e; // 422 = already exists
        }
      }
    },
    async setState(n, state) {
      const issue = await api.get(`${base}/issues/${n}`);
      const keep = (issue.labels || [])
        .map((l) => l.name)
        .filter((name) => !name.startsWith("nx:"));
      await api.put(`${base}/issues/${n}/labels`, {
        labels: [...new Set([...keep, "nexus-job", `nx:${state}`])],
      });
    },
  };
}

export function output(key, value) {
  const file = process.env.GITHUB_OUTPUT;
  const line = `${key}=${String(value).replace(/\n/g, " ")}\n`;
  if (file) appendFileSync(file, line);
  else process.stdout.write(line);
}

export function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function workerLine(worker, status, text) {
  return `**${worker}** · ${status}\n\n${text}`.trim();
}
