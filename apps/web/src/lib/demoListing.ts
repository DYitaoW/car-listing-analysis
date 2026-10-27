import type { Listing } from "@listing-validator/types";

/** Sample marketplace listing shown on the homepage and preloadable in /check?demo=1 */
export const DEMO_LISTING_INPUT = {
  title: "2016 Honda Accord EX — garage kept, like new",
  price: "8900",
  description:
    "One-owner coupe. Garage kept, no rust, like new interior. Clean title in hand. Asking $8,900 OBO.",
  vin: "1HGCT1B86GA000001",
  sourceUrl: "https://example.com/marketplace/demo-accord",
};

export const DEMO_LISTING: Listing = {
  id: "demo-listing",
  userId: null,
  title: DEMO_LISTING_INPUT.title,
  price: 8900,
  description: DEMO_LISTING_INPUT.description,
  vin: DEMO_LISTING_INPUT.vin,
  sourceUrl: DEMO_LISTING_INPUT.sourceUrl,
  status: "completed",
  error: null,
  images: [],
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  report: {
    riskScore: 42,
    confidence: 0.64,
    summary:
      "Sample report: photos look usable, optimistic seller claims stay unclear without a live vision model, and the VIN text should be cross-checked against NHTSA on a real run.",
    flags: [
      {
        code: "few_images",
        severity: "medium",
        message: "Fewer than 3 readable photos; damage and angle coverage may be limited.",
      },
      {
        code: "open_recalls",
        severity: "medium",
        message: "NHTSA often lists recall campaigns for popular Accords — always verify on a live check.",
      },
    ],
    claimChecks: [
      {
        claim: "no rust",
        verdict: "unclear",
        detail: "Demo mode records the claim. A live check can compare it with the photos.",
      },
      {
        claim: "like new claim",
        verdict: "unclear",
        detail: "Demo mode records the claim. A live check can compare it with the photos.",
      },
      {
        claim: "garage kept claim",
        verdict: "unclear",
        detail: "Demo mode records the claim. A live check can compare it with the photos.",
      },
    ],
    vinMatch: {
      checked: true,
      matchesListing: true,
      decoded: {
        make: "Honda",
        model: "Accord",
        modelYear: "2016",
        bodyClass: "Coupe",
      },
    },
    recalls: {
      checked: true,
      count: 3,
      parkIt: false,
      parkOutside: false,
    },
    imageFindings: [
      "front.jpg: 1280×720 JPEG.",
      "side.jpg: 1280×720 JPEG.",
      "Demo mode does not upload files — run a real check to inspect your photos.",
    ],
    historyChecked: false,
    titleVerified: false,
    disclaimer:
      "This is an AI risk assessment, not a certified inspection or title verification. Vehicle history and title status were not checked.",
  },
};
