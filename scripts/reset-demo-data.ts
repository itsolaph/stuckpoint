// Wipe rooms, playthroughs and chats from the local database so a demo starts clean.
// Seeds nothing: sample rooms are loaded from the UI ("Load sample").
//
//   pnpm script reset-demo-data      (or: npx tsx scripts/reset-demo-data.ts)
//
// Stop the dev server first: local PGlite allows one process at a time.
import { closeDbExec, getDbExec } from "@agent-native/core/db";
import { loadEnv } from "@agent-native/core/scripts";

// Children first. Tables that do not exist yet (for example before the first
// chat) are skipped.
const TABLES = [
  "gm_sheets",
  "hint_ladders",
  "playthroughs",
  "nodes",
  "room_shares",
  "rooms",
  "chat_thread_viewer_state",
  "chat_thread_shares",
  "chat_threads",
] as const;

export default async function resetDemoData(): Promise<void> {
  loadEnv();
  const db = getDbExec();
  try {
    for (const table of TABLES) {
      const exists = await db.execute({
        sql: "SELECT to_regclass($1) AS name",
        args: [`public.${table}`],
      });
      if (!exists.rows[0]?.name) continue;
      const res = await db.execute(`DELETE FROM ${table}`);
      console.log(`cleared ${table}: ${res.rowsAffected} row(s)`);
    }
    console.log("Demo data reset. Load a sample room from /home to start.");
  } finally {
    await closeDbExec();
  }
}

// Allow `npx tsx scripts/reset-demo-data.ts` as well as `pnpm script`.
if (process.argv[1]?.endsWith("reset-demo-data.ts")) {
  await resetDemoData();
}
