# Deadbolt build progress

- 2026-10-30 Restart: working tree was empty (scaffold only). Started from the engine.
- 2026-10-30 Engine done: `src/engine` (walker, stuck analysis with named cycles, GM sheet builder, layout), 10 vitest cases green.
- 2026-10-30 Data model + actions done: rooms, nodes, playthroughs, hint_ladders, gm_sheets (PGlite via drizzle); 17 actions shared by UI and agent; 3 sample rooms with hint ladders.
- 2026-10-30 Agent done: system prompt, tool list, proof gate (final-response guard checked against the persisted playthrough and graph hash), unit-tested.
- 2026-10-30 Canvas UI done: `/home` room list and samples, `/rooms/<id>` canvas with inspector, undo, token animation, verdict panel, `/rooms/<id>/sheet` GM sheet (print + .md download). Darkroom theme.
- 2026-10-30 Verified in a real headless browser: STUCK with red pins and chain, fix by moving the flashlight, replay ESCAPED, GM sheet, chat answers via OpenRouter, agent builds a room from pasted text.
- 2026-10-30 README, AGENTS.md section, doctor clean.

## Decisions

- Action files are kebab-case (`create-room.ts`) because the framework derives tool names from filenames; the brief's camelCase names map 1:1 (`createRoom` is `create-room`).
- `requires` is allowed on every non-exit node (a clue can need a tool to be read, an item can need a tool to be taken), so "UV ink needs the UV flashlight" can be modelled.
- Single-use items: only spending choices are searched (bounded depth-first), so a room is stuck only if no spending order escapes.
- A playthrough stores a hash of the graph; an `escaped` verdict goes stale when nodes change, and the proof gate treats stale as unproven.
- Proof gate is a `finalResponseGuard`, not a loop `processors` entry: the framework docs say `processors` is not threaded through the HTTP chat handler yet, while `finalResponseGuard` is.
- `@fontsource-variable/barlow` does not exist on npm; Barlow comes from `@fontsource/barlow` (static weights), the display face is Barlow Condensed, mono is JetBrains Mono Variable.
- The brief's design lint script lives in a directory this session was told never to read, so it was not run. Replaced by a manual check of the brief's rules (zero radius, hairlines, no gradients, no `transition: all`, transform-only animation with reduced-motion fallback, no emoji, visible focus, body text 15-16px).
