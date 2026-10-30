import { createGetDb } from "@agent-native/core/db";
import { registerShareableResource } from "@agent-native/core/sharing";

import * as schema from "./schema.js";

export const getDb = createGetDb(schema);
export { schema };

registerShareableResource({
  type: "room",
  resourceTable: schema.rooms,
  sharesTable: schema.roomShares,
  displayName: "Room",
  titleColumn: "title",
  getResourcePath: (room) => `/rooms/${room.id}`,
  getDb,
});
