import { test, expect } from "@playwright/test";
import { registerUser, timestamp } from "./helpers";

test.describe("AUTH UI — Form đăng ký & quên mật khẩu", () => {
  test("R-01: Validation client — password ngắn bị chặn (không submit)", async ({ page }) => {
    await page.goto("/dang-ky");
    await page.locator("#fullName").fill("QA User");
    await page.locator("#email").fill(`qa-short-${timestamp()}@edutest.vn`);
    await page.locator("#password").fill("123");
    await page.locator("#confirmPassword").fill("123");
    await page.getByRole("checkbox", { name: /tôi đồng ý/i }).check();
    await page.getByRole("button", { name: /đăng ký tài khoản/i }).click();
    await page.waitForTimeout(2000);
    // Không được redirect sang dashboard (bị chặn validation)
    await expect(page).toHaveURL(/\/dang-ky/);
  });

  test("R-02: Validation client — confirm password không khớp", async ({ page }) => {
    await page.goto("/dang-ky");
    await page.locator("#fullName").fill("QA User");
    await page.locator("#email").fill(`qa-confirm-${timestamp()}@edutest.vn`);
    await page.locator("#password").fill("Strong@123");
    await page.locator("#confirmPassword").fill("Strong@999");
    await page.getByRole("checkbox", { name: /tôi đồng ý/i }).check();
    await page.getByRole("button", { name: /đăng ký tài khoản/i }).click();
    await expect(page.getByText(/không khớp/i)).toBeVisible({ timeout: 8000 });
  });

  test("R-03: Validation — không tick checkbox bị chặn", async ({ page }) => {
    await page.goto("/dang-ky");
    await page.locator("#fullName").fill("QA User");
    await page.locator("#email").fill(`qa-cb-${timestamp()}@edutest.vn`);
    await page.locator("#password").fill("Strong@123");
    await page.locator("#confirmPassword").fill("Strong@123");
    await page.getByRole("button", { name: /đăng ký tài khoản/i }).click();
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/\/dang-ky/);
  });

  test("R-04: Đăng ký qua UI teacher → tự đăng nhập → dashboard", async ({ page }) => {
    const email = `qa-ui-gv-${timestamp()}@edutest.vn`;
    await registerUser(page, { name: "QA UI GV", email, role: "teacher", password: "Strong@123" });
    await page.waitForURL(/\/bang-dieu-khien/, { timeout: 25000 });
    await expect(page).toHaveURL(/\/bang-dieu-khien/);
  });

  test("R-05: Đăng nhập sai mật khẩu → báo lỗi đỏ", async ({ page }) => {
    await page.goto("/dang-nhap");
    await page.locator("#email").fill("tester-gv-20260816@edutest.vn");
    await page.locator("#password").fill("SaiPass@999");
    await page.getByRole("button", { name: /đăng nhập/i }).click();
    await expect(page.getByText(/email hoặc mật khẩu không đúng/i)).toBeVisible({ timeout: 15000 });
  });

  test("R-06: Quên mật khẩu — gửi liên kết + đặt lại mật khẩu mới (exposeResetLink bật)", async ({ page }) => {
    const email = `qa-reset-${timestamp()}@edutest.vn`;
    await page.request.post("/api/auth/register", {
      data: { fullName: "QA Reset", email, role: "student", password: "OldPass@123" },
    });
    await page.goto("/quen-mat-khau");
    await expect(page.getByRole("heading", { name: /quên mật khẩu/i })).toBeVisible();
    await page.locator("#email").fill(email);
    await page.getByRole("button", { name: /gửi liên kết đặt lại/i }).click();
    // exposeResetLink bật → hiện thông báo + demo link chứa token
    await expect(page.getByText(/nếu email tồn tại/i)).toBeVisible({ timeout: 15000 });
    const demoLink = page.getByText(/doi-mat-khau\?token=/).first();
    await expect(demoLink).toBeVisible();
    // SEC-02 confirmed: token hiển thị trực tiếp trên UI
    test.info().annotations.push({
      type: "note",
      description: "SEC-02 xác nhận: reset token hiển thị trực tiếp trong demo link trên trang /quen-mat-khau khi exposeResetLink=true",
    });
    const token = (await demoLink.innerText()).match(/token=(\S+)/)?.[1];
    expect(token).toBeTruthy();
    await page.goto(`/doi-mat-khau?token=${token}`);
    await expect(page.getByText(/tạo mật khẩu mới/i)).toBeVisible({ timeout: 15000 });
    await page.locator("#password").fill("NewPass@456");
    await page.getByLabel(/xác nhận mật khẩu mới/i).fill("NewPass@456");
    await page.getByRole("button", { name: /đặt lại mật khẩu/i }).click();
    // thành công → link đăng nhập với mật khẩu mới
    await expect(page.getByText(/mật khẩu đã được đặt lại thành công/i)).toBeVisible({ timeout: 15000 });
    await page.getByRole("link", { name: /đăng nhập với mật khẩu mới/i }).click();
    await page.waitForURL(/\/dang-nhap/, { timeout: 15000 });
    // login với mật khẩu mới
    await page.locator("#email").fill(email);
    await page.locator("#password").fill("NewPass@456");
    await page.getByRole("button", { name: /đăng nhập/i }).click();
    await page.waitForURL(/\/bang-dieu-khien/, { timeout: 20000 });
  });

  test("R-07: /doi-mat-khau public — không có token → báo liên kết không hợp lệ", async ({ page }) => {
    await page.goto("/doi-mat-khau");
    await expect(page.getByText(/liên kết đặt lại mật khẩu không hợp lệ/i)).toBeVisible({ timeout: 15000 });
    // còn có link quay lại đăng nhập
    await expect(page.getByRole("link", { name: /quay lại đăng nhập/i })).toBeVisible();
  });
});
