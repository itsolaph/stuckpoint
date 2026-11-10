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
import { KINDS, KIND_META, type NodeKind } from "@/lib/room-kinds";
import { SAMPLE_ROOMS, SAMPLE_KEYS } from "../../../src/samples";
import { relativeTime } from "../../../src/time";

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
      <section className="db-hero">
        <h1>Find the stuck point before your players do.</h1>
        <p>
          Lay out the locks, items and clues of your escape room, then press
          Playtest: a walker plays it like a team would and shows the exact
          chain that leaves players stuck.
        </p>
        <div className="db-hero-actions">
          <button
            type="button"
            className="db-btn db-btn--primary"
            onClick={() => setDialogOpen(true)}
          >
            <IconPlus size={16} stroke={2.25} aria-hidden="true" />
            New room
          </button>
        </div>
      </section>

      <section className="db-home-section" aria-labelledby="samples-heading">
        <h2 id="samples-heading">Or open a sample room</h2>
        <div className="db-sample-grid">
          {SAMPLE_KEYS.map((key) => {
            const sample = SAMPLE_ROOMS[key];
            const loading =
              loadSample.isPending && loadSample.variables?.sample === key;
            const counts = KINDS.map((k) => ({
              kind: k,
              n: sample.nodes.filter((node) => node.kind === k).length,
            })).filter((c) => c.n > 0);
            return (
              <div key={key} className="db-sample">
                <div
                  className="db-sample-strip"
                  aria-label={`${sample.nodes.length} nodes: ${counts
                    .map((c) => kindCount(c.kind, c.n))
                    .join(", ")}`}
                  role="img"
                >
                  {counts.map((c) => (
                    <span key={c.kind} className="db-count-chip db-kind" data-kind={c.kind}>
                      <span className="db-swatch" aria-hidden="true" />
                      {kindCount(c.kind, c.n)}
                    </span>
                  ))}
                </div>
                <div className="db-sample-title">{sample.title}</div>
                <p>{sample.blurb}</p>
                <button
                  type="button"
                  className="db-btn db-btn--sm"
                  disabled={loadSample.isPending}
                  onClick={() => loadSample.mutate({ sample: key })}
                >
                  {loading ? "Loading…" : "Load sample"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="db-home-section" aria-labelledby="rooms-heading">
        <h2 id="rooms-heading">Your rooms</h2>
        {isLoading ? (
          <div aria-busy="true" className="flex flex-col gap-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : rooms.length === 0 ? (
          <p className="db-empty">
            No rooms yet. Load a sample above to see a stuck room, or start
            your own with New room and describe it in a few sentences.
          </p>
        ) : (
          <ul className="db-rows">
            {rooms.map((room) => (
              <li key={room.id}>
                <Link to={`/rooms/${room.id}`} className="db-room-row">
                  <span className="db-room-name">{room.title}</span>
                  <span className="db-room-cell">
                    {room.nodeCount} {room.nodeCount === 1 ? "node" : "nodes"}
                  </span>
                  <span className="db-room-cell" data-verdict={room.verdict ?? "none"}>
                    {room.verdict === "stuck"
                      ? "Stuck"
                      : room.verdict === "escaped"
                        ? "Escaped"
                        : "Not playtested yet"}
                  </span>
                  <span className="db-room-cell" data-col="updated">
                    Edited {relativeTime(room.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

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

function kindCount(kind: NodeKind, n: number): string {
  const label = KIND_META[kind].label.toLowerCase();
  return `${n} ${n === 1 ? label : `${label}s`}`;
}
