import data from "./generated/content.json";
import type { Content, Pose, Position, Ruleset, Side, Technique } from "./schema";

const content = data as Content;

export function getContent(ruleset?: Ruleset): Content {
  if (!ruleset) return content;
  return {
    positions: content.positions.filter((p) => p.rulesets.includes(ruleset)),
    techniques: content.techniques.filter((t) => t.rulesets.includes(ruleset)),
    poses: content.poses,
  };
}

export function getPositions(ruleset?: Ruleset): Position[] {
  return getContent(ruleset).positions;
}

export function getPosition(id: string): Position | undefined {
  return content.positions.find((p) => p.id === id);
}

export function getTechniques(ruleset?: Ruleset): Technique[] {
  return getContent(ruleset).techniques;
}

export function getTechnique(id: string): Technique | undefined {
  return content.techniques.find((t) => t.id === id);
}

export function getPose(id: string): Pose | undefined {
  return content.poses.find((p) => p.id === id);
}

export function techniquesFrom(positionId: string, side: Side, ruleset?: Ruleset): Technique[] {
  return getTechniques(ruleset).filter((t) => t.from === positionId && t.side === side);
}
