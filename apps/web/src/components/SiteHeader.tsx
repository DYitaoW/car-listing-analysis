"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export function SiteHeader({ tone = "light" }: { tone?: "light" | "on-hero" }) {
  const onHero = tone === "on-hero";
  const { configured, loading, user } = useAuth();

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
          href="/#demo"
          className={`hidden text-sm font-medium sm:inline ${
            onHero ? "text-white/80 hover:text-white" : "text-muted hover:text-ink"
          }`}
        >
          Demo
        </Link>
        {configured && user ? (
          <>
            <Link
              href="/listings"
              className={`hidden text-sm font-medium sm:inline ${
                onHero ? "text-white/80 hover:text-white" : "text-muted hover:text-ink"
              }`}
            >
              My listings
            </Link>
            <Link
              href="/settings"
              className={`hidden text-sm font-medium sm:inline ${
                onHero ? "text-white/80 hover:text-white" : "text-muted hover:text-ink"
              }`}
            >
              Settings
            </Link>
          </>
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
            <Link
              href="/settings"
              className={`text-sm font-medium md:hidden ${
                onHero ? "text-white/80 hover:text-white" : "text-muted hover:text-ink"
              }`}
            >
              Account
            </Link>
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
