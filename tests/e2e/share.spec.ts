import { test, expect, request as pwRequest } from "@playwright/test";
import { TEACHER, login } from "./helpers";

let CODE = "";

test.beforeAll(async () => {
  const req = await pwRequest.newContext({ baseURL: "https://edutest-vn.vercel.app" });
  const csrf = (await (await req.get("/api/auth/csrf")).json()).csrfToken;
  await req.post("/api/auth/callback/credentials", {
    form: { csrfToken: csrf, email: TEACHER.email, password: TEACHER.password },
  });
  const res = await req.post("/api/exams", {
    data: {
      title: `QA-Share-${Date.now()}`,
      subject: "Toán",
      durationMinutes: 15,
      allowGuestAttempts: true,
      questions: [{ type: "mcq", question: "1+1=?", options: ["1", "2", "3", "4"], answer: "B" }],
    },
  });
  CODE = (await res.json()).exam.joinCode;
  await req.dispose();
});

test.describe("SHARE — Chia sẻ đề", () => {
  test("S-01: Trang chia sẻ hiển thị mã + QR + nút chia sẻ", async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
    await page.goto(`/bang-dieu-khien/chia-se-de/${CODE}`);
    await expect(page.getByText(/chia sẻ cho học sinh/i)).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("button", { name: /tải qr/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /chia sẻ/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /sao chép link/i }).first()).toBeVisible();
  });

  test("S-02: Nút mở thử trang học sinh hiển thị", async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
    await page.goto(`/bang-dieu-khien/chia-se-de/${CODE}`);
    const btn = page.getByRole("link", { name: /mở thử trang học sinh/i });
    await expect(btn).toBeVisible({ timeout: 20000 });
    await expect(btn).toHaveAttribute("target", "_blank");
  });
});
