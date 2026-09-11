import * as THREE from "three";
import { BUILDINGS, DOMAINS, POP_LABEL, RACES, agentJobLabel, buildingTitle, isWorkKind, raceAddition } from "./catalog";
import { createAgent, createGhost, createGround, createPlayer, createWorkBuilding } from "./meshes";
import { cellToWorld, findPath, neighbors, worldToCell } from "./path";
import { sfxPlace, sfxWork } from "./audio";
import { useDistrict } from "./store";
import {
  CELL,
  GRID,
  MAX_SPEED,
  TURN_RATE,
  type BuildingKind,
  type CameraView,
  type Duty,
  type EngineHud,
  type PlacedBuilding,
  type PopKind,
  type Race,
  type WorldPin,
} from "./types";

type AgentRuntime = {
  id: string;
  race: Race;
  name: string;
  task: string;
  kind: PopKind;
  duty: Duty;
  mesh: THREE.Group;
  x: number;
  z: number;
  yaw: number;
  job: "idle" | "walk" | "work";
  targetId: string | null;
  path: { x: number; z: number }[];
  workT: number;
  cooldown: number;
  assigned: boolean;
  jobsDone: number;
  fileId: string | null;
  homeId: string | null;
};

export type EngineHooks = {
  onHud: (hud: EngineHud) => void;
  onOpenBuilding: (id: string) => void;
  onOpenAgent: (id: string) => void;
  onPlaced: (b: PlacedBuilding) => void;
};

export class NexusEngine {
  canvas: HTMLCanvasElement;
  hooks: EngineHooks;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  player: THREE.Group;
  px = 0;
  pz = 8.5;
  yaw = 0;
  speed = 0;
  keys = new Set<string>();
  injected: string[] | null = null;
  joy = { throttle: 0, steer: 0 };
  steerOverride: number | null = null;
  mode: "explore" | "build" = "explore";
  view: CameraView = "walk";
  fly = { tx: 0, tz: 8.5, yaw: 0, pitch: 1.02, dist: 42 };
  buildKind: BuildingKind | null = "app";
  buildingMeshes = new Map<string, THREE.Group>();
  agents: AgentRuntime[] = [];
  ghost: THREE.Group | null = null;
  marker: THREE.Mesh;
  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();
  ndc = new THREE.Vector3();
  groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  running = false;
  last = 0;
  workPulse = 0;
  simT = 0;
  lastNote: { at: number; agent: string; race: Race; file: string } | null = null;
  drag = { down: false, sx: 0, sy: 0, moved: false, pointerId: -1 };
  tmpCam = new THREE.Vector3();
  tmpLook = new THREE.Vector3();
  hit = new THREE.Vector3();
  boundKeyDown: (e: KeyboardEvent) => void;
  boundKeyUp: (e: KeyboardEvent) => void;
  boundBlur: () => void;
  boundResize: () => void;
  boundPointerDown: (e: PointerEvent) => void;
  boundPointerMove: (e: PointerEvent) => void;
  boundPointerUp: (e: PointerEvent) => void;
  boundWheel: (e: WheelEvent) => void;
  unsub: () => void;
  loop: (t: number) => void;

  constructor(canvas: HTMLCanvasElement, hooks: EngineHooks) {
    this.canvas = canvas;
    this.hooks = hooks;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.98;
    this.renderer.setClearColor(0xc07048, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xc07048, 36, 118);
    this.scene.background = new THREE.Color(0xc47a52);

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 220);
    this.scene.add(createGround());

