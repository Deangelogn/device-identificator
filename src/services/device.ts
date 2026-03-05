import type { DeviceFingerprint } from "../domain/types";

/** Detecta se o acesso é a partir de dispositivo móvel (phone/tablet). */
export function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  if (navigator.userAgentData?.mobile === true) return true;
  const ua = navigator.userAgent.toLowerCase();
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(ua);
}

export function normalizeModelCode(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/BUILD.*$/i, "")
    .replace(/\s+/g, " ")
    .replace(/[^A-Z0-9+\- ]/g, "")
    .trim();

  return normalized.length ? normalized : null;
}

export function parseModelFromUserAgent(userAgent: string): string | null {
  const androidMatch = userAgent.match(/Android\s[\d.]+;\s*([^;]+?)\sBuild/i);
  if (androidMatch?.[1]) {
    return androidMatch[1].trim();
  }

  if (/iPhone/i.test(userAgent)) {
    return "iPhone";
  }

  if (/iPad/i.test(userAgent)) {
    return "iPad";
  }

  return null;
}

export function inferBrand(model: string | null, userAgent: string): string | null {
  const source = `${model ?? ""} ${userAgent}`.toLowerCase();

  if (source.includes("sm-") || source.includes("samsung")) {
    return "Samsung";
  }

  if (source.includes("pixel") || source.includes("google")) {
    return "Google";
  }

  if (source.includes("xiaomi") || source.includes("redmi") || source.includes("mi ")) {
    return "Xiaomi";
  }

  if (source.includes("iphone") || source.includes("ipad") || source.includes("apple")) {
    return "Apple";
  }

  return null;
}

function createFingerprint(params: {
  model: string | null;
  platform: string | null;
  source: "ua-ch" | "ua-string" | "none";
  quality: "exact" | "partial" | "unavailable";
  userAgent: string;
}): DeviceFingerprint {
  const normalizedModel = normalizeModelCode(params.model);

  return {
    model: params.model,
    normalizedModel,
    platform: params.platform,
    quality: params.quality,
    source: params.source,
    userAgent: params.userAgent,
    brand: inferBrand(normalizedModel ?? params.model, params.userAgent),
  };
}

export async function collectDeviceFingerprint(): Promise<DeviceFingerprint> {
  const ua = navigator.userAgent;

  if (navigator.userAgentData?.getHighEntropyValues) {
    try {
      const values = await navigator.userAgentData.getHighEntropyValues(["model", "platform"]);
      const model = values.model?.trim() || null;
      const platform = values.platform?.trim() || null;

      if (model) {
        return createFingerprint({
          model,
          platform,
          source: "ua-ch",
          quality: "exact",
          userAgent: ua,
        });
      }

      const fallbackModel = parseModelFromUserAgent(ua);
      if (fallbackModel) {
        return createFingerprint({
          model: fallbackModel,
          platform,
          source: "ua-string",
          quality: "partial",
          userAgent: ua,
        });
      }

      return createFingerprint({
        model: null,
        platform,
        source: "none",
        quality: "unavailable",
        userAgent: ua,
      });
    } catch {
      // Falls through to UA parsing.
    }
  }

  const modelFromUa = parseModelFromUserAgent(ua);
  if (modelFromUa) {
    return createFingerprint({
      model: modelFromUa,
      platform: null,
      source: "ua-string",
      quality: "partial",
      userAgent: ua,
    });
  }

  return createFingerprint({
    model: null,
    platform: null,
    source: "none",
    quality: "unavailable",
    userAgent: ua,
  });
}
