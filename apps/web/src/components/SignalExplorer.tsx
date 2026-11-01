"use client";

import { useState } from "react";

const SIGNALS = [
  {
    id: "photos",
    label: "Photo signals",
    blurb: "Resolution, duplicates, placeholders, and odd EXIF timestamps.",
    detail:
      "Local inspection opens each upload with Pillow. We flag tiny images, near-solid placeholders, exact duplicate hashes, sparse coverage, and photo dates that drift more than ~18 months.",
  },
  {
    id: "claims",
    label: "Seller claims",
    blurb: "“No rust,” “like new,” and similar lines held against the photos.",
    detail:
      "Regex extracts optimistic claims from the description. With Gemini or Ollama enabled, a vision model returns supported / contradicted / unclear for each claim.",
  },
  {
    id: "vin",
    label: "VIN alignment",
    blurb: "NHTSA decode vs the year, make, model, and trim in the ad.",
    detail:
      "vPIC returns factory attributes. We compare make/model/year/trim to listing text and can ask the vision model for badge or equipment proof when a vision provider is configured.",
  },
  {
    id: "recalls",
    label: "Recalls & patterns",
    blurb: "Open NHTSA campaigns and common complaint hotspots for that model year.",
    detail:
      "After decode, we query recalls by year/make/model and can aggregate owner-complaint components. That is model-year context — not proof this VIN has those failures.",
  },
] as const;

export function SignalExplorer() {
  const [active, setActive] = useState<(typeof SIGNALS)[number]["id"]>("photos");
  const current = SIGNALS.find((item) => item.id === active) ?? SIGNALS[0];

  return (
    <div className="grid gap-8 md:grid-cols-[0.9fr_1.1fr] md:items-start">
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">Explore signals</p>
        <h2 className="mt-3 font-display text-3xl tracking-tight text-ink md:text-4xl">
          Tap a check to see what runs on every submission.
        </h2>
        <p className="mt-4 max-w-md text-base leading-relaxed text-muted">
          SignalCheck is a layered pipeline: local photo heuristics first, then VIN/recalls, then an
          optional vision model.
        </p>
      </div>
      <div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Analysis signals">
          {SIGNALS.map((signal) => {
            const selected = signal.id === active;
            return (
              <button
                key={signal.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(signal.id)}
                className={`border px-3.5 py-2 text-sm font-semibold transition ${
                  selected
                    ? "border-accent bg-accent text-white"
                    : "border-[var(--line)] bg-panel text-ink hover:border-accent/50"
                }`}
              >
                {signal.label}
              </button>
            );
          })}
        </div>
        <div
          key={current.id}
          role="tabpanel"
          className="signal-panel mt-5 border border-[var(--line)] bg-panel p-5 md:p-6"
        >
          <p className="text-lg font-semibold text-ink">{current.blurb}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">{current.detail}</p>
        </div>
      </div>
    </div>
  );
}
