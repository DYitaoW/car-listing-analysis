"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Listing } from "@listing-validator/types";
import { useAuth } from "@/components/AuthProvider";
import { api, apiBaseUrl } from "@/lib/api";
import { DEMO_LISTING, DEMO_LISTING_INPUT } from "@/lib/demoListing";

type IntakeMode = "link" | "manual";

export function Checker() {
  const params = useSearchParams();
  const existingId = params.get("id");
  const isDemo = params.get("demo") === "1";
  const { configured, loading: authLoading, user } = useAuth();

  const [mode, setMode] = useState<IntakeMode>("link");
  const [marketplaceUrl, setMarketplaceUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importedImageUrls, setImportedImageUrls] = useState<string[]>([]);

  const [title, setTitle] = useState(isDemo ? DEMO_LISTING_INPUT.title : "");
  const [description, setDescription] = useState(isDemo ? DEMO_LISTING_INPUT.description : "");
  const [price, setPrice] = useState(isDemo ? DEMO_LISTING_INPUT.price : "");
  const [vin, setVin] = useState(isDemo ? DEMO_LISTING_INPUT.vin : "");
  const [sourceUrl, setSourceUrl] = useState(isDemo ? DEMO_LISTING_INPUT.sourceUrl : "");
  const [files, setFiles] = useState<File[]>([]);
  const [listing, setListing] = useState<Listing | null>(isDemo ? DEMO_LISTING : null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [storageMode, setStorageMode] = useState<string>("…");
  const [visionMode, setVisionMode] = useState<string>("…");
  const [authMode, setAuthMode] = useState<string>("…");
  const [apiError, setApiError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const previewUrls = useMemo(
    () => files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })),
    [files],
  );

  useEffect(() => {
    return () => {
      for (const item of previewUrls) URL.revokeObjectURL(item.url);
    };
  }, [previewUrls]);

  const scoreColor = useMemo(() => {
    const score = listing?.report?.riskScore;
    if (score == null) return "text-muted";
    if (score >= 60) return "text-danger";
    if (score >= 35) return "text-warn";
    return "text-accent";
  }, [listing]);

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const next = Array.from(list).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => {
      const merged = [...prev, ...next];
      return merged.slice(0, 12);
    });
  }

  async function onImportMarketplace(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setImportWarnings([]);
    setImporting(true);
    try {
      const draft = await api.importMarketplace({ url: marketplaceUrl.trim() });
      setTitle(draft.title);
      setDescription(draft.description);
      setPrice(draft.price != null ? String(Math.round(draft.price)) : "");
      setVin(draft.vin ?? "");
      setSourceUrl(draft.sourceUrl);
      setImportedImageUrls(draft.imageUrls);
      setImportWarnings(draft.warnings);
      setMode("manual");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import that Marketplace link");
    } finally {
      setImporting(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    setListing(null);
    try {
      if (isDemo) {
        throw new Error(
          "Demo mode is read-only. Clear ?demo=1 or open Check a listing to run a real analysis.",
        );
      }
      const hasLocalPhotos = files.length > 0;
      const hasRemotePhotos = importedImageUrls.length > 0;
      if (!hasLocalPhotos && !hasRemotePhotos) {
        throw new Error("Add listing photos, or import a Marketplace link that includes photos.");
      }
      const created = await api.createListing({
        title,
        description,
        price: price ? Number(price) : null,
        vin: vin || null,
        sourceUrl: sourceUrl || null,
      });
      let next: Listing;
      if (hasLocalPhotos) {
        next = await api.uploadImages(created.id, files);
      } else {
        next = await api.uploadImagesFromUrls(created.id, importedImageUrls);
      }
      setListing(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  const needsSignIn = !isDemo && configured && !authLoading && !user && authMode === "required";

  if (needsSignIn) {
    return (
      <div className="border border-[var(--line)] bg-panel/90 p-8 md:p-10">
        <p className="font-mono text-xs tracking-[0.18em] text-accent uppercase">Account required</p>
        <h2 className="mt-3 font-display text-3xl text-ink">Sign in to check a listing</h2>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
          Listing checks are saved to your account so you can reopen them later from My listings.
        </p>
        <Link href="/login?next=/check" className="btn-primary mt-6 inline-flex">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs tracking-[0.18em] text-accent uppercase">Intake</p>
            <h2 className="mt-2 font-display text-2xl tracking-tight text-ink md:text-3xl">
              Add a vehicle listing
            </h2>
          </div>
          <p className="font-mono text-[10px] tracking-wide text-muted uppercase">
            {storageMode} · {visionMode}
          </p>
        </div>

        {apiError ? <p className="text-sm text-danger">{apiError}</p> : null}
        {isDemo ? (
          <p className="text-sm text-muted">
            Demo mode shows a sample report only.{" "}
            <Link href="/check" className="text-accent hover:text-accent-dim">
              Start a real check
            </Link>
            .
          </p>
        ) : null}

        <div className="flex gap-1 border-b border-[var(--line)]">
          {(
            [
              ["link", "Facebook link"],
              ["manual", "Enter details"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`relative px-4 py-3 text-sm font-semibold transition ${
                mode === id ? "text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {label}
              {mode === id ? (
                <span className="absolute inset-x-3 -bottom-px h-0.5 bg-accent" aria-hidden />
              ) : null}
            </button>
          ))}
        </div>

        {mode === "link" ? (
          <form onSubmit={onImportMarketplace} className="space-y-4">
            <div className="relative overflow-hidden border border-[var(--line)] bg-panel px-5 py-6 md:px-6 md:py-7">
              <div
                className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-accent/10 blur-2xl"
                aria-hidden
              />
              <p className="text-sm leading-relaxed text-muted">
                Paste a public Facebook Marketplace vehicle listing. We pull title, price,
                description, VIN (if present), and photo URLs when Facebook exposes them.
              </p>
              <label className="mt-5 block space-y-2">
                <span className="text-xs font-medium tracking-wide text-muted uppercase">
                  Marketplace URL
                </span>
                <input
                  required
                  type="url"
                  value={marketplaceUrl}
                  onChange={(e) => setMarketplaceUrl(e.target.value)}
                  className="input-field"
                  placeholder="https://www.facebook.com/marketplace/item/…"
                  disabled={isDemo}
                />
              </label>
              <button
                type="submit"
                disabled={importing || isDemo}
                className="btn-primary mt-4 w-full sm:w-auto"
              >
                {importing ? "Extracting…" : "Extract listing details"}
              </button>
              <p className="mt-4 text-xs leading-relaxed text-muted">
                Facebook often serves login walls to automated fetches. If fields come back empty,
                switch to Enter details and paste the seller copy yourself.
              </p>
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
          </form>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            {importWarnings.length ? (
              <ul className="space-y-1 border border-warn/30 bg-[#fff8f0] px-4 py-3 text-sm text-warn">
                {importWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}

            {configured && user ? (
              <p className="text-xs text-muted">
                Signed in as <span className="text-ink">{user.email ?? user.id}</span> — this check
                saves to your account.
              </p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Listing title" className="sm:col-span-2">
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
              <Field label="VIN (optional)">
                <input
                  value={vin}
                  onChange={(e) => setVin(e.target.value)}
                  className="input-field font-mono uppercase"
                  placeholder="1HGCV1F3XJA000000"
                  maxLength={17}
                />
              </Field>
              <Field label="Seller description" className="sm:col-span-2">
                <textarea
                  required
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-field resize-y"
                  placeholder="Paste the seller description from the listing…"
                />
              </Field>
              <Field label="Source URL" className="sm:col-span-2">
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  className="input-field"
                  placeholder="https://www.facebook.com/marketplace/item/…"
                />
              </Field>
            </div>

            {importedImageUrls.length ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium tracking-wide text-muted uppercase">
                    Photos from Marketplace ({importedImageUrls.length})
                  </p>
                  <button
                    type="button"
                    className="text-xs font-semibold text-accent hover:text-accent-dim"
                    onClick={() => setImportedImageUrls([])}
                  >
                    Clear imported
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {importedImageUrls.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={url}
                      src={url}
                      alt=""
                      className="aspect-[4/3] w-full object-cover bg-mist"
                      referrerPolicy="no-referrer"
                    />
                  ))}
                </div>
                <p className="text-xs text-muted">
                  These will be downloaded by the API when you analyze. Upload your own copies below
                  if the thumbnails fail to load.
                </p>
              </div>
            ) : null}

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                addFiles(e.dataTransfer.files);
              }}
              className={`border border-dashed px-5 py-8 transition ${
                dragOver
                  ? "border-accent bg-accent-soft/40"
                  : "border-[var(--line)] bg-paper/70 hover:border-accent/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <p className="text-sm font-semibold text-ink">Drop listing photos here</p>
              <p className="mt-1 text-sm text-muted">or choose files from your device (up to 12)</p>
              <button
                type="button"
                className="btn-secondary mt-4 !py-2 text-sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose photos
              </button>
              {files.length ? (
                <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {previewUrls.map((item, index) => (
                    <div key={item.url} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.url}
                        alt={item.name}
                        className="aspect-[4/3] w-full object-cover bg-mist"
                      />
                      <button
                        type="button"
                        aria-label={`Remove ${item.name}`}
                        className="absolute right-1 top-1 bg-ink/80 px-1.5 py-0.5 text-[10px] font-semibold text-white"
                        onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <button type="submit" disabled={submitting || isDemo} className="btn-primary w-full">
              {submitting ? "Starting analysis…" : "Analyze listing"}
            </button>
            <p className="text-center font-mono text-[10px] tracking-wide text-muted uppercase">
              Proxy {apiBaseUrl}
            </p>
          </form>
        )}
      </div>

      <section className="border border-[var(--line)] bg-panel/90 p-6 md:sticky md:top-6 md:self-start md:p-7">
        {!listing ? (
          <div className="flex min-h-80 flex-col justify-center gap-3">
            <p className="font-mono text-xs tracking-[0.18em] text-accent uppercase">Report</p>
            <p className="font-display text-3xl text-ink">Waiting for a listing</p>
            <p className="max-w-sm text-sm leading-relaxed text-muted">
              Import a Marketplace link or enter details, then analyze. This panel updates while the
              job runs.
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
                        ]
                          .filter(Boolean)
                          .join(" ")}`
                      : ""}
                  </p>
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
                      <li key={check.claim} className="border border-[var(--line)] px-3 py-2.5 text-sm">
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
                      <li key={flag.code} className="border border-[var(--line)] px-3 py-2.5 text-sm">
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

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="text-xs font-medium tracking-wide text-muted uppercase">{label}</span>
      {children}
    </label>
  );
}

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="border border-[var(--line)] bg-paper px-2.5 py-1 font-mono text-[11px] text-muted">
      {children}
    </span>
  );
}
