import { isAvailable, type WalkState } from "./state";
import type { EngineNode, ReasonChain, StuckEntry, TraceStep } from "./types";

type NodeMap = Map<string, EngineNode>;

const MAX_CHAINS_PER_TARGET = 8;
const MAX_DEPTH = 40;

/** "Brass key" -> "the brass key", "UV flashlight" -> "the UV flashlight". */
function ref(node: EngineNode): string {
  const n = node.name.trim() || node.kind;
  const lowered = /^[A-Z][a-z]/.test(n) ? n.charAt(0).toLowerCase() + n.slice(1) : n;
  return `the ${lowered}`;
}

function stateOf(node: EngineNode, spent: boolean): string {
  if (spent) return "already used up";
  if (node.kind === "lock") return "unopened";
  if (node.kind === "clue") return "not yet read";
  if (node.kind === "exit") return "not yet reached";
  return "not yet obtained";
}

function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface Edge {
  /** The node blocking us; null when the reference is dangling. */
  to: EngineNode | null;
  phrase: string;
  /** Set when `to` is a single-use item that exists but was already spent. */
  spent: boolean;
}

function blockers(
  node: EngineNode,
  byId: NodeMap,
  state: WalkState,
): Edge[] {
  const edges: Edge[] = [];
  if (node.containerId !== null) {
    const c = byId.get(node.containerId);
    if (!c || c.kind !== "lock") {
      edges.push({
        to: null,
        phrase: `${ref(node)} is stored somewhere that does not exist`,
        spent: false,
      });
    } else if (!state.opened.has(c.id)) {
      edges.push({
        to: c,
        phrase: `${ref(node)} is inside ${ref(c)}`,
        spent: false,
      });
    }
  }
  const verb = node.kind === "lock" || node.kind === "exit" ? "needs" : "requires";
  for (const id of node.requires) {
    const r = byId.get(id);
    if (!r) {
      edges.push({
        to: null,
        phrase: `${ref(node)} ${verb} something that no longer exists`,
        spent: false,
      });
    } else if (r.kind === "exit") {
      edges.push({
        to: null,
        phrase: `${ref(node)} ${verb} an exit, which can never be satisfied`,
        spent: false,
      });
    } else if (!isAvailable(state, r)) {
      const spent = state.consumed.has(r.id);
      edges.push({ to: r, phrase: `${ref(node)} ${verb} ${ref(r)}`, spent });
    }
  }
  return edges;
}

function buildChains(
  target: EngineNode,
  byId: NodeMap,
  state: WalkState & { trace: TraceStep[] },
): ReasonChain[] {
  const chains: ReasonChain[] = [];

  const emit = (
    nodeIds: string[],
    steps: string[],
    endsWith: ReasonChain["endsWith"],
    cycle: string[] | null,
  ) => {
    if (chains.length >= MAX_CHAINS_PER_TARGET) return;
    let text = sentenceCase(steps.join(" · "));
    if (cycle) {
      const names = cycle.map((id) => ref(byId.get(id)!));
      text += ` — requirement cycle: ${names.join(" → ")}`;
    }
    chains.push({ targetId: target.id, nodeIds, steps, text, cycle, endsWith });
  };

  const spender = (itemId: string, notNodeId: string): string | null => {
    for (const step of state.trace) {
      const n = byId.get(step.nodeId);
      if (n && step.nodeId !== notNodeId && n.requires.includes(itemId)) {
        return ref(n);
      }
    }
    return null;
  };

  const visit = (node: EngineNode, path: string[], steps: string[]) => {
    if (chains.length >= MAX_CHAINS_PER_TARGET || path.length > MAX_DEPTH) return;
    for (const edge of blockers(node, byId, state)) {
      if (chains.length >= MAX_CHAINS_PER_TARGET) return;
      if (edge.to === null) {
        emit(path, [...steps, edge.phrase], "dangling", null);
        continue;
      }
      if (edge.spent) {
        const by = spender(edge.to.id, node.id);
        const note = by ? `already used up on ${by}` : "already used up";
        emit(
          [...path, edge.to.id],
          [...steps, `${edge.phrase} (${note})`],
          "consumed",
          null,
        );
        continue;
      }
      const at = path.indexOf(edge.to.id);
      if (at !== -1) {
        const cycle = [...path.slice(at), edge.to.id];
        emit(
          [...path, edge.to.id],
          [...steps, `${edge.phrase} (${stateOf(edge.to, false)})`],
          "cycle",
          cycle,
        );
        continue;
      }
      visit(edge.to, [...path, edge.to.id], [...steps, edge.phrase]);
    }
  };

  visit(target, [target.id], []);
  return chains;
}

export interface StuckAnalysis {
  entries: StuckEntry[];
  pinNodeIds: string[];
  blockingNodeIds: string[];
}

/** Explain a deadlock: reason chains for each exit and each unopened lock. */
export function analyzeStuck(
  nodes: EngineNode[],
  byId: NodeMap,
  state: WalkState & { trace: TraceStep[] },
): StuckAnalysis {
  const entries: StuckEntry[] = [];
  const exits = nodes.filter((n) => n.kind === "exit");
  const locks = nodes.filter((n) => n.kind === "lock" && !state.opened.has(n.id));
  for (const exit of exits) {
    entries.push({
      nodeId: exit.id,
      kind: "exit",
      chains: buildChains(exit, byId, state),
    });
  }
  for (const lock of locks) {
    entries.push({
      nodeId: lock.id,
      kind: "lock",
      chains: buildChains(lock, byId, state),
    });
  }

  const pins: string[] = [];
  const blocking: string[] = [];
  const add = (list: string[], id: string) => {
    if (!list.includes(id)) list.push(id);
  };
  for (const entry of entries) {
    for (const chain of entry.chains) {
      if (chain.cycle) {
        for (const id of chain.cycle.slice(0, -1)) add(pins, id);
      }
      if (entry.kind === "exit") chain.nodeIds.forEach((id) => add(blocking, id));
    }
  }
  if (pins.length === 0) {
    for (const entry of entries) {
      for (const chain of entry.chains) {
        const last = chain.nodeIds[chain.nodeIds.length - 1];
        if (last && byId.get(last)?.kind !== "exit") add(pins, last);
      }
    }
  }
  return { entries, pinNodeIds: pins, blockingNodeIds: blocking };
}
