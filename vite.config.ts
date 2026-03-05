/// <reference types="vitest/config" />

import basicSsl from "@vitejs/plugin-basic-ssl";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type PluginOption } from "vite";

function getLanIpv4(): string | null {
  const interfaces = os.networkInterfaces();

  for (const netList of Object.values(interfaces)) {
    for (const net of netList ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }

  return null;
}

function lanHintPlugin() {
  return {
    name: "lan-url-hint",
    configureServer(server: import("vite").ViteDevServer) {
      server.httpServer?.once("listening", () => {
        const lanIp = getLanIpv4();
        const addr = server.httpServer?.address();
        const port = typeof addr === "object" && addr ? addr.port : server.config.server.port ?? 5173;
        const protocol = server.config.server.https ? "https" : "http";

        if (lanIp) {
          // Extra LAN hint for opening directly on mobile.
          console.info(`\n[device-fov] Abra no celular: ${protocol}://${lanIp}:${port}\n`);
        }
      });
    },
  };
}

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const certDir = path.resolve(rootDir, "certs");
const certPath = path.resolve(certDir, "lan-cert.pem");
const keyPath = path.resolve(certDir, "lan-key.pem");

const hasCustomCert = fs.existsSync(certPath) && fs.existsSync(keyPath);
const httpsConfig: Record<string, Buffer> = hasCustomCert
  ? {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    }
  : {};

if (!hasCustomCert) {
  console.warn(
    "[device-fov] Certificado custom não encontrado em certs/. Rodando com HTTPS autoassinado do Vite."
  );
}

const plugins = [lanHintPlugin()];
const typedPlugins: PluginOption[] = [...plugins];

if (!hasCustomCert) {
  typedPlugins.unshift(basicSsl());
}

export default defineConfig({
  plugins: typedPlugins,
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    https: httpsConfig,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
    https: httpsConfig,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    globals: true,
  },
});
