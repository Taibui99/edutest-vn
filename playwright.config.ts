import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  fullyParallel: false,
  retries: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: "https://edutest-vn.vercel.app",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1366, height: 768 },
    actionTimeout: 15000,
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1366, height: 768 }, browserName: "chromium", channel: "chrome" } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, browserName: "chromium", channel: "chrome" } },
  ],
});
