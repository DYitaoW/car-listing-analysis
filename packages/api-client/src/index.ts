import type { CreateListingRequest, Listing } from "@listing-validator/types";

export type { CreateListingRequest, Listing };

export interface HealthResponse {
  status: string;
  storage: string;
  llmProvider: string;
  jobBackend: string;
}

function errorMessage(status: number, text: string): string {
  if (!text) return `Request failed (${status})`;
  try {
    const parsed = JSON.parse(text) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
    if (Array.isArray(parsed.detail)) {
      const parts = parsed.detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (!item || typeof item !== "object" || !("msg" in item)) return "";
          const record = item as { msg?: unknown; loc?: unknown };
          const msg = String(record.msg ?? "");
          const loc = Array.isArray(record.loc)
            ? record.loc.filter((part) => part !== "body").join(".")
            : "";
          return loc ? `${loc}: ${msg}` : msg;
        })
        .filter(Boolean);
      if (parts.length) return parts.join("; ");
    }
  } catch {
    // Response was not JSON.
  }
  return text;
}

function explainNetworkError(err: unknown, root: string): Error {
  if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
    return new Error(`The analysis API did not respond in time (${root}).`);
  }
  const raw = err instanceof Error ? err.message : "failed";
  const hint = root.startsWith("/")
    ? "The web app proxies /api/lv to the API process. Start the API with pnpm dev:api."
    : `The app could not reach ${root}. On a phone or emulator, 127.0.0.1 is the device itself — use your computer's LAN address (Android emulator: http://10.0.2.2:43124).`;
  return new Error(`Cannot reach the analysis API. ${hint} (${raw})`);
}

export function createApiClient(baseUrl: string) {
  const root = baseUrl.replace(/\/$/, "");

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const timeout =
      init?.signal ??
      (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
        ? AbortSignal.timeout(90_000)
        : undefined);
    let res: Response;
    try {
      res = await fetch(`${root}${path}`, { ...init, signal: timeout });
    } catch (err) {
      throw explainNetworkError(err, root || "the analysis API");
    }
    if (!res.ok) {
      throw new Error(errorMessage(res.status, await res.text()));
    }
    return res.json() as Promise<T>;
  }

  return {
    health: () => request<HealthResponse>("/health"),
    createListing: (body: CreateListingRequest) =>
      request<Listing>("/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    uploadImages: async (listingId: string, files: File[] | Blob[]) => {
      const form = new FormData();
      for (const file of files) {
        form.append("files", file);
      }
      return request<Listing>(`/listings/${listingId}/images`, {
        method: "POST",
        body: form,
      });
    },
    uploadForm: (listingId: string, form: FormData) =>
      request<Listing>(`/listings/${listingId}/images`, {
        method: "POST",
        body: form,
      }),
    getListing: (listingId: string) => request<Listing>(`/listings/${listingId}`),
    analyze: (listingId: string) =>
      request<Listing>(`/listings/${listingId}/analyze`, { method: "POST" }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
