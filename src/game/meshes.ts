import * as THREE from "three";
import type { BuildingKind, Domain, Look, PlacedBuilding, PopKind, Race, WorkStatus } from "./types";
import { CELL, GRID } from "./types";
import { BUILDINGS, DOMAINS, KIND_LOOK, RACES, buildingLook } from "./catalog";

const geo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cone: new THREE.ConeGeometry(1, 1, 10),
  cone6: new THREE.ConeGeometry(1, 1, 6),
  sphere: new THREE.SphereGeometry(1, 16, 12),
  sphere8: new THREE.SphereGeometry(1, 10, 8),
  plane: new THREE.PlaneGeometry(1, 1),
  ring: new THREE.TorusGeometry(1, 0.08, 8, 20),
  oct: new THREE.OctahedronGeometry(1, 0),
};

function mat(color: number, extras: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.62,
    metalness: 0.12,
    ...extras,
  });
}

function glow(color: number, intensity = 0.55) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.4,
    metalness: 0.08,
  });
}

const concrete = mat(0xb08a6a, { roughness: 0.92, metalness: 0.1 });
const cladding = mat(0xd4cec2, { roughness: 0.36, metalness: 0.48 });
const darkMetal = mat(0x34383e, { roughness: 0.36, metalness: 0.72 });
const brick = mat(0x8a4a32, { roughness: 0.78, metalness: 0.22 });
const brickDark = mat(0x6a3224, { roughness: 0.84, metalness: 0.18 });
const wood = mat(0x6a5a48, { roughness: 0.7, metalness: 0.18 });
const glass = mat(0x6a90a4, { roughness: 0.1, metalness: 0.82, transparent: true, opacity: 0.8 });
const glassDark = mat(0x2a3844, { roughness: 0.1, metalness: 0.86, transparent: true, opacity: 0.74 });
const asphalt = mat(0x7a3a28, { roughness: 0.96, metalness: 0.04 });
const grass = mat(0xc46a48, { roughness: 0.96, metalness: 0.03 });
const curb = mat(0xa87858, { roughness: 0.86, metalness: 0.08 });
const warmWin = glow(0xffc898, 0.55);
const leaf = mat(0x8a4e38, { roughness: 0.9, metalness: 0.1 });
const trunk = mat(0x5a3224, { roughness: 0.88, metalness: 0.14 });
const orange = mat(0xe07a28, { roughness: 0.5, metalness: 0.16 });
const caution = mat(0xe8c44a, { roughness: 0.46, metalness: 0.14 });
const tarp = mat(0x3a5a72, { roughness: 0.55, metalness: 0.22 });
const rust = mat(0x8a4330, { roughness: 0.78, metalness: 0.22 });
const gold = mat(0xc4a35a, { roughness: 0.38, metalness: 0.5 });
const white = mat(0xe8e4dc, { roughness: 0.42, metalness: 0.18 });
const ink = mat(0x221e1c, { roughness: 0.55, metalness: 0.16 });
const redCross = mat(0xc44a3a, { roughness: 0.5, metalness: 0.12 });
const sand = mat(0xc47a58, { roughness: 0.94, metalness: 0.04 });
const hedgeMat = mat(0x6a4030, { roughness: 0.9, metalness: 0.08 });
const board = mat(0x5a4a3c, { roughness: 0.72, metalness: 0.2 });


function mesh(
  g: THREE.BufferGeometry,
  m: THREE.Material,
  sx: number,
  sy: number,
  sz: number,
  x: number,
  y: number,
  z: number,
) {
  const o = new THREE.Mesh(g, m);
  o.scale.set(sx, sy, sz);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

function addLot(g: THREE.Group, domain?: Domain, unfinished = false) {
  const color = unfinished ? 0xb8a888 : domain ? DOMAINS[domain].color : 0xc4c0b6;
  const pad = mesh(geo.box, mat(color, { roughness: 0.88, metalness: 0.04 }), 3.7, 0.08, 3.7, 0, 0.04, 0);
  pad.castShadow = false;
  g.add(pad);
  if (unfinished) {
    g.add(mesh(geo.box, caution, 3.72, 0.03, 0.08, 0, 0.09, 1.82));
    g.add(mesh(geo.box, ink, 3.72, 0.03, 0.08, 0, 0.09, 1.74));
    g.add(mesh(geo.box, caution, 0.08, 0.03, 3.72, 1.82, 0.09, 0));
    g.add(mesh(geo.box, ink, 0.08, 0.03, 3.72, 1.74, 0.09, 0));
  }
}

function windows(g: THREE.Group, cols: number, rows: number, w: number, h: number, d: number, y0: number, pane: THREE.Material = glass) {
  const gapX = w / (cols + 1);
  const gapY = h / (rows + 1);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + gapX * (c + 1);
      const y = y0 + gapY * (r + 1);
      g.add(mesh(geo.box, pane, 0.28, 0.38, 0.04, x, y, d / 2 + 0.02));
      g.add(mesh(geo.box, pane, 0.28, 0.38, 0.04, x, y, -d / 2 - 0.02));
    }
  }
}

function door(g: THREE.Group, x: number, y: number, z: number, w = 0.55, h = 1.15) {
  g.add(mesh(geo.box, darkMetal, w, h, 0.08, x, y, z));
  g.add(mesh(geo.box, gold, 0.06, 0.06, 0.04, x + w * 0.28, y, z + 0.06));
}

function steps(g: THREE.Group, w: number, z: number, n = 3) {
  for (let i = 0; i < n; i++) {
    g.add(mesh(geo.box, concrete, w - i * 0.12, 0.1, 0.28, 0, 0.12 + i * 0.1, z + i * 0.16));
  }
}

function flag(g: THREE.Group, color: number, x: number, y: number, z: number) {
  g.add(mesh(geo.cyl6, darkMetal, 0.03, 0.9, 0.03, x, y, z));
  g.add(mesh(geo.box, mat(color), 0.42, 0.22, 0.02, x + 0.22, y + 0.28, z));
}

function chimney(g: THREE.Group, x: number, y: number, z: number, h = 0.9) {
  g.add(mesh(geo.box, brickDark, 0.28, h, 0.28, x, y, z));
  g.add(mesh(geo.box, darkMetal, 0.32, 0.08, 0.32, x, y + h / 2 + 0.04, z));
}

function hedge(g: THREE.Group, sx: number, sz: number, x: number, z: number) {
  g.add(mesh(geo.box, hedgeMat, sx, 0.42, sz, x, 0.32, z));
}

function spin(o: THREE.Object3D, rate: number, axis: "y" | "z" = "y") {
  if (axis === "z") o.userData.spinZ = rate;
  else o.userData.spin = rate;
  return o;
}

function bob(o: THREE.Object3D, phase = 0) {
  o.userData.bob = 1;
  o.userData.bobPhase = phase;
  o.userData.baseY = o.position.y;
  return o;
}

function addFence(g: THREE.Group) {
  const posts = [
    [-1.85, -1.85],
    [1.85, -1.85],
    [-1.85, 1.85],
    [1.85, 1.85],
  ];
  for (const [x, z] of posts) {
    g.add(mesh(geo.cyl6, orange, 0.05, 1.15, 0.05, x, 0.65, z));
  }
  const rails: [number, number, number, number, number, number][] = [
    [3.7, 0.04, 0.04, 0, 0.95, -1.85],
    [3.7, 0.04, 0.04, 0, 0.55, -1.85],
    [3.7, 0.04, 0.04, 0, 0.95, 1.85],
    [3.7, 0.04, 0.04, 0, 0.55, 1.85],
    [0.04, 0.04, 3.7, -1.85, 0.95, 0],
    [0.04, 0.04, 3.7, -1.85, 0.55, 0],
    [0.04, 0.04, 3.7, 1.85, 0.95, 0],
    [0.04, 0.04, 3.7, 1.85, 0.55, 0],
  ];
  for (const r of rails) g.add(mesh(geo.box, orange, ...r));
}

