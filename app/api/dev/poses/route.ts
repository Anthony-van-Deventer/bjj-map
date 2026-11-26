import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { poseToYaml } from "@/lib/pose-yaml";
import { PoseSchema } from "@/lib/schema";

const run = promisify(execFile);

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Saving poses is only available in development" }, { status: 404 });
  }

  const parsed = PoseSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const root = process.cwd();
  await writeFile(join(root, "content", "poses", `${parsed.data.id}.yaml`), poseToYaml(parsed.data));

  try {
    const { stdout } = await run("npx", ["tsx", "scripts/build-content.ts"], { cwd: root });
    return Response.json({ ok: true, content: stdout.trim() });
  } catch (e) {
    const stderr = (e as { stderr?: string }).stderr ?? String(e);
    return Response.json({ error: `Saved, but content validation failed:\n${stderr}` }, { status: 422 });
  }
}
