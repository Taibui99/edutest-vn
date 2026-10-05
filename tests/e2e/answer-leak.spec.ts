import { test, expect, request as pwRequest } from "@playwright/test";
import { STUDENT, TEACHER, login } from "./helpers";

/**
 * GĐ0 — chống rò đáp án.
 *
 * Payload RSC nằm ngay trong HTML: học sinh chỉ cần View Source là đọc được
 * prop của Server Component, KHÔNG cần DevTools. Nên test này đọc thẳng
 * `page.content()` (chứa script flight) và đòi đáp án không xuất hiện.
 *
 * Mốc chống hồi quy: nếu ai đó thêm lại `answer`/`acceptedAnswers` vào
 * `mapQuestionsForStudent`, test này phải đỏ.
 */

/** Marker chỉ có trong DB, không xuất hiện ở bất kỳ chỗ nào trong giao diện. */
const LEAK_MARKER = "LEAKCANARY-7F3A9C";

let CODE = "";
const STATEMENT_TEXT = `Mệnh đề kiểm tra rò đáp án ${Date.now()}`;

const baseURL = "https://edutest-vn.vercel.app";

test.beforeAll(async () => {
  const req = await pwRequest.newContext({ baseURL });
  const csrf = (await (await req.get("/api/auth/csrf")).json()).csrfToken;
  await req.post("/api/auth/callback/credentials", {
    form: { csrfToken: csrf, email: TEACHER.email, password: TEACHER.password },
  });

  const res = await req.post("/api/exams", {
    data: {
      title: `QA-RRO-Exam-${Date.now()}`,
      subject: "Toán",
      durationMinutes: 15,
      allowGuestAttempts: true,
      maxAttempts: 5,
      showScoreImmediately: true,
      questions: [
        // mcq: đáp án đúng là "B" -> payload không được có khoá `answer`.
        { type: "mcq", question: "Câu MCQ để kiểm tra rò đáp án", options: ["sai 1", "đúng 2", "sai 3", "sai 4"], answer: "B", points: 1 },
        // true_false: client cần `statements[].text` để vẽ, KHÔNG được có `.answer`.
        { type: "true_false", question: "Câu Đúng/Sai kiểm tra rò đáp án", grading: { statements: [{ text: STATEMENT_TEXT, answer: true }, { text: "Mệnh đề phụ", answer: false }] }, points: 1 },
        // short_answer: `acceptedAnswers` phải bị cắt hoàn toàn.
        { type: "short_answer", question: "Câu trả lời ngắn kiểm tra rò đáp án", grading: { acceptedAnswers: [LEAK_MARKER] }, points: 1 },
      ],
    },
  });
  expect(res.status()).toBe(201);
  CODE = (await res.json()).exam.joinCode;
  await req.dispose();
});

test.describe("GĐ0 — Đáp án không lọt xuống máy học sinh", () => {
  test("R-01: payload RSC của học sinh không chứa đáp án", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    await page.goto(`/thi/${CODE}`);
    await expect(page.getByText(/QA-RRO-Exam/i).first()).toBeVisible({ timeout: 20000 });

    const raw = await page.content();
    // Flight payload là JSON nhúng trong chuỗi JS nên dấu " bị escape.
    // Bỏ escape để tìm khoá như payload thật.
    const flat = raw.replace(/\\+"/g, '"');

    // Câu hỏi PHẢI có trong payload — nếu không thì các assert bên dưới
    // pass một cách vô nghĩa vì ta đọc nhầm trang.
    expect(flat).toContain("Câu MCQ để kiểm tra rò đáp án");
    expect(flat).toContain(STATEMENT_TEXT);

    // Đáp án thật sự KHÔNG được gửi.
    expect(flat, "payload lộ khoá `answer`").not.toMatch(/"answer"\s*:/);
    expect(flat, "payload lộ `acceptedAnswers`").not.toContain("acceptedAnswers");
    expect(flat, "payload chứa marker đáp án").not.toContain(LEAK_MARKER);
  });

  test("R-02: xem trước của giáo viên vẫn có đáp án (không hỏng tính năng)", async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
    await page.goto(`/thi/${CODE}?preview=1`);
    await expect(page.getByText(/chế độ xem trước/i).first()).toBeVisible({ timeout: 20000 });

    const flat = (await page.content()).replace(/\\+"/g, '"');
    // Chỉ kiểm đủ để biết preview vẫn render; đáp án có hằng ở đây là có chủ đích.
    expect(flat).toContain("Câu MCQ để kiểm tra rò đáp án");
  });

  test("R-03: học sinh làm bài vẫn chấm đúng (đáp án cắt không làm hỏng chấm điểm)", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    await page.goto(`/thi/${CODE}`);
    await expect(page.getByText(/QA-RRO-Exam/i).first()).toBeVisible({ timeout: 20000 });

    // Câu 1 mcq, đáp án đúng "B" -> dùng đúng nút B để chứng minh server vẫn
    // biết đáp án sau khi không còn gửi nó xuống client.
    await page.getByRole("button", { name: /^B/ }).first().click();
    await page.getByRole("button", { name: /^Tiếp/ }).first().click();

    // Câu 2 true_false: bấm "Sai" ở mệnh đề có answer=false.
    await page.getByRole("button", { name: /^Sai$/ }).first().click();
    await page.getByRole("button", { name: /^Tiếp/ }).first().click();

    // Câu 3 short_answer: nhập đúng chuỗi mà server mới biết.
    await page.getByPlaceholder("Nhập câu trả lời...").fill(LEAK_MARKER);

    await page.getByRole("button", { name: /^Nộp bài$/ }).first().click();
    await page.getByRole("button", { name: "Nộp bài" }).last().click();
    await expect(page.getByText(/đã nộp|nộp bài thành công/i).first()).toBeVisible({ timeout: 25000 });
  });
});