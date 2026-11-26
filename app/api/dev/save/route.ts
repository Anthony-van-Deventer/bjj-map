import { execFile } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import { isMap, isSeq, parse, parseDocument } from "yaml";
import { z } from "zod";
import { poseToYaml } from "@/lib/pose-yaml";
import { AnimationSchema, PoseSchema } from "@/lib/schema";

const run = promisify(execFile);

const Body = z.object({
  poses: z.array(PoseSchema).default([]),
  animations: z.array(AnimationSchema.extend({ id: z.string() })).default([]),
});

async function findTechniqueFile(dir: string, id: string): Promise<string | undefined> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = await findTechniqueFile(path, id);
      if (found) return found;
    } else if (/\.ya?ml$/.test(entry.name) && parse(await readFile(path, "utf8"))?.id === id) {
      return path;
    }
  }
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Saving is only available in development" }, { status: 404 });
  }

  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const root = process.cwd();
  const files: string[] = [];

  for (const pose of parsed.data.poses) {
    const path = join(root, "content", "poses", `${pose.id}.yaml`);
    await writeFile(path, poseToYaml(pose));
    files.push(relative(root, path));
  }

  for (const { id, keyframes, mirrorEnd } of parsed.data.animations) {
    const path = await findTechniqueFile(join(root, "content", "techniques"), id);
    if (!path) return Response.json({ error: `Technique "${id}" not found` }, { status: 404 });

    const doc = parseDocument(await readFile(path, "utf8"));
    if (!keyframes.length && !mirrorEnd) {
      doc.delete("animation");
    } else {
      const node = doc.createNode({
        keyframes: keyframes.map((k) => (k.mirror ? k : { pose: k.pose, performer: k.performer })),
        ...(mirrorEnd ? { mirrorEnd } : {}),
      });
      const seq = isMap(node) ? node.get("keyframes", true) : undefined;
      if (isSeq(seq)) for (const item of seq.items) if (isMap(item)) item.flow = true;
      doc.set("animation", node);
    }
    await writeFile(path, doc.toString());
    files.push(relative(root, path));
  }

  try {
    const { stdout } = await run("npx", ["tsx", "scripts/build-content.ts"], { cwd: root });
    return Response.json({ ok: true, files, content: stdout.trim() });
  } catch (e) {
    const stderr = (e as { stderr?: string }).stderr ?? String(e);
    return Response.json({ error: `Saved, but content validation failed:\n${stderr}` }, { status: 422 });
  }
}
