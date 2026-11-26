import type { Percentage, Side, TechniqueType } from "./schema";

export const TYPE_COLORS: Record<TechniqueType, string> = {
  takedown: "#a78bfa",
  sweep: "#34d399",
  pass: "#818cf8",
  submission: "#f87171",
  escape: "#facc15",
  transition: "#94a3b8",
};

export const PERCENTAGE_WIDTH: Record<Percentage, number> = {
  high: 3.5,
  medium: 2,
  situational: 1.2,
};

export const PERCENTAGE_LABEL: Record<Percentage, string> = {
  high: "High %",
  medium: "Medium %",
  situational: "Situational",
};

export const SIDE_LABEL: Record<Side, string> = {
  top: "Top",
  bottom: "Bottom",
  neutral: "Neutral",
};

export const SIDE_COLOR: Record<Side, string> = {
  top: "#38bdf8",
  bottom: "#fb923c",
  neutral: "#cbd5e1",
};
