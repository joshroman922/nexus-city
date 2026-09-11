import * as THREE from "three";
import { cellToWorld, CELL, INFRA } from "@/lib/census";
import { RACE_HEX, silhouette, stageOf } from "@/lib/honest";
import type { CrewMember, Lot, Race } from "@/lib/types";

export type RenderMod = {
  id: string;
  title: string;
  gx: number;
  gz: number;
  race: Race | null;
  status: string;
  truth: string;
  files: string[];
  open: string | null;
  raise: number;
  look: string | null;
  kind: "lot" | "infra";
  archiveLen: number;
  archive?: { length: number };
};

export type StationSync = {
  modules: RenderMod[];
  crew: CrewMember[];
  lots: Lot[];
  selectedId: string | null;
  mode: "orbit" | "eva";
};

type Hooks = {
  onSelect: (id: string | null, kind: "lot" | "infra" | "crew") => void;
};

const FORWARD = new THREE.Vector3();
const RIGHT = new THREE.Vector3();
const TMP = new THREE.Vector3();
const NDC = new THREE.Vector2();
const RAY = new THREE.Raycaster();

function hash(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export function mountStation(canvas: HTMLCanvasElement, hooks: Hooks) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x1a0e0a, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a1610);
  scene.fog = new THREE.Fog(0x2a1610, 55, 160);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 280);
  camera.position.set(18, 14, 22);

  scene.add(new THREE.HemisphereLight(0xc4a07a, 0x3a1810, 0.7));
  const sun = new THREE.DirectionalLight(0xffd0a0, 1.7);
  sun.position.set(48, 28, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 4;
  sun.shadow.camera.far = 160;
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x402418, 0.35));

  const mats = makeMaterials();
  buildTerrain(scene, mats);
  buildScenery(scene, mats);

  const world = new THREE.Group();
  scene.add(world);
  const moduleRoot = new THREE.Group();
  world.add(moduleRoot);
  const crewRoot = new THREE.Group();
  world.add(crewRoot);

  const selectRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.06, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xe8dcc8, transparent: true, opacity: 0.85 }),
  );
  selectRing.rotation.x = Math.PI / 2;
  selectRing.position.y = 0.12;
  selectRing.visible = false;
  world.add(selectRing);

  const moduleMap = new Map<string, THREE.Group>();
  const crewMap = new Map<string, THREE.Group>();

  let mode: "orbit" | "eva" = "orbit";
  let selectedId: string | null = null;
  let uiBlock = false;
  const keys = new Set<string>();
  let injectKeys: string[] | null = null;
  let yaw = 0.4;
  let pitch = -0.32;
  const camPos = new THREE.Vector3(0, 12, 26);
  let speed = 0;
  let orbitT = 0.85;
  let pointerLocked = false;
  const lookDelta = { x: 0, y: 0 };
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const held = () => injectKeys ?? [...keys];

  function setSize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(
      16,
      Math.round(rect.width) || canvas.clientWidth || window.innerWidth || 1280,
    );
    const h = Math.max(
      16,
      Math.round(rect.height) || canvas.clientHeight || window.innerHeight || 800,
    );
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  setSize();
  requestAnimationFrame(setSize);
  const ro = new ResizeObserver(setSize);
  ro.observe(canvas.parentElement || canvas);
  window.addEventListener("resize", setSize);

  function onKey(e: KeyboardEvent, down: boolean) {
    const t = e.target as HTMLElement | null;
    if (t && t.closest("input, textarea, select, [contenteditable]")) return;
    if (down) keys.add(e.code);
    else keys.delete(e.code);
    if (["KeyW", "KeyA", "KeyS", "KeyD", "Space"].includes(e.code)) e.preventDefault();
  }
  const kd = (e: KeyboardEvent) => onKey(e, true);
  const ku = (e: KeyboardEvent) => onKey(e, false);
  window.addEventListener("keydown", kd);
  window.addEventListener("keyup", ku);
  window.addEventListener("blur", () => keys.clear());

  function onMove(e: MouseEvent) {
    if (pointerLocked) {
      lookDelta.x += e.movementX;
      lookDelta.y += e.movementY;
    } else if (dragging) {
      lookDelta.x += e.clientX - lastX;
      lookDelta.y += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  }
  canvas.addEventListener("mousemove", onMove);
  canvas.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    if (mode === "eva" && !uiBlock) canvas.requestPointerLock?.();
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener("mouseup", () => {
    dragging = false;
  });
  document.addEventListener("pointerlockchange", () => {
    pointerLocked = document.pointerLockElement === canvas;
  });

  function pick(ev: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    NDC.set(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1,
    );
    RAY.setFromCamera(NDC, camera);
    const hits = RAY.intersectObjects(world.children, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        const kind = o.userData?.kind as string | undefined;
        if (kind === "crew") {
          hooks.onSelect(o.userData.name, "crew");
          return;
        }
        if (kind === "lot" || kind === "infra") {
          hooks.onSelect(o.userData.id, kind);
          return;
        }
        o = o.parent;
      }
    }
    hooks.onSelect(null, "lot");
  }
  canvas.addEventListener("click", pick);

  function basis() {
    FORWARD.set(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    );
    RIGHT.set(Math.cos(yaw), 0, -Math.sin(yaw));
  }

  function fly(dt: number) {
    const k = new Set(held());
    if (mode !== "eva") return;
    const sens = 0.0022;
    yaw -= lookDelta.x * sens;
    pitch -= lookDelta.y * sens;
    pitch = Math.max(-1.25, Math.min(1.25, pitch));
    lookDelta.x = 0;
    lookDelta.y = 0;

    let steer = 0;
    if (k.has("KeyA") || k.has("ArrowLeft")) steer += 1;
    if (k.has("KeyD") || k.has("ArrowRight")) steer -= 1;
    yaw += steer * 1.6 * dt;

    basis();
    let mx = 0;
    let mz = 0;
    let my = 0;
    if (k.has("KeyW") || k.has("ArrowUp")) mz += 1;
    if (k.has("KeyS") || k.has("ArrowDown")) mz -= 1;
    if (k.has("KeyQ")) mx -= 1;
    if (k.has("KeyE")) mx += 1;
    if (k.has("Space")) my += 1;
    if (k.has("ShiftLeft") || k.has("ShiftRight") || k.has("KeyC") || k.has("ControlLeft")) my -= 1;

    const boost = k.has("ShiftLeft") && mz > 0 ? 1.65 : 1;
    const flySpeed = 16 * boost;
    speed = Math.hypot(mx, mz, my) * flySpeed;

    camPos.addScaledVector(FORWARD, mz * flySpeed * dt);
    camPos.addScaledVector(RIGHT, mx * flySpeed * dt);
    camPos.y += my * flySpeed * dt;
    camPos.y = Math.max(1.6, Math.min(42, camPos.y));
    const r = Math.hypot(camPos.x, camPos.z);
    if (r > 88) {
      camPos.x *= 88 / r;
      camPos.z *= 88 / r;
    }
    camera.position.copy(camPos);
    TMP.copy(camPos).add(FORWARD);
    camera.lookAt(TMP);
  }

  function orbit(dt: number) {
    orbitT += dt * 0.08;
    const r = 26;
    const x = Math.cos(orbitT) * r;
    const z = Math.sin(orbitT) * r;
    camera.position.set(x, 14, z);
    camera.lookAt(0, 1.4, 0);
    lookDelta.x = 0;
    lookDelta.y = 0;
    speed = 0;
  }

  const clock = new THREE.Clock();
  let rafOk = true;

  function tick() {
    if (!rafOk) return;
    const dt = Math.min(clock.getDelta(), 0.1);
    if (mode === "eva") fly(dt);
    else orbit(dt);

    const t = clock.elapsedTime;
    selectRing.rotation.z = t * 0.6;
    selectRing.visible = !!selectedId;
    if (selectedId) {
      const g = moduleMap.get(selectedId);
      if (g) {
        selectRing.position.x = g.position.x;
        selectRing.position.z = g.position.z;
      }
    }

    for (const g of moduleMap.values()) {
      const strobe = g.userData.strobe as THREE.PointLight | undefined;
      if (strobe) strobe.intensity = Math.sin(t * 11 + g.userData.phase) > 0.35 ? 2.4 : 0.15;
      const vents = g.userData.vents as THREE.Object3D | undefined;
      if (vents) vents.scale.y = 1 + Math.sin(t * 3 + g.userData.phase) * 0.12;
      const win = g.userData.windows as THREE.MeshStandardMaterial | undefined;
      if (win && g.userData.flicker) {
        win.emissiveIntensity = 0.3 + (Math.sin(t * 14 + g.userData.phase) > 0 ? 1.1 : 0.05);
      }
    }

    for (const g of crewMap.values()) {
      const baseY = g.userData.baseY as number;
      g.position.y = baseY + Math.sin(t * 2.2 + g.userData.phase) * 0.05;
    }

    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(tick);

  function sync(s: StationSync) {
    mode = s.mode;
    selectedId = s.selectedId;
    const ids = new Set(s.modules.map((m) => m.id));
    for (const [id, g] of moduleMap) {
      if (!ids.has(id)) {
        moduleRoot.remove(g);
        disposeGroup(g);
        moduleMap.delete(id);
      }
    }
    for (const m of s.modules) {
      let g = moduleMap.get(m.id);
      if (!g) {
        g = buildModule(m, mats);
        moduleMap.set(m.id, g);
        moduleRoot.add(g);
      } else {
        restyleModule(g, m, mats);
      }
      const w = cellToWorld(m.gx, m.gz);
      g.position.set(w.x, 0, w.z);
    }

    const crewIds = new Set(s.crew.map((c) => c.name));
    for (const [n, g] of crewMap) {
      if (!crewIds.has(n)) {
        crewRoot.remove(g);
        disposeGroup(g);
        crewMap.delete(n);
      }
    }
    for (const c of s.crew) {
      let g = crewMap.get(c.name);
      if (!g) {
        g = buildCrew(c);
        crewMap.set(c.name, g);
        crewRoot.add(g);
      }
      const pos = crewWorld(c, s.lots);
      g.position.set(pos.x, pos.y, pos.z);
      g.userData.baseY = pos.y;
    }
  }

  function dispose() {
    rafOk = false;
    renderer.setAnimationLoop(null);
    ro.disconnect();
    window.removeEventListener("keydown", kd);
    window.removeEventListener("keyup", ku);
    window.removeEventListener("resize", setSize);
    document.exitPointerLock?.();
    disposeGroup(scene);
    renderer.dispose();
  }

  const handle = {
    dispose,
    sync,
    setUiBlock: (v: boolean) => {
      uiBlock = v;
      if (v) document.exitPointerLock?.();
    },
    setKeys: (codes: string[]) => {
      injectKeys = codes.length ? codes : null;
    },
    getYaw: () => yaw,
    getSpeed: () => speed,
    getPitch: () => pitch,
    setMode: (m: "orbit" | "eva") => {
      mode = m;
      if (m === "eva") {
        camPos.set(0, 9, 22);
        yaw = 0;
        pitch = -0.18;
        basis();
        camera.position.copy(camPos);
      }
    },
  };

  if (typeof window !== "undefined") {
    (window as unknown as { __controlsTest: unknown }).__controlsTest = {
      getYaw: () => handle.getYaw(),
      getSpeed: () => handle.getSpeed(),
      setKeys: (codes: string[]) => handle.setKeys(codes),
    };
  }

  return handle;
}

