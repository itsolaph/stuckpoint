import type { EngineNode } from "./types";

/** Mutable walker state: what the player has obtained, read, opened and used up. */
export interface WalkState {
  obtained: Set<string>;
  read: Set<string>;
  opened: Set<string>;
  consumed: Set<string>;
}

export function isDone(s: WalkState, node: EngineNode): boolean {
  switch (node.kind) {
    case "item":
      return s.obtained.has(node.id);
    case "clue":
      return s.read.has(node.id);
    case "lock":
      return s.opened.has(node.id);
    default:
      return false;
  }
}

/** Can `node` be used right now as a requirement for something else? */
export function isAvailable(s: WalkState, node: EngineNode): boolean {
  switch (node.kind) {
    case "item":
      return s.obtained.has(node.id) && !s.consumed.has(node.id);
    case "clue":
      return s.read.has(node.id);
    case "lock":
      return s.opened.has(node.id);
    default:
      return false;
  }
}
