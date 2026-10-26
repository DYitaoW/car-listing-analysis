"use client";

import { useEffect, useMemo, useState } from "react";
import type { Listing } from "@listing-validator/types";
import { api } from "@/lib/api";

export default function HomePage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [vin, setVin] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [storageMode, setStorageMode] = useState<string>("…");

  useEffect(() => {
    api
      .health()
      .then((h) => setStorageMode(h.storage))
      .catch(() => setStorageMode("unreachable"));
  }, []);

  useEffect(() => {
    if (!listing || listing.status === "completed" || listing.status === "failed") return;
    const id = listing.id;
    const timer = setInterval(async () => {
      try {
        const next = await api.getListing(id);
        setListing(next);
      } catch {
        /* ignore transient poll errors */
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [listing]);

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

  return (
    <main className="grid-overlay relative flex-1">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-5 py-12 md:py-16">
        <header className="space-y-4">
          <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">SignalCheck</p>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Check a vehicle listing before you trust it.
          </h1>
          <p className="max-w-xl text-base text-muted md:text-lg">
            Paste the seller&apos;s copy, upload their photos, and get risk signals for photo↔text
            mismatches, VIN specs, and open recalls. Not a Carfax. Not a certified inspection.
          </p>
          <p className="font-mono text-xs text-muted">
            Storage: <span className="text-accent">{storageMode}</span> · API{" "}
            {process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:43124"}
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-2">
          <form
            onSubmit={onSubmit}
            className="space-y-4 rounded-2xl border border-panel-border bg-panel/80 p-6 backdrop-blur"
          >
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
                className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-accent-dim file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
              />
            </Field>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-[#04140c] transition hover:brightness-110 disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Analyze listing"}
            </button>
          </form>

          <section className="rounded-2xl border border-panel-border bg-panel/80 p-6 backdrop-blur">
            {!listing ? (
              <div className="flex h-full min-h-72 flex-col justify-center gap-3 text-muted">
                <p className="text-lg text-foreground">Report appears here</p>
                <p className="text-sm">
                  After upload, analysis runs asynchronously. Polling updates this panel until the
                  job completes.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-wider text-muted">Status</p>
                    <p className="text-lg capitalize text-foreground">{listing.status}</p>
                  </div>
                  {listing.report ? (
                    <div className="text-right">
                      <p className="font-mono text-xs uppercase tracking-wider text-muted">
                        Risk score
                      </p>
                      <p className={`text-4xl font-semibold tabular-nums ${scoreColor}`}>
                        {listing.report.riskScore}
                      </p>
                    </div>
                  ) : null}
                </div>

                {listing.error ? <p className="text-sm text-danger">{listing.error}</p> : null}

                {listing.report ? (
                  <>
                    <p className="text-sm text-muted">{listing.report.summary}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge>History not checked</Badge>
                      <Badge>Title not verified</Badge>
                      {listing.report.recalls.checked ? (
                        <Badge>
                          Recalls: {listing.report.recalls.count}
                          {listing.report.recalls.parkIt ? " · PARK IT" : ""}
                        </Badge>
                      ) : null}
                    </div>
                    {listing.report.flags.length ? (
                      <ul className="space-y-2">
                        {listing.report.flags.map((flag) => (
                          <li
                            key={flag.code}
                            className="rounded-lg border border-panel-border px-3 py-2 text-sm"
                          >
                            <span className="font-mono text-xs uppercase text-warn">
                              {flag.severity}
                            </span>
                            <p className="text-foreground">{flag.message}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted">No heuristic flags raised.</p>
                    )}
                    <p className="text-xs text-muted">{listing.report.disclaimer}</p>
                  </>
                ) : (
                  <p className="animate-pulse text-sm text-muted">Running analysis…</p>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
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

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-panel-border px-2.5 py-1 font-mono text-[11px] text-muted">
      {children}
    </span>
  );
}
