# Deadbolt build progress

- 2026-10-30 Restart: working tree was empty (scaffold only). Starting from the engine.
- Decision: action files are kebab-case (`create-room.ts`) because the framework derives tool names from filenames; the brief's camelCase names map 1:1 (`createRoom` -> `create-room`).
- Decision: `requires` is allowed on every non-exit node (a clue can need a tool to be read, an item can need a tool to be taken), so "UV ink needs the UV flashlight" can be modelled.
- 2026-10-30 engine done: `src/engine` (playtest walker, stuck analysis, GM sheet builder), 10 vitest cases green.
- Decision: the brief says to run an external lint script that lives outside this repo. It will not be run; verification step 5 is replaced by a manual check against the brief's design rules and reported as such.
