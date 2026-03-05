import cameraCatalogData from "../data/camera-catalog.json";
import {
  adjustFovForZoom,
  blendTopCandidates,
  computeUncertainty,
  confidenceFromScore,
  isSaneFov,
} from "../domain/fov-math";
import type {
  CameraCatalog,
  CameraDescriptor,
  CameraProfile,
  DeviceFingerprint,
  FovCandidate,
  FovEstimate,
  LensType,
  WebXrMeasurement,
} from "../domain/types";
import { normalizeModelCode } from "./device";

export const cameraCatalog = cameraCatalogData as CameraCatalog;

const SOURCE_SCORES = {
  webxr: 0.93,
  catalogExact: 0.86,
  catalogFamily: 0.72,
  heuristic: 0.52,
};

function sourceLabel(source: FovCandidate["source"]): "WebXR" | "Catálogo" | "Heurística" {
  if (source === "webxr") {
    return "WebXR";
  }

  if (source === "heuristic") {
    return "Heurística";
  }

  return "Catálogo";
}

function defaultHeuristic(lensType: LensType): { fovH: number; tolerance: number; details: string } {
  switch (lensType) {
    case "ultrawide":
      return { fovH: 120, tolerance: 12, details: "Heurística ultrawide (faixa típica ~110-125°)." };
    case "telephoto":
      return { fovH: 35, tolerance: 12, details: "Heurística telephoto (faixa típica ~25-45°)." };
    case "front":
      return { fovH: 82, tolerance: 14, details: "Heurística frontal (faixa típica ~70-95°)." };
    case "wide":
      return { fovH: 78, tolerance: 10, details: "Heurística wide principal (faixa típica ~70-85°)." };
    default:
      return { fovH: 75, tolerance: 16, details: "Heurística genérica (sem identificação clara da lente)." };
  }
}

function matchProfileByLens(profiles: CameraProfile[], lensType: LensType): CameraProfile | null {
  const exact = profiles.find((profile) => profile.lensType === lensType);
  if (exact) {
    return exact;
  }

  const wideFallback = profiles.find((profile) => profile.lensType === "wide");
  if (wideFallback) {
    return wideFallback;
  }

  return profiles[0] ?? null;
}

function findCatalogEntry(
  fingerprint: DeviceFingerprint,
  catalog: CameraCatalog
): { exact?: CameraCatalog["models"][number]; family?: CameraCatalog["models"][number] } {
  const normalized = fingerprint.normalizedModel;

  if (!normalized) {
    return {};
  }

  const exact = catalog.models.find((entry) => {
    const normalizedCode = normalizeModelCode(entry.modelCode);
    if (normalizedCode === normalized) {
      return true;
    }

    return (entry.aliases ?? []).some((alias) => normalizeModelCode(alias) === normalized);
  });

  if (exact) {
    return { exact };
  }

  const family = catalog.models.find((entry) => {
    const familyKey = normalizeModelCode(entry.family);
    if (!familyKey) {
      return false;
    }

    return normalized.startsWith(familyKey);
  });

  if (family) {
    return { family };
  }

  return {};
}

function applyZoomAdjustment(candidate: FovCandidate, zoom: number | null): FovCandidate {
  if (!candidate.zoomAdjustable) {
    return candidate;
  }

  if (!zoom || Math.abs(zoom - 1) < 0.01) {
    return candidate;
  }

  const adjusted = adjustFovForZoom(candidate.fovHDeg, zoom);

  return {
    ...candidate,
    fovHDeg: Number(adjusted.toFixed(1)),
    details: `${candidate.details} Ajustado por zoom atual (${zoom.toFixed(2)}x).`,
  };
}

