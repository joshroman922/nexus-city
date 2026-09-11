import type {
  AuthorRace,
  BuildingKind,
  Domain,
  Duty,
  ItemKind,
  Look,
  PlacedBuilding,
  PopKind,
  Race,
  SavedAgent,
  WorkLink,
  WorkStatus,
} from "./types";

export type BuildingDef = {
  kind: BuildingKind;
  name: string;
  short: string;
  holds: string;
  cost: number;
  itemKind: ItemKind;
  placeable: boolean;
  work: boolean;
  accent: number;
};

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  core: {
    kind: "core",
    name: "Civic Hall",
    short: "Directory of the whole station.",
    holds: "Everything",
    cost: 0,
    itemKind: "note",
    placeable: false,
    work: false,
    accent: 0xb8c4ce,
  },
  archive: {
    kind: "archive",
    name: "The Library",
    short: "Your real files. All four races write in the same thread.",
    holds: "Files",
    cost: 40,
    itemKind: "file",
    placeable: true,
    work: false,
    accent: 0x8a6a48,
  },
  foundry: {
    kind: "foundry",
    name: "The Shop",
    short: "Where new work gets tooled.",
    holds: "Notes",
    cost: 48,
    itemKind: "note",
    placeable: true,
    work: false,
    accent: 0x6a737c,
  },
  forge: {
    kind: "forge",
    name: "Playbook",
    short: "Skills, prompts, playbooks.",
    holds: "Skills",
    cost: 45,
    itemKind: "skill",
    placeable: true,
    work: false,
    accent: 0xc4b49a,
  },
  hatchery: {
    kind: "hatchery",
    name: "The Agency",
    short: "Hire agents, gems, and bots. Assign them to finish lots or other jobs.",
    holds: "Agents",
    cost: 72,
    itemKind: "note",
    placeable: true,
    work: false,
    accent: 0xa8b0c4,
  },
  vault: {
    kind: "vault",
    name: "Records",
    short: "Private notes. Only you open this.",
    holds: "Notes",
    cost: 36,
    itemKind: "note",
    placeable: true,
    work: false,
    accent: 0x8a9098,
  },
  studio: {
    kind: "studio",
    name: "Works in Progress",
    short: "Things still being built.",
    holds: "In progress",
    cost: 42,
    itemKind: "wip",
    placeable: true,
    work: false,
    accent: 0xb0a498,
  },
  lab: {
    kind: "lab",
    name: "Lab",
    short: "Experiments and wild ideas.",
    holds: "Experiments",
    cost: 56,
    itemKind: "experiment",
    placeable: true,
    work: false,
    accent: 0x86a0c8,
  },
  needle: {
    kind: "needle",
    name: "Mast",
    short: "Links, feeds, people.",
    holds: "Links",
    cost: 50,
    itemKind: "link",
    placeable: true,
    work: false,
    accent: 0x7a8d90,
  },
  reactor: {
    kind: "reactor",
    name: "Substation",
    short: "Feeds the grid. Agents harvest extra energy here.",
    holds: "Energy",
    cost: 80,
    itemKind: "note",
    placeable: true,
    work: false,
    accent: 0x7e9ca8,
  },
  app: {
    kind: "app",
    name: "App",
    short: "A product you shipped — it stands as its own building.",
    holds: "Notes",
    cost: 40,
    itemKind: "note",
    placeable: true,
    work: true,
    accent: 0x5c6b78,
  },
  system: {
    kind: "system",
    name: "System",
    short: "Infrastructure you run. A building on the block.",
    holds: "Notes",
    cost: 44,
    itemKind: "note",
    placeable: true,
    work: true,
    accent: 0x6a737c,
  },
  design: {
    kind: "design",
    name: "Design",
    short: "A look, a language, a layout — raised as a studio.",
    holds: "Notes",
    cost: 38,
    itemKind: "note",
    placeable: true,
    work: true,
    accent: 0xb07a64,
  },
};

export const PLACEABLE = Object.values(BUILDINGS).filter((b) => b.placeable);

export function isWorkKind(kind: BuildingKind) {
  return BUILDINGS[kind].work;
}

