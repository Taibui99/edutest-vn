import { test, expect } from "@playwright/test";
import { TEACHER, login } from "./helpers";

test.describe("TEACHER PAGES — Thống kê, Đề thi list, Học sinh", () => {
  test("S-01: Trang thống kê hiển thị đủ sections", async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
    await page.goto("/bang-dieu-khien/thong-ke");
    await expect(page.getByRole("heading", { name: "Thống kê" })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/phân bố điểm/i)).toBeVisible();
    await expect(page.getByText(/hoạt động/i).first()).toBeVisible();
  });

  test("S-02: Danh sách đề — filters hiển thị + tìm kiếm", async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
    await page.goto("/bang-dieu-khien/de-thi");
    await expect(page.getByRole("heading", { name: "Đề thi" })).toBeVisible({ timeout: 20000 });
    const search = page.getByPlaceholder(/tìm theo tên đề/i);
    await expect(search).toBeVisible();
    await expect(page.getByRole("combobox").nth(1)).toBeVisible();
    await search.fill("43WTBE");
    await page.waitForTimeout(1200);
  });

  test("S-03: Trang học sinh hiển thị stats", async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
    await page.goto("/bang-dieu-khien/hoc-sinh");
    await expect(page.getByRole("heading", { name: "Học sinh" })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("Bài đã nộp").first()).toBeVisible();
    await expect(page.getByText("Điểm TB").first()).toBeVisible();
    await expect(page.getByPlaceholder(/tìm theo tên/i)).toBeVisible();
  });

  test("S-04: Vào thi — mã không tồn tại báo lỗi", async ({ page }) => {
    await page.goto("/vao-thi");
    await page.getByPlaceholder("VD: ABC123").fill("ZZZ999");
    await page.getByRole("button", { name: /bắt đầu làm bài/i }).click();
    await page.waitForURL(/\/thi\/ZZZ999/, { timeout: 15000 });
    await expect(page.getByText(/mã tham gia không hợp lệ/i)).toBeVisible({ timeout: 20000 });
  });
});
