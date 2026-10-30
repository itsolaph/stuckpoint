import type { AgentLoopFinalResponseGuard } from "@agent-native/core/server";
import { accessFilter } from "@agent-native/core/sharing";
import { and, desc, inArray } from "drizzle-orm";

import {
  claimsSolvable,
  proofReason,
  proofState,
} from "../../src/engine/proofgate.js";
import { getDb, schema } from "../db/index.js";
import { graphHash, latestPlaythrough, listNodeRows, toEngineNode } from "./rooms.js";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

/** Room ids mentioned this turn: tool inputs/results first, then recent messages. */
function mentionedIds(parts: unknown[]): string[] {
  const found: string[] = [];
  for (const part of parts) {
    const text = typeof part === "string" ? part : JSON.stringify(part ?? "");
    for (const id of text.match(UUID) ?? []) {
      if (!found.includes(id)) found.push(id);
    }
  }
  return found;
}

/**
 * The proof gate. The agent may only say a room is solvable when the latest
 * persisted `run-playtest` for that room escaped and the graph is unchanged
 * since. Anything else is retried once with the facts, then replaced by a
 * deterministic notice, whatever the model believes.
 */
export const proofGate: AgentLoopFinalResponseGuard = async (ctx) => {
  if (!claimsSolvable(ctx.text)) return null;

  const { rooms, roomShares } = schema;
  const db = getDb();
  const ids = mentionedIds([
    ctx.toolCalls.map((c) => c.input),
    ctx.toolResults.map((r) => r.content),
    ctx.messages.slice(-6),
  ]);

  let candidates: { id: string; title: string }[] = [];
  if (ids.length > 0) {
    candidates = await db
      .select({ id: rooms.id, title: rooms.title })
      .from(rooms)
      .where(and(inArray(rooms.id, ids), accessFilter(rooms, roomShares)))
      .limit(10);
  }
  if (candidates.length === 0) {
    candidates = await db
      .select({ id: rooms.id, title: rooms.title })
      .from(rooms)
      .where(accessFilter(rooms, roomShares))
      .orderBy(desc(rooms.createdAt))
      .limit(1);
  }
  // Mentioned rooms are checked in mention order; the most recently mentioned wins ties.
  const failures: { id: string; title: string; reason: string }[] = [];
  for (const room of candidates) {
    const play = await latestPlaythrough(room.id);
    const nodes = (await listNodeRows(room.id)).map(toEngineNode);
    const state = proofState({
      latestVerdict: play?.verdict ?? null,
      playedHash: (play?.analysis.graphHash as string | undefined) ?? null,
      currentHash: graphHash(nodes),
    });
    if (state !== "proven") {
      failures.push({ id: room.id, title: room.title, reason: proofReason(state) });
    }
  }
  if (failures.length === 0) return null;

  const detail = failures
    .map((f) => `"${f.title}" (${f.id}): ${f.reason}`)
    .join("; ");
  return {
    retryMessage:
      `Proof gate: your draft claims a room is solvable, but ${detail}. ` +
      "A room is only solvable when the latest run-playtest for it returned escaped on the current layout. " +
      "Call run-playtest for the room now and state its verdict as the proof, or rewrite the answer without claiming the room is solvable.",
    fallbackMessage:
      `Proof gate blocked a solvability claim: ${detail}. ` +
      "Press PLAYTEST (or ask me to run it) and I will report what the walker actually does.",
    maxRetries: 1,
  };
};
