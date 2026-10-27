"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export function SiteHeader({ tone = "light" }: { tone?: "light" | "on-hero" }) {
  const onHero = tone === "on-hero";
  const { configured, loading, user, signOut } = useAuth();

  return (
    <header
      className={`relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 md:px-8 ${
        onHero ? "text-white" : "text-ink"
      }`}
    >
      <Link href="/" className="group flex items-baseline gap-2">
        <span className="font-display text-2xl tracking-tight md:text-[1.7rem]">SignalCheck</span>
        <span
          className={`hidden font-mono text-[10px] tracking-[0.18em] uppercase sm:inline ${
            onHero ? "text-white/70" : "text-muted"
          }`}
        >
          listing risk
        </span>
      </Link>
      <nav className="flex items-center gap-2 sm:gap-3">
        <Link
          href="/#how-it-works"
          className={`hidden text-sm font-medium sm:inline ${
            onHero ? "text-white/80 hover:text-white" : "text-muted hover:text-ink"
          }`}
        >
          How it works
        </Link>
        {configured && user ? (
          <Link
            href="/listings"
            className={`hidden text-sm font-medium sm:inline ${
              onHero ? "text-white/80 hover:text-white" : "text-muted hover:text-ink"
            }`}
          >
            My listings
          </Link>
        ) : null}
        <Link
          href="/check"
          className={
            onHero
              ? "rounded-md border border-white/35 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/18"
              : "btn-primary !px-3.5 !py-2 text-sm"
          }
        >
          Check a listing
        </Link>
        {configured && !loading ? (
          user ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className={`hidden text-sm font-medium md:inline ${
                onHero ? "text-white/80 hover:text-white" : "text-muted hover:text-ink"
              }`}
              title={user.email ?? user.id}
            >
              Sign out
            </button>
          ) : (
            <Link
              href="/login"
              className={`text-sm font-semibold ${
                onHero ? "text-white hover:text-white/85" : "text-accent hover:text-accent-dim"
              }`}
            >
              Sign in
            </Link>
          )
        ) : null}
      </nav>
    </header>
  );
}
