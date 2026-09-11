import { uid } from "@/lib/utils";
import { DOMAINS, honestStatus, seedProgress, usableRaces } from "./catalog";
import type {
  Domain,
  Item,
  Look,
  NexusWorkInput,
  PlacedBuilding,
  Race,
  SavedAgent,
  WorkLink,
  WorkStatus,
} from "./types";
import { GRID } from "./types";

export type WorkDef = {
  slug: string;
  title: string;
  blurb: string;
  domain: Domain;
  status: WorkStatus;
  look: Look;
  race?: Race;
  usableBy?: Race[];
  links?: WorkLink[];
  file?: string;
  note?: string;
};

const gh = (repo: string): WorkLink => ({
  kind: "github",
  label: "GitHub",
  url: `https://github.com/joshroman922/${repo}`,
});
const pages = (repo: string): WorkLink => ({
  kind: "pages",
  label: "Open app",
  url: `https://joshroman922.github.io/${repo}/`,
});
const driveFile = (id: string, label = "Drive file"): WorkLink => ({
  kind: "drive",
  label,
  url: `https://drive.google.com/file/d/${id}/view`,
});
const driveFolder = (id: string, label = "Drive folder"): WorkLink => ({
  kind: "drive",
  label,
  url: `https://drive.google.com/drive/folders/${id}`,
});
const notion = (id: string, label = "Notion"): WorkLink => ({
  kind: "notion",
  label,
  url: `https://www.notion.so/${id.replace(/-/g, "")}`,
});

