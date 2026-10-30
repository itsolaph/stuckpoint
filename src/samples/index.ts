import type { NodeKind } from "../engine/types";

export interface SampleNode {
  ref: string;
  kind: NodeKind;
  name: string;
  note: string;
  containerRef?: string;
  requiresRefs?: string[];
  singleUse?: boolean;
}

export interface SampleRoom {
  key: SampleKey;
  title: string;
  story: string;
  /** One-line pitch shown on the sample card. */
  blurb: string;
  nodes: SampleNode[];
  /** Hint ladders (nudge -> direction -> answer) keyed by node ref. */
  hints: { ref: string; hints: [string, string, string] }[];
}

export type SampleKey = "seance" | "darkroom" | "supply-closet";

export const SAMPLE_ROOMS: Record<SampleKey, SampleRoom> = {
  seance: {
    key: "seance",
    title: "The Séance",
    blurb: "Solvable. A candle that burns once, a wall safe, and a red herring.",
    story:
      "The medium vanished mid-ritual and the parlor door is bolted from inside. Her last séance left clues scattered around the room. Find the spirit's message, open the safe, and get out before the candle dies.",
    nodes: [
      { ref: "front-door", kind: "exit", name: "Front door", note: "Bolted. Takes a brass key.", requiresRefs: ["brass-key"] },
      { ref: "brass-key", kind: "item", name: "Brass key", note: "Heavy, tarnished, stamped with a crescent moon.", containerRef: "wall-safe" },
      { ref: "wall-safe", kind: "lock", name: "Wall safe", note: "Four-digit dial behind the portrait. The code is a year.", requiresRefs: ["spirit-message", "portrait-inscription"] },
      { ref: "portrait-inscription", kind: "clue", name: "Portrait inscription", note: "\"Born under the waning moon, 1887.\"" },
      { ref: "spirit-message", kind: "clue", name: "Spirit message", note: "Spelled out on the board: THE YEAR SHE WAS BORN.", containerRef: "seance-table", requiresRefs: ["planchette"] },
      { ref: "planchette", kind: "item", name: "Planchette", note: "A heart-shaped pointer for the spirit board.", containerRef: "seance-table" },
      { ref: "seance-table", kind: "lock", name: "Séance table", note: "A drawer that only opens once the ritual is lit.", requiresRefs: ["black-candle", "matches"] },
      { ref: "black-candle", kind: "item", name: "Black candle", note: "Burns out after one lighting.", singleUse: true },
      { ref: "matches", kind: "item", name: "Box of matches", note: "Tucked behind the curtain." },
      { ref: "music-box", kind: "lock", name: "Music box", note: "Red herring: a locked music box that plays a lullaby.", requiresRefs: ["tiny-crank"] },
      { ref: "tiny-crank", kind: "item", name: "Tiny crank", note: "Fits the music box winder." },
      { ref: "faded-photo", kind: "clue", name: "Faded photo", note: "A family photo. Interesting, but not needed to escape.", containerRef: "music-box" },
      { ref: "silver-locket", kind: "item", name: "Silver locket", note: "Bonus prop for atmosphere; not on the escape path.", containerRef: "wall-safe" },
    ],
    hints: [
      { ref: "seance-table", hints: ["The table seems to be waiting for something.", "A ritual needs light: look for a candle and a way to light it.", "Light the black candle with the matches to open the drawer."] },
      { ref: "wall-safe", hints: ["The dial wants a number you have not seen yet.", "Two clues together give a year: one spoken, one written.", "Dial 1887: the spirit message asks for her birth year, and the portrait gives it."] },
    ],
  },

  darkroom: {
    key: "darkroom",
    title: "The Darkroom",
    blurb: "Deadlocked on purpose: the UV flashlight is locked in the safe that needs it.",
    story:
      "A photographer's darkroom, lit only by a red safelight. The door needs a key that is kept in the wall safe. The safe's code was written in UV ink.",
    nodes: [
      { ref: "darkroom-door", kind: "exit", name: "Darkroom door", note: "Locked from the outside. Needs the brass key.", requiresRefs: ["brass-key"] },
      { ref: "brass-key", kind: "item", name: "Brass key", note: "Hangs on a hook inside the safe.", containerRef: "wall-safe" },
      { ref: "wall-safe", kind: "lock", name: "Wall safe", note: "Four-digit keypad.", requiresRefs: ["uv-code"] },
      { ref: "uv-code", kind: "clue", name: "UV ink code", note: "A number written in ink that only shows under UV light.", requiresRefs: ["uv-flashlight"] },
      { ref: "uv-flashlight", kind: "item", name: "UV flashlight", note: "Stored in the safe with the other equipment.", containerRef: "wall-safe" },
      { ref: "safelight", kind: "item", name: "Red safelight", note: "Decoration; gives the room its glow." },
      { ref: "contact-sheet", kind: "clue", name: "Contact sheet", note: "Thirty-six frames of nothing useful." },
    ],
    hints: [
      { ref: "wall-safe", hints: ["The safe needs a code you cannot see yet.", "The code is hidden in UV ink; something has to reveal it.", "The UV flashlight is inside the safe itself: move it into the open (for example onto the shelf) so players can read the code."] },
    ],
  },

  "supply-closet": {
    key: "supply-closet",
    title: "The Supply Closet",
    blurb: "Classroom example: a pH lesson turned into a six-minute puzzle.",
    story:
      "Teacher-built room for a chemistry unit on acids and bases. The supply closet is padlocked and the code is the pH of the mystery liquid. Students test it with red cabbage indicator and read the colour chart.",
    nodes: [
      { ref: "closet-door", kind: "exit", name: "Closet door", note: "Opens with the key card from the padlock box.", requiresRefs: ["key-card"] },
      { ref: "key-card", kind: "item", name: "Key card", note: "Swipe card for the closet door.", containerRef: "padlock-box" },
      { ref: "padlock-box", kind: "lock", name: "Padlock box", note: "Three-digit code: the pH of the mystery liquid.", requiresRefs: ["indicator-result", "colour-chart"] },
      { ref: "indicator-result", kind: "clue", name: "Indicator result", note: "Cabbage juice turns the liquid pink: an acid, pH about 2.", requiresRefs: ["cabbage-juice", "mystery-liquid"] },
      { ref: "cabbage-juice", kind: "item", name: "Red cabbage juice", note: "A natural pH indicator in a dropper bottle." },
      { ref: "mystery-liquid", kind: "item", name: "Mystery liquid", note: "A clear liquid labelled only \"A\". It is vinegar." },
      { ref: "colour-chart", kind: "clue", name: "pH colour chart", note: "Maps indicator colours to pH numbers." },
    ],
    hints: [
      { ref: "padlock-box", hints: ["The code is a number from science class.", "Test the mystery liquid, then match the colour to the chart.", "Pink on the chart means pH 2: enter 002."] },
    ],
  },
};

export const SAMPLE_KEYS = Object.keys(SAMPLE_ROOMS) as SampleKey[];
