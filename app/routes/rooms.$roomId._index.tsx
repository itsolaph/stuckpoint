import { useParams } from "react-router";

import { RoomScreen } from "@/components/rooms/RoomScreen";

export function meta() {
  return [{ title: "Room - Deadbolt" }];
}

export default function RoomRoute() {
  const { roomId = "" } = useParams();
  return <RoomScreen key={roomId} roomId={roomId} />;
}