/** Joshua's city — inventory + GitHub (joshroman922) + live Drive. */
export const WORKS: WorkDef[] = [
  {
    slug: "nexus",
    title: "NEXUS",
    blurb:
      "This station on Mars. Source is in joshroman922/nexus-city. The 3D view lives in Grok Build preview; the census is city-proof.json. Not a hosted Pages app yet.",
    domain: "civic",
    status: "incomplete",
    look: "command",
    race: "grok",
    file: "city-proof.json",
    note: "Source pushed to GitHub so the station cannot die with a closed tab.",
    links: [gh("nexus-city")],
  },
  {
    slug: "soma",
    title: "SOMA",
    blurb: "3D body → organ → cell → channel explorer. Spec handed to Grok. No Drive file.",
    domain: "body",
    status: "incomplete",
    look: "clinic",
    race: "grok",
    file: "soma-v1.html",
  },
  {
    slug: "circadia",
    title: "CIRCADIA",
    blurb: "Body-clock and caffeine console. Two-process model. Artifact only.",
    domain: "body",
    status: "incomplete",
    look: "clocktower",
    race: "claude",
  },
  {
    slug: "nourish",
    title: "Nourish",
    blurb: "Five-tab wellness tracker built as a gift. Open Food Facts. No Drive file.",
    domain: "body",
    status: "incomplete",
    look: "greenhouse",
    race: "claude",
  },
  {
    slug: "signal",
    title: "SIGNAL",
    blurb: "Live mic SPL / NIOSH dose meter. Built this week, never saved.",
    domain: "body",
    status: "talked",
    look: "radio",
    race: "grok",
  },
  {
    slug: "cellular",
    title: "Apex Cellular Simulator",
    blurb: "v1.7 biophysics. Heavy version drift — cleanup, not expansion.",
    domain: "body",
    status: "incomplete",
    look: "labtank",
    race: "claude",
    links: [driveFolder("1DUKd93pFRjwbFLvzGw0lZoYouBEEWloR", "Biophysics folder")],
    note: "Three master docs live here (Aug 20): Unified Architecture, Applied Biophysics, Bio-Information Grid.",
  },
  {
    slug: "soc",
    title: "SOC",
    blurb: "Sovereign Optimization Core. Archived July 2026. Drive folder still live.",
    domain: "body",
    status: "incomplete",
    look: "bunker",
    links: [driveFolder("1DUKd93pFRjwbFLvzGw0lZoYouBEEWloR", "03_SOC_Biohacking")],
  },
  {
    slug: "btip",
    title: "BTIP-050",
    blurb: "Pressure transducer calibration. Procedure set, not a build.",
    domain: "tool",
    status: "incomplete",
    look: "mill",
  },
  {
    slug: "gage",
    title: "Gage Block Checker",
    blurb: "Starrett-Webber Grade 0 shop-floor checker. Live on GitHub Pages.",
    domain: "tool",
    status: "works",
    look: "mill",
    race: "grok",
    links: [pages("gage-block-checker"), gh("gage-block-checker")],
  },
  {
    slug: "routes",
    title: "ROUTES Apex",
    blurb: "Trading discipline. Three lanes. Apps Script + GitHub Pages.",
    domain: "money",
    status: "incomplete",
    look: "exchange",
    race: "grok",
    links: [gh("routes"), pages("routes")],
  },
  {
    slug: "kalshi",
    title: "Kalshi 15-min BTC",
    blurb: "Five-layer calibration. Settlement core v2. Fee multiplier still unverified.",
    domain: "money",
    status: "incomplete",
    look: "mint",
    race: "grok",
    links: [gh("kalshi-settlement")],
    file: "kalshi_settlement_core_v2.py",
  },
  {
    slug: "threshold",
    title: "THRESHOLD",
    blurb: "Household money planning. Flagged an unclaimed child SSDI as highest-leverage.",
    domain: "money",
    status: "incomplete",
    look: "townhouse",
    race: "claude",
    links: [notion("cff758de-fbeb-43ff-857a-03427ad951ec", "Household Ledger")],
  },
  {
    slug: "money-engine",
    title: "ApexForge Money Engine",
    blurb: "Found live in Drive Sept 2. Was a rumor. Now it has a plot.",
    domain: "money",
    status: "incomplete",
    look: "mint",
    race: "grok",
    links: [driveFile("1HWDGljijMhxo5tOTEQXgqyZhTXG4waOO", "Money Engine.html")],
    file: "ApexForge_Money_Engine.html",
  },
  {
    slug: "sniper",
    title: "Stock Catalyst Sniper",
    blurb: "Claude classify → EDGAR verify → Telegram → Alpaca. Status unclear.",
    domain: "money",
    status: "broken",
    look: "tower",
    race: "claude",
  },
  {
    slug: "sec-scanner",
    title: "SEC Reverse-Split Scanner",
    blurb: "EDGAR reverse-split alerts. Private repo. Parser bugs known.",
    domain: "money",
    status: "broken",
    look: "radar",
    race: "grok",
    links: [gh("sec-reverse-split-scanner")],
  },
  {
    slug: "craigslist",
    title: "Craigslist Deal Finder",
    blurb: "Louisville / Cincinnati / Indianapolis tool flips. Private GitHub repo. Discord alerts. Not a hosted app.",
    domain: "money",
    status: "incomplete",
    look: "storefront",
    race: "grok",
    links: [gh("craigslist-deal-finder")],
  },
  {
    slug: "lab",
    title: "Claude Engineering Lab",
    blurb: "The Lab. Wrapper v1.4, MAIN v1.3, truth-court v1.2, memory-framework v1.2.",
    domain: "lab",
    status: "works",
    look: "tower",
    race: "claude",
  },
  {
    slug: "intake",
    title: "Intake",
    blurb: "Multi-agent biohacking claims. Architecture complete, not built in Claude Code.",
    domain: "lab",
    status: "talked",
    look: "labtank",
    race: "claude",
  },
  {
    slug: "build-lab",
    title: "Build Lab",
    blurb: "Physical-build advisor. Three modes specified. Notion connector still missing.",
    domain: "lab",
    status: "incomplete",
    look: "factory",
    race: "claude",
  },
  {
    slug: "prompt-forge",
    title: "Prompt Forge",
    blurb: "Fifth Lab command. Spec-and-build for single-file HTML tools.",
    domain: "lab",
    status: "incomplete",
    look: "forge",
    race: "claude",
  },
  {
    slug: "oracle",
    title: "The Oracle",
    blurb: "New Age metaphysical persona. Ledger active in Notion.",
    domain: "lab",
    status: "works",
    look: "chapel",
    race: "claude",
  },
  {
    slug: "sanctum",
    title: "Project Sanctum",
    blurb: "Oracle app. Dashboard, vibe reader, tarot, aura. Phase 2 Notion save not started.",
    domain: "lab",
    status: "incomplete",
    look: "chapel",
    race: "claude",
    note: "No Drive file. Artifact only.",
  },
  {
    slug: "google-hub",
    title: "Google Hub",
    blurb: "Central Command. Notification panel still mockups. Cloudflare worker mid-flight.",
    domain: "system",
    status: "incomplete",
    look: "command",
    race: "gemini",
    links: [gh("google-hib")],
    file: "central-command-hub.html",
    note: "Repo is google-hib. Trash doc still sitting in Drive.",
  },
  {
    slug: "maintain",
    title: "Maintain",
    blurb: "Personal life-OS, v7. GitHub push panel works. Command belt not deployed.",
    domain: "system",
    status: "incomplete",
    look: "townhouse",
    race: "grok",
    links: [gh("maintain"), pages("maintain")],
  },
  {
    slug: "dashboard",
    title: "Dashboard for iPhone",
    blurb: "HUD v6. Weather, calendar, Toyota key, Notion bookshelf.",
    domain: "system",
    status: "incomplete",
    look: "phone",
    race: "gemini",
    links: [pages("dashboard"), gh("dashboard")],
  },
  {
    slug: "asset-factory",
    title: "Asset Factory",
    blurb:
      "52-entry ledger is gone — session-only path, never copied to Notion or Drive. The Tools Index link is a different page, not the factory.",
    domain: "lab",
    status: "incomplete",
    look: "factory",
    links: [notion("39b90301-07c2-813a-aedf-c2767ac3c281", "Tools Index — not the ledger")],
  },
  {
    slug: "capability",
    title: "ApexForge Capability Discovery",
    blurb: "Self-logging folder. Log grew 1.7KB → 80KB in a day. Never in the registry.",
    domain: "lab",
    status: "incomplete",
    look: "observatory",
    race: "grok",
    links: [driveFolder("1ioq5FomaOJBNKDzx4TsI-hHbIrtlsPxs")],
  },
  {
    slug: "compilers",
    title: "ApexForge Compilers",
    blurb: "Four-subfolder pipeline. 00_System has PIPELINE.md. Never catalogued.",
    domain: "lab",
    status: "incomplete",
    look: "factory",
    race: "grok",
    links: [driveFolder("1Wd3-uVIzcJystQmTiKUzdV_dYejHbabr")],
  },
  {
    slug: "god-tier",
    title: "ApexForge God-Tier",
    blurb: "God-Tier / Ultimate-Human split July 22. Lineage unconfirmed.",
    domain: "lab",
    status: "talked",
    look: "monument",
    race: "grok",
  },
  {
    slug: "vault-toolbox",
    title: "VAULT / Toolbox",
    blurb: "Single-file catalog. Tracks unfinished threads: micrometer, ghost AR, WebXR.",
    domain: "tool",
    status: "incomplete",
    look: "vault",
    race: "grok",
  },
  {
    slug: "protocols",
    title: "Maintain Protocols",
    blurb: "Cyberpunk HUD protocol tracker with Decode-Verify grading.",
    domain: "system",
    status: "incomplete",
    look: "kiosk",
    file: "maintain-protocols-v1.html",
  },
  {
    slug: "gemini-sandbox",
    title: "GEMINI Sandbox",
    blurb: "Gemini-to-iPhone HTML preview workflow.",
    domain: "tool",
    status: "incomplete",
    look: "kiosk",
    race: "gemini",
    file: "GEMINI-SANDBOX-v1.html",
  },
  {
    slug: "ab-harness",
    title: "Prompt A/B Harness",
    blurb: "Python. Bootstrap CI. Tests whether reflection gates improve math.",
    domain: "lab",
    status: "incomplete",
    look: "labtank",
    race: "claude",
  },
  {
    slug: "strategist",
    title: "Message Strategist Pro",
    blurb: "Five stances. Real test exposed a labor-context gap. Upgrade not built.",
    domain: "comms",
    status: "incomplete",
    look: "storefront",
    race: "claude",
  },
  {
    slug: "holdout",
    title: "HOLDOUT",
    blurb: "Zombie survival RTS. At v6. Chat only — no Drive file.",
    domain: "game",
    status: "talked",
    look: "fortress",
    race: "grok",
  },
  {
    slug: "theatre",
    title: "Theatre 1936",
    blurb: "WWII strategy. Chat/memory only.",
    domain: "game",
    status: "talked",
    look: "theatre",
  },
  {
    slug: "morphos",
    title: "MORPHOS",
    blurb: "WebGL2 raymarched fractals. Referenced, not independently confirmed.",
    domain: "game",
    status: "talked",
    look: "globe",
    race: "grok",
  },
  {
    slug: "sigil",
    title: "Sigil Engine",
    blurb: "Kameas, Aiq Beker, Agrippa sigil renderer.",
    domain: "game",
    status: "talked",
    look: "chapel",
  },
  {
    slug: "ghost-hunter",
    title: "Ghost Hunter",
    blurb: "Rear camera + Spirit Box + EMF. Built. Live repo — not just an idea.",
    domain: "game",
    status: "works",
    look: "arcade",
    race: "grok",
    links: [pages("ghost-hunter-app"), gh("ghost-hunter-app")],
  },
  {
    slug: "ghostscope",
    title: "GhostScope",
    blurb: "Google Opal graph app. Built Aug 14–15. Zero record until Drive scan.",
    domain: "comms",
    status: "incomplete",
    look: "radar",
    race: "gemini",
    links: [driveFile("1tdsaZqwEaqImx8Dp4sMDMDP8CxRhLaZ7", "Opal app")],
  },
  {
    slug: "spectral",
    title: "SpectralScan",
    blurb: "Opal graph + paired Memory spreadsheet. Unreviewed.",
    domain: "comms",
    status: "incomplete",
    look: "radio",
    race: "gemini",
    links: [driveFile("1Tmq0w6wD8ExAYLSfzes8Re96ng5uA4GG", "Opal app")],
  },
  {
    slug: "storyteller",
    title: "Visual Storyteller Remix",
    blurb: "Opal graph app. Aug 14–15. Not in any prior list.",
    domain: "comms",
    status: "incomplete",
    look: "theatre",
    race: "gemini",
    links: [driveFile("1BUPbs0cT2MEkAVAqMjrGLdI0SK4cGpUH", "Opal app")],
  },
  {
    slug: "omni",
    title: "Omni-Architect",
    blurb: "Gemini Gem. Discovers prompts, agents, skills, Gems across all three.",
    domain: "agent",
    status: "works",
    look: "spire",
    race: "gemini",
    links: [driveFile("1Z-KGEaFPlR2Zau-IjNXfGT5TjeLMhhez", "Gem")],
  },
  {
    slug: "table-keeper",
    title: "Table Keeper",
    blurb: "Process guardian and debate referee for The Table.",
    domain: "agent",
    status: "incomplete",
    look: "table",
    race: "claude",
  },
  {
    slug: "axis",
    title: "Axis",
    blurb: "Already in HUB Registry as 15A. The agent lives here.",
    domain: "agent",
    status: "incomplete",
    look: "monument",
    race: "grok",
  },
  {
    slug: "hub-logger",
    title: "Hub Logger",
    blurb: "Gemini Gem. Contents unverified — a past session caught confabulation.",
    domain: "agent",
    status: "broken",
    look: "tower",
    race: "gemini",
  },
  {
    slug: "groklink",
    title: "GrokLink Widgy",
    blurb: "Live Grok connector + Widgy blueprints. ApexForge edition.",
    domain: "comms",
    status: "works",
    look: "kiosk",
    race: "grok",
    links: [gh("groklink-widgy-connector"), pages("groklink-widgy-connector")],
  },
  {
    slug: "groklink-joshua",
    title: "GrokLink for Joshua",
    blurb: "GodForge Apex Legion. Cloudflare Worker for Widgy JSON.",
    domain: "comms",
    status: "works",
    look: "kiosk",
    race: "grok",
    links: [gh("groklink-for-joshua")],
  },
  {
    slug: "terrium",
    title: "Apex Terrium",
    blurb: "Local-first world sim. Built when official terrium-dev went unreachable.",
    domain: "game",
    status: "incomplete",
    look: "globe",
    race: "grok",
    links: [gh("apex-terrium-world-sim")],
  },
  {
    slug: "ghost-ar",
    title: "Ghost-hunter AR",
    blurb: "For Jay-Jay. Talked about only.",
    domain: "idea",
    status: "talked",
    look: "arcade",
  },
  {
    slug: "webxr",
    title: "WebXR exploration",
    blurb: "Talked about only.",
    domain: "idea",
    status: "talked",
    look: "globe",
  },
  {
    slug: "micrometer",
    title: "49-8x Micrometer",
    blurb: "Visual aid / parts list. Talked about only.",
    domain: "idea",
    status: "talked",
    look: "mill",
  },
  {
    slug: "cal-lab",
    title: "Calibration software",
    blurb: "Top-ranked business idea for small labs. Not started.",
    domain: "idea",
    status: "talked",
    look: "labtank",
  },
  {
    slug: "iso17025",
    title: "ISO 17025 tooling",
    blurb: "Compliance tooling. Talked about only.",
    domain: "idea",
    status: "talked",
    look: "mill",
  },
  {
    slug: "camera-measure",
    title: "Camera measurement",
    blurb: "Camera-based measurement tools. Talked about only.",
    domain: "idea",
    status: "talked",
    look: "observatory",
  },
  {
    slug: "decode-verify",
    title: "Decode-Verify → Main",
    blurb: "Designed. Never wired into Main System.",
    domain: "idea",
    status: "talked",
    look: "command",
    race: "claude",
  },
  {
    slug: "caught-by-you",
    title: "CaughtByYou",
    blurb: "Most fragile registered item. Artifact-only, no Drive backup.",
    domain: "idea",
    status: "broken",
    look: "storefront",
  },
  {
    slug: "innovation",
    title: "Innovation Compiler",
    blurb: "Four-move build engine. Name-only in memory. No file located.",
    domain: "idea",
    status: "talked",
    look: "factory",
  },
];

