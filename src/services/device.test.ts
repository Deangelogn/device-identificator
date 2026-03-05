import { afterEach, describe, expect, it, vi } from "vitest";
import {
  collectDeviceFingerprint,
  normalizeModelCode,
  parseModelFromUserAgent,
} from "./device";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("normalizeModelCode", () => {
  it("normalizes casing and strips noisy characters", () => {
    expect(normalizeModelCode(" sm-s926b build/abc123 ")).toBe("SM-S926B");
  });
});

describe("parseModelFromUserAgent", () => {
  it("extracts Android model from UA string", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; SM-S926B Build/UP1A.231005.007) AppleWebKit/537.36 Chrome/123.0";

    expect(parseModelFromUserAgent(ua)).toBe("SM-S926B");
  });
});

describe("collectDeviceFingerprint", () => {
  it("uses UA-CH model when available", async () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; SM-S926B Build/UP1A.231005.007) AppleWebKit/537.36 Chrome/123.0",
      userAgentData: {
        getHighEntropyValues: async () => ({
          model: "SM-S926B",
          platform: "Android",
        }),
      },
    });

    const result = await collectDeviceFingerprint();

    expect(result.model).toBe("SM-S926B");
    expect(result.quality).toBe("exact");
    expect(result.source).toBe("ua-ch");
  });

  it("falls back to UA parsing when UA-CH model is empty", async () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro Build/UP1A.231005.007) AppleWebKit/537.36 Chrome/123.0",
      userAgentData: {
        getHighEntropyValues: async () => ({
          model: "",
          platform: "Android",
        }),
      },
    });

    const result = await collectDeviceFingerprint();

    expect(result.model).toBe("Pixel 8 Pro");
    expect(result.quality).toBe("partial");
    expect(result.source).toBe("ua-string");
  });

  it("returns unavailable when no model can be inferred", async () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/123.0 Safari/537.36",
    });

    const result = await collectDeviceFingerprint();

    expect(result.model).toBeNull();
    expect(result.quality).toBe("unavailable");
  });
});