export function defaultTitle(kind: BuildingKind) {
  if (kind === "app") return "New app";
  if (kind === "system") return "New system";
  if (kind === "design") return "New design";
  return BUILDINGS[kind].name;
}

export function buildingTitle(b: Pick<PlacedBuilding, "title" | "kind">) {
  return b.title?.trim() || BUILDINGS[b.kind].name;
}

export type RaceDef = {
  race: Race;
  name: string;
  role: string;
  color: number;
  visor: number;
  jacket: number;
};

export const RACES: Record<Race, RaceDef> = {
  claude: { race: "claude", name: "Claude", role: "Research", color: 0xd4783a, visor: 0xffc898, jacket: 0xa85a28 },
  grok: { race: "grok", name: "Grok", role: "Build", color: 0x1a1c1e, visor: 0xe8e8ea, jacket: 0x2a2c30 },
  gemini: { race: "gemini", name: "Gemini", role: "Index", color: 0x2f6dff, visor: 0x9ec4ff, jacket: 0x2448b0 },
  meta: { race: "meta", name: "Meta", role: "Link", color: 0x6b3bdc, visor: 0xd4c4ff, jacket: 0x4a28a0 },
};

export const GEMS = RACES;
export const RACE_CYCLE: Race[] = ["claude", "grok", "gemini", "meta"];
export const GEM_CYCLE = RACE_CYCLE;
export const ALL_RACES: Race[] = ["claude", "grok", "gemini", "meta"];

const LOCKED_SLUGS: Record<string, Race> = {
  lab: "claude",
  intake: "claude",
  "build-lab": "claude",
  "prompt-forge": "claude",
  oracle: "claude",
  sanctum: "claude",
  "table-keeper": "claude",
  "ab-harness": "claude",
  "decode-verify": "claude",
  strategist: "claude",
  groklink: "grok",
  "groklink-joshua": "grok",
  axis: "grok",
  omni: "gemini",
  "hub-logger": "gemini",
  ghostscope: "gemini",
  spectral: "gemini",
  storyteller: "gemini",
  "gemini-sandbox": "gemini",
};

export function usableRaces(w: { slug?: string; domain?: Domain; race?: Race; usableBy?: Race[] }): Race[] {
  if (w.usableBy && w.usableBy.length) return w.usableBy.filter((r) => r in RACES);
  const slug = w.slug ?? "";
  if (LOCKED_SLUGS[slug]) return [LOCKED_SLUGS[slug]];
  if (w.domain === "agent" && w.race) return [w.race];
  return [...ALL_RACES];
}

export function isSharedUse(usable: Race[] | undefined) {
  return !usable || usable.length === 0 || usable.length >= 4;
}

export type WorkTruth = {
  runs: boolean;
  label: string;
  detail: string;
  openKind: "app" | "file" | "repo" | "none";
};

export function primaryLink(b: Pick<PlacedBuilding, "links">) {
  const links = b.links ?? [];
  return (
    links.find((l) => l.kind === "pages" || l.kind === "html") ??
    links.find((l) => l.kind === "file") ??
    links.find((l) => l.kind === "drive") ??
    links.find((l) => l.kind === "github") ??
    links.find((l) => l.kind === "notion") ??
    links[0]
  );
}

export function isHtmlBody(body?: string) {
  if (!body) return false;
  const t = body.trim().slice(0, 280).toLowerCase();
  return t.includes("<html") || t.startsWith("<!doctype");
}

export function htmlArtifact(b: Pick<PlacedBuilding, "items">) {
  return (b.items ?? []).find((i) => isHtmlBody(i.body));
}

export function hasHostedApp(links?: WorkLink[]) {
  return (links ?? []).some((l) => l.kind === "pages" || l.kind === "html");
}

/** "works" only if a hosted app exists, or the lot is race-locked and actually runs in that system. */
export function honestStatus(status: WorkStatus, links?: WorkLink[], usable?: Race[]): WorkStatus {
  if (status !== "works") return status;
  if (hasHostedApp(links)) return "works";
  if (usable && usable.length === 1) return "works";
  return "incomplete";
}

