import { defineAction } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { loadRoom } from "../server/lib/rooms.js";
import { roomIdSchema } from "../server/lib/schemas.js";

export default defineAction({
  description: "Rename an escape room.",
  schema: z.object({
    id: roomIdSchema,
    title: z.string().min(1).max(120).describe("New room title"),
  }),
  outputSchema: z.object({
    id: z.string(),
    title: z.string(),
    previousTitle: z.string(),
  }),
  run: async ({ id, title }) => {
    const room = await loadRoom(id, "editor");
    const next = title.trim();
    await getDb()
      .update(schema.rooms)
      .set({ title: next })
      .where(eq(schema.rooms.id, id));
    return { id, title: next, previousTitle: room.title };
  },
});
