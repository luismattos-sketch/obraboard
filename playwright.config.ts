import { existsSync } from "node:fs";
import Module from "node:module";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// O helper de admin importa "server-only", que lan�a fora do Next: usa o mesmo stub do vitest.
const resolver = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })._resolveFilename;
(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (request: string, ...resto: unknown[]) {
  if (request === "server-only") return path.resolve("tests/stubs/server-only.ts");
  return resolver.call(this, request, ...resto);
};

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  // Um único projeto: o contexto móvel (Pixel 7) do encarregado é criado dentro do teste.
  projects: [
    { name: "Desktop Chrome", testDir: "./tests/e2e", use: { ...devices["Desktop Chrome"] } },
    // Roteiro das capturas do manual (npm run manual:capturas): fora do test:e2e, reescreve public/ajuda/.
    {
      name: "manual",
      testDir: "./tests/manual",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, actionTimeout: 30_000,
        locale: "pt-BR", timezoneId: "America/Sao_Paulo", trace: "off",
        launchOptions: { args: ["--lang=pt-BR"] } },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
