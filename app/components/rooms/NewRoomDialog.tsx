import { useEffect, useRef, useState } from "react";

interface NewRoomDialogProps {
  pending: boolean;
  onClose: () => void;
  onSubmit: (title: string, description: string) => void | Promise<void>;
}

/** Title plus a pasted description; the agent turns the description into nodes. */
export function NewRoomDialog({ pending, onClose, onSubmit }: NewRoomDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSubmit = title.trim().length > 0 && !pending;

  return (
    <div
      className="db-dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-room-heading"
        className="db-dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) void onSubmit(title.trim(), description.trim());
        }}
      >
        <h2 id="new-room-heading">New room</h2>
        <div className="db-field">
          <label className="db-label" htmlFor="new-room-title">
            Title
          </label>
          <input
            id="new-room-title"
            ref={titleRef}
            className="db-input"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="The Lighthouse Keeper"
          />
        </div>
        <div className="db-field">
          <label className="db-label" htmlFor="new-room-description">
            Describe the room (optional)
          </label>
          <textarea
            id="new-room-description"
            className="db-textarea"
            rows={8}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Players wake in a lighthouse. A brass key opens the lamp room, but it is locked in the keeper's chest. The chest code is on a tide table hidden in the logbook…"
          />
        </div>
        <p className="m-0 text-[0.9375rem] text-[var(--db-muted)]">
          With a description, the agent builds the cards on the canvas and
          playtests the result. Without one you get an empty canvas.
        </p>
        <div className="db-dialog-actions">
          <button type="button" className="db-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="db-btn db-btn--primary"
            disabled={!canSubmit}
          >
            {pending ? "Creating…" : description.trim() ? "Create and build" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