export function buildFovCandidates(params: {
  fingerprint: DeviceFingerprint;
  camera: CameraDescriptor;
  webxrMeasurement: WebXrMeasurement | null;
  catalog?: CameraCatalog;
}): FovCandidate[] {
  const catalog = params.catalog ?? cameraCatalog;
  const candidates: FovCandidate[] = [];
  const zoom = params.camera.zoom.current;

  if (params.webxrMeasurement?.available && params.webxrMeasurement.fovH) {
    candidates.push({
      source: "webxr",
      score: SOURCE_SCORES.webxr,
      fovHDeg: params.webxrMeasurement.fovH,
      fovVDeg: params.webxrMeasurement.fovV ?? null,
      toleranceDeg: 3,
      details: "Extraído da projectionMatrix via WebXR immersive-ar.",
      lensType: params.camera.lensType,
      zoomAdjustable: false,
    });
  }

  const matches = findCatalogEntry(params.fingerprint, catalog);
  if (matches.exact) {
    const profile = matchProfileByLens(matches.exact.cameraProfiles, params.camera.lensType);
    if (profile) {
      candidates.push({
        source: "catalog-exact",
        score: SOURCE_SCORES.catalogExact,
        fovHDeg: profile.fovH,
        fovVDeg: profile.fovV ?? null,
        toleranceDeg: profile.toleranceDeg,
        details: `Catálogo por modelo exato (${matches.exact.modelCode}) + lente ${profile.lensType}.`,
        lensType: profile.lensType,
        zoomAdjustable: true,
      });
    }
  }

  if (!matches.exact && matches.family) {
    const profile = matchProfileByLens(matches.family.cameraProfiles, params.camera.lensType);
    if (profile) {
      candidates.push({
        source: "catalog-family",
        score: SOURCE_SCORES.catalogFamily,
        fovHDeg: profile.fovH,
        fovVDeg: profile.fovV ?? null,
        toleranceDeg: profile.toleranceDeg + 2,
        details: `Catálogo por família (${matches.family.family ?? matches.family.modelCode}) + lente ${profile.lensType}.`,
        lensType: profile.lensType,
        zoomAdjustable: true,
      });
    }
  }

  const heuristic = defaultHeuristic(params.camera.lensType);
  candidates.push({
    source: "heuristic",
    score: SOURCE_SCORES.heuristic,
    fovHDeg: heuristic.fovH,
    toleranceDeg: heuristic.tolerance,
    details: heuristic.details,
    lensType: params.camera.lensType,
    zoomAdjustable: true,
    fovVDeg: null,
  });

  const adjusted = candidates.map((candidate) => applyZoomAdjustment(candidate, zoom));
  return adjusted.filter((candidate) => isSaneFov(candidate.fovHDeg));
}

export function estimateFov(params: {
  fingerprint: DeviceFingerprint;
  camera: CameraDescriptor;
  webxrMeasurement: WebXrMeasurement | null;
  catalog?: CameraCatalog;
}): FovEstimate | null {
  const candidates = buildFovCandidates(params);

  if (!candidates.length) {
    return null;
  }

  const blended = blendTopCandidates(candidates);
  const baselineTolerance = blended.secondary
    ? (blended.selected.toleranceDeg + blended.secondary.toleranceDeg) / 2
    : blended.selected.toleranceDeg;

  const uncertaintyDeg = computeUncertainty(baselineTolerance, blended.fovHDeg, candidates);
  const confidence = confidenceFromScore(blended.score);
  const selectedSource = sourceLabel(blended.selected.source);

  const fovV = blended.secondary?.fovVDeg
    ? Number((((blended.selected.fovVDeg ?? blended.secondary.fovVDeg) + blended.secondary.fovVDeg) / 2).toFixed(1))
    : (blended.selected.fovVDeg ?? null);

  const reasoning = [
    `Fonte principal: ${selectedSource}.`,
    blended.selected.details,
  ];

  if (blended.usedBlend && blended.secondary) {
    reasoning.push(
      `Fusão aplicada: diferença entre top-2 <= 4° (${blended.selected.source} + ${blended.secondary.source}).`
    );
  }

  return {
    fovHDeg: Number(blended.fovHDeg.toFixed(1)),
    fovVDeg: fovV,
    uncertaintyDeg,
    score: Number(blended.score.toFixed(2)),
    confidence,
    source: selectedSource,
    reasoning,
    candidates: [...candidates].sort((a, b) => b.score - a.score),
  };
}
