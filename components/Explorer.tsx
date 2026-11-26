"use client";

import { useMemo, useState } from "react";
import { buildTree, stateKey, type TreeNode } from "@/lib/graph";
import { RULESETS, TECHNIQUE_TYPES, type Content, type Ruleset, type Side } from "@/lib/schema";
import { SIDE_COLOR, SIDE_LABEL, TYPE_COLORS } from "@/lib/styles";
import { DetailPanel, type Selection } from "./DetailPanel";
import { DevLink } from "./DevLink";
import { GraphView } from "./GraphView";

const RULESET_LABEL: Record<Ruleset, string> = { nogi: "No-Gi", gi: "Gi" };

function filterContent(content: Content, ruleset: Ruleset): Content {
  return {
    positions: content.positions.filter((p) => p.rulesets.includes(ruleset)),
    techniques: content.techniques.filter((t) => t.rulesets.includes(ruleset)),
    poses: content.poses,
  };
}

function sidesOf(content: Content, positionId: string): Side[] {
  const p = content.positions.find((x) => x.id === positionId);
  if (!p) return [];
  return (["top", "bottom", "neutral"] as const).filter((s) => p.perspectives[s]);
}

export function Explorer({ content: allContent }: { content: Content }) {
  const availableRulesets = RULESETS.filter(
    (r) => allContent.techniques.some((t) => t.rulesets.includes(r)) && allContent.positions.some((p) => p.rulesets.includes(r)),
  );
  const [ruleset, setRuleset] = useState<Ruleset>(availableRulesets.includes("nogi") ? "nogi" : availableRulesets[0]);
  const content = useMemo(() => filterContent(allContent, ruleset), [allContent, ruleset]);

  const [root, setRoot] = useState<{ position: string; side: Side }>({ position: "closed-guard", side: "bottom" });
  const rootId = stateKey(root.position, root.side);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([rootId]));
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(rootId);
  const [selection, setSelection] = useState<Selection>({ kind: "position", ...root });

  const tree = useMemo(() => buildTree(content, root, expanded), [content, root, expanded]);

  const changeRoot = (position: string, side: Side) => {
    const sides = sidesOf(content, position);
    const resolved = sides.includes(side) ? side : sides[0];
    const id = stateKey(position, resolved);
    setRoot({ position, side: resolved });
    setExpanded(new Set([id]));
    setSelectedNodeId(id);
    setSelection({ kind: "position", position, side: resolved });
  };

  const onNodeClick = (node: TreeNode) => {
    setSelectedNodeId(node.id);
    if (node.kind === "position") setSelection({ kind: "position", position: node.position!, side: node.side! });
    if (!node.expandable) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(node.id)) {
        for (const id of next) if (id === node.id || id.startsWith(`${node.id}/`)) next.delete(id);
      } else {
        next.add(node.id);
      }
      return next;
    });
  };

  const expandAll = () => {
    const ids = new Set(expanded);
    for (let i = 0; i < 2; i++) for (const n of buildTree(content, root, ids).nodes) if (n.expandable) ids.add(n.id);
    setExpanded(ids);
  };

  const rootSides = sidesOf(content, root.position);
  const groups = Object.groupBy(content.positions, (p) => p.category);

  return (
    <div className="flex h-dvh flex-col bg-slate-950 text-slate-100">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-800 px-4 py-3">
        <h1 className="mr-2 text-lg font-bold tracking-tight">
          BJJ <span className="text-sky-400">Map</span>
        </h1>
        <label className="flex items-center gap-2 text-sm text-slate-400">
          Start from
          <select
            value={root.position}
            onChange={(e) => changeRoot(e.target.value, root.side)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
          >
            {Object.entries(groups).map(([category, positions]) => (
              <optgroup key={category} label={category}>
                {positions!.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="flex overflow-hidden rounded-lg border border-slate-700">
          {(["top", "bottom", "neutral"] as const)
            .filter((s) => rootSides.includes(s))
            .map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => changeRoot(root.position, s)}
                className={`px-3 py-1.5 text-sm font-medium ${root.side === s ? "text-slate-950" : "text-slate-300 hover:bg-slate-800"}`}
                style={root.side === s ? { background: SIDE_COLOR[s] } : undefined}
              >
                {SIDE_LABEL[s]}
              </button>
            ))}
        </div>
        {availableRulesets.length > 1 && (
          <div className="flex overflow-hidden rounded-lg border border-slate-700">
            {availableRulesets.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRuleset(r)}
                className={`px-3 py-1.5 text-sm ${ruleset === r ? "bg-slate-100 text-slate-950" : "text-slate-300 hover:bg-slate-800"}`}
              >
                {RULESET_LABEL[r]}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={expandAll}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          Expand 2 levels
        </button>
        <DevLink href="/dev/pose-editor">Pose editor</DevLink>
        <div className="ml-auto hidden flex-wrap gap-3 text-xs text-slate-400 lg:flex">
          {TECHNIQUE_TYPES.map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="h-1 w-4 rounded" style={{ background: TYPE_COLORS[t] }} />
              {t}
            </span>
          ))}
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="min-h-[50vh] flex-1">
          <GraphView
            content={content}
            tree={tree}
            selectedNodeId={selectedNodeId}
            selectedTechniqueId={selection.kind === "technique" ? selection.id : undefined}
            onNodeClick={onNodeClick}
            onTechniqueClick={(id) => setSelection({ kind: "technique", id })}
          />
        </div>
        <aside className="w-full overflow-y-auto border-t border-slate-800 p-5 md:w-[400px] md:border-l md:border-t-0">
          <DetailPanel
            content={content}
            selection={selection}
            onSelectTechnique={(id) => setSelection({ kind: "technique", id })}
            onSelectPosition={(position, side) => setSelection({ kind: "position", position, side })}
          />
        </aside>
      </main>
    </div>
  );
}
