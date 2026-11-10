import { useParams } from "react-router";

import { PRODUCT_NAME } from "@/brand";
import { GmSheetView } from "@/components/rooms/GmSheetView";

export function meta() {
  return [{ title: `GM sheet - ${PRODUCT_NAME}` }];
}

export default function GmSheetRoute() {
  const { roomId = "" } = useParams();
  return <GmSheetView key={roomId} roomId={roomId} />;
}
