import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { accessFilter } from "@agent-native/core/sharing";
import { desc, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";

export default defineAction({
  description:
    "List the escape rooms the current user can open, newest first, with node count and the verdict of the latest playtest (null when never playtested).",
  schema: z.object({}),
  outputSchema: z.object({
    rooms: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        story: z.string(),
        createdAt: z.string(),
        nodeCount: z.number(),
        verdict: z.enum(["escaped", "stuck"]).nullable(),
      }),
    ),
  }),
  http: { method: "GET" },
  readOnly: true,
  link: () => ({
    url: buildDeepLink({ view: "home", to: "/home" }),
    label: "Open rooms",
  }),
  run: async () => {
    const db = getDb();
    const { rooms, roomShares, nodes, playthroughs } = schema;
    const rows = await db
      .select({
        id: rooms.id,
        title: rooms.title,
        story: rooms.story,
        createdAt: rooms.createdAt,
      })
      .from(rooms)
      .where(accessFilter(rooms, roomShares))
      .orderBy(desc(rooms.createdAt))
      .limit(200);
    if (rows.length === 0) return { rooms: [] };
    const ids = rows.map((r) => r.id);

    const counts = await db
      .select({ roomId: nodes.roomId, n: sql<number>`count(*)::int` })
      .from(nodes)
      .where(inArray(nodes.roomId, ids))
      .groupBy(nodes.roomId);
    const plays = await db
      .select({
        roomId: playthroughs.roomId,
        verdict: playthroughs.verdict,
        createdAt: playthroughs.createdAt,
      })
      .from(playthroughs)
      .where(inArray(playthroughs.roomId, ids))
      .orderBy(desc(playthroughs.createdAt))
      .limit(2000);

    const countBy = new Map(counts.map((c) => [c.roomId, Number(c.n)]));
    const verdictBy = new Map<string, "escaped" | "stuck">();
    for (const p of plays) {
      if (!verdictBy.has(p.roomId)) verdictBy.set(p.roomId, p.verdict);
    }
    return {
      rooms: rows.map((r) => ({
        ...r,
        nodeCount: countBy.get(r.id) ?? 0,
        verdict: verdictBy.get(r.id) ?? null,
      })),
    };
  },
});
