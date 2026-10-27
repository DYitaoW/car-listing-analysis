"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/components/AuthProvider";

function SettingsBody() {
  const router = useRouter();
  const params = useSearchParams();
  const resetMode = params.get("reset") === "1";
  const {
    configured,
    loading,
    user,
    identities,
    signOut,
    requestPasswordReset,
    updatePassword,
    deleteAccount,
  } = useAuth();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && configured && !user) {
      router.replace("/login?next=/settings");
    }
  }, [configured, loading, router, user]);

  useEffect(() => {
    if (user?.email) setResetEmail(user.email);
  }, [user]);

  async function onUpdatePassword(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      setPassword("");
      setConfirm("");
      setMessage("Password updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setBusy(false);
    }
  }

  async function onResetEmail(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await requestPasswordReset(resetEmail);
      setMessage("Password reset email sent. Check your inbox.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    const ok = window.confirm(
      "Delete your account and all saved listings? This cannot be undone.",
    );
    if (!ok) return;
    setError(null);
    setBusy(true);
    try {
      await deleteAccount();
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete account");
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <div className="border border-panel-border bg-panel p-6">
        <h1 className="font-display text-3xl text-ink">Account settings</h1>
        <p className="mt-3 text-sm text-muted">
          Supabase Auth is not configured, so there is no account to manage yet.
        </p>
      </div>
    );
  }

  if (loading || !user) {
    return <p className="text-sm text-muted">Loading account…</p>;
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <header>
        <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">Account</p>
        <h1 className="mt-3 font-display text-4xl tracking-tight text-ink">Settings</h1>
        <p className="mt-3 text-sm text-muted">
          Manage sign-in for {user.email ?? user.id}. Reports always note that history and title were
          not checked.
        </p>
      </header>

      <section className="space-y-3 border border-panel-border bg-panel p-6">
        <h2 className="text-lg font-semibold text-ink">Profile</h2>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-mono text-[11px] tracking-wide text-muted uppercase">Email</dt>
            <dd className="mt-1 text-ink">{user.email ?? "No email on file"}</dd>
          </div>
          <div>
            <dt className="font-mono text-[11px] tracking-wide text-muted uppercase">Sign-in methods</dt>
            <dd className="mt-1 text-ink">
              {identities.length ? identities.join(", ") : "email"}
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2 pt-2">
          <Link href="/listings" className="btn-secondary !py-2 text-sm">
            My listings
          </Link>
          <button
            type="button"
            className="btn-secondary !py-2 text-sm"
            onClick={() => void signOut().then(() => router.push("/"))}
          >
            Sign out
          </button>
        </div>
      </section>

      <section className="space-y-4 border border-panel-border bg-panel p-6">
        <h2 className="text-lg font-semibold text-ink">
          {resetMode ? "Choose a new password" : "Password"}
        </h2>
        <form onSubmit={onUpdatePassword} className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium tracking-wide text-muted uppercase">
              New password
            </span>
            <input
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              autoComplete="new-password"
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium tracking-wide text-muted uppercase">
              Confirm password
            </span>
            <input
              type="password"
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input-field"
              autoComplete="new-password"
              required
            />
          </label>
          <button type="submit" disabled={busy} className="btn-primary">
            Update password
          </button>
        </form>

        <form onSubmit={onResetEmail} className="space-y-3 border-t border-[var(--line)] pt-4">
          <p className="text-sm text-muted">
            Or email yourself a reset link (uses Supabase Auth email templates).
          </p>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium tracking-wide text-muted uppercase">Email</span>
            <input
              type="email"
              required
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              className="input-field"
            />
          </label>
          <button type="submit" disabled={busy} className="btn-secondary !py-2 text-sm">
            Send reset email
          </button>
        </form>
      </section>

      <section className="space-y-3 border border-danger/30 bg-panel p-6">
        <h2 className="text-lg font-semibold text-danger">Delete account</h2>
        <p className="text-sm text-muted">
          Removes your saved listings from SignalCheck and deletes your Supabase Auth user when the
          service role key is configured.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onDelete()}
          className="rounded-md border border-danger bg-transparent px-4 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger hover:text-white"
        >
          Delete my account
        </button>
      </section>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {message ? <p className="text-sm text-accent-dim">{message}</p> : null}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="border-b border-[var(--line)] bg-paper/80 backdrop-blur-sm">
        <SiteHeader />
      </div>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-10 md:px-8 md:py-14">
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          <SettingsBody />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
