/** Shared API contract types for web + mobile clients. */

export type ListingStatus = "pending" | "processing" | "completed" | "failed";

export type ClaimVerdict = "supported" | "contradicted" | "unclear";

export interface ClaimCheck {
  claim: string;
  verdict: ClaimVerdict;
  detail: string;
}

export interface RiskFlag {
  code: string;
  severity: "low" | "medium" | "high";
  message: string;
}

export interface AnalysisReport {
  riskScore: number;
  confidence: number;
  summary: string;
  flags: RiskFlag[];
  claimChecks: ClaimCheck[];
  vinMatch: {
    checked: boolean;
    matchesListing: boolean | null;
    decoded?: {
      make?: string;
      model?: string;
      modelYear?: string;
      bodyClass?: string;
    };
  };
  recalls: {
    checked: boolean;
    count: number;
    parkIt: boolean;
    parkOutside: boolean;
  };
  imageFindings: string[];
  historyChecked: false;
  titleVerified: false;
  disclaimer: string;
}

export interface ListingImage {
  id: string;
  path: string;
  contentType: string;
}

export interface Listing {
  id: string;
  userId?: string | null;
  title: string;
  price: number | null;
  description: string;
  vin: string | null;
  sourceUrl: string | null;
  status: ListingStatus;
  error: string | null;
  images: ListingImage[];
  report: AnalysisReport | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListingSummary {
  id: string;
  title: string;
  price: number | null;
  status: ListingStatus;
  riskScore: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: string;
  email: string | null;
  authRequired: boolean;
}

export interface CreateListingRequest {
  title: string;
  description: string;
  price?: number | null;
  vin?: string | null;
  sourceUrl?: string | null;
}

export interface MarketplaceImportRequest {
  url: string;
}

export interface MarketplaceImportResult {
  sourceUrl: string;
  title: string;
  description: string;
  price: number | null;
  vin: string | null;
  imageUrls: string[];
  warnings: string[];
  partial: boolean;
}