export function workTruth(
  b: Pick<PlacedBuilding, "kind" | "status" | "links" | "items" | "blurb" | "domain" | "usableBy" | "slug" | "race">,
): WorkTruth {
  if (b.kind === "core") {
    return {
      runs: true,
      label: "Live log",
      detail: "Every file the four systems make is recorded here. They can all add to it.",
      openKind: "none",
    };
  }
  if (b.domain === "civic" && !isWorkKind(b.kind)) {
    return {
      runs: true,
      label: "City building",
      detail: "Part of the city itself — not a product you open.",
      openKind: "none",
    };
  }
  const open = primaryLink(b);
  const html = htmlArtifact(b);
  const hasFile = (b.items ?? []).some((i) => i.kind === "file" || Boolean(i.body) || Boolean(i.url));
  const app = open && (open.kind === "pages" || open.kind === "html");
  const usable = usableRaces(b);
  const only = usable.length === 1 ? usable[0] : null;
  const onlyName = only ? RACES[only].name : "";
  if (b.status === "talked") {
    return {
      runs: false,
      label: "Will not work",
      detail: only
        ? `Talked about only. Planned for ${onlyName}. No file, no app.`
        : "Talked about only. No file, no app. Construction lot until someone actually builds it.",
      openKind: "none",
    };
  }
  if (b.status === "broken") {
    return {
      runs: false,
      label: "Will not work reliably",
      detail: "Known bugs or unverified. Do not treat this as a live system.",
      openKind: open ? (app ? "app" : open.kind === "github" ? "repo" : "file") : "none",
    };
  }
  if (app) {
    return {
      runs: b.status === "works",
      label: b.status === "works" ? "Live" : "Opens — not finished",
      detail:
        b.status === "works"
          ? "This opens. Use the button."
          : "The app loads. Treat it as incomplete — do not assume every feature works.",
      openKind: "app",
    };
  }
  if (html) {
    return {
      runs: b.status === "works",
      label: b.status === "works" ? "Opens on this device" : "Opens here — not hosted",
      detail: only
        ? `A real HTML file is saved here. It opens on this device. It only runs in ${onlyName}. It is not on GitHub or Drive unless you add a URL.`
        : "A real HTML file is saved in this city. Open it here. It is not on GitHub or Drive unless you add a URL.",
      openKind: "app",
    };
  }
  if (only) {
    return {
      runs: b.status === "works",
      label: b.status === "works" ? `Runs in ${onlyName} only` : `${onlyName} only — not finished`,
      detail: open
        ? `The file is real. It only runs in ${onlyName}. Other systems can leave notes — they cannot run it.`
        : `No hosted app. Open it inside ${onlyName}. There is nothing to launch from here.`,
      openKind: open ? (open.kind === "github" ? "repo" : "file") : "none",
    };
  }
  if (open) {
    return {
      runs: false,
      label: "File only — will not run as an app",
      detail: "There is a Drive, GitHub, or Notion file. There is no hosted app to open.",
      openKind: open.kind === "github" ? "repo" : "file",
    };
  }
  if (hasFile) {
    return {
      runs: false,
      label: "Artifact only — will not survive if the chat is gone",
      detail: "Logged here with no Drive or GitHub backup. Do not count on this file lasting.",
      openKind: "none",
    };
  }
  return {
    runs: false,
    label: "Will not work",
    detail: "No file, no link, no app.",
    openKind: "none",
  };
}

export type CivicLogEntry = {
  id: string;
  at: number;
  kind: "file" | "add";
  buildingId: string;
  buildingTitle: string;
  itemId: string;
  name: string;
  lockedTo?: Race;
  race?: AuthorRace;
  agentName?: string;
  text: string;
};

export function collectCivicLog(buildings: PlacedBuilding[]): CivicLogEntry[] {
  const out: CivicLogEntry[] = [];
  for (const b of buildings) {
    if (b.kind === "core") continue;
    for (const it of b.items) {
      if (it.kind === "note" && !it.body && !it.url) continue;
      out.push({
        id: `f-${it.id}`,
        at: it.createdAt,
        kind: "file",
        buildingId: b.id,
        buildingTitle: b.title,
        itemId: it.id,
        name: it.name,
        lockedTo: it.lockedTo,
        text: it.detail || it.body || "",
      });
      for (const a of it.additions ?? []) {
        out.push({
          id: a.id,
          at: a.createdAt,
          kind: "add",
          buildingId: b.id,
          buildingTitle: b.title,
          itemId: it.id,
          name: it.name,
          lockedTo: it.lockedTo,
          race: a.race,
          agentName: a.agentName,
          text: a.text,
        });
      }
    }
  }
  out.sort((x, y) => y.at - x.at);
  return out;
}

