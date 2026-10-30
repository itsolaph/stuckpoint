import { defineAction } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { loadRoom } from "../server/lib/rooms.js";
import { roomIdSchema } from "../server/lib/schemas.js";

export default defineAction({
  description:
    "Set the narrative premise of a room (what players are told before they start). Pass an empty string to clear it.",
  schema: z.object({
    id: roomIdSchema,
    story: z.string().max(4000).describe("Story text, plain prose"),
  }),
  outputSchema: z.object({
    id: z.string(),
    story: z.string(),
    previousStory: z.string(),
  }),
  run: async ({ id, story }) => {
    const room = await loadRoom(id, "editor");
    const next = story.trim();
    await getDb()
      .update(schema.rooms)
      .set({ story: next })
      .where(eq(schema.rooms.id, id));
    return { id, story: next, previousStory: room.story };
  },
});
