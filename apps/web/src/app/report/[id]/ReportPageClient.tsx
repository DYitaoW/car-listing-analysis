"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Listing } from "@listing-validator/types";
import { useAuth } from "@/components/AuthProvider";
import { ReportView } from "@/components/ReportView";
import { api } from "@/lib/api";
import { DEMO_LISTING } from "@/lib/demoListing";
import { isTerminal } from "@/lib/report";

export function ReportPageClient({ id }: { id: string }) {
  const { configured, loading: authLoading, user } = useAuth();
  const isDemo = id === "demo" || id === "demo-listing";
  const [listing, setListing] = useState<Listing | null>(isDemo ? DEMO_LISTING : null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemo || authLoading) return;
    if (configured && !user) return;
    let cancelled = false;
    api
      .getListing(id)
      .then((row) => {
        if (!cancelled) setListing(row);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load report");
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, configured, id, isDemo, user]);

  useEffect(() => {
    if (isDemo || !listing || isTerminal(listing)) return;
    const listingId = listing.id;
    let cancelled = false;
    const timer = setInterval(() => {
      void api
        .getListing(listingId)
        .then((next) => {
          if (!cancelled) setListing(next);
        })
        .catch(() => undefined);
    }, 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isDemo, listing]);

  if (configured && !authLoading && !user && !isDemo) {
    return (
      <div className="border border-[var(--line)] bg-panel p-6">
        <p className="text-ink">Sign in to view this saved report.</p>
        <Link href={`/login?next=/report/${id}`} className="btn-primary mt-4 inline-flex">
          Sign in
        </Link>
      </div>
    );
  }

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!listing) return <p className="text-sm text-muted">Loading report…</p>;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <section className="border border-[var(--line)] bg-panel p-6 md:p-8">
        <ReportView listing={listing} />
      </section>
      <aside className="space-y-4 md:sticky md:top-6 md:self-start">
        <div className="border border-[var(--line)] bg-panel p-5">
          <p className="font-mono text-xs tracking-[0.18em] text-accent uppercase">Next steps</p>
          <ul className="mt-4 space-y-3 text-sm text-muted">
            <li>Compare the score and flags with what you see in person.</li>
            <li>Run a title search and mechanic inspection separately — SignalCheck does neither.</li>
            <li>If the VIN looks wrong for the photos, walk away.</li>
          </ul>
          <div className="mt-5 flex flex-col gap-2">
            <Link href="/check" className="btn-primary w-full">
              Check another listing
            </Link>
            <Link href="/checks" className="btn-secondary w-full">
              Back to My checks
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
