import { crewSpeak, type CrewSpeakPerson } from "@/lib/crew-chat";
import { uid } from "@/lib/utils";
import { DUTY_LABEL, POP_LABEL, crewCrossTalk, crewReply, crewTalkCtx, siteTalkFacts } from "./catalog";
import { useDistrict } from "./store";
import type { ChatLine, Race, SavedAgent } from "./types";

function person(a: SavedAgent, jobLabel?: string): CrewSpeakPerson {
  return {
    name: a.name,
    race: a.race,
    kind: POP_LABEL[a.kind],
    duty: DUTY_LABEL[a.duty ?? "file"],
    jobLabel: jobLabel?.trim() || a.task,
    jobsDone: a.jobsDone,
  };
}

function asLine(row: { name: string; race: Race; text: string }, agentId?: string): ChatLine {
  return {
    id: uid("ch"),
    speaker: row.race,
    agentId,
    name: row.name,
    text: row.text,
    at: Date.now(),
  };
}

function youLine(text: string): ChatLine {
  return { id: uid("ch"), speaker: "you", name: "You", text, at: Date.now() };
}

export async function sendTalkTo(agentId: string, text: string, jobLabel?: string) {
  const said = text.trim();
  if (!said) return;
  const s = useDistrict.getState();
  const a = s.agents.find((x) => x.id === agentId);
  if (!a) return;
  const you = youLine(said);
  s.appendChat(agentId, [you]);
  s.appendTable([you]);
  const ctx = crewTalkCtx(a, s.buildings, jobLabel ?? a.task);
  const history = [...(a.chat ?? []), you].slice(-8).map((l) => ({ name: l.name, text: l.text }));
  const res = await crewSpeak({
    data: {
      mode: "reply",
      message: said,
      speaker: person(a, ctx.jobLabel),
      site: ctx.site ? siteTalkFacts(ctx.site) : undefined,
      history,
    },
  });
  const line =
    res.ok && res.lines[0]
      ? asLine(res.lines[0], a.id)
      : asLine({ name: a.name, race: a.race, text: crewReply(ctx, said) }, a.id);
  useDistrict.getState().appendChat(agentId, [line]);
  useDistrict.getState().appendTable([line]);
}

export async function sendTableTalk(text: string) {
  const said = text.trim();
  if (!said) return;
  const s = useDistrict.getState();
  const you = youLine(said);
  s.appendTable([you]);
  const seen = new Set<Race>();
  const tableCrew: SavedAgent[] = [];
  for (const a of s.agents) {
    if (seen.has(a.race)) continue;
    seen.add(a.race);
    tableCrew.push(a);
  }
  const first = tableCrew[0];
  if (!first) return;
  const ctx = crewTalkCtx(first, s.buildings, first.task);
  const res = await crewSpeak({
    data: {
      mode: "table",
      message: said,
      speaker: person(first, ctx.jobLabel),
      site: ctx.site ? siteTalkFacts(ctx.site) : undefined,
      history: s.table.slice(-8).map((l) => ({ name: l.name, text: l.text })),
      tableCrew: tableCrew.map((a) => person(a, a.task)),
    },
  });
  if (res.ok && res.lines.length) {
    const lines = res.lines.map((row) => {
      const match = tableCrew.find((a) => a.race === row.race) ?? tableCrew.find((a) => a.name === row.name);
      return asLine(row, match?.id);
    });
    useDistrict.getState().appendTable(lines);
    return;
  }
  const canned: ChatLine[] = tableCrew.map((a) =>
    asLine({ name: a.name, race: a.race, text: crewReply(crewTalkCtx(a, s.buildings, a.task), said) }, a.id),
  );
  useDistrict.getState().appendTable(canned);
}

export async function bringCrewIn(hostId: string, guestId: string, note?: string) {
  const s = useDistrict.getState();
  const host = s.agents.find((x) => x.id === hostId);
  const guest = s.agents.find((x) => x.id === guestId);
  if (!host || !guest || host.id === guest.id) return;
  const hostCtx = crewTalkCtx(host, s.buildings, host.task);
  const guestCtx = crewTalkCtx(guest, s.buildings, guest.task);
  const res = await crewSpeak({
    data: {
      mode: "cross",
      message: note?.trim() || `${host.name} asked ${guest.name} in.`,
      speaker: person(host, hostCtx.jobLabel),
      site: hostCtx.site ? siteTalkFacts(hostCtx.site) : guestCtx.site ? siteTalkFacts(guestCtx.site) : undefined,
      history: (host.chat ?? []).slice(-6).map((l) => ({ name: l.name, text: l.text })),
      guest: { ...person(guest, guestCtx.jobLabel), siteTitle: guestCtx.site?.title },
    },
  });
  if (res.ok && res.lines[0]) {
    const line = asLine(res.lines[0], guest.id);
    useDistrict.getState().appendChat(hostId, [line]);
    useDistrict.getState().appendChat(guestId, [line]);
    useDistrict.getState().appendTable([line]);
    return;
  }
  const canned = crewCrossTalk(guestCtx, hostCtx);
  const line = asLine({ name: guest.name, race: guest.race, text: canned }, guest.id);
  useDistrict.getState().appendChat(hostId, [line]);
  useDistrict.getState().appendChat(guestId, [line]);
  useDistrict.getState().appendTable([line]);
}
