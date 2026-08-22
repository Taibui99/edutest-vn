import { Page, expect } from "@playwright/test";

export const BASE_URL = "https://edutest-vn.vercel.app";

export const TEACHER = {
  email: "tester-gv-20260816@edutest.vn",
  password: "Test@12345",
  name: "Tester GV",
};

export const STUDENT = {
  email: "tester-hs-20260816@edutest.vn",
  password: "Test@12345",
  name: "Tester HS",
};

export async function login(page: Page, email: string, password: string) {
  await page.goto("/dang-nhap");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /đăng nhập/i }).click();
  await page.waitForURL(/\/bang-dieu-khien|\/admin/, { timeout: 20000 });
}

export async function registerUser(
  page: Page,
  opts: { name: string; email: string; role?: "student" | "teacher"; password: string },
) {
  await page.goto("/dang-ky");
  await page.locator("#fullName").fill(opts.name);
  await page.locator("#email").fill(opts.email);
  if (opts.role) {
    await page.locator("#role").selectOption({ label: opts.role === "teacher" ? "Giáo viên" : "Học sinh" });
  }
  await page.locator("#password").fill(opts.password);
  await page.locator("#confirmPassword").fill(opts.password);
  await page.getByRole("checkbox", { name: /tôi đồng ý/i }).check();
  await page.getByRole("button", { name: /đăng ký tài khoản/i }).click();
}

export async function expectVisible(page: Page, text: string | RegExp) {
  await expect(page.getByText(text).first()).toBeVisible();
}

export function timestamp() {
  return Date.now();
}
