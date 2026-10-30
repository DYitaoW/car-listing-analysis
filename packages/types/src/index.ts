/** Shared API contract types for web + mobile clients. */

export type ListingStatus = "pending" | "processing" | "completed" | "failed";

export type ClaimVerdict = "supported" | "contradicted" | "unclear";

export type PhotoEvidence = "supported" | "contradicted" | "unclear" | "not_applicable";

export interface ClaimCheck {
  claim: string;
  verdict: ClaimVerdict;
  detail: string;
}

export interface AttributeCheck {
  attribute: string;
  expected: string | null;
  source: "vin" | "listing";
  listingMatch: boolean | null;
  photoEvidence: PhotoEvidence;
  detail: string;
}

export interface RiskFlag {
  code: string;
  severity: "low" | "medium" | "high";
  message: string;
}

export interface VinDecoded {
  make?: string;
  model?: string;
  modelYear?: string;
  bodyClass?: string;
  trim?: string;
  series?: string;
  driveType?: string;
  doors?: string;
  fuelType?: string;
  displacementL?: string;
  engineCylinders?: string;
  engineHp?: string;
  transmission?: string;
  plantCity?: string;
  plantState?: string;
  plantCountry?: string;
  vehicleType?: string;
  errorText?: string;
}

export interface AnalysisReport {
  riskScore: number;
  confidence: number;
  summary: string;
  flags: RiskFlag[];
  claimChecks: ClaimCheck[];
  attributeChecks: AttributeCheck[];
  vinMatch: {
    checked: boolean;
    matchesListing: boolean | null;
    decoded?: VinDecoded;
    attributeChecks?: AttributeCheck[];
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
