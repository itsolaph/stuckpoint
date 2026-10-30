import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rooms: [] as { id: string; title: string }[],
  play: null as null | { verdict: "escaped" | "stuck"; analysis: { graphHash: string } },
  hash: "h1",
}));

vi.mock("@agent-native/core/sharing", () => ({ accessFilter: () => ({}) }));
vi.mock("drizzle-orm", () => ({
  and: () => ({}),
  desc: () => ({}),
  inArray: () => ({}),
}));
vi.mock("../db/index.js", () => {
  // A thenable query builder: every call returns itself, awaiting yields the rooms.
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where", "orderBy", "limit"]) {
    chain[m] = () => chain;
  }
  chain.then = (resolve: (rows: unknown) => unknown) => resolve(state.rooms);
  return {
    getDb: () => chain,
    schema: { rooms: { id: "id", title: "title", createdAt: "created_at" }, roomShares: {} },
  };
});
vi.mock("./rooms.js", () => ({
  latestPlaythrough: async () => state.play,
  listNodeRows: async () => [],
  toEngineNode: (n: unknown) => n,
  graphHash: () => state.hash,
}));

import { proofGate } from "./proof-gate";

const ROOM = "11111111-2222-3333-4444-555555555555";

function ctx(text: string) {
  return {
    text,
    messages: [],
    toolCalls: [{ name: "get-room", input: { id: ROOM } }],
    toolResults: [],
    retryCount: 0,
    executionMode: "act",
    assistantContent: [],
  } as unknown as Parameters<typeof proofGate>[0];
}

beforeEach(() => {
  state.rooms = [{ id: ROOM, title: "The Darkroom" }];
  state.play = null;
  state.hash = "h1";
});

describe("proofGate", () => {
  it("lets answers without a solvability claim through", async () => {
    expect(await proofGate(ctx("Move the UV flashlight out of the safe."))).toBeNull();
  });

  it("blocks a claim when the room was never playtested", async () => {
    const out = await proofGate(ctx("Good news, the room is solvable."));
    expect(out).toMatchObject({ maxRetries: 1 });
    expect(JSON.stringify(out)).toContain("never been playtested");
  });

  it("blocks a claim when the latest verdict is stuck", async () => {
    state.play = { verdict: "stuck", analysis: { graphHash: "h1" } };
    const out = await proofGate(ctx("Players can escape this room."));
    expect(JSON.stringify(out)).toContain("STUCK");
  });

  it("blocks a claim when an escaped verdict is stale", async () => {
    state.play = { verdict: "escaped", analysis: { graphHash: "old" } };
    const out = await proofGate(ctx("The room is solvable."));
    expect(JSON.stringify(out)).toContain("edited after its last playtest");
  });

  it("allows a claim backed by a current escaped verdict", async () => {
    state.play = { verdict: "escaped", analysis: { graphHash: "h1" } };
    expect(await proofGate(ctx("The room is solvable."))).toBeNull();
  });
});
