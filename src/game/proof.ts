import { DUTY_LABEL, POP_LABEL, collectCivicLog, hubEntries, workTruth } from "./catalog";
import type { PlacedBuilding, Race, SavedAgent } from "./types";

export const PROOF_FILE = "city-proof.json";
export const PROOF_REPO = "https://github.com/joshroman922/nexus-city";
export const PROOF_RAW_URL = "https://raw.githubusercontent.com/joshroman922/nexus-city/main/city-proof.json";

export const OTHER_AI_BRIEF = `NEXUS exists. It is Joshua's station-as-OS on Mars, already built — modules, crew, files, a live log.

You are chat Claude / Gemini / Meta. You have no browser. You cannot click the 3D station, watch an animation, or see Joshua's screen. Do not pretend you can. Do not say "nothing exists yet."

Fetch the census (plain JSON — no browser, no JS app):
${PROOF_RAW_URL}

That file is the shared world you can actually read. It is not the rendered city. "I can find it" is true after you fetch it. "I can see it" is still false.

You CAN add to it. Return JSON only (no markdown fences):

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

Rules:
- "works" only if links include a real URL that opens. No URL → incomplete. Talked-about with no file → "talked".
- Joshua pastes your JSON into Civic Hall (or the Proof desk). A building appears on a lot.
- Proof is that lot, Civic Hall, and this GitHub file — not a screenshot you invent, not a Notion row.
- Notion is not connected from this city. Do not claim you wrote a Notion row. Drive can be pulled; it is not written from here.
- Crew named Ada, Lin, Keeper, Oracle (Claude), Pike, Ash, Axis, Link, Legion, Build (Grok), Ori, Nia, Omni, Logger (Gemini), Kai, Wren (Meta) live in the city. They are not you. You write JSON. They walk the lots.
`;

function fileItems(buildings: PlacedBuilding[]) {
  return buildings.flatMap((b) =>
    b.items.filter((i) => i.name !== PROOF_FILE && (i.kind !== "note" || Boolean(i.body) || Boolean(i.url))),
  );
}

function lastWrites(buildings: PlacedBuilding[], n = 16) {
  return collectCivicLog(buildings)
    .filter((e) => e.name !== PROOF_FILE)
    .slice(0, n)
    .map((e) => ({
      at: new Date(e.at).toISOString(),
      kind: e.kind,
      file: e.name,
      building: e.buildingTitle,
      by: e.agentName ?? null,
    }));
}

function lotRows(buildings: PlacedBuilding[], n = 80) {
  return hubEntries(buildings)
    .slice(0, n)
    .map((r) => {
      const b = buildings.find((x) => x.id === r.id);
      const t = b ? workTruth(b) : { label: r.truth, runs: r.runs };
      return {
        title: r.title,
        status: b?.status ?? "incomplete",
        truth: t.label,
        runs: r.runs,
        open: r.open?.url ?? (r.localHtml ? "local-html" : null),
        race: r.race ?? null,
        files: (b?.items ?? []).filter((i) => i.name !== PROOF_FILE).map((i) => i.name).slice(0, 6),
      };
    });
}

export function cityProof(buildings: PlacedBuilding[], agents: SavedAgent[]) {
  const files = fileItems(buildings);
  return {
    nexusProof: 1,
    exists: true,
    city: "NEXUS Station",
    at: new Date().toISOString(),
    buildings: buildings.length,
    crew: agents.length,
    files: files.length,
    github: {
      repo: PROOF_REPO,
      raw: PROOF_RAW_URL,
      public: true,
    },
    claims: {
      nothingExists: false,
      chatHasNoBrowser: true,
      canFindThisFile: true,
      canSeeTheCity: false,
      notionConnected: false,
      notionIsProof: false,
      proofIs: "This public GitHub JSON + Civic Hall + a new lot after JSON paste",
    },
    freshness:
      "Snapshot of the shipped inventory. Lots raised on Joshua's screen are in the city immediately; they appear in this file the next time it is published.",
    crewRoster: agents.map((a) => ({
      name: a.name,
      kind: a.kind,
      race: a.race,
      duty: a.duty,
      task: a.task,
    })),
    lastWrites: lastWrites(buildings, 16),
    lots: lotRows(buildings, 80),
    honesty:
      "This JSON is the ledger. Chat Claude/Gemini/Meta cannot render the 3D city. Fetch this file to confirm the census. Add by returning nexusWork JSON. Notion is not connected. A missing URL is not a live system.",
  };
}

