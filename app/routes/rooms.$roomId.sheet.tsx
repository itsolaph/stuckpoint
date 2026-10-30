import { useParams } from "react-router";

import { GmSheetView } from "@/components/rooms/GmSheetView";

export function meta() {
  return [{ title: "GM sheet - Deadbolt" }];
}

export default function GmSheetRoute() {
  const { roomId = "" } = useParams();
  return <GmSheetView key={roomId} roomId={roomId} />;
}
