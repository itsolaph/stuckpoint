import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { requireUser } from "../server/lib/rooms.js";

export default defineAction({
  description:
    "Create an empty escape room. Add nodes next with create-nodes (a whole room at once) or create-node. Visible to the organization when one is active, otherwise private to its creator.",
  schema: z.object({
    title: z.string().min(1).max(120).describe('Room title, e.g. "The Seance"'),
    story: z
      .string()
      .max(4000)
      .optional()
      .describe("Short narrative premise players are told; omit for none"),
  }),
  outputSchema: z.object({ id: z.string(), title: z.string(), story: z.string() }),
  link: ({ result }) => ({
    url: buildDeepLink({
      view: "room",
      to: `/rooms/${encodeURIComponent(result.id)}`,
      params: { roomId: result.id },
    }),
    label: `Open ${result.title}`,
  }),
  run: async (args, ctx) => {
    const { ownerEmail, orgId } = requireUser(ctx);
    const room = {
      id: crypto.randomUUID(),
      title: args.title.trim(),
      story: args.story?.trim() ?? "",
      ownerEmail,
      orgId,
      visibility: orgId ? ("org" as const) : ("private" as const),
    };
    await getDb().insert(schema.rooms).values(room);
    return { id: room.id, title: room.title, story: room.story };
  },
});
