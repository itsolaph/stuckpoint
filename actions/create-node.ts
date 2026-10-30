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
import {
  kindSchema,
  nodeIdSchema,
  nodeOut,
  roomIdSchema,
} from "../server/lib/schemas.js";
import { GRID_X, GRID_Y } from "../src/engine/layout.js";

export default defineAction({
  description:
    "Add one node (item, clue, lock or exit) to a room. For a whole room use create-nodes instead. containerId puts the node inside a lock; requires lists node ids that must be satisfied first. x/y default to the next free grid slot.",
  schema: z.object({
    roomId: roomIdSchema,
    id: z
      .string()
      .optional()
      .describe("Optional explicit node id (used to restore a deleted node); omit to generate one"),
    kind: kindSchema,
    name: z.string().min(1).max(80).describe('Short prop or puzzle name, e.g. "Brass key"'),
    note: z.string().max(1000).optional().describe("Designer note: what the player sees or does"),
    containerId: nodeIdSchema.nullable().optional().describe("Id of the lock this node is inside, or null/omitted when lying in the open"),
    requires: z.array(nodeIdSchema).optional().describe("Ids of items, clues or locks that must be satisfied first; omit for none"),
    singleUse: z.boolean().optional().describe("true when the item is consumed after being used once; default false"),
    x: z.number().int().optional().describe("Canvas x in pixels; omit to auto-place"),
    y: z.number().int().optional().describe("Canvas y in pixels; omit to auto-place"),
  }),
  outputSchema: z.object({ node: nodeOut }),
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
    const existing = await listNodeRows(room.id);
    const id = args.id ?? crypto.randomUUID();
    if (existing.some((n) => n.id === id)) {
      fail(`A node with id ${id} already exists in this room.`, {
        errorCode: "node_exists",
        statusCode: 409,
      });
    }
    const node = {
      id,
      containerId: args.containerId ?? null,
      requires: [...new Set(args.requires ?? [])],
    };
    assertReferences(node, new Map(existing.map((n) => [n.id, n])));

    const slot = existing.length;
    const [row] = await getDb()
      .insert(schema.nodes)
      .values({
        id,
        roomId: room.id,
        kind: args.kind,
        name: args.name.trim(),
        note: args.note?.trim() ?? "",
        containerId: node.containerId,
        requires: node.requires,
        singleUse: args.singleUse ?? false,
        x: args.x ?? 40 + (slot % 4) * GRID_X,
        y: args.y ?? 40 + Math.floor(slot / 4) * GRID_Y,
        ownerEmail,
        orgId,
      })
      .returning();
    if (!row) fail("Node could not be saved.", { statusCode: 500 });
    return { node: serializeNode(row) };
  },
});