function crewWorld(c: CrewMember, lots: Lot[]) {
  if (c.assignedTo) {
    const lot = lots.find((l) => l.id === c.assignedTo);
    if (lot) {
      const w = cellToWorld(lot.gx, lot.gz);
      return { x: w.x + 1.55, y: 1.05, z: w.z + 1.7 };
    }
  }
  if (c.duty === "file") {
    const lib = INFRA.find((i) => i.id === "archive-vault") ?? { gx: 6, gz: 7 };
    const w = cellToWorld(lib.gx, lib.gz);
    const i = hash(c.name.length + 3);
    return { x: w.x + (i - 0.5) * 2.4, y: 1.05, z: w.z + 2.2 };
  }
  if (c.duty === "build") {
    const w = cellToWorld(8, 7);
    const i = hash(c.name.length + 7);
    return { x: w.x + (i - 0.5) * 3, y: 1.05, z: w.z + 2.4 };
  }
  const w = cellToWorld(7, 6);
  const a = hash(c.name.charCodeAt(0)) * Math.PI * 2;
  return { x: w.x + Math.cos(a) * 3.2, y: 1.05, z: w.z + Math.sin(a) * 3.2 };
}

type Mats = ReturnType<typeof makeMaterials>;

function makeMaterials() {
  const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.18, ...extra });
  return {
    regolith: std(0x6b2e1c, { roughness: 0.96, metalness: 0.02 }),
    dune: std(0x8a4a32, { roughness: 0.95, metalness: 0.02 }),
    rock: std(0x4a281c, { roughness: 0.98 }),
    hull: std(0x9aa3ab, { metalness: 0.42, roughness: 0.45 }),
    hullDark: std(0x3a3532, { metalness: 0.35, roughness: 0.55 }),
    rust: std(0x6a3a28, { metalness: 0.2, roughness: 0.7 }),
    pad: std(0x4a4038, { metalness: 0.3, roughness: 0.6 }),
    glass: std(0x8fb4c8, {
      transparent: true,
      opacity: 0.38,
      metalness: 0.7,
      roughness: 0.12,
      emissive: 0x223344,
      emissiveIntensity: 0.3,
    }),
    glassLit: std(0xb7d4e4, {
      transparent: true,
      opacity: 0.5,
      metalness: 0.65,
      roughness: 0.1,
      emissive: 0xffd9a0,
      emissiveIntensity: 0.85,
    }),
    scaffold: std(0xc4a574, { metalness: 0.55, roughness: 0.4 }),
    frame: std(0xb8c0c6, { metalness: 0.6, roughness: 0.35 }),
    solar: std(0x1a2430, { metalness: 0.7, roughness: 0.2 }),
    stake: std(0xc8b090),
    crate: std(0x6e5a44, { roughness: 0.7 }),
    strobe: new THREE.MeshStandardMaterial({
      color: 0xff3344,
      emissive: 0xff2244,
      emissiveIntensity: 1.4,
    }),
    window: new THREE.MeshStandardMaterial({
      color: 0xffe2b0,
      emissive: 0xffc878,
      emissiveIntensity: 1.1,
      roughness: 0.3,
    }),
  };
}

