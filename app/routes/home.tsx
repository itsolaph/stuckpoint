import { useSetPageTitle } from "@agent-native/toolkit/app-shell/header-actions";

import { RoomsHome } from "@/components/rooms/RoomsHome";

export function meta() {
  return [
    { title: "Deadbolt - escape-room playtester" },
    {
      name: "description",
      content:
        "Draw an escape room, let a deterministic walker playtest it, and find the exact chain that deadlocks it.",
    },
  ];
}

export default function HomeRoute() {
  useSetPageTitle(<span className="db-display">Rooms</span>);
  return <RoomsHome />;
}