function addScaffold(g: THREE.Group, side: "front" | "left" = "front") {
  const z = side === "front" ? 1.35 : 0;
  const x = side === "left" ? -1.35 : 0;
  const poles =
    side === "front"
      ? [
          [-1.1, z],
          [1.1, z],
          [-1.1, z - 0.45],
          [1.1, z - 0.45],
        ]
      : [
          [x, -1.1],
          [x, 1.1],
          [x + 0.45, -1.1],
          [x + 0.45, 1.1],
        ];
  for (const [px, pz] of poles) {
    g.add(mesh(geo.cyl6, rust, 0.04, 2.6, 0.04, px, 1.4, pz));
  }
  for (const y of [0.7, 1.5, 2.3]) {
    if (side === "front") {
      g.add(mesh(geo.box, rust, 2.3, 0.04, 0.04, 0, y, z));
      g.add(mesh(geo.box, wood, 2.2, 0.05, 0.4, 0, y - 0.08, z - 0.18));
    } else {
      g.add(mesh(geo.box, rust, 0.04, 0.04, 2.3, x, y, 0));
      g.add(mesh(geo.box, wood, 0.4, 0.05, 2.2, x + 0.18, y - 0.08, 0));
    }
  }
}

function addCrane(g: THREE.Group) {
  const x = 1.55;
  const z = -1.5;
  g.add(mesh(geo.box, caution, 0.55, 0.12, 0.55, x, 0.16, z));
  g.add(mesh(geo.box, rust, 0.18, 3.6, 0.18, x, 1.95, z));
  const jib = mesh(geo.box, rust, 2.6, 0.08, 0.08, x - 0.7, 3.75, z);
  g.add(jib);
  g.add(mesh(geo.box, darkMetal, 0.4, 0.22, 0.28, x + 0.7, 3.75, z));
  g.add(mesh(geo.box, orange, 0.28, 0.22, 0.28, x, 3.55, z));
  const hook = mesh(geo.cyl6, darkMetal, 0.04, 0.7, 0.04, x - 1.7, 3.2, z);
  g.add(bob(hook, 0.4));
  g.add(mesh(geo.cone6, orange, 0.08, 0.16, 0.08, x - 1.7, 2.78, z));
}

function addCones(g: THREE.Group) {
  const spots = [
    [-1.6, 1.6],
    [1.6, 1.55],
    [-1.55, -0.2],
    [0.2, 1.7],
  ];
  for (const [x, z] of spots) {
    g.add(mesh(geo.cone6, orange, 0.12, 0.32, 0.12, x, 0.26, z));
    g.add(mesh(geo.box, white, 0.13, 0.04, 0.13, x, 0.22, z));
  }
}

function addMaterials(g: THREE.Group) {
  g.add(mesh(geo.box, wood, 0.7, 0.12, 0.45, -1.45, 0.18, -1.35));
  g.add(mesh(geo.box, wood, 0.65, 0.12, 0.4, -1.45, 0.3, -1.35));
  g.add(mesh(geo.box, brick, 0.55, 0.28, 0.4, -1.4, 0.24, 1.4));
  g.add(mesh(geo.box, brickDark, 0.4, 0.18, 0.28, -1.35, 0.46, 1.4));
  g.add(mesh(geo.sphere8, sand, 0.38, 0.22, 0.38, 1.4, 0.22, 1.35));
  g.add(mesh(geo.box, darkMetal, 0.7, 0.55, 0.45, 1.45, 0.38, 0.55));
  g.add(mesh(geo.box, tarp, 0.38, 0.7, 0.38, -0.15, 0.45, 1.55));
  g.add(mesh(geo.box, orange, 0.4, 0.08, 0.4, -0.15, 0.82, 1.55));
}

function addSign(g: THREE.Group, accent: number) {
  g.add(mesh(geo.cyl6, darkMetal, 0.03, 0.85, 0.03, -0.55, 0.5, 1.78));
  g.add(mesh(geo.cyl6, darkMetal, 0.03, 0.85, 0.03, 0.55, 0.5, 1.78));
  g.add(mesh(geo.box, orange, 1.3, 0.55, 0.06, 0, 1.05, 1.78));
  g.add(mesh(geo.box, mat(accent), 1.1, 0.12, 0.04, 0, 1.12, 1.82));
}

function addRebar(g: THREE.Group) {
  for (let i = 0; i < 8; i++) {
    const x = ((i % 4) - 1.5) * 0.45;
    const z = (Math.floor(i / 4) - 0.5) * 0.7;
    g.add(mesh(geo.cyl6, rust, 0.025, 0.7 + (i % 3) * 0.18, 0.025, x, 0.55, z));
  }
}

function addLightConstruction(g: THREE.Group, accent: number) {
  addScaffold(g, "front");
  addCrane(g);
  addCones(g);
  g.add(mesh(geo.box, wood, 0.7, 0.12, 0.45, -1.45, 0.18, -1.35));
  g.add(mesh(geo.box, brick, 0.5, 0.25, 0.35, 1.4, 0.24, 1.35));
  g.add(mesh(geo.box, tarp, 1.0, 0.06, 0.8, 0.55, 2.45, 0.15));
  g.add(mesh(geo.cone6, orange, 0.12, 0.32, 0.12, -1.5, 0.26, 1.5));
  void accent;
}

function addConstruction(g: THREE.Group, accent: number, heavy: boolean) {
  addFence(g);
  addScaffold(g, "front");
  if (heavy) addScaffold(g, "left");
  addCrane(g);
  addCones(g);
  addMaterials(g);
  addSign(g, accent);
  if (heavy) {
    addRebar(g);
    g.add(mesh(geo.box, tarp, 1.6, 0.08, 1.4, 0.2, 1.85, -0.2));
  } else {
    g.add(mesh(geo.box, tarp, 1.1, 0.06, 0.9, 0.6, 2.55, 0.2));
  }
}

function addDamage(g: THREE.Group) {
  g.add(mesh(geo.box, board, 0.5, 0.7, 0.06, -0.45, 1.2, 1.12));
  g.add(mesh(geo.box, board, 0.5, 0.7, 0.06, 0.5, 1.2, 1.12));
  g.add(mesh(geo.box, caution, 1.8, 0.04, 0.04, 0, 1.7, 1.2));
  g.add(mesh(geo.box, ink, 1.8, 0.04, 0.04, 0, 1.62, 1.2));
  addCones(g);
  g.add(mesh(geo.box, orange, 0.9, 0.4, 0.06, 0, 0.85, 1.7));
}

function addLandscaping(g: THREE.Group, accent: number) {
  g.add(mesh(geo.box, darkMetal, 0.08, 1.15, 0.55, -1.45, 0.72, 1.35));
  g.add(mesh(geo.box, glow(0x9ad0e0, 0.35), 0.02, 1.0, 0.48, -1.4, 0.72, 1.35));
  g.add(mesh(geo.cyl6, darkMetal, 0.05, 1.8, 0.05, 1.5, 1.05, 1.45));
  g.add(mesh(geo.sphere8, glow(accent, 0.65), 0.1, 0.1, 0.1, 1.5, 2.0, 1.45));
  g.add(mesh(geo.box, darkMetal, 0.55, 0.06, 0.9, 1.15, 0.22, 1.35));
  g.add(mesh(geo.box, mat(accent, { metalness: 0.4 }), 0.5, 0.04, 0.82, 1.15, 0.28, 1.35));
  flag(g, accent, -0.2, 2.7, 0.15);
}

function addFoundation(g: THREE.Group) {
  g.add(mesh(geo.box, concrete, 2.4, 0.28, 2.2, 0, 0.22, 0));
  g.add(mesh(geo.box, cladding, 2.2, 0.7, 0.12, 0, 0.7, 1.0));
  g.add(mesh(geo.box, cladding, 0.12, 0.7, 1.8, -1.05, 0.7, 0));
}

function ghostIntended(lookFn: (g: THREE.Group) => void): THREE.Group {
  const inner = new THREE.Group();
  lookFn(inner);
  inner.scale.set(0.52, 0.48, 0.52);
  inner.position.y = 0.15;
  inner.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const m = obj.material;
      if (Array.isArray(m)) return;
      const clone = (m as THREE.MeshStandardMaterial).clone();
      clone.transparent = true;
      clone.opacity = 0.38;
      clone.depthWrite = false;
      obj.material = clone;
      obj.castShadow = false;
    }
  });
  return inner;
}

