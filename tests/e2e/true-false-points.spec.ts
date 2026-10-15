import { test, expect, request as pwRequest } from "@playwright/test";
import { TEACHER, BASE_URL } from "./helpers";

/* TF-1 — điểm riêng từng mệnh đề Đúng/Sai: học sinh làm đúng 1/2 mệnh đề
 * (mỗi mệnh đề 5đ/10đ đề) phải được 5/10 điểm, không còn 0 như "đúng hết
 * mới tính". Đề đặt đúng 10đ để điểm ra theo đúng thang 0–10. */

test.describe.configure({ mode: "serial" });

let CODE = "";

test.beforeAll(async () => {
  const req = await pwRequest.newContext({ baseURL: BASE_URL });
  const csrf = (await (await req.get("/api/auth/csrf")).json()).csrfToken;
  await req.post("/api/auth/callback/credentials", {
    form: { csrfToken: csrf, email: TEACHER.email, password: TEACHER.password },
  });
  const res = await req.post("/api/exams", {
    data: {
      title: `QA-TF-${Date.now()}`,
      subject: "Toán",
      durationMinutes: 15,
      allowGuestAttempts: true,
      maxAttempts: 5,
      showAnswers: true,
      showScoreImmediately: true,
      questions: [
        {
          type: "true_false",
          question: "Đúng hay sai?",
          options: [],
          answer: "",
          points: 10,
          grading: {
            statements: [
              { text: "Mệnh đề MỘT đúng", answer: true, points: 5 },
              { text: "Mệnh đề HAI sai", answer: false, points: 5 },
            ],
          },
        },
      ],
    },
  });
  expect(res.status()).toBe(201);
  CODE = ((await res.json()) as { exam: { joinCode: string } }).exam.joinCode;
  await req.dispose();
});

test("TF-1: đúng 1/2 mệnh đề → 5/10 điểm + review hiện điểm từng mệnh đề", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/vao-thi");
  await page.locator("input[placeholder='VD: ABC123']").fill(CODE);
  await page.getByRole("button", { name: "Bắt đầu làm bài" }).click();
  await page.getByPlaceholder("Nguyễn Văn A").fill("Guest TF");
  await page.getByPlaceholder("12A6").fill("12A9");
  await page.getByRole("button", { name: "Bắt đầu làm bài" }).click();
  await expect(page.getByText("Câu 1/1").first()).toBeVisible({ timeout: 20000 });

  // Mệnh đề 1 (đúng) → chọn "Đúng"; Mệnh đề 2 (sai) → chọn "Đúng" (sai ý).
  const dungs = page.getByRole("button", { name: "Đúng", exact: true });
  await dungs.nth(0).click();
  await dungs.nth(1).click();

  await page.getByRole("button", { name: /nộp bài/i }).first().click();
  // Trả lời hết nên nộp luôn; nếu còn câu trống thì modal xác nhận hiện ra.
  await Promise.race([
    page.getByText("Xác nhận nộp bài?").waitFor({ timeout: 6000 }).catch(() => {}),
    page.getByText("Xem lại bài làm").waitFor({ timeout: 6000 }).catch(() => {}),
  ]);
  if (await page.getByText("Xác nhận nộp bài?").isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Nộp bài" }).last().click();
  }

  await expect(page.getByText("Xem lại bài làm").first()).toBeVisible({ timeout: 20000 });
  // Điểm tổng đúng nửa → 5/10.
  await expect(page.getByText(/5\s*\/\s*10/).first()).toBeVisible({ timeout: 10000 });
  // Và điểm từng mệnh đề được hiển thị (5đ của 10đ câu).
  await expect(page.getByText(/Điểm câu này:\s*5\/10đ/).first()).toBeVisible({ timeout: 10000 });
});
