/**
 * Coleta o máximo de características possíveis do aparelho/navegador para
 * identificação futura (quando não temos o nome do modelo).
 * Tudo em um objeto serializável (JSON) para exportar/copiar.
 */

const HIGH_ENTROPY_HINTS = [
  "architecture",
  "bitness",
  "deviceMemory",
  "formFactors",
  "fullVersionList",
  "model",
  "platformVersion",
  "uaFullVersion",
  "wow64",
] as const;

const UNMASKED_VENDOR_WEBGL = 0x9245;
const UNMASKED_RENDERER_WEBGL = 0x9246;

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function getNavigatorSnapshot(): Record<string, unknown> {
  const n = typeof navigator !== "undefined" ? navigator : ({} as Navigator);
  const nav = n as Navigator & { buildID?: string; oscpu?: string; productSub?: string; product?: string };
  return {
    userAgent: typeof n.userAgent === "string" ? n.userAgent : undefined,
    appVersion: typeof n.appVersion === "string" ? n.appVersion : undefined,
    platform: typeof n.platform === "string" ? n.platform : undefined,
    vendor: typeof n.vendor === "string" ? n.vendor : undefined,
    language: typeof n.language === "string" ? n.language : undefined,
    languages: Array.isArray(n.languages) ? [...n.languages] : undefined,
    hardwareConcurrency: typeof n.hardwareConcurrency === "number" ? n.hardwareConcurrency : undefined,
    maxTouchPoints: typeof n.maxTouchPoints === "number" ? n.maxTouchPoints : undefined,
    cookieEnabled: typeof n.cookieEnabled === "boolean" ? n.cookieEnabled : undefined,
    doNotTrack: typeof n.doNotTrack === "string" ? n.doNotTrack : undefined,
    onLine: typeof n.onLine === "boolean" ? n.onLine : undefined,
    pdfViewerEnabled:
      typeof (n as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled === "boolean"
        ? (n as Navigator & { pdfViewerEnabled: boolean }).pdfViewerEnabled
        : undefined,
    product: typeof nav.product === "string" ? nav.product : undefined,
    productSub: typeof nav.productSub === "string" ? nav.productSub : undefined,
    buildID: typeof nav.buildID === "string" ? nav.buildID : undefined,
    oscpu: typeof nav.oscpu === "string" ? nav.oscpu : undefined,
  };
}

async function getUserAgentDataSnapshot(): Promise<Record<string, unknown>> {
  if (typeof navigator === "undefined" || typeof navigator.userAgentData?.getHighEntropyValues !== "function") {
    return { available: false };
  }
  try {
    const values = await navigator.userAgentData.getHighEntropyValues([...HIGH_ENTROPY_HINTS]);
    return {
      available: true,
      brands: values.brands,
      mobile: values.mobile,
      platform: values.platform,
      architecture: values.architecture,
      bitness: values.bitness,
      deviceMemory: values.deviceMemory,
      formFactors: values.formFactors,
      fullVersionList: values.fullVersionList,
      model: values.model,
      platformVersion: values.platformVersion,
      uaFullVersion: values.uaFullVersion,
      wow64: values.wow64,
    };
  } catch (e) {
    return { available: true, error: String(e) };
  }
}

function getScreenSnapshot(): Record<string, unknown> {
  if (typeof screen === "undefined") return {};
  const s = screen as Screen & { orientation?: { type?: string; angle?: number }; pixelDepth?: number };
  return {
    width: typeof s.width === "number" ? s.width : undefined,
    height: typeof s.height === "number" ? s.height : undefined,
    availWidth: typeof s.availWidth === "number" ? s.availWidth : undefined,
    availHeight: typeof s.availHeight === "number" ? s.availHeight : undefined,
    colorDepth: typeof s.colorDepth === "number" ? s.colorDepth : undefined,
    pixelDepth: typeof s.pixelDepth === "number" ? s.pixelDepth : undefined,
    orientation:
      s.orientation != null
        ? {
            type: s.orientation?.type,
            angle: s.orientation?.angle,
          }
        : undefined,
  };
}

function getWindowSnapshot(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  return {
    devicePixelRatio: typeof window.devicePixelRatio === "number" ? window.devicePixelRatio : undefined,
    innerWidth: typeof window.innerWidth === "number" ? window.innerWidth : undefined,
    innerHeight: typeof window.innerHeight === "number" ? window.innerHeight : undefined,
    outerWidth: typeof window.outerWidth === "number" ? window.outerWidth : undefined,
    outerHeight: typeof window.outerHeight === "number" ? window.outerHeight : undefined,
    screenX: typeof window.screenX === "number" ? window.screenX : undefined,
    screenY: typeof window.screenY === "number" ? window.screenY : undefined,
  };
}

function getWebGlSnapshot(): Record<string, unknown> {
  return safe(() => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl");
    if (!gl) return { available: false };
    const ext = (gl as WebGLRenderingContext & { getExtension(n: string): unknown }).getExtension("WEBGL_debug_renderer_info");
    if (!ext) return { available: true, extension: false };
    return {
      available: true,
      vendor: (gl as WebGLRenderingContext).getParameter(UNMASKED_VENDOR_WEBGL),
      renderer: (gl as WebGLRenderingContext).getParameter(UNMASKED_RENDERER_WEBGL),
    };
  }, { available: false });
}

