import { describe, expect, it } from "vitest";

import { playtest, type EngineNode } from "../engine/index";
import { SAMPLE_ROOMS, type SampleKey } from "./index";

function toEngine(key: SampleKey, patch?: (n: EngineNode) => EngineNode): EngineNode[] {
  const room = SAMPLE_ROOMS[key];
  return room.nodes.map((n) => {
    const node: EngineNode = {
      id: n.ref,
      kind: n.kind,
      name: n.name,
      containerId: n.containerRef ?? null,
      requires: n.requiresRefs ?? [],
      singleUse: n.singleUse ?? false,
    };
    return patch ? patch(node) : node;
  });
}

describe("sample rooms", () => {
  it("refs are unique and every reference resolves", () => {
    for (const room of Object.values(SAMPLE_ROOMS)) {
      const refs = new Set(room.nodes.map((n) => n.ref));
      expect(refs.size).toBe(room.nodes.length);
      for (const n of room.nodes) {
        if (n.containerRef) expect(refs.has(n.containerRef)).toBe(true);
        for (const r of n.requiresRefs ?? []) expect(refs.has(r)).toBe(true);
      }
      for (const h of room.hints) expect(refs.has(h.ref)).toBe(true);
    }
  });

  it("The Séance escapes, has an optional red herring and a single-use item", () => {
    const nodes = toEngine("seance");
    expect(nodes.length).toBeGreaterThanOrEqual(10);
    expect(nodes.length).toBeLessThanOrEqual(14);
    expect(nodes.some((n) => n.singleUse)).toBe(true);
    const r = playtest(nodes);
    expect(r.verdict).toBe("escaped");
    expect(r.unreachable).toEqual([]);
    expect(r.optional).toEqual(
      expect.arrayContaining(["music-box", "tiny-crank", "faded-photo"]),
    );
  });

  it("The Darkroom deadlocks on a UV cycle, and moving the flashlight fixes it", () => {
    const stuck = playtest(toEngine("darkroom"));
    expect(stuck.verdict).toBe("stuck");
    expect(stuck.pinNodeIds).toEqual(
      expect.arrayContaining(["wall-safe", "uv-code", "uv-flashlight"]),
    );
    expect(stuck.stuckAnalysis[0]!.chains[0]!.cycle).not.toBeNull();

    const fixed = playtest(
      toEngine("darkroom", (n) =>
        n.id === "uv-flashlight" ? { ...n, containerId: null } : n,
      ),
    );
    expect(fixed.verdict).toBe("escaped");
  });

  it("The Supply Closet is small and solvable", () => {
    const nodes = toEngine("supply-closet");
    expect(nodes.length).toBeGreaterThanOrEqual(5);
    expect(nodes.length).toBeLessThanOrEqual(8);
    expect(playtest(nodes).verdict).toBe("escaped");
  });
});
