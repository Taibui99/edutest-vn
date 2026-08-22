import { test, expect, request as pwRequest } from "@playwright/test";
import { TEACHER, login } from "./helpers";

// Tạo 1 exam + 1 submission qua API để test trang detail
async function setupExam() {
  const req = await pwRequest.newContext({ baseURL: "https://edutest-vn.vercel.app" });
  const csrf = (await (await req.get("/api/auth/csrf")).json()).csrfToken;
  await req.post("/api/auth/callback/credentials", {
    form: { csrfToken: csrf, email: TEACHER.email, password: TEACHER.password },
  });
  const body = {
    title: `QA-Detail-${Date.now()}`,
    subject: "Toán",
    durationMinutes: 15,
    maxAttempts: 3,
    allowGuestAttempts: true,
    showAnswers: true,
    showScoreImmediately: true,
    questions: [
      { type: "mcq", question: "1+1=?", options: ["1", "2", "3", "4"], answer: "B", points: 1 },
    ],
  };
  const res = await req.post("/api/exams", { data: body });
  const { exam } = await res.json();
  const detail = await (await req.get(`/api/exams/${exam.id}`)).json();
  // student nộp bài
  const req2 = await pwRequest.newContext({ baseURL: "https://edutest-vn.vercel.app" });
  const csrf2 = (await (await req2.get("/api/auth/csrf")).json()).csrfToken;
  await req2.post("/api/auth/callback/credentials", {
    form: { csrfToken: csrf2, email: "tester-hs-20260816@edutest.vn", password: "Test@12345" },
  });
  const qid = detail.exam.questions[0].id;
  await req2.post("/api/submissions", { data: { examId: exam.id, answers: { [qid]: "B" }, durationSeconds: 60 } });
  await req.dispose();
  await req2.dispose();
  return exam;
}

let EXAM_ID = "";

test.beforeAll(async () => {
  const exam = await setupExam();
  EXAM_ID = exam.id;
});

test.describe("EXAM DETAIL — Trang chi tiết đề", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
  });

  test("X-01: Chi tiết đề hiển thị đủ: mã mời, stat, phân bố điểm", async ({ page }) => {
    await page.goto(`/bang-dieu-khien/de-thi/${EXAM_ID}`);
    await expect(page.getByText(/sao chép/i).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("1 câu hỏi")).toBeVisible();
    await expect(page.getByText("15 phút")).toBeVisible();
    await expect(page.getByText(/bài nộp/i).first()).toBeVisible();
    await expect(page.getByText(/điểm tb/i)).toBeVisible();
    await expect(page.getByText(/phân bố điểm/i)).toBeVisible();
    await expect(page.getByText(/phân tích câu hỏi/i)).toBeVisible();
  });

  test("X-02: Submissions panel — bảng bài nộp + sort + chi tiết đáp án", async ({ page }) => {
    await page.goto(`/bang-dieu-khien/de-thi/${EXAM_ID}`);
    await page.getByRole("button", { name: /danh sách bài nộp|bài nộp/i }).first().click().catch(() => {});
    await expect(page.getByText(/danh sách bài nộp/i)).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/tester hs/i).first()).toBeVisible({ timeout: 15000 });
    // sort select
    await expect(page.getByRole("combobox").first()).toBeVisible();
    // expand chi tiết đáp án
    const row = page.locator("text=/tester hs/i").first();
    await row.click().catch(() => {});
    await expect(page.getByText(/chi tiết đáp án|đáp án đúng/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("X-03: Nút Xuất CSV hiển thị trong submissions", async ({ page }) => {
    await page.goto(`/bang-dieu-khien/de-thi/${EXAM_ID}`);
    await expect(page.getByRole("button", { name: /xuất csv/i })).toBeVisible({ timeout: 20000 });
  });

  test("X-04: Sao chép mã mời", async ({ page }) => {
    await page.goto(`/bang-dieu-khien/de-thi/${EXAM_ID}`);
    const copyBtn = page.getByRole("button", { name: /sao chép/i }).first();
    await expect(copyBtn).toBeVisible({ timeout: 20000 });
    await copyBtn.click();
    await expect(page.getByText(/đã sao chép/i)).toBeVisible({ timeout: 5000 });
  });

  test("X-05: Nút Đóng đề + Xóa đề hiển thị", async ({ page }) => {
    await page.goto(`/bang-dieu-khien/de-thi/${EXAM_ID}`);
    await expect(page.getByRole("button", { name: /đóng đề/i })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("button", { name: /xóa đề/i })).toBeVisible();
  });
});
