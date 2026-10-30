import { IconMapPinFilled } from "@tabler/icons-react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { memo } from "react";

import { KIND_META, type NodeKind } from "@/lib/room-kinds";

export interface CardData extends Record<string, unknown> {
  kind: NodeKind;
  name: string;
  containerName: string | null;
  requiresCount: number;
  singleUse: boolean;
  visited: boolean;
  pinned: boolean;
}

export type CardNode = Node<CardData, "card">;

function NodeCardImpl({ data, selected }: NodeProps<CardNode>) {
  const { Icon, label } = KIND_META[data.kind];
  const subs: string[] = [];
  if (data.containerName) subs.push(`in ${data.containerName}`);
  if (data.requiresCount > 0) {
    subs.push(`needs ${data.requiresCount}`);
  }
  if (data.singleUse) subs.push("single use");

  return (
    <div
      className="db-node"
      data-selected={selected ? "true" : "false"}
      data-visited={data.visited ? "true" : "false"}
      data-pinned={data.pinned ? "true" : "false"}
    >
      <Handle type="target" position={Position.Left} className="db-handle" />
      {data.pinned ? (
        <span className="db-node-pin" role="img" aria-label="Deadlock pin">
          <IconMapPinFilled size={16} aria-hidden="true" />
        </span>
      ) : null}
      <div className="db-node-kind">
        <Icon size={14} stroke={1.75} aria-hidden="true" />
        {label}
      </div>
      <div className="db-node-name">{data.name}</div>
      {subs.length > 0 ? <div className="db-node-sub">{subs.join(" · ")}</div> : null}
      <Handle type="source" position={Position.Right} className="db-handle" />
    </div>
  );
}

export const NodeCard = memo(NodeCardImpl);
