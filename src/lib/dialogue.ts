import type { CrewMember, Lot } from "./types";

export function crewLine(crew: CrewMember, lots: Lot[], talking: boolean): string {
  const assigned = crew.assignedTo
    ? lots.find((l) => l.id === crew.assignedTo)
    : null;
  const at = assigned ? ` Docked at ${assigned.title}.` : "";

  const lines: Record<string, string> = {
    Ada: talking
      ? `Archive is open. Claude can fetch the census JSON. Claude cannot see this hull.${at}`
      : "Reading the library.",
    Lin: talking
      ? `Lab audit: I will not mark a file-only dock as live. That was the last city's lie.${at}`
      : "Auditing the Lab.",
    Keeper: talking
      ? `The Table is the only place four platforms sit without pretending they share a browser.${at}`
      : "Refereeing The Table.",
    Oracle: talking
      ? `Ledger rule: Notion is not proof. This JSON is. Asset Factory's 52-row book is gone — empty is honest.${at}`
      : "Reading the ledger.",
    Pike: talking
      ? `NEXUS stands on Mars now. If source is not on GitHub, the next closed tab kills it again.${at}`
      : "Building NEXUS.",
    Ash: talking
      ? `Kalshi is a file. It does not settle from this hull. I will not fake a ticker.${at}`
      : "Wiring Kalshi.",
    Axis: talking
      ? `Axis hold. EVA is free. Camera is not on rails. A yaws left.${at}`
      : "Holding the axis.",
    Link: talking
      ? `GrokLink for Joshua runs in Grok. Widgy is live. I will not merge them into a story.${at}`
      : "Running GrokLink.",
    Legion: talking
      ? `GodForge connector is a file duty, not a live forge. No invented tools.${at}`
      : "GodForge connector.",
    Build: talking
      ? `Raising this city means scaffold, then frame, then pressure. Not a skin.${at}`
      : "Raising this city.",
    Ori: talking
      ? `Google Hub is a file on GitHub (hib, not hub — that's the real name). Not a running command.${at}`
      : "Indexing Google Hub.",
    Nia: talking
      ? `Cellular KB is mapped as folders. It will not run as an app from this station.${at}`
      : "Mapping the cellular KB.",
    Omni: talking
      ? `I discover assets. I do not invent 52 ledger rows to look busy.${at}`
      : "Discovering new assets.",
    Logger: talking
      ? `Hub log is a file trail. Shared lots have no platform stripe.${at}`
      : "Logging the Hub.",
    Kai: talking
      ? `Maintain opens. It is not finished. I will not call it live.${at}`
      : "Connecting Maintain.",
    Wren: talking
      ? `Ghost Hunter is live. That URL opens. I will stand at that airlock if you assign me.${at}`
      : "Linking Ghost Hunter.",
  };
  return lines[crew.name] ?? `${crew.task}.${at}`;
}

export function tableTalk(crew: CrewMember[], lots: Lot[]): string[] {
  const live = lots.filter((l) => l.status === "works" && l.runs).length;
  const ghost = lots.find((l) => l.id === "ghost-hunter");
  const factory = lots.find((l) => l.id === "asset-factory");
  return [
    `Keeper: Sixteen on station. ${live} sealed and running. The rest is hull, crate, or stakes.`,
    `Pike: Mars hold. Same census. Do not reset the lots.`,
    `Ada: Library has the charter. Claude still cannot see the 3D.`,
    `Oracle: ${factory?.truth ?? "Ledger lost"}. Tools Index is not the book.`,
    `Wren: ${ghost?.title ?? "Ghost Hunter"} — ${ghost?.truth ?? "Live"}.`,
    `Lin: Craigslist stays file-only. That verdict is locked.`,
    `Axis: EVA is on. Fly the drone. Don't lock the camera.`,
    `Build: Forge a file at the blueprint table and a dock actually rises.`,
  ];
}
