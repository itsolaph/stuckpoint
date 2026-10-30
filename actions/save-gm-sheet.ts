import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  listNodeRows,
  loadRoom,
  requireUser,
  toEngineNode,
} from "../server/lib/rooms.js";
import { roomIdSchema } from "../server/lib/schemas.js";
import { buildGmSheet, playtest } from "../src/engine/index.js";

export default defineAction({
  description:
    "Save a game-master sheet (markdown) for a room. Omit markdown to have the app generate the standard sheet from a fresh playtest: walkthrough steps from the trace, props per stage and the saved hint ladders. Pass markdown when you have written a richer sheet yourself (walkthrough, props per stage, hint ladders).",
  schema: z.object({
    roomId: roomIdSchema,
    markdown: z
      .string()
      .min(1)
      .max(60000)
      .optional()
      .describe("Full sheet as markdown; omit to generate the standard sheet"),
  }),
  outputSchema: z.object({
    id: z.string(),
    roomId: z.string(),
    markdown: z.string(),
    generated: z.boolean(),
  }),
  link: ({ args }) => ({
    url: buildDeepLink({
      view: "gm-sheet",
      to: `/rooms/${encodeURIComponent(args.roomId)}/sheet`,
      params: { roomId: args.roomId },
    }),
    label: "Open GM sheet",
  }),
  run: async ({ roomId, markdown }, ctx) => {
    const { ownerEmail, orgId } = requireUser(ctx);
    const room = await loadRoom(roomId, "editor");
    let body = markdown?.trim();
    const generated = !body;
    if (!body) {
      const rows = await listNodeRows(room.id);
      const nodes = rows.map(toEngineNode);
      const ladders = await getDb()
        .select({
          nodeId: schema.hintLadders.nodeId,
          hints: schema.hintLadders.hints,
        })
        .from(schema.hintLadders)
        .where(eq(schema.hintLadders.roomId, room.id))
        .limit(500);
      body = buildGmSheet({
        title: room.title,
        story: room.story,
        nodes,
        result: playtest(nodes),
        ladders,
      });
    }
    const id = crypto.randomUUID();
    await getDb().insert(schema.gmSheets).values({
      id,
      roomId: room.id,
      markdown: body,
      ownerEmail,
      orgId,
      createdAt: new Date().toISOString(),
    });
    return { id, roomId: room.id, markdown: body, generated };
  },
});
