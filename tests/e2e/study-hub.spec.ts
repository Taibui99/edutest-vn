import { test, expect } from "@playwright/test";
import { STUDENT, login, timestamp } from "./helpers";

test.describe("STUDY HUB — Học tập", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
  });

  test("F-01: Đếm ngày thi THPT + modal đổi ngày", async ({ page }) => {
    await page.goto("/bang-dieu-khien/hoc-tap");
    await expect(page.getByText(/ngày thi thpt/i).first()).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: /đổi ngày/i }).click();
    await expect(page.getByText(/lưu ngày thi/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /lưu ngày thi/i }).click();
  });

  test("F-02: Chuỗi ngày học — nút điểm danh hôm nay", async ({ page }) => {
    await page.goto("/bang-dieu-khien/hoc-tap");
    await expect(page.getByText(/chuỗi ngày học/i)).toBeVisible({ timeout: 20000 });
    const btn = page.getByRole("button", { name: /điểm danh hôm nay/i });
    await expect(btn).toBeVisible();
  });

  test("F-03: Việc cần làm — thêm task", async ({ page }) => {
    await page.goto("/bang-dieu-khien/hoc-tap");
    await expect(page.getByText(/việc cần làm/i).first()).toBeVisible({ timeout: 20000 });
    const addInput = page.getByPlaceholder("Thêm việc cần làm...");
    const task = `QA Task ${timestamp()}`;
    await addInput.fill(task);
    await page.getByRole("button", { name: /thêm/i }).first().click();
    await expect(page.getByText(task).first()).toBeVisible({ timeout: 10000 });
  });

  test("F-04: Flashcard — nút Thêm thẻ + Ôn ngay", async ({ page }) => {
    await page.goto("/bang-dieu-khien/hoc-tap");
    await expect(page.getByText(/flashcard ôn tập/i).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("button", { name: /thêm thẻ/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /ôn ngay/i })).toBeVisible();
  });

  test("F-05: Tiến độ ôn tập — slider hiển thị", async ({ page }) => {
    await page.goto("/bang-dieu-khien/hoc-tap");
    await expect(page.getByText(/tiến độ ôn tập/i)).toBeVisible({ timeout: 20000 });
    const sliders = page.locator('input[type="range"]');
    await expect(sliders.first()).toBeVisible();
  });

  test("F-06: Tạo bằng AI hiển thị", async ({ page }) => {
    await page.goto("/bang-dieu-khien/hoc-tap");
    await expect(page.getByRole("button", { name: /tạo bằng ai/i }).first()).toBeVisible({ timeout: 20000 });
  });
});