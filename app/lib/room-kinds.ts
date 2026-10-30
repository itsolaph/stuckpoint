import {
  IconDoorExit,
  IconFileText,
  IconKey,
  IconLock,
  type Icon,
} from "@tabler/icons-react";

export type NodeKind = "item" | "clue" | "lock" | "exit";

export const KIND_META: Record<NodeKind, { label: string; Icon: Icon }> = {
  item: { label: "Item", Icon: IconKey },
  clue: { label: "Clue", Icon: IconFileText },
  lock: { label: "Lock", Icon: IconLock },
  exit: { label: "Exit", Icon: IconDoorExit },
};

export const KINDS: NodeKind[] = ["item", "clue", "lock", "exit"];

export interface RoomNode {
  id: string;
  roomId: string;
  kind: NodeKind;
  name: string;
  note: string;
  containerId: string | null;
  requires: string[];
  singleUse: boolean;
  x: number;
  y: number;
}

export interface StuckChain {
  targetId: string;
  nodeIds: string[];
  steps: string[];
  text: string;
  cycle: string[] | null;
  endsWith: string;
}

export interface PlaytestAnalysis {
  verdict: "escaped" | "stuck";
  trace: { action: string; nodeId: string }[];
  stuckAnalysis: { nodeId: string; kind: "exit" | "lock"; chains: StuckChain[] }[];
  unreachable: string[];
  optional: string[];
  criticalPathDepth: number;
  pinNodeIds: string[];
  blockingNodeIds: string[];
  warnings: string[];
  graphHash?: string;
}

export function asAnalysis(raw: Record<string, unknown>): PlaytestAnalysis {
  return raw as unknown as PlaytestAnalysis;
}