function lookHall(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.box, cladding, 3.2, 0.28, 3.0, 0, 0.24, 0));
  steps(g, 1.6, 1.45, 4);
  g.add(mesh(geo.box, cladding, 2.7, 2.15, 2.4, 0, 1.45, 0));
  g.add(mesh(geo.box, glass, 2.2, 1.5, 0.08, 0, 1.55, 1.24));
  for (const x of [-1.15, -0.4, 0.4, 1.15]) {
    g.add(mesh(geo.cyl8, white, 0.1, 1.7, 0.1, x, 1.05, 1.28));
  }
  g.add(mesh(geo.box, darkMetal, 2.85, 0.12, 2.55, 0, 2.56, 0));
  g.add(mesh(geo.cyl8, cladding, 0.7, 0.55, 0.7, 0, 2.95, 0));
  g.add(mesh(geo.sphere8, band, 0.55, 0.4, 0.55, 0, 3.35, 0));
  g.add(mesh(geo.box, band, 1.4, 0.1, 0.1, 0, 2.35, 1.26));
  door(g, 0, 0.75, 1.24, 0.7, 1.2);
  flag(g, a, 1.15, 2.9, -0.4);
}

function lookLibrary(g: THREE.Group, _a: number, band: THREE.Material) {
  g.add(mesh(geo.box, brick, 2.6, 3.0, 2.15, 0, 1.6, 0));
  steps(g, 1.8, 1.2, 3);
  for (const x of [-0.85, 0, 0.85]) {
    g.add(mesh(geo.cyl8, concrete, 0.1, 2.2, 0.1, x, 1.25, 1.16));
  }
  windows(g, 3, 4, 2.4, 2.4, 2.15, 0.45, glassDark);
  g.add(mesh(geo.box, concrete, 2.8, 0.18, 2.35, 0, 3.18, 0));
  g.add(mesh(geo.box, band, 0.9, 0.12, 0.08, 0, 2.85, 1.12));
  door(g, 0, 0.8, 1.12, 0.6, 1.3);
  g.add(mesh(geo.box, wood, 0.35, 0.55, 0.12, -1.0, 0.55, 1.12));
  g.add(mesh(geo.box, wood, 0.35, 0.55, 0.12, 1.0, 0.55, 1.12));
}

function lookClinic(g: THREE.Group, _a: number, band: THREE.Material) {
  g.add(mesh(geo.box, white, 2.5, 1.9, 2.1, 0, 1.05, 0));
  g.add(mesh(geo.box, glass, 2.1, 0.95, 0.06, 0, 1.4, 1.08));
  g.add(mesh(geo.box, band, 0.85, 0.14, 0.14, 0, 2.2, 0));
  g.add(mesh(geo.box, band, 0.14, 0.85, 0.14, 0, 2.2, 0));
  g.add(mesh(geo.box, redCross, 0.7, 0.12, 0.12, 0, 2.2, 0.08));
  g.add(mesh(geo.box, redCross, 0.12, 0.7, 0.12, 0, 2.2, 0.08));
  door(g, -0.7, 0.7, 1.08);
  g.add(mesh(geo.box, white, 0.9, 0.12, 1.4, 1.1, 0.16, 1.2));
  g.add(mesh(geo.box, glass, 0.7, 0.55, 0.7, 1.15, 0.85, 0.2));
}

function lookClock(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.box, brick, 1.55, 4.4, 1.55, 0, 2.3, 0));
  windows(g, 1, 3, 1.3, 2.4, 1.55, 0.5);
  const face = glow(0xf4ead4, 0.25);
  for (const [x, z] of [
    [0, 0.82],
    [0, -0.82],
    [0.82, 0],
    [-0.82, 0],
  ] as const) {
    g.add(mesh(geo.cyl, face, 0.42, 0.05, 0.42, x, 3.55, z));
    const hour = mesh(geo.box, ink, 0.04, 0.22, 0.03, x, 3.55, z + (z === 0 ? 0.04 : 0));
    hour.rotation.z = 0.4;
    g.add(spin(hour, 0.05, "z"));
    const min = mesh(geo.box, ink, 0.03, 0.32, 0.03, x, 3.55, z + (z === 0 ? 0.05 : 0));
    g.add(spin(min, 0.35, "z"));
  }
  g.add(mesh(geo.box, darkMetal, 1.7, 0.16, 1.7, 0, 4.55, 0));
  g.add(mesh(geo.cone, band, 0.7, 0.85, 0.7, 0, 5.05, 0));
  g.add(mesh(geo.sphere8, glow(a, 0.5), 0.1, 0.1, 0.1, 0, 5.52, 0));
  door(g, 0, 0.7, 0.82);
}

function lookGreenhouse(g: THREE.Group, a: number, _band: THREE.Material) {
  g.add(mesh(geo.box, brick, 2.4, 0.45, 2.0, 0, 0.32, 0));
  g.add(mesh(geo.box, glass, 2.2, 1.7, 1.8, 0, 1.4, 0));
  g.add(mesh(geo.box, darkMetal, 2.35, 0.08, 1.95, 0, 2.28, 0));
  g.add(mesh(geo.box, darkMetal, 0.08, 0.35, 1.9, 0, 2.5, 0));
  for (const x of [-0.6, 0, 0.6]) {
    g.add(mesh(geo.sphere8, leaf, 0.28, 0.35, 0.28, x, 0.95, 0.2));
    g.add(mesh(geo.cyl6, trunk, 0.04, 0.3, 0.04, x, 0.7, 0.2));
  }
  g.add(mesh(geo.box, wood, 0.45, 0.22, 0.35, 1.15, 0.22, 1.05));
  g.add(mesh(geo.box, mat(a), 0.45, 0.18, 0.35, 1.15, 0.4, 1.05));
  door(g, 0, 0.7, 1.04, 0.5, 1.0);
}

function lookRadio(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.box, cladding, 1.7, 1.15, 1.6, 0, 0.68, 0));
  g.add(mesh(geo.box, glassDark, 1.2, 0.5, 0.06, 0, 0.95, 0.84));
  door(g, 0.45, 0.6, 0.84, 0.4, 0.85);
  const mast = mesh(geo.cyl6, darkMetal, 0.06, 3.4, 0.06, -0.35, 2.4, 0);
  g.add(mast);
  const dish = mesh(geo.cyl, band, 0.55, 0.06, 0.55, -0.35, 3.5, 0.15);
  dish.rotation.x = 0.7;
  g.add(spin(dish, 0.5));
  g.add(mesh(geo.sphere8, glow(a, 0.7), 0.1, 0.1, 0.1, -0.35, 4.15, 0));
  g.add(mesh(geo.cyl6, darkMetal, 0.18, 0.35, 0.18, 0.55, 1.4, 0.2));
  g.add(mesh(geo.sphere8, ink, 0.16, 0.16, 0.16, 0.55, 1.7, 0.2));
  g.add(mesh(geo.cyl6, darkMetal, 0.04, 0.45, 0.04, 0.55, 2.0, 0.2));
}

function lookLabtank(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.box, cladding, 2.3, 0.45, 2.2, 0, 0.32, 0));
  g.add(mesh(geo.box, darkMetal, 2.3, 0.1, 2.2, 0, 2.35, 0));
  const glowA = glow(a, 0.45);
  for (const x of [-0.7, 0.7]) {
    g.add(mesh(geo.cyl, glass, 0.45, 1.6, 0.45, x, 1.25, 0.15));
    const cell = mesh(geo.sphere8, glowA, 0.22, 0.22, 0.22, x, 1.35, 0.15);
    g.add(bob(cell, x));
  }
  g.add(mesh(geo.cyl, glass, 0.32, 1.1, 0.32, 0, 1.0, -0.55));
  g.add(mesh(geo.box, band, 0.12, 0.12, 1.4, 0, 1.9, 0));
  g.add(mesh(geo.box, darkMetal, 0.2, 0.7, 0.2, -1.05, 0.7, 0.9));
  door(g, 0, 0.55, 1.14, 0.45, 0.85);
}

