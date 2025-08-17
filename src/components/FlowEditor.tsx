// src/components/FlowEditor.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  type Connection,
  type Edge,
  type Node,
  useEdgesState,
  useNodesState,
  MarkerType,
  ConnectionMode,
  type OnConnect,
  type OnSelectionChangeParams,
} from "reactflow";
import "reactflow/dist/style.css";
import "../styles/reactflow-overrides.css";
import { api } from "../trpc/react";
import { useAutosave } from "../utils/autosave";

type FlowNodeData = { label: string };
type FlowEdgeData = { bendPoints?: { x: number; y: number }[] };

function toRFNode(n: any): Node<FlowNodeData> {
  return {
    id: String(n.id),
    position: { x: Number(n.x) || 0, y: Number(n.y) || 0 },
    data: { label: `${n.title}${n.subtitle ? ` → ${n.subtitle}` : ""}` },
    style: {
      borderLeft: `6px solid ${n.colorHex ?? "#6b7280"}`,
      borderRadius: 10,
      boxShadow:
        "0 1px 1px rgba(0,0,0,0.04), 0 10px 20px -5px rgba(0,0,0,0.06)",
      padding: 6,
    },
  };
}

function toRFBendPoints(bp: unknown) {
  if (!Array.isArray(bp)) return undefined;
  const arr = bp
    .map((p) =>
      p &&
      typeof p === "object" &&
      "x" in p &&
      "y" in p &&
      typeof (p as any).x === "number" &&
      typeof (p as any).y === "number"
        ? { x: (p as any).x, y: (p as any).y }
        : null,
    )
    .filter(Boolean) as { x: number; y: number }[];
  return arr.length ? arr : undefined;
}

function toRFEdge(e: any): Edge<FlowEdgeData> {
  return {
    id: String(e.id),
    source: String(e.sourceNodeId),
    target: String(e.targetNodeId),
    type: "default",
    markerEnd: { type: MarkerType.ArrowClosed },
    data: { bendPoints: toRFBendPoints(e.bendPoints) },
  };
}

// Stable color by id
function stableHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}
function stableColor(seed: string): string {
  const h = stableHue(seed);
  return `hsl(${h}deg 62% 55%)`;
}

