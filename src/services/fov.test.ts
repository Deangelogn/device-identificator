import { describe, expect, it } from "vitest";
import type { CameraCatalog, CameraDescriptor, DeviceFingerprint, WebXrMeasurement } from "../domain/types";
import { buildFovCandidates, estimateFov } from "./fov";

const mockCatalog: CameraCatalog = {
  catalogVersion: "test",
  updatedAt: "2026-03-04",
  sources: ["test"],
  models: [
    {
      modelCode: "SM-S926B",
      family: "SM-S92",
      aliases: ["Galaxy S24+"],
      brand: "Samsung",
      cameraProfiles: [
        {
          id: "rear-wide",
          lensType: "wide",
          fovH: 79,
          fovV: 63,
          toleranceDeg: 3,
          source: "test",
        },
      ],
    },
  ],
};

const cameraWide: CameraDescriptor = {
  deviceId: "camera-1",
  label: "Back Camera 1x",
  lensType: "wide",
  facingMode: "environment",
  isSelected: true,
  zoom: { min: 1, max: 8, current: 1 },
  resolution: { width: 1920, height: 1080 },
};

const deviceExact: DeviceFingerprint = {
  model: "SM-S926B",
  normalizedModel: "SM-S926B",
  platform: "Android",
  brand: "Samsung",
  quality: "exact",
  source: "ua-ch",
  userAgent: "test",
};

const deviceUnknown: DeviceFingerprint = {
  model: null,
  normalizedModel: null,
  platform: "Android",
  brand: null,
  quality: "unavailable",
  source: "none",
  userAgent: "test",
};

const webxrMissing: WebXrMeasurement = {
  supported: false,
  attempted: false,
  available: false,
};

describe("buildFovCandidates", () => {
  it("includes catalog exact candidate when exact model is known", () => {
    const candidates = buildFovCandidates({
      fingerprint: deviceExact,
      camera: cameraWide,
      webxrMeasurement: webxrMissing,
      catalog: mockCatalog,
    });

    expect(candidates.some((candidate) => candidate.source === "catalog-exact")).toBe(true);
  });

  it("keeps heuristic candidate when catalog is unavailable", () => {
    const candidates = buildFovCandidates({
      fingerprint: deviceUnknown,
      camera: cameraWide,
      webxrMeasurement: webxrMissing,
      catalog: mockCatalog,
    });

    expect(candidates.some((candidate) => candidate.source === "heuristic")).toBe(true);
  });
});

describe("estimateFov", () => {
  it("prefers WebXR when available", () => {
    const estimate = estimateFov({
      fingerprint: deviceExact,
      camera: cameraWide,
      webxrMeasurement: {
        supported: true,
        attempted: true,
        available: true,
        fovH: 81,
        fovV: 64,
      },
      catalog: mockCatalog,
    });

    expect(estimate).not.toBeNull();
    expect(estimate?.source).toBe("WebXR");
    expect(estimate?.confidence).toBe("Alta");
  });

  it("falls back without breaking when WebXR is missing", () => {
    const estimate = estimateFov({
      fingerprint: deviceUnknown,
      camera: cameraWide,
      webxrMeasurement: webxrMissing,
      catalog: mockCatalog,
    });

    expect(estimate).not.toBeNull();
    expect(["Catálogo", "Heurística"]).toContain(estimate?.source);
  });

  it("keeps a low-confidence estimate available for continuity", () => {
    const estimate = estimateFov({
      fingerprint: deviceUnknown,
      camera: {
        ...cameraWide,
        lensType: "unknown",
      },
      webxrMeasurement: webxrMissing,
      catalog: {
        ...mockCatalog,
        models: [],
      },
    });

    expect(estimate).not.toBeNull();
    expect(estimate?.confidence).toBe("Baixa");
    expect(estimate?.source).toBe("Heurística");
  });
});
