import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  fullyParallel: false,
  // GĐ1: mỗi người chỉ giữ MỘT attempt đang mở. Hai project dùng chung một tài
  // khoản student → chạy song song sẽ giành nhau activeKey (màn "bạn đang làm
  // bài thi khác"). Chạy tuần tự 1 worker để không đụng nhau.
  workers: 1,
  retries: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    // Production mặc định; chạy local: `PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test`
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "https://edutest-vn.vercel.app",
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
