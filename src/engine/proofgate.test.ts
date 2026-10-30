import { describe, expect, it } from "vitest";

import { claimsSolvable, proofState } from "./proofgate";

describe("claimsSolvable", () => {
  it.each([
    "Good news: the room is solvable.",
    "The Darkroom is now escapable.",
    "Players can escape in about 12 steps.",
    "The room can be solved end to end.",
    "There are no deadlocks left.",
    "It is fixed and working.",
  ])("flags a positive claim: %s", (text) => {
    expect(claimsSolvable(text)).toBe(true);
  });

  it.each([
    "The room is not solvable yet.",
    "This room is unsolvable: the key is inside the safe.",
    "If you move the flashlight, the room should be solvable, so run a playtest to check.",
    "I cannot say whether it is solvable until it is playtested.",
    "Move the UV flashlight into the drawer.",
    "Is the room solvable?",
    "Once fixed, players can escape.",
  ])("ignores hedges, questions and negations: %s", (text) => {
    expect(claimsSolvable(text)).toBe(false);
  });

  it("ignores code blocks", () => {
    expect(claimsSolvable("```\nroom is solvable\n```")).toBe(false);
  });
});

describe("proofState", () => {
  it("is proven only for a current escaped run", () => {
    expect(proofState({ latestVerdict: "escaped", playedHash: "a", currentHash: "a" })).toBe("proven");
    expect(proofState({ latestVerdict: "escaped", playedHash: "a", currentHash: "b" })).toBe("stale");
    expect(proofState({ latestVerdict: "stuck", playedHash: "a", currentHash: "a" })).toBe("stuck");
    expect(proofState({ latestVerdict: null, playedHash: null, currentHash: "a" })).toBe("never-run");
  });
});
