interface NavigatorUADataBrandVersion {
  brand: string;
  version: string;
}

interface NavigatorUAData {
  brands: NavigatorUADataBrandVersion[];
  mobile: boolean;
  platform: string;
  getHighEntropyValues(hints: string[]): Promise<Record<string, string>>;
}

interface Navigator {
  userAgentData?: NavigatorUAData;
  xr?: {
    isSessionSupported(mode: "inline" | "immersive-ar" | "immersive-vr"): Promise<boolean>;
    requestSession(mode: "inline" | "immersive-ar" | "immersive-vr", options?: unknown): Promise<{
      requestReferenceSpace(type: "viewer" | "local" | "local-floor"): Promise<unknown>;
      requestAnimationFrame(callback: (time: number, frame: unknown) => void): number;
      end(): Promise<void>;
    }>;
  };
}

interface MediaTrackCapabilities {
  zoom?: { min: number; max: number; step?: number };
  width?: { min?: number; max?: number };
  height?: { min?: number; max?: number };
  frameRate?: { min?: number; max?: number };
  aspectRatio?: { min?: number; max?: number };
}

interface MediaTrackSettings {
  zoom?: number;
  frameRate?: number;
  aspectRatio?: number;
}
