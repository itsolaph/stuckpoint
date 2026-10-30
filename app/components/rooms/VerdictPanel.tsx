import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { useState } from "react";

import type { PlaytestAnalysis } from "@/lib/room-kinds";

interface VerdictPanelProps {
  roomId: string;
  analysis: PlaytestAnalysis;
  stale: boolean;
  names: Map<string, string>;
  /** Index of the step the token is on while playing, else null. */
  playingIndex: number | null;
  onFocusNode: (id: string) => void;
}

const ACTION_VERB: Record<string, string> = {
  obtain: "take",
  read: "read",
  open: "open",
  exit: "exit",
};

export function VerdictPanel({
  roomId,
  analysis,
  stale,
  names,
  playingIndex,
  onFocusNode,
}: VerdictPanelProps) {
  const [open, setOpen] = useState(true);
  const playing = playingIndex !== null;
  const state = playing ? analysis.verdict : stale ? "stale" : analysis.verdict;
  const exitChains = analysis.stuckAnalysis
    .filter((e) => e.kind === "exit")
    .flatMap((e) => e.chains);
  const word = playing ? "Walking" : stale ? "Stale" : analysis.verdict;

  const askAgent = (message: string) =>
    sendToAgentChat({
      message,
      context: JSON.stringify({ roomId }),
      submit: true,
      openSidebar: true,
    });

  return (
    <section
      className="db-verdict"
      data-verdict={playing ? "walking" : state}
      aria-label="Playtest verdict"
    >
      <div className="db-verdict-head">
        <span className="db-verdict-word" role="status" aria-live="polite">
          {word}
        </span>
        <span className="db-mono flex-1 text-[var(--db-muted)]">
          {playing
            ? `step ${playingIndex + 1} of ${analysis.trace.length}`
            : stale
              ? `room changed since the last ${analysis.verdict} run`
              : analysis.verdict === "escaped"
                ? `${analysis.trace.length} steps · depth ${analysis.criticalPathDepth}`
                : `deadlocked · depth ${analysis.criticalPathDepth}`}
        </span>
        <button
          type="button"
          className="db-btn db-btn--sm"
          aria-expanded={open}
          aria-label={open ? "Collapse verdict" : "Expand verdict"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <IconChevronDown size={16} aria-hidden="true" />
          ) : (
            <IconChevronUp size={16} aria-hidden="true" />
          )}
        </button>
      </div>

      {open ? (
        <div className="db-verdict-body">
          {!playing && !stale && analysis.verdict === "stuck" ? (
            <>
              <h3 className="db-label mt-3 mb-0">Blocking chain</h3>
              {exitChains.length === 0 ? (
                <p className="db-notes">The exit has no way to be reached.</p>
              ) : (
                <ul className="db-chain">
                  {exitChains.map((c, i) => (
                    <li key={i}>{c.text}</li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="db-btn db-btn--sm"
                  onClick={() =>
                    askAgent("Why is this room stuck? Explain the blocking chain in plain words.")
                  }
                >
                  Ask why
                </button>
                <button
                  type="button"
                  className="db-btn db-btn--sm"
                  onClick={() =>
                    askAgent("Propose the smallest fix for the deadlock as action calls, apply it, then run-playtest again.")
                  }
                >
                  Propose a fix
                </button>
              </div>
            </>
          ) : null}

          {!playing && !stale && analysis.verdict === "escaped" ? (
            <p className="db-notes">
              The walker escaped.{" "}
              {analysis.unreachable.length > 0
                ? `${analysis.unreachable.length} node(s) are never reached. `
                : "Every node is reachable. "}
              {analysis.optional.length > 0
                ? `${analysis.optional.length} are optional.`
                : "None are optional."}
            </p>
          ) : null}

          {stale ? (
            <p className="db-notes">
              Nodes were edited after this run, so it no longer proves
              anything. Press PLAYTEST to walk the room again.
            </p>
          ) : null}

          {analysis.warnings.length > 0 ? (
            <ul className="db-notes">
              {analysis.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          ) : null}

          <ol className="db-trace" aria-label="Walker trace">
            {analysis.trace.map((s, i) => (
              <li key={i} data-active={playing && i === playingIndex ? "true" : "false"}>
                <button
                  type="button"
                  className="cursor-pointer border-0 bg-transparent p-0 text-inherit"
                  style={{ font: "inherit" }}
                  onClick={() => onFocusNode(s.nodeId)}
                >
                  {ACTION_VERB[s.action] ?? s.action} {names.get(s.nodeId) ?? s.nodeId}
                </button>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
