import { defineAction } from "@agent-native/core/action";
import {
  readAppState,
  readAppStateForCurrentTab,
} from "@agent-native/core/application-state";
import { z } from "zod";

import {
  graphHash,
  latestPlaythrough,
  listNodeRows,
  loadRoom,
  toEngineNode,
} from "../server/lib/rooms.js";

export default defineAction({
  description:
    "Read what the user is looking at: navigation, and when a room is open, its nodes, the selected node, and the latest playtest verdict and stuck analysis (with whether it is stale). Use this before answering a why-is-this-stuck question; it does not re-run anything.",
  schema: z.object({}),
  http: false,
  readOnly: true,
  run: async () => {
    const navigation = (await readAppState("navigation")) as {
      roomId?: string;
    } | null;

    const screen: Record<string, unknown> = {};
    if (navigation) screen.navigation = navigation;

    const roomId = navigation?.roomId;
    if (roomId) {
      try {
        const room = await loadRoom(roomId, "viewer");
        const rows = await listNodeRows(room.id);
        const names = Object.fromEntries(rows.map((n) => [n.id, n.name]));
        const selection = (await readAppStateForCurrentTab("selection")) as {
          nodeId?: string;
        } | null;
        const selected = rows.find((n) => n.id === selection?.nodeId);
        const play = await latestPlaythrough(room.id);
        const brief = (n: (typeof rows)[number]) => ({
          id: n.id,
          kind: n.kind,
          name: n.name,
          note: n.note,
          containerId: n.containerId,
          requires: n.requires,
          singleUse: n.singleUse,
        });
        screen.room = {
          id: room.id,
          title: room.title,
          story: room.story,
          nodes: rows.map(brief),
        };
        if (selected) screen.selectedNode = brief(selected);
        screen.latestPlaythrough = play
          ? {
              id: play.id,
              verdict: play.verdict,
              createdAt: play.createdAt,
              stale:
                play.analysis.graphHash !== graphHash(rows.map(toEngineNode)),
              analysis: play.analysis,
              nodeNames: names,
            }
          : null;
      } catch {
        screen.room = { error: "The open room could not be read." };
      }
    }

    if (Object.keys(screen).length === 0) {
      return "No application state found. Is the app running?";
    }
    return screen;
  },
});
