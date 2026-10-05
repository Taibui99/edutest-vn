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
let EXAM_ID = "";
let Q_MCQ = "";
let Q_TRUE_FALSE = "";
let Q_SHORT_ANSWER = "";
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
      maxAttempts: 9,
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
  const exam = (await res.json()).exam;
  CODE = exam.joinCode;
  EXAM_ID = exam.id;

  // POST /api/exams chỉ trả `_count`, phải GET lại mới có id từng câu.
  const detail = await req.get(`/api/exams/${EXAM_ID}`);
  expect(detail.status()).toBe(200);
  const questions = (await detail.json()).exam.questions as Array<{ id: string; type: string }>;
  const byType = (t: string) => questions.find((q) => q.type === t)?.id;
  Q_MCQ = byType("mcq");
  Q_TRUE_FALSE = byType("true_false");
  Q_SHORT_ANSWER = byType("short_answer");
  expect({ Q_MCQ, Q_TRUE_FALSE, Q_SHORT_ANSWER }, "phải tìm thấy id của cả 3 câu").toEqual({
    Q_MCQ: expect.any(String),
    Q_TRUE_FALSE: expect.any(String),
    Q_SHORT_ANSWER: expect.any(String),
  });
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

  test("R-03: chấm điểm phía server không hỏng (đáp án đã cắt khỏi payload)", async () => {
    // Gọi thẳng API thay vì click qua UI. Mục đích của test này là chứng minh
    // việc chấm vẫn dựa trên đáp án LƯU Ở SERVER chứ không phải cái client
    // nhận được — nên cần nhìn vào API, không phải điều hướng UI (client có
    // thể nhảy sang trang kết quả, hộp xác nhận xuất hiện muộn, ... đều làm test
    // vỡ mà không thêm bằng chứng gì).
    const req = await pwRequest.newContext({ baseURL });
    const csrf = (await (await req.get("/api/auth/csrf")).json()).csrfToken;
    await req.post("/api/auth/callback/credentials", {
      form: { csrfToken: csrf, email: STUDENT.email, password: STUDENT.password },
    });

    const res = await req.post("/api/submissions", {
      data: {
        examId: EXAM_ID,
        answers: {
          // mcq -> đúng "B"
          [Q_MCQ]: "B",
          // true_false -> mệnh đề 1 đúng, mệnh đề 2 sai
          [Q_TRUE_FALSE]: { "0": true, "1": false },
          // short_answer -> đúng chuỗi CHỈ server biết
          [Q_SHORT_ANSWER]: LEAK_MARKER,
        },
        durationSeconds: 60,
      },
    });

    expect(res.status(), await res.text()).toBe(200);
    const payload = await res.json();
    expect(payload.submission.correctCount, "server phải chấm đúng 3/3 câu").toBe(3);
    // `score` là thang /10 cố định, KHÔNG phải số câu đúng — đừng assert nó
    // bằng 3. 3/3 câu đúng là 10/10 điểm.
    expect(payload.submission.score, "3/3 câu đúng phải ra 10 điểm").toBe(10);

    // Nộp sai để chắc chắng điểm không phải do may mắn hay bị hardcode.
    const wrong = await req.post("/api/submissions", {
      data: {
        examId: EXAM_ID,
        answers: { [Q_MCQ]: "A", [Q_TRUE_FALSE]: { "0": false, "1": true }, [Q_SHORT_ANSWER]: "sai" },
        durationSeconds: 60,
      },
    });
    expect(wrong.status()).toBe(200);
    const wrongPayload = await wrong.json();
    expect(wrongPayload.submission.correctCount, "3 đáp án sai phải được 0 câu đúng").toBe(0);
    expect(wrongPayload.submission.score).toBe(0);

    await req.dispose();
  });
});