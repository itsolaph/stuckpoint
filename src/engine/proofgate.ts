/**
 * Proof gate, pure half: decide whether a piece of agent text claims a room is
 * solvable, and whether the persisted playtest supports that claim.
 * Deterministic proof beats LLM opinion.
 */

export type ProofState =
  /** Latest playthrough escaped and the graph has not changed since. */
  | "proven"
  /** Latest playthrough escaped, but nodes changed after it ran. */
  | "stale"
  | "stuck"
  | "never-run";

const POSITIVE: RegExp[] = [
  /\b(solvable|escapable|winnable|beatable|completable|finishable)\b/,
  /\b(can|could|will|should|may)\s+(now\s+|then\s+|all\s+)?(be\s+)?(escape|escaped|solve|solved|complete|completed|beat|beaten|finish|finished)\b/,
  /\bno\s+(more\s+)?(deadlocks?|dead[- ]ends?|blockers?|soft[- ]?locks?)\b/,
  /\b(is|are|now)\s+(fully\s+|now\s+|completely\s+)?(fixed|working|passing|passes|unblocked|escaped)\b/,
  /\b(room|puzzle|game)\s+(works|passes)\b/,
];

/** Hedges and negations that make a sentence a non-claim. */
const NON_CLAIM =
  /\b(not|never|cannot|can't|isn't|aren't|won't|wouldn't|unsolvable|unwinnable|unescapable|un-?verified|unproven|yet|until|unless|if|whether|once|when|would|might|may not|before|check|verify|prove|proof|playtest(?:ing)? (?:it|the room|to))\b|\?$/;

/** Does the text assert, as a present fact, that the room can be solved or escaped? */
export function claimsSolvable(text: string): boolean {
  const sentences = text
    .replace(/```[\s\S]*?```/g, " ")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return sentences.some(
    (s) => !NON_CLAIM.test(s) && POSITIVE.some((re) => re.test(s)),
  );
}

export function proofState(input: {
  latestVerdict: "escaped" | "stuck" | null;
  /** Hash stored with the latest playthrough, and the hash of the graph now. */
  playedHash: string | null;
  currentHash: string;
}): ProofState {
  if (input.latestVerdict === null) return "never-run";
  if (input.latestVerdict === "stuck") return "stuck";
  return input.playedHash === input.currentHash ? "proven" : "stale";
}

export function proofReason(state: Exclude<ProofState, "proven">): string {
  switch (state) {
    case "never-run":
      return "this room has never been playtested";
    case "stale":
      return "the room was edited after its last playtest, so the last ESCAPED verdict no longer applies";
    case "stuck":
      return "the latest playtest verdict is STUCK";
  }
}
