import { test, expect, request as pwRequest } from "@playwright/test";
import { STUDENT, TEACHER, login } from "./helpers";

let CODE = "43WTBE";

test.beforeAll(async () => {
  // Tạo exam riêng cho Playwright với maxAttempts cao để không vướng dữ liệu cũ
  const req = await pwRequest.newContext({ baseURL: "https://edutest-vn.vercel.app" });
  const csrf = (await (await req.get("/api/auth/csrf")).json()).csrfToken;
  await req.post("/api/auth/callback/credentials", {
    form: { csrfToken: csrf, email: TEACHER.email, password: TEACHER.password },
  });
  const examBody = {
    title: `QA-PW-Exam-${Date.now()}`,
    subject: "Toán",
    durationMinutes: 15,
    allowGuestAttempts: true,
    maxAttempts: 5,
    showAnswers: true,
    showScoreImmediately: true,
    questions: [
      { type: "mcq", question: "1+1=?", options: ["1", "2", "3", "4"], answer: "B", points: 1 },
      { type: "mcq", question: "2+2=?", options: ["3", "4", "5", "6"], answer: "B", points: 1 },
    ],
  };
  const res = await req.post("/api/exams", { data: examBody });
  expect(res.status()).toBe(201);
  const data = await res.json();
  CODE = data.exam.joinCode;
  await req.dispose();
});

test.describe("STUDENT — Làm bài thi", () => {
  test("S-01: Vào thi bằng mã hợp lệ", async ({ page }) => {
    await page.goto("/vao-thi");
    await page.locator("input[placeholder='VD: ABC123']").fill(CODE);
    await page.getByRole("button", { name: "Bắt đầu làm bài" }).click();
    await expect(page.getByText(/QA-PW-Exam/i).first()).toBeVisible({ timeout: 15000 });
  });

  test("S-02: Nhập mã sai → báo lỗi", async ({ page }) => {
    await page.goto("/vao-thi");
    await page.locator("input[placeholder='VD: ABC123']").fill("ZZZZ99");
    await page.getByRole("button", { name: "Bắt đầu làm bài" }).click();
    await expect(page.getByText(/mã tham gia không hợp lệ|không tồn tại/i)).toBeVisible({ timeout: 15000 });
  });

  test("S-03: Làm bài MCQ + nộp bài", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    await page.goto(`/thi/${CODE}`);
    await expect(page.getByText(/QA-PW-Exam/i).first()).toBeVisible({ timeout: 15000 });
    // Trả lời câu MCQ đầu tiên (1+1=2 → B)
    await page.getByRole("button", { name: /^B/ }).first().click();
    await page.getByRole("button", { name: /nộp bài/i }).first().click();
    // Confirm dialog xuất hiện vì còn câu chưa trả lời
    await page.getByRole("button", { name: "Nộp bài" }).last().click();
    await expect(page.getByText(/đã nộp|nộp bài thành công|\/10/i).first()).toBeVisible({ timeout: 20000 });
  });

  test("S-04: Guest làm bài bằng mã", async ({ page }) => {
    await page.goto("/vao-thi");
    await page.locator("input[placeholder='VD: ABC123']").fill(CODE);
    await page.getByRole("button", { name: "Bắt đầu làm bài" }).click();
    await page.getByPlaceholder("Nguyễn Văn A").fill("Guest Playwright");
    await page.getByPlaceholder("12A6").fill("12A9");
    await page.getByRole("button", { name: "Bắt đầu làm bài" }).click();
    await expect(page.getByText(/QA-PW-Exam/i).first()).toBeVisible({ timeout: 15000 });
  });

  test("S-05: Anti-cheat — blur 1 lần → cảnh báo", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    await page.goto(`/thi/${CODE}`);
    await expect(page.getByText(/QA-PW-Exam/i).first()).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(page.getByText(/cảnh báo|rời khỏi trang thi/i).first()).toBeVisible({ timeout: 8000 });
  });
});
