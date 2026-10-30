import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { loadRoom, nodeWhere } from "../server/lib/rooms.js";
import { nodeIdSchema, roomIdSchema } from "../server/lib/schemas.js";

export default defineAction({
  description:
    "Reposition a node on the canvas. Only changes where the card is drawn, never the puzzle logic; to move a prop into another lock use update-node with containerId.",
  schema: z.object({
    roomId: roomIdSchema,
    id: nodeIdSchema,
    x: z.number().int().describe("Canvas x in pixels"),
    y: z.number().int().describe("Canvas y in pixels"),
  }),
  outputSchema: z.object({
    id: z.string(),
    x: z.number(),
    y: z.number(),
    previousX: z.number(),
    previousY: z.number(),
  }),
  run: async ({ roomId, id, x, y }) => {
    const room = await loadRoom(roomId, "editor");
    const [current] = await getDb()
      .select({ x: schema.nodes.x, y: schema.nodes.y })
      .from(schema.nodes)
      .where(nodeWhere(room.id, id))
      .limit(1);
    if (!current) {
      fail("Node not found in this room.", { errorCode: "not_found", statusCode: 404 });
    }
    await getDb().update(schema.nodes).set({ x, y }).where(nodeWhere(room.id, id));
    return { id, x, y, previousX: current.x, previousY: current.y };
  },
});
