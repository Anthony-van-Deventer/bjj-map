"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildAnimation, mirrorPose, slotOf } from "@/lib/animation";
import { JOINTS, poseToYaml, type Joint } from "@/lib/pose-yaml";
import type { AthletePose, Content, Keyframe, Pose, Technique } from "@/lib/schema";
import { ATHLETE_COLORS, Athlete, POSE_VIEWBOX } from "./PoseDiagram";
import { TechniqueAnimation } from "./TechniqueAnimation";

type AthleteKey = "top" | "bottom";
type Handle = { athlete: AthleteKey; joint: Joint };
type Drag = Handle & { whole: boolean; last: [number, number] };
type Animation = { keyframes: Keyframe[]; mirrorEnd: boolean };
type FrameRef = { kind: "start" | "key" | "end"; poseId: string; performer: AthleteKey; mirror: boolean; keyIndex?: number };

const CAN_SAVE = process.env.NODE_ENV === "development";
const BOUNDS = { minX: 0, maxX: 200, minY: 10, maxY: 122 };
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const EMPTY_ANIMATION: Animation = { keyframes: [], mirrorEnd: false };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const clonePose = (p: Pose): Pose => structuredClone(p);
const sameAnimation = (a: Animation, b: Animation) => JSON.stringify(a) === JSON.stringify(b);
const animationOf = (t: Technique): Animation => ({
  keyframes: t.animation?.keyframes ?? [],
  mirrorEnd: t.animation?.mirrorEnd ?? false,
});

function mapAthlete(a: AthletePose, fn: (p: [number, number]) => [number, number]): AthletePose {
  return Object.fromEntries(JOINTS.map((j) => [j, fn(a[j])])) as AthletePose;
}

function movePoint([x, y]: [number, number], dx: number, dy: number): [number, number] {
  return [clamp(x + dx, BOUNDS.minX, BOUNDS.maxX), clamp(y + dy, BOUNDS.minY, BOUNDS.maxY)];
}

