import type { FovCandidate } from "./types";

const MIN_FOV_DEG = 20;
const MAX_FOV_DEG = 150;

export function radiansToDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function degreesToRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function projectionMatrixToFov(projectionMatrix: number[]): {
  horizontalDeg: number;
  verticalDeg: number;
} | null {
  if (projectionMatrix.length < 6) {
    return null;
  }

  const xScale = Math.abs(projectionMatrix[0]);
  const yScale = Math.abs(projectionMatrix[5]);

  if (!Number.isFinite(xScale) || !Number.isFinite(yScale) || xScale <= 0 || yScale <= 0) {
    return null;
  }

  const horizontal = 2 * Math.atan(1 / xScale);
  const vertical = 2 * Math.atan(1 / yScale);

  return {
    horizontalDeg: radiansToDegrees(horizontal),
    verticalDeg: radiansToDegrees(vertical),
  };
}

export function adjustFovForZoom(baseFovDeg: number, zoom: number | null): number {
  if (!zoom || !Number.isFinite(zoom) || zoom <= 0) {
    return baseFovDeg;
  }

  const baseRad = degreesToRadians(baseFovDeg);
  const adjustedRad = 2 * Math.atan(Math.tan(baseRad / 2) / zoom);

  return radiansToDegrees(adjustedRad);
}

export function isSaneFov(fovDeg: number): boolean {
  return Number.isFinite(fovDeg) && fovDeg >= MIN_FOV_DEG && fovDeg <= MAX_FOV_DEG;
}

export function confidenceFromScore(score: number): "Alta" | "Média" | "Baixa" {
  if (score >= 0.8) {
    return "Alta";
  }

  if (score >= 0.6) {
    return "Média";
  }

  return "Baixa";
}

export function blendTopCandidates(candidates: FovCandidate[]): {
  fovHDeg: number;
  score: number;
  usedBlend: boolean;
  selected: FovCandidate;
  secondary?: FovCandidate;
} {
  const ordered = [...candidates].sort((a, b) => b.score - a.score);
  const top = ordered[0];
  const second = ordered[1];

  if (!second) {
    return {
      fovHDeg: top.fovHDeg,
      score: top.score,
      usedBlend: false,
      selected: top,
    };
  }

  const difference = Math.abs(top.fovHDeg - second.fovHDeg);
  if (difference <= 4) {
    return {
      fovHDeg: (top.fovHDeg + second.fovHDeg) / 2,
      score: Math.max(top.score, second.score),
      usedBlend: true,
      selected: top,
      secondary: second,
    };
  }

  return {
    fovHDeg: top.fovHDeg,
    score: top.score,
    usedBlend: false,
    selected: top,
    secondary: second,
  };
}

export function computeUncertainty(
  baselineTolerance: number,
  selectedFov: number,
  candidates: FovCandidate[]
): number {
  const divergences = candidates.map((candidate) => Math.abs(candidate.fovHDeg - selectedFov));
  const maxDivergence = divergences.length ? Math.max(...divergences) : 0;
  const uncertainty = baselineTolerance + maxDivergence * 0.35;

  return Math.max(2, Math.min(25, Number(uncertainty.toFixed(1))));
}
