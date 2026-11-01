"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Listing } from "@listing-validator/types";
import { useAuth } from "@/components/AuthProvider";
import { ReportView } from "@/components/ReportView";
import { api, apiBaseUrl } from "@/lib/api";
import { DEMO_LISTING, DEMO_LISTING_INPUT } from "@/lib/demoListing";
import { isTerminal } from "@/lib/report";

export function Checker() {
  const router = useRouter();
  const params = useSearchParams();
  const existingId = params.get("id");
  const isDemo = params.get("demo") === "1";
  const { configured, loading: authLoading, user } = useAuth();

  const [title, setTitle] = useState(isDemo ? DEMO_LISTING_INPUT.title : "");
  const [description, setDescription] = useState(isDemo ? DEMO_LISTING_INPUT.description : "");
  const [price, setPrice] = useState(isDemo ? DEMO_LISTING_INPUT.price : "");
  const [vin, setVin] = useState(isDemo ? DEMO_LISTING_INPUT.vin : "");
  const [sourceUrl, setSourceUrl] = useState(isDemo ? DEMO_LISTING_INPUT.sourceUrl : "");
  const [files, setFiles] = useState<File[]>([]);
  const [listing, setListing] = useState<Listing | null>(isDemo ? DEMO_LISTING : null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [storageMode, setStorageMode] = useState("…");
  const [visionMode, setVisionMode] = useState("…");
  const [authMode, setAuthMode] = useState("…");
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
    if (!listingId || isTerminal(listing)) return;
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
  }, [isDemo, listing, listingId, listingStatus]);

  useEffect(() => {
    if (isDemo || !listing || listing.id === "demo-listing") return;
    if (listing.status === "completed") {
      router.push(`/report/${listing.id}`);
    }
  }, [isDemo, listing, router]);

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const next = Array.from(list).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [...prev, ...next].slice(0, 12));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    setListing(null);
    try {
      if (isDemo) {
        throw new Error("Demo mode is read-only. Open Check a listing without ?demo=1.");
      }
      if (files.length === 0) {
        throw new Error("Add at least one listing photo.");
      }
      const created = await api.createListing({
        title,
        description,
        price: price ? Number(price) : null,
        vin: vin || null,
        sourceUrl: sourceUrl || null,
      });
      const uploaded = await api.uploadImages(created.id, files);
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
      <div className="border border-[var(--line)] bg-panel p-8">
        <h2 className="font-display text-2xl text-ink">Sign in to check a listing</h2>
        <p className="mt-2 max-w-lg text-sm text-muted">
          Listing checks are saved to your account so you can reopen them under My checks.
        </p>
        <Link href="/login?next=/check" className="btn-primary mt-5 inline-flex">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] pb-4">
          <div>
            <p className="font-mono text-xs tracking-[0.18em] text-accent uppercase">Intake</p>
            <h2 className="mt-2 font-display text-2xl text-ink">Listing details</h2>
          </div>
          <p className="font-mono text-[10px] tracking-wide text-muted uppercase">
            {storageMode} · {visionMode}
          </p>
        </div>

        {apiError ? <p className="text-sm text-danger">{apiError}</p> : null}
        {isDemo ? (
          <p className="text-sm text-muted">
            Demo mode is read-only.{" "}
            <Link href="/check" className="text-accent hover:text-accent-dim">
              Start a real check
            </Link>
            .
          </p>
        ) : null}
        {configured && user ? (
          <p className="text-xs text-muted">
            Signed in as <span className="text-ink">{user.email ?? user.id}</span>
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
              placeholder="Paste the seller description…"
            />
          </Field>
          <Field label="Source URL (optional)" className="sm:col-span-2">
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className="input-field"
              placeholder="https://…"
            />
          </Field>
        </div>

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
            dragOver ? "border-accent bg-accent-soft/40" : "border-[var(--line)] bg-paper/70"
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
          <p className="mt-1 text-sm text-muted">Up to 12 images from the marketplace post</p>
          <button
            type="button"
            className="btn-secondary mt-4 !py-2 text-sm"
            onClick={() => fileInputRef.current?.click()}
          >
            Choose photos ({files.length})
          </button>
          {files.length ? (
            <ul className="mt-4 space-y-1 text-xs text-muted">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3">
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    className="text-accent hover:text-accent-dim"
                    onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
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

      <section className="border border-[var(--line)] bg-panel/90 p-6 md:sticky md:top-6 md:self-start md:p-7">
        {!listing ? (
          <div className="flex min-h-72 flex-col justify-center gap-3">
            <p className="font-mono text-xs tracking-[0.18em] text-accent uppercase">Preview</p>
            <p className="font-display text-3xl text-ink">Report builds here</p>
            <p className="max-w-sm text-sm leading-relaxed text-muted">
              After you submit, analysis runs in the background. Completed checks open on a dedicated
              results page.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <ReportView listing={listing} compact />
            {!isDemo && listing.id !== "demo-listing" ? (
              <Link href={`/report/${listing.id}`} className="btn-secondary w-full !py-2 text-sm">
                Open full results
              </Link>
            ) : null}
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
