import { describe, expect, it } from "vitest";
import { DEMO_LISTING, DEMO_LISTING_INPUT } from "./demoListing";

describe("demo listing fixture", () => {
  it("exposes a completed sample report with required disclaimers", () => {
    expect(DEMO_LISTING_INPUT.title).toContain("Accord");
    expect(DEMO_LISTING.status).toBe("completed");
    expect(DEMO_LISTING.report).not.toBeNull();
    expect(DEMO_LISTING.report?.historyChecked).toBe(false);
    expect(DEMO_LISTING.report?.titleVerified).toBe(false);
    expect(DEMO_LISTING.report?.riskScore).toBeGreaterThan(0);
    expect(DEMO_LISTING.report?.flags.length).toBeGreaterThan(0);
  });
});
