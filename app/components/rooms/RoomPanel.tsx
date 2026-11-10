import { IconTrash, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RoomPanelProps {
  title: string;
  story: string;
  onRename: (title: string) => void;
  onStory: (story: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

/** Room-level settings shown when no node is selected. */
export function RoomPanel({
  title,
  story,
  onRename,
  onStory,
  onDelete,
  onClose,
}: RoomPanelProps) {
  const [t, setT] = useState(title);
  const [s, setS] = useState(story);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => setT(title), [title]);
  useEffect(() => setS(story), [story]);

  return (
    <aside className="db-inspector" aria-label="Room details">
      <div className="db-inspector-head">
        <h2 className="db-inspector-title">Room settings</h2>
        <button
          type="button"
          className="db-btn db-btn--sm db-btn--quiet db-btn--icon"
          onClick={onClose}
          aria-label="Close room details"
        >
          <IconX size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="db-field">
        <label className="db-label" htmlFor="room-title">
          Title
        </label>
        <input
          id="room-title"
          className="db-input"
          value={t}
          maxLength={120}
          onChange={(e) => setT(e.target.value)}
          onBlur={() => {
            const next = t.trim();
            if (next && next !== title) onRename(next);
            else setT(title);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </div>
      <div className="db-field">
        <label className="db-label" htmlFor="room-story">
          Story
        </label>
        <textarea
          id="room-story"
          className="db-textarea"
          rows={6}
          value={s}
          maxLength={4000}
          onChange={(e) => setS(e.target.value)}
          onBlur={() => {
            if (s.trim() !== story) onStory(s.trim());
          }}
        />
      </div>
      <button
        type="button"
        className="db-btn db-btn--sm db-btn--danger self-start"
        onClick={() => setConfirming(true)}
      >
        <IconTrash size={16} aria-hidden="true" />
        Delete room
      </button>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this room?</AlertDialogTitle>
            <AlertDialogDescription>
              The room, its nodes, playtests, hint ladders and GM sheets are
              removed permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep room</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Delete room</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
