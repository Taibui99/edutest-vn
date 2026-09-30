import { test, expect } from "@playwright/test";

test.describe("LANDING — Trang chủ (tối giản)", () => {
  test("L-01: Chỉ có hero + 2 lối vào", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /soạn đề thi siêu nhanh/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /tạo tài khoản giáo viên/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /vào thi bằng mã/i }).first()).toBeVisible();
    // Đã bỏ nội dung thừa
    await expect(page.getByText(/AI Study Coach/i)).toHaveCount(0);
    await expect(page.getByText(/Đề thi đã tạo/i)).toHaveCount(0);
    await expect(page.getByText(/Hướng dẫn/i)).toHaveCount(0);
  });

  test("L-02: Header đăng xuất → link Đăng nhập/Đăng ký", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "Đăng nhập" }).filter({ visible: true })).toBeVisible();
    await expect(header.getByRole("link", { name: "Đăng ký" }).filter({ visible: true })).toBeVisible();
  });

  test("L-03: Header đăng nhập → nút Vào EduTest + Đăng xuất", async ({ page }) => {
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

  test("L-05: Footer hiển thị", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/© 2026 EduTest.vn/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Điều khoản" })).toBeVisible();
  });
});