import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parse } from "yaml";
import type { ZodType } from "zod";
import {
  PoseSchema,
  PositionSchema,
  TechniqueSchema,
  type Content,
  type Position,
  type Side,
} from "../lib/schema";

const root = join(import.meta.dirname, "..");
const contentDir = join(root, "content");
const outFile = join(root, "lib", "generated", "content.json");

const errors: string[] = [];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /\.ya?ml$/.test(entry.name) ? [path] : [];
  });
}

function load<T>(folder: string, schema: ZodType<T>): T[] {
  return walk(join(contentDir, folder)).flatMap((file) => {
    const result = schema.safeParse(parse(readFileSync(file, "utf8")));
    if (result.success) return [result.data];
    for (const issue of result.error.issues) {
      errors.push(`${relative(root, file)}: ${issue.path.join(".") || "(root)"} ${issue.message}`);
    }
    return [];
  });
}

function checkUnique(kind: string, ids: string[]) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) errors.push(`duplicate ${kind} id "${id}"`);
    seen.add(id);
  }
}

function hasSide(position: Position, side: Side) {
  return Boolean(position.perspectives[side]);
}

const positions = load("positions", PositionSchema);
const techniques = load("techniques", TechniqueSchema);
const poses = load("poses", PoseSchema);

checkUnique("position", positions.map((p) => p.id));
checkUnique("technique", techniques.map((t) => t.id));
checkUnique("pose", poses.map((p) => p.id));

const positionById = new Map(positions.map((p) => [p.id, p]));
const techniqueIds = new Set(techniques.map((t) => t.id));
const poseIds = new Set(poses.map((p) => p.id));

for (const p of positions) {
  const poseId = p.pose ?? p.id;
  if (!poseIds.has(poseId)) errors.push(`position "${p.id}": missing pose "${poseId}"`);
}

for (const t of techniques) {
  const from = positionById.get(t.from);
  if (!from) errors.push(`technique "${t.id}": unknown from position "${t.from}"`);
  else if (!hasSide(from, t.side))
    errors.push(`technique "${t.id}": position "${t.from}" has no "${t.side}" perspective`);

  if (t.type === "submission" && t.to)
    errors.push(`technique "${t.id}": submissions end the match, remove "to"`);
  if (t.type !== "submission" && !t.to)
    errors.push(`technique "${t.id}": non-submissions need a "to" position`);

  if (t.to) {
    const to = positionById.get(t.to.position);
    if (!to) errors.push(`technique "${t.id}": unknown to position "${t.to.position}"`);
    else if (!hasSide(to, t.to.side))
      errors.push(`technique "${t.id}": position "${t.to.position}" has no "${t.to.side}" perspective`);
  }

  for (const c of t.counters) {
    if (c.technique && !techniqueIds.has(c.technique))
      errors.push(`technique "${t.id}": counter references unknown technique "${c.technique}"`);
  }
}

if (errors.length) {
  console.error(`Content validation failed (${errors.length}):\n  ${errors.join("\n  ")}`);
  process.exit(1);
}

const content: Content = {
  positions: positions.sort((a, b) => a.name.localeCompare(b.name)),
  techniques: techniques.sort((a, b) => a.name.localeCompare(b.name)),
  poses,
};

mkdirSync(join(root, "lib", "generated"), { recursive: true });
writeFileSync(outFile, JSON.stringify(content, null, 2));
console.log(
  `Content OK: ${positions.length} positions, ${techniques.length} techniques, ${poses.length} poses`,
);
