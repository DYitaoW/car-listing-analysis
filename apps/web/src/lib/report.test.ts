import { describe, expect, it } from "vitest";
import { formatPrice, isTerminal, scoreClassName, scoreTone, statusLabel } from "./report";

describe("report helpers", () => {
  it("maps risk scores to tones", () => {
    expect(scoreTone(null)).toBe("muted");
    expect(scoreTone(20)).toBe("accent");
    expect(scoreTone(40)).toBe("warn");
    expect(scoreTone(75)).toBe("danger");
    expect(scoreClassName(75)).toContain("danger");
  });

  it("labels listing statuses for the UI", () => {
    expect(statusLabel("pending")).toBe("Queued");
    expect(statusLabel("processing")).toBe("Analyzing");
    expect(statusLabel("completed")).toBe("Complete");
    expect(statusLabel("failed")).toBe("Failed");
  });

  it("formats prices and terminal states", () => {
    expect(formatPrice(null)).toBe("—");
    expect(formatPrice(14999)).toBe("$14,999");
    expect(isTerminal({ status: "completed" })).toBe(true);
    expect(isTerminal({ status: "processing" })).toBe(false);
  });
});
