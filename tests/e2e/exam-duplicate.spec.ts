import { test, expect, request as pwRequest } from "@playwright/test";
import { STUDENT, TEACHER, login, startAttempt, BASE_URL } from "./helpers";

/* EXAM-2 — nhân bản đề thi:
 *  E-01 API: bản sao copy câu hỏi + cài đặt, đặt lại mã vào thi, trạng thái nháp,
 *       KHÔNG kèm lịch mở/đóng, KHÔNG kèm bài nộp, KHÔNG kèm link bảng điểm
 *  E-02 đề gốc không bị thay đổi
 *  E-03 UI: bấm nút "Nhân bản" → mở thẳng đề mới
 *  E-04 quyền: học sinh 403, khách 401, id lạ 404 */

test.describe.configure({ mode: "serial" });

let EXAM_ID = "";
let ORIG_TITLE = "";
const CREATED: string[] = [];

async function contextFor(email?: string, password?: string) {
  const req = await pwRequest.newContext({ baseURL: BASE_URL });
  if (!email) return req;
  const csrf = (await (await req.get("/api/auth/csrf")).json()).csrfToken;
  await req.post("/api/auth/callback/credentials", {
    form: { csrfToken: csrf, email, password: password ?? "" },
  });
  return req;
}

type AnyQ = {
  id: string;
  type: string;
  text: string;
  options: string[];
  answer: string;
  grading: unknown;
  explanation?: string | null;
  points: number;
  order: number;
};

/** Chỉ so phần NỘI DUNG câu hỏi (id phải khác nhau ở bản sao). */
const shapeOf = (q: AnyQ) => ({
  type: q.type,
  text: q.text,
  options: q.options,
  answer: q.answer,
  grading: q.grading ?? null,
  explanation: q.explanation ?? null,
  points: q.points,
  order: q.order,
});

