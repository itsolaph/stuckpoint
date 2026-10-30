import { describe, expect, it } from "vitest";

import { buildGmSheet, playtest, type EngineNode } from "./index";

function node(
  id: string,
  kind: EngineNode["kind"],
  extra: Partial<EngineNode> = {},
): EngineNode {
  return {
    id,
    kind,
    name: extra.name ?? id,
    containerId: null,
    requires: [],
    singleUse: false,
    ...extra,
  };
}

describe("playtest", () => {
  it("escapes a solvable room and orders the trace", () => {
    const nodes = [
      node("exit", "exit", { name: "Exit door", requires: ["key"] }),
      node("key", "item", { name: "Brass key", containerId: "box" }),
      node("box", "lock", { name: "Music box", requires: ["code"] }),
      node("code", "clue", { name: "Code note" }),
    ];
    const r = playtest(nodes);
    expect(r.verdict).toBe("escaped");
    expect(r.trace.map((t) => `${t.action}:${t.nodeId}`)).toEqual([
      "read:code",
      "open:box",
      "obtain:key",
      "exit:exit",
    ]);
    expect(r.stuckAnalysis).toEqual([]);
    expect(r.unreachable).toEqual([]);
    expect(r.criticalPathDepth).toBe(3);
  });

  it("detects the classic deadlock: key inside the box it opens", () => {
    const nodes = [
      node("exit", "exit", { name: "Exit", requires: ["key"] }),
      node("key", "item", { name: "Brass key", containerId: "box" }),
      node("box", "lock", { name: "Safe", requires: ["key"] }),
    ];
    const r = playtest(nodes);
    expect(r.verdict).toBe("stuck");
    expect(r.trace).toEqual([]);
    const exit = r.stuckAnalysis.find((e) => e.nodeId === "exit")!;
    expect(exit.chains[0].text).toContain("The exit needs the brass key");
    expect(exit.chains[0].text).toContain("the brass key is inside the safe");
    expect(exit.chains[0].cycle).toEqual(["key", "box", "key"]);
    expect(r.pinNodeIds).toEqual(["key", "box"]);
    expect(r.unreachable.sort()).toEqual(["box", "key"]);
  });

  it("names a requirement cycle through a clue", () => {
    const nodes = [
      node("exit", "exit", { name: "Exit", requires: ["key"] }),
      node("key", "item", { name: "Brass key", containerId: "safe" }),
      node("safe", "lock", { name: "Safe", requires: ["code"] }),
      node("code", "clue", { name: "Code clue", requires: ["uv"] }),
      node("uv", "item", { name: "UV flashlight", containerId: "safe" }),
    ];
    const r = playtest(nodes);
    expect(r.verdict).toBe("stuck");
    const chain = r.stuckAnalysis[0].chains[0];
    expect(chain.text).toBe(
      "The exit needs the brass key · the brass key is inside the safe · the safe needs the code clue · " +
        "the code clue requires the UV flashlight · the UV flashlight is inside the safe (unopened)" +
        " — requirement cycle: the safe → the code clue → the UV flashlight → the safe",
    );
    expect(chain.endsWith).toBe("cycle");
    expect(r.pinNodeIds).toEqual(["safe", "code", "uv"]);
    // The safe is reported on its own as well as via the exit.
    expect(r.stuckAnalysis.map((e) => e.nodeId)).toEqual(["exit", "safe"]);
  });

  it("consumes single-use items and reports the one that was spent", () => {
    const nodes = [
      node("exit", "exit", { requires: ["lockA", "lockB"] }),
      node("fuse", "item", { name: "Fuse", singleUse: true }),
      node("lockA", "lock", { name: "Panel A", requires: ["fuse"] }),
      node("lockB", "lock", { name: "Panel B", requires: ["fuse"] }),
    ];
    const r = playtest(nodes);
    expect(r.verdict).toBe("stuck");
    expect(r.trace.map((t) => t.nodeId)).toEqual(["fuse", "lockA"]);
    const b = r.stuckAnalysis.find((e) => e.nodeId === "lockB")!;
    expect(b.chains[0].endsWith).toBe("consumed");
    expect(b.chains[0].text).toBe(
      "The panel B needs the fuse (already used up on the panel A)",
    );
  });

  it("finds a spending order that escapes when declaration order would not", () => {
    // The spare key can open either door, but only the east door leads on.
    const nodes = [
      node("exit", "exit", { requires: ["gate"] }),
      node("spare", "item", { name: "Spare key", singleUse: true }),
      node("decoy", "lock", { name: "West door", requires: ["spare"] }),
      node("gate", "lock", { name: "East door", requires: ["spare"] }),
    ];
    const r = playtest(nodes);
    expect(r.verdict).toBe("escaped");
    expect(r.trace.map((t) => t.nodeId)).toEqual(["spare", "gate", "exit"]);
  });

  it("flags unreachable branches as wasted content", () => {
    const nodes = [
      node("exit", "exit", { requires: ["key"] }),
      node("key", "item"),
      node("vault", "lock", { requires: ["missing-tool"] }),
      node("missing-tool", "item", { containerId: "vault" }),
      node("gold", "item", { containerId: "vault" }),
    ];
    const r = playtest(nodes);
    expect(r.verdict).toBe("escaped");
    expect(r.unreachable.sort()).toEqual(["gold", "missing-tool", "vault"]);
  });

  it("marks reachable-but-unneeded nodes as optional", () => {
    const nodes = [
      node("exit", "exit", { requires: ["key"] }),
      node("key", "item"),
      node("herring", "clue", { name: "Torn photo" }),
      node("drawer", "lock"),
      node("coin", "item", { containerId: "drawer" }),
    ];
    const r = playtest(nodes);
    expect(r.verdict).toBe("escaped");
    expect(r.optional.sort()).toEqual(["coin", "drawer", "herring"]);
  });

  it("warns about dangling references and a missing exit", () => {
    const r = playtest([node("a", "item", { requires: ["ghost"] })]);
    expect(r.verdict).toBe("stuck");
    expect(r.warnings.join(" ")).toContain("no exit");
    expect(r.warnings.join(" ")).toContain("no longer exists");
  });

  it("does not loop forever on a self-requiring lock", () => {
    const r = playtest([
      node("exit", "exit", { requires: ["l"] }),
      node("l", "lock", { requires: ["l"] }),
    ]);
    expect(r.verdict).toBe("stuck");
    expect(r.stuckAnalysis[0].chains[0].cycle).toEqual(["l", "l"]);
  });
});

describe("buildGmSheet", () => {
  it("renders walkthrough, props and hint ladders", () => {
    const nodes = [
      node("exit", "exit", { name: "Door", requires: ["key"] }),
      node("key", "item", { name: "Brass key", containerId: "box" }),
      node("box", "lock", { name: "Box", requires: ["code"] }),
      node("code", "clue", { name: "Code note" }),
    ];
    const result = playtest(nodes);
    const md = buildGmSheet({
      title: "Test room",
      story: "A story.",
      nodes,
      result,
      ladders: [{ nodeId: "box", hints: ["Look around", "Read the note", "Code is 1234"] }],
    });
    expect(md).toContain("# Test room — game master sheet");
    expect(md).toContain("1. Players read **Code note**.");
    expect(md).toContain("## Props by stage");
    expect(md).toContain("### Box");
    expect(md).toContain("3. **Answer:** Code is 1234");
  });
});
