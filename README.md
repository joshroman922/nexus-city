# NEXUS Station

Joshua's AI hub as a **space station on Mars**. Buildings are real systems. Crew are real agents/bots/gems.

This repo is the **shared world other AIs can actually read**, plus the **source of the 3D station** so it cannot die with a Grok Build tab.

Live: https://joshroman922.github.io/nexus-city/

## Real crew

The crew are real Claude Code workers. Walk up to a module, tap **Send worker**, and pick Fix / Finish / Organize / Clean up / Other. A worker walks to that module and works in the repo on GitHub:

- **Small, additive changes land on their own** (≤ 10 files, ≤ 300 lines, nothing deleted).
- **Anything that deletes files, is big, or has a question waits for you** — the **Work** tab (hard hat) shows a badge; tap **Approve** / **Reject** or answer the question.
- **Patrol** runs every morning: the crew read every repo and come back *asking* — things to finish, fix, organize, or junk to delete. Tap **Yes, do it** or **No**.
- Workers never touch `.github/`, and only you (`joshroman922`) can start, steer, or approve a job.

How it works: each job is an issue in this repo labelled `nexus-job` (state in an `nx:*` label). `.github/workflows/worker.yml` runs Claude Code on the target repo, then `worker/nexus-worker.mjs` pushes a branch, opens a PR, and merges it or waits for you. You can also drive jobs from GitHub: comment on the issue, or `/approve`, `/reject`, `/go`.

### One-time setup

1. **Pages:** Settings → Pages → Source: **GitHub Actions**.
2. **Claude token:** on a computer with Claude Code, run `claude setup-token`, then add it as the repo secret `CLAUDE_CODE_OAUTH_TOKEN` (Settings → Secrets and variables → Actions). Uses your Claude subscription.
3. **Worker GitHub token:** create a fine-grained token (Settings → Developer settings → Fine-grained tokens) for **all** the repos in `src/data/repos.json`, with **Contents: read & write** and **Pull requests: read & write**. Save it as the repo secret `NEXUS_PAT`.
4. **Phone token (for the city):** another fine-grained token for **only `nexus-city`** with **Issues: read & write**. Paste it in the city's Work tab. It stays on the phone.

Repos the crew can reach: `src/data/repos.json` (module id → repo).

## Fetch the census (Claude / Gemini / Meta)

https://raw.githubusercontent.com/joshroman922/nexus-city/main/city-proof.json

Plain JSON. No JavaScript app. No bot wall.

- `exists: true`
- `city: "NEXUS Station"`
- 63 modules, 16 crew, 56 files
- `claims.canSeeTheCity: false` — you still cannot render the 3D view
- `claims.notionConnected: false`

## Source (does not die with the preview)

- `src/components/station/` — the Mars station app (`StationApp`), panels, Work tab
- `src/lib/jobs.ts` — live job board (GitHub issues) the city reads and writes
- `worker/` — worker + patrol scripts run by GitHub Actions (`npm test` runs their tests)
- `src/game/` — engine, meshes (Mars station), inventory, proof, persist
- `src/components/` — HUD, Civic Hall, Proof desk, blueprint table
- `scripts/dump-proof.ts` — regenerate `city-proof.json` from the seed

`npm install && npm run dev` runs the station locally; pushes to `main` deploy it to GitHub Pages.

## How other AIs add

Return JSON only. No markdown fences.

```json
{
  "nexusWork": 1,
  "title": "Name of the system",
  "blurb": "What it actually is, one line",
  "domain": "body | money | lab | system | game | agent | tool | idea | comms",
  "status": "incomplete",
  "look": "mill",
  "race": "claude",
  "usableBy": ["claude", "grok", "gemini", "meta"],
  "links": [{ "kind": "github", "label": "GitHub", "url": "https://..." }]
}
```

Joshua pastes that into Civic Hall (or the Proof desk). A dock appears.

- `"works"` only with a real URL that opens
- No URL → `incomplete`
- Talked-about with no file → `talked`
