import { test, expect } from "@playwright/test";
import { TEACHER, login, registerUser } from "./helpers";

test.describe("AUTH", () => {
  test("A-01: Đăng nhập thành công với tài khoản teacher", async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
    await expect(page).toHaveURL(/\/bang-dieu-khien/);
    // Tên user có thể ẩn trên mobile, kiểm tra nội dung dashboard xuất hiện
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("A-02: Đăng nhập sai mật khẩu → hiện lỗi, không vào dashboard", async ({ page }) => {
    await page.goto("/dang-nhap");
    await page.locator("#email").fill(TEACHER.email);
    await page.locator("#password").fill("WrongPassword999");
    await page.getByRole("button", { name: /đăng nhập/i }).click();
    await expect(page.getByText(/email hoặc mật khẩu|không chính xác|sai|invalid/i)).toBeVisible();
    await expect(page).not.toHaveURL(/\/bang-dieu-khien/);
  });

  test("A-03: Đăng nhập email không tồn tại → hiện lỗi", async ({ page }) => {
    await page.goto("/dang-nhap");
    await page.locator("#email").fill("ghost-user-xyz@edutest.vn");
    await page.locator("#password").fill("Test@12345");
    await page.getByRole("button", { name: /đăng nhập/i }).click();
    await expect(page.getByText(/email hoặc mật khẩu|không chính xác|sai|invalid/i)).toBeVisible();
  });

  test("A-04: Đăng ký tài khoản student mới thành công", async ({ page }) => {
    const email = `qa-student-${Date.now()}@edutest.vn`;
    await registerUser(page, { name: "QA Student", email, role: "student", password: "Test@12345" });
    await expect(page).toHaveURL(/\/bang-dieu-khien/, { timeout: 20000 });
  });

  test("A-05: Đăng ký với email trùng → báo lỗi", async ({ page }) => {
    await registerUser(page, {
      name: "Dup",
      email: TEACHER.email,
      role: "student",
      password: "Test@12345",
    });
    await expect(page.getByText(/email.*đã|đã được sử dụng/i)).toBeVisible();
  });

  test("A-06: Đăng ký với email sai format (không có @) → dự kiến chặn (kiểm tra bug)", async ({ page }) => {
    await page.goto("/dang-ky");
    await page.locator("#fullName").fill("QA Bad Email");
    await page.locator("#email").fill("not-an-email-qa");
    await page.locator("#password").fill("Test@12345");
    await page.locator("#confirmPassword").fill("Test@12345");
    await page.getByRole("checkbox", { name: /tôi đồng ý/i }).check();
    await page.getByRole("button", { name: /đăng ký tài khoản/i }).click();
    // HTML5 validation nên chặn type=email trước khi submit; nếu submit qua thì là bug
    await page.waitForTimeout(1500);
    const url = page.url();
    const errorShown = await page.getByText(/email|vui lòng|hợp lệ/i).first().isVisible().catch(() => false);
    test.info().annotations.push({
      type: "note",
      description: `URL sau submit: ${url}, error shown: ${errorShown}`,
    });
  });
});
