import { sendToAgentChat } from "@agent-native/core/client/agent-chat";

import type { PlaytestAnalysis } from "@/lib/room-kinds";

interface VerdictPanelProps {
  roomId: string;
  /** Null until the room has been playtested at least once. */
  analysis: PlaytestAnalysis | null;
  stale: boolean;
  names: Map<string, string>;
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

const MAX_CHAINS_SHOWN = 3;

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

/** Docked right-hand panel: verdict word, blocking chain, and the walker's moves. */
export function VerdictPanel({
  roomId,
  analysis,
  stale,
  names,
  playingIndex,
  onFocusNode,
}: VerdictPanelProps) {
  const playing = playingIndex !== null && analysis !== null;
  const state = !analysis ? "idle" : playing ? "walking" : stale ? "stale" : analysis.verdict;
  const word = !analysis
    ? "Not tested"
    : playing
      ? "Walking"
      : stale
        ? "Stale"
        : analysis.verdict;
  const settled = analysis && !playing && !stale ? analysis : null;

  const exitChains = analysis
    ? analysis.stuckAnalysis.filter((e) => e.kind === "exit").flatMap((e) => e.chains)
    : [];

  const askAgent = (message: string) =>
    sendToAgentChat({
      message,
      context: JSON.stringify({ roomId }),
      submit: true,
      openSidebar: true,
    });

  const subline = !analysis
    ? "No playtest yet"
    : playing
      ? `step ${playingIndex + 1} of ${analysis.trace.length}`
      : stale
        ? `room changed since the last ${analysis.verdict} run`
        : analysis.verdict === "escaped"
          ? `${analysis.trace.length} steps to escape`
          : `deadlocked, ${stepsDeep(analysis.criticalPathDepth)}`;

  return (
    <aside className="db-verdict" data-verdict={state} aria-label="Playtest verdict">
      <div className="db-dock-head">
        <span className="db-verdict-word" role="status" aria-live="polite">
          {word}
        </span>
        <span className="db-dock-sub">{subline}</span>
      </div>

      <div className="db-dock-body">
        {!analysis ? (
          <p className="db-notes">
            Press Playtest and a walker will play this room like a player,
            step by step. If it deadlocks, the exact blocking chain shows up
            here.
          </p>
        ) : null}

        {settled?.verdict === "stuck" ? (
          <>
            <h3 className="db-label mt-1 mb-0">Blocking chain</h3>
            {exitChains.length === 0 ? (
              <p className="db-notes">The exit has no way to be reached.</p>
            ) : (
              <div className="db-chains">
                {exitChains.slice(0, MAX_CHAINS_SHOWN).map((c, i) => (
                  <ol key={i} className="db-chain">
                    {c.cycle ? (
                      <li className="db-chain-cycle">
                        Requirement cycle:{" "}
                        {c.cycle
                          .map((id) => lowerFirst(names.get(id) ?? id))
                          .join(" \u2192 ")}
                      </li>
                    ) : null}
                    {c.steps.map((s, j) => (
                      <li key={j} className="db-chain-step">
                        {sentenceCase(s)}
                      </li>
                    ))}
                  </ol>
                ))}
              </div>
            )}
            {exitChains.length > MAX_CHAINS_SHOWN ? (
              <p className="db-notes">
                +{exitChains.length - MAX_CHAINS_SHOWN} more blocking chains
              </p>
            ) : null}
            <div className="db-dock-actions">
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
              <button
                type="button"
                className="db-btn"
                onClick={() =>
                  askAgent("Why is this room stuck? Explain the blocking chain in plain words.")
                }
              >
                Ask why
              </button>
            </div>
          </>
        ) : null}

        {settled?.verdict === "escaped" ? (
          <p className="db-notes">
            The walker escaped.{" "}
            {settled.unreachable.length > 0
              ? `${settled.unreachable.length} node(s) are never reached. `
              : "Every node is reachable. "}
            {settled.optional.length > 0
              ? `${settled.optional.length} are optional.`
              : "None are optional."}
          </p>
        ) : null}

        {analysis && stale ? (
          <p className="db-notes">
            Nodes were edited after this run, so it no longer proves anything.
            Press Playtest to walk the room again.
          </p>
        ) : null}

        {analysis && analysis.warnings.length > 0 ? (
          <ul className="db-notes">
            {analysis.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        ) : null}

        {analysis && analysis.trace.length > 0 ? (
          <>
            <h3 className="db-label mt-4 mb-0">
              {settled?.verdict === "stuck" ? "Player could still do:" : "Walkthrough:"}
            </h3>
            <ol className="db-trace" aria-label="Walker trace">
              {analysis.trace.map((s, i) => (
                <li key={i} data-active={playing && i === playingIndex ? "true" : "false"}>
                  <button type="button" onClick={() => onFocusNode(s.nodeId)}>
                    {ACTION_VERB[s.action] ?? sentenceCase(s.action)}{" "}
                    {lowerFirst(names.get(s.nodeId) ?? s.nodeId)}
                  </button>
                </li>
              ))}
            </ol>
          </>
        ) : null}
      </div>
    </aside>
  );
}
