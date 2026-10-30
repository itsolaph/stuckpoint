import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { IconTrash, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { KINDS, KIND_META, type NodeKind, type RoomNode } from "@/lib/room-kinds";

export interface NodePatch {
  name?: string;
  note?: string;
  kind?: NodeKind;
  containerId?: string | null;
  requires?: string[];
  singleUse?: boolean;
}

interface NodeInspectorProps {
  node: RoomNode;
  allNodes: RoomNode[];
  hints: string[] | null;
  onPatch: (patch: NodePatch) => void;
  onDelete: () => void;
  onClose: () => void;
}

const HINT_LABELS = ["Nudge", "Direction", "Answer"];

/** Edits one node: name, kind, note, container and requirements. */
export function NodeInspector({
  node,
  allNodes,
  hints,
  onPatch,
  onDelete,
  onClose,
}: NodeInspectorProps) {
  const [name, setName] = useState(node.name);
  const [note, setNote] = useState(node.note);

  useEffect(() => {
    setName(node.name);
    setNote(node.note);
  }, [node.id, node.name, node.note]);

  const locks = allNodes.filter((n) => n.kind === "lock" && n.id !== node.id);
  const requirable = allNodes.filter((n) => n.kind !== "exit" && n.id !== node.id);
  const canBeSingleUse = node.kind === "item";

  function commitName() {
    const next = name.trim();
    if (next && next !== node.name) onPatch({ name: next });
    else setName(node.name);
  }

  function toggleRequirement(id: string, on: boolean) {
    const set = new Set(node.requires);
    if (on) set.add(id);
    else set.delete(id);
    onPatch({ requires: [...set] });
  }

  return (
    <aside className="db-inspector" aria-label="Selected node">
      <div className="db-inspector-head">
        <span className="db-chip">{KIND_META[node.kind].label}</span>
        <button
          type="button"
          className="db-btn db-btn--sm"
          onClick={onClose}
          aria-label="Close inspector"
        >
          <IconX size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="db-field">
        <label className="db-label" htmlFor="node-name">
          Name
        </label>
        <input
          id="node-name"
          className="db-input"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </div>

      <div className="db-field">
        <label className="db-label" htmlFor="node-kind">
          Kind
        </label>
        <select
          id="node-kind"
          className="db-select"
          value={node.kind}
          onChange={(e) => onPatch({ kind: e.target.value as NodeKind })}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_META[k].label}
            </option>
          ))}
        </select>
      </div>

      <div className="db-field">
        <label className="db-label" htmlFor="node-container">
          Stored inside
        </label>
        <select
          id="node-container"
          className="db-select"
          value={node.containerId ?? ""}
          onChange={(e) => onPatch({ containerId: e.target.value || null })}
        >
          <option value="">Nothing: lying in the open</option>
          {locks.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="db-field m-0 border-0 p-0">
        <legend className="db-label mb-1.5 p-0">Requires</legend>
        {requirable.length === 0 ? (
          <p className="m-0 text-[0.9375rem] text-[var(--db-muted)]">
            Add items, clues or locks to require them.
          </p>
        ) : (
          <div className="db-checklist">
            {requirable.map((r) => (
              <label key={r.id} className="db-check">
                <input
                  type="checkbox"
                  checked={node.requires.includes(r.id)}
                  onChange={(e) => toggleRequirement(r.id, e.target.checked)}
                />
                <span>{r.name}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      {canBeSingleUse ? (
        <label className="db-check p-0">
          <input
            type="checkbox"
            checked={node.singleUse}
            onChange={(e) => onPatch({ singleUse: e.target.checked })}
          />
          <span>Single use (consumed when used)</span>
        </label>
      ) : null}

      <div className="db-field">
        <label className="db-label" htmlFor="node-note">
          Designer note
        </label>
        <textarea
          id="node-note"
          className="db-textarea"
          rows={3}
          value={note}
          maxLength={1000}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if (note.trim() !== node.note) onPatch({ note: note.trim() });
          }}
        />
      </div>

      {node.kind === "lock" || node.kind === "clue" ? (
        <div className="db-field">
          <span className="db-label">Hint ladder</span>
          {hints && hints.length > 0 ? (
            <ol className="db-hints">
              {hints.map((h, i) => (
                <li key={i}>
                  <strong>{HINT_LABELS[i] ?? `Level ${i + 1}`}:</strong> {h}
                </li>
              ))}
            </ol>
          ) : (
            <p className="m-0 text-[0.9375rem] text-[var(--db-muted)]">
              No hints saved for this puzzle yet.
            </p>
          )}
          <button
            type="button"
            className="db-btn db-btn--sm"
            onClick={() =>
              sendToAgentChat({
                message: `Write a 3-level hint ladder (nudge, direction, answer) for "${node.name}" and save it with save-hint-ladder.`,
                context: JSON.stringify({ roomId: node.roomId, nodeId: node.id }),
                submit: true,
                openSidebar: true,
              })
            }
          >
            Ask the agent for hints
          </button>
        </div>
      ) : null}

      <button type="button" className="db-btn db-btn--danger" onClick={onDelete}>
        <IconTrash size={16} aria-hidden="true" />
        Delete node
      </button>
    </aside>
  );
}
