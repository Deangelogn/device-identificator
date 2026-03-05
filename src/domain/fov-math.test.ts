import { describe, expect, it } from "vitest";
import {
  adjustFovForZoom,
  blendTopCandidates,
  confidenceFromScore,
  projectionMatrixToFov,
} from "./fov-math";
import type { FovCandidate } from "./types";

describe("projectionMatrixToFov", () => {
  it("extracts horizontal/vertical FOV from standard perspective matrix scales", () => {
    const matrix = [1, 0, 0, 0, 0, 1.732, 0, 0, 0, 0, -1, -1, 0, 0, -0.2, 0];
    const result = projectionMatrixToFov(matrix);

    expect(result).not.toBeNull();
    expect(result?.horizontalDeg).toBeCloseTo(90, 1);
    expect(result?.verticalDeg).toBeCloseTo(60, 1);
  });
});

describe("adjustFovForZoom", () => {
  it("reduces FOV when zoom increases", () => {
    const adjusted = adjustFovForZoom(80, 2);
    expect(adjusted).toBeLessThan(80);
    expect(adjusted).toBeCloseTo(45.5, 1);
  });
});

describe("confidenceFromScore", () => {
  it("maps score into expected confidence buckets", () => {
    expect(confidenceFromScore(0.85)).toBe("Alta");
    expect(confidenceFromScore(0.7)).toBe("Média");
    expect(confidenceFromScore(0.5)).toBe("Baixa");
  });
});

describe("blendTopCandidates", () => {
  it("blends top two candidates when FOV difference is small", () => {
    const candidates: FovCandidate[] = [
      {
        source: "catalog-exact",
        score: 0.86,
        fovHDeg: 79,
        fovVDeg: 63,
        toleranceDeg: 3,
        details: "a",
        lensType: "wide",
        zoomAdjustable: true,
      },
      {
        source: "webxr",
        score: 0.93,
        fovHDeg: 81,
        fovVDeg: 64,
        toleranceDeg: 3,
        details: "b",
        lensType: "wide",
        zoomAdjustable: false,
      },
    ];

    const blended = blendTopCandidates(candidates);

    expect(blended.usedBlend).toBe(true);
    expect(blended.fovHDeg).toBe(80);
  });
});
