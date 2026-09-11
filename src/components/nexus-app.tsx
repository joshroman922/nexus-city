import { useCallback, useEffect, useRef, useState } from "react";
import { Joystick } from "@/components/joystick";
import { BlueprintTable } from "@/components/blueprint-table";
import {
  AgentRoster,
  AgentSheet,
  BuildDock,
  BuildingSheet,
  FileSheet,
  HubSheet,
  ProofSheet,
  StartScreen,
  TopHud,
  WorldPins,
  type AgentInfo,
} from "@/components/overlays";
import { sfxOpen, unlockAudio } from "@/game/audio";
import type { NexusEngine } from "@/game/engine";
import { useDistrict } from "@/game/store";
import type { BuildingKind, CameraView, EngineHud, PopKind, Race } from "@/game/types";

const EMPTY_HUD: EngineHud = {
  nearbyId: null,
  nearbyLabel: null,
  nearbyKind: null,
  canPlace: false,
  hoverGx: null,
  hoverGz: null,
  jobsLive: 0,
  playerX: 0,
  playerZ: 0,
  playerYaw: 0,
  playerSpeed: 0,
  view: "walk",
  pins: [],
  lastNote: null,
};

export function NexusApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<NexusEngine | null>(null);
  const [entered, setEntered] = useState(false);
  const [mode, setMode] = useState<"explore" | "build">("explore");
  const [view, setView] = useState<CameraView>("walk");
  const [buildKind, setBuildKind] = useState<BuildingKind>("app");
  const [hud, setHud] = useState<EngineHud>(EMPTY_HUD);
  const [openBuilding, setOpenBuilding] = useState<string | null>(null);
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [roster, setRoster] = useState(false);
  const [hub, setHub] = useState(false);
  const [proof, setProof] = useState(false);
  const [blueprint, setBlueprint] = useState<string | null>(null);
  const [openFile, setOpenFile] = useState<{ buildingId: string; itemId: string } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let engine: NexusEngine | null = null;

    void import("@/game/engine").then(({ NexusEngine }) => {
      if (disposed || !canvasRef.current) return;
      engine = new NexusEngine(canvas, {
        onHud: (next) => {
          setHud(next);
          setView(next.view);
          const eng = engine;
          if (!eng) return;
          setAgentInfo((prev) => {
            if (!prev) return prev;
            return eng.agentInfo(prev.id) ?? prev;
          });
        },
        onOpenBuilding: (id) => {
          sfxOpen();
          setAgentInfo(null);
          setRoster(false);
          setOpenFile(null);
          setBlueprint(null);
          setHub(false);
          setProof(false);
          setOpenBuilding(id);
        },
        onOpenAgent: (id) => {
          const info = engine?.agentInfo(id);
          if (info) {
            sfxOpen();
            setOpenBuilding(null);
            setRoster(false);
            setOpenFile(null);
            setBlueprint(null);
            setHub(false);
            setProof(false);
            setAgentInfo(info);
          }
        },
        onPlaced: (b) => {
          if (b.kind === "app" || b.kind === "system" || b.kind === "design") {
            setOpenBuilding(null);
            setAgentInfo(null);
            setRoster(false);
            setHub(false);
            setProof(false);
            setOpenFile(null);
            setBlueprint(b.id);
          }
        },
      });
      engineRef.current = engine;
      engine.start();
    });

    return () => {
      disposed = true;
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  const enter = () => {
    unlockAudio();
    useDistrict.getState().syncProof();
    setEntered(true);
  };

  const toggleMode = () => {
    const next = mode === "explore" ? "build" : "explore";
    setMode(next);
    setOpenBuilding(null);
    setAgentInfo(null);
    setRoster(false);
    setOpenFile(null);
    setBlueprint(null);
    setHub(false);
    setProof(false);
    engineRef.current?.setMode(next);
  };

  const toggleView = () => {
    const next = view === "walk" ? "fly" : "walk";
    engineRef.current?.setView(next);
    setView(next);
  };

  const selectKind = (k: BuildingKind) => {
    setBuildKind(k);
    engineRef.current?.setBuildKind(k);
  };

  const onJoy = useCallback((throttle: number, steer: number) => {
    engineRef.current?.setJoystick(throttle, steer);
  }, []);

  const hatch = (race?: Race, kind?: PopKind) => {
    const a = useDistrict.getState().hatch(race, kind);
    if (!a) return;
    requestAnimationFrame(() => {
      const info = engineRef.current?.agentInfo(a.id);
      if (info) {
        setOpenBuilding(null);
        setRoster(false);
        setOpenFile(null);
        setBlueprint(null);
        setHub(false);
        setProof(false);
        setAgentInfo(info);
      }
    });
  };

  const openAgent = (id: string) => {
    const info = engineRef.current?.agentInfo(id);
    if (info) {
      sfxOpen();
      setRoster(false);
      setHub(false);
      setProof(false);
      setOpenBuilding(null);
      setBlueprint(null);
      setAgentInfo(info);
      useDistrict.getState().greetAgent(id, info.jobLabel);
    }
  };

  const showStick = entered && !openBuilding && !agentInfo && !roster && !openFile && !hub && !blueprint && !proof;
  const sheetOpen = !!(openBuilding || agentInfo || roster || openFile || hub || blueprint || proof);

  return (
    <div
      className="relative h-[100dvh] w-full overflow-hidden bg-bg text-fg"
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        const archive = useDistrict.getState().archiveId();
        if (!archive) return;
        const files = [...e.dataTransfer.files];
        void (async () => {
          for (const f of files) {
            const detail = `${Math.max(1, Math.round(f.size / 1024))} KB · ${f.type || "file"}`;
            const texty =
              /^(text\/|application\/(json|xml))/.test(f.type) ||
              /\.(md|txt|json|csv|ts|tsx|js|jsx|py|html|css)$/i.test(f.name);
            let body: string | undefined;
            if (texty && f.size < 200_000) {
              try {
                body = (await f.text()).slice(0, 8000);
              } catch {
                /* skip */
              }
            }
            useDistrict.getState().addItem(archive, {
              kind: "file",
              name: f.name,
              detail,
              source: "phone",
              body,
              additions: [],
            });
          }
        })();
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />
      {!entered ? <StartScreen onEnter={enter} /> : null}
      {entered ? (
        <>
          <WorldPins
            pins={hud.pins}
            hidden={sheetOpen}
            onOpenAgent={openAgent}
            onOpenBuilding={(id) => {
              sfxOpen();
              setAgentInfo(null);
              setRoster(false);
              setHub(false);
              setProof(false);
              setOpenFile(null);
              setBlueprint(null);
              setOpenBuilding(id);
            }}
          />
          <TopHud
            hud={hud}
            mode={mode}
            view={view}
            onToggleMode={toggleMode}
            onToggleView={toggleView}
            onOpenRoster={() => {
              setOpenBuilding(null);
              setAgentInfo(null);
              setOpenFile(null);
              setHub(false);
              setProof(false);
              setBlueprint(null);
              setRoster(true);
            }}
            onOpenHub={() => {
              setOpenBuilding(null);
              setAgentInfo(null);
              setOpenFile(null);
              setRoster(false);
              setProof(false);
              setBlueprint(null);
              setHub(true);
            }}
            onOpenProof={() => {
              setOpenBuilding(null);
              setAgentInfo(null);
              setOpenFile(null);
              setRoster(false);
              setHub(false);
              setBlueprint(null);
              setProof(true);
            }}
          />
          {showStick ? (
            <div
              className={`pointer-events-none absolute left-0 z-20 p-3 pl-[max(0.75rem,env(safe-area-inset-left))] md:hidden ${
                mode === "build" ? "bottom-52" : "bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              }`}
            >
              <div className="pointer-events-auto">
                <Joystick onChange={onJoy} />
              </div>
            </div>
          ) : null}
          {mode === "explore" && hud.nearbyId && !sheetOpen ? (
            <button
              type="button"
              className="absolute right-4 bottom-6 z-20 h-12 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg"
              onClick={() => engineRef.current?.interact()}
            >
              Open
            </button>
          ) : null}
          {mode === "build" && !sheetOpen ? (
            <BuildDock
              selected={buildKind}
              onSelect={selectKind}
              onPlace={() => engineRef.current?.placeAhead()}
              canPlace={hud.canPlace}
            />
          ) : null}
          {blueprint ? (
            <BlueprintTable
              buildingId={blueprint}
              onClose={() => setBlueprint(null)}
              onDone={(id) => {
                setBlueprint(null);
                setMode("explore");
                engineRef.current?.setMode("explore");
                setOpenBuilding(id);
              }}
              onAssignCrew={(agentId, duty) => {
                engineRef.current?.assignAgent(agentId, blueprint, undefined, duty);
              }}
            />
          ) : null}
          {openBuilding ? (
            <BuildingSheet
              key={openBuilding}
              buildingId={openBuilding}
              onClose={() => setOpenBuilding(null)}
              onHatch={hatch}
              onFocus={(id) => setOpenBuilding(id)}
              onAssignCrew={(agentId, duty) => {
                if (!openBuilding) return;
                engineRef.current?.assignAgent(agentId, openBuilding, undefined, duty);
              }}
              onBlueprint={(id) => {
                setOpenBuilding(null);
                setBlueprint(id);
              }}
              onOpenProof={() => {
                setOpenBuilding(null);
                setProof(true);
              }}
              onOpenFile={(buildingId, itemId) => {
                sfxOpen();
                setOpenBuilding(null);
                setAgentInfo(null);
                setRoster(false);
                setOpenFile({ buildingId, itemId });
              }}
            />
          ) : null}
          {openFile ? (
            <FileSheet
              key={openFile.itemId}
              buildingId={openFile.buildingId}
              itemId={openFile.itemId}
              onClose={() => setOpenFile(null)}
              onSendRace={(race) => {
                engineRef.current?.sendRaceToFile(race, openFile.buildingId, openFile.itemId);
              }}
              onSendAll={() => {
                engineRef.current?.sendAllRacesToFile(openFile.buildingId, openFile.itemId);
              }}
            />
          ) : null}
          {agentInfo ? (
            <AgentSheet
              key={agentInfo.id}
              info={agentInfo}
              onClose={() => setAgentInfo(null)}
              onAssign={(id, duty) => {
                engineRef.current?.assignAgent(agentInfo.id, id, undefined, duty);
                setAgentInfo(null);
              }}
              onOpenSite={(id) => {
                setAgentInfo(null);
                setOpenBuilding(id);
              }}
            />
          ) : null}
          {hub ? (
            <HubSheet
              onClose={() => setHub(false)}
              onFocus={(id) => {
                setHub(false);
                setOpenBuilding(id);
              }}
            />
          ) : null}
          {proof ? (
            <ProofSheet
              onClose={() => setProof(false)}
              onFocus={(id) => {
                setProof(false);
                setOpenBuilding(id);
              }}
            />
          ) : null}
          {roster ? (
            <AgentRoster
              onClose={() => setRoster(false)}
              onOpen={openAgent}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
