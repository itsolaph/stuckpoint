import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  assertReferences,
  listNodeRows,
  loadRoom,
  serializeNode,
} from "../server/lib/rooms.js";
import {
  kindSchema,
  nodeIdSchema,
  nodeOut,
  roomIdSchema,
} from "../server/lib/schemas.js";

export default defineAction({
  description:
    "Patch one node: any of name, note, kind, containerId, requires, singleUse. Omitted fields are unchanged; pass containerId null to take a node out of its lock and requires [] to clear requirements. Returns `previous` (the old values of the changed fields) so the change can be undone by calling update-node with it.",
  schema: z.object({
    roomId: roomIdSchema,
    id: nodeIdSchema,
    kind: kindSchema.optional(),
    name: z.string().min(1).max(80).optional().describe("New name"),
    note: z.string().max(1000).optional().describe("New designer note"),
    containerId: nodeIdSchema.nullable().optional().describe("Lock this node is inside; null removes it from any lock"),
    requires: z.array(nodeIdSchema).optional().describe("Replacement list of required node ids"),
    singleUse: z.boolean().optional().describe("Whether the item is consumed after one use"),
  }),
  outputSchema: z.object({
    node: nodeOut,
    previous: z.record(z.string(), z.unknown()),
  }),
  run: async (args) => {
    const room = await loadRoom(args.roomId, "editor");
    const rows = await listNodeRows(room.id);
    const current = rows.find((n) => n.id === args.id);
    if (!current) {
      fail("Node not found in this room.", { errorCode: "not_found", statusCode: 404 });
    }

    const next = {
      kind: args.kind ?? current.kind,
      name: args.name?.trim() ?? current.name,
      note: args.note?.trim() ?? current.note,
      containerId: args.containerId === undefined ? current.containerId : args.containerId,
      requires: args.requires ? [...new Set(args.requires)] : current.requires,
      singleUse: args.singleUse ?? current.singleUse,
    };
    const nextById = new Map<string, { kind: string }>(rows.map((n) => [n.id, n]));
    nextById.set(current.id, { kind: next.kind });
    assertReferences({ id: current.id, ...next }, nextById);

    if (next.kind !== current.kind) {
      for (const other of rows) {
        if (other.id === current.id) continue;
        if (next.kind === "exit" && other.requires.includes(current.id)) {
          fail(`"${other.name}" requires this node, so it cannot become an exit.`, {
            errorCode: "node_in_use",
            statusCode: 409,
          });
        }
        if (next.kind !== "lock" && other.containerId === current.id) {
          fail(`"${other.name}" is stored inside this node, so it must stay a lock.`, {
            errorCode: "node_in_use",
            statusCode: 409,
          });
        }
      }
    }

    const previous: Record<string, unknown> = {};
    for (const key of Object.keys(next) as (keyof typeof next)[]) {
      if (JSON.stringify(next[key]) !== JSON.stringify(current[key])) {
        previous[key] = current[key];
      }
    }
    if (Object.keys(previous).length === 0) {
      return { node: serializeNode(current), previous };
    }

    const [row] = await getDb()
      .update(schema.nodes)
      .set({ ...next, updatedAt: new Date().toISOString() })
      .where(and(eq(schema.nodes.roomId, room.id), eq(schema.nodes.id, current.id)))
      .returning();
    if (!row) fail("Node could not be saved.", { statusCode: 500 });
    return { node: serializeNode(row), previous };
  },
});
