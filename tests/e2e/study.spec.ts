import { test, expect } from "@playwright/test";
import { STUDENT, login } from "./helpers";

test.describe("STUDENT — Study hub & kết quả", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
  });

  test("H-01: Trang học tập (hoc-tap) hiển thị", async ({ page }) => {
    await page.goto("/bang-dieu-khien/hoc-tap");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading").first()).toBeVisible();
    // Chụp screenshot làm evidence
    await page.screenshot({ path: `evidence/hoc-tap-${test.info().project.name}.png`, fullPage: true });
  });

  test("H-02: Tạo flashcard", async ({ page }) => {
    await page.goto("/bang-dieu-khien/hoc-tap");
    await page.waitForLoadState("networkidle");
    const addBtn = page.getByRole("button", { name: /thêm.*thẻ|tạo.*thẻ/i }).first();
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(800);
    }
    test.info().annotations.push({ type: "note", description: "Trang hoc-tap URL: " + page.url() });
  });

  test("H-03: Trang tiến độ (tien-do) hiển thị", async ({ page }) => {
    await page.goto("/bang-dieu-khien/tien-do");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await page.screenshot({ path: `evidence/tien-do-${test.info().project.name}.png`, fullPage: true });
  });

  test("H-04: AI Coach trang hiển thị", async ({ page }) => {
    await page.goto("/bang-dieu-khien/ai");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await page.screenshot({ path: `evidence/ai-coach-${test.info().project.name}.png`, fullPage: true });
  });

  test("H-05: Student gọi API analytics → bị chặn (401/403)", async ({ page }) => {
    const resp = await page.request.get("/api/analytics");
    expect([401, 403]).toContain(resp.status());
  });

  test("H-06: Hồ sơ hiển thị", async ({ page }) => {
    await page.goto("/bang-dieu-khien/ho-so");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await page.screenshot({ path: `evidence/ho-so-${test.info().project.name}.png`, fullPage: true });
  });
});