export type DomainDef = {
  domain: Domain;
  name: string;
  short: string;
  color: number;
  css: string;
};

export const DOMAINS: Record<Domain, DomainDef> = {
  civic: { domain: "civic", name: "Civic", short: "The city itself", color: 0xb8c4ce, css: "bg-civic" },
  body: { domain: "body", name: "Body", short: "Health, clock, cell", color: 0x3d8a7a, css: "bg-body" },
  money: { domain: "money", name: "Money", short: "Trading, household", color: 0xc4a35a, css: "bg-money" },
  lab: { domain: "lab", name: "Lab", short: "The Engineering Lab", color: 0xd4783a, css: "bg-lab" },
  system: { domain: "system", name: "Systems", short: "Life OS, hubs", color: 0x5c6b78, css: "bg-sys" },
  game: { domain: "game", name: "Games", short: "Play and experiments", color: 0xb06048, css: "bg-game" },
  agent: { domain: "agent", name: "Agents", short: "Gems, bots, keepers", color: 0x6b3bdc, css: "bg-agent" },
  tool: { domain: "tool", name: "Tools", short: "Shop-floor and utilities", color: 0x6a737c, css: "bg-tool" },
  idea: { domain: "idea", name: "Ideas", short: "Talked about, not built", color: 0x9aa3ad, css: "bg-idea" },
  comms: { domain: "comms", name: "Comms", short: "Messages, widgets, Opal", color: 0x2f6dff, css: "bg-comms" },
};

export const STATUS_LABEL: Record<WorkStatus, string> = {
  works: "Built",
  incomplete: "Under construction",
  broken: "Fragile",
  talked: "Talked about",
};

export const LOOK_LABEL: Record<Look, string> = {
  hall: "Civic hall",
  library: "Library",
  clinic: "Clinic",
  vault: "Vault",
  tower: "Tower",
  house: "House",
  factory: "Factory",
  spire: "Spire",
  scaffold: "Scaffold",
  mill: "Machine shop",
  arcade: "Arcade",
  antenna: "Mast",
  chapel: "Chapel",
  labglass: "Glass lab",
  clocktower: "Clock tower",
  greenhouse: "Greenhouse",
  radio: "Radio studio",
  labtank: "Wet lab",
  mint: "Mint",
  exchange: "Exchange",
  storefront: "Storefront",
  fortress: "Fortress",
  theatre: "Theatre",
  globe: "Globe pavilion",
  radar: "Radar",
  kiosk: "Kiosk",
  command: "Command",
  townhouse: "Townhouse",
  forge: "Forge",
  observatory: "Observatory",
  monument: "Monument",
  table: "Round table",
  bunker: "Bunker",
  phone: "Phone pavilion",
};

export const KIND_LOOK: Record<BuildingKind, Look> = {
  core: "hall",
  archive: "library",
  foundry: "factory",
  forge: "forge",
  hatchery: "spire",
  vault: "vault",
  studio: "townhouse",
  lab: "labtank",
  needle: "antenna",
  reactor: "mill",
  app: "townhouse",
  system: "command",
  design: "house",
};

export function buildingLook(b: Pick<PlacedBuilding, "kind" | "look" | "links">): Look {
  if (b.look) return b.look;
  const kinds = new Set((b.links ?? []).map((l) => l.kind));
  if (kinds.has("pages") || kinds.has("html")) return "labglass";
  if (kinds.has("github")) return "antenna";
  if (kinds.has("drive")) return "mill";
  if (kinds.has("notion")) return "townhouse";
  return KIND_LOOK[b.kind];
}

