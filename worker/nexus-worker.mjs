#!/usr/bin/env node
// NEXUS worker steps, called from .github/workflows/worker.yml.
//   route  — decide what an issue/comment event means; handle /approve /reject.
//   finish — after Claude edits the target checkout: policy, push, PR, merge.
//   fail   — mark the job failed.
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  OWNER,
  git,
  gh,
  jobsApi,
  judgeChange,
  lastPrMarker,
  output,
  parseJob,
  prMarker,
  stateOf,
  stripMarkers,
  workerLine,
} from "./lib.mjs";

const mode = process.argv[2];
const env = process.env;
const jobs = jobsApi(env.JOBS_TOKEN);
const pat = env.NEXUS_PAT ? gh(env.NEXUS_PAT) : null;
const temp = env.RUNNER_TEMP || "/tmp";

function isBot(user) {
  return !user || user.type === "Bot" || user.login.endsWith("[bot]");
}

async function defaultBranch(repo) {
  return (await pat.get(`/repos/${OWNER}/${repo}`)).default_branch;
}

async function prOpen(pr) {
  if (!pr) return false;
  const p = await pat.get(`/repos/${OWNER}/${pr.repo}/pulls/${pr.number}`);
  return p.state === "open";
}

async function merge(pr) {
  await pat.put(`/repos/${OWNER}/${pr.repo}/pulls/${pr.number}/merge`, { merge_method: "squash" });
  try {
    await pat.del(`/repos/${OWNER}/${pr.repo}/git/refs/heads/${pr.branch}`);
  } catch {
    /* branch already gone */
  }
}

function buildPrompt(job, issue, comments) {
  // Only Joshua and the crew are part of the conversation; the repo is
  // public, so anyone else's comment could be a prompt injection.
  const thread = comments
    .filter((c) => isBot(c.user) || c.user.login === OWNER)
    .map((c) => [c, stripMarkers(c.body)])
    .filter(([, text]) => text)
    .map(([c, text]) => `- ${isBot(c.user) ? job.worker : "Joshua"}: ${text}`)
    .join("\n");
  return `You are ${job.worker}, a crew worker on NEXUS Station. Joshua sent you a job from inside the city.
You are working in a checkout of the GitHub repository ${OWNER}/${job.repo} (the current directory).

Job kind: ${job.kind}
Job: ${issue.title.replace(/^\[[^\]]+\]\s*/, "")}
${stripMarkers(issue.body)}
${thread ? `\nConversation so far (oldest first):\n${thread}\n` : ""}
Rules:
- Do the job by editing files in this directory. Stay focused on what was asked.
- Do not commit, push, or switch branches — the station handles git after you finish.
- Never modify anything under .github/.
- You may delete or move files when the job calls for it (cleanup, organizing). Joshua approves every deletion before it lands, so propose it rather than asking first.
- If the job is ambiguous enough that a guess could damage his work, make no edits and ask one clear question instead.
- If the project has tests or a build, run them to check your work.
- When done, write .nexus-result.json in the repository root, exactly:
  {"summary": "what you did, 1-3 plain sentences", "title": "short PR title", "question": null}
  Put a single question string in "question" only if you need Joshua's answer to continue.`;
}

