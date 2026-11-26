import type { Content, Side, Technique } from "./schema";

export type StateKey = `${string}:${Side}`;

export const stateKey = (position: string, side: Side): StateKey => `${position}:${side}`;

export function parseStateKey(key: string): { position: string; side: Side } {
  const [position, side] = key.split(":");
  return { position, side: side as Side };
}

export type TreeNode = {
  id: string;
  kind: "position" | "finish";
  position?: string;
  side?: Side;
  depth: number;
  expandable: boolean;
  expanded: boolean;
};

export type TreeEdge = {
  id: string;
  source: string;
  target: string;
  technique: Technique;
};

export function optionsFrom(content: Content, position: string, side: Side) {
  return content.techniques.filter((t) => t.from === position && t.side === side);
}

export function buildTree(
  content: Content,
  root: { position: string; side: Side },
  expanded: Set<string>,
): { nodes: TreeNode[]; edges: TreeEdge[] } {
  const nodes: TreeNode[] = [];
  const edges: TreeEdge[] = [];

  const visit = (id: string, position: string, side: Side, depth: number, ancestors: Set<StateKey>) => {
    const key = stateKey(position, side);
    const options = optionsFrom(content, position, side);
    const isCycle = ancestors.has(key);
    const isExpanded = expanded.has(id) && !isCycle;
    nodes.push({
      id,
      kind: "position",
      position,
      side,
      depth,
      expandable: options.length > 0 && !isCycle,
      expanded: isExpanded,
    });
    if (!isExpanded) return;

    const nextAncestors = new Set(ancestors).add(key);
    for (const t of options) {
      const childId = `${id}/${t.id}`;
      edges.push({ id: `e:${childId}`, source: id, target: childId, technique: t });
      if (t.to) {
        visit(childId, t.to.position, t.to.side, depth + 1, nextAncestors);
      } else {
        nodes.push({ id: childId, kind: "finish", depth: depth + 1, expandable: false, expanded: false });
      }
    }
  };

  visit(stateKey(root.position, root.side), root.position, root.side, 0, new Set());
  return { nodes, edges };
}
