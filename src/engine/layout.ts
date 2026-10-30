import type { EngineNode } from "./types";

export const GRID_X = 300;
export const GRID_Y = 150;

/**
 * Layered left-to-right layout: a node sits one column right of the deepest
 * thing it depends on (its container and requirements), so the exit lands on
 * the far right. Cycles are cut where they close. Pure and deterministic.
 */
export function layoutNodes(
  nodes: EngineNode[],
  origin: { x: number; y: number } = { x: 40, y: 40 },
): Map<string, { x: number; y: number }> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const depth = new Map<string, number>();

  const resolve = (id: string, path: Set<string>): number => {
    const cached = depth.get(id);
    if (cached !== undefined) return cached;
    const node = byId.get(id);
    if (!node) return -1;
    path.add(id);
    let col = 0;
    const deps = [...node.requires, ...(node.containerId ? [node.containerId] : [])];
    for (const d of deps) {
      if (path.has(d) || !byId.has(d)) continue;
      col = Math.max(col, resolve(d, path) + 1);
    }
    path.delete(id);
    depth.set(id, col);
    return col;
  };
  for (const n of nodes) resolve(n.id, new Set());

  const rowsUsed = new Map<number, number>();
  const out = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    const col = depth.get(n.id) ?? 0;
    const row = rowsUsed.get(col) ?? 0;
    rowsUsed.set(col, row + 1);
    out.set(n.id, { x: origin.x + col * GRID_X, y: origin.y + row * GRID_Y });
  }
  return out;
}