async function route() {
  const ev = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
  const name = env.GITHUB_EVENT_NAME;
  const skip = (why) => {
    console.log(`skip: ${why}`);
    output("action", "skip");
  };
  if (ev.sender?.login !== OWNER) return skip(`sender ${ev.sender?.login} is not ${OWNER}`);
  const issue = ev.issue;
  if (!issue || issue.pull_request) return skip("not an issue");
  const job = parseJob(issue.body);
  if (!job) return skip("no nexus:job marker");
  const n = issue.number;
  const state = stateOf(issue);
  await jobs.ensureLabels();

  if (name === "issues") {
    if (state === "proposed") return skip("proposal waits for /go");
  } else if (name === "issue_comment") {
    if (isBot(ev.comment.user)) return skip("bot comment");
    const cmd = ev.comment.body.trim().split(/\s+/)[0].toLowerCase();
    const comments = await jobs.comments(n);
    const pr = lastPrMarker(comments);
    if (cmd === "/approve") {
      if (!pr || !(await prOpen(pr))) {
        await jobs.comment(n, workerLine(job.worker, "nothing to approve", "There's no open change waiting on this job."));
        return skip("no open PR");
      }
      await merge(pr);
      await jobs.comment(n, workerLine(job.worker, "landed", `Merged into ${job.repo}: ${pr.url}`));
      await jobs.setState(n, "done");
      await jobs.close(n);
      return skip("approved and merged");
    }
    if (cmd === "/reject") {
      if (pr && (await prOpen(pr))) {
        await pat.patch(`/repos/${OWNER}/${pr.repo}/pulls/${pr.number}`, { state: "closed" });
        try {
          await pat.del(`/repos/${OWNER}/${pr.repo}/git/refs/heads/${pr.branch}`);
        } catch {
          /* already gone */
        }
      }
      await jobs.comment(n, workerLine(job.worker, "stood down", "Dropped it. Nothing was changed."));
      await jobs.setState(n, "done");
      await jobs.close(n, "not_planned");
      return skip("rejected");
    }
    if (issue.state === "closed") await jobs.reopen(n);
  } else {
    return skip(`event ${name}`);
  }

  // Run the worker.
  const comments = await jobs.comments(n);
  const pr = lastPrMarker(comments);
  const ref = pr && pr.repo === job.repo && (await prOpen(pr)) ? pr.branch : "";
  writeFileSync(join(temp, "prompt.md"), buildPrompt(job, issue, comments));
  await jobs.setState(n, "working");
  output("action", "run");
  output("repo", job.repo);
  output("ref", ref);
  output("issue", n);
}

function changes(dir) {
  const status = git(dir, "diff", "--cached", "--name-status", "-M");
  const numstat = git(dir, "diff", "--cached", "--numstat", "-M");
  const rows = status ? status.split("\n").map((l) => l.split("\t")) : [];
  const deleted = rows.filter((r) => r[0] === "D").map((r) => r[1]);
  const moved = rows.filter((r) => r[0].startsWith("R")).map((r) => `${r[1]} → ${r[2]}`);
  const lines = numstat
    ? numstat.split("\n").reduce((sum, l) => {
        const [a, d] = l.split("\t");
        return sum + (Number(a) || 0) + (Number(d) || 0);
      }, 0)
    : 0;
  return { files: rows.length, deleted, moved, lines };
}

