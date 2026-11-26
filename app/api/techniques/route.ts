import { getTechniques } from "@/lib/content";
import { RulesetSchema } from "@/lib/schema";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const ruleset = RulesetSchema.safeParse(request.nextUrl.searchParams.get("ruleset"));
  return Response.json(getTechniques(ruleset.success ? ruleset.data : undefined));
}