function lookVault(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.box, darkMetal, 2.15, 1.95, 2.15, 0, 1.08, 0));
  g.add(mesh(geo.box, band, 2.25, 0.16, 2.25, 0, 2.1, 0));
  g.add(mesh(geo.cyl, darkMetal, 0.7, 0.12, 0.7, 0, 0.95, 1.12));
  g.add(mesh(geo.cyl, gold, 0.18, 0.16, 0.18, 0.35, 0.95, 1.18));
  g.add(mesh(geo.box, band, 0.5, 0.7, 0.08, 0, 0.7, 1.12));
  g.add(mesh(geo.box, glow(a, 0.3), 0.2, 0.08, 0.04, 0.7, 1.55, 1.12));
  g.add(mesh(geo.box, concrete, 2.4, 0.16, 2.4, 0, 0.14, 0));
}

function lookTower(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.box, cladding, 1.7, 4.4, 1.7, 0, 2.3, 0));
  windows(g, 2, 6, 1.55, 3.8, 1.7, 0.35);
  g.add(mesh(geo.box, band, 1.85, 0.14, 1.85, 0, 4.55, 0));
  g.add(mesh(geo.box, darkMetal, 0.7, 0.55, 0.7, 0, 4.9, 0));
  g.add(mesh(geo.cyl6, darkMetal, 0.06, 0.7, 0.06, 0.28, 5.35, 0.28));
  g.add(mesh(geo.sphere8, glow(a, 0.55), 0.08, 0.08, 0.08, 0.28, 5.72, 0.28));
  door(g, 0, 0.7, 0.9);
}

function lookHouse(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.box, cladding, 2.25, 1.7, 1.85, 0, 0.95, 0));
  g.add(mesh(geo.box, brick, 2.55, 0.16, 2.15, 0, 1.85, 0));
  g.add(mesh(geo.box, brick, 0.18, 0.95, 2.2, 0, 2.3, 0));
  windows(g, 2, 1, 2.0, 1.0, 1.85, 0.55);
  door(g, 0.55, 0.65, 0.96);
  g.add(mesh(geo.box, band, 0.5, 0.08, 0.08, -0.5, 1.55, 0.96));
  chimney(g, -0.7, 2.45, -0.3);
  flag(g, a, 0.7, 2.15, -0.2);
}

function lookTownhouse(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.box, brick, 1.9, 2.6, 1.7, 0, 1.4, 0));
  windows(g, 2, 3, 1.7, 2.1, 1.7, 0.4);
  steps(g, 0.9, 0.95, 3);
  door(g, 0, 0.7, 0.9, 0.48, 1.05);
  g.add(mesh(geo.box, darkMetal, 2.05, 0.12, 1.85, 0, 2.76, 0));
  g.add(mesh(geo.box, band, 0.7, 0.1, 0.08, 0, 2.45, 0.9));
  g.add(mesh(geo.box, glow(a, 0.35), 0.55, 0.28, 0.04, 0.55, 1.7, 0.9));
  hedge(g, 0.6, 0.18, -0.85, 1.05);
}

function lookFactory(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.box, brick, 2.9, 1.55, 1.9, 0, 0.88, 0));
  g.add(mesh(geo.box, darkMetal, 1.2, 1.15, 1.9, -0.75, 1.75, 0));
  g.add(mesh(geo.box, darkMetal, 1.15, 0.75, 1.9, 0.7, 1.55, 0));
  g.add(mesh(geo.box, glass, 0.95, 0.7, 0.06, 0.75, 1.0, 0.98));
  g.add(mesh(geo.cyl, darkMetal, 0.18, 1.6, 0.18, -0.85, 2.7, 0.3));
  g.add(mesh(geo.cyl, darkMetal, 0.14, 1.2, 0.14, -0.45, 2.5, -0.35));
  g.add(mesh(geo.box, darkMetal, 0.9, 1.2, 0.08, 1.05, 0.7, 0.98));
  g.add(mesh(geo.box, band, 0.6, 0.1, 0.1, 0, 1.55, 0.98));
  g.add(mesh(geo.box, mat(a), 0.45, 0.2, 0.35, 1.2, 0.22, 1.15));
}

function lookForge(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.box, brick, 2.2, 1.6, 1.8, 0, 0.9, 0));
  chimney(g, -0.6, 2.1, -0.4, 1.4);
  g.add(mesh(geo.box, glow(a, 0.7), 0.7, 0.45, 0.5, 0, 0.55, 0.2));
  g.add(mesh(geo.box, darkMetal, 0.7, 0.12, 0.5, 0, 0.82, 0.2));
  g.add(mesh(geo.box, darkMetal, 0.55, 0.22, 0.4, 0.85, 0.28, 1.05));
  g.add(mesh(geo.cyl6, darkMetal, 0.08, 0.35, 0.08, 0.85, 0.5, 1.05));
  g.add(mesh(geo.box, band, 0.5, 0.1, 0.1, 0, 1.5, 0.94));
  door(g, -0.55, 0.65, 0.94, 0.5, 1.0);
}

function lookSpire(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.cyl8, cladding, 0.85, 0.35, 0.85, 0, 0.28, 0));
  g.add(mesh(geo.cyl8, band, 0.5, 2.6, 0.5, 0, 1.6, 0));
  g.add(mesh(geo.cone, darkMetal, 0.42, 1.2, 0.42, 0, 3.4, 0));
  g.add(mesh(geo.sphere8, glow(a, 0.6), 0.16, 0.16, 0.16, 0, 4.1, 0));
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2;
    g.add(mesh(geo.box, darkMetal, 0.08, 0.7, 0.08, Math.cos(ang) * 0.7, 0.7, Math.sin(ang) * 0.7));
  }
}

function lookScaffold(g: THREE.Group, a: number, band: THREE.Material) {
  addFoundation(g);
  addScaffold(g, "front");
  addScaffold(g, "left");
  g.add(mesh(geo.box, band, 1.2, 0.8, 0.12, 0, 0.7, 0));
  g.add(mesh(geo.sphere8, glow(a, 0.4), 0.1, 0.1, 0.1, 0, 2.5, 0));
}

function lookMill(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.box, brick, 2.3, 1.65, 1.85, 0, 0.92, 0));
  const wheel = mesh(geo.cyl, darkMetal, 0.55, 0.14, 0.55, 1.05, 1.45, 0);
  wheel.rotation.z = Math.PI / 2;
  g.add(spin(wheel, 0.8));
  g.add(mesh(geo.box, darkMetal, 0.08, 0.08, 1.1, 1.05, 1.45, 0));
  g.add(mesh(geo.cyl, darkMetal, 0.18, 1.5, 0.18, -0.75, 2.0, 0.35));
  g.add(mesh(geo.box, band, 0.55, 0.1, 0.1, 0, 1.5, 0.96));
  g.add(mesh(geo.box, concrete, 0.7, 0.2, 0.5, 0.7, 0.22, 1.1));
  g.add(mesh(geo.box, glow(a, 0.25), 0.35, 0.08, 0.35, 0.7, 0.36, 1.1));
  door(g, -0.4, 0.65, 0.96);
}

function lookArcade(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.box, cladding, 2.5, 1.5, 1.7, 0, 0.85, 0));
  g.add(mesh(geo.box, darkMetal, 2.7, 0.55, 0.28, 0, 1.8, 0.88));
  g.add(mesh(geo.box, glow(a, 0.55), 2.4, 0.32, 0.1, 0, 1.82, 1.02));
  door(g, 0, 0.7, 0.88);
  windows(g, 3, 1, 2.2, 0.7, 1.7, 0.85, glow(a, 0.2));
  g.add(mesh(geo.box, ink, 0.35, 0.7, 0.28, -0.7, 0.5, 0.4));
  g.add(mesh(geo.box, ink, 0.35, 0.7, 0.28, 0.7, 0.5, 0.4));
  g.add(mesh(geo.box, band, 0.28, 0.18, 0.08, -0.7, 0.75, 0.55));
  g.add(mesh(geo.box, band, 0.28, 0.18, 0.08, 0.7, 0.75, 0.55));
}

