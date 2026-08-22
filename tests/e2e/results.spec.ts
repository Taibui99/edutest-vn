import { test, expect, request as pwRequest } from "@playwright/test";
import { STUDENT, login } from "./helpers";

// Tạo exam + student nộp bài để có kết quả
async function setupSubmission() {
  const req = await pwRequest.newContext({ baseURL: "https://edutest-vn.vercel.app" });
  const csrf = (await (await req.get("/api/auth/csrf")).json()).csrfToken;
  await req.post("/api/auth/callback/credentials", {
    form: { csrfToken: csrf, email: "tester-gv-20260816@edutest.vn", password: "Test@12345" },
  });
  const body = {
    title: `QA-Result-${Date.now()}`,
    subject: "Toán",
    durationMinutes: 15,
    maxAttempts: 5,
    showAnswers: true,
    showScoreImmediately: true,
    questions: [
      { type: "mcq", question: "2+2=?", options: ["3", "4", "5", "6"], answer: "B", points: 1 },
    ],
  };
  const res = await req.post("/api/exams", { data: body });
  const { exam } = await res.json();
  const detail = await (await req.get(`/api/exams/${exam.id}`)).json();

  const req2 = await pwRequest.newContext({ baseURL: "https://edutest-vn.vercel.app" });
  const csrf2 = (await (await req2.get("/api/auth/csrf")).json()).csrfToken;
  await req2.post("/api/auth/callback/credentials", {
    form: { csrfToken: csrf2, email: STUDENT.email, password: STUDENT.password },
  });
  const qid = detail.exam.questions[0].id;
  const sub = await req2.post("/api/submissions", { data: { examId: exam.id, answers: { [qid]: "B" }, durationSeconds: 45 } });
  const subJson = await sub.json();
  await req.dispose();
  await req2.dispose();
  return { submissionId: subJson.submission.id, code: exam.joinCode };
}

let DATA: any = null;

test.beforeAll(async () => {
  DATA = await setupSubmission();
});

test.describe("RESULTS — Kết quả bài thi", () => {
  test("R-01: Trang kết quả hiển thị điểm + phân tích", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    await page.goto(`/bang-dieu-khien/ket-qua/${DATA.submissionId}`);
    await expect(page.getByText(/\/10/i).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/nộp lúc/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /về dashboard/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /thi tiếp/i })).toBeVisible();
  });

  test("R-02: Xem lại đáp án hiển thị câu hỏi", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    await page.goto(`/bang-dieu-khien/ket-qua/${DATA.submissionId}`);
    const toggle = page.getByRole("button", { name: /xem lại đáp án/i });
    await expect(toggle).toBeVisible({ timeout: 20000 });
    await toggle.click();
    await expect(page.getByText(/câu 1/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("R-03: Student không có quyền xem kết quả người khác", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    // ID fake
    await page.goto(`/bang-dieu-khien/ket-qua/cmsnonexistent0000000000`);
    await expect(page.getByText(/không tìm thấy|không có quyền|lỗi/i).first()).toBeVisible({ timeout: 20000 });
  });
});
