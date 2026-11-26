import { getTechnique } from "@/lib/content";
import type { NextRequest } from "next/server";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/techniques/[id]">) {
  const { id } = await ctx.params;
  const technique = getTechnique(id);
  if (!technique) return Response.json({ error: "Technique not found" }, { status: 404 });
  return Response.json(technique);
}
