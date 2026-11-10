import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { useState } from "react";
import { useNavigate } from "react-router";

import type { NodeKind, PlaytestAnalysis } from "@/lib/room-kinds";

interface VerdictPanelProps {
  roomId: string;
  /** Null until the room has been playtested at least once. */
  analysis: PlaytestAnalysis | null;
  stale: boolean;
  names: Map<string, string>;
  kinds: Map<string, NodeKind>;
  /** Index of the step the token is on while playing, else null. */
  playingIndex: number | null;
  onFocusNode: (id: string) => void;
}

const ACTION_VERB: Record<string, string> = {
  obtain: "Take",
  read: "Read",
  open: "Open",
  exit: "Exit",
};

/** "Red safelight" -> "red safelight"; acronyms like "UV flashlight" stay as typed. */
export function lowerFirst(name: string): string {
  return /^[A-Z][a-z]/.test(name) ? name.charAt(0).toLowerCase() + name.slice(1) : name;
}

export function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function stepsDeep(depth: number): string {
  return `${depth} ${depth === 1 ? "step" : "steps"} deep`;
}

/** "a, b and c" */
function listing(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * The verdict slab docked under the canvas: verdict word on the left, the
 * blocking chain (or the route) in the middle, the next action on the right.
 * Rendered only once the room has a playtest.
 */
export function VerdictPanel({
  roomId,
  analysis,
  stale,
  names,
  kinds,
  playingIndex,
  onFocusNode,
}: VerdictPanelProps) {
  const navigate = useNavigate();
  const [showSteps, setShowSteps] = useState(false);
  const [showMoves, setShowMoves] = useState(false);
  if (!analysis) return null;

  const playing = playingIndex !== null;
  const state = playing ? "walking" : stale ? "stale" : analysis.verdict;
  const word = playing
    ? "Walking"
    : stale
      ? "Stale"
      : analysis.verdict === "stuck"
        ? "Stuck"
        : "Escaped";
  const settled = !playing && !stale ? analysis : null;

  const exitChains = analysis.stuckAnalysis
    .filter((e) => e.kind === "exit")
    .flatMap((e) => e.chains);
  const chain = exitChains[0] ?? null;
  const name = (id: string) => names.get(id) ?? id;

  const askAgent = (message: string) =>
    sendToAgentChat({
      message,
      context: JSON.stringify({ roomId }),
      submit: true,
      openSidebar: true,
    });

  const subline = playing
    ? `Step ${playingIndex + 1} of ${analysis.trace.length}`
    : stale
      ? `Last run was ${analysis.verdict}`
      : analysis.verdict === "escaped"
        ? `${analysis.trace.length} ${analysis.trace.length === 1 ? "step" : "steps"} to the exit`
        : stepsDeep(analysis.criticalPathDepth);

  const chip = (id: string, i: number, opts: { numbered?: boolean; active?: boolean } = {}) => {
    const kind = kinds.get(id);
    const verb = opts.numbered ? ACTION_VERB[analysis.trace[i]?.action ?? ""] : null;
    return (
      <button
        type="button"
        className="db-chip-node db-kind"
        data-kind={kind}
        data-active={opts.active ? "true" : "false"}
        onClick={() => onFocusNode(id)}
      >
        {opts.numbered ? (
          <span className="db-step-no">{i + 1}</span>
        ) : (
          <span className="db-swatch" aria-hidden="true" />
        )}
        {verb ? `${verb} ${lowerFirst(name(id))}` : name(id)}
      </button>
    );
  };

  const route = (active: number | null) => (
    <ol className="db-chips" aria-label="Walker trace">
      {analysis.trace.map((s, i) => (
        <li key={i}>{chip(s.nodeId, i, { numbered: true, active: active === i })}</li>
      ))}
    </ol>
  );

  return (
    <section className="db-verdict" data-verdict={state} aria-label="Playtest verdict">
      <div>
        <div className="db-verdict-word" role="status" aria-live="polite">
          {word}
        </div>
        <div className="db-slab-sub">{subline}</div>
      </div>

      <div className="db-slab-mid">
        {playing ? route(playingIndex) : null}

        {stale ? (
          <p className="db-slab-text">
            Nodes were edited after this run, so it no longer proves anything.
            Press Playtest to walk the room again.
          </p>
        ) : null}

        {settled?.verdict === "stuck" ? (
          chain ? (
            <>
              <ol className="db-chips" data-tone="stuck" aria-label="Blocking chain">
                {chain.nodeIds.map((id, i) => (
                  <li key={`${id}-${i}`}>{chip(id, i)}</li>
                ))}
              </ol>
              <ol className="db-chain" data-open={showSteps ? "true" : "false"}>
                <li className="db-chain-cycle">
                  {chain.cycle
                    ? `Requirement cycle: ${listing(
                        chain.cycle.slice(0, -1).map((id) => lowerFirst(name(id))),
                      )} wait on each other in a loop.`
                    : sentenceCase(chain.steps[chain.steps.length - 1] ?? chain.text)}
                </li>
                {chain.steps.map((s, j) => (
                  <li key={j} className="db-chain-step">
                    {sentenceCase(s)}
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap gap-x-5">
                <button
                  type="button"
                  className="db-btn db-btn--link"
                  aria-expanded={showSteps}
                  onClick={() => setShowSteps((v) => !v)}
                >
                  {showSteps ? "Hide the steps" : `Show all ${chain.steps.length} steps`}
                </button>
                {analysis.trace.length > 0 ? (
                  <button
                    type="button"
                    className="db-btn db-btn--link"
                    aria-expanded={showMoves}
                    onClick={() => setShowMoves((v) => !v)}
                  >
                    {showMoves
                      ? "Hide what players can still do"
                      : `What players can still do (${analysis.trace.length})`}
                  </button>
                ) : null}
                {exitChains.length > 1 ? (
                  <span className="db-slab-text self-center">
                    {exitChains.length - 1} more blocking{" "}
                    {exitChains.length === 2 ? "chain" : "chains"} after this one
                  </span>
                ) : null}
              </div>
              {showMoves ? route(null) : null}
            </>
          ) : (
            <p className="db-slab-text">The exit has no way to be reached.</p>
          )
        ) : null}

        {settled?.verdict === "escaped" ? (
          <>
            {route(null)}
            <p className="db-slab-text">
              {settled.unreachable.length > 0
                ? `${settled.unreachable.length} ${settled.unreachable.length === 1 ? "node is" : "nodes are"} never reached. `
                : "Every node is reachable. "}
              {settled.optional.length > 0
                ? `${settled.optional.length} ${settled.optional.length === 1 ? "is" : "are"} optional.`
                : "None are optional."}
            </p>
          </>
        ) : null}

        {analysis.warnings.length > 0 && !playing ? (
          <ul className="db-slab-text m-0 list-none p-0">
            {analysis.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="db-slab-actions">
        {settled?.verdict === "stuck" ? (
          <>
            <button
              type="button"
              className="db-btn db-btn--ghost"
              onClick={() =>
                askAgent("Why is this room stuck? Explain the blocking chain in plain words.")
              }
            >
              Ask why
            </button>
            <button
              type="button"
              className="db-btn db-btn--primary"
              onClick={() =>
                askAgent(
                  "Propose the smallest fix for the deadlock as action calls, apply it, then run-playtest again.",
                )
              }
            >
              Propose a fix
            </button>
          </>
        ) : null}
        {settled?.verdict === "escaped" ? (
          <button
            type="button"
            className="db-btn db-btn--primary"
            onClick={() => navigate(`/rooms/${roomId}/sheet`)}
          >
            GM sheet
          </button>
        ) : null}
      </div>
    </section>
  );
}
