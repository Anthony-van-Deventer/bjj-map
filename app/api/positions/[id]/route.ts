import { getPose, getPosition, getTechniques } from "@/lib/content";
import type { NextRequest } from "next/server";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/positions/[id]">) {
  const { id } = await ctx.params;
  const position = getPosition(id);
  if (!position) return Response.json({ error: "Position not found" }, { status: 404 });
  return Response.json({
    ...position,
    pose: getPose(position.pose ?? position.id),
    techniques: getTechniques().filter((t) => t.from === id),
  });
}
