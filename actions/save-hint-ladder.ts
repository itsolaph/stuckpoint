import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  listNodeRows,
  loadRoom,
  requireUser,
} from "../server/lib/rooms.js";
import { nodeIdSchema, roomIdSchema } from "../server/lib/schemas.js";

export default defineAction({
  description:
    "Save the 3-level hint ladder for one puzzle node (replaces any existing ladder for that node). hints must be exactly three strings in order: 1 nudge (points attention, reveals nothing), 2 direction (names the mechanism), 3 answer (states the solution outright).",
  schema: z.object({
    roomId: roomIdSchema,
    nodeId: nodeIdSchema,
    hints: z
      .array(z.string().min(1).max(600))
      .length(3)
      .describe("Exactly three hints: [nudge, direction, answer]"),
  }),
  outputSchema: z.object({
    nodeId: z.string(),
    hints: z.array(z.string()),
    replaced: z.boolean(),
  }),
  run: async ({ roomId, nodeId, hints }, ctx) => {
    const { ownerEmail, orgId } = requireUser(ctx);
    const room = await loadRoom(roomId, "editor");
    const rows = await listNodeRows(room.id);
    if (!rows.some((n) => n.id === nodeId)) {
      fail("Node not found in this room.", { errorCode: "not_found", statusCode: 404 });
    }
    const clean = hints.map((h) => h.trim());
    return getDb().transaction(async (tx) => {
      const where = and(
        eq(schema.hintLadders.roomId, room.id),
        eq(schema.hintLadders.nodeId, nodeId),
      );
      const [existing] = await tx
        .select({ id: schema.hintLadders.id })
        .from(schema.hintLadders)
        .where(where)
        .limit(1);
      if (existing) {
        await tx.update(schema.hintLadders).set({ hints: clean }).where(where);
      } else {
        await tx.insert(schema.hintLadders).values({
          id: crypto.randomUUID(),
          roomId: room.id,
          nodeId,
          hints: clean,
          ownerEmail,
          orgId,
        });
      }
      return { nodeId, hints: clean, replaced: Boolean(existing) };
    });
  },
});