export const WORK_SCHEMA = `{
  "nexusWork": 1,
  "title": "Name of the system",
  "blurb": "What it is, in one line",
  "domain": "body | money | lab | system | game | agent | tool | idea | comms",
  "status": "works | incomplete | broken | talked",
  "look": "clocktower | greenhouse | radio | labtank | mint | exchange | storefront | fortress | theatre | globe | radar | kiosk | command | townhouse | forge | observatory | monument | table | bunker | phone | house | tower | clinic | vault | factory | spire | mill | arcade | antenna | chapel | hall | library",
  "race": "claude | grok | gemini | meta",
  "usableBy": ["claude", "grok", "gemini", "meta"],
  "links": [{ "kind": "html", "label": "Open", "url": "https://..." }]
}`;

export function parseNexusWork(raw: string): NexusWorkInput {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/u, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("Not JSON");
  const parsed = JSON.parse(trimmed.slice(start, end + 1)) as NexusWorkInput;
  if (!parsed.title?.trim()) throw new Error("Needs a title");
  const links = Array.isArray(parsed.links) ? parsed.links.filter((l) => l && l.url) : [];
  parsed.links = links;
  if (parsed.status === "works") {
    parsed.status = honestStatus(parsed.status, links, parsed.usableBy);
  }
  return parsed;
}