function buildTerrain(scene: THREE.Scene, mats: Mats) {
  const geo = new THREE.CircleGeometry(110, 72);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const n =
      Math.sin(x * 0.09) * Math.cos(z * 0.07) * 0.55 + Math.sin(x * 0.31 + z * 0.2) * 0.18;
    pos.setY(i, n - 0.15);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, mats.regolith);
  ground.receiveShadow = true;
  scene.add(ground);

  const rockGeo = new THREE.IcosahedronGeometry(0.55, 0);
  const rocks = new THREE.InstancedMesh(rockGeo, mats.rock, 90);
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 90; i++) {
    const a = hash(i + 1) * Math.PI * 2;
    const r = 18 + hash(i + 9) * 70;
    dummy.position.set(Math.cos(a) * r, 0.15, Math.sin(a) * r);
    const s = 0.4 + hash(i + 4) * 1.8;
    dummy.scale.set(s, s * (0.6 + hash(i + 2)), s);
    dummy.rotation.set(hash(i) * 2, hash(i + 3) * 4, hash(i + 5));
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  scene.add(rocks);

  const dustGeo = new THREE.BufferGeometry();
  const pts = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) {
    pts[i * 3] = (hash(i) - 0.5) * 90;
    pts[i * 3 + 1] = 0.4 + hash(i + 2) * 8;
    pts[i * 3 + 2] = (hash(i + 5) - 0.5) * 90;
  }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
  scene.add(
    new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        color: 0xc48a62,
        size: 0.12,
        transparent: true,
        opacity: 0.35,
      }),
    ),
  );

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const mtn = new THREE.Mesh(
      new THREE.ConeGeometry(10 + hash(i) * 8, 9 + hash(i + 2) * 10, 5),
      mats.dune,
    );
    mtn.position.set(Math.cos(a) * 95, 2.5, Math.sin(a) * 95);
    mtn.rotation.y = a;
    scene.add(mtn);
  }
}

