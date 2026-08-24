import { test, expect } from "@playwright/test";

test.describe("LANDING — Trang chủ", () => {
  test("L-01: Landing hiển thị đầy đủ sections", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /tạo đề thi siêu tốc/i })).toBeVisible();
    await expect(page.getByText(/dành cho học sinh/i)).toBeVisible();
    await expect(page.getByText(/dành cho giáo viên/i)).toBeVisible();
    await expect(page.getByText("Flashcard thông minh").first()).toBeVisible();
    await expect(page.getByText("AI Study Coach").first()).toBeVisible();
    await expect(page.getByText("Đếm ngược THPT").first()).toBeVisible();
    await expect(page.getByText("Tạo đề trên một màn hình").first()).toBeVisible();
    await expect(page.getByText("Đề thi đã tạo")).toBeVisible();
    await expect(page.getByText("Bài nộp đã chấm")).toBeVisible();
    await expect(page.getByRole("link", { name: /bắt đầu soạn đề miễn phí/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /vào thi bằng mã/i }).first()).toBeVisible();
  });

  test("L-02: Header đăng xuất → link Đăng nhập/Đăng ký + nav", async ({ page }) => {
    await page.goto("/");
    const isMobile = test.info().project.name === "mobile";
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "Đăng nhập" }).filter({ visible: true })).toBeVisible();
    await expect(header.getByRole("link", { name: "Đăng ký" }).filter({ visible: true })).toBeVisible();
    if (!isMobile) {
      await expect(header.getByRole("link", { name: "Tính năng" })).toBeVisible();
      await expect(header.getByRole("link", { name: "Hướng dẫn" })).toBeVisible();
    }
  });

  test("L-03: Header đăng nhập → nút Bảng điều khiển + Đăng xuất", async ({ page }) => {
    await page.goto("/dang-nhap");
    await page.locator("#email").fill("tester-gv-20260816@edutest.vn");
    await page.locator("#password").fill("Test@12345");
    await page.getByRole("button", { name: /đăng nhập/i }).click();
    await page.waitForURL(/\/bang-dieu-khien/, { timeout: 20000 });
    await page.goto("/");
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: /vào edutest/i }).first()).toBeVisible();
    await expect(header.getByRole("button", { name: /đăng xuất/i })).toBeVisible();
  });

  test("L-04: Nút Hướng dẫn cuộn tới hướng dẫn", async ({ page }) => {
    await page.goto("/");
    test.skip(test.info().project.name === "mobile", "Nav ẩn trên mobile");
    await page.getByRole("link", { name: "Hướng dẫn" }).click();
    await expect(page.getByRole("heading", { name: /từ ý tưởng đến đề thi hoàn chỉnh/i })).toBeVisible({ timeout: 10000 });
  });

  test("L-05: Footer hiển thị", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/© 2026 EduTest.vn/)).toBeVisible();
  });
});