function lookAntenna(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.box, cladding, 1.45, 0.85, 1.45, 0, 0.52, 0));
  g.add(mesh(geo.cyl, darkMetal, 0.07, 3.4, 0.07, 0, 2.3, 0));
  g.add(mesh(geo.box, band, 1.15, 0.05, 0.05, 0, 2.7, 0));
  g.add(mesh(geo.box, band, 0.05, 0.05, 1.15, 0, 3.2, 0));
  g.add(mesh(geo.sphere8, glow(a, 0.75), 0.12, 0.12, 0.12, 0, 4.05, 0));
  door(g, 0, 0.5, 0.76, 0.4, 0.75);
}

function lookChapel(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.box, cladding, 1.85, 1.9, 2.3, 0, 1.05, 0));
  g.add(mesh(geo.box, brick, 0.18, 1.25, 2.5, 0, 2.3, 0));
  g.add(mesh(geo.cone, band, 0.55, 0.95, 0.55, 0, 3.2, 0));
  g.add(mesh(geo.box, glow(a, 0.35), 0.08, 0.35, 0.08, 0, 3.75, 0));
  g.add(mesh(geo.box, glass, 0.55, 1.15, 0.06, 0, 1.25, 1.18));
  g.add(mesh(geo.box, glow(a, 0.25), 0.4, 0.7, 0.04, 0, 1.3, 1.2));
  door(g, 0.55, 0.65, 1.18, 0.42, 1.0);
  g.add(mesh(geo.cyl8, cladding, 0.35, 1.1, 0.35, -0.85, 0.7, 1.0));
}

function lookLabglass(g: THREE.Group, a: number, _band: THREE.Material) {
  g.add(mesh(geo.box, cladding, 2.1, 0.4, 2.25, 0, 0.3, 0));
  g.add(mesh(geo.box, glass, 1.9, 2.05, 2.05, 0, 1.42, 0));
  g.add(mesh(geo.box, darkMetal, 2.1, 0.1, 2.25, 0, 2.5, 0));
  g.add(mesh(geo.cyl, glow(a, 0.45), 0.18, 0.5, 0.18, 0.75, 2.8, 0.6));
  door(g, 0, 0.6, 1.16, 0.5, 0.95);
}

function lookMint(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.box, brick, 2.5, 1.8, 2.0, 0, 1.0, 0));
  g.add(mesh(geo.box, gold, 2.6, 0.12, 2.1, 0, 1.95, 0));
  const gear = mesh(geo.cyl, darkMetal, 0.55, 0.14, 0.55, 1.15, 1.15, 0.2);
  gear.rotation.z = Math.PI / 2;
  g.add(spin(gear, 0.6));
  g.add(mesh(geo.cyl, gold, 0.22, 0.16, 0.22, 1.15, 1.15, 0.2));
  chimney(g, -0.7, 2.3, -0.4, 1.1);
  g.add(mesh(geo.box, band, 0.7, 0.12, 0.1, 0, 1.55, 1.04));
  g.add(mesh(geo.box, glow(a, 0.3), 0.35, 0.35, 0.08, 0.7, 0.7, 1.04));
  door(g, -0.5, 0.7, 1.04);
}

function lookExchange(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.box, glass, 1.8, 3.4, 1.8, 0, 1.85, 0));
  g.add(mesh(geo.box, cladding, 1.95, 0.3, 1.95, 0, 0.25, 0));
  g.add(mesh(geo.box, darkMetal, 1.95, 0.12, 1.95, 0, 3.6, 0));
  g.add(mesh(geo.box, glow(a, 0.5), 1.7, 0.12, 0.06, 0, 2.4, 0.94));
  g.add(mesh(geo.box, band, 1.7, 0.08, 0.06, 0, 1.1, 0.94));
  door(g, 0, 0.7, 0.94);
  g.add(mesh(geo.cyl6, darkMetal, 0.05, 0.8, 0.05, 0.6, 4.05, 0.6));
}

function lookStorefront(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.box, cladding, 2.4, 1.7, 1.7, 0, 0.95, 0));
  g.add(mesh(geo.box, band, 2.6, 0.18, 0.55, 0, 1.85, 0.7));
  g.add(mesh(geo.box, glow(a, 0.4), 2.3, 0.28, 0.08, 0, 1.85, 0.98));
  g.add(mesh(geo.box, glass, 0.85, 0.9, 0.06, -0.6, 1.05, 0.88));
  g.add(mesh(geo.box, glass, 0.85, 0.9, 0.06, 0.6, 1.05, 0.88));
  door(g, 0, 0.7, 0.88, 0.5, 1.1);
  g.add(mesh(geo.box, wood, 0.7, 0.35, 0.4, 1.2, 0.28, 1.05));
}

function lookFortress(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.box, concrete, 2.6, 1.4, 2.2, 0, 0.8, 0));
  g.add(mesh(geo.box, concrete, 0.7, 2.0, 0.7, -1.15, 1.15, -0.9));
  g.add(mesh(geo.box, concrete, 0.7, 2.0, 0.7, 1.15, 1.15, -0.9));
  g.add(mesh(geo.box, concrete, 0.7, 1.6, 0.7, -1.15, 0.95, 0.95));
  g.add(mesh(geo.box, darkMetal, 0.7, 1.3, 0.1, 0, 0.75, 1.14));
  g.add(mesh(geo.box, sand, 0.4, 0.28, 0.28, 0.9, 0.24, 1.2));
  g.add(mesh(geo.box, sand, 0.4, 0.22, 0.28, 1.15, 0.22, 1.05));
  g.add(mesh(geo.box, band, 0.5, 0.1, 0.1, 0, 1.55, 1.14));
  g.add(mesh(geo.cyl6, darkMetal, 0.05, 0.7, 0.05, 1.15, 2.35, -0.9));
  g.add(mesh(geo.sphere8, glow(a, 0.5), 0.08, 0.08, 0.08, 1.15, 2.75, -0.9));
}

function lookTheatre(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.box, cladding, 2.6, 1.8, 2.0, 0, 1.0, 0));
  g.add(mesh(geo.cyl8, cladding, 1.15, 1.8, 0.4, 0, 1.0, 1.05));
  g.add(mesh(geo.box, darkMetal, 2.4, 0.5, 0.35, 0, 2.1, 1.15));
  g.add(mesh(geo.box, glow(a, 0.5), 2.15, 0.28, 0.1, 0, 2.12, 1.32));
  for (const x of [-0.7, 0.7]) {
    g.add(mesh(geo.cyl8, white, 0.1, 1.5, 0.1, x, 0.9, 1.15));
  }
  door(g, 0, 0.7, 1.22, 0.7, 1.15);
  g.add(mesh(geo.box, band, 0.45, 0.7, 0.04, -1.1, 1.1, 1.04));
  g.add(mesh(geo.box, band, 0.45, 0.7, 0.04, 1.1, 1.1, 1.04));
}

function lookGlobe(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.cyl8, cladding, 0.7, 0.4, 0.7, 0, 0.3, 0));
  g.add(mesh(geo.cyl8, darkMetal, 0.12, 0.7, 0.12, 0, 0.8, 0));
  const globe = mesh(geo.sphere, band, 0.85, 0.85, 0.85, 0, 1.7, 0);
  g.add(spin(globe, 0.25));
  const ring = mesh(geo.ring, glow(a, 0.4), 0.95, 0.95, 0.95, 0, 1.7, 0);
  ring.rotation.x = 0.7;
  g.add(spin(ring, 0.4));
  g.add(mesh(geo.box, cladding, 1.4, 0.7, 1.2, 0, 0.45, 1.0));
  door(g, 0, 0.5, 1.62, 0.4, 0.7);
}