function buildScenery(scene: THREE.Scene, mats: Mats) {
  const farm = new THREE.Group();
  const w = cellToWorld(2, 13);
  farm.position.set(w.x, 0, w.z);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 2; j++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 1.2), mats.solar);
      p.position.set(i * 2.7 - 3.6, 1.1, j * 1.6);
      p.rotation.x = -0.55;
      p.castShadow = true;
      farm.add(p);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), mats.hullDark);
      leg.position.set(i * 2.7 - 3.6, 0.55, j * 1.6 + 0.3);
      farm.add(leg);
    }
  }
  scene.add(farm);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 9, 8), mats.hull);
  const mw = cellToWorld(7, 2);
  mast.position.set(mw.x + 2.4, 4.5, mw.z);
  mast.castShadow = true;
  scene.add(mast);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8, 0, Math.PI), mats.hull);
  dish.position.set(mw.x + 2.4, 8.6, mw.z);
  dish.rotation.x = Math.PI / 2.4;
  scene.add(dish);
}

function box(w: number, h: number, d: number, mat: THREE.Material, y = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.y = y;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function cyl(rt: number, rb: number, h: number, seg: number, mat: THREE.Material, y = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.y = y;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function buildModule(m: RenderMod, mats: Mats): THREE.Group {
  const g = new THREE.Group();
  g.userData.id = m.id;
  g.userData.kind = m.kind;
  g.userData.phase = hash(m.id.length + m.gx * 3 + m.gz);
  restyleModule(g, m, mats);
  return g;
}

function clearChildren(g: THREE.Group) {
  while (g.children.length) {
    const c = g.children[0];
    g.remove(c);
    disposeGroup(c);
  }
}

function restyleModule(g: THREE.Group, m: RenderMod, mats: Mats) {
  const sil =
    m.look && ["ops", "table", "airlock", "spine", "archive", "pad"].includes(m.look)
      ? m.look
      : silhouette({ ...m, archive: { length: m.archiveLen } });
  const stage = m.kind === "infra" && sil !== "pad" ? 3 : stageOf(m);
  const sig = `${sil}|${stage}|${m.status}|${m.race}|${m.truth}`;
  if (g.userData.sig === sig) return;
  g.userData.sig = sig;
  clearChildren(g);
  g.userData.kind = m.kind;
  g.userData.id = m.id;
  g.userData.strobe = undefined;
  g.userData.vents = undefined;
  g.userData.windows = undefined;
  g.userData.flicker = m.truth.includes("Artifact") || m.status === "broken";

  const raceCol = RACE_HEX[m.race ?? "shared"];
  const stripeMat = new THREE.MeshStandardMaterial({
    color: raceCol,
    emissive: raceCol,
    emissiveIntensity: m.status === "works" ? 0.7 : 0.25,
    metalness: 0.4,
    roughness: 0.4,
  });

  g.add(cyl(2.15, 2.15, 0.12, 24, mats.pad, 0.06));

  if (stage <= 0 || sil === "pad") {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const st = box(0.07, 1.1, 0.07, mats.stake, 0.55);
      st.position.set(Math.cos(a) * 1.55, 0.55, Math.sin(a) * 1.55);
      g.add(st);
    }
    if (sil === "pad" && stage <= 0) return;
  }

  if (stage === 1) {
    addScaffold(g, mats);
    if (sil === "crate" || m.truth.includes("File only")) addCrate(g, mats);
    if (g.userData.flicker) addStrobe(g, mats);
    addStripe(g, stripeMat, 1.2);
    return;
  }

  if (stage === 2) {
    addScaffold(g, mats);
    addFrame(g, mats, sil);
    addCables(g, mats);
    addStripe(g, stripeMat, 1.6);
    return;
  }

  addHull(g, mats, sil, m.status === "works");
  addStripe(g, stripeMat, sil === "antenna" ? 3.2 : 2.1);
  if (m.status === "works") {
    const vents = cyl(0.12, 0.12, 0.8, 8, mats.hullDark, 2.6);
    vents.position.x = 0.9;
    g.add(vents);
    g.userData.vents = vents;
  }
  if (g.userData.flicker) addStrobe(g, mats);
}

function addStripe(g: THREE.Group, mat: THREE.Material, y: number) {
  const s = box(1.6, 0.08, 0.12, mat, y);
  s.position.z = 1.05;
  g.add(s);
}

function addScaffold(g: THREE.Group, mats: Mats) {
  const h = 3.2;
  for (const x of [-1.2, 1.2]) {
    for (const z of [-1.2, 1.2]) {
      const post = cyl(0.05, 0.05, h, 5, mats.scaffold, h / 2);
      post.position.set(x, h / 2, z);
      g.add(post);
    }
  }
  g.add(box(2.5, 0.06, 2.5, mats.scaffold, h));
}

function addFrame(g: THREE.Group, mats: Mats, sil: string) {
  const h = sil === "antenna" ? 4.4 : 2.6;
  g.add(box(2.4, h, 2.4, mats.frame, h / 2 + 0.1));
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(2.42, h, 2.42)),
    new THREE.LineBasicMaterial({ color: 0xd7e0e8 }),
  );
  edges.position.y = h / 2 + 0.1;
  g.add(edges);
}