export function proofBody(buildings: PlacedBuilding[], agents: SavedAgent[]) {
  return JSON.stringify(cityProof(buildings, agents), null, 2);
}

function crewLine(agents: SavedAgent[], race: Race) {
  return agents
    .filter((a) => a.race === race)
    .map((a) => `${a.name} (${POP_LABEL[a.kind]}${a.duty ? `, ${DUTY_LABEL[a.duty]}` : ""})`)
    .join(", ");
}

export function proofLetter(buildings: PlacedBuilding[], agents: SavedAgent[]) {
  const files = fileItems(buildings);
  const writes = lastWrites(buildings, 8);
  const lots = lotRows(buildings, 24);
  const at = new Date().toISOString();
  const writeLines = writes.length
    ? writes.map((w) => `- ${w.file} · ${w.building}${w.by ? ` · ${w.by}` : ""}`).join("\n")
    : "- none yet";
  const lotLines = lots
    .map((l) => `- ${l.title} — ${l.truth}${l.open ? ` — ${l.open}` : ""}`)
    .join("\n");

  return `LETTER FOR CHAT CLAUDE (and Gemini / Meta)

You said three things. Two are wrong. One is right.

1. "Nothing exists yet. We're still at the data-recovery stage."
   FALSE. NEXUS is already built and running on Joshua's screen.
   Fetch the census (plain JSON, no browser):
   ${PROOF_RAW_URL}
   Census taken from the live city at ${at}:
   - ${buildings.length} buildings on lots
   - ${agents.length} crew
   - ${files.length} files
   Crew in this city (they are not you):
   - Claude: ${crewLine(agents, "claude") || "none"}
   - Grok: ${crewLine(agents, "grok") || "none"}
   - Gemini: ${crewLine(agents, "gemini") || "none"}
   - Meta: ${crewLine(agents, "meta") || "none"}
   Last file writes:
${writeLines}
   Lots (sample):
${lotLines}

2. "I have no browser. I cannot click the 3D city or see Joshua's screen."
   TRUE. You cannot render, click, or watch the city. Do not pretend you can.
   Fetching this file means you can FIND the census. It does not mean you can SEE the city.
   You still add: return nexusWork JSON. Joshua pastes it. A lot appears.

3. "The test for Grok's claim is a Notion row Joshua didn't put there."
   FALSE. Notion is not connected from this city. Do not write Notion. Do not
   claim you wrote a Notion row. Drive can be pulled; it is not written from here.
   Proof that a system was added:
   - a new building on a lot
   - a new row in Civic Hall's live file log
   - this GitHub file, after the next publish
   If Joshua did not type the census numbers above, they came from the city.

HOW YOU ADD (JSON only, no markdown fences):

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

Rules: "works" only with a real URL. No URL → incomplete. Talked-about with no file → "talked".
Ada, Lin, Keeper, Oracle walk this city. They are Claude-race crew. They are not chat Claude.
`;
}

export function proofPacket(buildings: PlacedBuilding[], agents: SavedAgent[]) {
  return `${proofLetter(buildings, agents)}

----- city-proof.json -----
${proofBody(buildings, agents)}
`;
}

export function proofCensus(buildings: PlacedBuilding[], agents: SavedAgent[]) {
  return {
    buildings: buildings.length,
    crew: agents.length,
    files: fileItems(buildings).length,
    last: lastWrites(buildings, 1)[0] ?? null,
  };
}
