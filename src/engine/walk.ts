import { analyzeStuck } from "./analysis";
import { isAvailable, isDone, type WalkState } from "./state";
import type {
  EngineNode,
  PlaytestResult,
  StepAction,
  TraceStep,
} from "./types";

interface State extends WalkState {
  escaped: boolean;
  trace: TraceStep[];
}

const ACTION_FOR: Record<EngineNode["kind"], StepAction> = {
  item: "obtain",
  clue: "read",
  lock: "open",
  exit: "exit",
};

/** Upper bound on search states when single-use items force ordering decisions. */
const SEARCH_BUDGET = 5000;

type NodeMap = Map<string, EngineNode>;

function emptyState(): State {
  return {
    obtained: new Set(),
    read: new Set(),
    opened: new Set(),
    consumed: new Set(),
    escaped: false,
    trace: [],
  };
}

function cloneState(s: State): State {
  return {
    obtained: new Set(s.obtained),
    read: new Set(s.read),
    opened: new Set(s.opened),
    consumed: new Set(s.consumed),
    escaped: s.escaped,
    trace: s.trace.slice(),
  };
}

function singleUseRequirements(node: EngineNode, byId: NodeMap): string[] {
  if (node.kind === "exit") return [];
  return node.requires.filter((id) => {
    const r = byId.get(id);
    return r?.kind === "item" && r.singleUse;
  });
}

function canAct(s: State, node: EngineNode, byId: NodeMap): boolean {
  if (isDone(s, node)) return false;
  if (node.containerId !== null) {
    const c = byId.get(node.containerId);
    if (!c || c.kind !== "lock" || !s.opened.has(c.id)) return false;
  }
  return node.requires.every((id) => {
    const r = byId.get(id);
    return r ? isAvailable(s, r) : false;
  });
}

function apply(s: State, node: EngineNode, byId: NodeMap) {
  for (const id of singleUseRequirements(node, byId)) s.consumed.add(id);
  if (node.kind === "item") s.obtained.add(node.id);
  else if (node.kind === "clue") s.read.add(node.id);
  else if (node.kind === "lock") s.opened.add(node.id);
  else s.escaped = true;
  s.trace.push({ action: ACTION_FOR[node.kind], nodeId: node.id });
}

/** Apply every action that spends nothing, until a full pass changes nothing. */
function saturate(s: State, nodes: EngineNode[], byId: NodeMap) {
  let changed = true;
  while (changed && !s.escaped) {
    changed = false;
    for (const node of nodes) {
      if (s.escaped) return;
      if (!canAct(s, node, byId)) continue;
      if (singleUseRequirements(node, byId).length > 0) continue;
      apply(s, node, byId);
      changed = true;
    }
  }
}

/**
 * Fixed-point walk. Actions that spend nothing are order-independent, so they
 * are applied eagerly. Actions that spend a single-use item are the only real
 * decisions; those are explored depth-first (declaration order first), so a
 * room is only called stuck when no spending order escapes.
 */
function walk(nodes: EngineNode[], byId: NodeMap): State {
  let greedyFinal: State | null = null;
  let budget = SEARCH_BUDGET;
  const seen = new Set<string>();

  const solve = (s: State): State | null => {
    saturate(s, nodes, byId);
    if (s.escaped) return s;
    const choices = nodes.filter(
      (n) => canAct(s, n, byId) && singleUseRequirements(n, byId).length > 0,
    );
    if (choices.length === 0) {
      greedyFinal ??= s;
      return null;
    }
    const key =
      [...s.consumed].sort().join(",") +
      "|" +
      [...s.opened, ...s.obtained, ...s.read].sort().join(",");
    if (seen.has(key) || budget-- <= 0) return null;
    seen.add(key);
    for (const choice of choices) {
      const next = cloneState(s);
      apply(next, choice, byId);
      const won = solve(next);
      if (won) return won;
    }
    return null;
  };

  return solve(emptyState()) ?? greedyFinal ?? emptyState();
}

/** Ids the exits depend on, following requirements and containers backwards. */
function requiredSet(nodes: EngineNode[], byId: NodeMap) {
  const required = new Set<string>();
  const visit = (id: string) => {
    if (required.has(id)) return;
    const n = byId.get(id);
    if (!n) return;
    required.add(id);
    n.requires.forEach(visit);
    if (n.containerId) visit(n.containerId);
  };
  for (const e of nodes.filter((n) => n.kind === "exit")) {
    e.requires.forEach(visit);
  }
  return required;
}

function criticalPathDepth(nodes: EngineNode[], byId: NodeMap) {
  const memo = new Map<string, number>();
  const depth = (id: string, path: Set<string>): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    const n = byId.get(id);
    if (!n) return 0;
    path.add(id);
    let best = 0;
    const deps = [...n.requires, ...(n.containerId ? [n.containerId] : [])];
    for (const d of deps) {
      if (path.has(d) || !byId.has(d)) continue;
      best = Math.max(best, 1 + depth(d, path));
    }
    path.delete(id);
    memo.set(id, best);
    return best;
  };
  let max = 0;
  for (const e of nodes.filter((n) => n.kind === "exit")) {
    max = Math.max(max, depth(e.id, new Set()));
  }
  return max;
}

function structuralWarnings(nodes: EngineNode[], byId: NodeMap) {
  const warnings: string[] = [];
  if (!nodes.some((n) => n.kind === "exit")) {
    warnings.push("The room has no exit, so it can never be escaped.");
  }
  for (const n of nodes) {
    if (n.containerId) {
      const c = byId.get(n.containerId);
      if (!c) {
        warnings.push(`"${n.name}" is stored in a node that no longer exists.`);
      } else if (c.kind !== "lock") {
        warnings.push(`"${n.name}" is stored in "${c.name}", which is not a lock.`);
      }
    }
    for (const r of n.requires) {
      const target = byId.get(r);
      if (!target) {
        warnings.push(`"${n.name}" requires a node that no longer exists.`);
      } else if (r === n.id) {
        warnings.push(`"${n.name}" requires itself.`);
      } else if (target.kind === "exit") {
        warnings.push(`"${n.name}" requires an exit, which can never be satisfied.`);
      }
    }
  }
  return warnings;
}

/** Play a room like a player and report the verdict, trace and deadlock analysis. */
export function playtest(input: EngineNode[]): PlaytestResult {
  const nodes = input.map((n) => ({ ...n, requires: [...n.requires] }));
  const byId: NodeMap = new Map(nodes.map((n) => [n.id, n]));
  const final = walk(nodes, byId);
  const verdict = final.escaped ? "escaped" : "stuck";

  const reached = new Set([...final.obtained, ...final.read, ...final.opened]);
  const playable = nodes.filter((n) => n.kind !== "exit");
  const unreachable = playable.filter((n) => !reached.has(n.id)).map((n) => n.id);
  const required = requiredSet(nodes, byId);
  const optional = playable
    .filter((n) => reached.has(n.id) && !required.has(n.id))
    .map((n) => n.id);

  const analysis =
    verdict === "stuck"
      ? analyzeStuck(nodes, byId, final)
      : { entries: [], pinNodeIds: [], blockingNodeIds: [] };

  return {
    verdict,
    trace: final.trace,
    stuckAnalysis: analysis.entries,
    unreachable,
    optional,
    criticalPathDepth: criticalPathDepth(nodes, byId),
    pinNodeIds: analysis.pinNodeIds,
    blockingNodeIds: analysis.blockingNodeIds,
    warnings: structuralWarnings(nodes, byId),
  };
}