test.beforeAll(async () => {
  const req = await contextFor(TEACHER.email, TEACHER.password);

  const res = await req.post("/api/exams", {
    data: {
      title: `QA-DUP-${Date.now()}`,
      subject: "Toán",
      description: "Đề gốc để kiểm tra nhân bản",
      durationMinutes: 25,
      maxAttempts: 3,
      shuffleQuestions: true,
      shuffleAnswers: true,
      proctorMode: "light",
      openAt: new Date(Date.now() + 86400000).toISOString(),
      closeAt: new Date(Date.now() + 172800000).toISOString(),
      questions: [
        {
          type: "mcq",
          question: "DUP câu 1 (trắc nghiệm)",
          options: ["a", "b", "c", "d"],
          answer: "C",
          points: 4,
          grading: { image: "https://example.com/dup.png" },
        },
        {
          type: "short_answer",
          question: "DUP câu 2 (trả lời ngắn)",
          points: 3,
          grading: { acceptedAnswers: ["hà nội", "ha noi"] },
        },
        {
          type: "true_false",
          question: "DUP câu 3 (đúng/sai)",
          points: 3,
          grading: {
            statements: [
              { text: "Mệnh đề một", answer: true, points: 1.5 },
              { text: "Mệnh đề hai", answer: false, points: 1.5 },
            ],
          },
        },
      ],
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  const exam = (await res.json()).exam;
  EXAM_ID = exam.id;
  ORIG_TITLE = exam.title;
  CREATED.push(EXAM_ID);

  // Có sẵn 1 bài nộp để chứng minh bản sao KHÔNG mang bài nộp sang.
  const detail = (await (await req.get(`/api/exams/${EXAM_ID}`)).json()).exam;
  const q = detail.questions as AnyQ[];
  const stu = await contextFor(STUDENT.email, STUDENT.password);
  const attemptId = await startAttempt(stu, EXAM_ID);
  const sub = await stu.post("/api/submissions", {
    data: { examId: EXAM_ID, attemptId, answers: { [q[0].id]: "C", [q[1].id]: "hà nội" } },
  });
  expect(sub.status(), await sub.text()).toBe(200);
  await stu.dispose();
  await req.dispose();
});

test.afterAll(async () => {
  if (CREATED.length === 0) return;
  try {
    const req = await contextFor(TEACHER.email, TEACHER.password);
    for (const id of CREATED) {
      await req.fetch(`/api/exams/${id}`, { method: "DELETE" }).catch(() => {});
    }
    await req.dispose();
  } catch {
    /* đề thí nghiệm sót thì chạy lại vẫn dọn được */
  }
});

test("E-01: bản sao có đủ câu hỏi + cài đặt, đặt lại mã, trạng thái nháp, bỏ lịch + bài nộp", async () => {
  const req = await contextFor(TEACHER.email, TEACHER.password);

  const before = (await (await req.get(`/api/exams/${EXAM_ID}`)).json()).exam;
  const res = await req.post(`/api/exams/${EXAM_ID}/duplicate`);
  expect(res.status(), await res.text()).toBe(201);
  const copy = (await res.json()).exam;
  CREATED.push(copy.id);

  expect(copy.id).not.toBe(before.id);
  expect(copy.title).toBe(`${ORIG_TITLE} (bản sao)`);
  expect(copy.subject).toBe(before.subject);
  expect(copy.description).toBe(before.description);
  expect(copy.durationMinutes).toBe(25);
  expect(copy.maxAttempts).toBe(3);
  expect(copy.shuffleQuestions).toBe(true);
  expect(copy.shuffleAnswers).toBe(true);
  expect(copy.proctorMode).toBe("light");
  expect(copy.showAnswers).toBe(before.showAnswers);
  expect(copy.showScoreImmediately).toBe(before.showScoreImmediately);

  // Bản sao phải an toàn: nháp, không lịch, không link bảng điểm, không bài nộp.
  expect(copy.status, "bản sao phải ở trạng thái nháp").toBe("draft");
  expect(copy.openAt, "không copy lịch mở").toBeNull();
  expect(copy.closeAt, "không copy lịch đóng").toBeNull();
  expect(copy.liveToken, "không copy link bảng điểm trực tiếp").toBeNull();
  expect(copy.joinCode, "phải đặt lại mã vào thi").not.toBe(before.joinCode);
  expect(copy.joinCode).toMatch(/^[A-Z2-9]{6}$/);
  expect(copy._count.questions).toBe(3);
  expect(copy._count.submissions, "không mang bài nộp sang").toBe(0);

  // Nội dung câu hỏi (điểm/đáp án/ảnh/lời giải/thứ tự) giữ nguyên, id thì mới.
  const copyQs = (await (await req.get(`/api/exams/${copy.id}`)).json()).exam.questions as AnyQ[];
  const origQs = (await (await req.get(`/api/exams/${EXAM_ID}`)).json()).exam.questions as AnyQ[];
  expect(copyQs.map(shapeOf)).toEqual(origQs.map(shapeOf));
  expect(copyQs.map((x) => x.id)).not.toEqual(origQs.map((x) => x.id));

  await req.dispose();
});

test("E-02: đề gốc không bị thay đổi sau khi nhân bản", async () => {
  const req = await contextFor(TEACHER.email, TEACHER.password);
  const orig = (await (await req.get(`/api/exams/${EXAM_ID}`)).json()).exam;

  expect(orig.title).toBe(ORIG_TITLE);
  expect(orig.status).toBe("published");
  expect(orig.openAt).not.toBeNull();
  expect(orig.closeAt).not.toBeNull();
  expect(orig._count.submissions).toBe(1);
  expect((orig.questions as AnyQ[])).toHaveLength(3);

  await req.dispose();
});

test("E-03: bấm nút Nhân bản → mở thẳng đề mới (bản nháp, 0 bài nộp)", async ({ page }) => {
  await login(page, TEACHER.email, TEACHER.password);
  await page.goto(`/bang-dieu-khien/de-thi/${EXAM_ID}`);

  await page.getByRole("button", { name: /nhân bản/i }).click();
  await page.waitForURL(/\/bang-dieu-khien\/de-thi\/[A-Za-z0-9_-]+$/, { timeout: 30000 });
  const newId = new URL(page.url()).pathname.split("/").filter(Boolean).pop()!;
  CREATED.push(newId);

  expect(newId, "phải mở đề MỚI chứ không phải đề gốc").not.toBe(EXAM_ID);
  await expect(page.getByRole("heading", { name: new RegExp(`${ORIG_TITLE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\(bản sao\\)`) })).toBeVisible();
  await expect(page.getByText("0 bài nộp")).toBeVisible();
  await expect(page.getByText("Đã đóng")).toBeVisible();
});

test("E-04: chỉ chủ đề mới nhân bản được (khách 401, học sinh 403, id lạ 404)", async () => {
  const anon = await pwRequest.newContext({ baseURL: BASE_URL });
  expect((await anon.post(`/api/exams/${EXAM_ID}/duplicate`)).status(), "khách phải 401").toBe(401);
  await anon.dispose();

  const stu = await contextFor(STUDENT.email, STUDENT.password);
  expect((await stu.post(`/api/exams/${EXAM_ID}/duplicate`)).status(), "học sinh phải 403").toBe(403);
  await stu.dispose();

  const req = await contextFor(TEACHER.email, TEACHER.password);
  expect((await req.post("/api/exams/khong-ton-tai/duplicate")).status(), "id lạ phải 404").toBe(404);
  await req.dispose();
});
