import { useParams } from "react-router";

import { PRODUCT_NAME } from "@/brand";
import { RoomScreen } from "@/components/rooms/RoomScreen";

export function meta() {
  return [{ title: `Room - ${PRODUCT_NAME}` }];
}

export default function RoomRoute() {
  const { roomId = "" } = useParams();
  return <RoomScreen key={roomId} roomId={roomId} />;
}
