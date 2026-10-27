"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/components/AuthProvider";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/check";
  const {
    configured,
    user,
    loading,
    signInWithPassword,
    signUpWithPassword,
    signInWithGoogle,
    requestPasswordReset,
  } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, next, router, user]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      if (mode === "reset") {
        await requestPasswordReset(email.trim());
        setMessage("Password reset email sent. Use the link to choose a new password on Settings.");
        setMode("signin");
      } else if (mode === "signin") {
        await signInWithPassword(email.trim(), password);
        router.replace(next);
      } else {
        await signUpWithPassword(email.trim(), password);
        setMessage(
          "Account created. If your project requires email confirmation, check your inbox; otherwise you can sign in now.",
        );
        setMode("signin");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md border border-panel-border bg-panel p-6 md:p-8">
      {!configured ? (
        <div className="space-y-3">
          <h1 className="font-display text-3xl text-ink">Auth not configured</h1>
          <p className="text-sm leading-relaxed text-muted">
            Add <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
            <code className="font-mono text-xs">.env</code>, then enable Email and Google providers
            in the Supabase dashboard.
          </p>
          <Link href="/check" className="btn-primary inline-flex">
            Continue without account
          </Link>
        </div>
      ) : (
        <>
          <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">Account</p>
          <h1 className="mt-2 font-display text-3xl text-ink">
            {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {mode === "reset"
              ? "We’ll email a link that opens Settings so you can choose a new password."
              : "Save listing checks to your account. Google sign-in works once Google is enabled in Supabase Auth."}
          </p>

          {mode !== "reset" ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onGoogle()}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-md border border-panel-border bg-paper px-4 py-3 text-sm font-semibold text-ink transition hover:border-accent"
              >
                <GoogleMark />
                Continue with Google
              </button>
              <div className="my-5 flex items-center gap-3 text-xs tracking-wide text-muted uppercase">
                <span className="h-px flex-1 bg-[var(--line)]" />
                or email
                <span className="h-px flex-1 bg-[var(--line)]" />
              </div>
            </>
          ) : (
            <div className="mt-6" />
          )}

          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium tracking-wide text-muted uppercase">Email</span>
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
              />
            </label>
            {mode !== "reset" ? (
              <label className="block space-y-1.5">
                <span className="text-xs font-medium tracking-wide text-muted uppercase">Password</span>
                <input
                  required
                  type="password"
                  minLength={6}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                />
              </label>
            ) : null}
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            {message ? <p className="text-sm text-accent-dim">{message}</p> : null}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy
                ? "Working…"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : "Send reset email"}
            </button>
          </form>

          <div className="mt-4 flex flex-col gap-2 text-sm text-muted">
            {mode === "reset" ? (
              <button
                type="button"
                className="text-left hover:text-ink"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setMessage(null);
                }}
              >
                Back to sign in
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="text-left hover:text-ink"
                  onClick={() => {
                    setMode(mode === "signin" ? "signup" : "signin");
                    setError(null);
                    setMessage(null);
                  }}
                >
                  {mode === "signin"
                    ? "Need an account? Create one"
                    : "Already have an account? Sign in"}
                </button>
                {mode === "signin" ? (
                  <button
                    type="button"
                    className="text-left hover:text-ink"
                    onClick={() => {
                      setMode("reset");
                      setError(null);
                      setMessage(null);
                    }}
                  >
                    Forgot password?
                  </button>
                ) : null}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 36 26.8 37 24 37c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l.0.0 6.2 5.2C39.2 36.1 44 31 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="border-b border-[var(--line)] bg-paper/80 backdrop-blur-sm">
        <SiteHeader />
      </div>
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-start justify-center px-5 py-12 md:px-8 md:py-16">
        <Suspense fallback={<div className="text-sm text-muted">Loading…</div>}>
          <LoginForm />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
