"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Listing } from "@listing-validator/types";
import { useAuth } from "@/components/AuthProvider";
import { api, apiBaseUrl } from "@/lib/api";
import { DEMO_LISTING, DEMO_LISTING_INPUT } from "@/lib/demoListing";

export function Checker() {
  const params = useSearchParams();
  const existingId = params.get("id");
  const isDemo = params.get("demo") === "1";
  const { configured, loading: authLoading, user } = useAuth();
  const [title, setTitle] = useState(isDemo ? DEMO_LISTING_INPUT.title : "");
  const [description, setDescription] = useState(isDemo ? DEMO_LISTING_INPUT.description : "");
  const [price, setPrice] = useState(isDemo ? DEMO_LISTING_INPUT.price : "");
  const [vin, setVin] = useState(isDemo ? DEMO_LISTING_INPUT.vin : "");
  const [sourceUrl, setSourceUrl] = useState(isDemo ? DEMO_LISTING_INPUT.sourceUrl : "");
  const [files, setFiles] = useState<FileList | null>(null);
  const [listing, setListing] = useState<Listing | null>(isDemo ? DEMO_LISTING : null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [storageMode, setStorageMode] = useState<string>("…");
  const [visionMode, setVisionMode] = useState<string>("…");
  const [authMode, setAuthMode] = useState<string>("…");
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    api
      .health()
      .then((h) => {
        setStorageMode(h.storage);
        setVisionMode(h.llmProvider);
        setAuthMode(h.auth);
        setApiError(null);
      })
      .catch((err: unknown) => {
        setStorageMode("unreachable");
        setVisionMode("unknown");
        setAuthMode("unknown");
        setApiError(err instanceof Error ? err.message : "Cannot reach the analysis API.");
      });
  }, []);

  useEffect(() => {
    if (isDemo || !existingId || authLoading) return;
    if (configured && !user) return;
    let cancelled = false;
    api
      .getListing(existingId)
      .then((row) => {
        if (!cancelled) setListing(row);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load listing");
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, configured, existingId, isDemo, user]);

  const listingId = listing?.id;
  const listingStatus = listing?.status;
  useEffect(() => {
    if (isDemo) return;
    if (!listingId || listingStatus === "completed" || listingStatus === "failed") return;
    const id = listingId;
    let cancelled = false;
    async function tick() {
      try {
        const next = await api.getListing(id);
        if (!cancelled) setListing(next);
      } catch {
        /* ignore transient poll errors */
      }
    }
    void tick();
    const timer = setInterval(() => void tick(), 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isDemo, listingId, listingStatus]);

  const fileCount = files?.length ?? 0;

  const scoreColor = useMemo(() => {
    const score = listing?.report?.riskScore;
    if (score == null) return "text-muted";
    if (score >= 60) return "text-danger";
    if (score >= 35) return "text-warn";
    return "text-accent";
  }, [listing]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    setListing(null);
    try {
      if (isDemo) {
        throw new Error("Demo mode is read-only. Clear ?demo=1 or open Check a listing to run a real analysis.");
      }
      if (!files || files.length === 0) {
        throw new Error("Add at least one listing photo.");
      }
      const created = await api.createListing({
        title,
        description,
        price: price ? Number(price) : null,
        vin: vin || null,
        sourceUrl: sourceUrl || null,
      });
      const uploaded = await api.uploadImages(created.id, Array.from(files));
      setListing(uploaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  const needsSignIn = !isDemo && configured && !authLoading && !user && authMode === "required";

  if (needsSignIn) {
    return (
      <div className="border border-panel-border bg-panel p-6 md:p-8">
        <h2 className="font-display text-2xl text-ink">Sign in to check a listing</h2>
        <p className="mt-2 max-w-lg text-sm text-muted">
          When Supabase Auth is enabled, listing checks are saved to your account so you can reopen
          them later.
        </p>
        <Link href="/login?next=/check" className="btn-primary mt-5 inline-flex">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
      <form
        onSubmit={onSubmit}
        className="space-y-4 border border-panel-border bg-panel p-6 md:p-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-4">
          <p className="text-sm font-semibold text-ink">Listing details</p>
          <p className="font-mono text-[11px] tracking-wide text-muted uppercase">
            {storageMode} · {visionMode} · {authMode} · {apiBaseUrl}
          </p>
        </div>
        {apiError ? <p className="text-sm text-danger">{apiError}</p> : null}
        {isDemo ? (
          <p className="text-xs text-muted">
            Demo mode shows a sample report only.{" "}
            <Link href="/check" className="text-accent hover:text-accent-dim">
              Start a real check
            </Link>
            .
          </p>
        ) : null}
        {configured && user ? (
          <p className="text-xs text-muted">
            Signed in as <span className="text-ink">{user.email ?? user.id}</span> — this check will be
            saved to your account.
          </p>
        ) : null}

        <Field label="Listing title">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input-field"
            placeholder="2018 Honda Civic LX — one owner"
          />
        </Field>
        <Field label="Asking price (USD)">
          <input
            type="number"
            min={0}
            step="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="input-field"
            placeholder="14500"
          />
        </Field>
        <Field label="Description">
          <textarea
            required
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input-field resize-y"
            placeholder="Seller description from the marketplace listing…"
          />
        </Field>
        <Field label="VIN (optional)">
          <input
            value={vin}
            onChange={(e) => setVin(e.target.value)}
            className="input-field font-mono uppercase"
            placeholder="1HGCV1F3XJA000000"
            maxLength={17}
          />
        </Field>
        <Field label="Source URL (optional)">
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            className="input-field"
            placeholder="https://…"
          />
        </Field>
        <Field label={`Photos (${fileCount})`}>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(e.target.files)}
            className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent-dim"
          />
        </Field>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "Submitting…" : "Analyze listing"}
        </button>
      </form>

      <section className="border border-panel-border bg-panel p-6 md:p-7">
        {!listing ? (
          <div className="flex h-full min-h-72 flex-col justify-center gap-3">
            <p className="font-display text-2xl text-ink">Report appears here</p>
            <p className="max-w-sm text-sm leading-relaxed text-muted">
              After upload, analysis runs asynchronously. This panel updates until the job
              completes.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] pb-4">
              <div>
                <p className="font-mono text-xs tracking-wider text-muted uppercase">Status</p>
                <p className="mt-1 text-lg capitalize text-ink">{listing.status}</p>
              </div>
              {listing.report ? (
                <div className="text-right">
                  <p className="font-mono text-xs tracking-wider text-muted uppercase">Risk score</p>
                  <p className={`font-display text-5xl tabular-nums ${scoreColor}`}>
                    {listing.report.riskScore}
                  </p>
                </div>
              ) : null}
            </div>

            {listing.error ? <p className="text-sm text-danger">{listing.error}</p> : null}

            {listing.report ? (
              <>
                <p className="text-sm leading-relaxed text-muted">{listing.report.summary}</p>
                <p className="font-mono text-xs text-muted">
                  Confidence {Math.round(listing.report.confidence * 100)}%
                </p>
                <div className="flex flex-wrap gap-2">
                  <MetaChip>History not checked</MetaChip>
                  <MetaChip>Title not verified</MetaChip>
                  {listing.report.recalls.checked ? (
                    <MetaChip>
                      Recalls: {listing.report.recalls.count}
                      {listing.report.recalls.parkIt ? " · PARK IT" : ""}
                    </MetaChip>
                  ) : null}
                </div>
                {listing.report.vinMatch.checked ? (
                  <div className="space-y-2 border-t border-[var(--line)] pt-4">
                    <p className="text-sm text-ink">
                      VIN{" "}
                      {listing.report.vinMatch.matchesListing
                        ? "agrees with the listing text"
                        : listing.report.vinMatch.matchesListing === false
                          ? "conflicts with the listing text"
                          : "was decoded"}
                      {listing.report.vinMatch.decoded
                        ? ` · ${[
                            listing.report.vinMatch.decoded.modelYear,
                            listing.report.vinMatch.decoded.make,
                            listing.report.vinMatch.decoded.model,
                            listing.report.vinMatch.decoded.trim,
                          ]
                            .filter(Boolean)
                            .join(" ")}`
                        : ""}
                    </p>
                    {listing.report.vinMatch.decoded ? (
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted sm:grid-cols-3">
                        {(
                          [
                            ["Body", listing.report.vinMatch.decoded.bodyClass],
                            ["Drive", listing.report.vinMatch.decoded.driveType],
                            ["Doors", listing.report.vinMatch.decoded.doors],
                            ["Fuel", listing.report.vinMatch.decoded.fuelType],
                            ["Engine", listing.report.vinMatch.decoded.displacementL
                              ? `${listing.report.vinMatch.decoded.displacementL}L`
                              : null],
                            ["Trans", listing.report.vinMatch.decoded.transmission],
                          ] as const
                        )
                          .filter(([, value]) => Boolean(value))
                          .map(([label, value]) => (
                            <div key={label}>
                              <dt className="font-mono uppercase tracking-wide">{label}</dt>
                              <dd className="text-ink">{value}</dd>
                            </div>
                          ))}
                      </dl>
                    ) : null}
                    <p className="text-xs text-muted">
                      Paint color is not in the VIN — color checks come from listing text vs photos.
                    </p>
                  </div>
                ) : null}
                {listing.report.attributeChecks?.length ? (
                  <ul className="space-y-2">
                    <p className="font-mono text-xs tracking-wider text-muted uppercase">
                      VIN / photo attribute checks
                    </p>
                    {listing.report.attributeChecks.map((check) => (
                      <li
                        key={`${check.attribute}-${check.expected ?? "none"}`}
                        className="border border-panel-border px-3 py-2.5 text-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs uppercase text-accent">{check.attribute}</span>
                          <span className="font-mono text-xs uppercase text-muted">
                            text:{" "}
                            {check.listingMatch === true
                              ? "match"
                              : check.listingMatch === false
                                ? "conflict"
                                : "n/a"}
                          </span>
                          <span className="font-mono text-xs uppercase text-warn">
                            photos: {check.photoEvidence}
                          </span>
                        </div>
                        <p className="text-ink">
                          Expected: {check.expected ?? "—"}{" "}
                          <span className="text-muted">({check.source})</span>
                        </p>
                        <p className="text-muted">{check.detail}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {listing.report.imageFindings?.length ? (
                  <ul className="space-y-1 border-t border-[var(--line)] pt-4">
                    {listing.report.imageFindings.map((line) => (
                      <li key={line} className="text-sm text-muted">
                        {line}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {listing.report.claimChecks.length ? (
                  <ul className="space-y-2">
                    {listing.report.claimChecks.map((check) => (
                      <li key={check.claim} className="border border-panel-border px-3 py-2.5 text-sm">
                        <span className="font-mono text-xs uppercase text-accent">{check.verdict}</span>
                        <p className="text-ink">{check.claim}</p>
                        <p className="text-muted">{check.detail}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {listing.report.flags.length ? (
                  <ul className="space-y-2">
                    {listing.report.flags.map((flag) => (
                      <li key={flag.code} className="border border-panel-border px-3 py-2.5 text-sm">
                        <span className="font-mono text-xs uppercase text-warn">{flag.severity}</span>
                        <p className="text-ink">{flag.message}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">No heuristic flags raised.</p>
                )}
                <p className="text-xs leading-relaxed text-muted">{listing.report.disclaimer}</p>
              </>
            ) : (
              <p className="animate-pulse text-sm text-muted">Running analysis…</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium tracking-wide text-muted uppercase">{label}</span>
      {children}
    </label>
  );
}

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="border border-panel-border bg-paper px-2.5 py-1 font-mono text-[11px] text-muted">
      {children}
    </span>
  );
}
