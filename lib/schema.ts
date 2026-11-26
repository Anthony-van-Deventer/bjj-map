import { z } from "zod";

export const SIDES = ["top", "bottom", "neutral"] as const;
export const RULESETS = ["nogi", "gi"] as const;
export const TECHNIQUE_TYPES = [
  "takedown",
  "sweep",
  "pass",
  "submission",
  "escape",
  "transition",
] as const;
export const PERCENTAGES = ["high", "medium", "situational"] as const;
export const POSITION_CATEGORIES = [
  "standing",
  "guard",
  "leg-entanglement",
  "pin",
  "back",
  "scramble",
] as const;

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "ids must be kebab-case");

export const SideSchema = z.enum(SIDES);
export const RulesetSchema = z.enum(RULESETS);

export const PerspectiveSchema = z.object({
  role: z.string(),
  goals: z.array(z.string()).default([]),
  keyPoints: z.array(z.string()).default([]),
});

export const PositionSchema = z
  .object({
    id,
    name: z.string(),
    category: z.enum(POSITION_CATEGORIES),
    rulesets: z.array(RulesetSchema).min(1).default(["nogi"]),
    summary: z.string(),
    pose: id.optional(),
    perspectives: z.object({
      top: PerspectiveSchema.optional(),
      bottom: PerspectiveSchema.optional(),
      neutral: PerspectiveSchema.optional(),
    }),
  })
  .refine((p) => Object.values(p.perspectives).some(Boolean), {
    message: "a position needs at least one perspective",
  })
  .refine((p) => !(p.perspectives.neutral && (p.perspectives.top || p.perspectives.bottom)), {
    message: "a neutral position cannot also have top/bottom perspectives",
  });

export const CounterSchema = z.object({
  name: z.string(),
  note: z.string().optional(),
  technique: id.optional(),
});

export const TechniqueSchema = z.object({
  id,
  name: z.string(),
  type: z.enum(TECHNIQUE_TYPES),
  rulesets: z.array(RulesetSchema).min(1).default(["nogi"]),
  from: id,
  side: SideSchema,
  to: z.object({ position: id, side: SideSchema }).optional(),
  percentage: z.enum(PERCENTAGES),
  summary: z.string(),
  steps: z.array(z.string()).default([]),
  counters: z.array(CounterSchema).default([]),
  sources: z.array(z.string()).default([]),
});

const Point = z.tuple([z.number(), z.number()]);

export const AthletePoseSchema = z.object({
  head: Point,
  neck: Point,
  pelvis: Point,
  lElbow: Point,
  lHand: Point,
  rElbow: Point,
  rHand: Point,
  lKnee: Point,
  lFoot: Point,
  rKnee: Point,
  rFoot: Point,
});

export const PoseSchema = z.object({
  id,
  top: AthletePoseSchema,
  bottom: AthletePoseSchema,
});

export type Side = z.infer<typeof SideSchema>;
export type Ruleset = z.infer<typeof RulesetSchema>;
export type TechniqueType = (typeof TECHNIQUE_TYPES)[number];
export type Percentage = (typeof PERCENTAGES)[number];
export type Perspective = z.infer<typeof PerspectiveSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type Technique = z.infer<typeof TechniqueSchema>;
export type Counter = z.infer<typeof CounterSchema>;
export type AthletePose = z.infer<typeof AthletePoseSchema>;
export type Pose = z.infer<typeof PoseSchema>;

export type Content = {
  positions: Position[];
  techniques: Technique[];
  poses: Pose[];
};
