import type { Lot, LotLink, LotStatus, Race } from "./types";

export function isPlatformOnly(truth: string): boolean {
  const t = truth.toLowerCase();
  return (
    t.includes("runs in claude only") ||
    t.includes("runs in grok only") ||
    t.includes("claude only") ||
    t.includes("gemini only") ||
    t.includes("grok only") ||
    t.includes("meta only")
  );
}

export function hasHostedUrl(url: string | null | undefined): boolean {
  return !!url && /^https?:\/\//i.test(url);
}

export function classifyUrl(
  url: string | null | undefined,
): "github" | "pages" | "drive" | "notion" | "other" | null {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes("notion.so")) return "notion";
  if (u.includes("drive.google")) return "drive";
  if (u.includes("github.io")) return "pages";
  if (u.includes("github.com")) return "github";
  return "other";
}

export function isPlaceholderFile(f: string): boolean {
  return f === "Talked about" || f === "No file yet";
}

export function hasRealFile(lot: {
  files: string[];
  open: string | null;
  archive?: { length: number };
}): boolean {
  if (hasHostedUrl(lot.open)) return true;
  if (lot.archive && lot.archive.length > 0) return true;
  return (lot.files || []).some((f) => f && !isPlaceholderFile(f));
}

export function silhouette(lot: {
  files: string[];
  open: string | null;
  status: string;
  look: string | null;
  archive?: { length: number };
}): string {
  if (
    lot.look &&
    ["ops", "table", "airlock", "spine", "archive", "pad"].includes(lot.look)
  ) {
    return lot.look;
  }
  const k = classifyUrl(lot.open);
  const files = lot.files || [];
  const html = files.some((f) => /\.html/i.test(f));
  if (!hasRealFile(lot)) return "pad";
  if (k === "notion") return "office";
  if (k === "drive") return "cargo";
  if (k === "pages" || html) return "lab";
  if (k === "github" || files.includes("GitHub")) return "antenna";
  return "crate";
}

export function stageOf(lot: { raise: number; status: string; truth: string }): number {
  if (lot.raise > 0) return Math.min(3, lot.raise);
  if (lot.status === "works") return 3;
  const t = lot.truth || "";
  if (t.startsWith("Opens")) return 2;
  if (lot.status === "talked") return 0;
  if (t.includes("Artifact")) return 1;
  if (t.includes("File only")) return 1;
  if (lot.status === "broken") return 1;
  if (lot.status === "incomplete") return 1;
  return 1;
}

export function linksFromOpen(
  title: string,
  open: string | null,
  files: string[],
): LotLink[] {
  if (!open) return [];
  const k = classifyUrl(open);
  if (title === "Asset Factory" || files.includes("Tools Index — not the ledger")) {
    return [{ kind: "notion", label: "Tools Index — not the ledger", url: open }];
  }
  if (k === "pages") return [{ kind: "live", label: "Open app", url: open }];
  if (k === "github") return [{ kind: "github", label: "GitHub", url: open }];
  if (k === "drive") return [{ kind: "drive", label: "Drive", url: open }];
  if (k === "notion") return [{ kind: "notion", label: "Notion", url: open }];
  return [{ kind: "other", label: "Open", url: open }];
}

export function honestNewWork(input: {
  status: string;
  open?: string | null;
  truth?: string;
  files?: string[];
}): { status: LotStatus; truth: string; runs: boolean } {
  const url = input.open ?? null;
  const files = input.files ?? [];
  const truth = input.truth || "";
  const platform = isPlatformOnly(truth);
  let status = (input.status || "incomplete") as LotStatus;

  if (status === "works") {
    if (hasHostedUrl(url)) {
      return { status: "works", truth: truth || "Live", runs: true };
    }
    if (platform) {
      return { status: "works", truth: truth || "Runs in platform only", runs: true };
    }
    status = "incomplete";
  }

  const real =
    files.some((f) => f && !isPlaceholderFile(f)) || hasHostedUrl(url);
  if (!real) {
    if (status === "talked") {
      return { status: "talked", truth: "Marked pad — talked, no hull", runs: false };
    }
    return { status: "incomplete", truth: truth || "No file yet", runs: false };
  }
  if (hasHostedUrl(url) && (truth.startsWith("Opens") || status === "incomplete")) {
    return {
      status: "incomplete",
      truth: truth || "Opens — not finished",
      runs: false,
    };
  }
  return {
    status: status === "broken" ? "broken" : "incomplete",
    truth: truth || "File only — will not run as an app",
    runs: false,
  };
}

export function asRace(v: unknown): Race | null {
  if (v === "claude" || v === "grok" || v === "gemini" || v === "meta") return v;
  return null;
}

export const RACE_HEX: Record<Race | "shared", number> = {
  claude: 0xe8a04a,
  grok: 0xd7e0e8,
  gemini: 0x3d9b8f,
  meta: 0x7a6aad,
  shared: 0x8a7a6a,
};

export const RACE_CSS: Record<Race | "shared", string> = {
  claude: "var(--color-claude)",
  grok: "var(--color-grok)",
  gemini: "var(--color-gemini)",
  meta: "var(--color-meta)",
  shared: "var(--color-muted)",
};