function getSupportedConstraintsSnapshot(): Record<string, unknown> {
  if (typeof navigator?.mediaDevices?.getSupportedConstraints !== "function") return {};
  const c = safe(() => navigator.mediaDevices.getSupportedConstraints(), {} as MediaTrackSupportedConstraints);
  return c ? { ...c } : {};
}

async function getMediaDevicesSnapshot(): Promise<Record<string, unknown>> {
  if (typeof navigator?.mediaDevices?.enumerateDevices !== "function") return { devices: [] };
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      devices: devices.map((d) => ({
        kind: d.kind,
        deviceId: d.deviceId,
        groupId: (d as MediaDeviceInfo & { groupId?: string }).groupId,
        label: d.label,
      })),
    };
  } catch (e) {
    return { error: String(e) };
  }
}

function getTrackSnapshot(track: MediaStreamTrack | null | undefined): Record<string, unknown> {
  if (!track || typeof track.getSettings !== "function") return { hasTrack: false };
  try {
    const settings = track.getSettings();
    const capabilities =
      typeof track.getCapabilities === "function" ? track.getCapabilities() : {};
    const settingsObj: Record<string, unknown> = {};
    for (const key of Object.keys(settings)) {
      (settingsObj as Record<string, unknown>)[key] = (settings as Record<string, unknown>)[key];
    }
    const capsObj: Record<string, unknown> = {};
    for (const key of Object.keys(capabilities)) {
      (capsObj as Record<string, unknown>)[key] = (capabilities as Record<string, unknown>)[key];
    }
    return {
      hasTrack: true,
      settings: settingsObj,
      capabilities: capsObj,
    };
  } catch (e) {
    return { hasTrack: true, error: String(e) };
  }
}

function getConnectionSnapshot(): Record<string, unknown> {
  const nav = typeof navigator !== "undefined" ? navigator : ({} as Navigator);
  const conn = (nav as Navigator & { connection?: Record<string, unknown> }).connection;
  if (!conn) return {};
  return {
    effectiveType: (conn as { effectiveType?: string }).effectiveType,
    downlink: (conn as { downlink?: number }).downlink,
    rtt: (conn as { rtt?: number }).rtt,
    saveData: (conn as { saveData?: boolean }).saveData,
  };
}

async function getBatterySnapshot(): Promise<Record<string, unknown>> {
  const nav = typeof navigator !== "undefined" ? navigator : ({} as Navigator);
  const getBattery = (nav as Navigator & { getBattery?: () => Promise<{ charging: boolean; chargingTime: number; dischargingTime: number; level: number }> }).getBattery;
  if (typeof getBattery !== "function") return { available: false };
  try {
    const bat = await getBattery();
    return {
      available: true,
      charging: bat.charging,
      chargingTime: bat.chargingTime,
      dischargingTime: bat.dischargingTime,
      level: bat.level,
    };
  } catch (e) {
    return { available: true, error: String(e) };
  }
}

function getTimezoneSnapshot(): Record<string, unknown> {
  try {
    const opts = Intl.DateTimeFormat().resolvedOptions();
    return {
      timeZone: opts.timeZone,
      locale: opts.locale,
    };
  } catch {
    return {};
  }
}

export interface AllCharacteristicsResult {
  /** Preencher manualmente conforme as pessoas entram na aplicação. */
  Device_type: string;
  collectedAt: string;
  navigator: Record<string, unknown>;
  userAgentData: Record<string, unknown>;
  screen: Record<string, unknown>;
  window: Record<string, unknown>;
  webgl: Record<string, unknown>;
  mediaSupportedConstraints: Record<string, unknown>;
  mediaDevices: Record<string, unknown>;
  track: Record<string, unknown>;
  connection: Record<string, unknown>;
  battery: Record<string, unknown>;
  timezone: Record<string, unknown>;
}

/**
 * Coleta todas as características possíveis. Recebe opcionalmente a track
 * de vídeo ativa e o Device_type atual (para preservar ao re-coletar).
 */
export async function collectAllCharacteristics(
  activeVideoTrack?: MediaStreamTrack | null,
  existingDeviceType?: string
): Promise<AllCharacteristicsResult> {
  const [userAgentData, mediaDevices, battery] = await Promise.all([
    getUserAgentDataSnapshot(),
    getMediaDevicesSnapshot(),
    getBatterySnapshot(),
  ]);

  return {
    Device_type: existingDeviceType ?? "",
    collectedAt: new Date().toISOString(),
    navigator: getNavigatorSnapshot(),
    userAgentData,
    screen: getScreenSnapshot(),
    window: getWindowSnapshot(),
    webgl: getWebGlSnapshot(),
    mediaSupportedConstraints: getSupportedConstraintsSnapshot(),
    mediaDevices,
    track: getTrackSnapshot(activeVideoTrack ?? null),
    connection: getConnectionSnapshot(),
    battery,
    timezone: getTimezoneSnapshot(),
  };
}
