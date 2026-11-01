"use client";

import type { Listing } from "@listing-validator/types";
import { StatusPill } from "@/components/StatusPill";
import { formatPrice, scoreClassName } from "@/lib/report";

export function ReportView({
  listing,
  compact = false,
}: {
  listing: Listing;
  compact?: boolean;
}) {
  const report = listing.report;
  const score = report?.riskScore;

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={listing.status} />
            <span className="font-mono text-xs text-muted">{formatPrice(listing.price)}</span>
          </div>
          <h2 className={`mt-2 font-display tracking-tight text-ink ${compact ? "text-2xl" : "text-3xl"}`}>
            {listing.title}
          </h2>
        </div>
        {score != null ? (
          <div className="text-right">
            <p className="font-mono text-xs tracking-wider text-muted uppercase">Risk score</p>
            <p className={`font-display tabular-nums ${compact ? "text-4xl" : "text-5xl"} ${scoreClassName(score)}`}>
              {score}
            </p>
          </div>
        ) : null}
      </div>

      {listing.error ? <p className="text-sm text-danger">{listing.error}</p> : null}

      {!report && listing.status !== "failed" ? (
        <p className="animate-pulse text-sm text-muted">Running analysis…</p>
      ) : null}

      {report ? (
        <>
          <p className="text-sm leading-relaxed text-muted md:text-base">{report.summary}</p>
          <p className="font-mono text-xs text-muted">
            Confidence {Math.round(report.confidence * 100)}%
          </p>
          <div className="flex flex-wrap gap-2">
            <MetaChip>History not checked</MetaChip>
            <MetaChip>Title not verified</MetaChip>
            {report.recalls.checked ? (
              <MetaChip>
                Recalls: {report.recalls.count}
                {report.recalls.parkIt ? " · PARK IT" : ""}
              </MetaChip>
            ) : null}
          </div>

          {report.vinMatch.checked ? (
            <p className="text-sm text-ink">
              VIN{" "}
              {report.vinMatch.matchesListing
                ? "agrees with the listing text"
                : report.vinMatch.matchesListing === false
                  ? "conflicts with the listing text"
                  : "was decoded"}
              {report.vinMatch.decoded
                ? ` · ${[
                    report.vinMatch.decoded.modelYear,
                    report.vinMatch.decoded.make,
                    report.vinMatch.decoded.model,
                  ]
                    .filter(Boolean)
                    .join(" ")}`
                : ""}
            </p>
          ) : null}

          {report.flags.length ? (
            <ul className="space-y-2">
              {!compact ? (
                <p className="font-mono text-xs tracking-wider text-muted uppercase">Flags</p>
              ) : null}
              {report.flags.map((flag) => (
                <li key={flag.code} className="border border-[var(--line)] px-3 py-2.5 text-sm">
                  <span className="font-mono text-xs uppercase text-warn">{flag.severity}</span>
                  <p className="text-ink">{flag.message}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No heuristic flags raised.</p>
          )}

          {report.claimChecks.length ? (
            <ul className="space-y-2">
              {!compact ? (
                <p className="font-mono text-xs tracking-wider text-muted uppercase">Claim checks</p>
              ) : null}
              {report.claimChecks.map((check) => (
                <li key={check.claim} className="border border-[var(--line)] px-3 py-2.5 text-sm">
                  <span className="font-mono text-xs uppercase text-accent">{check.verdict}</span>
                  <p className="text-ink">{check.claim}</p>
                  <p className="text-muted">{check.detail}</p>
                </li>
              ))}
            </ul>
          ) : null}

          {!compact && report.imageFindings?.length ? (
            <ul className="space-y-1 border-t border-[var(--line)] pt-4">
              <p className="font-mono text-xs tracking-wider text-muted uppercase">Image findings</p>
              {report.imageFindings.map((line) => (
                <li key={line} className="text-sm text-muted">
                  {line}
                </li>
              ))}
            </ul>
          ) : null}

          <p className="text-xs leading-relaxed text-muted">{report.disclaimer}</p>
        </>
      ) : null}
    </div>
  );
}

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="border border-[var(--line)] bg-paper px-2.5 py-1 font-mono text-[11px] text-muted">
      {children}
    </span>
  );
}
