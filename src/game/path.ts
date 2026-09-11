import { CELL, GRID } from "./types";

export function cellToWorld(gx: number, gz: number) {
  const origin = (GRID - 1) / 2;
  return { x: (gx - origin) * CELL, z: (gz - origin) * CELL };
}

export function worldToCell(x: number, z: number) {
  const origin = (GRID - 1) / 2;
  const gx = Math.round(x / CELL + origin);
  const gz = Math.round(z / CELL + origin);
  return {
    gx: Math.max(0, Math.min(GRID - 1, gx)),
    gz: Math.max(0, Math.min(GRID - 1, gz)),
  };
}

export function inBounds(gx: number, gz: number) {
  return gx >= 0 && gz >= 0 && gx < GRID && gz < GRID;
}

type Pt = { gx: number; gz: number };

export function findPath(
  blocked: boolean[][],
  from: Pt,
  goal: Pt,
): Pt[] {
  if (!inBounds(from.gx, from.gz) || !inBounds(goal.gx, goal.gz)) return [];
  if (from.gx === goal.gx && from.gz === goal.gz) return [from];

  const key = (p: Pt) => p.gx + p.gz * GRID;
  const seen = new Uint8Array(GRID * GRID);
  const prev = new Int16Array(GRID * GRID).fill(-1);
  const q: number[] = [];
  const start = key(from);
  q.push(start);
  seen[start] = 1;

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  let found = -1;
  for (let i = 0; i < q.length; i++) {
    const cur = q[i]!;
    const cx = cur % GRID;
    const cz = (cur / GRID) | 0;
    if (cx === goal.gx && cz === goal.gz) {
      found = cur;
      break;
    }
    for (const [dx, dz] of dirs) {
      const nx = cx + dx!;
      const nz = cz + dz!;
      if (!inBounds(nx, nz)) continue;
      const nk = nx + nz * GRID;
      if (seen[nk]) continue;
      const isGoal = nx === goal.gx && nz === goal.gz;
      if (blocked[nz]![nx] && !isGoal) continue;
      seen[nk] = 1;
      prev[nk] = cur;
      q.push(nk);
    }
  }
  if (found < 0) return [];
  const path: Pt[] = [];
  let c = found;
  while (c >= 0) {
    path.push({ gx: c % GRID, gz: (c / GRID) | 0 });
    c = prev[c]!;
  }
  path.reverse();
  return path;
}

export function neighbors(gx: number, gz: number): Pt[] {
  return [
    { gx: gx + 1, gz },
    { gx: gx - 1, gz },
    { gx, gz: gz + 1 },
    { gx, gz: gz - 1 },
  ].filter((p) => inBounds(p.gx, p.gz));
}
