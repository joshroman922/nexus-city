#!/usr/bin/env node
// Patrol: crew walk the repos and come back with proposals — things to
// finish, fix, clean up or delete, or files to reorganize. Each proposal
// becomes a `nx:proposed` job; nothing runs until Joshua says go.
//   prompt  — write the patrol prompt for the repos cloned under PATROL_DIR.
//   file    — turn PATROL_DIR/patrol.json into proposed jobs (deduped).
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { JOBS_REPO, KNOWN_REPOS, MAP, OWNER, jobsApi } from "./lib.mjs";

const CREW = ["Ada", "Lin", "Keeper", "Oracle", "Pike", "Ash"];
const KINDS = ["finish", "fix", "organize", "cleanup"];
const MAX = 12;
const dir = process.env.PATROL_DIR || "patrol";

function lotFor(repo) {
  return Object.entries(MAP.repos).find(([, r]) => r === repo)?.[0] ?? repo;
}

function prompt() {
  const repos = readdirSync(dir).filter((d) => KNOWN_REPOS.includes(d));
  writeFileSync(
    join(dir, "prompt.md"),
    `You are the patrol crew of NEXUS Station. Each folder here is one of Joshua's GitHub repos: ${repos.join(", ")}.
Look through them (read-only — do not edit anything) and find the most useful concrete jobs a worker could do next:
- finish: something half-built that is close to working
- fix: a real bug, broken link, or failing build you can point to
- organize: files that belong in a folder, a missing README, confusing layout
- cleanup: junk or leftover files that should probably be deleted (name them)

Only propose things you can point to in the files. At most 2 per repo and ${MAX} total; skip repos with nothing worth doing.
Write patrol.json in the current directory as a JSON array, exactly:
[{"repo": "<folder name>", "kind": "finish|fix|organize|cleanup", "title": "short imperative title", "why": "one or two sentences naming the files involved"}]`,
  );
}

async function file() {
  const path = join(dir, "patrol.json");
  if (!existsSync(path)) {
    console.log("no patrol.json — nothing proposed");
    return;
  }
  let items;
  try {
    items = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`patrol.json is not valid JSON: ${e.message}`);
  }
  const jobs = jobsApi(process.env.JOBS_TOKEN);
  await jobs.ensureLabels();
  const open = await jobs.api.get(
    `/repos/${OWNER}/${JOBS_REPO}/issues?labels=nexus-job&state=open&per_page=100`,
  );
  const seen = new Set(open.map((i) => i.title.toLowerCase()));
  let made = 0;
  for (const [i, it] of (Array.isArray(items) ? items : []).entries()) {
    if (made >= MAX) break;
    if (!KNOWN_REPOS.includes(it.repo) || !it.title) continue;
    const kind = KINDS.includes(it.kind) ? it.kind : "fix";
    const title = `[${it.repo}] ${String(it.title).slice(0, 100)}`;
    if (seen.has(title.toLowerCase())) continue;
    const marker = { lot: lotFor(it.repo), repo: it.repo, kind, worker: CREW[i % CREW.length], proposed: true };
    await jobs.api.post(`/repos/${OWNER}/${JOBS_REPO}/issues`, {
      title,
      body: `${it.why || ""}\n\nProposed by patrol. Say go in the city (or comment \`/go\`) to send ${marker.worker}; \`/reject\` to drop it.\n<!-- nexus:job ${JSON.stringify(marker)} -->`,
      labels: ["nexus-job", "nx:proposed"],
    });
    seen.add(title.toLowerCase());
    made++;
  }
  console.log(`proposed ${made} job(s)`);
}

const run = { prompt, file }[process.argv[2]];
if (!run) {
  console.error("usage: patrol.mjs prompt|file");
  process.exit(2);
}
Promise.resolve(run()).catch((e) => {
  console.error(e);
  process.exit(1);
});
