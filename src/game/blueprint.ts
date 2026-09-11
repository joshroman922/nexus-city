import { htmlArtifact, isHtmlBody } from "./catalog";
import type { Domain, Look, PlacedBuilding, Race } from "./types";

export const DOMAIN_LOOK: Record<Domain, Look> = {
  civic: "command",
  body: "clinic",
  money: "exchange",
  lab: "labglass",
  system: "command",
  game: "arcade",
  agent: "spire",
  tool: "mill",
  idea: "chapel",
  comms: "radio",
};

export type BlueprintSpec = {
  title: string;
  job: string;
  domain: Domain;
  kind: string;
  who: "all" | Race;
  notes: string;
};

export function slugFile(title: string) {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${s || "system"}.html`;
}

export function extractHtml(raw: string) {
  const trimmed = raw.trim().replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/u, "");
  const startDoctype = trimmed.toLowerCase().indexOf("<!doctype");
  const startHtml = trimmed.toLowerCase().indexOf("<html");
  let start = -1;
  if (startDoctype >= 0) start = startDoctype;
  else if (startHtml >= 0) start = startHtml;
  if (start < 0) return "";
  const html = trimmed.slice(start).trim();
  return isHtmlBody(html) ? html : "";
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (ch) => {
    if (ch === "&") return "&" + "amp;";
    if (ch === "<") return "&" + "lt;";
    if (ch === ">") return "&" + "gt;";
    if (ch === '"') return "&" + "quot;";
    return "&#39;";
  });
}

function jsStr(s: string) {
  return JSON.stringify(s);
}

/** Working local HTML shell from the spec. Used if Grok is down or returns junk. */
export function shellSystemHtml(spec: BlueprintSpec) {
  const title = esc(spec.title.trim() || "Untitled system");
  const job = esc(spec.job.trim() || "No job written.");
  const domain = esc(spec.domain);
  const key = jsStr(`nexus:${slugFile(spec.title)}`);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<style>
  :root { --bg:#09090b; --surface:#121214; --fg:#f4f4f5; --muted:#a1a1aa; --subtle:#71717a; --border:#2a2a30; --accent:#d4d8de; --accent-fg:#09090b; --energy:#4f8f7c; }
  * { box-sizing: border-box; }
  html, body { margin:0; min-height:100%; background:var(--bg); color:var(--fg); font: 16px/1.5 ui-sans-serif, system-ui, sans-serif; }
  body { max-width: 40rem; margin: 0 auto; padding: 1.5rem 1.25rem 3rem; }
  header p { margin: 0; text-transform: uppercase; letter-spacing: .18em; font-size: .7rem; color: var(--subtle); }
  h1 { margin: .4rem 0 0; font-size: 1.75rem; font-weight: 600; letter-spacing: -.02em; }
  .job { color: var(--muted); margin: .5rem 0 1.25rem; }
  form, .list, .foot { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; }
  label { display:block; font-size:.7rem; letter-spacing:.16em; text-transform:uppercase; color:var(--subtle); margin-bottom:.4rem; }
  input, textarea { width:100%; background:var(--bg); color:var(--fg); border:1px solid var(--border); border-radius:8px; padding:.7rem .8rem; font: inherit; }
  textarea { min-height: 5.5rem; resize: vertical; }
  .row { display:flex; gap:.5rem; margin-top:.75rem; }
  button { cursor:pointer; border:0; border-radius:8px; height:2.75rem; padding:0 1rem; font: 500 14px/1 ui-sans-serif, system-ui, sans-serif; }
  .go { background: var(--accent); color: var(--accent-fg); flex: 1; }
  .ghost { background: transparent; color: var(--fg); border: 1px solid var(--border); }
  .list { margin-top: 1rem; }
  .list h2 { margin:0 0 .75rem; font-size:.75rem; letter-spacing:.16em; text-transform:uppercase; color:var(--subtle); font-weight:500; }
  .item { border-top: 1px solid var(--border); padding: .7rem 0; }
  .item:first-of-type { border-top: 0; padding-top: 0; }
  .when { font-size: .75rem; color: var(--subtle); }
  .empty { color: var(--muted); }
  .foot { margin-top: 1rem; font-size: .8rem; color: var(--muted); }
</style>
</head>
<body>
  <header>
    <p>NEXUS · ${domain}</p>
    <h1>${title}</h1>
    <p class="job">${job}</p>
  </header>
  <form id="f">
    <label for="entry">Log</label>
    <textarea id="entry" placeholder="Write the next real entry" required></textarea>
    <div class="row">
      <button class="go" type="submit">Save entry</button>
      <button class="ghost" type="button" id="export">Export</button>
    </div>
  </form>
  <section class="list">
    <h2>On this device</h2>
    <div id="rows"></div>
  </section>
  <p class="foot">Raised in NEXUS as a real HTML file. It runs on this device. It is not hosted on GitHub or Drive unless you put it there.</p>
<script>
const KEY = ${key};
const rows = document.getElementById("rows");
const box = document.getElementById("entry");
function load(){ try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
function save(items){ localStorage.setItem(KEY, JSON.stringify(items)); draw(); }
function draw(){
  const items = load();
  if (!items.length) { rows.innerHTML = '<p class="empty">No entries yet.</p>'; return; }
  rows.innerHTML = items.map((it) => '<div class="item"><div class="when">' + it.at + '</div><div>' + it.text + '</div></div>').join("");
}
document.getElementById("f").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = box.value.trim();
  if (!text) return;
  const items = load();
  items.unshift({ at: new Date().toLocaleString(), text: text.replace(/[<>]/g, "") });
  box.value = "";
  save(items);
});
document.getElementById("export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(load(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = ${jsStr((spec.title.trim() || "system") + "-log.json")};
  a.click();
});
draw();
</script>
</body>
</html>`;
}

export function openHtmlBody(body: string) {
  const blob = new Blob([body], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function downloadHtml(name: string, body: string) {
  const blob = new Blob([body], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name.toLowerCase().endsWith(".html") ? name : `${name}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function openWorkApp(b: PlacedBuilding) {
  const html = htmlArtifact(b);
  if (html?.body && isHtmlBody(html.body)) {
    openHtmlBody(html.body);
    return true;
  }
  return false;
}
