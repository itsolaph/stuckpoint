import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { memo } from "react";

import { KIND_META, type NodeKind } from "@/lib/room-kinds";

export interface CardData extends Record<string, unknown> {
  kind: NodeKind;
  name: string;
  containerName: string | null;
  /** Names of the nodes this one needs, in order. */
  requiresNames: string[];
  singleUse: boolean;
  visited: boolean;
  /** Part of the reported blocking chain or requirement cycle. */
  pinned: boolean;
}

export type CardNode = Node<CardData, "card">;

function NodeCardImpl({ data, selected }: NodeProps<CardNode>) {
  const { Icon, label } = KIND_META[data.kind];
  const needs = data.requiresNames.join(", ");
  const inside = data.containerName ? `in ${data.containerName}` : "";

  return (
    <div
      className="db-node"
      data-selected={selected ? "true" : "false"}
      data-visited={data.visited ? "true" : "false"}
      data-pinned={data.pinned ? "true" : "false"}
    >
      <Handle type="target" position={Position.Left} className="db-handle" />
      {data.pinned ? (
        <span className="db-node-pin" role="img" aria-label="In the blocking chain">
          Stuck
        </span>
      ) : null}
      <div className="db-node-kind">
        <Icon size={14} stroke={1.75} aria-hidden="true" />
        {label}
      </div>
      <div className="db-node-name">{data.name}</div>
      {inside ? (
        <div className="db-node-sub" title={inside}>
          {inside}
        </div>
      ) : null}
      {needs ? (
        <div className="db-node-sub" title={`needs ${needs}`}>
          needs {needs}
        </div>
      ) : null}
      {data.singleUse ? <div className="db-node-sub">single use</div> : null}
      <Handle type="source" position={Position.Right} className="db-handle" />
    </div>
  );
}

export const NodeCard = memo(NodeCardImpl);
