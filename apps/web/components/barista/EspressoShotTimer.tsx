"use client";

import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Timer, Sparkles } from "lucide-react";

export const EspressoShotTimer: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRunning) {
      const startTime = Date.now() - elapsedMs;
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTime);
      }, 50);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning]);

  const toggleStartPause = () => {
    setIsRunning((prev) => !prev);
  };

  const handleReset = () => {
    setIsRunning(false);
    setElapsedMs(0);
  };

  const seconds = (elapsedMs / 1000).toFixed(1);
  const totalSecNum = elapsedMs / 1000;

  // Target window logic: 24s to 28s is golden standard specialty espresso extraction
  const isTarget = totalSecNum >= 24 && totalSecNum <= 28;
  const isUnder = totalSecNum > 0 && totalSecNum < 24;
  const isOver = totalSecNum > 28;

  return (
    <div
      className={`rounded-2xl border p-2.5 sm:p-3 transition-all flex items-center justify-between gap-3 shadow-xs ${
        isTarget
          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 ring-2 ring-emerald-500/30 animate-pulse"
          : isOver
          ? "border-rose-400 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200"
          : isUnder
          ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200"
          : "border-[#C9AE8B]/40 dark:border-white/10 bg-[#FAF4EB] dark:bg-[#1D1815] text-[#241F1C] dark:text-[#FAF4EB]"
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#B72E35] text-white shrink-0 shadow-2xs">
          <Timer className="h-4 w-4" />
        </div>
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-[#725039] dark:text-[#C9AE8B] font-bold">
            Espresso Shot Timer
          </span>
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-lg sm:text-xl font-black">{seconds}s</span>
            {isTarget && (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 px-1.5 py-0.5 text-[9.5px] font-bold">
                <Sparkles className="h-2.5 w-2.5" /> Golden (24-28s)
              </span>
            )}
            {isOver && (
              <span className="rounded-md bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40 px-1 py-0.5 text-[9px] font-bold">
                Slow / Over
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggleStartPause}
          className={`flex h-8 items-center justify-center gap-1 px-3 rounded-xl font-mono text-xs font-bold text-white shadow-xs transition active:scale-95 cursor-pointer ${
            isRunning
              ? "bg-amber-600 hover:bg-amber-700"
              : "bg-[#B72E35] hover:bg-[#9E242B]"
          }`}
        >
          {isRunning ? (
            <>
              <Pause className="h-3.5 w-3.5" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" />
              <span>{elapsedMs > 0 ? "Resume" : "Start"}</span>
            </>
          )}
        </button>

        {elapsedMs > 0 && (
          <button
            type="button"
            onClick={handleReset}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-stone-300 dark:border-stone-700 bg-black/5 dark:bg-white/10 text-stone-700 dark:text-stone-300 hover:bg-black/10 transition cursor-pointer"
            title="Reset timer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
