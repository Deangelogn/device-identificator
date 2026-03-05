import type { AllCharacteristicsResult } from "./allCharacteristics";

const STORAGE_KEY = "device-fov-identificator-db";
/** Flag para limpar o banco uma única vez (migração para formato por tipo). */
const ONE_TIME_CLEAR_FLAG = "device-fov-identificator-db-cleared-v2";

/** Registro armazenado: só dados do TIPO de aparelho (nome + chave), não do dispositivo específico. */
export interface DeviceTypeRecord {
  typeKey: string;
  Device_type: string;
  collectedAt: string;
}

export type DeviceDbMatchResult =
  | { action: "match"; record: DeviceTypeRecord }
  | { action: "added"; record: DeviceTypeRecord };

/**
 * Chave por TIPO/MODELO de celular (não por aparelho específico).
 * Usa só: tela, GPU, núcleos, modelo (UA-CH). Não usa deviceId, groupId, câmera
 * (câmera pode faltar se o usuário não abriu; assim dois S23 dão match mesmo um com câmera e outro sem).
 */
export function buildTypeKey(entry: AllCharacteristicsResult): string {
  const webgl = entry.webgl as { renderer?: string } | undefined;
  const screen = entry.screen as { width?: number; height?: number } | undefined;
  const nav = entry.navigator as { hardwareConcurrency?: number } | undefined;
  const ua = entry.userAgentData as { model?: string } | undefined;

  const key = {
    screenWidth: Number(screen?.width ?? 0),
    screenHeight: Number(screen?.height ?? 0),
    webglRenderer: String(webgl?.renderer ?? "").trim(),
    hardwareConcurrency: Number(nav?.hardwareConcurrency ?? 0),
    uaModel: String(ua?.model ?? "").trim().toLowerCase(),
  };
  return JSON.stringify(key);
}

/** Limpa o banco uma única vez (chamar no primeiro carregamento após o deploy). */
function oneTimeClearIfNeeded(): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (localStorage.getItem(ONE_TIME_CLEAR_FLAG)) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(ONE_TIME_CLEAR_FLAG, "1");
  } catch {
    // ignore
  }
}

export function getStoredDeviceTypes(): DeviceTypeRecord[] {
  oneTimeClearIfNeeded();
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as DeviceTypeRecord[];
  } catch {
    return [];
  }
}

function saveStoredDeviceTypes(records: DeviceTypeRecord[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // ignore
  }
}

export function findMatchingType(
  records: DeviceTypeRecord[],
  entry: AllCharacteristicsResult
): DeviceTypeRecord | null {
  const key = buildTypeKey(entry);
  return records.find((r) => r.typeKey === key) ?? null;
}

/**
 * Compara as características do TIPO (tela, GPU, núcleos, modelo) com o banco.
 * Se já existir um tipo igual, retorna o registro (match). Senão, adiciona um novo
 * registro só com typeKey + Device_type (não salva dados do dispositivo específico).
 */
export function addOrMatch(entry: AllCharacteristicsResult): DeviceDbMatchResult {
  const stored = getStoredDeviceTypes();
  const key = buildTypeKey(entry);
  const existing = findMatchingType(stored, entry);
  if (existing) {
    return { action: "match", record: existing };
  }
  const newRecord: DeviceTypeRecord = {
    typeKey: key,
    Device_type: entry.Device_type?.trim() ?? "",
    collectedAt: new Date().toISOString(),
  };
  saveStoredDeviceTypes([...stored, newRecord]);
  return { action: "added", record: newRecord };
}

/**
 * Atualiza o Device_type do registro que corresponde ao tipo das características atuais.
 */
export function updateStoredDeviceType(
  entry: AllCharacteristicsResult,
  deviceType: string
): boolean {
  const stored = getStoredDeviceTypes();
  const key = buildTypeKey(entry);
  const index = stored.findIndex((r) => r.typeKey === key);
  if (index < 0) return false;
  stored[index] = { ...stored[index], Device_type: deviceType };
  saveStoredDeviceTypes(stored);
  return true;
}
