# Deadbolt

An escape-room playtester. One designer and one AI agent share a live puzzle
canvas. You draw the room (or paste a description and the agent builds it),
press **PLAYTEST**, and a **deterministic walker** plays it like a player. When
the room deadlocks, the stuck node gets a red pin and the exact blocking chain
is written out in plain English. Fix it live, replay, then export a
game-master sheet with a walkthrough and 3-level hint ladders.

Built for the Builder.io Agent-Native Hackathon.

## What it does

- **Canvas** (`/rooms/<id>`): `@xyflow/react` cards for items, clues, locks and
  the exit. Edges show `contains` (dashed) and `requires` (solid). Add, edit,
  delete, drag, and edit `requires` / container from the inspector. Undo
  (Ctrl/Cmd+Z) covers edits, moves, adds and deletes.
- **Playtest**: a token hops node to node (about 600 ms per hop, instant under
  `prefers-reduced-motion`), then the verdict banner shows **ESCAPED** (amber)
  or **STUCK** (red pins plus the blocking-chain callout).
- **Agent** (sidebar chat, context-aware: it sees the selected node): builds a
  room from pasted text with `create-nodes`, explains a deadlock from the
  persisted analysis, proposes fixes as action calls, writes hint ladders, and
  writes the GM sheet.
- **Proof gate**: the agent may not claim a room is solvable unless the latest
  persisted `run-playtest` for it is `escaped` and the room has not been edited
  since. See [Proof gate](#proof-gate).
- **Sample rooms**, one click each: *The Séance* (solvable, red herring,
  single-use candle), *The Darkroom* (deliberate deadlock: the UV flashlight is
  locked in the safe whose code needs it), *The Supply Closet* (small classroom
  pH room).
- **GM sheet** (`/rooms/<id>/sheet`): rendered markdown, printable, and a
  download button.

## Run it

```bash
pnpm install
pnpm dev --port 4313        # http://localhost:4313, dev sign-in is automatic on loopback
pnpm typecheck
pnpm vitest --run           # engine, samples and proof-gate tests
pnpm agent-native:doctor
node scripts/smoke-darkroom.mjs http://localhost:4313   # end-to-end demo over the real actions
```

The agent uses OpenRouter (`@openrouter/ai-sdk-provider`). Put
`OPENROUTER_API_KEY` in `.env` (untracked). The default model is
`anthropic/claude-sonnet-4.5`, set in
`server/plugins/agent-native-email-branding.ts` and overridable with
`AGENT_MODEL` or the app settings. Data lives in local PGlite in development.

## Demo

Start from a clean slate before recording:

```bash
# stop the dev server first (local PGlite allows one process at a time)
pnpm script reset-demo-data     # or: npx tsx scripts/reset-demo-data.ts
pnpm dev --port 4313
```

The script clears rooms, nodes, playthroughs, hint ladders, GM sheets and chat
threads from the local database and seeds nothing. Load the sample rooms from
`/home` ("Load sample"). Tests never depend on it.

## The engine

`src/engine/` is pure TypeScript: no React, no I/O, no LLM. `playtest(nodes)`
returns:

| Field | Meaning |
|---|---|
| `verdict` | `escaped` or `stuck` |
| `trace` | ordered steps `{action: obtain/read/open/exit, nodeId}` |
| `stuckAnalysis` | for the exit and each unopened lock, the missing requirements as recursive reason chains, with requirement cycles named explicitly |
| `unreachable` | nodes never obtained, read or opened (wasted content) |
| `optional` | reachable nodes no exit requirement depends on |
| `criticalPathDepth` | longest requirement chain from an exit, in hops |
| `pinNodeIds`, `blockingNodeIds` | what the UI pins red / highlights |

Semantics: nodes are `item`, `clue`, `lock`, `exit`. An item or clue is
obtainable when its container lock is open (or it has none) and its own
`requires` are met. A lock opens when all its `requires` are satisfied (item
obtained, clue read, lock opened) and then reveals what is inside it. The exit
requirements all satisfied means **ESCAPED**. A `singleUse` item is consumed
when it satisfies a requirement. The walker is a fixed-point loop; actions that
spend nothing commute and are applied eagerly, and only single-use spending
choices are searched (depth-first, bounded), so a room is called stuck only if
no spending order escapes.

A reason chain reads, for The Darkroom: "The darkroom door needs the brass key
· the brass key is inside the wall safe · the wall safe needs the UV ink code ·
the UV ink code requires the UV flashlight · the UV flashlight is inside the
wall safe (unopened) — requirement cycle: the wall safe → the UV ink code → the
UV flashlight → the wall safe".

Decisions beyond the brief: clues and items may also carry `requires` (UV ink
needs the UV flashlight to be read), and a playthrough stores a hash of the
graph so an `escaped` verdict goes **stale** the moment a node is edited.

## Actions

Every operation is a `defineAction` shared by the UI buttons and the agent
(file names are kebab-case): `list-rooms`, `get-room`, `create-room`,
`rename-room`, `set-room-story`, `delete-room`, `create-node`, `create-nodes`,
`update-node`, `move-node`, `delete-node`, `arrange-nodes`,
`load-sample-room`, `run-playtest`, `save-hint-ladder`, `save-gm-sheet`.
Rooms are shareable resources (`server/db/schema.ts`); nodes, playthroughs,
hint ladders and GM sheets inherit the room's access check.

## Proof gate

`server/lib/proof-gate.ts` is the app's `finalResponseGuard` (wired in
`server/plugins/agent-chat.ts`). It runs on every final answer: if the text
asserts the room is solvable, escapable or deadlock-free (`src/engine/proofgate.ts`
ignores negations, hedges, questions and code), it looks up the room's latest
persisted playthrough and compares its graph hash with the current graph. If
the verdict is not a current `escaped`, the draft is sent back once with the
facts; if the model repeats it, the claim is replaced by a deterministic
notice. Deterministic proof beats LLM opinion. This is the framework's
documented seam for HTTP chat: the loop-level `processors` option is not
threaded through the chat handler yet, so the guard is the supported hook.

## Pre-existing work disclosure

Scaffolded from `@agent-native/core create --template chat` (framework by
Builder.io). All application code in this repository (engine, data model,
actions, canvas UI, agent prompt, proof gate, sample rooms, GM sheet) was
written during the hackathon, Oct 27 to Nov 9 2026. Third-party libraries:
`@xyflow/react`, Barlow and Barlow Condensed and JetBrains Mono via
`@fontsource`, Tabler icons.
