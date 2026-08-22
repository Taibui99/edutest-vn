import { test, expect } from "@playwright/test";

async function loginAdmin(page: import("@playwright/test").Page) {
  await page.goto("/dang-nhap");
  await page.locator("#email").fill("admin-p2@edutest.vn");
  await page.locator("#password").fill("testpass");
  await page.getByRole("button", { name: /đăng nhập/i }).click();
  await page.waitForURL(/\/(bang-dieu-khien|admin)/, { timeout: 20000 });
}

test.describe("ADMIN — Panel", () => {
  test("AD-01: Admin login thật → truy cập /admin thành công", async ({ page }) => {
    await page.goto("/dang-nhap");
    await page.locator("#email").fill("admin-p2@edutest.vn");
    await page.locator("#password").fill("testpass");
    await page.getByRole("button", { name: /đăng nhập/i }).click();
    await page.waitForURL(/\/(bang-dieu-khien|admin)/, { timeout: 20000 });
    await page.goto("/admin");
    await expect(page.getByText("Tổng quan hệ thống").first()).toBeVisible({ timeout: 20000 });
    // menu quản trị chỉ hiện ở desktop (mobile là drawer ẩn)
    if (test.info().project.name === "desktop") {
      await expect(page.locator("nav").getByText("Người dùng").first()).toBeVisible({ timeout: 10000 });
    }
  });

  test("AD-02: Admin API hoạt động với session thật (stats/users/exams)", async ({ page }) => {
    await loginAdmin(page);
    const stats = await page.request.get("/api/admin/stats");
    expect(stats.status()).toBe(200);
    const users = await page.request.get("/api/admin/users?page=1");
    expect(users.status()).toBe(200);
    const exams = await page.request.get("/api/admin/exams?page=1");
    expect(exams.status()).toBe(200);
    const reports = await page.request.get("/api/admin/reports?page=1");
    expect(reports.status()).toBe(200);
    test.info().annotations.push({ type: "note", description: `stats:${stats.status()} users:${users.status()} exams:${exams.status()} reports:${reports.status()}` });
  });

  test("AD-03: Student token gọi admin API → 403", async ({ page, context }) => {
    // Đăng nhập student bình thường
    await page.goto("/dang-nhap");
    await page.locator("#email").fill("tester-hs-20260816@edutest.vn");
    await page.locator("#password").fill("Test@12345");
    await page.getByRole("button", { name: /đăng nhập/i }).click();
    await page.waitForURL(/\/(bang-dieu-khien|admin)/, { timeout: 20000 });
    const resp = await page.request.get("/api/admin/stats");
    expect(resp.status()).toBe(403);
  });
});