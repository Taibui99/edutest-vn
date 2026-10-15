import { test, expect, request as pwRequest } from "@playwright/test";
import { STUDENT, TEACHER, startAttempt, BASE_URL } from "./helpers";

/* LIVE-1 — bảng điểm trực tiếp:
 *  L-01 API công khai (KHÔNG đăng nhập) trả đúng dữ liệu
 *  L-02 có bài nộp → bảng cập nhật, xếp hạng + điểm đúng theo công thức mới
 *  L-03 mở trang bằng `page` CHƯA đăng nhập vẫn thấy bảng (mục đích link share)
 *  L-04 token sai → 404
 *  L-05 xoay token → link cũ chết; tắt → link mới cũng chết */

test.describe.configure({ mode: "serial" });

let EXAM_ID = "";
let CODE = "";
let TOKEN = "";
const Q: string[] = [];

const teacherPath = () => `/api/exams/${EXAM_ID}/live`;
const publicPath = (token: string) => `/api/public/live/${encodeURIComponent(token)}`;

async function teacherContext() {
  const req = await pwRequest.newContext({ baseURL: BASE_URL });
  const csrf = (await (await req.get("/api/auth/csrf")).json()).csrfToken;
  await req.post("/api/auth/callback/credentials", {
    form: { csrfToken: csrf, email: TEACHER.email, password: TEACHER.password },
  });
  return req;
}

