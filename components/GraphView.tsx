"use client";

import "@xyflow/react/dist/style.css";
import ELK from "elkjs/lib/elk.bundled.js";
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  Position as HandlePosition,
  ReactFlow,
  getBezierPath,
  useReactFlow,
  ReactFlowProvider,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { useEffect, useMemo, useState } from "react";
import type { TreeEdge, TreeNode } from "@/lib/graph";
import type { Content, Technique } from "@/lib/schema";
import { PERCENTAGE_WIDTH, SIDE_COLOR, SIDE_LABEL, TYPE_COLORS } from "@/lib/styles";
import { PoseDiagram } from "./PoseDiagram";

const POSITION_SIZE = { width: 210, height: 72 };
const FINISH_SIZE = { width: 110, height: 40 };

type PositionNodeData = {
  tree: TreeNode;
  name: string;
  selected: boolean;
  pose?: Content["poses"][number];
};
type PositionFlowNode = Node<PositionNodeData, "position">;
type FinishFlowNode = Node<{ selected: boolean }, "finish">;
type TechniqueFlowEdge = Edge<{ technique: Technique; selected: boolean; onSelect: (id: string) => void }, "technique">;

function PositionNode({ data }: NodeProps<PositionFlowNode>) {
  const { tree, name, pose, selected } = data;
  const side = tree.side!;
  return (
    <div
      className={`flex h-[72px] w-[210px] items-center gap-2 rounded-xl border bg-slate-900/95 px-2 shadow-lg transition ${
        selected ? "border-white ring-2 ring-white/40" : "border-slate-700 hover:border-slate-500"
      }`}
    >
      <Handle type="target" position={HandlePosition.Left} className="!opacity-0" />
      {pose && <PoseDiagram pose={pose} you={side} showGround={false} className="h-12 w-16 shrink-0 text-white" />}
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-sm font-semibold leading-tight text-slate-100">{name}</div>
        <div className="text-xs font-medium" style={{ color: SIDE_COLOR[side] }}>
          {SIDE_LABEL[side]}
        </div>
      </div>
      {tree.expandable && (
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-800 text-sm text-slate-300">
          {tree.expanded ? "−" : "+"}
        </span>
      )}
      <Handle type="source" position={HandlePosition.Right} className="!opacity-0" />
    </div>
  );
}

function FinishNode({ data }: NodeProps<FinishFlowNode>) {
  return (
    <div
      className={`flex h-10 w-[110px] items-center justify-center rounded-full border bg-red-950/80 text-sm font-semibold text-red-200 ${
        data.selected ? "border-white" : "border-red-800"
      }`}
    >
      <Handle type="target" position={HandlePosition.Left} className="!opacity-0" />
      Tap 🏁
    </div>
  );
}

function TechniqueEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps<TechniqueFlowEdge>) {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  if (!data) return null;
  const { technique, selected, onSelect } = data;
  const color = TYPE_COLORS[technique.type];
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{ stroke: color, strokeWidth: PERCENTAGE_WIDTH[technique.percentage], opacity: selected ? 1 : 0.75 }}
      />
      <EdgeLabelRenderer>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(technique.id);
          }}
          className={`nodrag nopan absolute max-w-[150px] truncate rounded-md border px-2 py-0.5 text-[11px] font-medium shadow ${
            selected ? "bg-white text-slate-900" : "bg-slate-950/90 text-slate-200 hover:bg-slate-800"
          }`}
          style={{
            transform: `translate(-100%, -50%) translate(${targetX - 14}px, ${targetY}px)`,
            borderColor: color,
            pointerEvents: "all",
          }}
        >
          {technique.name}
        </button>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { position: PositionNode, finish: FinishNode };
const edgeTypes = { technique: TechniqueEdge };
const elk = new ELK();

type Props = {
  content: Content;
  tree: { nodes: TreeNode[]; edges: TreeEdge[] };
  selectedNodeId?: string;
  selectedTechniqueId?: string;
  onNodeClick: (node: TreeNode) => void;
  onTechniqueClick: (id: string) => void;
};

function Graph({ content, tree, selectedNodeId, selectedTechniqueId, onNodeClick, onTechniqueClick }: Props) {
  const [layout, setLayout] = useState<Record<string, { x: number; y: number }>>({});
  const { fitView } = useReactFlow();

  const positionById = useMemo(() => new Map(content.positions.map((p) => [p.id, p])), [content]);
  const poseById = useMemo(() => new Map(content.poses.map((p) => [p.id, p])), [content]);

  const structureKey = tree.nodes.map((n) => n.id).join("|");

  useEffect(() => {
    let cancelled = false;
    elk
      .layout({
        id: "root",
        layoutOptions: {
          "elk.algorithm": "layered",
          "elk.direction": "RIGHT",
          "elk.spacing.nodeNode": "44",
          "elk.layered.spacing.nodeNodeBetweenLayers": "190",
          "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
        },
        children: tree.nodes.map((n) => ({ id: n.id, ...(n.kind === "finish" ? FINISH_SIZE : POSITION_SIZE) })),
        edges: tree.edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
      })
      .then((result) => {
        if (cancelled) return;
        const next: Record<string, { x: number; y: number }> = {};
        for (const child of result.children ?? []) next[child.id] = { x: child.x ?? 0, y: child.y ?? 0 };
        setLayout(next);
        requestAnimationFrame(() => fitView({ padding: 0.15, duration: 300, maxZoom: 1.1 }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structureKey]);

  const nodes: Node[] = tree.nodes.map((n) => {
    const position = layout[n.id] ?? { x: n.depth * 400, y: 0 };
    if (n.kind === "finish") {
      return { id: n.id, type: "finish", position, data: { selected: false }, draggable: false } satisfies FinishFlowNode;
    }
    const p = positionById.get(n.position!)!;
    return {
      id: n.id,
      type: "position",
      position,
      draggable: false,
      data: { tree: n, name: p.name, pose: poseById.get(p.pose ?? p.id), selected: n.id === selectedNodeId },
    } satisfies PositionFlowNode;
  });

  const edges: Edge[] = tree.edges.map(
    (e) =>
      ({
        id: e.id,
        type: "technique",
        source: e.source,
        target: e.target,
        data: { technique: e.technique, selected: e.technique.id === selectedTechniqueId, onSelect: onTechniqueClick },
      }) satisfies TechniqueFlowEdge,
  );

  const treeById = useMemo(() => new Map(tree.nodes.map((n) => [n.id, n])), [tree]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={(_, node) => {
        const t = treeById.get(node.id);
        if (t) onNodeClick(t);
      }}
      nodesConnectable={false}
      minZoom={0.2}
      proOptions={{ hideAttribution: true }}
      forceColorMode="dark"
      fitView
    >
      <Background gap={24} color="#1e293b" />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

export function GraphView(props: Props) {
  return (
    <ReactFlowProvider>
      <Graph {...props} />
    </ReactFlowProvider>
  );
}
