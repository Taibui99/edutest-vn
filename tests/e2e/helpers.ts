import { Page, expect, type APIRequestContext } from "@playwright/test";

/** Chạy trên production mặc định; trỏ sang local bằng `PLAYWRIGHT_BASE_URL`.
 *  (ROADMAP BRAND-6 sẽ đổi tên domain — khi đó chỉ cần sửa một chỗ này.) */
export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "https://edutest-vn.vercel.app";

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

/**
 * GĐ1 — `POST /api/submissions` bắt buộc có `attemptId` (server tự chốt thời
 * gian, không nhận `durationSeconds` từ client nữa). Gọi API này TRƯỚC khi nộp.
 *
 * Gọi nhiều lần vẫn chỉ trả về một lần làm bài đang mở; sau khi đã nộp xong,
 * lần gọi kế tiếp sẽ mở lần làm bài mới (nếu đề còn lượt).
 */
export async function startAttempt(req: APIRequestContext, examId: string): Promise<string> {
  const res = await req.post("/api/attempts", { data: { examId } });
  expect(res.status(), await res.text()).toBe(201);
  const data = await res.json();
  expect(typeof data.id).toBe("string");
  return data.id;
}
