"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ListingSummary } from "@listing-validator/types";
import { useAuth } from "@/components/AuthProvider";
import { StatusPill } from "@/components/StatusPill";
import { api } from "@/lib/api";
import { formatPrice, scoreClassName } from "@/lib/report";

export function ChecksList() {
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
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load checks");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configured, loading, user]);

  if (configured && !loading && !user) {
    return (
      <div className="border border-[var(--line)] bg-panel p-6 md:p-8">
        <h2 className="font-display text-2xl text-ink">Sign in to see My checks</h2>
        <p className="mt-2 max-w-lg text-sm text-muted">
          When Supabase Auth is enabled, completed analyses are saved to your account.
        </p>
        <Link href="/login?next=/checks" className="btn-primary mt-5 inline-flex">
          Sign in
        </Link>
      </div>
    );
  }

  if (busy) return <p className="text-sm text-muted">Loading checks…</p>;
  if (error) return <p className="text-sm text-danger">{error}</p>;

  if (items.length === 0) {
    return (
      <div className="border border-[var(--line)] bg-panel p-6 md:p-8">
        <h2 className="font-display text-2xl text-ink">No checks yet</h2>
        <p className="mt-2 text-sm text-muted">Run your first listing analysis to populate this list.</p>
        <Link href="/check" className="btn-primary mt-5 inline-flex">
          Check a listing
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[var(--line)] border border-[var(--line)] bg-panel">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/report/${item.id}`}
            className="flex flex-col gap-3 px-5 py-4 transition hover:bg-paper sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={item.status} />
                <span className="font-mono text-xs text-muted">{formatPrice(item.price)}</span>
              </div>
              <p className="mt-2 truncate font-semibold text-ink">{item.title}</p>
              <p className="mt-1 font-mono text-[11px] text-muted">
                {new Date(item.updatedAt).toLocaleString()}
              </p>
            </div>
            <p className={`font-display text-3xl tabular-nums ${scoreClassName(item.riskScore)}`}>
              {item.riskScore == null ? "—" : item.riskScore}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
