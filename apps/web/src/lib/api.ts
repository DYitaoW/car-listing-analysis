import { createApiClient } from "@listing-validator/api-client";

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
    // Loopback in the browser points at the viewer's machine. Firefox reports
    // that failure as "NetworkError when attempting to fetch resource".
    // The Next server proxies /api/lv to the API instead.
    if (loopback || (protocol === "http:" && pageIsHttps)) return "/api/lv";
  } catch {
    return "/api/lv";
  }
  return configured.replace(/\/$/, "");
}

export const apiBaseUrl = resolveApiBase();
export const api = createApiClient(apiBaseUrl);
