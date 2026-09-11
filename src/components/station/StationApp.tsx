import { useEffect, useMemo, useRef } from "react";
import { INFRA } from "@/lib/census";
import { crewOf, lotsOf, useNexus } from "@/lib/store";
import type { RenderMod, StationHandle, StationSync } from "@/game/types";
import { Overlays } from "./overlays";

function toModules(lots: ReturnType<typeof lotsOf>): RenderMod[] {
  return [
    ...lots.map((l) => ({
      id: l.id,
      title: l.title,
      gx: l.gx,
      gz: l.gz,
      race: l.race,
      status: l.status,
      truth: l.truth,
      files: l.files,
      open: l.open,
      raise: l.raise,
      look: l.look,
      kind: "lot" as const,
      archiveLen: l.archive.length,
    })),
    ...INFRA.filter((i) => i.id !== "archive-vault").map((i) => ({
      id: i.id,
      title: i.title,
      gx: i.gx,
      gz: i.gz,
      race: null,
      status: i.look === "pad" ? "talked" : "works",
      truth: i.blurb,
      files: [] as string[],
      open: null,
      raise: i.look === "pad" ? 0 : 3,
      look: i.look,
      kind: "infra" as const,
      archiveLen: 0,
    })),
  ];
}

export function StationApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<StationHandle | null>(null);

  const extraLots = useNexus((s) => s.extraLots);
  const raise = useNexus((s) => s.raise);
  const archive = useNexus((s) => s.archive);
  const assigned = useNexus((s) => s.assigned);
  const entered = useNexus((s) => s.entered);
  const selectedId = useNexus((s) => s.selectedId);
  const panel = useNexus((s) => s.panel);

  const lots = useMemo(
    () => lotsOf({ extraLots, raise, archive }),
    [extraLots, raise, archive],
  );
  const crew = useMemo(() => crewOf({ assigned }), [assigned]);

  useEffect(() => {
    void Promise.resolve(useNexus.persist.rehydrate());
    const w = window as unknown as {
      __nexus?: {
        enter: () => void;
        select: (id: string | null) => void;
        panel: (p: string | null) => void;
      };
    };
    w.__nexus = {
      enter: () => useNexus.getState().enter(),
      select: (id) => useNexus.getState().select(id),
      panel: (p) => useNexus.getState().setPanel(p as never),
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let handle: StationHandle | null = null;
    void import("@/game/station").then(({ mountStation }) => {
      if (cancelled || !canvasRef.current) return;
      handle = mountStation(canvasRef.current, {
        onSelect: (id, kind) => {
          const { entered: on, select, talkCrew, setPanel } = useNexus.getState();
          if (!on) return;
          if (!id) {
            select(null);
            return;
          }
          if (kind === "crew") {
            talkCrew(id);
            return;
          }
          if (kind === "infra") {
            if (id === "civic-hall") setPanel("ops");
            else if (id === "the-table") setPanel("table");
            else if (id === "proof-desk") setPanel("proof");
            else if (id === "archive-vault") {
              select("the-library");
              setPanel("archive");
            } else if (id === "command-spine") {
              select("command-spine");
              setPanel(null);
            } else {
              select(id);
              setPanel(null);
            }
            return;
          }
          select(id);
          if (id === "asset-factory") setPanel("factory");
          else if (id === "the-library") setPanel("archive");
          else setPanel(null);
        },
      });
      handleRef.current = handle;
      const st = useNexus.getState();
      const initLots = lotsOf(st);
      const payload: StationSync = {
        modules: toModules(initLots),
        crew: crewOf(st),
        lots: initLots,
        selectedId: st.selectedId,
        mode: st.entered ? "eva" : "orbit",
      };
      handle.sync(payload);
      handle.setMode(st.entered ? "eva" : "orbit");
    });
    return () => {
      cancelled = true;
      handle?.dispose();
      handleRef.current = null;
    };
  }, []);

  useEffect(() => {
    const h = handleRef.current;
    if (!h) return;
    const payload: StationSync = {
      modules: toModules(lots),
      crew,
      lots,
      selectedId,
      mode: entered ? "eva" : "orbit",
    };
    h.sync(payload);
    h.setMode(entered ? "eva" : "orbit");
    h.setUiBlock(!!panel);
  }, [lots, crew, selectedId, entered, panel]);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full touch-none"
        onContextMenu={(e) => e.preventDefault()}
      />
      <Overlays />
    </div>
  );
}
