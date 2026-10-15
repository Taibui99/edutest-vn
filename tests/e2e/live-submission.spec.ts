import { test, expect, request as pwRequest } from "@playwright/test";
import { STUDENT, TEACHER, startAttempt, BASE_URL } from "./helpers";

/* LIVE-1b — màn hình chi tiết bài làm khi bấm tên trên bảng điểm:
 *  D-01 API chi tiết: không đăng nhập, đề đang mở → đủ thông tin NHƯNG giấu đáp án
 *  D-02 bấm tên trên bảng → màn riêng, chữ to, đủ thông tin, quay lại bảng được
 *  D-03 GV đóng đề → người xem không đăng nhập thấy đáp án chuẩn
 *  D-04 token lạ / submission không thuộc token → 404 */

test.describe.configure({ mode: "serial" });

let EXAM_ID = "";
let TOKEN = "";
let SUB_ID = "";
const Q: string[] = [];

const publicBoard = (token: string) => `/api/public/live/${encodeURIComponent(token)}`;
const publicDetail = (token: string, subId: string) => `${publicBoard(token)}/${encodeURIComponent(subId)}`;

async function teacherContext() {
  const req = await pwRequest.newContext({ baseURL: BASE_URL });
  const csrf = (await (await req.get("/api/auth/csrf")).json()).csrfToken;
  await req.post("/api/auth/callback/credentials", {
    form: { csrfToken: csrf, email: TEACHER.email, password: TEACHER.password },
  });
  return req;
}