    const hemi = new THREE.HemisphereLight(0xf0c8a0, 0x8a3a28, 0.95);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffd4a0, 1.85);
    sun.position.set(22, 38, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 4;
    sun.shadow.camera.far = 110;
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40;
    sun.shadow.camera.bottom = -40;
    sun.shadow.bias = -0.0008;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x6a88b0, 0.35);
    fill.position.set(-16, 10, -12);
    this.scene.add(fill);

    this.player = createPlayer();
    this.scene.add(this.player);

    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(1.05, 1.28, 28),
      new THREE.MeshBasicMaterial({
        color: 0x4f8f7c,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.y = 0.08;
    this.scene.add(this.marker);

    this.rebuildBuildings();
    this.rebuildAgents();

    this.boundKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
      if (e.code === "KeyE") this.interact();
      if (e.code === "KeyF") this.setView(this.view === "walk" ? "fly" : "walk");
    };
    this.boundKeyUp = (e) => this.keys.delete(e.code);
    this.boundBlur = () => this.keys.clear();
    this.boundResize = () => this.resize();
    this.boundPointerDown = (e) => this.onPointerDown(e);
    this.boundPointerMove = (e) => this.onPointerMove(e);
    this.boundPointerUp = (e) => this.onPointerUp(e);
    this.boundWheel = (e) => {
      if (this.view !== "fly") return;
      e.preventDefault();
      this.fly.dist = Math.max(12, Math.min(72, this.fly.dist * (1 + e.deltaY * 0.0012)));
    };

    window.addEventListener("keydown", this.boundKeyDown);
    window.addEventListener("keyup", this.boundKeyUp);
    window.addEventListener("blur", this.boundBlur);
    window.addEventListener("resize", this.boundResize);
    canvas.addEventListener("pointerdown", this.boundPointerDown);
    window.addEventListener("pointermove", this.boundPointerMove);
    window.addEventListener("pointerup", this.boundPointerUp);
    canvas.addEventListener("wheel", this.boundWheel, { passive: false });

    this.unsub = useDistrict.subscribe(() => {
      this.rebuildBuildings();
      this.syncAgentsFromStore();
    });

    this.resize();

    this.loop = (t) => {
      if (!this.running) return;
      const delta = Math.min((t - this.last) / 1000 || 0.016, 0.1);
      this.last = t;
      this.update(delta);
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(this.loop);
    };

    window.__controlsTest = {
      getYaw: () => this.yaw,
      getSpeed: () => this.speed,
      setSteer: (v) => {
        this.steerOverride = v;
      },
      setKeys: (codes) => {
        this.injected = codes;
        if (codes.length === 0) this.steerOverride = null;
      },
    };
    window.__nexus = {
      placeAt: (gx, gz) => this.placeAt(gx, gz),
      interact: () => this.interact(),
      setView: (v) => this.setView(v),
      getView: () => this.view,
      importWork: (raw) => {
        const b = useDistrict.getState().importWork(raw);
        return b?.id ?? null;
      },
      exportWorks: () =>
        useDistrict.getState().buildings
          .filter((b) => b.slug && b.domain && b.domain !== "civic")
          .map((b) => ({
            nexusWork: 1 as const,
            title: b.title,
            blurb: b.blurb,
            domain: b.domain,
            status: b.status,
            look: b.look,
            race: b.race,
            usableBy: b.usableBy,
            links: b.links ?? [],
          })),
    };
  }

  start() {
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.loop);
  }

  dispose() {
    this.running = false;
    window.removeEventListener("keydown", this.boundKeyDown);
    window.removeEventListener("keyup", this.boundKeyUp);
    window.removeEventListener("blur", this.boundBlur);
    window.removeEventListener("resize", this.boundResize);
    this.canvas.removeEventListener("pointerdown", this.boundPointerDown);
    window.removeEventListener("pointermove", this.boundPointerMove);
    window.removeEventListener("pointerup", this.boundPointerUp);
    this.canvas.removeEventListener("wheel", this.boundWheel);
    this.unsub();
    this.renderer.dispose();
    if (window.__controlsTest) delete window.__controlsTest;
    if (window.__nexus) delete window.__nexus;
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  setJoystick(throttle: number, steer: number) {
    this.joy.throttle = throttle;
    this.joy.steer = steer;
  }

  setMode(mode: "explore" | "build") {
    this.mode = mode;
    this.updateGhost();
  }

  setView(view: CameraView) {
    if (view === this.view) return;
    if (view === "fly") {
      this.fly.tx = this.px;
      this.fly.tz = this.pz;
      this.fly.yaw = this.yaw;
      if (this.fly.dist < 28) this.fly.dist = 38;
      this.speed = 0;
    } else {
      const { x, z } = this.landPoint();
      this.px = x;
      this.pz = z;
      this.yaw = this.fly.yaw;
      this.speed = 0;
    }
    this.view = view;
    this.updateGhost();
    this.hooks.onHud(this.readHud());
  }

  setBuildKind(kind: BuildingKind | null) {
    this.buildKind = kind;
    this.updateGhost();
  }

  focusOn(x: number, z: number) {
    if (this.view === "fly") {
      this.fly.tx = x;
      this.fly.tz = z;
    }
  }

  interact() {
    const agent = this.nearestAgent(3.6);
    const bld = this.nearestBuilding(3.6);
    if (agent && (!bld || agent.dist <= bld.dist)) {
      this.hooks.onOpenAgent(agent.id);
      return;
    }
    if (bld) this.hooks.onOpenBuilding(bld.id);
  }

  nearestBuilding(maxDist: number) {
    let best: { id: string; dist: number } | null = null;
    const ox = this.view === "fly" ? this.fly.tx : this.px;
    const oz = this.view === "fly" ? this.fly.tz : this.pz;
    for (const b of useDistrict.getState().buildings) {
      const w = cellToWorld(b.gx, b.gz);
      const d = Math.hypot(w.x - ox, w.z - oz);
      if (d < maxDist && (!best || d < best.dist)) best = { id: b.id, dist: d };
    }
    return best;
  }

  nearestAgent(maxDist: number) {
    let best: { id: string; dist: number } | null = null;
    const ox = this.view === "fly" ? this.fly.tx : this.px;
    const oz = this.view === "fly" ? this.fly.tz : this.pz;
    for (const a of this.agents) {
      const d = Math.hypot(a.x - ox, a.z - oz);
      if (d < maxDist && (!best || d < best.dist)) best = { id: a.id, dist: d };
    }
    return best;
  }

  nearestBuildingId(maxDist: number) {
    return this.nearestBuilding(maxDist)?.id ?? null;
  }

  private landPoint() {
    const half = ((GRID - 1) / 2) * CELL + 4;
    let x = this.fly.tx;
    let z = this.fly.tz;
    if (this.blocked(x, z)) {
      for (const [dx, dz] of [
        [2, 0],
        [-2, 0],
        [0, 2],
        [0, -2],
        [3, 3],
      ]) {
        if (!this.blocked(x + dx!, z + dz!)) {
          x += dx!;
          z += dz!;
          break;
        }
      }
    }
    return {
      x: Math.max(-half, Math.min(half, x)),
      z: Math.max(-half, Math.min(half, z)),
    };
  }

  private held(): Set<string> {
    if (this.injected) return new Set(this.injected);
    return this.keys;
  }

  private update(dt: number) {
    const held = this.held();
    let throttle = this.joy.throttle;
    let steer = this.joy.steer;
    if (held.has("KeyW") || held.has("ArrowUp")) throttle += 1;
    if (held.has("KeyS") || held.has("ArrowDown")) throttle -= 1;
    if (held.has("KeyA") || held.has("ArrowLeft")) steer += 1;
    if (held.has("KeyD") || held.has("ArrowRight")) steer -= 1;
    throttle = Math.max(-1, Math.min(1, throttle));
    steer = Math.max(-1, Math.min(1, steer));
    if (this.steerOverride != null) steer = this.steerOverride;

    if (this.view === "fly") {
      this.updateFly(dt, throttle, steer);
    } else {
      this.updateWalk(dt, throttle, steer);
    }

    this.updateGems(dt);
    this.updateGhost();
    this.animateBuildings(dt);
    this.workPulse += dt;
    if (this.workPulse > 0.1) {
      this.workPulse = 0;
      this.hooks.onHud(this.readHud());
    }
  }

  private updateWalk(dt: number, throttle: number, steer: number) {
    const target = throttle * MAX_SPEED;
    const accel = throttle !== 0 ? 22 : 16;
    if (this.speed < target) this.speed = Math.min(target, this.speed + accel * dt);
    else this.speed = Math.max(target, this.speed - accel * dt);

    const speedFactor = Math.max(0.45, Math.min(1, Math.abs(this.speed) / MAX_SPEED));
    const reverse = this.speed >= 0 ? 1 : -1;
    this.yaw += steer * TURN_RATE * speedFactor * reverse * dt;

    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    let nx = this.px + fx * this.speed * dt;
    let nz = this.pz + fz * this.speed * dt;
    const hit = this.blocked(nx, nz);
    if (hit) {
      if (!this.blocked(nx, this.pz)) nz = this.pz;
      else if (!this.blocked(this.px, nz)) nx = this.px;
      else {
        nx = this.px;
        nz = this.pz;
        this.speed *= 0.4;
      }
    }
    this.px = nx;
    this.pz = nz;

    const half = ((GRID - 1) / 2) * CELL + 4;
    this.px = Math.max(-half, Math.min(half, this.px));
    this.pz = Math.max(-half, Math.min(half, this.pz));

    this.player.position.set(this.px, 0, this.pz);
    this.player.rotation.y = this.yaw + Math.PI;
    const bob = Math.sin(performance.now() / 180) * 0.03 * (Math.abs(this.speed) / MAX_SPEED);
    this.player.position.y = bob;

    this.updateWalkCamera(dt, fx, fz);
  }

  private updateFly(dt: number, throttle: number, steer: number) {
    const panF = throttle;
    const panR = -steer;
    const fx = -Math.sin(this.fly.yaw);
    const fz = -Math.cos(this.fly.yaw);
    const rx = Math.cos(this.fly.yaw);
    const rz = -Math.sin(this.fly.yaw);
    const spd = 14 + this.fly.dist * 0.35;
    this.fly.tx += (fx * panF + rx * panR) * spd * dt;
    this.fly.tz += (fz * panF + rz * panR) * spd * dt;
    const half = ((GRID - 1) / 2) * CELL + 8;
    this.fly.tx = Math.max(-half, Math.min(half, this.fly.tx));
    this.fly.tz = Math.max(-half, Math.min(half, this.fly.tz));

    const dist = this.fly.dist;
    const yaw = this.fly.yaw;
    const pitch = this.fly.pitch;
    this.tmpCam.set(
      this.fly.tx + Math.sin(yaw) * Math.cos(pitch) * dist,
      Math.sin(pitch) * dist,
      this.fly.tz + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    this.camera.position.lerp(this.tmpCam, 1 - Math.exp(-dt * 8));
    this.tmpLook.set(this.fly.tx, 0.5, this.fly.tz);
    this.camera.lookAt(this.tmpLook);

    this.player.position.set(this.px, 0, this.pz);
    this.player.rotation.y = this.yaw + Math.PI;
  }

  private updateWalkCamera(dt: number, fx: number, fz: number) {
    const follow = this.mode === "build" ? 16 : 9.5;
    const height = this.mode === "build" ? 12.5 : 5.6;
    const lookLift = this.mode === "build" ? 0.4 : 1.15;
    this.tmpCam.set(this.px - fx * follow, height, this.pz - fz * follow);
    this.camera.position.lerp(this.tmpCam, 1 - Math.exp(-dt * 6));
    this.tmpLook.set(this.px, lookLift, this.pz);
    this.camera.lookAt(this.tmpLook);
  }

  private blocked(x: number, z: number) {
    for (const b of useDistrict.getState().buildings) {
      const w = cellToWorld(b.gx, b.gz);
      if (Math.hypot(w.x - x, w.z - z) < 1.65) return true;
    }
    return false;
  }

  private rebuildBuildings() {
    const live = useDistrict.getState().buildings;
    const seen = new Set<string>();
    for (const b of live) {
      seen.add(b.id);
      const sig = `${b.look}|${b.status}|${b.kind}|${b.title}|${b.domain ?? ""}`;
      const prev = this.buildingMeshes.get(b.id);
      if (prev && prev.userData.sig === sig) continue;
      if (prev) {
        this.scene.remove(prev);
        this.buildingMeshes.delete(b.id);
      }
      const m = createWorkBuilding(b);
      const w = cellToWorld(b.gx, b.gz);
      m.position.set(w.x, 0, w.z);
      m.userData.buildingId = b.id;
      m.userData.sig = sig;
      if (!prev) {
        m.userData.raise = 0;
        m.scale.set(1, 0.12, 1);
      } else {
        m.userData.raise = 1;
      }
      this.scene.add(m);
      this.buildingMeshes.set(b.id, m);
    }
    for (const [id, mesh] of this.buildingMeshes) {
      if (seen.has(id)) continue;
      this.scene.remove(mesh);
      this.buildingMeshes.delete(id);
    }
  }

  private animateBuildings(dt: number) {
    this.simT += dt;
    const t = this.simT;
    for (const mesh of this.buildingMeshes.values()) {
      const raise = mesh.userData.raise as number | undefined;
      if (raise != null && raise < 1) {
        const next = Math.min(1, raise + dt * 0.85);
        mesh.userData.raise = next;
        const y = 0.12 + 0.88 * (next * next * (3 - 2 * next));
        mesh.scale.set(1, y, 1);
      }
      mesh.traverse((o) => {
        const d = o.userData as { spin?: number; spinZ?: number; bob?: number; bobPhase?: number; baseY?: number };
        if (d.spin) o.rotation.y += d.spin * dt;
        if (d.spinZ) o.rotation.z += d.spinZ * dt;
        if (d.bob) {
          if (d.baseY == null) d.baseY = o.position.y;
          o.position.y = d.baseY + Math.sin(t * 1.6 + (d.bobPhase || 0)) * 0.14;
        }
      });
    }
  }

  private rebuildAgents() {
    for (const g of this.agents) this.scene.remove(g.mesh);
    this.agents = [];
    this.syncAgentsFromStore();
  }

  private syncAgentsFromStore() {
    const saved = useDistrict.getState().agents;
    const have = new Set(this.agents.map((g) => g.id));
    for (const s of saved) {
      const existing = this.agents.find((g) => g.id === s.id);
      if (existing) {
        existing.name = s.name;
        existing.task = s.task;
        existing.jobsDone = s.jobsDone;
        existing.kind = s.kind ?? existing.kind;
        existing.duty = s.duty ?? existing.duty;
        existing.homeId = s.homeId ?? existing.homeId;
        if (s.assignedId && existing.targetId !== s.assignedId) {
          existing.assigned = true;
          existing.targetId = s.assignedId;
          existing.duty = s.duty ?? "build";
        }
        continue;
      }
      if (have.has(s.id)) continue;
      const homeB = s.homeId ? useDistrict.getState().buildings.find((b) => b.id === s.homeId) : undefined;
      const mesh = createAgent(s.race, homeB?.domain, s.kind ?? "agent");
      mesh.userData.agentId = s.id;
      const hatch = useDistrict.getState().buildings.find((b) => b.kind === "hatchery");
      const core = useDistrict.getState().buildings.find((b) => b.kind === "core");
      const home = homeB ?? hatch ?? core;
      const w = home ? cellToWorld(home.gx, home.gz) : { x: 2, z: 2 };
      const ang = Math.random() * Math.PI * 2;
      const assigned = Boolean(s.assignedId);
      const rt: AgentRuntime = {
        id: s.id,
        race: s.race,
        name: s.name,
        task: s.task,
        kind: s.kind ?? "agent",
        duty: s.duty ?? "file",
        mesh,
        x: w.x + Math.cos(ang) * 2.4,
        z: w.z + Math.sin(ang) * 2.4,
        yaw: ang,
        job: "idle",
        targetId: s.assignedId ?? home?.id ?? null,
        path: [],
        workT: 0,
        cooldown: Math.random() * 1.2,
        assigned,
        jobsDone: s.jobsDone,
        fileId: null,
        homeId: s.homeId ?? null,
      };
      mesh.position.set(rt.x, 0, rt.z);
      this.scene.add(mesh);
      this.agents.push(rt);
    }
    const keep = new Set(saved.map((g) => g.id));
    this.agents = this.agents.filter((g) => {
      if (keep.has(g.id)) return true;
      this.scene.remove(g.mesh);
      return false;
    });
  }

  private occupancy(): boolean[][] {
    const grid = Array.from({ length: GRID }, () => Array<boolean>(GRID).fill(false));
    for (const b of useDistrict.getState().buildings) {
      if (grid[b.gz]) grid[b.gz]![b.gx] = true;
    }
    return grid;
  }

  private pickWorkTarget(g: AgentRuntime): string | null {
    const buildings = useDistrict.getState().buildings;
    if (buildings.length === 0) return null;
    if (g.assigned && g.targetId) return g.targetId;
    if (g.duty === "build") {
      const sites = buildings.filter(
        (b) =>
          b.kind !== "core" &&
          b.kind !== "hatchery" &&
          (b.status === "incomplete" || b.status === "talked" || ((b.progress ?? 100) < 100 && b.status !== "works")),
      );
      if (g.homeId && sites.some((b) => b.id === g.homeId)) return g.homeId;
      if (sites.length) return sites[Math.floor(Math.random() * sites.length)]!.id;
    }
    if (g.duty === "patrol") {
      return g.homeId ?? buildings.find((b) => b.kind === "core")?.id ?? null;
    }
    if (g.homeId && Math.random() < 0.55) return g.homeId;
    const withFiles = buildings.filter((b) => b.items.some((i) => i.kind === "file" || (i.additions?.length ?? 0) > 0));
    const work = buildings.filter((b) => isWorkKind(b.kind));
    const prefer = withFiles.length ? withFiles : work.length ? work : buildings.filter((b) => b.kind !== "core");
    const byRace =
      g.race === "claude"
        ? prefer.filter((b) => b.kind === "archive" || b.kind === "app" || b.kind === "design")
        : g.race === "grok"
          ? prefer.filter((b) => b.kind === "app" || b.kind === "system" || b.kind === "archive" || b.kind === "foundry")
          : g.race === "gemini"
            ? prefer.filter((b) => b.kind === "system" || b.kind === "archive" || b.kind === "app")
            : prefer.filter((b) => b.kind === "app" || b.kind === "design" || b.kind === "archive" || b.kind === "needle");
    const pool = byRace.length ? byRace : prefer.length ? prefer : buildings;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    return pick?.id ?? null;
  }

  private pathToBuilding(g: AgentRuntime, id: string) {
    const b = useDistrict.getState().buildings.find((x) => x.id === id);
    if (!b) return;
    const from = worldToCell(g.x, g.z);
    const occ = this.occupancy();
    const adj = neighbors(b.gx, b.gz).filter((p) => !occ[p.gz]![p.gx]);
    const goal = adj[0] ?? { gx: b.gx, gz: b.gz };
    const cells = findPath(occ, from, goal);
    g.path = cells.map((c) => {
      const w = cellToWorld(c.gx, c.gz);
      return { x: w.x, z: w.z };
    });
    if (g.path.length) g.job = "walk";
    else g.job = "work";
  }

  private updateGems(dt: number) {
    const buildings = useDistrict.getState().buildings;
    for (const g of this.agents) {
      g.cooldown -= dt;
      if (g.job === "idle") {
        if (g.cooldown <= 0) {
          const id = g.targetId ?? this.pickWorkTarget(g);
          if (id) {
            g.targetId = id;
            if (!g.fileId) {
              const b = useDistrict.getState().buildings.find((x) => x.id === id);
              const file = b?.items.find((i) => i.kind === "file") ?? b?.items[0];
              g.fileId = file?.id ?? null;
            }
            this.pathToBuilding(g, id);
          } else g.cooldown = 1.2;
        }
      } else if (g.job === "walk") {
        const step = g.path[0];
        if (!step) {
          g.job = "work";
          g.workT = 0;
        } else {
          const dx = step.x - g.x;
          const dz = step.z - g.z;
          const dist = Math.hypot(dx, dz);
          const spd = 3.4;
          if (dist < 0.12) g.path.shift();
          else {
            const nx = dx / dist;
            const nz = dz / dist;
            g.x += nx * spd * dt;
            g.z += nz * spd * dt;
            g.yaw = Math.atan2(-nx, -nz);
          }
        }
      } else if (g.job === "work") {
        g.workT += dt;
        const b = buildings.find((x) => x.id === g.targetId);
        if (b) {
          const w = cellToWorld(b.gx, b.gz);
          const dx = w.x - g.x;
          const dz = w.z - g.z;
          if (Math.hypot(dx, dz) > 0.05) g.yaw = Math.atan2(-dx, -dz);
        }
        if (g.workT > 3.2) {
          const yieldAmt = b?.kind === "reactor" ? 8 : 3;
          const lotId = g.targetId;
          if (g.duty === "build" && b) {
            const result = useDistrict.getState().advanceBuild(b.id, 16);
            this.writeNote(g, b, result.note);
            useDistrict.getState().recordJob(g.id, result.finished ? 12 : yieldAmt);
            sfxWork();
            this.lastNote = { at: performance.now(), agent: g.name, race: g.race, file: result.note };
            if (result.finished || result.blocked) {
              g.assigned = false;
              useDistrict.getState().setDuty(g.id, g.duty, null);
              g.job = "idle";
              g.targetId = null;
              g.fileId = null;
              g.cooldown = 1.1;
            } else {
              g.workT = 0;
            }
            const other = this.agents.find(
              (o) => o.id !== g.id && lotId && o.targetId === lotId && o.job === "work" && o.race !== g.race,
            );
            if (other && Math.random() < 0.4) useDistrict.getState().crewToCrew(g.id, other.id);
          } else {
            this.writeToFile(g, b);
            useDistrict.getState().recordJob(g.id, yieldAmt);
            sfxWork();
            if (g.assigned && g.targetId && g.fileId) {
              g.assigned = false;
              g.fileId = null;
              g.job = "idle";
              g.targetId = null;
              g.cooldown = 0.8;
            } else if (g.assigned && g.targetId) {
              g.workT = 0;
            } else {
              g.job = "idle";
              g.targetId = null;
              g.fileId = null;
              g.cooldown = 0.6 + Math.random() * 1.4;
            }
            const other = this.agents.find(
              (o) => o.id !== g.id && lotId && o.targetId === lotId && o.job === "work" && o.race !== g.race,
            );
            if (other && Math.random() < 0.35) useDistrict.getState().crewToCrew(g.id, other.id);
          }
        }
      }

      const hover =
        g.kind === "gem"
          ? 0.28 + Math.sin(performance.now() / 420 + g.x) * 0.08
          : Math.sin(performance.now() / 220 + g.x) * 0.03;
      g.mesh.position.set(g.x, hover, g.z);
      g.mesh.rotation.y = g.yaw + Math.PI;
      const armL = g.mesh.getObjectByName("armL");
      const armR = g.mesh.getObjectByName("armR");
      const swing = g.job === "walk" ? Math.sin(performance.now() / 120) * 0.45 : 0;
      if (armL) armL.rotation.x = swing;
      if (armR) armR.rotation.x = -swing;
    }
  }

  assignAgent(id: string, buildingId: string, fileId?: string, duty?: Duty) {
    const g = this.agents.find((x) => x.id === id);
    if (!g) return;
    const nextDuty: Duty = duty ?? (fileId ? "file" : "build");
    g.assigned = true;
    g.targetId = buildingId;
    g.fileId = fileId ?? null;
    g.duty = nextDuty;
    const b = useDistrict.getState().buildings.find((x) => x.id === buildingId);
    const file = fileId ? useDistrict.getState().findItem(fileId)?.item : undefined;
    useDistrict.getState().setDuty(id, nextDuty, buildingId);
    if (file) {
      useDistrict.getState().setAgentTask(id, `Adding to ${file.name}`);
      g.task = `Adding to ${file.name}`;
    } else if (b && nextDuty === "build") {
      const task = `Completing ${buildingTitle(b)}`;
      useDistrict.getState().setAgentTask(id, task);
      g.task = task;
    } else if (b) {
      const task = agentJobLabel({
        job: "work",
        race: g.race,
        task: "",
        targetTitle: buildingTitle(b),
        targetKind: b.kind,
      });
      useDistrict.getState().setAgentTask(id, task);
      g.task = task;
    }
    this.pathToBuilding(g, buildingId);
  }

  sendRaceToFile(race: Race, buildingId: string, itemId: string) {
    const pool = this.agents.filter((a) => a.race === race);
    const pick = pool.find((a) => a.job === "idle") ?? pool[0];
    if (!pick) return false;
    this.assignAgent(pick.id, buildingId, itemId);
    return true;
  }

  sendAllRacesToFile(buildingId: string, itemId: string) {
    for (const race of ["claude", "grok", "gemini", "meta"] as Race[]) {
      this.sendRaceToFile(race, buildingId, itemId);
    }
  }

  private writeNote(g: AgentRuntime, b: PlacedBuilding, text: string) {
    const store = useDistrict.getState();
    const existing = b.items[0]?.id;
    const row = {
      race: g.race,
      agentId: g.id,
      agentName: g.name,
      text,
    };
    if (existing) {
      store.addToFile(b.id, existing, row);
      return;
    }
    store.addItem(b.id, { kind: "note", name: "Work log", detail: "Crew notes." });
    const fresh = store.buildings.find((x) => x.id === b.id)?.items[0]?.id;
    if (fresh) store.addToFile(b.id, fresh, row);
  }

  private writeToFile(g: AgentRuntime, b: PlacedBuilding | undefined) {
    const store = useDistrict.getState();
    let found = g.fileId ? store.findItem(g.fileId) : undefined;
    if (!found && b) {
      const file = b.items.find((i) => i.kind === "file") ?? b.items[0];
      if (file) found = { building: b, item: file };
    }
    if (!found) {
      const archive = store.buildings.find((x) => x.kind === "archive");
      const file = archive?.items.find((i) => i.kind === "file") ?? archive?.items[0];
      if (archive && file) found = { building: archive, item: file };
    }
    if (!found) {
      if (!b) return;
      store.addItem(b.id, { kind: "note", name: "Work log", detail: "Four races write here." });
      const fresh = store.buildings.find((x) => x.id === b.id)?.items[0];
      if (!fresh) return;
      found = { building: b, item: fresh };
    }
    if ((found.item.additions?.length ?? 0) > 24 && !g.assigned) return;
    const text = raceAddition(g.race, found.item.name, buildingTitle(found.building));
    const row = store.addToFile(found.building.id, found.item.id, {
      race: g.race,
      agentId: g.id,
      agentName: g.name,
      text,
    });
    if (row) {
      this.lastNote = { at: performance.now(), agent: g.name, race: g.race, file: found.item.name };
    }
  }

  private updateGhost() {
    if (this.mode !== "build" || !this.buildKind) {
      if (this.ghost) this.ghost.visible = false;
      const mat = this.marker.material as THREE.MeshBasicMaterial;
      mat.opacity = 0;
      return;
    }
    const aim =
      this.view === "fly"
        ? { x: this.fly.tx, z: this.fly.tz }
        : {
            x: this.px - Math.sin(this.yaw) * 5.2,
            z: this.pz - Math.cos(this.yaw) * 5.2,
          };
    const { gx, gz } = worldToCell(aim.x, aim.z);
    const w = cellToWorld(gx, gz);
    if (!this.ghost || this.ghost.userData.kind !== this.buildKind) {
      if (this.ghost) this.scene.remove(this.ghost);
      this.ghost = createGhost(this.buildKind);
      this.ghost.userData.kind = this.buildKind;
      this.scene.add(this.ghost);
    }
    this.ghost.visible = true;
    this.ghost.position.set(w.x, 0, w.z);
    const free = !useDistrict.getState().occupy(gx, gz);
    this.ghost.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material && !Array.isArray(o.material)) {
        (o.material as THREE.MeshStandardMaterial).color.set(free ? 0x4f8f7c : 0xaa5555);
      }
    });
    this.marker.position.set(w.x, 0.08, w.z);
    (this.marker.material as THREE.MeshBasicMaterial).opacity = 0.85;
    (this.marker.material as THREE.MeshBasicMaterial).color.set(free ? 0x4f8f7c : 0xaa5555);
  }

  placeAhead() {
    const aim =
      this.view === "fly"
        ? { x: this.fly.tx, z: this.fly.tz }
        : {
            x: this.px - Math.sin(this.yaw) * 5.2,
            z: this.pz - Math.cos(this.yaw) * 5.2,
          };
    const { gx, gz } = worldToCell(aim.x, aim.z);
    return this.placeAt(gx, gz);
  }

  placeAt(gx: number, gz: number) {
    if (!this.buildKind) return false;
    const b = useDistrict.getState().place(this.buildKind, gx, gz);
    if (!b) return false;
    sfxPlace();
    this.hooks.onPlaced(b);
    return true;
  }

  private onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    this.drag = { down: true, sx: e.clientX, sy: e.clientY, moved: false, pointerId: e.pointerId };
  }

  private onPointerMove(e: PointerEvent) {
    if (!this.drag.down) return;
    const dx = e.clientX - this.drag.sx;
    const dy = e.clientY - this.drag.sy;
    if (Math.hypot(dx, dy) > 8) this.drag.moved = true;
    if (this.drag.moved) {
      if (this.view === "fly") {
        this.fly.yaw -= dx * 0.005;
        this.fly.pitch = Math.max(0.28, Math.min(1.28, this.fly.pitch + dy * 0.004));
      } else {
        this.yaw -= dx * 0.005;
      }
      this.drag.sx = e.clientX;
      this.drag.sy = e.clientY;
    }
  }

  private onPointerUp(e: PointerEvent) {
    if (!this.drag.down) return;
    const wasDrag = this.drag.moved;
    this.drag.down = false;
    if (wasDrag) return;
    this.handleTap(e.clientX, e.clientY);
  }

  private handleTap(cx: number, cy: number) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((cx - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((cy - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const agentMeshes = this.agents.map((g) => g.mesh);
    const agentHits = this.raycaster.intersectObjects(agentMeshes, true);
    if (agentHits[0]) {
      let obj: THREE.Object3D | null = agentHits[0].object;
      while (obj && !obj.userData.agentId) obj = obj.parent;
      if (obj?.userData.agentId) {
        this.hooks.onOpenAgent(obj.userData.agentId as string);
        return;
      }
    }

    const bMeshes = [...this.buildingMeshes.values()];
    const bHits = this.raycaster.intersectObjects(bMeshes, true);
    if (bHits[0]) {
      let obj: THREE.Object3D | null = bHits[0].object;
      while (obj && !obj.userData.buildingId) obj = obj.parent;
      if (obj?.userData.buildingId) {
        this.hooks.onOpenBuilding(obj.userData.buildingId as string);
        return;
      }
    }

    if (this.mode === "build" && this.buildKind) {
      if (this.raycaster.ray.intersectPlane(this.groundPlane, this.hit)) {
        const { gx, gz } = worldToCell(this.hit.x, this.hit.z);
        this.placeAt(gx, gz);
      }
    }
  }

  private project(x: number, y: number, z: number, w: number, h: number) {
    this.ndc.set(x, y, z).project(this.camera);
    const visible = this.ndc.z < 1 && this.ndc.x > -1.2 && this.ndc.x < 1.2 && this.ndc.y > -1.2 && this.ndc.y < 1.2;
    return {
      x: (this.ndc.x * 0.5 + 0.5) * w,
      y: (-this.ndc.y * 0.5 + 0.5) * h,
      visible,
    };
  }

  private pins(): WorldPin[] {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const out: WorldPin[] = [];
    const ox = this.view === "fly" ? this.fly.tx : this.px;
    const oz = this.view === "fly" ? this.fly.tz : this.pz;

    const agentRows = this.agents
      .map((a) => ({ a, dist: Math.hypot(a.x - ox, a.z - oz) }))
      .filter((row) => row.dist < (this.view === "fly" ? 38 : 11))
      .sort((x, y) => x.dist - y.dist)
      .slice(0, this.view === "fly" ? 8 : 6);

    for (const { a } of agentRows) {
      const p = this.project(a.x, 1.85, a.z, w, h);
      const b = a.targetId ? useDistrict.getState().buildings.find((x) => x.id === a.targetId) : undefined;
      out.push({
        id: a.id,
        kind: "agent",
        race: a.race,
        title: a.name,
        subtitle: this.jobFor(a, b),
        x: p.x,
        y: p.y,
        visible: p.visible,
      });
    }

    if (this.view === "fly") {
      const rows = useDistrict.getState()
        .buildings
        .map((b) => {
          const ww = cellToWorld(b.gx, b.gz);
          return { b, ww, dist: Math.hypot(ww.x - ox, ww.z - oz) };
        })
        .filter((row) => row.dist < 48)
        .sort((a, c) => a.dist - c.dist)
        .slice(0, 10);
      for (const { b, ww } of rows) {
        const p = this.project(ww.x, 2.6, ww.z, w, h);
        out.push({
          id: b.id,
          kind: "building",
          domain: b.domain,
          title: buildingTitle(b),
          subtitle: b.domain ? DOMAINS[b.domain].name : BUILDINGS[b.kind].name,
          x: p.x,
          y: p.y,
          visible: p.visible,
        });
      }
    }
    return out;
  }

  private jobFor(g: AgentRuntime, b: PlacedBuilding | undefined) {
    return agentJobLabel({
      job: g.job,
      race: g.race,
      task: g.task,
      targetTitle: b ? buildingTitle(b) : null,
      targetKind: b?.kind ?? null,
    });
  }

  readHud(): EngineHud {
    const nearbyA = this.nearestAgent(3.8);
    const nearbyB = this.nearestBuilding(3.8);
    let nearbyId: string | null = null;
    let nearbyLabel: string | null = null;
    let nearbyKind: "building" | "agent" | null = null;
    if (nearbyA && (!nearbyB || nearbyA.dist <= nearbyB.dist)) {
      const a = this.agents.find((x) => x.id === nearbyA.id);
      if (a) {
        nearbyId = a.id;
        nearbyKind = "agent";
        const b = a.targetId ? useDistrict.getState().buildings.find((x) => x.id === a.targetId) : undefined;
        nearbyLabel = `${a.name} · ${this.jobFor(a, b)}`;
      }
    } else if (nearbyB) {
      const b = useDistrict.getState().buildings.find((x) => x.id === nearbyB.id);
      if (b) {
        nearbyId = b.id;
        nearbyKind = "building";
        nearbyLabel = buildingTitle(b);
      }
    }
    const aim =
      this.view === "fly"
        ? { x: this.fly.tx, z: this.fly.tz }
        : {
            x: this.px - Math.sin(this.yaw) * 5.2,
            z: this.pz - Math.cos(this.yaw) * 5.2,
          };
    const { gx, gz } = worldToCell(aim.x, aim.z);
    const canPlace =
      this.mode === "build" &&
      !!this.buildKind &&
      !useDistrict.getState().occupy(gx, gz) &&
      useDistrict.getState().energy >= (this.buildKind ? BUILDINGS[this.buildKind].cost : 9999);
    return {
      nearbyId,
      nearbyLabel,
      nearbyKind,
      canPlace,
      hoverGx: gx,
      hoverGz: gz,
      jobsLive: this.agents.filter((g) => g.job === "work").length,
      playerX: this.px,
      playerZ: this.pz,
      playerYaw: this.yaw,
      playerSpeed: this.speed,
      view: this.view,
      pins: this.pins(),
      lastNote:
        this.lastNote && performance.now() - this.lastNote.at < 5200
          ? { agent: this.lastNote.agent, race: this.lastNote.race, file: this.lastNote.file }
          : null,
    };
  }

  agentInfo(id: string) {
    const g = this.agents.find((x) => x.id === id);
    if (!g) return null;
    const def = RACES[g.race];
    const target = g.targetId ? useDistrict.getState().buildings.find((b) => b.id === g.targetId) : undefined;
    return {
      id: g.id,
      race: g.race,
      name: g.name,
      role: def.role,
      raceName: def.name,
      job: g.job,
      jobLabel: this.jobFor(g, target),
      task: g.task,
      jobsDone: g.jobsDone,
      assigned: g.assigned,
      kind: g.kind,
      duty: g.duty,
      kindLabel: POP_LABEL[g.kind],
      targetName: target ? buildingTitle(target) : null,
      targetId: g.targetId,
      homeId: g.homeId,
      homeName: g.homeId
        ? (useDistrict.getState().buildings.find((b) => b.id === g.homeId)
          ? buildingTitle(useDistrict.getState().buildings.find((b) => b.id === g.homeId)!)
          : null)
        : null,
      fileName: g.fileId ? (useDistrict.getState().findItem(g.fileId)?.item.name ?? null) : null,
    };
  }

  gemInfo(id: string) {
    return this.agentInfo(id);
  }
}