function lookRadar(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.box, cladding, 1.5, 0.9, 1.5, 0, 0.55, 0));
  g.add(mesh(geo.cyl6, darkMetal, 0.08, 2.2, 0.08, 0, 1.8, 0));
  const dish = mesh(geo.cyl, band, 0.85, 0.07, 0.85, 0, 2.85, 0);
  dish.rotation.x = 0.85;
  g.add(spin(dish, 0.7));
  g.add(mesh(geo.sphere8, glow(a, 0.7), 0.1, 0.1, 0.1, 0, 3.15, 0.2));
  door(g, 0, 0.5, 0.78, 0.4, 0.75);
  g.add(mesh(geo.box, glassDark, 0.7, 0.35, 0.05, 0.4, 0.85, 0.78));
}

function lookKiosk(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.box, cladding, 1.3, 1.8, 1.1, 0, 1.0, 0));
  g.add(mesh(geo.box, glass, 1.1, 1.1, 0.06, 0, 1.25, 0.58));
  g.add(mesh(geo.box, glow(a, 0.45), 0.9, 0.7, 0.04, 0, 1.3, 0.62));
  g.add(mesh(geo.box, darkMetal, 1.5, 0.08, 1.3, 0, 1.95, 0));
  g.add(mesh(geo.box, band, 0.4, 0.08, 0.08, 0, 0.55, 0.58));
  g.add(mesh(geo.cyl6, darkMetal, 0.04, 0.5, 0.04, 0.5, 2.25, 0.3));
}

function lookCommand(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.box, cladding, 2.6, 1.2, 2.0, 0, 0.7, 0));
  g.add(mesh(geo.box, glass, 1.3, 2.2, 1.3, 0, 2.1, 0));
  g.add(mesh(geo.box, darkMetal, 1.45, 0.12, 1.45, 0, 3.25, 0));
  const d1 = mesh(geo.cyl, band, 0.4, 0.05, 0.4, 0.85, 3.55, 0.4);
  d1.rotation.x = 0.6;
  g.add(spin(d1, 0.45));
  const d2 = mesh(geo.cyl, band, 0.28, 0.05, 0.28, -0.7, 3.4, -0.3);
  d2.rotation.x = 0.5;
  g.add(spin(d2, -0.35));
  g.add(mesh(geo.box, glow(a, 0.4), 1.8, 0.18, 0.06, 0, 1.15, 1.04));
  door(g, 0, 0.6, 1.04);
}

function lookObservatory(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.cyl8, cladding, 1.05, 1.2, 1.05, 0, 0.7, 0));
  g.add(mesh(geo.sphere8, band, 1.05, 0.7, 1.05, 0, 1.55, 0));
  g.add(mesh(geo.cyl, darkMetal, 0.12, 1.1, 0.12, 0.15, 2.15, 0.2));
  g.add(mesh(geo.cyl, darkMetal, 0.2, 0.4, 0.2, 0.35, 2.7, 0.45));
  g.add(mesh(geo.sphere8, glow(a, 0.4), 0.1, 0.1, 0.1, 0.5, 2.85, 0.6));
  door(g, 0, 0.55, 1.05, 0.4, 0.8);
}

function lookMonument(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.box, concrete, 1.6, 0.28, 1.6, 0, 0.2, 0));
  g.add(mesh(geo.box, cladding, 0.7, 3.2, 0.7, 0, 1.85, 0));
  g.add(mesh(geo.box, band, 0.55, 0.35, 0.55, 0, 3.55, 0));
  g.add(mesh(geo.cone, darkMetal, 0.22, 0.45, 0.22, 0, 3.95, 0));
  g.add(mesh(geo.sphere8, glow(a, 0.55), 0.1, 0.1, 0.1, 0, 4.25, 0));
  g.add(mesh(geo.box, gold, 0.85, 0.08, 0.85, 0, 0.4, 0));
}

function lookTable(g: THREE.Group, a: number, band: THREE.Material) {
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    g.add(mesh(geo.cyl8, cladding, 0.08, 1.6, 0.08, Math.cos(ang) * 1.05, 0.9, Math.sin(ang) * 1.05));
  }
  g.add(mesh(geo.cyl8, darkMetal, 1.2, 0.08, 1.2, 0, 1.75, 0));
  g.add(mesh(geo.cone, band, 1.15, 0.45, 1.15, 0, 2.02, 0));
  g.add(mesh(geo.cyl, wood, 0.7, 0.08, 0.7, 0, 0.55, 0));
  g.add(mesh(geo.cyl6, darkMetal, 0.08, 0.5, 0.08, 0, 0.28, 0));
  g.add(mesh(geo.sphere8, glow(a, 0.4), 0.12, 0.12, 0.12, 0, 2.3, 0));
}

function lookBunker(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.box, concrete, 2.6, 1.15, 2.2, 0, 0.65, 0));
  g.add(mesh(geo.box, concrete, 1.6, 0.55, 1.4, 0, 1.45, -0.2));
  g.add(mesh(geo.box, darkMetal, 0.7, 0.95, 0.1, 0, 0.6, 1.14));
  g.add(mesh(geo.cyl, darkMetal, 0.16, 0.45, 0.16, -0.85, 1.5, 0.6));
  g.add(mesh(geo.cyl, darkMetal, 0.16, 0.45, 0.16, 0.85, 1.5, 0.6));
  g.add(mesh(geo.box, band, 0.5, 0.1, 0.1, 0, 1.2, 1.14));
  g.add(mesh(geo.box, glow(a, 0.3), 0.15, 0.08, 0.04, 0.55, 0.9, 1.14));
}

function lookPhone(g: THREE.Group, a: number, band: THREE.Material) {
  g.add(mesh(geo.box, ink, 1.35, 2.6, 0.22, 0, 1.45, 0));
  g.add(mesh(geo.box, glassDark, 1.15, 2.15, 0.08, 0, 1.5, 0.14));
  g.add(mesh(geo.box, glow(a, 0.45), 1.0, 1.7, 0.04, 0, 1.55, 0.18));
  g.add(mesh(geo.cyl, band, 0.08, 0.04, 0.08, 0, 0.35, 0.16));
  g.add(mesh(geo.box, darkMetal, 0.4, 0.06, 0.04, 0, 2.6, 0.16));
  g.add(mesh(geo.box, cladding, 1.6, 0.2, 1.1, 0, 0.16, 0.15));
}

function fillLook(g: THREE.Group, look: Look, a: number, band: THREE.Material) {
  switch (look) {
    case "hall":
      lookHall(g, a, band);
      break;
    case "library":
      lookLibrary(g, a, band);
      break;
    case "clinic":
      lookClinic(g, a, band);
      break;
    case "clocktower":
      lookClock(g, a, band);
      break;
    case "greenhouse":
      lookGreenhouse(g, a, band);
      break;
    case "radio":
      lookRadio(g, a, band);
      break;
    case "labtank":
      lookLabtank(g, a, band);
      break;
    case "vault":
      lookVault(g, a, band);
      break;
    case "tower":
      lookTower(g, a, band);
      break;
    case "house":
      lookHouse(g, a, band);
      break;
    case "townhouse":
      lookTownhouse(g, a, band);
      break;
    case "factory":
      lookFactory(g, a, band);
      break;
    case "forge":
      lookForge(g, a, band);
      break;
    case "spire":
      lookSpire(g, a, band);
      break;
    case "scaffold":
      lookScaffold(g, a, band);
      break;
    case "mill":
      lookMill(g, a, band);
      break;
    case "arcade":
      lookArcade(g, a, band);
      break;
    case "antenna":
      lookAntenna(g, a, band);
      break;
    case "chapel":
      lookChapel(g, a, band);
      break;
    case "labglass":
      lookLabglass(g, a, band);
      break;
    case "mint":
      lookMint(g, a, band);
      break;
    case "exchange":
      lookExchange(g, a, band);
      break;
    case "storefront":
      lookStorefront(g, a, band);
      break;
    case "fortress":
      lookFortress(g, a, band);
      break;
    case "theatre":
      lookTheatre(g, a, band);
      break;
    case "globe":
      lookGlobe(g, a, band);
      break;
    case "radar":
      lookRadar(g, a, band);
      break;
    case "kiosk":
      lookKiosk(g, a, band);
      break;
    case "command":
      lookCommand(g, a, band);
      break;
    case "observatory":
      lookObservatory(g, a, band);
      break;
    case "monument":
      lookMonument(g, a, band);
      break;
    case "table":
      lookTable(g, a, band);
      break;
    case "bunker":
      lookBunker(g, a, band);
      break;
    case "phone":
      lookPhone(g, a, band);
      break;
    default:
      lookHouse(g, a, band);
  }
}

