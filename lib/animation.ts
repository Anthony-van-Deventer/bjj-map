import { JOINTS, type Joint } from "./pose-yaml";
import type { AthletePose, Content, Pose, Side, Technique } from "./schema";

type Slot = "top" | "bottom";
type Vec = [number, number];

export type Frame = {
  performer: AthletePose;
  opponent: AthletePose;
  performerOnTop: boolean;
};

export type TechniqueAnimation = {
  frames: Frame[];
  performerSlot: Slot;
  isAuto: boolean;
};

const BONES: [Joint, Joint][] = [
  ["pelvis", "neck"],
  ["neck", "head"],
  ["neck", "lElbow"],
  ["lElbow", "lHand"],
  ["neck", "rElbow"],
  ["rElbow", "rHand"],
  ["pelvis", "lKnee"],
  ["lKnee", "lFoot"],
  ["pelvis", "rKnee"],
  ["rKnee", "rFoot"],
];

const slotOf = (side: Side): Slot => (side === "bottom" ? "bottom" : "top");
const other = (slot: Slot): Slot => (slot === "top" ? "bottom" : "top");

const mirrorAthlete = (a: AthletePose): AthletePose =>
  Object.fromEntries(JOINTS.map((j) => [j, [200 - a[j][0], a[j][1]]])) as AthletePose;

function toFrame(pose: Pose, performer: Slot, mirror: boolean): Frame {
  const m = mirror ? mirrorAthlete : (a: AthletePose) => a;
  return {
    performer: m(pose[performer]),
    opponent: m(pose[other(performer)]),
    performerOnTop: performer === "top",
  };
}

export function buildAnimation(technique: Technique, content: Content): TechniqueAnimation | undefined {
  const poseOfPosition = (id: string) => {
    const position = content.positions.find((p) => p.id === id);
    return position && content.poses.find((p) => p.id === (position.pose ?? position.id));
  };
  const poseById = (id: string) => content.poses.find((p) => p.id === id);

  const fromPose = poseOfPosition(technique.from);
  if (!fromPose) return undefined;

  const performerSlot = slotOf(technique.side);
  const keyframes = technique.animation?.keyframes ?? [];
  const frames: Frame[] = [toFrame(fromPose, performerSlot, false)];

  for (const k of keyframes) {
    const pose = poseById(k.pose);
    if (pose) frames.push(toFrame(pose, k.performer, k.mirror));
  }

  if (technique.to) {
    const toPose = poseOfPosition(technique.to.position);
    if (toPose) frames.push(toFrame(toPose, slotOf(technique.to.side), technique.animation?.mirrorEnd ?? false));
  }

  if (frames.length < 2) return undefined;
  return { frames, performerSlot, isAuto: keyframes.length === 0 };
}

function lerpAngle(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function interpolateAthlete(a: AthletePose, b: AthletePose, t: number): AthletePose {
  const out = { pelvis: [lerp(a.pelvis[0], b.pelvis[0], t), lerp(a.pelvis[1], b.pelvis[1], t)] } as Record<Joint, Vec>;
  for (const [parent, child] of BONES) {
    const va: Vec = [a[child][0] - a[parent][0], a[child][1] - a[parent][1]];
    const vb: Vec = [b[child][0] - b[parent][0], b[child][1] - b[parent][1]];
    const angle = lerpAngle(Math.atan2(va[1], va[0]), Math.atan2(vb[1], vb[0]), t);
    const length = lerp(Math.hypot(...va), Math.hypot(...vb), t);
    out[child] = [out[parent][0] + Math.cos(angle) * length, out[parent][1] + Math.sin(angle) * length];
  }
  return out as AthletePose;
}

export function interpolateFrames(a: Frame, b: Frame, t: number): Frame {
  return {
    performer: interpolateAthlete(a.performer, b.performer, t),
    opponent: interpolateAthlete(a.opponent, b.opponent, t),
    performerOnTop: t < 0.5 ? a.performerOnTop : b.performerOnTop,
  };
}