function Button({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

type Props = { content: Content; initialTechnique?: string; initialPose?: string };

export function PoseEditor({ content, initialTechnique, initialPose }: Props) {
  const initialPoses = useMemo(() => Object.fromEntries(content.poses.map((p) => [p.id, p])), [content]);
  const initialAnimations = useMemo(
    () => Object.fromEntries(content.techniques.map((t) => [t.id, animationOf(t)])) as Record<string, Animation>,
    [content],
  );
  const positionPoseId = (positionId: string) => {
    const p = content.positions.find((x) => x.id === positionId);
    return p ? (p.pose ?? p.id) : undefined;
  };

  const framesFor = (t: Technique | undefined, anim: Animation): FrameRef[] => {
    if (!t) return [];
    const start = positionPoseId(t.from);
    const list: FrameRef[] = start ? [{ kind: "start", poseId: start, performer: slotOf(t.side), mirror: false }] : [];
    anim.keyframes.forEach((k, keyIndex) =>
      list.push({ kind: "key", poseId: k.pose, performer: k.performer, mirror: k.mirror, keyIndex }),
    );
    const end = t.to && positionPoseId(t.to.position);
    if (t.to && end) list.push({ kind: "end", poseId: end, performer: slotOf(t.to.side), mirror: anim.mirrorEnd });
    return list;
  };

  const firstFrameOf = (id: string) => {
    const list = framesFor(content.techniques.find((x) => x.id === id), initialAnimations[id] ?? EMPTY_ANIMATION);
    const key = list.findIndex((f) => f.kind === "key");
    return { frame: list[key >= 0 ? key : 0], prev: list[(key >= 0 ? key : 0) - 1] };
  };

  const startTechnique = content.techniques.some((t) => t.id === initialTechnique) ? initialTechnique! : "";
  const [savedPoses, setSavedPoses] = useState<Record<string, Pose>>(initialPoses);
  const [poses, setPoses] = useState<Record<string, Pose>>(initialPoses);
  const [savedAnimations, setSavedAnimations] = useState(initialAnimations);
  const [animations, setAnimations] = useState(initialAnimations);
  const [techniqueId, setTechniqueId] = useState(startTechnique);
  const [currentId, setCurrentId] = useState(() => {
    if (startTechnique) return firstFrameOf(startTechnique).frame?.poseId ?? content.poses[0].id;
    return initialPose && initialPoses[initialPose] ? initialPose : content.poses[0].id;
  });
  const [selected, setSelected] = useState<Handle | null>(null);
  const [ghost, setGhost] = useState<{ id: string; mirror: boolean } | null>(() => {
    const prev = startTechnique ? firstFrameOf(startTechnique).prev : undefined;
    return prev ? { id: prev.poseId, mirror: prev.mirror } : null;
  });
  const [status, setStatus] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);

  const technique = content.techniques.find((t) => t.id === techniqueId);
  const animation = technique ? animations[technique.id] : EMPTY_ANIMATION;

  const frames = framesFor(technique, animation);

  const frameIndex = frames.findIndex((f) => f.poseId === currentId);
  const currentFrame = frames[frameIndex];

  const dirtyPoseIds = Object.keys(poses).filter(
    (id) => !savedPoses[id] || poseToYaml(savedPoses[id]) !== poseToYaml(poses[id]),
  );
  const dirtyTechniqueIds = Object.keys(animations).filter((id) => !sameAnimation(animations[id], savedAnimations[id]));
  const dirty = dirtyPoseIds.length + dirtyTechniqueIds.length > 0;

  const draft = poses[currentId];
  const yaml = poseToYaml(draft);
  const ghostPose = ghost && poses[ghost.id] ? (ghost.mirror ? mirrorPose(poses[ghost.id]) : poses[ghost.id]) : undefined;

  const previewContent: Content | undefined = technique && {
    ...content,
    poses: Object.values(poses),
    techniques: content.techniques.map((t) => (t.id === technique.id ? { ...t, animation } : t)),
  };
  const preview = technique && previewContent ? buildAnimation({ ...technique, animation }, previewContent) : undefined;

  const selectFrame = (index: number) => {
    const frame = frames[index];
    if (!frame) return;
    setCurrentId(frame.poseId);
    setSelected(null);
    const prev = frames[index - 1];
    setGhost(prev ? { id: prev.poseId, mirror: prev.mirror } : null);
  };

  const chooseTechnique = (id: string) => {
    setTechniqueId(id);
    setSelected(null);
    if (!id) return setGhost(null);
    const list = framesFor(content.techniques.find((x) => x.id === id), animations[id]);
    const key = list.findIndex((f) => f.kind === "key");
    const index = key >= 0 ? key : 0;
    if (list[index]) setCurrentId(list[index].poseId);
    const prev = list[index - 1];
    setGhost(prev ? { id: prev.poseId, mirror: prev.mirror } : null);
  };

  const updateDraft = (fn: (p: Pose) => Pose) => setPoses((all) => ({ ...all, [currentId]: fn(all[currentId]) }));
  const updateAthlete = (athlete: AthleteKey, fn: (a: AthletePose) => AthletePose) =>
    updateDraft((d) => ({ ...d, [athlete]: fn(d[athlete]) }));
  const updateAnimation = (fn: (a: Animation) => Animation) =>
    technique && setAnimations((all) => ({ ...all, [technique.id]: fn(all[technique.id]) }));

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

  const nextFreeId = (base: string) => {
    for (let n = 1; ; n++) if (!poses[`${base}-${n}`]) return `${base}-${n}`;
  };

  const addKeyframe = () => {
    if (!technique || !currentFrame || currentFrame.kind === "end") return;
    const source = poses[currentFrame.poseId];
    const id = nextFreeId(technique.id);
    const pose = { ...clonePose(currentFrame.mirror ? mirrorPose(source) : source), id };
    const insertAt = currentFrame.kind === "start" ? 0 : currentFrame.keyIndex! + 1;
    setPoses((all) => ({ ...all, [id]: pose }));
    updateAnimation((a) => ({
      ...a,
      keyframes: [...a.keyframes.slice(0, insertAt), { pose: id, performer: currentFrame.performer, mirror: false }, ...a.keyframes.slice(insertAt)],
    }));
    setCurrentId(id);
    setGhost({ id: currentFrame.poseId, mirror: currentFrame.mirror });
    setSelected(null);
    setStatus(`Added keyframe "${id}". Move the joints, then save.`);
  };

  const removeKeyframe = () => {
    if (!currentFrame || currentFrame.kind !== "key") return;
    updateAnimation((a) => ({ ...a, keyframes: a.keyframes.filter((_, i) => i !== currentFrame.keyIndex) }));
    selectFrame(frameIndex - 1);
    setStatus(`Removed "${currentFrame.poseId}" from the animation (the pose file stays).`);
  };

  const moveKeyframe = (dir: -1 | 1) => {
    if (!currentFrame || currentFrame.kind !== "key") return;
    const i = currentFrame.keyIndex!;
    const j = i + dir;
    if (j < 0 || j >= animation.keyframes.length) return;
    updateAnimation((a) => {
      const keyframes = [...a.keyframes];
      [keyframes[i], keyframes[j]] = [keyframes[j], keyframes[i]];
      return { ...a, keyframes };
    });
  };

  const loadPose = (id: string) => {
    setTechniqueId("");
    setCurrentId(id);
    setSelected(null);
  };

  const duplicate = () => {
    const id = prompt("New pose id (kebab-case)", nextFreeId(currentId));
    if (!id) return;
    if (!ID_PATTERN.test(id)) return setStatus("Id must be kebab-case.");
    if (poses[id]) return setStatus(`"${id}" already exists.`);
    setPoses((all) => ({ ...all, [id]: { ...clonePose(draft), id } }));
    setTechniqueId("");
    setCurrentId(id);
    setStatus(`Duplicated as "${id}" (not saved yet).`);
  };

  const flip = () =>
    updateDraft((d) => ({
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

  const revert = () => {
    if (savedPoses[currentId]) setPoses((all) => ({ ...all, [currentId]: clonePose(savedPoses[currentId]) }));
  };

  const copy = async () => {
    await navigator.clipboard.writeText(yaml);
    setStatus(`Copied. Paste into content/poses/${currentId}.yaml`);
  };

  const save = async () => {
    setStatus("Saving…");
    const res = await fetch("/api/dev/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        poses: dirtyPoseIds.map((id) => poses[id]),
        animations: dirtyTechniqueIds.map((id) => ({ id, ...animations[id] })),
      }),
    });
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}, check the dev server logs` }));
    if (!res.ok) return setStatus(`Save failed: ${body.error}`);
    setSavedPoses(structuredClone(poses));
    setSavedAnimations(structuredClone(animations));
    setStatus(`Saved ${body.files.join(", ")}. ${body.content}`);
  };

  const isSelected = (h: Handle) => selected?.athlete === h.athlete && selected.joint === h.joint;
  const performer = currentFrame?.performer;
  const editingMirrored = currentFrame?.mirror;
  const sortedPoseIds = Object.keys(poses).sort();

  return (
    <div className="flex min-h-dvh flex-col bg-slate-950 text-slate-100">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-800 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          BJJ <span className="text-sky-400">Map</span>
        </Link>
        <span className="text-sm text-slate-400">/ Pose editor</span>
        <label className="flex items-center gap-2 text-sm text-slate-400">
          Technique
          <select
            value={techniqueId}
            onChange={(e) => chooseTechnique(e.target.value)}
            className="max-w-[220px] rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
          >
            <option value="">— none (pose only) —</option>
            {content.techniques.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.from})
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-400">
          Pose
          <select
            value={currentId}
            onChange={(e) => loadPose(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
          >
            {sortedPoseIds.map((id) => (
              <option key={id} value={id}>
                {id}
                {dirtyPoseIds.includes(id) ? " •" : ""}
              </option>
            ))}
          </select>
        </label>
        {dirty && <span className="text-xs text-amber-400">● unsaved changes</span>}
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-400">
          Onion skin
          <select
            value={ghost?.id ?? ""}
            onChange={(e) => setGhost(e.target.value ? { id: e.target.value, mirror: false } : null)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
          >
            <option value="">None</option>
            {sortedPoseIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
      </header>

      {technique && (
        <nav className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-2">
          <span className="mr-1 text-xs uppercase tracking-wider text-slate-500">Frames</span>
          {frames.map((f, i) => (
            <button
              key={`${f.kind}-${f.poseId}-${i}`}
              type="button"
              onClick={() => selectFrame(i)}
              className={`rounded-lg border px-2.5 py-1 text-xs ${
                i === frameIndex ? "border-white bg-slate-100 text-slate-950" : "border-slate-700 text-slate-300 hover:bg-slate-800"
              }`}
            >
              {f.kind === "start" ? "Start" : f.kind === "end" ? "End" : `Key ${f.keyIndex! + 1}`}
              <span className="ml-1 opacity-60">{f.poseId}</span>
            </button>
          ))}
          {!technique.to && <span className="text-xs text-slate-500">Submission: the last keyframe is the finish.</span>}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button onClick={addKeyframe} disabled={!currentFrame || currentFrame.kind === "end"}>
              + Keyframe after this
            </Button>
            <Button onClick={() => moveKeyframe(-1)} disabled={currentFrame?.kind !== "key"}>←</Button>
            <Button onClick={() => moveKeyframe(1)} disabled={currentFrame?.kind !== "key"}>→</Button>
            <Button onClick={removeKeyframe} disabled={currentFrame?.kind !== "key"}>Remove</Button>
            {technique.to && (
              <label className="flex items-center gap-1.5 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={animation.mirrorEnd}
                  onChange={(e) => updateAnimation((a) => ({ ...a, mirrorEnd: e.target.checked }))}
                />
                Mirror end
              </label>
            )}
          </div>
        </nav>
      )}

      <main className="flex flex-1 flex-col gap-4 p-4 lg:flex-row">
        <div className="w-full flex-1 space-y-2 lg:self-start">
          {currentFrame && currentFrame.kind !== "key" && (
            <p className="rounded-lg border border-amber-900 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
              This is the {currentFrame.kind} position&apos;s own pose. Edits here change it everywhere it&apos;s used.
              {editingMirrored && " It's shown unmirrored here; the animation mirrors it."}
            </p>
          )}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-2">
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
              {ghostPose && (
                <g pointerEvents="none">
                  <Athlete pose={ghostPose.bottom} colors={ATHLETE_COLORS.bottom} opacity={0.15} />
                  <Athlete pose={ghostPose.top} colors={ATHLETE_COLORS.top} opacity={0.15} />
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
                      stroke={ATHLETE_COLORS[athlete].near}
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
        </div>

        <aside className="w-full space-y-4 lg:w-[360px]">
          {preview && (
            <section className="space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Live preview</h3>
              <TechniqueAnimation animation={preview} />
            </section>
          )}

          <section className="space-y-1 rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm">
            {performer && (
              <div className="text-xs text-slate-400">
                In this frame <span style={{ color: ATHLETE_COLORS[performer].near }}>{performer}</span> is the one
                doing the technique.
              </div>
            )}
            {selected ? (
              <div>
                <span className="font-semibold" style={{ color: ATHLETE_COLORS[selected.athlete].near }}>
                  {selected.athlete}.{selected.joint}
                </span>{" "}
                <span className="font-mono text-slate-300">[{draft[selected.athlete][selected.joint].join(", ")}]</span>
              </div>
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
            <Button onClick={flip}>Flip horizontal</Button>
            <Button onClick={() => swapNearFar("top")}>Swap near/far (top)</Button>
            <Button onClick={() => swapNearFar("bottom")}>Swap near/far (bottom)</Button>
            <Button onClick={duplicate}>Duplicate as…</Button>
            <Button onClick={revert} disabled={!savedPoses[currentId]}>Revert pose</Button>
          </section>

          <section className="space-y-2">
            <textarea
              readOnly
              value={yaml}
              rows={5}
              className="w-full rounded-xl border border-slate-800 bg-slate-900 p-3 font-mono text-[11px] text-slate-300"
            />
            <div className="flex gap-2">
              <Button onClick={copy}>Copy YAML</Button>
              {CAN_SAVE && (
                <button
                  type="button"
                  onClick={save}
                  disabled={!dirty}
                  className="rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-semibold text-slate-950 disabled:opacity-40"
                >
                  Save all ({dirtyPoseIds.length + dirtyTechniqueIds.length})
                </button>
              )}
            </div>
            {status && <p className="whitespace-pre-wrap text-xs text-slate-400">{status}</p>}
          </section>
        </aside>
      </main>
    </div>
  );
}
