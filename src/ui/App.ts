import type { CameraDescriptor, DeviceFingerprint, FovEstimate, WebXrMeasurement } from "../domain/types";
import { collectAllCharacteristics, type AllCharacteristicsResult } from "../services/allCharacteristics";
import { startCamera, stopStream } from "../services/camera";
import { addOrMatch, updateStoredDeviceType, type DeviceDbMatchResult } from "../services/deviceDb";
import { collectDeviceFingerprint, isMobile } from "../services/device";
import { estimateFov } from "../services/fov";
import {
  collectIdentificationExtras,
  fillDeviceMemory,
  type IdentificationExtras,
} from "../services/identificationExtras";
import { captureWebXrMeasurement } from "../services/webxr";

interface AppState {
  loading: boolean;
  error: string | null;
  device: DeviceFingerprint | null;
  stream: MediaStream | null;
  cameras: CameraDescriptor[];
  activeCamera: CameraDescriptor | null;
  estimate: FovEstimate | null;
  webxr: WebXrMeasurement | null;
  lastUpdatedAt: Date | null;
  identificationExtras: IdentificationExtras | null;
  allCharacteristics: AllCharacteristicsResult | null;
  allCharacteristicsLoading: boolean;
  /** Resultado da comparação com o banco (match = já existe e exibimos o nome; added = novo). */
  dbMatch: DeviceDbMatchResult | null;
}

const qualityLabel: Record<string, string> = {
  exact: "Exato",
  partial: "Parcial",
  unavailable: "Indisponível",
};

