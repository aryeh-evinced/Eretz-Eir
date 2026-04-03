"use client";

import { useEffect, useRef, useState } from "react";

interface TimerProps {
  totalSeconds: number;
  remainingSeconds: number;
  onExpire: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getBarColor(remaining: number): string {
  if (remaining <= 10) return "bg-red-500";
  if (remaining <= 30) return "bg-yellow-400";
  return "bg-teal";
}

export function Timer({ totalSeconds, remainingSeconds, onExpire }: TimerProps) {
  const [announced, setAnnounced] = useState<string>("");
  const hasFiredExpire = useRef(false);

  const fraction = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
  const pct = Math.max(0, Math.min(100, fraction * 100));

  useEffect(() => {
    if (remainingSeconds <= 0 && !hasFiredExpire.current) {
      hasFiredExpire.current = true;
      onExpire();
    }
  }, [remainingSeconds, onExpire]);

  useEffect(() => {
    if (remainingSeconds === 30) {
      setAnnounced("נשארו 30 שניות");
    } else if (remainingSeconds === 10) {
      setAnnounced("נשארו 10 שניות!");
    }
  }, [remainingSeconds]);

  // Reset fire guard when totalSeconds changes (new round)
  useEffect(() => {
    hasFiredExpire.current = false;
  }, [totalSeconds]);

  const isLow = remainingSeconds <= 10;

  return (
    <div className="w-full flex flex-col gap-1.5" role="timer" aria-label="טיימר">
      <div className="flex items-center justify-between text-sm">
        <span className="text-text-dim font-body">זמן נותר</span>
        <span
          className={[
            "font-display font-bold tabular-nums text-lg",
            isLow ? "text-red-500" : "text-text-primary",
          ].join(" ")}
        >
          {formatTime(remainingSeconds)}
        </span>
      </div>

      <div
        className="relative h-3 w-full rounded-full bg-surface-2 overflow-hidden"
        aria-hidden="true"
      >
        <div
          className={[
            "h-full rounded-full transition-all motion-reduce:transition-none",
            getBarColor(remainingSeconds),
          ].join(" ")}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div aria-live="assertive" className="sr-only">
        {announced}
      </div>
    </div>
  );
}
