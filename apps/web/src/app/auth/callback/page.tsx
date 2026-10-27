"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setError("Supabase Auth is not configured.");
      return;
    }

    let cancelled = false;
    (async () => {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
        window.location.href,
      );
      if (cancelled) return;
      if (exchangeError) {
        // Hash-based sessions from some providers are already handled by detectSessionInUrl.
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setError(exchangeError.message);
          return;
        }
      }
      router.replace("/check");
    })().catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Sign-in callback failed");
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-5 py-16">
      <div className="max-w-md text-center">
        <p className="font-display text-2xl text-ink">
          {error ? "Could not finish sign-in" : "Finishing sign-in…"}
        </p>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      </div>
    </main>
  );
}
