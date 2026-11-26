import type { AthletePose, Pose, Side } from "@/lib/schema";

export const ATHLETE_COLORS = {
  top: { near: "#38bdf8", far: "#0e7490" },
  bottom: { near: "#fb923c", far: "#9a3412" },
} as const;

type Point = readonly [number, number];

const line = (...points: Point[]) => points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");

function Athlete({ pose, colors, dimmed }: { pose: AthletePose; colors: { near: string; far: string }; dimmed: boolean }) {
  const limb = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <g opacity={dimmed ? 0.35 : 1}>
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
    <svg viewBox="0 10 200 112" className={className} role="img" aria-label={`${pose.id} diagram`}>
      {showGround && <rect x={0} y={116} width={200} height={6} rx={3} fill="currentColor" opacity={0.12} />}
      <Athlete pose={pose.bottom} colors={ATHLETE_COLORS.bottom} dimmed={dim("bottom")} />
      <Athlete pose={pose.top} colors={ATHLETE_COLORS.top} dimmed={dim("top")} />
    </svg>
  );
}
