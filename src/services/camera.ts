import type { CameraDescriptor, LensType } from "../domain/types";

function resolveLensType(label: string, facingMode: string, zoomMax: number | null, zoomCurrent: number | null): LensType {
  const text = `${label} ${facingMode}`.toLowerCase();

  if (text.includes("front") || text.includes("selfie") || text.includes("user")) {
    return "front";
  }

  if (
    text.includes("ultra") ||
    text.includes("0.5x") ||
    text.includes("wide-angle") ||
    text.includes("wide angle") ||
    text.includes("uw")
  ) {
    return "ultrawide";
  }

  if (
    text.includes("tele") ||
    text.includes("periscope") ||
    text.includes("3x") ||
    text.includes("5x") ||
    text.includes("10x")
  ) {
    return "telephoto";
  }

  if (text.includes("main") || text.includes("wide") || text.includes("1x") || text.includes("rear")) {
    return "wide";
  }

  if (zoomCurrent && zoomCurrent >= 1.9 && zoomMax && zoomMax >= 3) {
    return "telephoto";
  }

  if (facingMode === "environment") {
    return "wide";
  }

  if (facingMode === "user") {
    return "front";
  }

  return "unknown";
}

function cameraNameFromLabel(label: string, index: number): string {
  const trimmed = label.trim();
  return trimmed.length ? trimmed : `Camera ${index + 1}`;
}

function readZoom(track: MediaStreamTrack): {
  min: number | null;
  max: number | null;
  current: number | null;
} {
  const settings = track.getSettings();
  const capabilities = typeof track.getCapabilities === "function" ? track.getCapabilities() : {};
  const zoomCapabilities = capabilities.zoom;

  return {
    min: typeof zoomCapabilities?.min === "number" ? zoomCapabilities.min : null,
    max: typeof zoomCapabilities?.max === "number" ? zoomCapabilities.max : null,
    current: typeof settings.zoom === "number" ? settings.zoom : null,
  };
}

function readResolutionRange(track: MediaStreamTrack): {
  min: { width: number | null; height: number | null };
  max: { width: number | null; height: number | null };
} {
  const capabilities = typeof track.getCapabilities === "function" ? track.getCapabilities() : {};
  const w = capabilities.width as { min?: number; max?: number } | undefined;
  const h = capabilities.height as { min?: number; max?: number } | undefined;
  return {
    min: {
      width: typeof w?.min === "number" ? w.min : null,
      height: typeof h?.min === "number" ? h.min : null,
    },
    max: {
      width: typeof w?.max === "number" ? w.max : null,
      height: typeof h?.max === "number" ? h.max : null,
    },
  };
}

function readFrameRate(track: MediaStreamTrack): {
  current: number | null;
  min: number | null;
  max: number | null;
} {
  const settings = track.getSettings();
  const capabilities = typeof track.getCapabilities === "function" ? track.getCapabilities() : {};
  const frCap = capabilities.frameRate as { min?: number; max?: number } | undefined;
  return {
    current: typeof settings.frameRate === "number" ? settings.frameRate : null,
    min: typeof frCap?.min === "number" ? frCap.min : null,
    max: typeof frCap?.max === "number" ? frCap.max : null,
  };
}

export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

export async function listVideoInputDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === "videoinput");
}

export function createDescriptorFromTrack(
  track: MediaStreamTrack,
  options: { label?: string; isSelected?: boolean; index?: number } = {}
): CameraDescriptor {
  const settings = track.getSettings();
  const zoom = readZoom(track);
  const facingMode = typeof settings.facingMode === "string" ? settings.facingMode : "unknown";
  const label = options.label ?? track.label ?? "Câmera ativa";
  const resRange = readResolutionRange(track);
  const frameRate = readFrameRate(track);

  const hasResMin = resRange.min.width != null || resRange.min.height != null;
  const hasResMax = resRange.max.width != null || resRange.max.height != null;
  const hasFrameRateRange = frameRate.min != null || frameRate.max != null;

  return {
    deviceId: settings.deviceId ?? "active-track",
    label: cameraNameFromLabel(label, options.index ?? 0),
    lensType: resolveLensType(label, facingMode, zoom.max, zoom.current),
    facingMode,
    isSelected: options.isSelected ?? false,
    zoom,
    resolution: {
      width: typeof settings.width === "number" ? settings.width : null,
      height: typeof settings.height === "number" ? settings.height : null,
    },
    resolutionMin: hasResMin ? resRange.min : undefined,
    resolutionMax: hasResMax ? resRange.max : undefined,
    frameRate: frameRate.current,
    frameRateRange: hasFrameRateRange
      ? { min: frameRate.min, max: frameRate.max }
      : undefined,
    aspectRatio:
      typeof settings.aspectRatio === "number" ? settings.aspectRatio : undefined,
    groupId: typeof settings.groupId === "string" ? settings.groupId : undefined,
    resizeMode: typeof (settings as { resizeMode?: string }).resizeMode === "string"
      ? (settings as { resizeMode: string }).resizeMode
      : undefined,
  };
}

export interface StartCameraOptions {
  deviceId?: string;
  /** Em mobile, quando true, usa câmera frontal (facingMode: user). */
  preferFrontCamera?: boolean;
}

export async function startCamera(options?: StartCameraOptions | string): Promise<{
  stream: MediaStream;
  activeCamera: CameraDescriptor;
  cameras: CameraDescriptor[];
}> {
  const opts: StartCameraOptions =
    typeof options === "string" ? { deviceId: options } : options ?? {};

  const videoConstraints: MediaTrackConstraints = {
    frameRate: { ideal: 30 },
  };

  if (opts.deviceId) {
    videoConstraints.deviceId = { exact: opts.deviceId };
  } else if (opts.preferFrontCamera) {
    videoConstraints.facingMode = { ideal: "user" };
  } else {
    videoConstraints.facingMode = { ideal: "environment" };
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: videoConstraints,
  });

  const track = stream.getVideoTracks()[0];
  const fallbackDescriptor = createDescriptorFromTrack(track, { isSelected: true });

  const devices = await listVideoInputDevices();
  const selectedId = track.getSettings().deviceId ?? opts.deviceId ?? fallbackDescriptor.deviceId;

  const cameras = devices.map((device, index) => {
    const isSelected = device.deviceId === selectedId;
    const descriptor = createDescriptorFromTrack(track, {
      label: device.label,
      isSelected,
      index,
    });

    return {
      ...descriptor,
      deviceId: device.deviceId,
      label: cameraNameFromLabel(device.label, index),
    };
  });

  const activeCamera = cameras.find((camera) => camera.deviceId === selectedId) ?? {
    ...fallbackDescriptor,
    deviceId: selectedId,
  };

  return {
    stream,
    activeCamera,
    cameras,
  };
}