function addSignature(g: THREE.Group, slug: string, a: number) {
  const glowA = glow(a, 0.5);
  switch (slug) {
    case "nexus":
      g.add(mesh(geo.box, cladding, 0.22, 0.28, 0.22, -0.25, 3.55, 0.2));
      g.add(mesh(geo.box, cladding, 0.16, 0.4, 0.16, 0.2, 3.6, -0.15));
      g.add(mesh(geo.box, cladding, 0.12, 0.22, 0.12, 0, 3.5, 0.35));
      break;
    case "soma":
      g.add(mesh(geo.cyl6, white, 0.08, 0.35, 0.08, 0.85, 2.35, 0.9));
      g.add(mesh(geo.sphere8, white, 0.1, 0.1, 0.1, 0.85, 2.58, 0.9));
      break;
    case "gage":
      g.add(mesh(geo.box, concrete, 0.45, 0.12, 0.28, 0.9, 0.42, 1.15));
      g.add(mesh(geo.box, ink, 0.4, 0.04, 0.04, 0.9, 0.5, 1.15));
      break;
    case "routes":
      g.add(mesh(geo.box, glowA, 0.08, 0.02, 1.2, -0.2, 0.12, 1.4));
      g.add(mesh(geo.box, glowA, 0.08, 0.02, 1.2, 0, 0.12, 1.4));
      g.add(mesh(geo.box, glowA, 0.08, 0.02, 1.2, 0.2, 0.12, 1.4));
      break;
    case "compilers":
      for (const x of [-0.9, -0.3, 0.3, 0.9]) {
        g.add(mesh(geo.cyl6, darkMetal, 0.1, 1.1, 0.1, x, 2.4, -0.7));
      }
      break;
    case "oracle":
      g.add(mesh(geo.sphere8, glowA, 0.18, 0.18, 0.18, 0, 2.55, 0.4));
      break;
    case "ghost-hunter":
      g.add(mesh(geo.box, glowA, 0.22, 0.35, 0.12, 0.95, 0.7, 0.7));
      g.add(mesh(geo.cyl6, darkMetal, 0.05, 0.3, 0.05, 0.95, 1.0, 0.7));
      break;
    case "omni":
      g.add(mesh(geo.box, gold, 0.5, 0.04, 0.04, 0, 2.4, 0.55));
      g.add(mesh(geo.box, gold, 0.04, 0.04, 0.5, 0, 2.4, 0.55));
      break;
    case "axis":
      g.add(mesh(geo.box, glowA, 0.7, 0.04, 0.04, 0, 0.5, 0.85));
      g.add(mesh(geo.box, glowA, 0.04, 0.04, 0.7, 0, 0.5, 0.85));
      break;
    case "dashboard":
      g.add(mesh(geo.box, glowA, 0.18, 0.18, 0.04, -0.35, 2.15, 0.2));
      g.add(mesh(geo.box, glowA, 0.18, 0.18, 0.04, 0.35, 2.15, 0.2));
      break;
    case "money-engine":
      g.add(mesh(geo.cyl, gold, 0.16, 0.08, 0.16, 0.7, 0.7, 1.1));
      break;
    case "holdout":
      g.add(mesh(geo.box, rust, 0.08, 0.7, 0.08, 0.55, 0.5, 1.25));
      g.add(mesh(geo.box, rust, 0.08, 0.55, 0.08, 0.75, 0.42, 1.2));
      break;
    default:
      break;
  }
}

export function createBuilding(
  kind: BuildingKind,
  look?: Look,
  domain?: Domain,
  status?: WorkStatus,
  slug?: string,
): THREE.Group {
  const group = new THREE.Group();
  const resolved = look ?? KIND_LOOK[kind];
  group.name = `bldg-${resolved}`;
  const unfinished = status === "talked" || status === "incomplete" || status === "broken";
  const talked = status === "talked";
  addLot(group, domain, unfinished && status !== "broken");
  const a = domain ? DOMAINS[domain].color : BUILDINGS[kind].accent;
  const band = mat(a, { roughness: 0.45, metalness: 0.25 });

  const body = new THREE.Group();
  fillLook(body, resolved, a, band);
  if (slug) addSignature(body, slug, a);

  if (talked) {
    addFoundation(group);
    const ghost = ghostIntended((inner) => fillLook(inner, resolved, a, band));
    if (slug) addSignature(ghost, slug, a);
    group.add(ghost);
    addConstruction(group, a, true);
  } else {
    group.add(body);
    if (status === "incomplete") addLightConstruction(group, a);
    else if (status === "broken") addDamage(group);
    else addLandscaping(group, a);
  }

  const hit = new THREE.Mesh(
    new THREE.CylinderGeometry(1.7, 1.7, 4.2, 10),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hit.position.y = 1.6;
  hit.name = "hitbox";
  group.add(hit);
  return group;
}

export function createWorkBuilding(
  b: Pick<PlacedBuilding, "kind" | "look" | "domain" | "status" | "slug" | "title" | "links">,
): THREE.Group {
  return createBuilding(b.kind, buildingLook(b), b.domain, b.status, b.slug ?? b.title);
}

export function createAgent(race: Race, homeDomain?: Domain, kind: PopKind = "agent"): THREE.Group {
  const def = RACES[race];
  const group = new THREE.Group();
  group.name = `agent-${race}-${kind}`;
  group.userData.popKind = kind;
  const skin = mat(0xd8cfc4, { roughness: 0.55, metalness: 0.08 });
  const bodyMat = mat(def.jacket, {
    roughness: kind === "bot" || race === "grok" ? 0.32 : 0.5,
    metalness: kind === "bot" || race === "grok" ? 0.58 : kind === "gem" ? 0.35 : 0.12,
  });
  const visor = glow(def.visor, kind === "gem" ? 1.1 : 0.7);
  const pants = mat(0x3a3e46, { roughness: 0.7, metalness: 0.08 });

  if (kind === "gem") {
    const crystal = new THREE.Mesh(geo.oct, visor);
    crystal.scale.set(0.32, 0.48, 0.32);
    crystal.position.y = 1.15;
    crystal.userData = { spin: 0.6, bob: 0.1, bobPhase: Math.random() * 6 };
    const core = new THREE.Mesh(geo.oct, bodyMat);
    core.scale.set(0.22, 0.34, 0.22);
    core.position.y = 0.72;
    group.add(crystal, core);
    group.add(mesh(geo.cyl, bodyMat, 0.08, 0.5, 0.08, 0, 0.42, 0));
  } else if (kind === "bot") {
    group.add(mesh(geo.box, bodyMat, 0.46, 0.5, 0.32, 0, 0.98, 0));
    group.add(mesh(geo.box, darkMetal, 0.42, 0.2, 0.28, 0, 0.62, 0));
    group.add(mesh(geo.box, darkMetal, 0.32, 0.28, 0.3, 0, 1.38, 0));
    group.add(mesh(geo.box, visor, 0.28, 0.08, 0.06, 0, 1.4, 0.16));
    const ant = new THREE.Mesh(geo.cone, visor);
    ant.scale.set(0.04, 0.22, 0.04);
    ant.position.set(0.1, 1.64, 0);
    group.add(ant);
    const armL = mesh(geo.box, darkMetal, 0.1, 0.42, 0.1, -0.3, 0.92, 0);
    const armR = mesh(geo.box, darkMetal, 0.1, 0.42, 0.1, 0.3, 0.92, 0);
    armL.name = "armL";
    armR.name = "armR";
    group.add(armL, armR);
    group.add(mesh(geo.box, darkMetal, 0.14, 0.42, 0.16, -0.12, 0.28, 0));
    group.add(mesh(geo.box, darkMetal, 0.14, 0.42, 0.16, 0.12, 0.28, 0));
  } else {
    const torso = mesh(geo.box, bodyMat, 0.42, 0.55, 0.28, 0, 0.95, 0);
    const hip = mesh(geo.box, pants, 0.4, 0.22, 0.26, 0, 0.6, 0);
    const head = mesh(geo.box, skin, 0.3, 0.32, 0.28, 0, 1.4, 0);
    const vis = mesh(geo.box, visor, 0.26, 0.08, 0.06, 0, 1.42, 0.14);
    group.add(torso, hip, head, vis);
    const armL = mesh(geo.box, bodyMat, 0.1, 0.46, 0.1, -0.28, 0.9, 0);
    const armR = mesh(geo.box, bodyMat, 0.1, 0.46, 0.1, 0.28, 0.9, 0);
    armL.name = "armL";
    armR.name = "armR";
    group.add(armL, armR);
    group.add(mesh(geo.box, pants, 0.12, 0.5, 0.14, -0.11, 0.28, 0));
    group.add(mesh(geo.box, pants, 0.12, 0.5, 0.14, 0.11, 0.28, 0));
    if (race === "claude") {
      group.add(mesh(geo.box, visor, 0.08, 0.04, 0.04, 0.1, 1.58, 0.04));
    } else if (race === "gemini") {
      group.add(mesh(geo.box, visor, 0.32, 0.04, 0.04, 0, 1.28, 0.14));
    } else if (race === "meta") {
      group.add(mesh(geo.box, visor, 0.34, 0.05, 0.05, 0, 1.5, 0.12));
    } else {
      group.add(mesh(geo.box, cladding, 0.36, 0.05, 0.3, 0, 1.18, 0));
    }
  }

  if (homeDomain) {
    const badge = mat(DOMAINS[homeDomain].color, { roughness: 0.4, metalness: 0.2 });
    group.add(mesh(geo.box, badge, 0.14, 0.14, 0.04, 0.16, kind === "gem" ? 0.85 : 1.05, 0.16));
  }

  const hit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.85, 2.1, 10),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hit.position.y = 0.95;
  hit.name = "hitbox";
  group.add(hit);
  return group;
}

