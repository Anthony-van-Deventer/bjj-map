import { getContent, getPosition } from "@/lib/content";
import { buildTree, stateKey } from "@/lib/graph";
import { RulesetSchema, SideSchema } from "@/lib/schema";
import type { NextRequest } from "next/server";
import { z } from "zod";

const Query = z.object({
  root: z.string(),
  side: SideSchema,
  depth: z.coerce.number().int().min(0).max(5).default(2),
  ruleset: RulesetSchema.optional(),
});

export async function GET(request: NextRequest) {
  const query = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) return Response.json({ error: query.error.issues }, { status: 400 });

  const { root, side, depth, ruleset } = query.data;
  const position = getPosition(root);
  if (!position?.perspectives[side]) {
    return Response.json({ error: `No "${side}" perspective for position "${root}"` }, { status: 404 });
  }

  const content = getContent(ruleset);
  const expanded = new Set<string>([stateKey(root, side)]);
  for (let i = 1; i < depth; i++) {
    for (const n of buildTree(content, { position: root, side }, expanded).nodes) {
      if (n.expandable) expanded.add(n.id);
    }
  }
  const tree = buildTree(content, { position: root, side }, expanded);
  return Response.json({
    nodes: tree.nodes,
    edges: tree.edges.map((e) => ({ ...e, technique: e.technique.id })),
  });
}