function addCables(g: THREE.Group, mats: Mats) {
  for (let i = 0; i < 3; i++) {
    const c = cyl(0.03, 0.03, 1.8, 5, mats.rust, 0.7);
    c.position.set(-1.4 + i * 0.3, 0.9, 1.3);
    c.rotation.z = 0.5 + i * 0.1;
    g.add(c);
  }
}

function addCrate(g: THREE.Group, mats: Mats) {
  const c = box(1.3, 0.8, 1.0, mats.crate, 0.35);
  c.position.set(0.2, 0.28, 0.15);
  c.rotation.y = 0.2;
  g.add(c);
  const term = box(0.5, 0.7, 0.35, mats.hullDark, 0.55);
  term.position.set(-0.9, 0.45, 0.4);
  g.add(term);
  const scr = box(0.38, 0.28, 0.04, mats.window, 0.62);
  scr.position.set(-0.9, 0.62, 0.58);
  g.add(scr);
}

function addStrobe(g: THREE.Group, mats: Mats) {
  g.add(cyl(0.08, 0.08, 0.18, 8, mats.strobe, 3.1));
  const light = new THREE.PointLight(0xff3344, 1.6, 8);
  light.position.y = 3.1;
  g.add(light);
  g.userData.strobe = light;
}

function addHull(g: THREE.Group, mats: Mats, sil: string, live: boolean) {
  const glass = live ? mats.glassLit : mats.glass;
  if (sil === "ops") {
    g.add(cyl(3.1, 3.4, 1.6, 6, mats.hull, 1.0));
    g.add(cyl(1.6, 1.8, 1.2, 6, mats.hullDark, 2.3));
    const dish = new THREE.Mesh(new THREE.SphereGeometry(1.3, 14, 10, 0, Math.PI), mats.hull);
    dish.rotation.x = Math.PI / 2.2;
    dish.position.y = 3.3;
    dish.castShadow = true;
    g.add(dish);
    for (let i = 0; i < 6; i++) {
      const win = box(0.45, 0.28, 0.06, mats.window, 1.15);
      const a = (i / 6) * Math.PI * 2;
      win.position.set(Math.cos(a) * 3.05, 1.15, Math.sin(a) * 3.05);
      win.lookAt(0, 1.15, 0);
      g.add(win);
    }
    return;
  }
  if (sil === "table") {
    g.add(cyl(2.6, 2.6, 0.18, 24, mats.hull, 0.85));
    g.add(cyl(0.7, 0.9, 0.8, 12, mats.hullDark, 0.45));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.08, 8, 28), mats.hull);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.15;
    g.add(ring);
    return;
  }
  if (sil === "airlock") {
    const tube = cyl(1.1, 1.1, 3.2, 16, mats.hull, 1.4);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 1.3, 0);
    g.add(tube);
    g.add(cyl(1.35, 1.35, 0.3, 16, mats.hullDark, 1.3));
    const hatch = cyl(0.7, 0.7, 0.12, 16, glass, 1.3);
    hatch.rotation.x = Math.PI / 2;
    hatch.position.z = 1.7;
    g.add(hatch);
    return;
  }
  if (sil === "spine") {
    g.add(box(0.7, 0.7, CELL * 4.2, mats.hull, 1.6));
    for (let i = -2; i <= 2; i++) {
      const leg = cyl(0.12, 0.18, 1.6, 6, mats.hullDark, 0.8);
      leg.position.z = i * 2.2;
      g.add(leg);
    }
    return;
  }
  if (sil === "archive") {
    g.add(cyl(2.2, 2.4, 2.4, 8, mats.hullDark, 1.3));
    g.add(cyl(1.6, 1.6, 0.5, 8, glass, 2.6));
    return;
  }
  if (sil === "lab") {
    g.add(box(2.6, 1.1, 2.6, mats.hull, 0.7));
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1.45, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      glass,
    );
    dome.position.y = 1.25;
    dome.castShadow = true;
    g.add(dome);
    const labWin = box(0.5, 0.35, 0.08, mats.window, 0.85);
    labWin.position.set(0, 0.85, 1.32);
    g.add(labWin);
    return;
  }
  if (sil === "antenna") {
    g.add(box(1.6, 1.2, 1.6, mats.hullDark, 0.7));
    g.add(cyl(0.14, 0.22, 5.2, 8, mats.hull, 3.4));
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8, 0, Math.PI), mats.hull);
    dish.position.y = 5.8;
    dish.rotation.x = 1.1;
    g.add(dish);
    const light = new THREE.PointLight(0xd7e0e8, live ? 1.2 : 0.3, 7);
    light.position.y = 6.1;
    g.add(light);
    return;
  }
  if (sil === "cargo") {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1.8, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      mats.hull,
    );
    dome.position.y = 0.15;
    dome.castShadow = true;
    g.add(dome);
    g.add(box(1.2, 0.8, 0.9, mats.crate, 0.5));
    return;
  }
  if (sil === "office") {
    g.add(cyl(2.0, 2.0, 0.7, 20, mats.hull, 0.7));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.18, 8, 24), mats.hullDark);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.15;
    g.add(ring);
    return;
  }
  if (sil === "crate") {
    addCrate(g, mats);
    g.add(box(2.0, 1.1, 1.6, mats.hullDark, 0.7));
    return;
  }
  g.add(box(2.3, 2.0, 2.3, mats.hull, 1.1));
  const defWin = box(0.5, 0.32, 0.08, mats.window, 1.3);
  defWin.position.set(0, 1.3, 1.18);
  g.add(defWin);
}