const KIND_FOR_DOMAIN: Record<Domain, PlacedBuilding["kind"]> = {
  civic: "app",
  body: "lab",
  money: "system",
  lab: "lab",
  system: "system",
  game: "studio",
  agent: "hatchery",
  tool: "foundry",
  idea: "studio",
  comms: "needle",
};

function itemFromWork(w: WorkDef, now: number): Item[] {
  const items: Item[] = [];
  const usable = usableRaces(w);
  const lock = usable.length === 1 ? usable[0] : undefined;
  if (w.file) {
    items.push({
      id: uid("it"),
      kind: "file",
      name: w.file,
      detail: w.status === "talked" ? "Talked about — no file yet" : w.blurb,
      url: w.links?.[0]?.url,
      createdAt: now,
      additions: [],
      lockedTo: lock,
    });
  }
  for (const link of w.links ?? []) {
    items.push({
      id: uid("it"),
      kind: "link",
      name: link.label,
      detail: link.url,
      url: link.url,
      source: link.kind === "github" ? "github" : link.kind === "notion" ? "notion" : "drive",
      createdAt: now,
      additions: [],
      lockedTo: lock && (link.kind === "html" || link.kind === "pages" || !w.file) ? lock : undefined,
    });
  }
  if (w.note) {
    items.push({
      id: uid("it"),
      kind: "note",
      name: "Note",
      detail: w.note,
      body: w.note,
      createdAt: now,
      additions: [],
    });
  }
  if (!items.length) {
    items.push({
      id: uid("it"),
      kind: w.status === "talked" ? "wip" : "note",
      name: w.status === "talked" ? "Talked about" : "No file yet",
      detail: w.blurb,
      createdAt: now,
      additions: [],
      lockedTo: lock,
    });
  }
  return items;
}

