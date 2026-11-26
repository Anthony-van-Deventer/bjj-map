"use client";

import type { Content, Side, Technique } from "@/lib/schema";
import { PERCENTAGE_LABEL, SIDE_COLOR, SIDE_LABEL, TYPE_COLORS } from "@/lib/styles";
import { buildAnimation } from "@/lib/animation";
import { PoseDiagram } from "./PoseDiagram";
import { TechniqueAnimation } from "./TechniqueAnimation";

export type Selection =
  | { kind: "position"; position: string; side: Side }
  | { kind: "technique"; id: string };

type Props = {
  content: Content;
  selection: Selection;
  onSelectTechnique: (id: string) => void;
  onSelectPosition: (position: string, side: Side) => void;
};

const opposite = (side: Side): Side => (side === "top" ? "bottom" : side === "bottom" ? "top" : "neutral");

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"
      style={{ borderColor: color, color }}
    >
      {children}
    </span>
  );
}

function TechniqueList({ techniques, onSelect }: { techniques: Technique[]; onSelect: (id: string) => void }) {
  if (!techniques.length) return <p className="text-sm text-slate-500">Nothing mapped yet.</p>;
  return (
    <ul className="space-y-1.5">
      {techniques.map((t) => (
        <li key={t.id}>
          <button
            type="button"
            onClick={() => onSelect(t.id)}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-left text-sm hover:border-slate-600"
          >
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_COLORS[t.type] }} />
              {t.name}
            </span>
            <span className="text-[11px] text-slate-400">
              {t.type} · {PERCENTAGE_LABEL[t.percentage]}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
      {children}
    </section>
  );
}

export function DetailPanel({ content, selection, onSelectTechnique, onSelectPosition }: Props) {
  const positionById = new Map(content.positions.map((p) => [p.id, p]));
  const poseById = new Map(content.poses.map((p) => [p.id, p]));

  if (selection.kind === "position") {
    const position = positionById.get(selection.position);
    if (!position) return null;
    const perspective = position.perspectives[selection.side];
    const pose = poseById.get(position.pose ?? position.id);
    const yours = content.techniques.filter((t) => t.from === position.id && t.side === selection.side);
    const theirs = content.techniques.filter(
      (t) => t.from === position.id && t.side === opposite(selection.side) && selection.side !== "neutral",
    );

    return (
      <div className="space-y-5">
        <header className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge color={SIDE_COLOR[selection.side]}>{SIDE_LABEL[selection.side]}</Badge>
            <Badge color="#64748b">{position.category}</Badge>
          </div>
          <h2 className="text-xl font-bold">{position.name}</h2>
          {perspective && <p className="text-sm text-slate-400">You are: {perspective.role}</p>}
        </header>
        {pose && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <PoseDiagram pose={pose} you={selection.side} className="w-full text-white" />
            <div className="mt-1 flex justify-center gap-4 text-[11px] text-slate-400">
              <span style={{ color: SIDE_COLOR.top }}>● Top</span>
              <span style={{ color: SIDE_COLOR.bottom }}>● Bottom</span>
            </div>
          </div>
        )}
        <p className="text-sm text-slate-300">{position.summary}</p>
        {perspective?.goals.length ? (
          <Section title="Goals">
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
              {perspective.goals.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </Section>
        ) : null}
        {perspective?.keyPoints.length ? (
          <Section title="Key points">
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
              {perspective.keyPoints.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          </Section>
        ) : null}
        <Section title="Your options">
          <TechniqueList techniques={yours} onSelect={onSelectTechnique} />
        </Section>
        {selection.side !== "neutral" && (
          <Section title="Watch out for (their options)">
            <TechniqueList techniques={theirs} onSelect={onSelectTechnique} />
            <button
              type="button"
              onClick={() => onSelectPosition(position.id, opposite(selection.side))}
              className="text-xs text-slate-400 underline hover:text-slate-200"
            >
              Switch to {SIDE_LABEL[opposite(selection.side)].toLowerCase()} perspective →
            </button>
          </Section>
        )}
      </div>
    );
  }

  const technique = content.techniques.find((t) => t.id === selection.id);
  if (!technique) return null;
  const from = positionById.get(technique.from);
  const to = technique.to ? positionById.get(technique.to.position) : undefined;
  const techniqueById = new Map(content.techniques.map((t) => [t.id, t]));
  const animation = buildAnimation(technique, content);
  const fromPose = from && poseById.get(from.pose ?? from.id);

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge color={TYPE_COLORS[technique.type]}>{technique.type}</Badge>
          <Badge color="#e2e8f0">{PERCENTAGE_LABEL[technique.percentage]}</Badge>
          <Badge color={SIDE_COLOR[technique.side]}>{SIDE_LABEL[technique.side]}</Badge>
        </div>
        <h2 className="text-xl font-bold">{technique.name}</h2>
        <p className="text-sm text-slate-400">
          {from && (
            <button type="button" className="underline hover:text-slate-200" onClick={() => onSelectPosition(from.id, technique.side)}>
              {from.name}
            </button>
          )}
          {" → "}
          {to && technique.to ? (
            <button
              type="button"
              className="underline hover:text-slate-200"
              onClick={() => onSelectPosition(to.id, technique.to!.side)}
            >
              {to.name} ({SIDE_LABEL[technique.to.side].toLowerCase()})
            </button>
          ) : (
            "Submission 🏁"
          )}
        </p>
      </header>
      {animation ? (
        <TechniqueAnimation key={technique.id} animation={animation} />
      ) : (
        fromPose && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <PoseDiagram pose={fromPose} you={technique.side} className="w-full text-white" />
          </div>
        )
      )}
      <p className="text-sm text-slate-300">{technique.summary}</p>
      {technique.steps.length > 0 && (
        <Section title="Steps">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300">
            {technique.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </Section>
      )}
      <Section title="Counters">
        {technique.counters.length ? (
          <ul className="space-y-2">
            {technique.counters.map((c) => {
              const linked = c.technique ? techniqueById.get(c.technique) : undefined;
              return (
                <li key={c.name} className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm">
                  <div className="font-medium text-slate-100">
                    {linked ? (
                      <button type="button" className="underline hover:text-white" onClick={() => onSelectTechnique(linked.id)}>
                        {c.name}
                      </button>
                    ) : (
                      c.name
                    )}
                  </div>
                  {c.note && <p className="mt-1 text-slate-400">{c.note}</p>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No counters mapped yet.</p>
        )}
      </Section>
      {technique.sources.length > 0 && (
        <Section title="Sources">
          <ul className="list-disc pl-5 text-xs text-slate-500">
            {technique.sources.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
