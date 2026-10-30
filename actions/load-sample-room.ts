import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { requireUser } from "../server/lib/rooms.js";
import { layoutNodes } from "../src/engine/layout.js";
import { SAMPLE_ROOMS } from "../src/samples/index.js";

export default defineAction({
  description:
    'Create a ready-made sample room with nodes and hint ladders, then open it. sample is "seance" (solvable, red herring, single-use candle), "darkroom" (deliberate deadlock: the UV flashlight is locked in the safe that needs it) or "supply-closet" (small classroom pH room).',
  schema: z.object({
    sample: z
      .enum(["seance", "darkroom", "supply-closet"])
      .describe('Which sample: "seance", "darkroom" or "supply-closet"'),
  }),
  outputSchema: z.object({
    id: z.string(),
    title: z.string(),
    nodeCount: z.number(),
  }),
  link: ({ result }) => ({
    url: buildDeepLink({
      view: "room",
      to: `/rooms/${encodeURIComponent(result.id)}`,
      params: { roomId: result.id },
    }),
    label: `Open ${result.title}`,
  }),
  run: async ({ sample }, ctx) => {
    const { ownerEmail, orgId } = requireUser(ctx);
    const def = SAMPLE_ROOMS[sample];
    const roomId = crypto.randomUUID();
    const ids = new Map(def.nodes.map((n) => [n.ref, crypto.randomUUID()]));
    const positions = layoutNodes(
      def.nodes.map((n) => ({
        id: n.ref,
        kind: n.kind,
        name: n.name,
        containerId: n.containerRef ?? null,
        requires: n.requiresRefs ?? [],
        singleUse: n.singleUse ?? false,
      })),
    );
    const base = Date.now();

    await getDb().transaction(async (tx) => {
      await tx.insert(schema.rooms).values({
        id: roomId,
        title: def.title,
        story: def.story,
        ownerEmail,
        orgId,
        visibility: orgId ? "org" : "private",
      });
      await tx.insert(schema.nodes).values(
        def.nodes.map((n, i) => ({
          id: ids.get(n.ref)!,
          roomId,
          kind: n.kind,
          name: n.name,
          note: n.note,
          containerId: n.containerRef ? ids.get(n.containerRef)! : null,
          requires: (n.requiresRefs ?? []).map((r) => ids.get(r)!),
          singleUse: n.singleUse ?? false,
          x: positions.get(n.ref)?.x ?? 40,
          y: positions.get(n.ref)?.y ?? 40,
          ownerEmail,
          orgId,
          // Distinct creation times keep the declaration order stable on read.
          createdAt: new Date(base + i).toISOString(),
        })),
      );
      if (def.hints.length > 0) {
        await tx.insert(schema.hintLadders).values(
          def.hints.map((h) => ({
            id: crypto.randomUUID(),
            roomId,
            nodeId: ids.get(h.ref)!,
            hints: h.hints,
            ownerEmail,
            orgId,
          })),
        );
      }
    });
    return { id: roomId, title: def.title, nodeCount: def.nodes.length };
  },
});
