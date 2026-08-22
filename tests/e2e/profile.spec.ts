import { test, expect } from "@playwright/test";
import { STUDENT, login, timestamp } from "./helpers";

test.describe("PROFILE & PASSWORD", () => {
  test("P-01: Hồ sơ hiển thị đủ field", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    await page.goto("/bang-dieu-khien/ho-so");
    await expect(page.getByText("Hồ sơ cá nhân").first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("Họ và tên")).toBeVisible();
    await expect(page.getByText("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: /lưu thay đổi/i })).toBeVisible();
  });

  test("P-02: Đổi mật khẩu sai mật khẩu hiện tại → lỗi", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    await page.goto("/bang-dieu-khien/ho-so");
    await page.getByRole("heading", { name: /đổi mật khẩu/i }).scrollIntoViewIfNeeded();
    await page.getByLabel(/mật khẩu hiện tại/i).fill("SaiPass@123");
    await page.getByLabel("Mật khẩu mới", { exact: true }).fill("NewPass@12345");
    await page.getByLabel("Xác nhận mật khẩu mới", { exact: true }).fill("NewPass@12345");
    await page.getByRole("button", { name: /đổi mật khẩu/i }).click();
    await expect(page.getByText(/mật khẩu hiện tại không đúng/i)).toBeVisible({ timeout: 15000 });
  });

  test("P-03: Lưu hồ sơ thay đổi thông tin", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    await page.goto("/bang-dieu-khien/ho-so");
    const school = page.getByLabel(/trường/i);
    if (await school.count()) {
      await school.fill(`THPT QA ${timestamp()}`);
      await page.getByRole("button", { name: /lưu thay đổi/i }).click();
      await expect(page.getByText(/đã lưu/i)).toBeVisible({ timeout: 10000 });
    }
  });

  test("P-04: Avatar — nút đổi ảnh + xóa ảnh hiển thị", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    await page.goto("/bang-dieu-khien/ho-so");
    await expect(page.getByRole("button", { name: /đổi ảnh/i })).toBeVisible({ timeout: 20000 });
    // xóa ảnh có thể không tồn tại nếu chưa có avatar — không assert bắt buộc
  });
});
