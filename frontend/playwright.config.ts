import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests", workers: 1, timeout: 180000,
  use: { actionTimeout: 30000, baseURL: process.env.KIRANA_TEST_BASE_URL ?? "http://localhost:3000", channel: process.env.KIRANA_BROWSER_CHANNEL ?? "msedge", headless: true, trace: "retain-on-failure" },
});
