"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ListingSummary } from "@listing-validator/types";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";

export default function MyListingsPage() {
  const { configured, loading, user } = useAuth();
  const [items, setItems] = useState<ListingSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (configured && !user) {
      setBusy(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await api.listListings();
        if (!cancelled) setItems(rows);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load listings");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configured, loading, user]);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="border-b border-[var(--line)] bg-paper/80 backdrop-blur-sm">
        <SiteHeader />
      </div>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-5 py-10 md:px-8 md:py-14">
        <header className="max-w-2xl">
          <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">Saved work</p>
          <h1 className="mt-3 font-display text-4xl tracking-tight text-ink md:text-5xl">
            My listings
          </h1>
          <p className="mt-3 text-base text-muted">
            Checks you ran while signed in stay attached to your account.
          </p>
        </header>

        {configured && !loading && !user ? (
          <div className="border border-panel-border bg-panel p-6">
            <p className="text-ink">Sign in to see your saved listings.</p>
            <Link href="/login?next=/listings" className="btn-primary mt-4 inline-flex">
              Sign in
            </Link>
          </div>
        ) : null}

        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {busy ? <p className="text-sm text-muted">Loading…</p> : null}

        {!busy && user ? (
          items.length === 0 ? (
            <div className="border border-panel-border bg-panel p-6">
              <p className="text-ink">No saved listings yet.</p>
              <Link href="/check" className="btn-primary mt-4 inline-flex">
                Check a listing
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--line)] border border-panel-border bg-panel">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/check?id=${item.id}`}
                    className="flex flex-col gap-1 px-5 py-4 transition hover:bg-paper sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-ink">{item.title}</p>
                      <p className="font-mono text-xs text-muted uppercase">
                        {item.status}
                        {item.price != null ? ` · $${Math.round(item.price)}` : ""}
                      </p>
                    </div>
                    <p className="font-display text-2xl text-accent">
                      {item.riskScore == null ? "—" : item.riskScore}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
