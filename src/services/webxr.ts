import { isSaneFov, projectionMatrixToFov } from "../domain/fov-math";
import type { WebXrMeasurement } from "../domain/types";

const XR_TIMEOUT_MS = 3500;

export async function captureWebXrMeasurement(): Promise<WebXrMeasurement> {
  if (!navigator.xr) {
    return {
      supported: false,
      attempted: false,
      available: false,
      reason: "WebXR não suportado neste navegador.",
    };
  }

  let immersiveArSupported = false;

  try {
    immersiveArSupported = await navigator.xr.isSessionSupported("immersive-ar");
  } catch {
    return {
      supported: true,
      attempted: false,
      available: false,
      reason: "Falha ao validar suporte WebXR.",
    };
  }

  if (!immersiveArSupported) {
    return {
      supported: true,
      attempted: false,
      available: false,
      reason: "Immersive AR não suportado no device/browser.",
    };
  }

  let session: any;

  try {
    session = await navigator.xr.requestSession("immersive-ar", {
      optionalFeatures: ["local-floor"],
    });
  } catch {
    return {
      supported: true,
      attempted: true,
      available: false,
      reason: "Sessão AR não autorizada ou indisponível.",
    };
  }

  try {
    const referenceSpace = await session.requestReferenceSpace("local");

    const measurement = await new Promise<WebXrMeasurement>((resolve) => {
      const timeout = window.setTimeout(async () => {
        await session.end().catch(() => undefined);
        resolve({
          supported: true,
          attempted: true,
          available: false,
          reason: "Timeout ao capturar projectionMatrix do WebXR.",
        });
      }, XR_TIMEOUT_MS);

      session.requestAnimationFrame(async (_time: number, frame: any) => {
        try {
          const pose = frame?.getViewerPose?.(referenceSpace);
          const matrix = pose?.views?.[0]?.projectionMatrix;

          if (!matrix) {
            clearTimeout(timeout);
            await session.end().catch(() => undefined);
            resolve({
              supported: true,
              attempted: true,
              available: false,
              reason: "projectionMatrix indisponível no frame XR.",
            });
            return;
          }

          const parsed = projectionMatrixToFov(Array.from(matrix));

          clearTimeout(timeout);
          await session.end().catch(() => undefined);

          if (!parsed || !isSaneFov(parsed.horizontalDeg)) {
            resolve({
              supported: true,
              attempted: true,
              available: false,
              reason: "projectionMatrix inválida para FOV útil.",
            });
            return;
          }

          resolve({
            supported: true,
            attempted: true,
            available: true,
            fovH: Number(parsed.horizontalDeg.toFixed(1)),
            fovV: Number(parsed.verticalDeg.toFixed(1)),
          });
        } catch {
          clearTimeout(timeout);
          await session.end().catch(() => undefined);
          resolve({
            supported: true,
            attempted: true,
            available: false,
            reason: "Erro ao processar frame XR.",
          });
        }
      });
    });

    return measurement;
  } catch {
    await session.end().catch(() => undefined);
    return {
      supported: true,
      attempted: true,
      available: false,
      reason: "Falha ao iniciar referência de espaço XR.",
    };
  }
}