export default function FlowEditor({ projectId }: { projectId: string }) {
  const utils = api.useUtils();
  const { data } = api.flow.list.useQuery({ projectId });

  // Map server data to RF
  const initialNodes = useMemo(
    () => (data?.nodes ?? []).map(toRFNode),
    [data?.nodes],
  );
  const initialEdges = useMemo(
    () => (data?.edges ?? []).map(toRFEdge),
    [data?.edges],
  );

  // RF state
  const [nodes, setNodes, onNodesChange] =
    useNodesState<FlowNodeData>(initialNodes);
  const [edges, setEdges, onEdgesChange] =
    useEdgesState<FlowEdgeData>(initialEdges);

  // Selection state
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [multiColor, setMultiColor] = useState<string>("#64748b");

  // Mutations (defined after state so we can update local state in onSuccess)
  const addNode = api.flow.addNode.useMutation({
    onSuccess: (newNode) => {
      // Append locally so it shows even if a node is selected
      setNodes((prev) => [...prev, toRFNode(newNode)]);
      utils.flow.list.invalidate({ projectId });
    },
  });

  const quickAdd = api.flow.quickAddNextTo.useMutation({
    onSuccess: (newNode) => {
      // Append locally; edge will arrive via invalidated fetch
      setNodes((prev) => [...prev, toRFNode(newNode)]);
      utils.flow.list.invalidate({ projectId });
    },
  });

  const updateNode = api.flow.updateNode.useMutation({
    onSuccess: () => utils.flow.list.invalidate({ projectId }),
  });

  const createEdge = api.flow.connect.useMutation({
    onSuccess: () => utils.flow.list.invalidate({ projectId }),
  });

  const deleteNode = api.flow.deleteNode.useMutation({
    onSuccess: () => utils.flow.list.invalidate({ projectId }),
  });

  const deleteEdge = api.flow.deleteEdge.useMutation({
    onSuccess: () => utils.flow.list.invalidate({ projectId }),
  });

  // Keep edges synced from server
  useEffect(() => setEdges(initialEdges), [initialEdges, setEdges]);

  // Only reset nodes from server if nothing selected (avoid clobbering live edits)
  useEffect(() => {
    setNodes((prev) =>
      prev.length && selectedNodeIds.length ? prev : initialNodes,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNodes, setNodes]);

  // Selection change
  const onSelectionChange = useCallback((p: OnSelectionChangeParams) => {
    setSelectedNodeIds(p.nodes.map((n) => n.id));
    setSelectedEdgeIds(p.edges.map((e) => e.id));
  }, []);

  // Autosave positions
  useAutosave(
    nodes.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y })),
    async (positions) => {
      await Promise.all(
        positions.map((p) =>
          updateNode.mutateAsync({ id: p.id, x: p.x, y: p.y }),
        ),
      );
    },
    300,
  );

  // Ensure all server nodes have a color
  useEffect(() => {
    const missing =
      data?.nodes?.filter((n: any) => !n.colorHex || n.colorHex === "") ?? [];
    if (missing.length) {
      missing.forEach((n) =>
        updateNode.mutate({ id: String(n.id), colorHex: stableColor(n.id) }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.nodes]);

  // Single-node editor state (first selected)
  const selId0 = selectedNodeIds[0];
  const selNode =
    selId0 && data?.nodes
      ? data.nodes.find((n: any) => n.id === selId0)
      : undefined;

  const [title, setTitle] = useState(selNode?.title ?? "");
  const [subtitle, setSubtitle] = useState(selNode?.subtitle ?? "");
  const [colorHex, setColorHex] = useState(selNode?.colorHex ?? "#64748b");
  const [descText, setDescText] = useState<string>(
    typeof selNode?.description === "string" ? (selNode.description as string) : "",
  );

  // Reset editor fields on selection change
  useEffect(() => {
    setTitle(selNode?.title ?? "");
    setSubtitle(selNode?.subtitle ?? "");
    setColorHex(selNode?.colorHex ?? "#64748b");
    setDescText(
      typeof selNode?.description === "string"
        ? (selNode.description as string)
        : "",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selNode?.id]);

  // Live preview for first selected node
  useEffect(() => {
    if (!selId0) return;
    const label = `${title}${subtitle ? ` → ${subtitle}` : ""}`;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selId0
          ? {
              ...n,
              data: { label },
              style: {
                ...(n.style || {}),
                borderLeft: `6px solid ${colorHex}`,
              },
            }
          : n,
      ),
    );
  }, [title, subtitle, colorHex, selId0, setNodes]);

  // Autosave fields
  useAutosave(
    { id: selId0, title, subtitle, colorHex, descText },
    async (v) => {
      const id = v.id;
      if (!id) return;
      await updateNode.mutateAsync({
        id,
        title: v.title,
        subtitle: v.subtitle,
        colorHex: v.colorHex,
        description: v.descText,
      });
      utils.flow.list.invalidate({ projectId });
    },
    400,
  );

  // Connect nodes
  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      setEdges((eds) =>
        addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed } }, eds),
      );
      createEdge.mutate({
        projectId,
        sourceNodeId: params.source,
        targetNodeId: params.target,
      });
    },
    [createEdge, projectId, setEdges],
  );

  // Add node (works with or without selection)
  const handleAddNode = useCallback(() => {
    addNode.mutate({
      projectId,
      title: "file.c",
      subtitle: "func",
      x: 100,
      y: 100,
    });
  }, [addNode, projectId]);

  // Quick add next to selected (fallback to first)
  const handleQuickAdd = useCallback(() => {
    const fallbackId = nodes.at(0)?.id;
    const selId = selectedNodeIds[0] ?? fallbackId;
    if (!selId) return;
    quickAdd.mutate({
      projectId,
      existingNodeId: selId,
      title: "New.c",
      subtitle: "newFunction",
    });
  }, [nodes, projectId, quickAdd, selectedNodeIds]);

  // Remove selected nodes/edges
  const removeSelected = useCallback(() => {
    if (selectedNodeIds.length) {
      selectedNodeIds.forEach((id) => deleteNode.mutate({ id }));
      setSelectedNodeIds([]);
    }
    if (selectedEdgeIds.length) {
      selectedEdgeIds.forEach((id) => deleteEdge.mutate({ id }));
      setSelectedEdgeIds([]);
    }
  }, [selectedNodeIds, selectedEdgeIds, deleteNode, deleteEdge]);

  // Multi-select: auto color
  const autoColorSelected = useCallback(() => {
    if (!selectedNodeIds.length) return;
    setNodes((nds) =>
      nds.map((n) =>
        selectedNodeIds.includes(n.id)
          ? {
              ...n,
              style: {
                ...(n.style || {}),
                borderLeft: `6px solid ${stableColor(n.id)}`,
              },
            }
          : n,
      ),
    );
    selectedNodeIds.forEach((id) =>
      updateNode.mutate({ id, colorHex: stableColor(id) }),
    );
  }, [selectedNodeIds, setNodes, updateNode]);

  // Multi-select: set specific color
  const setColorForSelected = useCallback(() => {
    if (!selectedNodeIds.length) return;
    const c = multiColor;
    setNodes((nds) =>
      nds.map((n) =>
        selectedNodeIds.includes(n.id)
          ? {
              ...n,
              style: {
                ...(n.style || {}),
                borderLeft: `6px solid ${c}`,
              },
            }
          : n,
      ),
    );
    selectedNodeIds.forEach((id) => updateNode.mutate({ id, colorHex: c }));
  }, [multiColor, selectedNodeIds, setNodes, updateNode]);

  // Delete key shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") removeSelected();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [removeSelected]);

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Canvas */}
      <div className="h-full w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          snapToGrid
          snapGrid={[16, 16]}
          fitView
          connectionMode={ConnectionMode.Loose}
        >
          <Background gap={16} variant={BackgroundVariant.Dots} />
          <Controls />
        </ReactFlow>
      </div>

      {/* Side / Toolbar Panel */}
      <div className="hidden w-80 border-l p-3 dark:border-zinc-800 lg:block">
        {/* Selection tools */}
        <div className="mb-3 space-y-2">
          <div className="text-xs text-zinc-400">
            Selected: {selectedNodeIds.length} node
            {selectedNodeIds.length === 1 ? "" : "s"}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded border px-2 py-1 text-xs hover:bg-zinc-800 disabled:opacity-50"
              onClick={autoColorSelected}
              disabled={!selectedNodeIds.length}
              title="Auto color selected nodes"
            >
              Auto color selected
            </button>
            <input
              type="color"
              value={multiColor}
              onChange={(e) => setMultiColor(e.target.value)}
              title="Pick a color"
            />
            <button
              className="rounded border px-2 py-1 text-xs hover:bg-zinc-800 disabled:opacity-50"
              onClick={setColorForSelected}
              disabled={!selectedNodeIds.length}
              title="Apply chosen color to selected nodes"
            >
              Set color for selected
            </button>
          </div>
        </div>

        {/* Single-node editor */}
        {selId0 ? (
          <Fragment>
            <h3 className="mb-2 text-sm font-medium">
              Edit Node ({selId0.slice(0, 4)}…)
            </h3>

            <label className="mb-1 block text-xs text-zinc-400">Title</label>
            <input
              className="mb-2 w-full rounded border px-2 py-1 text-sm transition-colors bg-zinc-800 text-zinc-100 placeholder-zinc-500"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <label className="mb-1 block text-xs text-zinc-400">
              Subtitle
            </label>
            <input
              className="mb-2 w-full rounded border px-2 py-1 text-sm transition-colors bg-zinc-800 text-zinc-100 placeholder-zinc-500"
              value={subtitle ?? ""}
              onChange={(e) => setSubtitle(e.target.value)}
            />

            <label className="mb-1 block text-xs text-zinc-400">Color</label>
            <div className="mb-2 flex items-center gap-2">
              <input
                type="color"
                value={colorHex}
                onChange={(e) => setColorHex(e.target.value)}
                title="Pick node color"
              />
              <button
                className="rounded border px-2 py-1 text-xs hover:bg-zinc-800"
                onClick={() => {
                  const id = selId0;
                  if (!id) return;
                  const auto = stableColor(id);
                  setColorHex(auto);
                  updateNode.mutate({ id, colorHex: auto });
                }}
                title="Auto color"
              >
                Auto
              </button>
            </div>

            <label className="mb-1 block text-xs text-zinc-400">
              Description
            </label>
            <textarea
              className="h-40 w-full resize-none rounded border p-2 text-sm outline-none transition-colors bg-zinc-800 text-zinc-100 placeholder-zinc-500"
              placeholder="Describe the function…"
              value={descText}
              onChange={(e) => setDescText(e.target.value)}
            />
          </Fragment>
        ) : (
          <div className="text-sm text-zinc-400">Select a node to edit.</div>
        )}

        {/* Quick actions */}
        <div className="mt-4 space-y-2">
          <button
            className="w-full rounded border px-2 py-1 text-sm hover:bg-zinc-800"
            onClick={handleAddNode}
            title="Add node"
          >
            Add node
          </button>
          <button
            className="w-full rounded border px-2 py-1 text-sm hover:bg-zinc-800 disabled:opacity-50"
            onClick={handleQuickAdd}
            disabled={!nodes.length}
            title="Add node next to selected and auto-connect"
          >
            Quick add next
          </button>
          <button
            className="w-full rounded border px-2 py-1 text-sm hover:bg-zinc-800 disabled:opacity-50"
            onClick={removeSelected}
            disabled={!selectedNodeIds.length && !selectedEdgeIds.length}
            title="Delete selected node/edge(s)"
          >
            Delete selected
          </button>
        </div>
      </div>
    </div>
  );
}