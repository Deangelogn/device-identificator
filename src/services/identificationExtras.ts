/**
 * Dados adicionais para identificação do aparelho, obtidos via WebGL, Navigator e Screen.
 * Úteis para fingerprinting e para cruzar com modelo (ex.: GPU típica de um chipset).
 */

export interface WebGlInfo {
  vendor: string | null;
  renderer: string | null;
}

export interface IdentificationExtras {
  webgl: WebGlInfo;
  hardwareConcurrency: number | null;
  deviceMemory: number | null;
  screenLogical: { width: number; height: number } | null;
  navigatorVendor: string | null;
}

const UNMASKED_VENDOR_WEBGL = 0x9245;
const UNMASKED_RENDERER_WEBGL = 0x9246;

function getWebGlInfo(): WebGlInfo {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl");
    if (!gl) return { vendor: null, renderer: null };
    const debugInfo = (gl as WebGLRenderingContext & { getExtension(name: string): unknown }).getExtension("WEBGL_debug_renderer_info");
    if (!debugInfo) return { vendor: null, renderer: null };
    const vendor = (gl as WebGLRenderingContext).getParameter(UNMASKED_VENDOR_WEBGL) as string | null;
    const renderer = (gl as WebGLRenderingContext).getParameter(UNMASKED_RENDERER_WEBGL) as string | null;
    return { vendor: vendor ?? null, renderer: renderer ?? null };
  } catch {
    return { vendor: null, renderer: null };
  }
}

export function collectIdentificationExtras(): IdentificationExtras {
  const webgl = getWebGlInfo();
  const hardwareConcurrency =
    typeof navigator.hardwareConcurrency === "number" ? navigator.hardwareConcurrency : null;
  const screenLogical =
    typeof screen.width === "number" && typeof screen.height === "number"
      ? { width: screen.width, height: screen.height }
      : null;
  const navigatorVendor =
    typeof navigator.vendor === "string" && navigator.vendor ? navigator.vendor : null;

  return {
    webgl,
    hardwareConcurrency,
    deviceMemory: null,
    screenLogical,
    navigatorVendor,
  };
}

/** Preenche deviceMemory via Client Hints (getHighEntropyValues), se disponível. */
export async function fillDeviceMemory(extras: IdentificationExtras): Promise<IdentificationExtras> {
  if (typeof navigator.userAgentData?.getHighEntropyValues !== "function") {
    return extras;
  }
  try {
    const values = await navigator.userAgentData.getHighEntropyValues(["deviceMemory"]);
    const mem = values.deviceMemory;
    return {
      ...extras,
      deviceMemory: typeof mem === "number" && mem > 0 ? mem : null,
    };
  } catch {
    return extras;
  }
}
