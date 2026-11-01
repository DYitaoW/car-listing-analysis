"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DEMO_LISTING } from "@/lib/demoListing";
import { scoreClassName } from "@/lib/report";

export function InteractiveDemoScore() {
  const target = DEMO_LISTING.report?.riskScore ?? 42;
  const [score, setScore] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!revealed) return;
    let frame = 0;
    const frames = 28;
    const id = window.setInterval(() => {
      frame += 1;
      const next = Math.round((target * frame) / frames);
      setScore(Math.min(target, next));
      if (frame >= frames) window.clearInterval(id);
    }, 28);
    return () => window.clearInterval(id);
  }, [revealed, target]);

  return (
    <div className="border border-[var(--line)] bg-panel p-6 md:p-8">
      <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">Interactive demo</p>
      <h3 className="mt-3 font-display text-2xl text-ink md:text-3xl">
        Watch a sample risk score settle.
      </h3>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
        This uses the fixed demo listing — no upload, no live NHTSA call. Run a real check to analyze
        your own photos.
      </p>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-mono text-xs tracking-wider text-muted uppercase">Demo risk score</p>
          <p className={`font-display text-6xl tabular-nums ${scoreClassName(revealed ? score : null)}`}>
            {revealed ? score : "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setScore(0);
              setRevealed(true);
            }}
          >
            {revealed ? "Replay score" : "Run demo score"}
          </button>
          <Link href="/check?demo=1" className="btn-secondary">
            Open full demo report
          </Link>
        </div>
      </div>
      {revealed ? (
        <ul className="mt-6 space-y-2 border-t border-[var(--line)] pt-5 text-sm text-muted">
          {(DEMO_LISTING.report?.flags ?? []).map((flag) => (
            <li key={flag.code}>
              <span className="font-mono text-xs uppercase text-warn">{flag.severity}</span>{" "}
              {flag.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