function zone(domain: Domain): { x0: number; x1: number; z0: number; z1: number } {
  const last = GRID - 1;
  switch (domain) {
    case "civic":
      return { x0: 5, x1: 9, z0: 5, z1: 9 };
    case "body":
      return { x0: 4, x1: 10, z0: 0, z1: 3 };
    case "money":
      return { x0: 11, x1: last, z0: 4, z1: 10 };
    case "lab":
      return { x0: 4, x1: 10, z0: 11, z1: last };
    case "system":
      return { x0: 9, x1: last, z0: 11, z1: last };
    case "game":
      return { x0: 0, x1: 3, z0: 4, z1: 10 };
    case "agent":
      return { x0: 3, x1: 6, z0: 9, z1: 12 };
    case "tool":
      return { x0: 0, x1: 3, z0: 0, z1: 4 };
    case "comms":
      return { x0: 0, x1: 3, z0: 11, z1: last };
    case "idea":
      return { x0: 11, x1: last, z0: 0, z1: 3 };
  }
}

export function nextLot(domain: Domain, occupied: Set<string>): { gx: number; gz: number } | null {
  const z = zone(domain);
  for (let gz = z.z0; gz <= z.z1; gz++) {
    for (let gx = z.x0; gx <= z.x1; gx++) {
      if ((gx + gz) % 2 !== 0) continue;
      const k = `${gx},${gz}`;
      if (!occupied.has(k)) return { gx, gz };
    }
  }
  for (let gz = 0; gz < GRID; gz++) {
    for (let gx = 0; gx < GRID; gx++) {
      if ((gx + gz) % 2 !== 0) continue;
      const k = `${gx},${gz}`;
      if (!occupied.has(k)) return { gx, gz };
    }
  }
  return null;
}

