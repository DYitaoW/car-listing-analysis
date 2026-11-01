import type { Listing, ListingStatus } from "@listing-validator/types";

export function scoreTone(score: number | null | undefined): "muted" | "accent" | "warn" | "danger" {
  if (score == null) return "muted";
  if (score >= 60) return "danger";
  if (score >= 35) return "warn";
  return "accent";
}

export function scoreClassName(score: number | null | undefined): string {
  const tone = scoreTone(score);
  if (tone === "danger") return "text-danger";
  if (tone === "warn") return "text-warn";
  if (tone === "accent") return "text-accent";
  return "text-muted";
}

export function statusLabel(status: ListingStatus): string {
  switch (status) {
    case "pending":
      return "Queued";
    case "processing":
      return "Analyzing";
    case "completed":
      return "Complete";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

export function formatPrice(price: number | null | undefined): string {
  if (price == null) return "—";
  return `$${Math.round(price).toLocaleString("en-US")}`;
}

export function isTerminal(listing: Pick<Listing, "status"> | null | undefined): boolean {
  return listing?.status === "completed" || listing?.status === "failed";
}
