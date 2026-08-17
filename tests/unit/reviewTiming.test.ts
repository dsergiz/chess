import { describe, it, expect } from "vitest";
import { buildBatchReviewStats, formatReviewDuration } from "@/lib/gameReview/reviewTiming";

describe("formatReviewDuration", () => {
  it("formats sub-second durations in ms", () => {
    expect(formatReviewDuration(450)).toBe("450ms");
  });

  it("formats seconds with one decimal", () => {
    expect(formatReviewDuration(2500)).toBe("2.5s");
  });

  it("formats minutes and seconds", () => {
    expect(formatReviewDuration(125_000)).toBe("2m 5s");
  });
});

describe("buildBatchReviewStats", () => {
  it("computes average ms per analyzed position", () => {
    expect(buildBatchReviewStats(10_000, 20, 1)).toEqual({
      totalMs: 10_000,
      positionsAnalyzed: 20,
      positionsFailed: 1,
      avgMsPerPosition: 500,
    });
  });

  it("returns zero average when nothing analyzed", () => {
    expect(buildBatchReviewStats(0, 0, 0).avgMsPerPosition).toBe(0);
  });
});
