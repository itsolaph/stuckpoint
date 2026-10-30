import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  listNodeRows,
  loadRoom,
  nodeWhere,
  toEngineNode,
} from "../server/lib/rooms.js";
import { roomIdSchema } from "../server/lib/schemas.js";
import { layoutNodes } from "../src/engine/layout.js";

export default defineAction({
  description:
    "Re-arrange every card in a room left to right by dependency so the exit lands on the right. Only changes positions, never puzzle logic.",
  schema: z.object({ roomId: roomIdSchema }),
  outputSchema: z.object({
    moved: z.number(),
    previous: z.array(z.object({ id: z.string(), x: z.number(), y: z.number() })),
  }),
  run: async ({ roomId }) => {
    const room = await loadRoom(roomId, "editor");
    const rows = await listNodeRows(room.id);
    const positions = layoutNodes(rows.map(toEngineNode));
    await getDb().transaction(async (tx) => {
      for (const row of rows) {
        const p = positions.get(row.id);
        if (p) await tx.update(schema.nodes).set(p).where(nodeWhere(room.id, row.id));
      }
    });
    return {
      moved: rows.length,
      previous: rows.map((r) => ({ id: r.id, x: r.x, y: r.y })),
    };
  },
});
