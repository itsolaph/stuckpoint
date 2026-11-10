# Deadbolt build progress

- 2026-10-30 Restart: working tree was empty (scaffold only). Started from the engine.
- 2026-10-30 Engine done: `src/engine` (walker, stuck analysis with named cycles, GM sheet builder, layout), 10 vitest cases green.
- 2026-10-30 Data model + actions done: rooms, nodes, playthroughs, hint_ladders, gm_sheets (PGlite via drizzle); 17 actions shared by UI and agent; 3 sample rooms with hint ladders.
- 2026-10-30 Agent done: system prompt, tool list, proof gate (final-response guard checked against the persisted playthrough and graph hash), unit-tested.
- 2026-10-30 Canvas UI done: `/home` room list and samples, `/rooms/<id>` canvas with inspector, undo, token animation, verdict panel, `/rooms/<id>/sheet` GM sheet (print + .md download). Darkroom theme.
- 2026-10-30 Verified in a real headless browser: STUCK with red pins and chain, fix by moving the flashlight, replay ESCAPED, GM sheet, chat answers via OpenRouter, agent builds a room from pasted text.
- 2026-10-30 README, AGENTS.md section, doctor clean.
- 2026-11-10 Polish pass, code done and committed (4 commits): PRODUCT_NAME constant, docked verdict panel with numbered chain, stuck badges on all chain nodes, dashed "inside" edges + arrowheads + legend, grouped toolbar, home rows with edit time and Open button, chat title ellipsis, reset-demo-data script, `salt` ignored. typecheck, 37/37 tests and doctor are clean.
- 2026-11-10 Polish pass BLOCKED on browser verification: the harness required approval to start `PORT=4314 pnpm exec agent-native dev` and the session is non-interactive, so pw/smoke.js and the polish screenshots were NOT run. Layout, fit-to-viewport and the top-right icon tooltip are unverified visually.

## Decisions

- Action files are kebab-case (`create-room.ts`) because the framework derives tool names from filenames; the brief's camelCase names map 1:1 (`createRoom` is `create-room`).
- `requires` is allowed on every non-exit node (a clue can need a tool to be read, an item can need a tool to be taken), so "UV ink needs the UV flashlight" can be modelled.
- Single-use items: only spending choices are searched (bounded depth-first), so a room is stuck only if no spending order escapes.
- A playthrough stores a hash of the graph; an `escaped` verdict goes stale when nodes change, and the proof gate treats stale as unproven.
- Proof gate is a `finalResponseGuard`, not a loop `processors` entry: the framework docs say `processors` is not threaded through the HTTP chat handler yet, while `finalResponseGuard` is.
- `@fontsource-variable/barlow` does not exist on npm; Barlow comes from `@fontsource/barlow` (static weights), the display face is Barlow Condensed, mono is JetBrains Mono Variable.
- The brief's design lint script lives in a directory this session was told never to read, so it was not run. Replaced by a manual check of the brief's rules (zero radius, hairlines, no gradients, no `transition: all`, transform-only animation with reduced-motion fallback, no emoji, visible focus, body text 15-16px).
- 2026-11-10 Restart after interruption: tree clean, all polish commits present. Starting `PORT=4314 pnpm exec agent-native dev` is still refused (approval required, non-interactive), so browser verification remains undone. See deadbolt-build/POLISH-BLOCKED.md.
- Polish: containment edges and requirement arrowheads are styled with inline edge `style` (the earlier `className` landed on the wrapper group, so dashes never showed). Requirement arrowheads sit on the required node ("this needs that"), matching the legend and the chain wording.
- Polish: the red badge is the word "Stuck" on every node in the blocking chain or cycle (pins plus blocking ids), not a glyph.
- Polish: the verdict dock is always visible (idle text before the first run) so the canvas never resizes after the first playtest.
- Polish: `list-rooms` gained an additive `updatedAt` (latest node edit or room creation) for the "edited ..." line.
- Polish: the top-right icon is the toolkit `AgentToggleButton`, which already carries an aria-label and tooltip; not changed.

## 2026-11-10 Lock shop redesign

Replaced the Darkroom look entirely (Barlow, JetBrains Mono, grain, `--db-*` tokens and `app/deadbolt.css` are gone). New styles live in `app/stuckpoint.css`, tokens are `--sp-*` in `app/global.css`. Data wiring, actions and behaviour are unchanged; the e2e hooks (`.db-node`, `.db-verdict[data-verdict]`, `.db-sheet h2`, `.db-chain li`, button and link texts) are kept.

Verified: typecheck clean, 37/37 tests, doctor clean, smoke 10/10, desktop and 390px mobile screenshots reviewed twice.

Decisions:
- Type: Archivo variable via `@fontsource-variable/archivo/wdth.css` (wght plus wdth axes). Display text uses `font-stretch` 112-125%, UI text stays at 100%.
- One slim top bar: the room title (inline input, renames on blur or Enter, Escape reverts), Arrange, Undo, Room settings, GM sheet and Playtest sit in the shell header via `useSetPageTitle` and `useSetHeaderActions`. The wordmark is in the sidebar row next to it. The header is white and 56px tall to line up with the sidebar's wordmark row.
- The add-node buttons are colour-chip pills in the top-left of the canvas and double as the kind legend; the edge legend (needs, inside) sits next to them and is hidden on phones.
- Verdict slab: shown only once the room has a playtest, so before the first run a quiet "Press Playtest" note sits on the canvas. The slab takes layout space under the canvas, so the existing resize observer refits the graph into the visible area above it. On the stuck verdict the chips are the first blocking chain's real `nodeIds`, the sentence names the cycle, and "Show all N steps" and "What players can still do" expand the numbered steps and the walker trace. The escaped verdict shows the route as numbered chips.
- The slab's escaped action is a button labelled "GM sheet" (it navigates). Making it a link would give two links called "GM sheet" and break the smoke test's strict `getByRole("link")` lookup.
- GM sheet display: the markdown is split at `##` headings into sections, so the walkthrough renders as a numbered route and hint ladders as rungs (34/67/100% width, peg grey to ink). On screen only, the `# Title — game master sheet` heading shows as the title plus a quiet "Game master sheet" line, and the summary line uses commas instead of middle dots. The downloaded markdown and the engine are untouched.
- Inspector field "Requires" is now labelled "Needs" to match the tile text and the legend.
- `minZoom` lowered to 0.15 so the graph can fit a 390px phone.
- Removed the now-unused `@fontsource/barlow`, `@fontsource/barlow-condensed` and `@fontsource-variable/jetbrains-mono` dependencies.
- Not visually verified: the ink user bubble in a live chat thread (it needs a model call). It is styled through `.agentkit-message[data-role="user"]`.
- The smoke test's 3 console warnings ("script tag while rendering") come from the theme and locale init scripts in `app/root.tsx`. Those scripts predate this redesign and were not changed.
