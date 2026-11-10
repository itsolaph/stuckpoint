/** Pure data types for the Stuckpoint playtest engine. No React, no I/O. */

export type NodeKind = "item" | "clue" | "lock" | "exit";

export interface EngineNode {
  id: string;
  kind: NodeKind;
  name: string;
  /** Id of the lock this node is stored inside, or null when lying in the open. */
  containerId: string | null;
  /** Node ids that must all be satisfied before this node can be obtained/read/opened/exited. */
  requires: string[];
  /** A single-use item is consumed the moment it satisfies a requirement. */
  singleUse: boolean;
}

export type StepAction = "obtain" | "read" | "open" | "exit";

export interface TraceStep {
  action: StepAction;
  nodeId: string;
}

export interface ReasonChain {
  /** The exit or lock this chain explains. */
  targetId: string;
  /** Node ids along the chain, target first, root cause last. */
  nodeIds: string[];
  /** Plain-English segments; `text` is these joined with " · ". */
  steps: string[];
  text: string;
  /** Node ids forming a requirement cycle when the chain loops back on itself, else null. */
  cycle: string[] | null;
  /** Why the chain ends: a cycle, a consumed single-use item, or a dangling reference. */
  endsWith: "cycle" | "consumed" | "dangling";
}

export interface StuckEntry {
  nodeId: string;
  kind: "exit" | "lock";
  chains: ReasonChain[];
}

export interface PlaytestResult {
  verdict: "escaped" | "stuck";
  trace: TraceStep[];
  stuckAnalysis: StuckEntry[];
  /** Nodes never obtained/read/opened (excludes exits). */
  unreachable: string[];
  /** Reachable nodes that no exit requirement depends on. */
  optional: string[];
  /** Longest requirement chain from an exit, counted in hops. */
  criticalPathDepth: number;
  /** Nodes to flag with a red pin: cycle members, or chain root causes when there is no cycle. */
  pinNodeIds: string[];
  /** Every node that appears in a blocking chain. */
  blockingNodeIds: string[];
  /** Non-fatal structural problems, e.g. a requirement pointing at a deleted node. */
  warnings: string[];
}
