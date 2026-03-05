export type DeviceMatchQuality = "exact" | "partial" | "unavailable";
export type DeviceDataSource = "ua-ch" | "ua-string" | "none";

export interface DeviceFingerprint {
  model: string | null;
  normalizedModel: string | null;
  platform: string | null;
  brand: string | null;
  quality: DeviceMatchQuality;
  source: DeviceDataSource;
  userAgent: string;
}

export type LensType = "ultrawide" | "wide" | "telephoto" | "front" | "unknown";

export interface CameraDescriptor {
  deviceId: string;
  label: string;
  lensType: LensType;
  facingMode: string;
  isSelected: boolean;
  zoom: {
    min: number | null;
    max: number | null;
    current: number | null;
  };
  resolution: {
    width: number | null;
    height: number | null;
  };
  /** Resolução mínima (getCapabilities). */
  resolutionMin?: { width: number | null; height: number | null };
  /** Resolução máxima (getCapabilities). */
  resolutionMax?: { width: number | null; height: number | null };
  /** Frame rate atual (getSettings). */
  frameRate?: number | null;
  /** Frame rate min/max (getCapabilities). */
  frameRateRange?: { min: number | null; max: number | null };
  /** Aspect ratio atual (getSettings), se reportado. */
  aspectRatio?: number | null;
  /** groupId do getSettings (agrupa dispositivos do mesmo hardware). */
  groupId?: string | null;
  /** resizeMode do getSettings: "none" | "crop-and-scale". */
  resizeMode?: string | null;
}

export type FovSource = "webxr" | "catalog-exact" | "catalog-family" | "heuristic";

export interface FovCandidate {
  source: FovSource;
  score: number;
  fovHDeg: number;
  fovVDeg?: number | null;
  toleranceDeg: number;
  details: string;
  lensType: LensType;
  zoomAdjustable: boolean;
}

export interface FovEstimate {
  fovHDeg: number;
  fovVDeg: number | null;
  uncertaintyDeg: number;
  score: number;
  confidence: "Alta" | "Média" | "Baixa";
  source: "WebXR" | "Catálogo" | "Heurística";
  reasoning: string[];
  candidates: FovCandidate[];
}

export interface CameraProfile {
  id: string;
  lensType: LensType;
  fovH: number;
  fovV?: number;
  toleranceDeg: number;
  source: string;
}

export interface CatalogModel {
  modelCode: string;
  family?: string;
  aliases?: string[];
  brand: string;
  cameraProfiles: CameraProfile[];
}

export interface CameraCatalog {
  catalogVersion: string;
  updatedAt: string;
  sources: string[];
  models: CatalogModel[];
}

export interface WebXrMeasurement {
  supported: boolean;
  attempted: boolean;
  available: boolean;
  reason?: string;
  fovH?: number;
  fovV?: number;
}
