import { useSetPageTitle } from "@agent-native/toolkit/app-shell/header-actions";

import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/brand";
import { RoomsHome } from "@/components/rooms/RoomsHome";

export function meta() {
  return [
    { title: `${PRODUCT_NAME} - ${PRODUCT_TAGLINE}` },
    {
      name: "description",
      content:
        "Draw an escape room, let a deterministic walker playtest it, and find the exact chain that deadlocks it.",
    },
  ];
}

export default function HomeRoute() {
  // The list below carries the only "Rooms" heading.
  useSetPageTitle("");
  return <RoomsHome />;
}
