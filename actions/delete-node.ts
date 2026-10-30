import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  listNodeRows,
  loadRoom,
  nodeWhere,
  serializeNode,
} from "../server/lib/rooms.js";
import { nodeIdSchema, nodeOut, roomIdSchema } from "../server/lib/schemas.js";

export default defineAction({
  description:
    "Delete one node. Any other node that required it loses that requirement, and anything stored inside it (when it is a lock) is released into the open. Returns the removed node and the ids that were detached so it can be restored.",
  schema: z.object({ roomId: roomIdSchema, id: nodeIdSchema }),
  outputSchema: z.object({
    removed: nodeOut,
    detachedRequirementFrom: z.array(z.string()),
    releasedContents: z.array(z.string()),
  }),
  run: async ({ roomId, id }) => {
    const room = await loadRoom(roomId, "editor");
    return getDb().transaction(async (tx) => {
      const rows = await listNodeRows(room.id);
      const target = rows.find((n) => n.id === id);
      if (!target) {
        fail("Node not found in this room.", { errorCode: "not_found", statusCode: 404 });
      }
      const detachedRequirementFrom: string[] = [];
      const releasedContents: string[] = [];
      for (const other of rows) {
        if (other.id === id) continue;
        const patch: { requires?: string[]; containerId?: null } = {};
        if (other.requires.includes(id)) {
          patch.requires = other.requires.filter((r) => r !== id);
          detachedRequirementFrom.push(other.id);
        }
        if (other.containerId === id) {
          patch.containerId = null;
          releasedContents.push(other.id);
        }
        if (Object.keys(patch).length > 0) {
          await tx
            .update(schema.nodes)
            .set({ ...patch, updatedAt: new Date().toISOString() })
            .where(nodeWhere(room.id, other.id));
        }
      }
      await tx.delete(schema.nodes).where(nodeWhere(room.id, id));
      await tx
        .delete(schema.hintLadders)
        .where(
          and(
            eq(schema.hintLadders.roomId, room.id),
            eq(schema.hintLadders.nodeId, id),
          ),
        );
      return { removed: serializeNode(target), detachedRequirementFrom, releasedContents };
    });
  },
});
