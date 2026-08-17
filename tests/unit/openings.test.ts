import { describe, expect, it } from "vitest";
import { resolveOpening } from "@/lib/openings/detectOpening";

describe("detectOpening", () => {
  it("detects philidor from move sequence", () => {
    const opening = resolveOpening({}, ["e2e4", "e7e5", "g1f3", "d7d6"]);
    expect(opening?.name).toBe("Philidor Defense");
    expect(opening?.eco).toBe("C41");
  });

  it("uses PGN headers when present", () => {
    const opening = resolveOpening(
      { ECO: "B90", Opening: "Sicilian Najdorf" },
      ["e2e4"]
    );
    expect(opening?.name).toBe("Sicilian Najdorf");
  });
});