function buildCrew(c: CrewMember): THREE.Group {
  const g = new THREE.Group();
  g.userData.kind = "crew";
  g.userData.name = c.name;
  g.userData.phase = hash(c.name.charCodeAt(0));
  const visor =
    c.race === "claude"
      ? 0xe8a04a
      : c.race === "grok"
        ? 0xd7e0e8
        : c.race === "gemini"
          ? 0x3d9b8f
          : 0x7a6aad;
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 0.55, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0xcfc6b8, roughness: 0.55, metalness: 0.2 }),
  );
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const helm = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xb8c0c4, metalness: 0.6, roughness: 0.3 }),
  );
  helm.position.y = 1.05;
  g.add(helm);
  const v = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 8),
    new THREE.MeshStandardMaterial({
      color: visor,
      emissive: visor,
      emissiveIntensity: 0.55,
      metalness: 0.8,
      roughness: 0.2,
    }),
  );
  v.position.set(0, 1.05, 0.1);
  v.scale.set(0.85, 0.7, 0.45);
  g.add(v);
  const pack = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.34, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x4a4038 }),
  );
  pack.position.set(0, 0.6, -0.22);
  g.add(pack);
  return g;
}

function disposeGroup(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else if (mat) (mat as THREE.Material).dispose();
  });
}
