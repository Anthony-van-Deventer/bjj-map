import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [kind, id, from] = process.argv.slice(2);
const root = join(import.meta.dirname, "..", "content");

function usage(): never {
  console.error("Usage:\n  npm run new -- position <id>\n  npm run new -- technique <id> <from-position-id>");
  process.exit(1);
}

function write(path: string, body: string) {
  if (existsSync(path)) {
    console.error(`Already exists: ${path}`);
    process.exit(1);
  }
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, body);
  console.log(`Created ${path}`);
}

if (!id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) usage();

const title = id.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

if (kind === "position") {
  write(
    join(root, "positions", `${id}.yaml`),
    `id: ${id}
name: ${title}
category: guard # standing | guard | leg-entanglement | pin | back | scramble
rulesets: [nogi]
summary: TODO
perspectives:
  top:
    role: TODO
    goals: []
    keyPoints: []
  bottom:
    role: TODO
    goals: []
    keyPoints: []
`,
  );
  const athlete = (dx: number) =>
    `{head: [${70 + dx},30], neck: [${72 + dx},40], pelvis: [${68 + dx},72], lElbow: [${85 + dx},52], lHand: [${98 + dx},48], rElbow: [${80 + dx},58], rHand: [${95 + dx},60], lKnee: [${80 + dx},92], lFoot: [${78 + dx},115], rKnee: [${60 + dx},94], rFoot: [${52 + dx},115]}`;
  write(join(root, "poses", `${id}.yaml`), `id: ${id}\ntop: ${athlete(60)}\nbottom: ${athlete(0)}\n`);
} else if (kind === "technique") {
  if (!from) usage();
  write(
    join(root, "techniques", from, `${id}.yaml`),
    `id: ${id}
name: ${title}
type: sweep # takedown | sweep | pass | submission | escape | transition
from: ${from}
side: bottom # top | bottom | neutral
to: { position: TODO, side: top } # remove for submissions
percentage: high # high | medium | situational
rulesets: [nogi]
summary: TODO
steps: []
counters: []
sources: []
`,
  );
} else {
  usage();
}
