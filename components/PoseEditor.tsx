"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { JOINTS, poseToYaml, type Joint } from "@/lib/pose-yaml";
import type { AthletePose, Pose } from "@/lib/schema";
import { ATHLETE_COLORS, Athlete, POSE_VIEWBOX } from "./PoseDiagram";

type AthleteKey = "top" | "bottom";
type Handle = { athlete: AthleteKey; joint: Joint };
type Drag = Handle & { whole: boolean; last: [number, number] };

const CAN_SAVE = process.env.NODE_ENV === "development";
const BOUNDS = { minX: 0, maxX: 200, minY: 10, maxY: 122 };
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const clonePose = (p: Pose): Pose => structuredClone(p);

function mapAthlete(a: AthletePose, fn: (p: [number, number]) => [number, number]): AthletePose {
  return Object.fromEntries(JOINTS.map((j) => [j, fn(a[j])])) as AthletePose;
}

function movePoint([x, y]: [number, number], dx: number, dy: number): [number, number] {
  return [clamp(x + dx, BOUNDS.minX, BOUNDS.maxX), clamp(y + dy, BOUNDS.minY, BOUNDS.maxY)];
}

export function PoseEditor({ poses: initialPoses }: { poses: Pose[] }) {
  const [saved, setSaved] = useState<Record<string, Pose>>(() =>
    Object.fromEntries(initialPoses.map((p) => [p.id, p])),
  );
  const [draft, setDraft] = useState<Pose>(() => clonePose(initialPoses[0]));
  const [selected, setSelected] = useState<Handle | null>(null);
  const [ghostId, setGhostId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);

  const isNew = !saved[draft.id];
  const dirty = isNew || poseToYaml(saved[draft.id]) !== poseToYaml(draft);
  const ghost = ghostId ? saved[ghostId] : undefined;
  const yaml = poseToYaml(draft);

  const updateAthlete = (athlete: AthleteKey, fn: (a: AthletePose) => AthletePose) =>
    setDraft((d) => ({ ...d, [athlete]: fn(d[athlete]) }));

  const nudge = (h: Handle, dx: number, dy: number, whole: boolean) =>
    updateAthlete(h.athlete, (a) =>
      whole ? mapAthlete(a, (p) => movePoint(p, dx, dy)) : { ...a, [h.joint]: movePoint(a[h.joint], dx, dy) },
    );

  const toSvg = (e: React.PointerEvent): [number, number] => {
    const svg = svgRef.current!;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return [Math.round(pt.x), Math.round(pt.y)];
  };

  const onPointerDown = (e: React.PointerEvent, handle: Handle) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { ...handle, whole: e.shiftKey, last: toSvg(e) };
    setSelected(handle);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const [x, y] = toSvg(e);
    const [dx, dy] = [x - drag.last[0], y - drag.last[1]];
    if (!dx && !dy) return;
    drag.last = [x, y];
    nudge(drag, dx, dy, drag.whole);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selected || (e.target as HTMLElement).closest("input, textarea, select")) return;
      const step = e.altKey ? 5 : 1;
      const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!delta) return;
      e.preventDefault();
      nudge(selected, delta[0], delta[1], e.shiftKey);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const load = (id: string) => {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    setDraft(clonePose(saved[id]));
    setSelected(null);
    setStatus("");
  };

  const duplicate = () => {
    const id = prompt("New pose id (kebab-case)", `${draft.id}-2`);
    if (!id) return;
    if (!ID_PATTERN.test(id)) return setStatus("Id must be kebab-case.");
    if (saved[id]) return setStatus(`"${id}" already exists.`);
    setDraft((d) => ({ ...clonePose(d), id }));
    setStatus(`Duplicated as "${id}" (not saved yet).`);
  };

  const flip = () =>
    setDraft((d) => ({
      ...d,
      top: mapAthlete(d.top, ([x, y]) => [BOUNDS.maxX - x, y]),
      bottom: mapAthlete(d.bottom, ([x, y]) => [BOUNDS.maxX - x, y]),
    }));

  const swapNearFar = (athlete: AthleteKey) =>
    updateAthlete(athlete, (a) => ({
      ...a,
      lElbow: a.rElbow, rElbow: a.lElbow, lHand: a.rHand, rHand: a.lHand,
      lKnee: a.rKnee, rKnee: a.lKnee, lFoot: a.rFoot, rFoot: a.lFoot,
    }));

  const copy = async () => {
    await navigator.clipboard.writeText(yaml);
    setStatus(`Copied. Paste into content/poses/${draft.id}.yaml`);
  };

  const save = async () => {
    setStatus("Saving…");
    const res = await fetch("/api/dev/poses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    const body = await res.json();
    if (!res.ok) return setStatus(`Save failed: ${body.error}`);
    setSaved((s) => ({ ...s, [draft.id]: clonePose(draft) }));
    setStatus(`Saved content/poses/${draft.id}.yaml (${body.content})`);
  };

  const handleColor = (athlete: AthleteKey) => ATHLETE_COLORS[athlete].near;
  const isSelected = (h: Handle) => selected?.athlete === h.athlete && selected.joint === h.joint;

  return (
    <div className="flex min-h-dvh flex-col bg-slate-950 text-slate-100">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-800 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          BJJ <span className="text-sky-400">Map</span>
        </Link>
        <span className="text-sm text-slate-400">/ Pose editor</span>
        <select
          value={saved[draft.id] ? draft.id : ""}
          onChange={(e) => load(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
        >
          {isNew && <option value="">{draft.id} (new)</option>}
          {Object.keys(saved).sort().map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        {dirty && <span className="text-xs text-amber-400">● unsaved</span>}
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-400">
          Onion skin
          <select
            value={ghostId}
            onChange={(e) => setGhostId(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
          >
            <option value="">None</option>
            {Object.keys(saved).sort().map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
      </header>

      <main className="flex flex-1 flex-col gap-4 p-4 lg:flex-row">
        <div className="flex-1 self-start rounded-xl border border-slate-800 bg-slate-900 p-2">
          <svg
            ref={svgRef}
            viewBox={POSE_VIEWBOX}
            className="w-full touch-none select-none text-white"
            onPointerMove={onPointerMove}
            onPointerUp={() => (dragRef.current = null)}
            onPointerDown={(e) => e.target === svgRef.current && setSelected(null)}
          >
            {Array.from({ length: 21 }, (_, i) => (
              <line key={`v${i}`} x1={i * 10} y1={10} x2={i * 10} y2={122} stroke="currentColor" opacity={0.05} strokeWidth={0.3} />
            ))}
            {Array.from({ length: 12 }, (_, i) => (
              <line key={`h${i}`} x1={0} y1={10 + i * 10} x2={200} y2={10 + i * 10} stroke="currentColor" opacity={0.05} strokeWidth={0.3} />
            ))}
            <rect x={0} y={116} width={200} height={6} rx={3} fill="currentColor" opacity={0.12} />
            {ghost && (
              <g pointerEvents="none">
                <Athlete pose={ghost.bottom} colors={ATHLETE_COLORS.bottom} opacity={0.15} />
                <Athlete pose={ghost.top} colors={ATHLETE_COLORS.top} opacity={0.15} />
              </g>
            )}
            <g pointerEvents="none">
              <Athlete pose={draft.bottom} colors={ATHLETE_COLORS.bottom} opacity={0.9} />
              <Athlete pose={draft.top} colors={ATHLETE_COLORS.top} opacity={0.9} />
            </g>
            {(["bottom", "top"] as const).flatMap((athlete) =>
              JOINTS.map((joint) => {
                const [x, y] = draft[athlete][joint];
                const h = { athlete, joint };
                return (
                  <circle
                    key={`${athlete}-${joint}`}
                    cx={x}
                    cy={y}
                    r={isSelected(h) ? 3 : 2.2}
                    fill={isSelected(h) ? "#fff" : "#0f172a"}
                    stroke={handleColor(athlete)}
                    strokeWidth={joint.startsWith("r") ? 0.6 : 1.2}
                    strokeDasharray={joint.startsWith("r") ? "1 0.6" : undefined}
                    className="cursor-grab active:cursor-grabbing"
                    onPointerDown={(e) => onPointerDown(e, h)}
                  >
                    <title>{`${athlete}.${joint}`}</title>
                  </circle>
                );
              }),
            )}
          </svg>
        </div>

        <aside className="w-full space-y-4 lg:w-[360px]">
          <section className="space-y-1 rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm">
            {selected ? (
              <>
                <div className="font-semibold" style={{ color: handleColor(selected.athlete) }}>
                  {selected.athlete}.{selected.joint}
                </div>
                <div className="font-mono text-slate-300">
                  [{draft[selected.athlete][selected.joint].join(", ")}]
                </div>
              </>
            ) : (
              <div className="text-slate-400">Click a joint to select it.</div>
            )}
            <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
              <li>Drag a joint to move it · Shift+drag to move the whole athlete</li>
              <li>Arrow keys nudge 1 · Alt+arrow nudges 5 · Shift+arrow moves the athlete</li>
              <li>Solid handles are near-side limbs, dashed are far-side</li>
            </ul>
          </section>

          <section className="flex flex-wrap gap-2">
            {[
              ["Flip horizontal", flip],
              ["Swap near/far (top)", () => swapNearFar("top")],
              ["Swap near/far (bottom)", () => swapNearFar("bottom")],
              ["Duplicate as…", duplicate],
              ["Revert", () => saved[draft.id] && setDraft(clonePose(saved[draft.id]))],
            ].map(([label, fn]) => (
              <button
                key={label as string}
                type="button"
                onClick={fn as () => void}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
              >
                {label as string}
              </button>
            ))}
          </section>

          <section className="space-y-2">
            <textarea
              readOnly
              value={yaml}
              rows={6}
              className="w-full rounded-xl border border-slate-800 bg-slate-900 p-3 font-mono text-[11px] text-slate-300"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copy}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
              >
                Copy YAML
              </button>
              {CAN_SAVE && (
                <button
                  type="button"
                  onClick={save}
                  disabled={!dirty}
                  className="rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-semibold text-slate-950 disabled:opacity-40"
                >
                  Save to content/
                </button>
              )}
            </div>
            {status && <p className="text-xs text-slate-400">{status}</p>}
          </section>
        </aside>
      </main>
    </div>
  );
}
