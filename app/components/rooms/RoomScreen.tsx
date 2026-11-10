import {
  actionErrorMessage,
  callAction,
  setClientAppState,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell/header-actions";
import {
  IconArrowBackUp,
  IconChevronRight,
  IconFileDescription,
  IconLayoutDashboard,
  IconPlayerPlayFilled,
  IconPlus,
  IconSettings,
} from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  applyNodeChanges,
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  useNodesInitialized,
  useReactFlow,
  type Connection,
  type Edge,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import {
  asAnalysis,
  KINDS,
  KIND_META,
  type NodeKind,
  type PlaytestAnalysis,
  type RoomNode,
} from "@/lib/room-kinds";
import { TAB_ID } from "@/lib/tab-id";

import { NodeCard, type CardNode } from "./NodeCard";
import { NodeInspector, type NodePatch } from "./NodeInspector";
import { RoomPanel } from "./RoomPanel";
import { VerdictPanel } from "./VerdictPanel";

const nodeTypes = { card: NodeCard };
const HOP_MS = 600;
const FIT = { padding: 0.15, maxZoom: 1.1 } as const;

interface UndoEntry {
  label: string;
  run: () => Promise<unknown>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function RoomScreen({ roomId }: { roomId: string }) {
  return (
    <ReactFlowProvider>
      <RoomInner roomId={roomId} />
    </ReactFlowProvider>
  );
}

function RoomInner({ roomId }: { roomId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { screenToFlowPosition, fitView, getNode } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const fitted = useRef(false);
  const { data, isLoading, error } = useActionQuery("get-room", { id: roomId });

  const [flowNodes, setFlowNodes] = useState<CardNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roomPanel, setRoomPanel] = useState(false);
  const [running, setRunning] = useState(false);
  const [play, setPlay] = useState<{
    index: number;
    nodeId: string;
    visited: Set<string>;
    analysis: PlaytestAnalysis;
  } | null>(null);
  const [undoCount, setUndoCount] = useState(0);
  const undoStack = useRef<UndoEntry[]>([]);
  const dragging = useRef(new Set<string>());
  const interacted = useRef(false);
  const lastCount = useRef(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const runToken = useRef(0);

  const nodes: RoomNode[] = useMemo(() => (data?.nodes ?? []) as RoomNode[], [data]);
  const names = useMemo(() => new Map(nodes.map((n) => [n.id, n.name])), [nodes]);
  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  const shown = play
    ? { analysis: play.analysis, stale: false }
    : data?.playthrough
      ? { analysis: asAnalysis(data.playthrough.analysis), stale: data.playthrough.stale }
      : null;
  const fresh = shown && !shown.stale && !play ? shown.analysis : null;
  const pinned = useMemo(
    () => new Set(fresh?.verdict === "stuck" ? fresh.pinNodeIds : []),
    [fresh],
  );
  const blocking = useMemo(
    () => new Set(fresh?.verdict === "stuck" ? fresh.blockingNodeIds : []),
    [fresh],
  );
  // Every node on the reported chain or cycle gets the red outline and badge.
  const flagged = useMemo(() => new Set([...pinned, ...blocking]), [pinned, blocking]);

  useSetPageTitle(
    <span className="flex items-center gap-1.5">
      <Link to="/home" className="text-[var(--db-muted)] hover:text-[var(--db-ink)]">
        Rooms
      </Link>
      <IconChevronRight size={14} aria-hidden="true" className="text-[var(--db-muted)]" />
      <span className="truncate">{data?.room.title ?? "…"}</span>
    </span>,
  );

  // ---- cache helpers ----
  const roomKey = useMemo(() => ["action", "get-room", { id: roomId }], [roomId]);
  const patchCache = useCallback(
    (fn: (nodes: RoomNode[]) => RoomNode[]) => {
      qc.setQueryData(roomKey, (old: typeof data) =>
        old ? { ...old, nodes: fn(old.nodes as RoomNode[]) } : old,
      );
    },
    [qc, roomKey],
  );
  const refresh = useCallback(
    () => qc.invalidateQueries({ queryKey: ["action", "get-room"] }),
    [qc],
  );
  const pushUndo = useCallback((entry: UndoEntry) => {
    undoStack.current.push(entry);
    if (undoStack.current.length > 30) undoStack.current.shift();
    setUndoCount(undoStack.current.length);
  }, []);
  const fail = useCallback(
    (err: unknown, fallback: string) => {
      toast.error(actionErrorMessage(err) ?? fallback);
      void refresh();
    },
    [refresh],
  );

  async function undo() {
    const entry = undoStack.current.pop();
    setUndoCount(undoStack.current.length);
    if (!entry) return;
    try {
      await entry.run();
      toast(`Undid: ${entry.label}`);
    } catch (err) {
      fail(err, "Could not undo that change.");
    }
    void refresh();
  }

  // ---- mutations ----
  async function updateNode(id: string, patch: NodePatch) {
    patchCache((all) => all.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    try {
      const res = await callAction("update-node", { roomId, id, ...patch });
      if (Object.keys(res.previous).length > 0) {
        pushUndo({
          label: `edit ${res.node.name}`,
          run: () => callAction("update-node", { roomId, id, ...res.previous }),
        });
      }
      void refresh();
    } catch (err) {
      fail(err, "Could not save that change.");
    }
  }

  async function addNode(kind: NodeKind) {
    const rect = canvasRef.current?.getBoundingClientRect();
    const pos = screenToFlowPosition({
      x: (rect?.left ?? 0) + (rect?.width ?? 600) * 0.4,
      y: (rect?.top ?? 0) + (rect?.height ?? 400) * 0.4,
    });
    try {
      const res = await callAction("create-node", {
        roomId,
        kind,
        name: `New ${KIND_META[kind].label.toLowerCase()}`,
        x: Math.round(pos.x),
        y: Math.round(pos.y),
      });
      interacted.current = true;
      setSelectedId(res.node.id);
      pushUndo({
        label: `add ${res.node.name}`,
        run: () => callAction("delete-node", { roomId, id: res.node.id }),
      });
      void refresh();
    } catch (err) {
      fail(err, "Could not add the node.");
    }
  }

  async function deleteNode(id: string) {
    const target = nodes.find((n) => n.id === id);
    if (!target) return;
    patchCache((all) => all.filter((n) => n.id !== id));
    if (selectedId === id) setSelectedId(null);
    try {
      const res = await callAction("delete-node", { roomId, id });
      const restore = async () => {
        const { removed } = res;
        await callAction("create-node", {
          roomId,
          id: removed.id,
          kind: removed.kind,
          name: removed.name,
          note: removed.note,
          containerId: removed.containerId,
          requires: removed.requires,
          singleUse: removed.singleUse,
          x: removed.x,
          y: removed.y,
        });
        for (const otherId of res.detachedRequirementFrom) {
          const cur = await callAction("get-room", { id: roomId });
          const other = cur.nodes.find((n) => n.id === otherId);
          if (other) {
            await callAction("update-node", {
              roomId,
              id: otherId,
              requires: [...other.requires, removed.id],
            });
          }
        }
        for (const otherId of res.releasedContents) {
          await callAction("update-node", { roomId, id: otherId, containerId: removed.id });
        }
      };
      pushUndo({ label: `delete ${target.name}`, run: restore });
      toast(`Deleted ${target.name}`, {
        action: {
          label: "Undo",
          onClick: () => {
            undoStack.current = undoStack.current.filter((e) => e.run !== restore);
            setUndoCount(undoStack.current.length);
            void restore()
              .then(refresh)
              .catch((e) => fail(e, "Could not restore the node."));
          },
        },
      });
      void refresh();
    } catch (err) {
      fail(err, "Could not delete the node.");
    }
  }

  async function moveNode(id: string, x: number, y: number) {
    try {
      const res = await callAction("move-node", { roomId, id, x: Math.round(x), y: Math.round(y) });
      if (res.previousX !== res.x || res.previousY !== res.y) {
        pushUndo({
          label: "move",
          run: () =>
            callAction("move-node", { roomId, id, x: res.previousX, y: res.previousY }),
        });
      }
      patchCache((all) => all.map((n) => (n.id === id ? { ...n, x: res.x, y: res.y } : n)));
    } catch (err) {
      fail(err, "Could not move the node.");
    }
  }

  async function arrange() {
    try {
      const res = await callAction("arrange-nodes", { roomId });
      pushUndo({
        label: "auto-arrange",
        run: async () => {
          for (const p of res.previous) {
            await callAction("move-node", { roomId, id: p.id, x: p.x, y: p.y });
          }
        },
      });
      interacted.current = false;
      await refresh();
      window.setTimeout(() => void fitView({ ...FIT, duration: 200 }), 120);
    } catch (err) {
      fail(err, "Could not arrange the nodes.");
    }
  }

  async function rename(title: string) {
    try {
      await callAction("rename-room", { id: roomId, title });
      void refresh();
    } catch (err) {
      fail(err, "Could not rename the room.");
    }
  }

  async function setStory(story: string) {
    try {
      await callAction("set-room-story", { id: roomId, story });
      void refresh();
    } catch (err) {
      fail(err, "Could not save the story.");
    }
  }

  async function removeRoom() {
    try {
      await callAction("delete-room", { id: roomId });
      navigate("/home");
    } catch (err) {
      fail(err, "Could not delete the room.");
    }
  }

  async function startPlaytest() {
    if (running) return;
    setRunning(true);
    const token = ++runToken.current;
    try {
      const res = await callAction("run-playtest", { roomId });
      const analysis = asAnalysis(res.result);
      await refresh();
      const steps = res.trace;
      if (prefersReducedMotion() || steps.length === 0) {
        setPlay(null);
        return;
      }
      for (let i = 0; i < steps.length; i++) {
        if (runToken.current !== token) return;
        setPlay({
          index: i,
          nodeId: steps[i]!.nodeId,
          visited: new Set(steps.slice(0, i + 1).map((s) => s.nodeId)),
          analysis,
        });
        await sleep(HOP_MS);
      }
      setPlay(null);
    } catch (err) {
      setPlay(null);
      fail(err, "The playtest could not run.");
    } finally {
      if (runToken.current === token) setRunning(false);
    }
  }

  // ---- flow state ----
  useEffect(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    setFlowNodes((prev) => {
      const prevById = new Map(prev.map((p) => [p.id, p]));
      return nodes.map((n) => {
        const old = prevById.get(n.id);
        const container = n.containerId ? byId.get(n.containerId) : null;
        return {
          id: n.id,
          type: "card" as const,
          position:
            dragging.current.has(n.id) && old ? old.position : { x: n.x, y: n.y },
          selected: n.id === selectedId,
          ...(old?.measured ? { measured: old.measured } : {}),
          data: {
            kind: n.kind,
            name: n.name,
            containerName: container?.name ?? null,
            requiresNames: n.requires.map((id) => byId.get(id)?.name ?? "missing node"),
            singleUse: n.singleUse,
            visited: play?.visited.has(n.id) ?? false,
            pinned: flagged.has(n.id),
          },
        };
      });
    });
  }, [nodes, selectedId, play, flagged]);

  const edges: Edge[] = useMemo(() => {
    const out: Edge[] = [];
    const ALARM = "#ff4d3d";
    const arrow = (color: string) => ({
      type: MarkerType.ArrowClosed,
      color,
      width: 18,
      height: 18,
    });
    for (const n of nodes) {
      if (n.containerId) {
        // Dashed "inside" edge from the lock to the item it hides.
        const red = flagged.has(n.id) && flagged.has(n.containerId);
        const color = red ? ALARM : "#8f8576";
        out.push({
          id: `c:${n.containerId}:${n.id}`,
          source: n.containerId,
          target: n.id,
          label: "inside",
          style: { stroke: color, strokeWidth: red ? 2 : 1.25, strokeDasharray: "6 5" },
          labelStyle: { fill: red ? ALARM : "#b3a695", fontSize: 12, fontFamily: "var(--db-font-mono)" },
          labelBgStyle: { fill: "#171009", fillOpacity: 1 },
          labelBgPadding: [4, 2],
          data: { relation: "contains" },
        });
      }
      for (const r of n.requires) {
        // Solid edge; the arrowhead sits on the required node: "this needs that".
        const red = flagged.has(n.id) && flagged.has(r);
        const color = red ? ALARM : "#b3a695";
        out.push({
          id: `r:${r}:${n.id}`,
          source: r,
          target: n.id,
          style: { stroke: color, strokeWidth: red ? 2 : 1.5 },
          markerStart: arrow(color),
          data: { relation: "requires" },
        });
      }
    }
    return out;
  }, [nodes, flagged]);

  const onNodesChange = useCallback((changes: NodeChange<CardNode>[]) => {
    const applied = changes.filter((c) => c.type !== "select");
    setFlowNodes((prev) => applyNodeChanges(applied, prev));
  }, []);

  const onConnect = (c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return;
    const target = nodes.find((n) => n.id === c.target);
    const source = nodes.find((n) => n.id === c.source);
    if (!target || !source || source.kind === "exit") return;
    if (target.requires.includes(source.id)) return;
    void updateNode(target.id, { requires: [...target.requires, source.id] });
  };

  // Fit the view when nodes appear (agent building a room) unless the user took over.
  useEffect(() => {
    if (nodes.length === lastCount.current) return;
    const grew = nodes.length > lastCount.current;
    lastCount.current = nodes.length;
    if (!grew || interacted.current) return;
    const id = window.setTimeout(() => void fitView({ ...FIT, duration: 250 }), 250);
    return () => window.clearTimeout(id);
  }, [nodes.length, fitView]);

  // Fit once the cards have been measured, so the graph fills the viewport on load.
  useEffect(() => {
    if (fitted.current || !nodesInitialized || flowNodes.length === 0) return;
    fitted.current = true;
    const id = window.requestAnimationFrame(() => void fitView({ ...FIT, duration: 0 }));
    return () => window.cancelAnimationFrame(id);
  }, [nodesInitialized, flowNodes.length, fitView]);

  // Keep the graph fitted when the canvas is resized, until the user pans or zooms.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let timer = 0;
    const observer = new ResizeObserver(() => {
      if (interacted.current) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void fitView({ ...FIT, duration: 0 }), 120);
    });
    observer.observe(el);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [fitView, isLoading]);

  // Tell the agent what is selected.
  useEffect(() => {
    const key = `selection:${TAB_ID}`;
    const value = selected
      ? { kind: "node", roomId, nodeId: selected.id, name: selected.name }
      : null;
    void setClientAppState(key, value, { requestSource: TAB_ID }).catch(() => undefined);
  }, [selected?.id, selected?.name, roomId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        void undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(
    () => () => {
      runToken.current += 1;
    },
    [],
  );

  const tokenNode = play ? getNode(play.nodeId) : undefined;

  function focusNode(id: string) {
    setSelectedId(id);
    const n = getNode(id);
    if (n) void fitView({ nodes: [{ id }], padding: 1.5, duration: 250, maxZoom: 1 });
  }

  if (isLoading) {
    return (
      <div className="db-room" aria-busy="true">
        <div className="db-toolbar">
          <Skeleton className="h-9 w-72" />
        </div>
        <Skeleton className="m-3 flex-1" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="db-home">
        <p className="db-empty">
          {actionErrorMessage(error) ?? "This room could not be opened."}{" "}
          <Link to="/home" className="text-[var(--db-accent)]">
            Back to rooms
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="db-room">
      <div className="db-toolbar" role="toolbar" aria-label="Room tools">
        <div className="db-toolgroup" role="group" aria-label="Add a node">
        {KINDS.map((k) => {
          const { Icon, label } = KIND_META[k];
          return (
            <button
              key={k}
              type="button"
              className="db-btn db-btn--sm"
              onClick={() => void addNode(k)}
            >
              <IconPlus size={14} aria-hidden="true" />
              <Icon size={14} aria-hidden="true" />
              {label}
            </button>
          );
        })}
        </div>
        <div className="db-toolgroup" role="group" aria-label="Layout and history">
        <button type="button" className="db-btn db-btn--sm" onClick={() => void arrange()}>
          <IconLayoutDashboard size={14} aria-hidden="true" />
          Arrange
        </button>
        <button
          type="button"
          className="db-btn db-btn--sm"
          disabled={undoCount === 0}
          onClick={() => void undo()}
        >
          <IconArrowBackUp size={14} aria-hidden="true" />
          Undo
        </button>
        </div>
        <div className="db-toolgroup" role="group" aria-label="Room">
        <button
          type="button"
          className="db-btn db-btn--sm"
          aria-pressed={roomPanel}
          onClick={() => {
            setSelectedId(null);
            setRoomPanel((v) => !v);
          }}
        >
          <IconSettings size={14} aria-hidden="true" />
          Room settings
        </button>
        </div>
        <span className="db-toolbar-spacer" />
        <Link to={`/rooms/${roomId}/sheet`} className="db-btn db-btn--sm">
          <IconFileDescription size={14} aria-hidden="true" />
          GM sheet
        </Link>
        <button
          type="button"
          className="db-btn db-btn--primary"
          disabled={running || nodes.length === 0}
          onClick={() => void startPlaytest()}
        >
          <IconPlayerPlayFilled size={14} aria-hidden="true" />
          {running ? "Walking…" : "Playtest"}
        </button>
      </div>

      <div className="db-workspace">
      <div className="db-canvas" ref={canvasRef}>
        {nodes.length === 0 ? (
          <p className="db-empty absolute inset-x-0 top-8 z-[5] mx-auto max-w-md border-0 text-center">
            An empty room. Add a node above, or ask the agent in the sidebar to
            build the room from a description.
          </p>
        ) : null}
        <ReactFlow
          nodes={flowNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={(_, n) => {
            setRoomPanel(false);
            setSelectedId(n.id);
          }}
          onPaneClick={() => setSelectedId(null)}
          onNodeDragStart={(_, n) => {
            interacted.current = true;
            dragging.current.add(n.id);
          }}
          onNodeDragStop={(_, n) => {
            dragging.current.delete(n.id);
            void moveNode(n.id, n.position.x, n.position.y);
          }}
          onMoveStart={(event) => {
            if (event) interacted.current = true;
          }}
          onConnect={onConnect}
          onNodesDelete={(del) => del.forEach((n) => void deleteNode(n.id))}
          onEdgesDelete={(del) => {
            for (const e of del) {
              const target = nodes.find((n) => n.id === e.target);
              if (!target) continue;
              if ((e.data as { relation?: string } | undefined)?.relation === "contains") {
                void updateNode(target.id, { containerId: null });
              } else {
                void updateNode(target.id, {
                  requires: target.requires.filter((r) => r !== e.source),
                });
              }
            }
          }}
          deleteKeyCode={["Backspace", "Delete"]}
          fitView
          fitViewOptions={FIT}
          minZoom={0.3}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          colorMode="dark"
          nodesConnectable
        >
          <Background gap={28} size={1} color="rgba(236,229,214,0.08)" />
          <Controls showInteractive={false} />
          {play && tokenNode ? (
            <ViewportPortal>
              <div
                className="db-token"
                aria-hidden="true"
                style={{
                  transform: `translate(${tokenNode.position.x - 10}px, ${tokenNode.position.y - 10}px)`,
                }}
              />
            </ViewportPortal>
          ) : null}
        </ReactFlow>

        <div className="db-legend" aria-label="Legend">
          <span className="db-legend-item">
            <svg width="30" height="10" aria-hidden="true">
              <line x1="8" y1="5" x2="30" y2="5" stroke="#b3a695" strokeWidth="1.5" />
              <path d="M0 5 L8 1.5 L8 8.5 Z" fill="#b3a695" />
            </svg>
            needs
          </span>
          <span className="db-legend-item">
            <svg width="30" height="10" aria-hidden="true">
              <line x1="0" y1="5" x2="30" y2="5" stroke="#8f8576" strokeWidth="1.5" strokeDasharray="5 4" />
            </svg>
            inside
          </span>
        </div>

        {selected ? (
          <NodeInspector
            node={selected}
            allNodes={nodes}
            hints={data.hintLadders.find((h) => h.nodeId === selected.id)?.hints ?? null}
            onPatch={(patch) => void updateNode(selected.id, patch)}
            onDelete={() => void deleteNode(selected.id)}
            onClose={() => setSelectedId(null)}
          />
        ) : roomPanel ? (
          <RoomPanel
            title={data.room.title}
            story={data.room.story}
            onRename={(t) => void rename(t)}
            onStory={(s) => void setStory(s)}
            onDelete={() => void removeRoom()}
            onClose={() => setRoomPanel(false)}
          />
        ) : null}
      </div>
      <VerdictPanel
        roomId={roomId}
        analysis={shown ? shown.analysis : null}
        stale={shown ? shown.stale : false}
        names={names}
        playingIndex={play ? play.index : null}
        onFocusNode={focusNode}
      />
      </div>
    </div>
  );
}
