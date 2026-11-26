import type { AthletePose, Pose, Side } from "@/lib/schema";

export const ATHLETE_COLORS = {
  top: { near: "#38bdf8", far: "#0e7490" },
  bottom: { near: "#fb923c", far: "#9a3412" },
} as const;

type Point = readonly [number, number];

const line = (...points: Point[]) => points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");

export const POSE_VIEWBOX = "0 10 200 112";

export function Athlete({
  pose,
  colors,
  opacity = 1,
}: {
  pose: AthletePose;
  colors: { near: string; far: string };
  opacity?: number;
}) {
  const limb = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <g opacity={opacity}>
      <path d={line(pose.pelvis, pose.rKnee, pose.rFoot)} stroke={colors.far} strokeWidth={7} {...limb} />
      <path d={line(pose.neck, pose.rElbow, pose.rHand)} stroke={colors.far} strokeWidth={6} {...limb} />
      <path d={line(pose.neck, pose.pelvis)} stroke={colors.near} strokeWidth={13} {...limb} />
      <path d={line(pose.pelvis, pose.lKnee, pose.lFoot)} stroke={colors.near} strokeWidth={8} {...limb} />
      <path d={line(pose.neck, pose.lElbow, pose.lHand)} stroke={colors.near} strokeWidth={6.5} {...limb} />
      <circle cx={pose.head[0]} cy={pose.head[1]} r={7.5} fill={colors.near} />
    </g>
  );
}

export function PoseDiagram({
  pose,
  you,
  className,
  showGround = true,
}: {
  pose: Pose;
  you?: Side;
  className?: string;
  showGround?: boolean;
}) {
  const dim = (side: "top" | "bottom") => you === "top" || you === "bottom" ? you !== side : false;
  return (
    <svg viewBox={POSE_VIEWBOX} className={className} role="img" aria-label={`${pose.id} diagram`}>
      {showGround && <rect x={0} y={116} width={200} height={6} rx={3} fill="currentColor" opacity={0.12} />}
      <Athlete pose={pose.bottom} colors={ATHLETE_COLORS.bottom} opacity={dim("bottom") ? 0.35 : 1} />
      <Athlete pose={pose.top} colors={ATHLETE_COLORS.top} opacity={dim("top") ? 0.35 : 1} />
    </svg>
  );
}