test.beforeAll(async () => {
  const req = await pwRequest.newContext({ baseURL: BASE_URL });
  const csrf = (await (await req.get("/api/auth/csrf")).json()).csrfToken;
  await req.post("/api/auth/callback/credentials", {
    form: { csrfToken: csrf, email: TEACHER.email, password: TEACHER.password },
  });

  const res = await req.post("/api/exams", {
    data: {
      title: `QA-LIVE-${Date.now()}`,
      subject: "Toán",
      durationMinutes: 15,
      maxAttempts: 5,
      showScoreImmediately: true,
      // Tổng 10đ để điểm ra đúng thang 0–10 (SCORE-1).
      questions: [
        { type: "mcq", question: "LIVE câu 1 (6đ)", options: ["a", "b"], answer: "B", points: 6 },
        { type: "mcq", question: "LIVE câu 2 (4đ)", options: ["a", "b"], answer: "B", points: 4 },
      ],
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  const exam = (await res.json()).exam;
  EXAM_ID = exam.id;
  CODE = exam.joinCode;

  const detail = await req.get(`/api/exams/${EXAM_ID}`);
  expect(detail.status()).toBe(200);
  const questions = (await detail.json()).exam.questions as Array<{ id: string }>;
  Q.push(questions[0].id, questions[1].id);
  expect(Q).toHaveLength(2);

  const info = await req.post(teacherPath(), { data: { action: "enable" } });
  expect(info.status(), await info.text()).toBe(200);
  const body = await info.json();
  expect(body.enabled, "bật bảng điểm phải trả enabled=true").toBe(true);
  TOKEN = String(body.token);
  expect(body.liveUrl).toContain(`/truc-tiep/${TOKEN}`);
  expect(String(body.qrUrl)).toMatch(/^data:image/);
  await req.dispose();
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

test("L-01: API bảng điểm công khai, không cần đăng nhập", async () => {
  const pub = await pwRequest.newContext({ baseURL: BASE_URL });
  const res = await pub.get(publicPath(TOKEN));
  expect(res.status(), await res.text()).toBe(200);
  const board = await res.json();

  expect(board.found).toBe(true);
  expect(board.exam.title).toContain("QA-LIVE-");
  expect(board.exam.joinCode).toBe(CODE);
  expect(board.exam.totalPoints, "tổng điểm đề").toBe(10);
  expect(board.phase, "không set openAt/closeAt → đang diễn ra").toBe("live");
  expect(board.submittedCount).toBe(0);
  expect(board.rows).toEqual([]);
  expect(res.headers()["cache-control"], "phải no-store để máy chiếu tự làm mới").toContain("no-store");
  await pub.dispose();
});

test("L-02: có bài nộp → bảng cập nhật (điểm 4 = 10 − 6 điểm mất)", async () => {
  const req = await pwRequest.newContext({ baseURL: BASE_URL });
  const csrf = (await (await req.get("/api/auth/csrf")).json()).csrfToken;
  await req.post("/api/auth/callback/credentials", {
    form: { csrfToken: csrf, email: STUDENT.email, password: STUDENT.password },
  });

  const attemptId = await startAttempt(req, EXAM_ID);
  // Sai câu 6đ, đúng câu 4đ → mất 6đ → 10 − 6 = 4 điểm.
  const sub = await req.post("/api/submissions", {
    data: { examId: EXAM_ID, attemptId, answers: { [Q[0]]: "A", [Q[1]]: "B" } },
  });
  expect(sub.status(), await sub.text()).toBe(200);

  const pub = await pwRequest.newContext({ baseURL: BASE_URL });
  const board = await (await pub.get(publicPath(TOKEN))).json();
  expect(board.submittedCount).toBe(1);
  expect(board.rows).toHaveLength(1);
  expect(board.rows[0].rank).toBe(1);
  expect(board.rows[0].score, "10 − 6 điểm mất = 4").toBe(4);
  expect(board.rows[0].correctCount).toBe(1);
  expect(board.rows[0].name, "phải hiện tên thật").not.toBe("Khách");
  expect(board.startedCount).toBeGreaterThanOrEqual(1);
  expect(board.stats.avg).toBe(4);

  await req.dispose();
  await pub.dispose();
});

test("L-03: mở trang /truc-tiep bằng trình duyệt CHƯA đăng nhập vẫn thấy bảng", async ({ page }) => {
  const res = await page.goto(`/truc-tiep/${TOKEN}`);
  expect(res?.status(), "trang công khai không 404").not.toBe(404);
  expect(page.url(), "không bị đá về trang đăng nhập").toContain("/truc-tiep/");

  await expect(page.getByText(/QA-LIVE-/).first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("TRỰC TIẾP").first()).toBeVisible();
  await expect(page.getByText("Đã nộp").first()).toBeVisible();
  await expect(page.getByText("Top 3").first()).toBeVisible();
  await expect(page.getByText(CODE, { exact: true }).first()).toBeVisible();
  // Số điểm 4 của bài vừa nộp nằm trong bảng/bục.
  await expect(page.getByText("4", { exact: true }).first()).toBeVisible();
});

test("L-04: token không tồn tại → 404 (cả API lẫn trang)", async ({ page }) => {
  const bogus = "ffffffffffffffffffffffffffffffff";
  const pub = await pwRequest.newContext({ baseURL: BASE_URL });
  expect((await pub.get(publicPath(bogus))).status()).toBe(404);
  await pub.dispose();

  const res = await page.goto(`/truc-tiep/${bogus}`);
  expect(res?.status()).toBe(404);
});

test("L-05: xoay token thì link cũ chết; tắt thì link mới cũng chết", async () => {
  const req = await teacherContext();
  const pub = await pwRequest.newContext({ baseURL: BASE_URL });

  const rotated = await req.post(teacherPath(), { data: { action: "rotate" } });
  expect(rotated.status(), await rotated.text()).toBe(200);
  const nextToken = String((await rotated.json()).token);
  expect(nextToken).not.toBe(TOKEN);

  expect((await pub.get(publicPath(TOKEN))).status(), "link cũ phải 404 sau khi xoay").toBe(404);
  expect((await pub.get(publicPath(nextToken))).status()).toBe(200);

  const off = await req.post(teacherPath(), { data: { action: "disable" } });
  expect(off.status()).toBe(200);
  expect((await off.json()).enabled).toBe(false);
  expect((await pub.get(publicPath(nextToken))).status(), "link phải 404 sau khi tắt").toBe(404);

  TOKEN = nextToken;
  await req.dispose();
  await pub.dispose();
});
