import { createApiClient } from "@listing-validator/api-client";
import { getSupabase } from "@/lib/supabase";

function resolveApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!configured) return "/api/lv";
  if (configured.startsWith("/")) return configured.replace(/\/$/, "");
  try {
    const { hostname, protocol } = new URL(configured);
    const loopback =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]" ||
      hostname === "0.0.0.0";
    const pageIsHttps = typeof window !== "undefined" && window.location.protocol === "https:";
    if (loopback || (protocol === "http:" && pageIsHttps)) return "/api/lv";
  } catch {
    return "/api/lv";
  }
  return configured.replace(/\/$/, "");
}

export const apiBaseUrl = resolveApiBase();

async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export const api = createApiClient(apiBaseUrl, { getAccessToken });