export const AGENT_NAMES: Record<Race, string[]> = {
  claude: ["Ada", "Lin", "Sable", "Mira", "Nori", "Helix", "Ivy", "Rowe"],
  grok: ["Pike", "Ash", "Juno", "Veld", "Onyx", "Rex", "Shale", "Kit"],
  gemini: ["Ori", "Nia", "Tal", "Iri", "Sol", "Vex", "Aero", "Pax"],
  meta: ["Kai", "Wren", "Quin", "Lo", "Nash", "Vesper", "Ren", "Cove"],
};

export const GEM_NAMES: Record<Race, string[]> = {
  claude: ["Oracle", "Prism", "Keel", "Lumen"],
  grok: ["Shard", "Flint", "Quarry"],
  gemini: ["Omni", "Halo", "Nimbus", "Lumen"],
  meta: ["Echo", "Veil", "Lattice"],
};

export const BOT_NAMES: Record<Race, string[]> = {
  claude: ["Scribe", "Clerk", "Auger"],
  grok: ["Build", "Link", "Legion", "Axis", "Pike", "Ash", "Weld"],
  gemini: ["Logger", "Index", "Relay"],
  meta: ["Bridge", "Port", "Hinge"],
};

export const POP_LABEL: Record<PopKind, string> = {
  agent: "Agent",
  gem: "Gem",
  bot: "Bot",
};

export const DUTY_LABEL: Record<Duty, string> = {
  build: "Complete builds",
  file: "Write in files",
  patrol: "Other jobs",
};

export function nextPopName(kind: PopKind, race: Race, taken: string[]) {
  const pool = kind === "gem" ? GEM_NAMES[race] : kind === "bot" ? BOT_NAMES[race] : AGENT_NAMES[race];
  const free = pool.find((n) => !taken.includes(n));
  if (free) return free;
  return `${POP_LABEL[kind]} ${taken.length + 1}`;
}

export function nextAgentName(race: Race, taken: string[]) {
  return nextPopName("agent", race, taken);
}

export const HATCH_COST = 55;

export function canCompleteBuild(b: Pick<PlacedBuilding, "status" | "links" | "items">) {
  if (b.status === "broken") return false;
  if ((b.links ?? []).some((l) => Boolean(l.url))) return true;
  return (b.items ?? []).some(
    (i) => (i.kind === "file" || i.kind === "link" || i.kind === "app") && (Boolean(i.url) || Boolean(i.body)),
  );
}

export function seedProgress(status: WorkStatus | undefined) {
  if (status === "works") return 100;
  if (status === "incomplete") return 32;
  if (status === "broken") return 18;
  return 0;
}

export function raceAddition(race: Race, fileName: string, site: string): string {
  const file = fileName;
  const pool: Record<Race, string[]> = {
    claude: [
      `Read ${file}. What's decided, what's still a question, and what would change our mind?`,
      `Notes on ${file} at ${site}: mark the claims that still need a source.`,
      `Reviewed ${file}. The thread is shared — leave the open questions where Grok can ship them.`,
    ],
    grok: [
      `On ${file}: ship one thin slice that works, then widen. Cut anything that isn't load-bearing.`,
      `Build notes for ${file} at ${site}. Ready to wire.`,
      `Working ${file}. Next move is the smallest thing we can actually run.`,
    ],
    gemini: [
      `Indexed ${file}. Related: the library, ${site}, and anything tagged the same.`,
      `Mapped ${file}: sections, owners, and where it sits in the city.`,
      `Cataloged ${file} so Claude, Grok, and Meta can find it without hunting.`,
    ],
    meta: [
      `Linked ${file} to ${site}. Who else should see this?`,
      `Connected ${file} across the four races so nothing lives in one silo.`,
      `Threaded ${file} — research, ship, index, and links in one place.`,
    ],
  };
  const lines = pool[race];
  return lines[Math.floor(Math.random() * lines.length)]!;
}

