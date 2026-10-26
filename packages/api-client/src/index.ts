import type { CreateListingRequest, Listing } from "@listing-validator/types";

export type { CreateListingRequest, Listing };

export function createApiClient(baseUrl: string) {
  const root = baseUrl.replace(/\/$/, "");

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${root}${path}`, init);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Request failed (${res.status})`);
    }
    return res.json() as Promise<T>;
  }

  return {
    health: () => request<{ status: string; storage: string; llm_provider: string }>("/health"),
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
    getListing: (listingId: string) => request<Listing>(`/listings/${listingId}`),
    analyze: (listingId: string) =>
      request<Listing>(`/listings/${listingId}/analyze`, { method: "POST" }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
