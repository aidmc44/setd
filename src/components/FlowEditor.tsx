// src/components/FlowEditor.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
} from "react";
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
  type OnNodesChange,
} from "reactflow";
import "reactflow/dist/style.css";
import { api } from "../trpc/react";
import { useAutosave } from "../utils/autosave";

type FlowNodeData = { label: string };
type FlowEdgeData = { bendPoints?: { x: number; y: number }[] };

const NODE_BG = "#0b0f1a";
const NODE_FG = "#e2e8f0";
const NODE_BORDER = "#1e293b";

// Extra-safe cooldown to ignore server position after a local move
const POSITION_LOCK_MS = 2000;

function toRFNode(n: any): Node<FlowNodeData> {
  return {
    id: String(n.id),
    type: "default",
    position: { x: Number(n.x) || 0, y: Number(n.y) || 0 },
    data: { label: `${n.title}${n.subtitle ? ` → ${n.subtitle}` : ""}` },
    style: {
      backgroundColor: NODE_BG,
      color: NODE_FG,
      border: `1px solid ${NODE_BORDER}`,
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

  const { data } = api.flow.list.useQuery(
    { projectId },
    {
      refetchInterval: 1000,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    },
  );

  const initialNodes = useMemo(
    () => (data?.nodes ?? []).map(toRFNode),
    [data?.nodes],
  );
  const initialEdges = useMemo(
    () => (data?.edges ?? []).map(toRFEdge),
    [data?.edges],
  );

  const [nodes, setNodes, baseOnNodesChange] =
    useNodesState<FlowNodeData>(initialNodes);
  const [edges, setEdges, onEdgesChange] =
    useEdgesState<FlowEdgeData>(initialEdges);

  // Selection
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [multiColor, setMultiColor] = useState<string>("#64748b");

  // Side panel drafts and flags
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingSubtitle, setEditingSubtitle] = useState(false);
  const [editingColor, setEditingColor] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
  const [savingSubtitle, setSavingSubtitle] = useState(false);
  const [savingColor, setSavingColor] = useState(false);
  const [savingDesc, setSavingDesc] = useState(false);
  const editingAny =
    editingTitle || editingSubtitle || editingColor || editingDesc;
  const savingAny = savingTitle || savingSubtitle || savingColor || savingDesc;

  // Drag + per-node position lock + per-node last local move time
  const draggingRef = useRef(false);
  const posLockRef = useRef(new Map<string, number>());
  const localMoveAtRef = useRef(new Map<string, number>());

  // Track server updatedAt per node for position reconciliation
  const serverUpdatedAtRef = useRef(new Map<string, number>());
  useEffect(() => {
    const map = new Map<string, number>();
    for (const sn of data?.nodes ?? []) {
      const ts = new Date(sn.updatedAt as any).getTime();
      map.set(sn.id, ts);
    }
    serverUpdatedAtRef.current = map;
  }, [data?.nodes]);

  // Mutations
  const addNode = api.flow.addNode.useMutation({
    onSuccess: (newNode) => {
      setNodes((prev) => [...prev, toRFNode(newNode)]);
      utils.flow.list.invalidate({ projectId });
    },
  });
  const quickAdd = api.flow.quickAddNextTo.useMutation({
    onSuccess: (newNode) => {
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

  // Always sync edges
  useEffect(() => setEdges(initialEdges), [initialEdges, setEdges]);

  // Rehydrate nodes from server with position reconciliation:
  // - Keep local position if:
  //   a) node is locked (recently moved locally), OR
  //   b) localMoveAt > serverUpdatedAt (server is older)
  useEffect(() => {
    if (editingAny || savingAny || draggingRef.current) return;

    setNodes((prev) => {
      const prevById = new Map(prev.map((n) => [n.id, n]));
      const now = Date.now();

      const merged = initialNodes.map((sn) => {
        const prevNode = prevById.get(sn.id);
        if (!prevNode) return sn;

        const lockTs = posLockRef.current.get(sn.id) ?? 0;
        const locked = now - lockTs < POSITION_LOCK_MS;

        const serverTs = serverUpdatedAtRef.current.get(sn.id) ?? 0;
        const localTs = localMoveAtRef.current.get(sn.id) ?? 0;

        const preferLocal = locked || localTs > serverTs;
        const position = preferLocal ? prevNode.position : sn.position;

        return {
          ...sn,
          position,
          style: {
            ...(sn.style || {}),
            ...(prevNode.style || {}),
            backgroundColor: NODE_BG,
            color: NODE_FG,
            border: `1px solid ${NODE_BORDER}`,
          },
        };
      });

      const serverIds = new Set(merged.map((n) => n.id));
      const extras = prev.filter((n) => !serverIds.has(n.id));
      return [...merged, ...extras];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNodes, editingAny, savingAny]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      baseOnNodesChange(changes);
    },
    [baseOnNodesChange],
  );

  const onNodeDragStart = useCallback(() => {
    draggingRef.current = true;
  }, []);

  const onNodeDragStop = useCallback(
    async (_e: any, node: Node) => {
      const when = Date.now();
      posLockRef.current.set(node.id, when);
      localMoveAtRef.current.set(node.id, when);
      try {
        await updateNode.mutateAsync({
          id: node.id,
          x: node.position.x,
          y: node.position.y,
        });
        utils.flow.list.refetch({ projectId });
      } finally {
        setTimeout(() => {
          draggingRef.current = false;
        }, 100);
      }
    },
    [updateNode, utils.flow.list, projectId],
  );

  const onSelectionChange = useCallback((p: OnSelectionChangeParams) => {
    setSelectedNodeIds(p.nodes.map((n) => n.id));
    setSelectedEdgeIds(p.edges.map((e) => e.id));
  }, []);

  useAutosave(
    nodes.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y })),
    async (positions) => {
      if (draggingRef.current) return;
      await Promise.all(
        positions.map((p) =>
          updateNode.mutateAsync({ id: p.id, x: p.x, y: p.y }),
        ),
      );
    },
    500,
  );

  // Side panel drafts
  const selId0 = selectedNodeIds[0];
  const selNode =
    selId0 && data?.nodes
      ? data.nodes.find((n: any) => n.id === selId0)
      : undefined;

  const [titleDraft, setTitleDraft] = useState(selNode?.title ?? "");
  const [subtitleDraft, setSubtitleDraft] = useState(selNode?.subtitle ?? "");
  const [colorDraft, setColorDraft] = useState(selNode?.colorHex ?? "#64748b");
  const [descDraft, setDescDraft] = useState<string>(
    typeof selNode?.description === "string"
      ? (selNode.description as string)
      : "",
  );

  const titleDirty = (selNode?.title ?? "") !== titleDraft;
  const subtitleDirty = (selNode?.subtitle ?? "") !== subtitleDraft;
  const colorDirty = (selNode?.colorHex ?? "#64748b") !== colorDraft;
  const descDirty =
    (typeof selNode?.description === "string"
      ? (selNode?.description as string)
      : "") !== descDraft;

  const renderTitle: string =
    editingTitle || savingTitle || titleDirty ? titleDraft : selNode?.title ?? "";
  const renderSubtitle: string =
    editingSubtitle || savingSubtitle || subtitleDirty
      ? subtitleDraft
      : selNode?.subtitle ?? "";
  const renderColor: string =
    editingColor || savingColor || colorDirty
      ? colorDraft
      : selNode?.colorHex ?? "#64748b";
  const renderDesc: string =
    editingDesc || savingDesc || descDirty
      ? descDraft
      : typeof selNode?.description === "string"
      ? (selNode?.description as string)
      : "";

  useEffect(() => {
    if (!selNode) {
      setTitleDraft("");
      setSubtitleDraft("");
      setColorDraft("#64748b");
      setDescDraft("");
      return;
    }
    if (!editingTitle && !savingTitle) setTitleDraft(selNode.title ?? "");
    if (!editingSubtitle && !savingSubtitle)
      setSubtitleDraft(selNode.subtitle ?? "");
    if (!editingColor && !savingColor)
      setColorDraft(selNode.colorHex ?? "#64748b");
    if (!editingDesc && !savingDesc)
      setDescDraft(
        typeof selNode.description === "string"
          ? (selNode.description as string)
          : "",
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selNode?.id, selNode?.title, selNode?.subtitle, selNode?.colorHex, selNode?.description]);

  // Update canvas label/color from render* (live preview)
  useEffect(() => {
    if (!selId0) return;
    const label = `${renderTitle}${renderSubtitle ? ` → ${renderSubtitle}` : ""}`;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selId0
          ? {
              ...n,
              data: { label },
              style: {
                ...(n.style || {}),
                backgroundColor: NODE_BG,
                color: NODE_FG,
                border: `1px solid ${NODE_BORDER}`,
                borderLeft: `6px solid ${renderColor}`,
              },
            }
          : n,
      ),
    );
  }, [selId0, renderTitle, renderSubtitle, renderColor, setNodes]);

  const commitField = async (patch: Partial<any>) => {
    if (!selId0) return;
    await updateNode.mutateAsync({ id: selId0, ...patch });
  };

  // Toolbar actions
  const handleAddNode = useCallback(() => {
    addNode.mutate({
      projectId,
      title: "file.c",
      subtitle: "func",
      x: 100,
      y: 100,
    });
  }, [addNode, projectId]);

  const handleQuickAdd = useCallback(() => {
    const fallbackId = nodes.at(0)?.id;
    const id = selectedNodeIds[0] ?? fallbackId;
    if (!id) return;
    quickAdd.mutate({
      projectId,
      existingNodeId: id,
      title: "New.c",
      subtitle: "newFunction",
    });
  }, [nodes, projectId, quickAdd, selectedNodeIds]);

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

  // Delete key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName || "").toLowerCase();
      const isEditable =
        target?.isContentEditable ||
        ["input", "textarea", "select"].includes(tag) ||
        target?.getAttribute("role") === "textbox";
      if (isEditable) return;
      if (e.key === "Delete") {
        e.preventDefault();
        removeSelected();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true } as any);
  }, [removeSelected]);

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Toolbar */}
      <div className="absolute z-10 m-2 rounded border border-zinc-800 bg-zinc-900/80 p-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            className="rounded border px-2 py-1 text-sm hover:bg-zinc-800"
            onClick={handleAddNode}
            title="Add node"
          >
            Add node
          </button>
          <button
            className="rounded border px-2 py-1 text-sm hover:bg-zinc-800 disabled:opacity-50"
            onClick={handleQuickAdd}
            disabled={!nodes.length}
            title="Add node next to selected and auto-connect"
          >
            Quick add next
          </button>
          <button
            className="rounded border px-2 py-1 text-sm hover:bg-zinc-800 disabled:opacity-50"
            onClick={removeSelected}
            disabled={!selectedNodeIds.length && !selectedEdgeIds.length}
            title="Delete selected node/edge(s)"
          >
            Delete selected
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="h-full w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={useCallback<OnConnect>(
            (params: Connection) => {
              if (!params.source || !params.target) return;
              setEdges((eds) =>
                addEdge(
                  { ...params, markerEnd: { type: MarkerType.ArrowClosed } },
                  eds,
                ),
              );
              createEdge.mutate({
                projectId,
                sourceNodeId: params.source,
                targetNodeId: params.target,
              });
            },
            [createEdge, projectId, setEdges],
          )}
          onSelectionChange={onSelectionChange}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          snapToGrid
          snapGrid={[16, 16]}
          fitView
          connectionMode={ConnectionMode.Loose}
        >
          <Background gap={16} variant={BackgroundVariant.Dots} />
          <Controls />
        </ReactFlow>
      </div>

      {/* Side panel */}
      <div className="hidden w-80 border-l p-3 dark:border-zinc-800 lg:block">
        <div className="mb-3 space-y-2">
          <div className="text-xs text-zinc-400">
            Selected: {selectedNodeIds.length} node
            {selectedNodeIds.length === 1 ? "" : "s"}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded border px-2 py-1 text-xs hover:bg-zinc-800 disabled:opacity-50"
              onClick={() => {
                if (!selectedNodeIds.length) return;
                setNodes((nds) =>
                  nds.map((n) =>
                    selectedNodeIds.includes(n.id)
                      ? {
                          ...n,
                          style: {
                            ...(n.style || {}),
                            borderLeft: `6px solid ${stableColor(n.id)}`,
                            backgroundColor: NODE_BG,
                            color: NODE_FG,
                            border: `1px solid ${NODE_BORDER}`,
                          },
                        }
                      : n,
                  ),
                );
                selectedNodeIds.forEach((id) =>
                  updateNode.mutate({ id, colorHex: stableColor(id) }),
                );
              }}
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
              onClick={() => {
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
                            backgroundColor: NODE_BG,
                            color: NODE_FG,
                            border: `1px solid ${NODE_BORDER}`,
                          },
                        }
                      : n,
                  ),
                );
                selectedNodeIds.forEach((id) =>
                  updateNode.mutate({ id, colorHex: c }),
                );
              }}
              disabled={!selectedNodeIds.length}
              title="Apply chosen color to selected nodes"
            >
              Set color for selected
            </button>
          </div>
        </div>

        {selId0 ? (
          <Fragment>
            <h3 className="mb-2 text-sm font-medium">
              Edit Node ({selId0.slice(0, 4)}…)
            </h3>

            <label className="mb-1 block text-xs text-zinc-400">Title</label>
            <input
              className="mb-2 w-full rounded border px-2 py-1 text-sm transition-colors bg-zinc-800 text-zinc-100 placeholder-zinc-500"
              value={renderTitle}
              onFocus={() => setEditingTitle(true)}
              onBlur={async () => {
                if (!selId0) return;
                if (titleDirty) {
                  setSavingTitle(true);
                  await commitField({ title: titleDraft });
                  setSavingTitle(false);
                }
                setEditingTitle(false);
              }}
              onChange={(e) => setTitleDraft(e.target.value)}
            />

            <label className="mb-1 block text-xs text-zinc-400">
              Subtitle
            </label>
            <input
              className="mb-2 w-full rounded border px-2 py-1 text-sm transition-colors bg-zinc-800 text-zinc-100 placeholder-zinc-500"
              value={renderSubtitle}
              onFocus={() => setEditingSubtitle(true)}
              onBlur={async () => {
                if (!selId0) return;
                if (subtitleDirty) {
                  setSavingSubtitle(true);
                  await commitField({ subtitle: subtitleDraft });
                  setSavingSubtitle(false);
                }
                setEditingSubtitle(false);
              }}
              onChange={(e) => setSubtitleDraft(e.target.value)}
            />

            <label className="mb-1 block text-xs text-zinc-400">Color</label>
            <div className="mb-2 flex items-center gap-2">
              <input
                type="color"
                value={renderColor}
                onFocus={() => setEditingColor(true)}
                onBlur={async () => {
                  if (!selId0) return;
                  if (colorDirty) {
                    setSavingColor(true);
                    await commitField({ colorHex: colorDraft });
                    setSavingColor(false);
                  }
                  setEditingColor(false);
                }}
                onChange={(e) => setColorDraft(e.target.value)}
                title="Pick node color"
              />
              <button
                className="rounded border px-2 py-1 text-xs hover:bg-zinc-800"
                onClick={() => {
                  if (!selId0) return;
                  const auto = stableColor(selId0);
                  setEditingColor(true);
                  setColorDraft(auto);
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
              value={renderDesc}
              onFocus={() => setEditingDesc(true)}
              onBlur={async () => {
                if (!selId0) return;
                if (descDirty) {
                  setSavingDesc(true);
                  await commitField({ description: renderDesc });
                  setSavingDesc(false);
                }
                setEditingDesc(false);
              }}
              onChange={(e) => setDescDraft(e.target.value)}
            />
          </Fragment>
        ) : (
          <div className="text-sm text-zinc-400">Select a node to edit.</div>
        )}
      </div>
    </div>
  );
}