import { defineAction, fail } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  assertReferences,
  listNodeRows,
  loadRoom,
  requireUser,
  serializeNode,
} from "../server/lib/rooms.js";
import { kindSchema, nodeOut, roomIdSchema } from "../server/lib/schemas.js";
import { layoutNodes, GRID_Y } from "../src/engine/layout.js";

const refSchema = z
  .string()
  .describe("A `ref` from this batch, or the id of a node already in the room");

export default defineAction({
  description:
    "Add many nodes to a room in one transaction, wiring them together by short refs. Use this to build a room from a description: give every node a unique ref, then point containerRef and requiresRefs at other refs. Nodes are laid out automatically left to right.",
  schema: z.object({
    roomId: roomIdSchema,
    nodes: z
      .array(
        z.object({
          ref: z.string().min(1).describe('Unique short key within this batch, e.g. "brass-key"'),
          kind: kindSchema,
          name: z.string().min(1).max(80).describe('Short prop or puzzle name, e.g. "Brass key"'),
          note: z.string().max(1000).optional().describe("Designer note: what the player sees or does"),
          containerRef: refSchema.nullable().optional().describe("The lock this node is inside; null/omitted when lying in the open"),
          requiresRefs: z.array(refSchema).optional().describe("Items, clues or locks that must be satisfied first; omit for none"),
          singleUse: z.boolean().optional().describe("true when consumed after one use; default false"),
        }),
      )
      .min(1)
      .max(60),
  }),
  outputSchema: z.object({
    created: z.array(z.object({ ref: z.string(), node: nodeOut })),
  }),
  link: ({ args }) => ({
    url: buildDeepLink({
      view: "room",
      to: `/rooms/${encodeURIComponent(args.roomId)}`,
      params: { roomId: args.roomId },
    }),
    label: "Open room",
  }),
  run: async (args, ctx) => {
    const { ownerEmail, orgId } = requireUser(ctx);
    const room = await loadRoom(args.roomId, "editor");

    const refs = new Map<string, string>();
    for (const n of args.nodes) {
      if (refs.has(n.ref)) {
        fail(`Duplicate ref "${n.ref}" in this batch.`, {
          errorCode: "duplicate_ref",
          statusCode: 400,
        });
      }
      refs.set(n.ref, crypto.randomUUID());
    }

    return getDb().transaction(async (tx) => {
      const existing = await listNodeRows(room.id);
      const resolve = (r: string) => refs.get(r) ?? r;
      const drafts = args.nodes.map((n) => ({
        ref: n.ref,
        id: refs.get(n.ref)!,
        kind: n.kind,
        name: n.name.trim(),
        note: n.note?.trim() ?? "",
        containerId: n.containerRef ? resolve(n.containerRef) : null,
        requires: [...new Set((n.requiresRefs ?? []).map(resolve))],
        singleUse: n.singleUse ?? false,
      }));

      const byId = new Map<string, { kind: string }>(existing.map((n) => [n.id, n]));
      for (const d of drafts) byId.set(d.id, d);
      for (const d of drafts) assertReferences(d, byId);

      // Place the new nodes below whatever is already on the canvas.
      const belowY = existing.length ? Math.max(...existing.map((n) => n.y)) + GRID_Y : 40;
      const positions = layoutNodes(
        drafts.map((d) => ({ ...d })),
        { x: 40, y: belowY },
      );

      const rows = await tx
        .insert(schema.nodes)
        .values(
          drafts.map((d, i) => ({
            createdAt: new Date(Date.now() + i).toISOString(),
            id: d.id,
            roomId: room.id,
            kind: d.kind,
            name: d.name,
            note: d.note,
            containerId: d.containerId,
            requires: d.requires,
            singleUse: d.singleUse,
            x: positions.get(d.id)?.x ?? 40,
            y: positions.get(d.id)?.y ?? 40,
            ownerEmail,
            orgId,
          })),
        )
        .returning();
      const refById = new Map(drafts.map((d) => [d.id, d.ref]));
      return {
        created: rows.map((row) => ({
          ref: refById.get(row.id) ?? row.id,
          node: serializeNode(row),
        })),
      };
    });
  },
});