export function civicSeed(now: number): PlacedBuilding[] {
  const mid = Math.floor(GRID / 2);
  const note = (name: string, detail: string): Item => ({
    id: uid("it"),
    kind: "note",
    name,
    detail,
    createdAt: now,
    additions: [],
  });
  const row = (
    id: string,
    kind: PlacedBuilding["kind"],
    gx: number,
    gz: number,
    title: string,
    blurb: string,
    look: Look,
    items: Item[],
  ): PlacedBuilding => ({
    id,
    kind,
    gx,
    gz,
    title,
    blurb,
    look,
    domain: "civic",
    status: "works",
    items,
    slug: id,
    links: [],
    usableBy: ["claude", "grok", "gemini", "meta"],
    progress: 100,
  });
  return [
    row("b-core", "core", mid, mid, "Civic Hall", "Directory of every system you have built with AI.", "hall", [
      note("How other AIs add", "Paste a NEXUS work JSON here. Claude, Grok, Gemini, and Meta all raise buildings the same way."),
      note("Schema", WORK_SCHEMA),
    ]),
    row("b-archive", "archive", mid, mid - 3, "The Library", "Your real files. Phone, Drive, GitHub.", "library", [
      {
        id: uid("it"),
        kind: "file",
        name: "city-charter.md",
        detail: "Shared desk · four races",
        body: "Every AI-built system stands as a building. Click it. Open the file. Claude, Grok, Gemini, and Meta all write in the same thread — and they can raise new buildings from the schema in Civic Hall.",
        createdAt: now,
        additions: [],
      },
    ]),
    row("b-foundry", "foundry", mid - 3, mid, "The Shop", "Tooling for new work.", "factory", []),
    row("b-hatch", "hatchery", mid + 3, mid, "The Agency", "Hire agents, gems, and bots. Assign them to finish lots or other jobs.", "spire", []),
    row("b-vault", "vault", mid, mid + 3, "Records", "Private notes.", "vault", []),
  ];
}