test.beforeAll(async () => {
  const req = await teacherContext();

  // Tổng 10đ: 4 (trắc nghiệm) + 3 (trả lời ngắn) + 3 (trắc nghiệm).
  const res = await req.post("/api/exams", {
    data: {
      title: `QA-LIVEDET-${Date.now()}`,
      subject: "Toán",
      durationMinutes: 20,
      maxAttempts: 5,
      showScoreImmediately: true,
      questions: [
        { type: "mcq", question: "LIVEDET câu 1 (4đ)", options: ["a", "b", "c", "d"], answer: "A", points: 4 },
        {
          type: "short_answer",
          question: "LIVEDET câu 2 — thủ đô của Việt Nam là gì?",
          points: 3,
          grading: { acceptedAnswers: ["hà nội", "ha noi"] },
        },
        { type: "mcq", question: "LIVEDET câu 3 (3đ)", options: ["a", "b"], answer: "B", points: 3 },
      ],
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  const exam = (await res.json()).exam;
  EXAM_ID = exam.id;

  const detail = await req.get(`/api/exams/${EXAM_ID}`);
  expect(detail.status()).toBe(200);
  const questions = (await detail.json()).exam.questions as Array<{ id: string }>;
  Q.push(...questions.map((q) => q.id));
  expect(Q).toHaveLength(3);

  const info = await req.post(`/api/exams/${EXAM_ID}/live`, { data: { action: "enable" } });
  expect(info.status(), await info.text()).toBe(200);
  TOKEN = String((await info.json()).token);
  expect(TOKEN).toMatch(/^[0-9a-f]{32}$/);
  await req.dispose();

  // Học sinh nộp 1 bài: đúng câu 4đ + câu trả lời ngắn 3đ, sai câu 3đ → 7 điểm.
  const stu = await pwRequest.newContext({ baseURL: BASE_URL });
  const stuCsrf = (await (await stu.get("/api/auth/csrf")).json()).csrfToken;
  await stu.post("/api/auth/callback/credentials", {
    form: { csrfToken: stuCsrf, email: STUDENT.email, password: STUDENT.password },
  });
  const attemptId = await startAttempt(stu, EXAM_ID);
  const sub = await stu.post("/api/submissions", {
    data: { examId: EXAM_ID, attemptId, answers: { [Q[0]]: "A", [Q[1]]: "hà nội", [Q[2]]: "A" } },
  });
  expect(sub.status(), await sub.text()).toBe(200);
  await stu.dispose();

  const pub = await pwRequest.newContext({ baseURL: BASE_URL });
  const board = await (await pub.get(publicBoard(TOKEN))).json();
  expect(board.submittedCount).toBe(1);
  SUB_ID = String(board.rows[0].id);
  expect(board.rows[0].score, "điểm = 10 − 3 điểm mất").toBe(7);
  await pub.dispose();
});

test.afterAll(async () => {
  if (!EXAM_ID) return;
  try {
    const req = await teacherContext();
    await req.fetch(`/api/exams/${EXAM_ID}`, { method: "DELETE" });
    await req.dispose();
  } catch {
    /* đề thí nghiệm sót thì lần chạy sau vẫn dọn được */
  }
});

test("D-01: API chi tiết không đăng nhập — đủ thông tin, GIẤU đáp án khi đề đang mở", async () => {
  const pub = await pwRequest.newContext({ baseURL: BASE_URL });
  const res = await pub.get(publicDetail(TOKEN, SUB_ID));
  expect(res.status(), await res.text()).toBe(200);
  expect(res.headers()["cache-control"], "phải no-store").toContain("no-store");

  const d = await res.json();
  expect(d.found).toBe(true);
  expect(d.phase, "chưa set closeAt → đề đang diễn ra").toBe("live");
  expect(d.showAnswerKey, "không đăng nhập + đề đang mở → không được thấy đáp án").toBe(false);

  expect(d.exam.title).toContain("QA-LIVEDET-");
  expect(d.exam.totalPoints).toBe(10);
  expect(d.exam.questionCount).toBe(3);

  expect(d.submission.name, "phải hiện tên thật").toBe("Tester HS");
  expect(d.submission.score).toBe(7);
  expect(d.submission.correctCount).toBe(2);
  expect(d.submission.totalQuestions).toBe(3);
  expect(d.submission.rank).toBe(1);
  expect(d.submission.submittedTotal).toBe(1);
  expect(d.submission.className).toBeTruthy();
  expect(d.submission.durationSeconds).toBeGreaterThanOrEqual(0);
  expect(d.submission.submittedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

  expect(d.questions).toHaveLength(3);
  // Câu trắc nghiệm: đúng 4đ.
  expect(d.questions[0].status).toBe("correct");
  expect(d.questions[0].earned).toBe(4);
  expect(d.questions[0].points).toBe(4);
  expect(d.questions[0].studentAnswer).toBe("A");
  expect(d.questions[0].key, "đề đang mở → không có đáp án MCQ").toBeFalsy();
  // Câu trả lời ngắn: đúng 3đ, nhưng acceptedAnswers bị giấu.
  expect(d.questions[1].status).toBe("correct");
  expect(d.questions[1].earned).toBe(3);
  expect(d.questions[1].answered).toBe(true);
  expect(d.questions[1].key?.acceptedAnswers, "không được lộ đáp án chấp nhận").toBeUndefined();
  // Câu sai: 0đ.
  expect(d.questions[2].status).toBe("wrong");
  expect(d.questions[2].earned).toBe(0);

  await pub.dispose();
});

test("D-02: bấm tên trên bảng xếp hạng → màn chi tiết chữ to, đủ thông tin, quay lại được", async ({ page }) => {
  await page.goto(`/truc-tiep/${TOKEN}`);
  await expect(page.getByText("Tester HS").first()).toBeVisible({ timeout: 20000 });

  const detailLink = page.locator("ul a[href*='/bai/']");
  await expect(detailLink, "tên trong bảng xếp hạng phải là link").toHaveCount(1);
  await detailLink.click();
  await page.waitForURL(/\/bai\//, { timeout: 20000 });

  // Đầy đủ thông tin: học sinh, hạng, điểm, số câu, toàn bộ câu hỏi.
  await expect(page.getByRole("heading", { name: "Tester HS" })).toBeVisible();
  await expect(page.getByText("Hạng 1/1")).toBeVisible();
  await expect(page.getByText("/ 10 điểm")).toBeVisible();
  await expect(page.getByText("2/3", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/thủ đô của Việt Nam/)).toBeVisible();
  await expect(page.getByText("LIVEDET câu 1 (4đ)").first()).toBeVisible();
  await expect(page.getByText("LIVEDET câu 3 (3đ)").first()).toBeVisible();
  await expect(page.getByText("Bài làm của học sinh").first()).toBeVisible();
  await expect(page.getByText("hà nội").first()).toBeVisible();
  await expect(page.getByText("Đúng", { exact: true }).first()).toBeVisible();

  // Đề đang mở + chưa đăng nhập → không lộ đáp án.
  await expect(page.getByText("Đáp án chấp nhận")).toHaveCount(0);
  await expect(page.getByText("Đáp án đúng")).toHaveCount(0);
  await expect(page.getByText(/Đáp án chuẩn và lời giải sẽ hiển thị/)).toBeVisible();

  // Quay lại bảng điểm.
  await page.getByRole("link", { name: /Quay lại bảng điểm/ }).first().click();
  await page.waitForURL(new RegExp(`/truc-tiep/${TOKEN}$`), { timeout: 20000 });
  await expect(page.getByText("Top 3")).toBeVisible();
});

test("D-03: GV đóng đề → người xem không đăng nhập thấy đáp án chuẩn", async ({ page }) => {
  const req = await teacherContext();
  const patch = await req.fetch(`/api/exams/${EXAM_ID}`, { method: "PATCH", data: { status: "draft" } });
  expect(patch.status(), await patch.text()).toBe(200);
  await req.dispose();

  const pub = await pwRequest.newContext({ baseURL: BASE_URL });
  const d = await (await pub.get(publicDetail(TOKEN, SUB_ID))).json();
  expect(d.phase).toBe("closed");
  expect(d.showAnswerKey, "đề đã đóng → được thấy đáp án").toBe(true);
  expect(d.questions[1].key?.acceptedAnswers, "đề đóng thì hiện đáp án chấp nhận").toContain("hà nội");
  expect(d.questions[0].key?.answer, "đề đóng thì hiện đáp án MCQ").toBe("A");
  await pub.dispose();

  // Màn hình chi tiết cũng lộ đáp án sau khi đề đóng.
  await page.goto(`/truc-tiep/${TOKEN}/bai/${SUB_ID}`);
  await expect(page.getByText("KẾT THÚC").first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("Đáp án chấp nhận")).toBeVisible();
  await expect(page.getByText("hà nội").first()).toBeVisible();
});

test("D-04: token lạ hoặc submission không thuộc token → 404 (cả API lẫn trang)", async ({ page }) => {
  const bogus = "ffffffffffffffffffffffffffffffff";
  const pub = await pwRequest.newContext({ baseURL: BASE_URL });

  expect((await pub.get(publicDetail(bogus, SUB_ID))).status(), "token sai → 404").toBe(404);
  expect((await pub.get(publicDetail(TOKEN, bogus))).status(), "bài nộp lạ → 404").toBe(404);

  const res = await page.goto(`/truc-tiep/${bogus}/bai/${SUB_ID}`);
  expect(res?.status(), "trang token sai → 404").toBe(404);

  await pub.dispose();
});
