import { runMigrations } from "@agent-native/core/db";

export default runMigrations(
  [
    {
      version: 1,
      name: "deadbolt-core-tables",
      sql: `CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  story TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (now()),
  owner_email TEXT NOT NULL DEFAULT 'local@localhost',
  org_id TEXT,
  visibility TEXT NOT NULL DEFAULT 'private'
);
CREATE TABLE IF NOT EXISTS room_shares (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  principal_type TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (now()),
  notified_at TEXT
);
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('item', 'clue', 'lock', 'exit')),
  name TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  container_id TEXT,
  requires JSONB NOT NULL DEFAULT '[]'::jsonb,
  single_use BOOLEAN NOT NULL DEFAULT false,
  x INTEGER NOT NULL DEFAULT 0,
  y INTEGER NOT NULL DEFAULT 0,
  owner_email TEXT NOT NULL,
  org_id TEXT,
  created_at TEXT NOT NULL DEFAULT (now()),
  updated_at TEXT NOT NULL DEFAULT (now())
);
CREATE TABLE IF NOT EXISTS playthroughs (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('escaped', 'stuck')),
  trace JSONB NOT NULL DEFAULT '[]'::jsonb,
  analysis JSONB NOT NULL,
  owner_email TEXT NOT NULL,
  org_id TEXT,
  created_at TEXT NOT NULL DEFAULT (now())
);
CREATE TABLE IF NOT EXISTS hint_ladders (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  hints JSONB NOT NULL DEFAULT '[]'::jsonb,
  owner_email TEXT NOT NULL,
  org_id TEXT
);
CREATE TABLE IF NOT EXISTS gm_sheets (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  markdown TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  org_id TEXT,
  created_at TEXT NOT NULL DEFAULT (now())
);
CREATE INDEX IF NOT EXISTS rooms_owner_org_idx ON rooms (owner_email, org_id);
CREATE INDEX IF NOT EXISTS room_shares_resource_idx ON room_shares (resource_id, principal_type, principal_id);
CREATE INDEX IF NOT EXISTS nodes_room_idx ON nodes (room_id);
CREATE INDEX IF NOT EXISTS playthroughs_room_created_idx ON playthroughs (room_id, created_at);
CREATE INDEX IF NOT EXISTS hint_ladders_room_idx ON hint_ladders (room_id);
CREATE INDEX IF NOT EXISTS gm_sheets_room_created_idx ON gm_sheets (room_id, created_at)`,
    },
  ],
  { table: "deadbolt_migrations" },
);
