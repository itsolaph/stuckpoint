import { createHash } from "node:crypto";

import { fail } from "@agent-native/core/action";
import { assertAccess, ForbiddenError } from "@agent-native/core/sharing";
import { and, asc, desc, eq } from "drizzle-orm";

import type { EngineNode } from "../../src/engine/index.js";
import { getDb, schema } from "../db/index.js";

export type NodeRow = typeof schema.nodes.$inferSelect;

export interface ActionCtx {
  userEmail?: string;
  orgId?: string | null;
}

export function requireUser(ctx: ActionCtx | undefined): {
  ownerEmail: string;
  orgId: string | null;
} {
  const ownerEmail =
    ctx?.userEmail ?? fail("Sign in to edit rooms.", { statusCode: 401 });
  return { ownerEmail, orgId: ctx?.orgId ?? null };
}

/** Check the caller's access to a room and return its row. Children inherit this check. */
export async function loadRoom(roomId: string, role: "viewer" | "editor" | "admin") {
  try {
    const access = await assertAccess("room", roomId, role);
    return access.resource as typeof schema.rooms.$inferSelect;
  } catch (err) {
    if (err instanceof ForbiddenError) {
      fail("Room not found.", { errorCode: "not_found", statusCode: 404 });
    }
    throw err;
  }
}

export async function listNodeRows(roomId: string): Promise<NodeRow[]> {
  return getDb()
    .select()
    .from(schema.nodes)
    .where(eq(schema.nodes.roomId, roomId))
    .orderBy(asc(schema.nodes.createdAt), asc(schema.nodes.id))
    .limit(500);
}

export function toEngineNode(row: NodeRow): EngineNode {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    containerId: row.containerId,
    requires: row.requires ?? [],
    singleUse: row.singleUse,
  };
}

/** Hash of everything the engine reads, so a verdict can be tied to the graph it judged. */
export function graphHash(nodes: EngineNode[]): string {
  const canonical = [...nodes]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((n) => [
      n.id,
      n.kind,
      n.name,
      n.containerId,
      [...n.requires].sort(),
      n.singleUse,
    ]);
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex").slice(0, 16);
}

export async function latestPlaythrough(roomId: string) {
  const [row] = await getDb()
    .select()
    .from(schema.playthroughs)
    .where(eq(schema.playthroughs.roomId, roomId))
    .orderBy(desc(schema.playthroughs.createdAt), desc(schema.playthroughs.id))
    .limit(1);
  return row ?? null;
}

/**
 * Validate that a node's container and requirements point at real nodes of the
 * same room. Cycles are deliberately allowed: finding them is the product.
 */
export function assertReferences(
  node: { id: string; containerId: string | null; requires: string[] },
  byId: Map<string, { kind: string }>,
) {
  if (node.containerId !== null) {
    const c = byId.get(node.containerId);
    if (!c || c.kind !== "lock") {
      fail("containerId must be the id of a lock in this room, or null.", {
        errorCode: "invalid_container",
        statusCode: 400,
      });
    }
    if (node.containerId === node.id) {
      fail("A node cannot be stored inside itself.", {
        errorCode: "invalid_container",
        statusCode: 400,
      });
    }
  }
  for (const id of node.requires) {
    const r = byId.get(id);
    if (!r || r.kind === "exit") {
      fail(`requires contains "${id}", which is not an item, clue or lock in this room.`, {
        errorCode: "invalid_requirement",
        statusCode: 400,
      });
    }
  }
}

export function nodeWhere(roomId: string, nodeId: string) {
  return and(eq(schema.nodes.roomId, roomId), eq(schema.nodes.id, nodeId));
}

export function serializeNode(row: NodeRow) {
  return {
    id: row.id,
    roomId: row.roomId,
    kind: row.kind,
    name: row.name,
    note: row.note,
    containerId: row.containerId,
    requires: row.requires ?? [],
    singleUse: row.singleUse,
    x: row.x,
    y: row.y,
  };
}
