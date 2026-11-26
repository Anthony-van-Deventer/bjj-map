"use client";

import { useEffect, useRef, useState } from "react";
import { interpolateFrames, type TechniqueAnimation as Animation } from "@/lib/animation";
import { ATHLETE_COLORS, Athlete, POSE_VIEWBOX } from "./PoseDiagram";

const HOLD_MS = 450;
const MOVE_MS = 900;
const END_HOLD_MS = 1400;

const ease = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

function progressAt(ms: number, segments: number) {
  const step = HOLD_MS + MOVE_MS;
  const total = segments * step + END_HOLD_MS;
  const local = ms % total;
  const segment = Math.floor(local / step);
  if (segment >= segments) return segments;
  return segment + Math.max(0, (local - segment * step - HOLD_MS) / MOVE_MS);
}

export function TechniqueAnimation({ animation }: { animation: Animation }) {
  const { frames, performerSlot, isAuto } = animation;
  const segments = frames.length - 1;
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(
    () => typeof window === "undefined" || !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const startRef = useRef<number | null>(null);
  const offsetRef = useRef(0);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    startRef.current = null;
    const tick = (now: number) => {
      startRef.current ??= now - offsetRef.current;
      const elapsed = now - startRef.current;
      offsetRef.current = elapsed;
      setProgress(progressAt(elapsed, segments));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, segments]);

  const index = Math.min(Math.floor(progress), segments - 1);
  const frame = interpolateFrames(frames[index], frames[index + 1], ease(progress - index));
  const performerColors = ATHLETE_COLORS[performerSlot];
  const opponentColors = ATHLETE_COLORS[performerSlot === "top" ? "bottom" : "top"];
  const performer = <Athlete pose={frame.performer} colors={performerColors} />;
  const opponent = <Athlete pose={frame.opponent} colors={opponentColors} opacity={0.55} />;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
      <svg viewBox={POSE_VIEWBOX} className="w-full text-white" role="img" aria-label="Technique animation">
        <rect x={0} y={116} width={200} height={6} rx={3} fill="currentColor" opacity={0.12} />
        {frame.performerOnTop ? (
          <>
            {opponent}
            {performer}
          </>
        ) : (
          <>
            {performer}
            {opponent}
          </>
        )}
      </svg>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-800 text-xs text-slate-200 hover:bg-slate-700"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <input
          type="range"
          min={0}
          max={segments}
          step={0.01}
          value={progress}
          onChange={(e) => {
            setPlaying(false);
            const p = Number(e.target.value);
            setProgress(p);
            const whole = Math.floor(p);
            offsetRef.current = whole * (HOLD_MS + MOVE_MS) + HOLD_MS + (p - whole) * MOVE_MS;
          }}
          className="flex-1 accent-sky-400"
          aria-label="Scrub animation"
        />
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        <span style={{ color: performerColors.near }}>● You</span>
        {" · "}
        {isAuto
          ? "Auto-tween from start to end position. Add keyframes for the real mechanics."
          : `${frames.length - 2} keyframe${frames.length === 3 ? "" : "s"}`}
      </p>
    </div>
  );
}
