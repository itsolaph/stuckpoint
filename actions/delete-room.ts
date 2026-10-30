import { defineAction } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { loadRoom } from "../server/lib/rooms.js";
import { roomIdSchema } from "../server/lib/schemas.js";

export default defineAction({
  description:
    "Permanently delete an escape room with all its nodes, playthroughs, hint ladders and GM sheets. Cannot be undone; confirm with the user first.",
  schema: z.object({ id: roomIdSchema }),
  outputSchema: z.object({ id: z.string(), deletedNodes: z.number() }),
  run: async ({ id }) => {
    await loadRoom(id, "admin");
    return getDb().transaction(async (tx) => {
      const removed = await tx
        .delete(schema.nodes)
        .where(eq(schema.nodes.roomId, id))
        .returning({ id: schema.nodes.id });
      await tx.delete(schema.playthroughs).where(eq(schema.playthroughs.roomId, id));
      await tx.delete(schema.hintLadders).where(eq(schema.hintLadders.roomId, id));
      await tx.delete(schema.gmSheets).where(eq(schema.gmSheets.roomId, id));
      await tx.delete(schema.roomShares).where(eq(schema.roomShares.resourceId, id));
      await tx.delete(schema.rooms).where(eq(schema.rooms.id, id));
      return { id, deletedNodes: removed.length };
    });
  },
});
