import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  graphHash,
  latestPlaythrough,
  listNodeRows,
  loadRoom,
  serializeNode,
  toEngineNode,
} from "../server/lib/rooms.js";
import { nodeOut, roomIdSchema } from "../server/lib/schemas.js";

export default defineAction({
  description:
    "Read one room in full: nodes, the latest playtest (verdict, trace, stuck analysis, and whether it is stale because the graph changed since), hint ladders and the latest GM sheet.",
  schema: z.object({ id: roomIdSchema }),
  outputSchema: z.object({
    room: z.object({
      id: z.string(),
      title: z.string(),
      story: z.string(),
      createdAt: z.string(),
    }),
    nodes: z.array(nodeOut),
    playthrough: z
      .object({
        id: z.string(),
        verdict: z.enum(["escaped", "stuck"]),
        trace: z.array(z.unknown()),
        analysis: z.record(z.string(), z.unknown()),
        createdAt: z.string(),
        stale: z.boolean(),
      })
      .nullable(),
    hintLadders: z.array(
      z.object({ nodeId: z.string(), hints: z.array(z.string()) }),
    ),
    gmSheet: z
      .object({ id: z.string(), markdown: z.string(), createdAt: z.string() })
      .nullable(),
  }),
  http: { method: "GET" },
  readOnly: true,
  link: ({ args }) => ({
    url: buildDeepLink({
      view: "room",
      to: `/rooms/${encodeURIComponent(args.id)}`,
      params: { roomId: args.id },
    }),
    label: "Open room",
  }),
  run: async ({ id }) => {
    const room = await loadRoom(id, "viewer");
    const db = getDb();
    const rows = await listNodeRows(id);
    const play = await latestPlaythrough(id);
    const ladders = await db
      .select({
        nodeId: schema.hintLadders.nodeId,
        hints: schema.hintLadders.hints,
      })
      .from(schema.hintLadders)
      .where(eq(schema.hintLadders.roomId, id))
      .limit(500);
    const [sheet] = await db
      .select({
        id: schema.gmSheets.id,
        markdown: schema.gmSheets.markdown,
        createdAt: schema.gmSheets.createdAt,
      })
      .from(schema.gmSheets)
      .where(eq(schema.gmSheets.roomId, id))
      .orderBy(desc(schema.gmSheets.createdAt))
      .limit(1);

    const currentHash = graphHash(rows.map(toEngineNode));
    return {
      room: {
        id: room.id,
        title: room.title,
        story: room.story,
        createdAt: room.createdAt,
      },
      nodes: rows.map(serializeNode),
      playthrough: play
        ? {
            id: play.id,
            verdict: play.verdict,
            trace: play.trace,
            analysis: play.analysis,
            createdAt: play.createdAt,
            stale: play.analysis.graphHash !== currentHash,
          }
        : null,
      hintLadders: ladders,
      gmSheet: sheet ?? null,
    };
  },
});