export function worksToBuildings(now: number, occupied: Set<string>): PlacedBuilding[] {
  const out: PlacedBuilding[] = [];
  for (const w of WORKS) {
    const lot = nextLot(w.domain, occupied);
    if (!lot) continue;
    occupied.add(`${lot.gx},${lot.gz}`);
    const usable = usableRaces(w);
    const status = honestStatus(w.status, w.links, usable);
    out.push({
      id: `w-${w.slug}`,
      kind: KIND_FOR_DOMAIN[w.domain],
      gx: lot.gx,
      gz: lot.gz,
      title: w.title,
      blurb: w.blurb,
      slug: w.slug,
      domain: w.domain,
      status,
      look: w.look,
      race: w.race,
      usableBy: usable,
      links: w.links ?? [],
      items: itemFromWork({ ...w, status }, now),
      progress: seedProgress(status),
    });
  }
  return out;
}

/** Patch persist lots so status and truth cannot disagree. */
export function repairLots(buildings: PlacedBuilding[]): PlacedBuilding[] {
  return buildings.map((b) => {
    if (b.slug === "craigslist") {
      const status = honestStatus("incomplete", b.links, b.usableBy);
      return {
        ...b,
        status,
        blurb:
          "Louisville / Cincinnati / Indianapolis tool flips. Private GitHub repo. Discord alerts. Not a hosted app.",
        progress: Math.min(b.progress ?? 32, 32),
      };
    }
    if (b.slug === "asset-factory") {
      return {
        ...b,
        blurb:
          "52-entry ledger is gone — session-only path, never copied to Notion or Drive. The Tools Index link is a different page, not the factory.",
        links: (b.links ?? []).map((l) =>
          l.kind === "notion" ? { ...l, label: "Tools Index — not the ledger" } : l,
        ),
        items: (b.items ?? []).map((i) =>
          i.name === "Tools Index" || (i.source === "notion" && i.name === "Tools Index")
            ? { ...i, name: "Tools Index — not the ledger" }
            : i,
        ),
      };
    }
    if (b.status === "works") {
      const status = honestStatus(b.status, b.links, b.usableBy);
      if (status !== b.status) {
        return { ...b, status, progress: Math.min(b.progress ?? 32, 32) };
      }
    }
    return b;
  });
}

