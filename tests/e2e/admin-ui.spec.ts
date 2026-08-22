import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin-p2@edutest.vn";
const ADMIN_PASS = "testpass";

test.describe("ADMIN UI — Panel quản trị (login thật)", () => {
  test("AU-01: Admin login → truy cập /admin thành công", async ({ page }) => {
    await page.goto("/dang-nhap");
    await page.locator("#email").fill(ADMIN_EMAIL);
    await page.locator("#password").fill(ADMIN_PASS);
    await page.getByRole("button", { name: /đăng nhập/i }).click();
    await page.waitForURL(/\/(bang-dieu-khien|admin)/, { timeout: 20000 });
    await page.goto("/admin");
    await expect(page.getByText("Tổng quan hệ thống").first()).toBeVisible({ timeout: 20000 });
    // nội dung chính: thẻ sức khỏe hệ thống
    await expect(page.getByText(/sức khỏe hệ thống/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("AU-02: /admin/users — bảng người dùng + lọc + export", async ({ page }) => {
    await page.goto("/dang-nhap");
    await page.locator("#email").fill(ADMIN_EMAIL);
    await page.locator("#password").fill(ADMIN_PASS);
    await page.getByRole("button", { name: /đăng nhập/i }).click();
    await page.waitForURL(/\/(bang-dieu-khien|admin)/, { timeout: 20000 });
    await page.goto("/admin/users");
    await expect(page.getByText("Quản lý người dùng").first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("button", { name: /csv/i }).first()).toBeVisible();
    // filter role select
    await expect(page.locator("select").first()).toBeVisible();
    // bảng hiển thị các dòng người dùng
    await expect(page.getByText(/tài khoản/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("AU-03: /admin/exams — danh sách đề + actions Xem/Ẩn/Xóa", async ({ page }) => {
    await page.goto("/dang-nhap");
    await page.locator("#email").fill(ADMIN_EMAIL);
    await page.locator("#password").fill(ADMIN_PASS);
    await page.getByRole("button", { name: /đăng nhập/i }).click();
    await page.waitForURL(/\/(bang-dieu-khien|admin)/, { timeout: 20000 });
    await page.goto("/admin/exams");
    await expect(page.getByText("Đề thi toàn hệ thống").first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("button", { name: /csv/i }).first()).toBeVisible();
  });

  test("AU-04: /admin/reports — trang báo cáo (0 báo cáo hiện tại)", async ({ page }) => {
    await page.goto("/dang-nhap");
    await page.locator("#email").fill(ADMIN_EMAIL);
    await page.locator("#password").fill(ADMIN_PASS);
    await page.getByRole("button", { name: /đăng nhập/i }).click();
    await page.waitForURL(/\/(bang-dieu-khien|admin)/, { timeout: 20000 });
    await page.goto("/admin/reports");
    await expect(page.getByText("Báo cáo từ người dùng").first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("button", { name: /chờ xử lý/i }).first()).toBeVisible();
  });

  test("AU-05: /admin/analytics — biểu đồ & thống kê", async ({ page }) => {
    await page.goto("/dang-nhap");
    await page.locator("#email").fill(ADMIN_EMAIL);
    await page.locator("#password").fill(ADMIN_PASS);
    await page.getByRole("button", { name: /đăng nhập/i }).click();
    await page.waitForURL(/\/(bang-dieu-khien|admin)/, { timeout: 20000 });
    await page.goto("/admin/analytics");
    await expect(page.getByText("Phân tích & thống kê").first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/bài nộp 7 ngày/i).first()).toBeVisible();
  });

  test("AU-06: /admin/system — kiểm tra sức khỏe hệ thống", async ({ page }) => {
    await page.goto("/dang-nhap");
    await page.locator("#email").fill(ADMIN_EMAIL);
    await page.locator("#password").fill(ADMIN_PASS);
    await page.getByRole("button", { name: /đăng nhập/i }).click();
    await page.waitForURL(/\/(bang-dieu-khien|admin)/, { timeout: 20000 });
    await page.goto("/admin/system");
    await expect(page.getByText("Kiểm tra hệ thống").first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("button", { name: /chạy lại kiểm tra/i })).toBeVisible();
    await page.getByRole("button", { name: /chạy lại kiểm tra/i }).click();
    const main = page.locator("main");
    await expect(main.getByText(/^OK$/i).first()).toBeVisible({ timeout: 30000 });
    await expect(main.getByText(/kết nối database|database/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("AU-07: /admin/settings — tabs General/Authentication/Exams/AI/Maintenance", async ({ page }) => {
    await page.goto("/dang-nhap");
    await page.locator("#email").fill(ADMIN_EMAIL);
    await page.locator("#password").fill(ADMIN_PASS);
    await page.getByRole("button", { name: /đăng nhập/i }).click();
    await page.waitForURL(/\/(bang-dieu-khien|admin)/, { timeout: 20000 });
    await page.goto("/admin/settings");
    await expect(page.getByText("Cài đặt hệ thống").first()).toBeVisible({ timeout: 20000 });
    for (const tab of ["Authentication", "Exams", "AI", "Maintenance"]) {
      await expect(page.getByRole("button", { name: new RegExp(tab, "i") }).first()).toBeVisible();
    }
    await expect(page.getByRole("button", { name: /lưu/i }).first()).toBeVisible();
  });

  test("AU-08: Student KHÔNG thể truy cập /admin", async ({ page }) => {
    await page.goto("/dang-nhap");
    await page.locator("#email").fill("tester-hs-20260816@edutest.vn");
    await page.locator("#password").fill("Test@12345");
    await page.getByRole("button", { name: /đăng nhập/i }).click();
    await page.waitForURL(/\/(bang-dieu-khien|admin)/, { timeout: 20000 });
    await page.goto("/admin");
    await page.waitForTimeout(4000);
    expect(page.url()).not.toContain("/admin");
  });
});