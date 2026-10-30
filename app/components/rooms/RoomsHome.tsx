import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import { SAMPLE_ROOMS, SAMPLE_KEYS } from "../../../src/samples";

import { NewRoomDialog } from "./NewRoomDialog";

export function RoomsHome() {
  const navigate = useNavigate();
  const { data, isLoading } = useActionQuery("list-rooms", {});
  const [dialogOpen, setDialogOpen] = useState(false);
  const loadSample = useActionMutation("load-sample-room", {
    onSuccess: (room) => navigate(`/rooms/${room.id}`),
    onError: (e) =>
      toast.error(actionErrorMessage(e) ?? "Could not load the sample room."),
  });
  const createRoom = useActionMutation("create-room", {
    onError: (e) =>
      toast.error(actionErrorMessage(e) ?? "Could not create the room."),
  });

  async function buildFromDescription(title: string, description: string) {
    const room = await createRoom.mutateAsync({
      title,
      story: description.slice(0, 600),
    });
    setDialogOpen(false);
    navigate(`/rooms/${room.id}`);
    if (!description) return;
    sendToAgentChat({
      message:
        `Build the escape room "${room.title}" from this description. ` +
        `Use one create-nodes call for room ${room.id}, then run-playtest and report the real verdict.\n\n${description}`,
      context: JSON.stringify({ roomId: room.id }),
      submit: true,
      openSidebar: true,
    });
  }

  const rooms = data?.rooms ?? [];

  return (
    <div className="db-home">
      <div className="db-section-head">
        <h2>Rooms</h2>
        <button
          type="button"
          className="db-btn db-btn--primary"
          onClick={() => setDialogOpen(true)}
        >
          <IconPlus size={16} stroke={2} aria-hidden="true" />
          New room
        </button>
      </div>

      {isLoading ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : rooms.length === 0 ? (
        <p className="db-empty">
          No rooms yet. Describe one and the agent will draw it, or load a
          sample below.
        </p>
      ) : (
        <ul className="m-0 list-none p-0">
          {rooms.map((room) => (
            <li key={room.id}>
              <Link to={`/rooms/${room.id}`} className="db-room-row">
                <div className="min-w-0">
                  <div className="db-room-title">{room.title}</div>
                  <div className="db-room-meta">
                    {room.nodeCount} {room.nodeCount === 1 ? "node" : "nodes"}
                  </div>
                </div>
                {room.verdict ? (
                  <span className={`db-chip db-chip--${room.verdict}`}>
                    {room.verdict}
                  </span>
                ) : (
                  <span className="db-chip">not playtested</span>
                )}
                <span className="db-mono text-[var(--db-muted)]">Open</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="db-section-head" style={{ marginTop: "2.5rem" }}>
        <h2>Sample rooms</h2>
      </div>
      <div className="db-sample-grid">
        {SAMPLE_KEYS.map((key) => {
          const sample = SAMPLE_ROOMS[key];
          const loading =
            loadSample.isPending && loadSample.variables?.sample === key;
          return (
            <div key={key} className="db-sample">
              <div className="db-room-title">{sample.title}</div>
              <p>{sample.blurb}</p>
              <button
                type="button"
                className="db-btn"
                disabled={loadSample.isPending}
                onClick={() => loadSample.mutate({ sample: key })}
              >
                {loading ? "Loading…" : "Load sample"}
              </button>
            </div>
          );
        })}
      </div>

      {dialogOpen ? (
        <NewRoomDialog
          pending={createRoom.isPending}
          onClose={() => setDialogOpen(false)}
          onSubmit={buildFromDescription}
        />
      ) : null}
    </div>
  );
}
