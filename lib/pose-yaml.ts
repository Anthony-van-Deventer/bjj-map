import type { AthletePose, Pose } from "./schema";

export const JOINTS = [
  "head",
  "neck",
  "pelvis",
  "lElbow",
  "lHand",
  "rElbow",
  "rHand",
  "lKnee",
  "lFoot",
  "rKnee",
  "rFoot",
] as const satisfies readonly (keyof AthletePose)[];

export type Joint = (typeof JOINTS)[number];

const athleteYaml = (a: AthletePose) =>
  `{${JOINTS.map((j) => `${j}: [${a[j][0]},${a[j][1]}]`).join(", ")}}`;

export const poseToYaml = (pose: Pose) =>
  `id: ${pose.id}\ntop: ${athleteYaml(pose.top)}\nbottom: ${athleteYaml(pose.bottom)}\n`;