async function finish() {
  const n = Number(env.ISSUE);
  const repo = env.REPO;
  const dir = env.TARGET_DIR;
  const issue = await jobs.issue(n);
  const job = parseJob(issue.body);
  const comments = await jobs.comments(n);
  const prev = lastPrMarker(comments);

  let result = { summary: "", title: "", question: null };
  const resultFile = join(dir, ".nexus-result.json");
  if (existsSync(resultFile)) {
    try {
      result = { ...result, ...JSON.parse(readFileSync(resultFile, "utf8")) };
    } catch {
      /* fall through to the CLI transcript */
    }
    rmSync(resultFile);
  }
  if (!result.summary) {
    try {
      result.summary = JSON.parse(readFileSync(join(temp, "claude.json"), "utf8")).result || "";
    } catch {
      result.summary = "Finished without a summary.";
    }
  }

  // Workers never ship CI changes.
  try {
    git(dir, "checkout", "HEAD", "--", ".github");
  } catch {
    /* no .github dir */
  }
  try {
    git(dir, "clean", "-fdq", "--", ".github");
  } catch {
    /* nothing to clean */
  }
  git(dir, "add", "-A");
  const ch = changes(dir);

  if (ch.files === 0) {
    const status = result.question ? "has a question" : "reporting";
    const text = result.question ? `${result.summary}\n\n❓ ${result.question}` : result.summary;
    await jobs.comment(n, workerLine(job.worker, status, text));
    if (result.question) await jobs.setState(n, "needs-you");
    else {
      await jobs.setState(n, "done");
      await jobs.close(n);
    }
    return;
  }

  const branch = env.REF || `nexus/job-${n}`;
  const title = (result.title || issue.title.replace(/^\[[^\]]+\]\s*/, "")).slice(0, 120);
  git(dir, "checkout", "-B", branch);
  git(
    dir,
    "-c", `user.name=NEXUS ${job.worker}`,
    "-c", "user.email=nexus-worker@users.noreply.github.com",
    "commit", "-q", "-m", `${title}\n\nNEXUS job #${n} (${job.kind}) by ${job.worker}.`,
  );
  const remote = env.PUSH_REMOTE || `https://x-access-token:${env.NEXUS_PAT}@github.com/${OWNER}/${repo}.git`;
  git(dir, "push", "-q", remote, `HEAD:refs/heads/${branch}`);

  let pr = prev && prev.repo === repo && prev.branch === branch && (await prOpen(prev)) ? prev : null;
  if (!pr) {
    const created = await pat.post(`/repos/${OWNER}/${repo}/pulls`, {
      title,
      head: branch,
      base: await defaultBranch(repo),
      body: `${result.summary}\n\nSent from NEXUS Station — job ${OWNER}/nexus-city#${n}, worker ${job.worker}.`,
    });
    pr = { repo, number: created.number, branch, url: created.html_url };
  }

  // Judge the whole PR, not just this round's commit.
  const files = await pat.get(`/repos/${OWNER}/${repo}/pulls/${pr.number}/files?per_page=100`);
  const verdict = judgeChange({
    files: files.length,
    deleted: files.filter((f) => f.status === "removed").map((f) => f.filename),
    lines: files.reduce((s, f) => s + f.additions + f.deletions, 0),
    question: result.question,
  });
  const detail = [
    ch.deleted.length ? `**Deletes:**\n${ch.deleted.map((f) => `- \`${f}\``).join("\n")}` : "",
    ch.moved.length ? `**Moves:**\n${ch.moved.map((f) => `- \`${f}\``).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  if (verdict.auto) {
    try {
      await merge(pr);
      await jobs.comment(n, workerLine(job.worker, "landed", `${result.summary}\n\nMerged into ${repo}: ${pr.url}`) + `\n${prMarker({ ...pr, merged: true })}`);
      await jobs.setState(n, "done");
      await jobs.close(n);
      return;
    } catch (e) {
      verdict.reasons.push(`auto-merge failed (${e.message.split("→").pop().trim()})`);
    }
  }
  const ask = result.question ? `\n\n❓ ${result.question}` : "";
  await jobs.comment(
    n,
    workerLine(
      job.worker,
      "waiting on you",
      `${result.summary}${ask}\n\n${detail ? detail + "\n\n" : ""}Needs your OK because it ${verdict.reasons.join(", ")}. Review: ${pr.url}\n\nApprove in the city, or comment \`/approve\` / \`/reject\`.`,
    ) + `\n${prMarker(pr)}`,
  );
  await jobs.setState(n, result.question ? "needs-you" : "review");
}

async function fail() {
  const n = Number(env.ISSUE);
  if (!n) return;
  const issue = await jobs.issue(n);
  const job = parseJob(issue.body);
  await jobs.comment(
    n,
    workerLine(job?.worker ?? "Crew", "hit a wall", `The run failed: ${env.RUN_URL}\n\nComment anything to retry.`),
  );
  await jobs.setState(n, "failed");
}

const run = { route, finish, fail }[mode];
if (!run) {
  console.error("usage: nexus-worker.mjs route|finish|fail");
  process.exit(2);
}
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
