import { z } from "zod";

export const kindSchema = z
  .enum(["item", "clue", "lock", "exit"])
  .describe(
    'Node kind: "item" (a prop to pick up), "clue" (read, never consumed), "lock" (opens when all its requires are met and reveals what is inside it), or "exit" (escaping the room).',
  );

export const nodeOut = z.object({
  id: z.string(),
  roomId: z.string(),
  kind: z.enum(["item", "clue", "lock", "exit"]),
  name: z.string(),
  note: z.string(),
  containerId: z.string().nullable(),
  requires: z.array(z.string()),
  singleUse: z.boolean(),
  x: z.number(),
  y: z.number(),
});

export const roomIdSchema = z.string().describe("Room id from list-rooms");
export const nodeIdSchema = z.string().describe("Node id from get-room");