export function agentJobLabel(opts: {
  job: "idle" | "walk" | "work";
  race: Race;
  task: string;
  targetTitle: string | null;
  targetKind: BuildingKind | null;
}) {
  const { job, race, task, targetTitle, targetKind } = opts;
  const custom = task.trim() && task !== "Awaiting assignment";
  if (job === "idle") return custom ? `Idle — ${task}` : "Idle — looking for work";
  const dest = targetTitle ?? "a plot";
  if (job === "walk") return custom ? `En route · ${task}` : `Walking to ${dest}`;
  if (custom) return task;
  switch (race) {
    case "claude":
      if (targetKind === "archive") return `Reading files in ${dest}`;
      if (targetKind === "app") return `Auditing ${dest}`;
      if (targetKind === "system") return `Studying ${dest}`;
      if (targetKind === "design") return `Reviewing ${dest}`;
      return `Researching at ${dest}`;
    case "grok":
      if (targetKind === "app") return `Building ${dest}`;
      if (targetKind === "system") return `Wiring ${dest}`;
      if (targetKind === "design") return `Shipping ${dest}`;
      return `Working ${dest}`;
    case "gemini":
      if (targetKind === "archive") return `Indexing files in ${dest}`;
      if (targetKind === "system") return `Mapping ${dest}`;
      return `Indexing ${dest}`;
    case "meta":
      if (targetKind === "needle") return `Linking through ${dest}`;
      return `Connecting ${dest}`;
  }
}

export type CrewTalkCtx = {
  name: string;
  race: Race;
  kind: PopKind;
  duty: Duty;
  task: string;
  jobLabel: string;
  jobsDone: number;
  site?: PlacedBuilding;
};

export function crewTalkCtx(a: SavedAgent, buildings: PlacedBuilding[], jobLabel?: string): CrewTalkCtx {
  const site =
    buildings.find((b) => b.id === a.assignedId) ?? (a.homeId ? buildings.find((b) => b.id === a.homeId) : undefined);
  return {
    name: a.name,
    race: a.race,
    kind: a.kind,
    duty: a.duty ?? "file",
    task: a.task,
    jobLabel: jobLabel?.trim() || a.task || DUTY_LABEL[a.duty ?? "file"],
    jobsDone: a.jobsDone,
    site,
  };
}

export function crewGreeting(ctx: CrewTalkCtx): string {
  const kind = POP_LABEL[ctx.kind].toLowerCase();
  const race = RACES[ctx.race].name;
  const who = `I'm ${ctx.name}, a ${race} ${kind}.`;
  const site = ctx.site;
  if (site) {
    const truth = workTruth(site);
    const pct = site.progress ?? 0;
    if (ctx.duty === "build") {
      return `${who} My job is finishing ${site.title} — ${pct}%. ${truth.label}. ${truth.detail}`;
    }
    return `${who} My job: ${ctx.jobLabel}. I'm at ${site.title}. ${truth.label}.`;
  }
  return `${who} My job: ${ctx.jobLabel}. ${ctx.jobsDone} jobs done.`;
}

