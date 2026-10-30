import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  graphHash,
  listNodeRows,
  loadRoom,
  requireUser,
  toEngineNode,
} from "../server/lib/rooms.js";
import { roomIdSchema } from "../server/lib/schemas.js";
import { playtest } from "../src/engine/index.js";

export default defineAction({
  description:
    "Playtest a room with the deterministic walker (no AI): returns the verdict (escaped or stuck), the step-by-step trace, and for a stuck room the exact blocking reason chains plus the nodes to pin. Persists a playthrough row. This is the only proof a room is solvable: never say a room is solvable unless the latest run returned escaped.",
  schema: z.object({ roomId: roomIdSchema }),
  outputSchema: z.object({
    id: z.string(),
    roomId: z.string(),
    verdict: z.enum(["escaped", "stuck"]),
    trace: z.array(z.object({ action: z.string(), nodeId: z.string() })),
    result: z.record(z.string(), z.unknown()),
    summary: z.string(),
  }),
  link: ({ args }) => ({
    url: buildDeepLink({
      view: "room",
      to: `/rooms/${encodeURIComponent(args.roomId)}`,
      params: { roomId: args.roomId },
    }),
    label: "Open room",
  }),
  run: async ({ roomId }, ctx) => {
    const { ownerEmail, orgId } = requireUser(ctx);
    const room = await loadRoom(roomId, "editor");
    const rows = await listNodeRows(room.id);
    const engineNodes = rows.map(toEngineNode);
    const result = playtest(engineNodes);
    const names = new Map(rows.map((n) => [n.id, n.name]));

    const analysis = { ...result, graphHash: graphHash(engineNodes) };
    const id = crypto.randomUUID();
    await getDb()
      .insert(schema.playthroughs)
      .values({
        id,
        roomId: room.id,
        verdict: result.verdict,
        trace: result.trace,
        analysis,
        ownerEmail,
        orgId,
        createdAt: new Date().toISOString(),
      });

    const firstChain = result.stuckAnalysis
      .find((e) => e.kind === "exit")
      ?.chains[0]?.text;
    const summary =
      result.verdict === "escaped"
        ? `ESCAPED in ${result.trace.length} steps (critical path ${result.criticalPathDepth} hops). ${result.unreachable.length} unreachable, ${result.optional.length} optional nodes.`
        : `STUCK. ${firstChain ?? "The exit can never be reached."} Pinned: ${result.pinNodeIds.map((p) => names.get(p) ?? p).join(", ") || "none"}.`;
    return {
      id,
      roomId: room.id,
      verdict: result.verdict,
      trace: result.trace,
      result: analysis,
      summary,
    };
  },
});