export function mountApp(root: HTMLElement): void {
  if (!isMobile()) {
    root.innerHTML = `
    <main class="app-shell">
      <header class="hero">
        <p class="eyebrow">Device FOV Identificator</p>
        <h1>Disponível apenas em dispositivos móveis</h1>
        <p class="subtitle">Acesse esta página pelo celular ou tablet para ver o modelo do dispositivo, FOV da câmera e demais características.</p>
      </header>
    </main>
    `;
    return;
  }

  const state: AppState = {
    loading: false,
    error: null,
    device: null,
    stream: null,
    cameras: [],
    activeCamera: null,
    estimate: null,
    webxr: null,
    lastUpdatedAt: null,
    identificationExtras: null,
    allCharacteristics: null,
    allCharacteristicsLoading: false,
    dbMatch: null,
  };

  root.innerHTML = `
    <main class="app-shell">
      <header class="hero">
        <div>
          <p class="eyebrow">Device FOV Identificator</p>
          <h1>Modelo do celular + FOV da câmera em uso</h1>
          <p class="subtitle">Pipeline automático: WebXR, catálogo local e heurística técnica.</p>
        </div>
        <div class="hero-actions">
          <button id="startBtn" class="btn btn-primary">Iniciar câmera</button>
          <button id="refreshBtn" class="btn btn-secondary" disabled>Atualizar estimativa</button>
        </div>
      </header>

      <section class="grid">
        <article class="card preview-card">
          <div class="card-header">
            <h2>Preview</h2>
            <span id="previewTag" class="tag">Sem stream</span>
          </div>
          <div class="video-wrap">
            <video id="preview" autoplay playsinline muted></video>
            <div id="videoOverlay" class="video-overlay">Aguardando inicialização...</div>
          </div>
          <div class="control-row">
            <label for="cameraSelect">Câmera ativa</label>
            <select id="cameraSelect" disabled></select>
          </div>
          <div id="resolutionCard" class="resolution-card">
            <h3>Resolução do frame (atual)</h3>
            <p id="resolutionValue" class="resolution-value">-</p>
            <h3 class="resolution-max-label">Resolução mín. / máx. (getCapabilities)</h3>
            <p id="resolutionMinValue" class="resolution-value">-</p>
            <p id="resolutionMaxValue" class="resolution-value">-</p>
            <p id="resolutionMaxNote" class="resolution-note">Orientação de referência do sensor; pode não coincidir com a tela (retrato/paisagem).</p>
            <h3 class="resolution-max-label">Frame rate</h3>
            <p id="frameRateValue" class="resolution-value">-</p>
            <h3 class="resolution-max-label">Aspect ratio (atual)</h3>
            <p id="aspectRatioValue" class="resolution-value">-</p>
            <h3 class="resolution-max-label">Tela do dispositivo</h3>
            <p id="screenPhysicalValue" class="resolution-value">-</p>
            <p id="screenViewportValue" class="resolution-note">-</p>
            <h3 class="resolution-max-label">Ambiente (Screen / Navigator)</h3>
            <p id="envValue" class="resolution-note">-</p>
            <h3 class="resolution-max-label">Identificação do aparelho</h3>
            <p id="cameraDeviceId" class="resolution-note">-</p>
            <p id="cameraGroupId" class="resolution-note">-</p>
            <p id="resizeModeValue" class="resolution-note">-</p>
            <p id="camerasListValue" class="resolution-note">-</p>
            <p id="webglValue" class="resolution-note">-</p>
            <p id="hwValue" class="resolution-note">-</p>
          </div>
        </article>

        <article class="card export-card">
          <div class="card-header">
            <h2>Todas as características (para identificação futura)</h2>
          </div>
          <p class="resolution-note">Coleta o máximo de dados possíveis do aparelho e navegador. Use para identificar o modelo depois.</p>
          <div id="dbMatchMessage" class="db-match-message hidden"></div>
          <div class="control-row">
            <label for="deviceTypeInput">Device_type (preencher manualmente)</label>
            <input id="deviceTypeInput" type="text" placeholder="Ex.: Moto G31, Galaxy S23..." class="device-type-input" />
          </div>
          <div class="control-row">
            <button id="collectAllBtn" class="btn btn-secondary">Coletar todas</button>
            <button id="copyAllBtn" class="btn btn-secondary" disabled>Copiar JSON</button>
          </div>
          <pre id="allCharacteristicsJson" class="all-chars-json"></pre>
        </article>

        <article class="card metrics-card">
          <div class="card-header">
            <h2>Telemetria</h2>
            <span id="confidenceBadge" class="tag tag-neutral">Sem leitura</span>
          </div>
          <dl class="stats">
            <div>
              <dt>Modelo</dt>
              <dd id="modelValue">-</dd>
            </div>
            <div>
              <dt>Qualidade identificação</dt>
              <dd id="modelQuality">-</dd>
            </div>
            <div>
              <dt>Câmera/lente</dt>
              <dd id="cameraValue">-</dd>
            </div>
            <div>
              <dt>FOV horizontal</dt>
              <dd id="fovValue">-</dd>
            </div>
            <div>
              <dt>Incerteza</dt>
              <dd id="uncertaintyValue">-</dd>
            </div>
            <div>
              <dt>Fonte principal</dt>
              <dd id="sourceValue">-</dd>
            </div>
            <div>
              <dt>Score</dt>
              <dd id="scoreValue">-</dd>
            </div>
            <div>
              <dt>WebXR</dt>
              <dd id="webxrValue">-</dd>
            </div>
          </dl>
          <div id="warningBox" class="warning hidden"></div>
          <div>
            <h3>Racional técnico</h3>
            <ul id="reasoningList" class="reasoning"></ul>
          </div>
          <div>
            <h3>Candidatos avaliados</h3>
            <ul id="candidateList" class="candidates"></ul>
          </div>
          <p id="lastUpdate" class="timestamp">Sem atualização.</p>
        </article>
      </section>

      <p id="errorText" class="error hidden"></p>
    </main>
  `;

  function getRequiredElement<TElement extends Element>(selector: string): TElement {
    const element = root.querySelector<TElement>(selector);
    if (!element) {
      throw new Error(`Falha ao montar interface (${selector}).`);
    }

    return element;
  }

  const startBtn = getRequiredElement<HTMLButtonElement>("#startBtn");
  const refreshBtn = getRequiredElement<HTMLButtonElement>("#refreshBtn");
  const cameraSelect = getRequiredElement<HTMLSelectElement>("#cameraSelect");
  const preview = getRequiredElement<HTMLVideoElement>("#preview");

  const previewTag = getRequiredElement<HTMLSpanElement>("#previewTag");
  const modelValue = getRequiredElement<HTMLElement>("#modelValue");
  const modelQuality = getRequiredElement<HTMLElement>("#modelQuality");
  const cameraValue = getRequiredElement<HTMLElement>("#cameraValue");
  const fovValue = getRequiredElement<HTMLElement>("#fovValue");
  const uncertaintyValue = getRequiredElement<HTMLElement>("#uncertaintyValue");
  const sourceValue = getRequiredElement<HTMLElement>("#sourceValue");
  const scoreValue = getRequiredElement<HTMLElement>("#scoreValue");
  const webxrValue = getRequiredElement<HTMLElement>("#webxrValue");
  const errorText = getRequiredElement<HTMLElement>("#errorText");
  const warningBox = getRequiredElement<HTMLElement>("#warningBox");
  const reasoningList = getRequiredElement<HTMLElement>("#reasoningList");
  const candidateList = getRequiredElement<HTMLElement>("#candidateList");
  const confidenceBadge = getRequiredElement<HTMLElement>("#confidenceBadge");
  const videoOverlay = getRequiredElement<HTMLElement>("#videoOverlay");
  const lastUpdate = getRequiredElement<HTMLElement>("#lastUpdate");
  const resolutionValue = getRequiredElement<HTMLElement>("#resolutionValue");
  const resolutionMinValue = getRequiredElement<HTMLElement>("#resolutionMinValue");
  const resolutionMaxValue = getRequiredElement<HTMLElement>("#resolutionMaxValue");
  const resolutionMaxNote = getRequiredElement<HTMLElement>("#resolutionMaxNote");
  const frameRateValue = getRequiredElement<HTMLElement>("#frameRateValue");
  const aspectRatioValue = getRequiredElement<HTMLElement>("#aspectRatioValue");
  const screenPhysicalValue = getRequiredElement<HTMLElement>("#screenPhysicalValue");
  const screenViewportValue = getRequiredElement<HTMLElement>("#screenViewportValue");
  const envValue = getRequiredElement<HTMLElement>("#envValue");
  const cameraDeviceId = getRequiredElement<HTMLElement>("#cameraDeviceId");
  const cameraGroupId = getRequiredElement<HTMLElement>("#cameraGroupId");
  const resizeModeValue = getRequiredElement<HTMLElement>("#resizeModeValue");
  const camerasListValue = getRequiredElement<HTMLElement>("#camerasListValue");
  const webglValue = getRequiredElement<HTMLElement>("#webglValue");
  const hwValue = getRequiredElement<HTMLElement>("#hwValue");
  const dbMatchMessage = getRequiredElement<HTMLElement>("#dbMatchMessage");
  const deviceTypeInput = getRequiredElement<HTMLInputElement>("#deviceTypeInput");
  const collectAllBtn = getRequiredElement<HTMLButtonElement>("#collectAllBtn");
  const copyAllBtn = getRequiredElement<HTMLButtonElement>("#copyAllBtn");
  const allCharacteristicsJson = getRequiredElement<HTMLPreElement>("#allCharacteristicsJson");

  function setLoading(value: boolean): void {
    state.loading = value;
    startBtn.disabled = value;
    refreshBtn.disabled = value || !state.stream;
    cameraSelect.disabled = value || state.cameras.length === 0;
    startBtn.textContent = value ? "Iniciando..." : state.stream ? "Reiniciar câmera" : "Iniciar câmera";
  }

  function updateEstimate(): void {
    if (!state.device || !state.activeCamera) {
      state.estimate = null;
      return;
    }

    state.estimate = estimateFov({
      fingerprint: state.device,
      camera: state.activeCamera,
      webxrMeasurement: state.webxr,
    });

    state.lastUpdatedAt = new Date();
  }

  async function runPipeline(options: { deviceId?: string; tryWebxr: boolean }): Promise<void> {
    setLoading(true);
    state.error = null;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Navegador sem suporte a getUserMedia.");
      }

      stopStream(state.stream);

      const capture = await startCamera(
        options.deviceId
          ? { deviceId: options.deviceId }
          : { preferFrontCamera: true }
      );
      state.stream = capture.stream;
      state.cameras = capture.cameras;
      state.activeCamera = capture.activeCamera;

      preview.srcObject = capture.stream;
      await preview.play().catch(() => undefined);

      if (options.tryWebxr) {
        state.webxr = await captureWebXrMeasurement();
      }

      updateEstimate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado ao iniciar câmera.";
      state.error = message;
      state.estimate = null;
    } finally {
      setLoading(false);
      render();
    }
  }

  function renderCameraSelect(): void {
    const selected = state.activeCamera?.deviceId ?? "";
    cameraSelect.innerHTML = "";

    state.cameras.forEach((camera) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.textContent = `${camera.label} (${camera.lensType})`;
      option.selected = camera.deviceId === selected;
      cameraSelect.append(option);
    });

    cameraSelect.disabled = state.loading || state.cameras.length <= 1;
  }

  function renderReasoning(): void {
    reasoningList.innerHTML = "";
    const entries = state.estimate?.reasoning ?? ["Inicie a câmera para gerar uma leitura automática."];

    for (const item of entries) {
      const li = document.createElement("li");
      li.textContent = item;
      reasoningList.append(li);
    }
  }

  function renderCandidates(): void {
    candidateList.innerHTML = "";

    if (!state.estimate) {
      const li = document.createElement("li");
      li.textContent = "Sem candidatos ainda.";
      candidateList.append(li);
      return;
    }

    for (const candidate of state.estimate.candidates.slice(0, 4)) {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${candidate.source}</strong> · ${candidate.fovHDeg.toFixed(1)}° · score ${candidate.score.toFixed(2)}<br/><small>${candidate.details}</small>`;
      candidateList.append(li);
    }
  }

  function renderWarning(): void {
    warningBox.classList.add("hidden");

    if (!state.estimate) {
      return;
    }

    if (state.estimate.confidence === "Baixa") {
      warningBox.textContent =
        "Confiança baixa: estimativa exibida para continuidade operacional, mas com maior risco de desvio de FOV real.";
      warningBox.classList.remove("hidden");
    }
  }

  function render(): void {
    renderCameraSelect();
    renderReasoning();
    renderCandidates();
    renderWarning();

    const model = state.device?.model ?? "Indisponível";
    const modelSource = state.device?.source === "ua-ch" ? "UA-CH" : state.device?.source === "ua-string" ? "User-Agent" : "Sem dado";

    modelValue.textContent = `${model} (${modelSource})`;
    modelQuality.textContent = state.device ? qualityLabel[state.device.quality] : "-";

    if (state.activeCamera) {
      const zoom = state.activeCamera.zoom.current ? `${state.activeCamera.zoom.current.toFixed(2)}x` : "-";
      const resolution =
        state.activeCamera.resolution.width && state.activeCamera.resolution.height
          ? `${state.activeCamera.resolution.width} × ${state.activeCamera.resolution.height}`
          : "-";

      cameraValue.textContent = `${state.activeCamera.label} · ${state.activeCamera.lensType} · zoom ${zoom} · ${resolution}`;
      previewTag.textContent = `${state.activeCamera.lensType.toUpperCase()} ativa`;
      videoOverlay.textContent = state.activeCamera.label;
      resolutionValue.textContent = resolution;
      const minRes = state.activeCamera.resolutionMin;
      resolutionMinValue.textContent =
        minRes?.width != null && minRes?.height != null
          ? `${minRes.width} × ${minRes.height}`
          : minRes?.width != null || minRes?.height != null
            ? `${minRes.width ?? "?"} × ${minRes.height ?? "?"}`
            : "-";
      const maxRes = state.activeCamera.resolutionMax;
      resolutionMaxValue.textContent =
        maxRes?.width != null && maxRes?.height != null
          ? `${maxRes.width} × ${maxRes.height}`
          : maxRes?.width != null || maxRes?.height != null
            ? `${maxRes.width ?? "?"} × ${maxRes.height ?? "?"}`
            : "-";
      const fr = state.activeCamera.frameRate;
      const frRange = state.activeCamera.frameRateRange;
      frameRateValue.textContent =
        fr != null
          ? frRange?.min != null || frRange?.max != null
            ? `${fr} fps (min: ${frRange.min ?? "?"} / max: ${frRange.max ?? "?"})`
            : `${fr} fps`
          : "-";
      aspectRatioValue.textContent =
        state.activeCamera.aspectRatio != null
          ? String(state.activeCamera.aspectRatio)
          : "-";
      const orient = window.innerHeight > window.innerWidth ? "retrato" : "paisagem";
      const dpr = window.devicePixelRatio ?? 1;
      const physW = Math.round(window.innerWidth * dpr);
      const physH = Math.round(window.innerHeight * dpr);
      screenPhysicalValue.textContent = `${physW} × ${physH} (${orient})`;
      screenViewportValue.textContent = `Viewport CSS: ${window.innerWidth} × ${window.innerHeight} · devicePixelRatio: ${dpr}`;
    } else {
      cameraValue.textContent = "-";
      previewTag.textContent = "Sem stream";
      videoOverlay.textContent = "Aguardando inicialização...";
      resolutionValue.textContent = "-";
      resolutionMinValue.textContent = "-";
      resolutionMaxValue.textContent = "-";
      frameRateValue.textContent = "-";
      aspectRatioValue.textContent = "-";
      const orient = window.innerHeight > window.innerWidth ? "retrato" : "paisagem";
      const dpr = window.devicePixelRatio ?? 1;
      const physW = Math.round(window.innerWidth * dpr);
      const physH = Math.round(window.innerHeight * dpr);
      screenPhysicalValue.textContent = `${physW} × ${physH} (${orient})`;
      screenViewportValue.textContent = `Viewport CSS: ${window.innerWidth} × ${window.innerHeight} · devicePixelRatio: ${dpr}`;
    }

    const screenOrientation =
      typeof (screen as Screen & { orientation?: { type?: string; angle?: number } }).orientation !== "undefined"
        ? (screen as Screen & { orientation: { type?: string; angle?: number } }).orientation
        : null;
    const orientType = screenOrientation?.type ?? "-";
    const orientAngle = screenOrientation?.angle != null ? `${screenOrientation.angle}°` : "-";
    const colorDepth = typeof screen.colorDepth === "number" ? `${screen.colorDepth} bits` : "-";
    const maxTouchPoints = typeof navigator.maxTouchPoints === "number" ? navigator.maxTouchPoints : "-";
    envValue.textContent = `Orientation: ${orientType} (ângulo ${orientAngle}) · colorDepth: ${colorDepth} · maxTouchPoints: ${maxTouchPoints}`;

    if (!state.identificationExtras) {
      state.identificationExtras = collectIdentificationExtras();
      fillDeviceMemory(state.identificationExtras).then((filled) => {
        state.identificationExtras = filled;
        render();
      });
    }
    const ex = state.identificationExtras;
    cameraDeviceId.textContent =
      state.activeCamera?.deviceId != null ? `deviceId: ${state.activeCamera.deviceId}` : "-";
    cameraGroupId.textContent =
      state.activeCamera?.groupId != null ? `groupId: ${state.activeCamera.groupId}` : "-";
    resizeModeValue.textContent =
      state.activeCamera?.resizeMode != null ? `resizeMode: ${state.activeCamera.resizeMode}` : "-";
    camerasListValue.textContent =
      state.cameras.length > 0
        ? `${state.cameras.length} câmera(s): ${state.cameras.map((c) => c.label).join(", ")}`
        : "-";
    webglValue.textContent =
      ex != null
        ? `Vendor: ${ex.webgl.vendor ?? "-"} · Renderer: ${ex.webgl.renderer ?? "-"}`
        : "-";
    hwValue.textContent =
      ex != null
        ? `CPU cores: ${ex.hardwareConcurrency ?? "-"} · RAM (Client Hint): ${ex.deviceMemory != null ? ex.deviceMemory + " GB" : "-"} · screen (lógico): ${ex.screenLogical ? `${ex.screenLogical.width}×${ex.screenLogical.height}` : "-"} · navigator.vendor: ${ex.navigatorVendor ?? "-"}`
        : "-";

    if (state.estimate) {
      fovValue.textContent = `${state.estimate.fovHDeg.toFixed(1)}°`;
      uncertaintyValue.textContent = `±${state.estimate.uncertaintyDeg.toFixed(1)}°`;
      sourceValue.textContent = state.estimate.source;
      scoreValue.textContent = state.estimate.score.toFixed(2);
      confidenceBadge.textContent = `Confiança ${state.estimate.confidence}`;
      confidenceBadge.className = `tag ${
        state.estimate.confidence === "Alta"
          ? "tag-high"
          : state.estimate.confidence === "Média"
            ? "tag-medium"
            : "tag-low"
      }`;
    } else {
      fovValue.textContent = "-";
      uncertaintyValue.textContent = "-";
      sourceValue.textContent = "-";
      scoreValue.textContent = "-";
      confidenceBadge.textContent = "Sem leitura";
      confidenceBadge.className = "tag tag-neutral";
    }

    if (state.webxr?.available) {
      webxrValue.textContent = `${state.webxr.fovH?.toFixed(1)}° (capturado)`;
    } else if (state.webxr?.attempted) {
      webxrValue.textContent = state.webxr.reason ?? "Indisponível";
    } else {
      webxrValue.textContent = state.webxr?.reason ?? "Não tentado";
    }

    if (state.error) {
      errorText.classList.remove("hidden");
      errorText.textContent = state.error;
    } else {
      errorText.classList.add("hidden");
      errorText.textContent = "";
    }

    if (state.lastUpdatedAt) {
      lastUpdate.textContent = `Última atualização: ${state.lastUpdatedAt.toLocaleTimeString("pt-BR")}`;
    } else {
      lastUpdate.textContent = "Sem atualização.";
    }

    collectAllBtn.disabled = state.allCharacteristicsLoading;
    collectAllBtn.textContent = state.allCharacteristicsLoading ? "Coletando..." : "Coletar todas";
    copyAllBtn.disabled = !state.allCharacteristics;

    if (state.dbMatch) {
      dbMatchMessage.classList.remove("hidden");
      if (state.dbMatch.action === "match") {
        const name = state.dbMatch.record.Device_type?.trim() || "(sem nome no banco)";
        dbMatchMessage.textContent = `Mesmo tipo de celular no banco: ${name}`;
        dbMatchMessage.className = "db-match-message db-match-found";
      } else {
        dbMatchMessage.textContent = "Novo tipo de celular — adicionado ao banco.";
        dbMatchMessage.className = "db-match-message db-match-added";
      }
    } else {
      dbMatchMessage.classList.add("hidden");
      dbMatchMessage.textContent = "";
    }

    if (state.allCharacteristics) {
      allCharacteristicsJson.textContent = JSON.stringify(state.allCharacteristics, null, 2);
    } else {
      allCharacteristicsJson.textContent = state.allCharacteristicsLoading
        ? "Coletando..."
        : "Clique em \"Coletar todas\" para gerar o JSON com todas as características.";
    }
  }

  async function bootstrap(): Promise<void> {
    state.device = await collectDeviceFingerprint();
    render();
    try {
      state.allCharacteristics = await collectAllCharacteristics(undefined, undefined);
      const result = addOrMatch(state.allCharacteristics);
      state.dbMatch = result;
      if (result.action === "match" && result.record.Device_type) {
        state.allCharacteristics.Device_type = result.record.Device_type;
        deviceTypeInput.value = result.record.Device_type;
      } else {
        deviceTypeInput.value = state.allCharacteristics.Device_type ?? "";
      }
      render();
    } catch {
      state.allCharacteristics = {
        Device_type: "",
        collectedAt: new Date().toISOString(),
        navigator: {},
        userAgentData: { available: false },
        screen: {},
        window: {},
        webgl: {},
        mediaSupportedConstraints: {},
        mediaDevices: {},
        track: { hasTrack: false },
        connection: {},
        battery: {},
        timezone: {},
      };
      state.dbMatch = null;
      deviceTypeInput.value = "";
      render();
    }
  }

  function applyDbMatchAfterCollect(): void {
    if (!state.allCharacteristics) return;
    const result = addOrMatch(state.allCharacteristics);
    state.dbMatch = result;
    if (result.action === "match" && result.record.Device_type) {
      state.allCharacteristics.Device_type = result.record.Device_type;
      deviceTypeInput.value = result.record.Device_type;
    }
  }

  startBtn.addEventListener("click", () => {
    void runPipeline({
      deviceId: cameraSelect.value || undefined,
      tryWebxr: true,
    });
  });

  refreshBtn.addEventListener("click", async () => {
    if (!state.activeCamera?.deviceId) {
      return;
    }

    await runPipeline({
      deviceId: state.activeCamera.deviceId,
      tryWebxr: false,
    });
  });

  cameraSelect.addEventListener("change", async () => {
    const deviceId = cameraSelect.value;
    if (!deviceId) {
      return;
    }

    await runPipeline({
      deviceId,
      tryWebxr: false,
    });
  });

  window.addEventListener("beforeunload", () => {
    stopStream(state.stream);
  });

  collectAllBtn.addEventListener("click", async () => {
    const preserveDeviceType = state.allCharacteristics?.Device_type ?? "";
    state.allCharacteristicsLoading = true;
    state.allCharacteristics = null;
    render();
    try {
      const track = state.stream?.getVideoTracks()[0] ?? undefined;
      state.allCharacteristics = await collectAllCharacteristics(track, preserveDeviceType);
      applyDbMatchAfterCollect();
      deviceTypeInput.value = state.allCharacteristics.Device_type ?? "";
    } catch (e) {
      state.allCharacteristics = {
        Device_type: preserveDeviceType,
        collectedAt: new Date().toISOString(),
        navigator: {},
        userAgentData: { available: false, error: String(e) },
        screen: {},
        window: {},
        webgl: {},
        mediaSupportedConstraints: {},
        mediaDevices: {},
        track: { hasTrack: false },
        connection: {},
        battery: {},
        timezone: {},
      };
      deviceTypeInput.value = state.allCharacteristics.Device_type ?? "";
    } finally {
      state.allCharacteristicsLoading = false;
      render();
    }
  });

  deviceTypeInput.addEventListener("input", () => {
    if (state.allCharacteristics) {
      const value = deviceTypeInput.value;
      state.allCharacteristics.Device_type = value;
      updateStoredDeviceType(state.allCharacteristics, value);
      render();
    }
  });

  copyAllBtn.addEventListener("click", () => {
    if (!state.allCharacteristics) return;
    const json = JSON.stringify(state.allCharacteristics, null, 2);
    navigator.clipboard.writeText(json).then(
      () => {
        copyAllBtn.textContent = "Copiado!";
        setTimeout(() => {
          copyAllBtn.textContent = "Copiar JSON";
        }, 1500);
      },
      () => {
        copyAllBtn.textContent = "Erro ao copiar";
        setTimeout(() => {
          copyAllBtn.textContent = "Copiar JSON";
        }, 1500);
      }
    );
  });

  void bootstrap();
}