export const createGem = createAgent;

export function createPlayer(): THREE.Group {
  const g = new THREE.Group();
  const suit = mat(0xc8c2b6, { roughness: 0.42, metalness: 0.38 });
  const dark = mat(0x2a2e34, { roughness: 0.45, metalness: 0.4 });
  const vis = glow(0x7ad0e8, 0.55);
  g.add(mesh(geo.box, suit, 0.48, 0.58, 0.34, 0, 0.96, 0));
  g.add(mesh(geo.cyl, dark, 0.16, 0.42, 0.16, -0.18, 1.05, -0.22));
  g.add(mesh(geo.cyl, dark, 0.16, 0.42, 0.16, 0.18, 1.05, -0.22));
  g.add(mesh(geo.sphere8, suit, 0.22, 0.22, 0.22, 0, 1.42, 0));
  g.add(mesh(geo.sphere8, vis, 0.16, 0.14, 0.08, 0, 1.42, 0.16));
  g.add(mesh(geo.box, dark, 0.14, 0.48, 0.16, -0.12, 0.3, 0));
  g.add(mesh(geo.box, dark, 0.14, 0.48, 0.16, 0.12, 0.3, 0));
  g.add(mesh(geo.cyl, mat(0x4f8f7c, { roughness: 0.4, metalness: 0.3 }), 0.46, 0.05, 0.46, 0, 0.05, 0));
  g.rotation.y = Math.PI;
  return g;
}

function seeded(n: number) {
  let t = (n + 1) * 16807;
  return () => {
    t = (t * 16807) % 2147483647;
    return (t - 1) / 2147483646;
  };
}

export function createGround(): THREE.Group {
  const g = new THREE.Group();
  const size = GRID * CELL + 28;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), asphalt);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);

  const origin = (GRID - 1) / 2;
  const lotGeo = new THREE.BoxGeometry(3.6, 0.05, 3.6);
  const lots = new THREE.InstancedMesh(lotGeo, grass, GRID * GRID);
  lots.receiveShadow = true;
  lots.castShadow = false;
  const dummy = new THREE.Object3D();
  let i = 0;
  for (let gz = 0; gz < GRID; gz++) {
    for (let gx = 0; gx < GRID; gx++) {
      dummy.position.set((gx - origin) * CELL, 0.03, (gz - origin) * CELL);
      dummy.updateMatrix();
      lots.setMatrixAt(i++, dummy.matrix);
    }
  }
  g.add(lots);

  const plaza = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.8, 36), darkMetal);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.07;
  plaza.receiveShadow = true;
  g.add(plaza);
  const pad = new THREE.Mesh(new THREE.CircleGeometry(2.15, 36), concrete);
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.08;
  pad.receiveShadow = true;
  g.add(pad);

  const rand = seeded(11);
  const rockSpots: { x: number; z: number; s: number }[] = [];
  let guard = 0;
  while (rockSpots.length < 42 && guard < 220) {
    guard++;
    const gx = Math.floor(rand() * GRID);
    const gz = Math.floor(rand() * GRID);
    if (Math.abs(gx - origin) < 2 && Math.abs(gz - origin) < 2) continue;
    rockSpots.push({
      x: (gx - origin) * CELL + (rand() - 0.5) * 1.8,
      z: (gz - origin) * CELL + (rand() - 0.5) * 1.8,
      s: 0.35 + rand() * 0.7,
    });
  }
  const rockN = rockSpots.length;
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.55, 0), leaf, rockN);
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  rockSpots.forEach((spot, t) => {
    dummy.position.set(spot.x, 0.12 * spot.s, spot.z);
    dummy.scale.set(spot.s, spot.s * 0.55, spot.s * 0.9);
    dummy.rotation.set(rand(), rand(), rand());
    dummy.updateMatrix();
    rocks.setMatrixAt(t, dummy.matrix);
  });
  g.add(rocks);

  const lampN = 16;
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.07, 2.6, 6), darkMetal, lampN);
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.04, 0.28), glow(0xffc090, 0.55), lampN);
  poles.castShadow = true;
  for (let t = 0; t < lampN; t++) {
    const along = t % 2 === 0 ? 1 : -1;
    const k = Math.floor(t / 2);
    const x = along * (CELL * 1.6 + (k % 4) * CELL);
    const z = (k - 4) * CELL * 0.9;
    dummy.position.set(x, 1.3, z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    poles.setMatrixAt(t, dummy.matrix);
    dummy.position.set(x, 2.55, z);
    dummy.rotation.set(0, along * 0.4, 0.2);
    dummy.updateMatrix();
    heads.setMatrixAt(t, dummy.matrix);
  }
  g.add(poles, heads);

  const stripe = mat(0xd8a070, { roughness: 0.7, metalness: 0.12 });
  for (const s of [-CELL * 2, CELL * 2]) {
    const line = mesh(geo.box, stripe, GRID * CELL * 0.7, 0.02, 0.1, 0, 0.05, s);
    line.castShadow = false;
    g.add(line);
    const line2 = mesh(geo.box, stripe, 0.1, 0.02, GRID * CELL * 0.7, s, 0.05, 0);
    line2.castShadow = false;
    g.add(line2);
  }

  void curb;
  void warmWin;
  void hedgeMat;
  void trunk;
  return g;
}

export function createGhost(kind: BuildingKind, look?: Look, domain?: Domain): THREE.Group {
  const g = createBuilding(kind, look, domain);
  g.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const m = obj.material;
      if (Array.isArray(m)) return;
      const clone = (m as THREE.MeshStandardMaterial).clone();
      clone.transparent = true;
      clone.opacity = 0.4;
      clone.depthWrite = false;
      obj.material = clone;
      obj.castShadow = false;
    }
  });
  return g;
}
