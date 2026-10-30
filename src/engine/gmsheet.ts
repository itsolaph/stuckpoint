import type { EngineNode, PlaytestResult } from "./types";

export interface HintLadderInput {
  nodeId: string;
  /** Ordered nudge -> direction -> answer. */
  hints: string[];
}

const LEVELS = ["Nudge", "Direction", "Answer"];

function describeStep(action: string, node: EngineNode, byId: Map<string, EngineNode>) {
  const where = node.containerId ? byId.get(node.containerId) : undefined;
  const from = where ? ` from ${where.name}` : "";
  switch (action) {
    case "obtain":
      return `Players take **${node.name}**${from}.`;
    case "read":
      return `Players read **${node.name}**${from}.`;
    case "open": {
      const needs = node.requires
        .map((id) => byId.get(id)?.name)
        .filter(Boolean)
        .join(", ");
      return `Players open **${node.name}**${needs ? ` using ${needs}` : ""}.`;
    }
    default:
      return `Players leave through **${node.name}**. The room is escaped.`;
  }
}

/**
 * Deterministic game-master sheet: walkthrough from the playtest trace, props
 * per stage, and the hint ladders. A stage ends each time a lock opens.
 */
export function buildGmSheet(input: {
  title: string;
  story: string;
  nodes: EngineNode[];
  result: PlaytestResult;
  ladders: HintLadderInput[];
}): string {
  const { title, story, nodes, result, ladders } = input;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const lines: string[] = [`# ${title} — game master sheet`, ""];
  if (story.trim()) lines.push(story.trim(), "");

  lines.push(
    `**Playtest verdict:** ${result.verdict === "escaped" ? "Escaped" : "Stuck"} · ` +
      `${nodes.length} nodes · critical path ${result.criticalPathDepth} hops`,
    "",
  );
  if (result.verdict !== "escaped") {
    lines.push(
      "> This room did not pass the playtest. Fix the blocking chain below before running it with players.",
      "",
    );
    for (const entry of result.stuckAnalysis.filter((e) => e.kind === "exit")) {
      for (const chain of entry.chains) lines.push(`- ${chain.text}`);
    }
    lines.push("");
  }

  lines.push("## Walkthrough", "");
  const stages: string[][] = [[]];
  let n = 0;
  for (const step of result.trace) {
    const node = byId.get(step.nodeId);
    if (!node) continue;
    const optional = result.optional.includes(node.id) ? " _(optional)_" : "";
    n += 1;
    lines.push(`${n}. ${describeStep(step.action, node, byId)}${optional}`);
    if (step.action !== "exit") stages[stages.length - 1]?.push(node.name);
    if (step.action === "open") stages.push([]);
  }
  lines.push("");

  lines.push("## Props by stage", "");
  stages.forEach((props, i) => {
    if (props.length === 0) return;
    lines.push(`**Stage ${i + 1}**`, "", ...props.map((p) => `- ${p}`), "");
  });
  if (result.unreachable.length > 0) {
    lines.push(
      "**Never used by the walker (cut or reconnect)**",
      "",
      ...result.unreachable.map((id) => `- ${byId.get(id)?.name ?? id}`),
      "",
    );
  }

  lines.push("## Hint ladders", "");
  const withHints = ladders.filter((l) => byId.has(l.nodeId) && l.hints.length > 0);
  if (withHints.length === 0) {
    lines.push("_No hint ladders saved yet._", "");
  }
  for (const ladder of withHints) {
    lines.push(`### ${byId.get(ladder.nodeId)!.name}`, "");
    ladder.hints.forEach((h, i) => {
      lines.push(`${i + 1}. **${LEVELS[i] ?? `Level ${i + 1}`}:** ${h}`);
    });
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}
