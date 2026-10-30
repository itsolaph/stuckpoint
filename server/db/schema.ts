import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
} from "drizzle-orm/pg-core";
import {
  createSharesTable,
  ownableColumns,
} from "@agent-native/core/db/schema";

export const rooms = pgTable("rooms", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  story: text("story").notNull().default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
  ...ownableColumns(),
});
export const roomShares = createSharesTable("room_shares");

// Children inherit the room's access: actions check the room first, then
// scope every query by room id. They carry owner_email/org_id for SQL-tool scoping.
export const nodes = pgTable(
  "nodes",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull(),
    kind: text("kind", { enum: ["item", "clue", "lock", "exit"] }).notNull(),
    name: text("name").notNull(),
    note: text("note").notNull().default(""),
    containerId: text("container_id"),
    requires: jsonb("requires").$type<string[]>().notNull().default([]),
    singleUse: boolean("single_use").notNull().default(false),
    x: integer("x").notNull().default(0),
    y: integer("y").notNull().default(0),
    ownerEmail: text("owner_email").notNull(),
    orgId: text("org_id"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`now()`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("nodes_room_idx").on(t.roomId)],
);

export const playthroughs = pgTable(
  "playthroughs",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull(),
    verdict: text("verdict", { enum: ["escaped", "stuck"] }).notNull(),
    trace: jsonb("trace").$type<unknown[]>().notNull().default([]),
    analysis: jsonb("analysis").$type<Record<string, unknown>>().notNull(),
    ownerEmail: text("owner_email").notNull(),
    orgId: text("org_id"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("playthroughs_room_created_idx").on(t.roomId, t.createdAt)],
);

export const hintLadders = pgTable(
  "hint_ladders",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull(),
    nodeId: text("node_id").notNull(),
    hints: jsonb("hints").$type<string[]>().notNull().default([]),
    ownerEmail: text("owner_email").notNull(),
    orgId: text("org_id"),
  },
  (t) => [index("hint_ladders_room_idx").on(t.roomId)],
);

export const gmSheets = pgTable(
  "gm_sheets",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull(),
    markdown: text("markdown").notNull(),
    ownerEmail: text("owner_email").notNull(),
    orgId: text("org_id"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("gm_sheets_room_created_idx").on(t.roomId, t.createdAt)],
);