export function crewReply(ctx: CrewTalkCtx, raw: string): string {
  const q = raw.trim().toLowerCase();
  const site = ctx.site;
  const truth = site ? workTruth(site) : null;
  const job = ctx.jobLabel;
  if (!q || /\b(job|doing|role|assigned|what do you|what's your job|whats your job)\b/.test(q)) {
    return crewGreeting(ctx);
  }
  if (/\b(hello|hi\b|hey|talk)\b/.test(q)) {
    return `Here. ${crewGreeting(ctx)}`;
  }
  if (site && /\b(open|app|file|link|github|drive)\b/.test(q)) {
    const link = primaryLink(site);
    if (link) return `${site.title} opens here: ${link.label}. ${truth?.label ?? ""}`.trim();
    if (htmlArtifact(site)) return `${site.title} opens from the HTML file saved on this lot. ${truth?.label ?? ""}`.trim();
    return `${site.title} has no app to open. ${truth?.detail ?? "It will not work."}`;
  }
  if (site && /\b(finish|complete|done|ship|live|can you)\b/.test(q)) {
    if (canCompleteBuild(site) && site.status !== "broken") {
      return `${site.title} has a real file. I can finish the lot. ${truth?.label ?? ""}`.trim();
    }
    return `I cannot make ${site.title} live. ${truth?.detail ?? "No file. It will not work."}`;
  }
  if (site && /\b(status|progress|how.?s it|where are you)\b/.test(q)) {
    return `${site.title} is at ${site.progress ?? 0}%. ${truth?.label}. ${truth?.detail}`;
  }
  if (/\b(broken|work\?|won't work|will not)\b/.test(q)) {
    if (truth) return `${truth.label}. ${truth.detail}`;
    return `Depends on the lot. My job right now is ${job}.`;
  }
  const tail = site ? `${site.title} — ${job}` : job;
  switch (ctx.race) {
    case "claude":
      return `I'll look at that. My job is still ${tail}.`;
    case "grok":
      return `Say the smallest next move. I'm on ${tail}.`;
    case "gemini":
      return `Noted. Mapped against my job: ${tail}.`;
    case "meta":
      return `I'll connect that. My post is ${tail}.`;
  }
}

export function crewCrossTalk(from: CrewTalkCtx, to: CrewTalkCtx): string {
  const site = from.site?.title ?? to.site?.title ?? "the city";
  const truth = from.site ? workTruth(from.site).label : "";
  switch (from.race) {
    case "claude":
      return `${to.name} — on ${site}: what's decided, what's still a question? My job is ${from.jobLabel}. ${truth}`.trim();
    case "grok":
      return `${to.name}, I'm on ${site}. Smallest thing we can run: ${from.jobLabel}. ${truth}`.trim();
    case "gemini":
      return `${to.name}, indexed ${site} against the rest of the city. ${from.jobLabel}.`;
    case "meta":
      return `${to.name}, linking ${site} across Claude, Grok, and Gemini so it doesn't live in one silo.`;
  }
}

export type HubEntry = {
  id: string;
  title: string;
  domain: Domain;
  truth: string;
  runs: boolean;
  open?: { label: string; url: string };
  race?: Race;
  localHtml?: boolean;
};

export function hubEntries(buildings: PlacedBuilding[]): HubEntry[] {
  const rows: HubEntry[] = [];
  for (const b of buildings) {
    if (b.kind === "core" || b.kind === "hatchery") continue;
    const truth = workTruth(b);
    const open = primaryLink(b);
    const localHtml = Boolean(htmlArtifact(b));
    if (!open && b.kind === "archive") {
      rows.push({ id: b.id, title: b.title, domain: b.domain ?? "civic", truth: truth.label, runs: true, race: b.race });
      continue;
    }
    if (!open && !localHtml && !isWorkKind(b.kind) && b.domain === "civic") continue;
    rows.push({
      id: b.id,
      title: b.title,
      domain: b.domain ?? "civic",
      truth: truth.label,
      runs: truth.runs,
      open: open ? { label: truth.openKind === "app" ? "Open app" : open.label, url: open.url } : undefined,
      race: b.race,
      localHtml: localHtml && !open,
    });
  }
  rows.sort((a, b) => Number(b.runs) - Number(a.runs) || a.title.localeCompare(b.title));
  return rows;
}

export type SiteTalkFacts = {
  title: string;
  status: string;
  progress: number;
  truth: string;
  detail: string;
  links: { label: string; url: string }[];
  files: string[];
};

export function siteTalkFacts(b: PlacedBuilding): SiteTalkFacts {
  const t = workTruth(b);
  return {
    title: b.title,
    status: b.status ?? "incomplete",
    progress: b.progress ?? 0,
    truth: t.label,
    detail: t.detail,
    links: (b.links ?? []).filter((l) => l.url).map((l) => ({ label: l.label, url: l.url })),
    files: (b.items ?? []).slice(0, 8).map((i) => i.name),
  };
}

export type HubBucket = "apps" | "systems" | "tools" | "custom" | "city";

export function hubBucket(e: HubEntry): HubBucket {
  if (e.domain === "system") return "systems";
  if (e.domain === "tool") return "tools";
  if (e.domain === "idea" || e.domain === "lab") return "custom";
  if (e.domain === "civic") return "city";
  return "apps";
}

export const HUB_BUCKET_LABEL: Record<HubBucket | "all" | "live" | "lots", string> = {
  all: "All",
  live: "Live",
  apps: "Apps",
  systems: "Systems",
  tools: "Tools",
  custom: "Custom",
  city: "City",
  lots: "Lots",
};