export function seedAgents(): SavedAgent[] {
  return [
    { id: "a-ada", race: "claude", name: "Ada", kind: "agent", duty: "file", task: "Reading the library", jobsDone: 4, homeId: "b-archive" },
    { id: "a-lin", race: "claude", name: "Lin", kind: "agent", duty: "build", task: "Auditing the Lab", jobsDone: 2, homeId: "w-lab", assignedId: "w-lab" },
    { id: "a-keeper", race: "claude", name: "Keeper", kind: "agent", duty: "patrol", task: "Refereeing The Table", jobsDone: 6, homeId: "w-table-keeper" },
    { id: "a-oracle", race: "claude", name: "Oracle", kind: "gem", duty: "file", task: "Reading the ledger", jobsDone: 5, homeId: "w-oracle" },
    { id: "a-pike", race: "grok", name: "Pike", kind: "bot", duty: "build", task: "Building NEXUS", jobsDone: 7, homeId: "w-nexus", assignedId: "w-nexus" },
    { id: "a-ash", race: "grok", name: "Ash", kind: "bot", duty: "build", task: "Wiring Kalshi", jobsDone: 3, homeId: "w-kalshi", assignedId: "w-kalshi" },
    { id: "a-axis", race: "grok", name: "Axis", kind: "bot", duty: "patrol", task: "Holding the axis", jobsDone: 5, homeId: "w-axis" },
    { id: "a-link", race: "grok", name: "Link", kind: "bot", duty: "file", task: "Running GrokLink", jobsDone: 8, homeId: "w-groklink" },
    { id: "a-legion", race: "grok", name: "Legion", kind: "bot", duty: "file", task: "GodForge connector", jobsDone: 4, homeId: "w-groklink-joshua" },
    { id: "a-build", race: "grok", name: "Build", kind: "bot", duty: "build", task: "Raising this city", jobsDone: 11, homeId: "w-nexus", assignedId: "w-nexus" },
    { id: "a-ori", race: "gemini", name: "Ori", kind: "agent", duty: "file", task: "Indexing Google Hub", jobsDone: 5, homeId: "w-google-hub" },
    { id: "a-nia", race: "gemini", name: "Nia", kind: "agent", duty: "file", task: "Mapping the cellular KB", jobsDone: 1, homeId: "w-cellular" },
    { id: "a-omni", race: "gemini", name: "Omni", kind: "gem", duty: "patrol", task: "Discovering new assets", jobsDone: 9, homeId: "w-omni" },
    { id: "a-logger", race: "gemini", name: "Logger", kind: "gem", duty: "file", task: "Logging the Hub", jobsDone: 2, homeId: "w-hub-logger" },
    { id: "a-kai", race: "meta", name: "Kai", kind: "agent", duty: "file", task: "Connecting Maintain", jobsDone: 2, homeId: "w-maintain" },
    { id: "a-wren", race: "meta", name: "Wren", kind: "agent", duty: "build", task: "Linking Ghost Hunter", jobsDone: 3, homeId: "w-ghost-hunter", assignedId: "w-ghost-hunter" },
  ];
}

export function workFromInput(raw: NexusWorkInput, occupied: Set<string>): PlacedBuilding | null {
  const title = raw.title?.trim();
  if (!title) return null;
  const domain: Domain = raw.domain && DOMAINS[raw.domain] ? raw.domain : "tool";
  const lot = nextLot(domain, occupied);
  if (!lot) return null;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || uid("w");
  const links = Array.isArray(raw.links) ? raw.links.filter((l) => l && l.url) : [];
  let status: WorkStatus = raw.status ?? "incomplete";
  status = honestStatus(status, links, raw.usableBy);
  const def: WorkDef = {
    slug,
    title,
    blurb: raw.blurb?.trim() || "Raised from another system.",
    domain,
    status,
    look: raw.look ?? (status === "talked" ? "scaffold" : "house"),
    race: raw.race,
    links,
  };
  const usable = usableRaces({ ...def, usableBy: raw.usableBy });
  return {
    id: uid("w"),
    kind: KIND_FOR_DOMAIN[domain],
    gx: lot.gx,
    gz: lot.gz,
    title: def.title,
    blurb: def.blurb,
    slug,
    domain,
    status: def.status,
    look: def.look,
    race: def.race,
    usableBy: usable,
    links,
    items: itemFromWork({ ...def, usableBy: usable }, Date.now()),
    progress: seedProgress(def.status),
  };
}
