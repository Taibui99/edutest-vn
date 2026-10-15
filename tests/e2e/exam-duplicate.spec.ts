import { test, expect, request as pwRequest, type APIRequestContext } from "@playwright/test";
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

/* Đăng nhập 1 lần dùng chung cho cả file — tránh đụng rate-limit của endpoint
 * đăng nhập khi chạy nhiều spec liên tiếp. */
let teacher: APIRequestContext;
let student: APIRequestContext;

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

/** Escape chuỗi để nhét vào RegExp (tên đề có thể chứa ký tự đặc biệt). */
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
  teacher = await contextFor(TEACHER.email, TEACHER.password);
  student = await contextFor(STUDENT.email, STUDENT.password);

  // Xác nhận phiên GV thật sự hợp lệ trước khi làm gì (lỗi 401 sẽ lộ rõ tại đây).
  const who = await teacher.get("/api/exams");
  expect(who.status(), `đăng nhập giáo viên thất bại: ${await who.text()}`).toBe(200);

  const res = await teacher.post("/api/exams", {
    data: {
      title: `QA-DUP-${Date.now()}`,
      subject: "Toán",
      description: "Đề gốc để kiểm tra nhân bản",
      durationMinutes: 25,
      maxAttempts: 3,
      shuffleQuestions: true,
      shuffleAnswers: true,
      proctorMode: "light",
      openAt: new Date(Date.now() - 3600000).toISOString(),
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
  const detail = (await (await teacher.get(`/api/exams/${EXAM_ID}`)).json()).exam;
  const q = detail.questions as AnyQ[];
  const attemptId = await startAttempt(student, EXAM_ID);
  const sub = await student.post("/api/submissions", {
    data: { examId: EXAM_ID, attemptId, answers: { [q[0].id]: "C", [q[1].id]: "hà nội" } },
  });
  expect(sub.status(), await sub.text()).toBe(200);
});

test.afterAll(async () => {
  try {
    if (teacher && CREATED.length > 0) {
      for (const id of CREATED) {
        await teacher.fetch(`/api/exams/${id}`, { method: "DELETE" }).catch(() => {});
      }
    }
  } catch {
    /* đề thí nghiệm sót thì chạy lại vẫn dọn được */
  }
  await teacher?.dispose().catch(() => {});
  await student?.dispose().catch(() => {});
});

test("E-01: bản sao có đủ câu hỏi + cài đặt, đặt lại mã, trạng thái nháp, bỏ lịch + bài nộp", async () => {
  const req = teacher;

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
});

test("E-02: đề gốc không bị thay đổi sau khi nhân bản", async () => {
  const req = teacher;
  const orig = (await (await req.get(`/api/exams/${EXAM_ID}`)).json()).exam;

  expect(orig.title).toBe(ORIG_TITLE);
  expect(orig.status).toBe("published");
  expect(orig.openAt).not.toBeNull();
  expect(orig.closeAt).not.toBeNull();
  expect((orig.questions as AnyQ[])).toHaveLength(3);

  // GET /api/exams/[id] không kèm _count → lấy số bài nộp từ danh sách đề.
  const list = (await (await req.get("/api/exams")).json()).exams as { id: string; _count?: { submissions: number } }[];
  const row = list.find((e) => e.id === EXAM_ID);
  expect(row?._count?.submissions, "bài nộp của đề gốc phải còn nguyên").toBe(1);
});

test("E-03: bấm nút Nhân bản → mở thẳng đề mới (bản nháp, 0 bài nộp)", async ({ page }) => {
  const dialogs: string[] = [];
  page.on("dialog", async (d) => { dialogs.push(d.message()); await d.dismiss(); });

  await login(page, TEACHER.email, TEACHER.password);
  await page.goto(`/bang-dieu-khien/de-thi/${EXAM_ID}`);
  const dupBtn = page.getByRole("button", { name: /nhân bản/i });
  await expect(dupBtn).toBeVisible({ timeout: 20000 });

  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/duplicate") && r.request().method() === "POST", { timeout: 30000 }),
    dupBtn.click(),
  ]);
  expect(resp.status(), `POST duplicate lỗi: ${await resp.text()}${dialogs.length ? ` | dialog: ${dialogs.join("; ")}` : ""}`).toBe(201);

  const newId = (await resp.json()).exam.id as string;
  CREATED.push(newId);
  expect(newId, "phải tạo đề MỚI chứ không phải đề gốc").not.toBe(EXAM_ID);

  // Next là điều hướng phía client → chờ URL ĐỔI sang đề mới.
  await page.waitForURL((url) => url.pathname.endsWith(`/de-thi/${newId}`), { timeout: 30000 });
  await expect(page.getByRole("heading", { name: new RegExp(`${esc(ORIG_TITLE)} \\(bản sao\\)`) })).toBeVisible();
  await expect(page.getByText("0 bài nộp")).toBeVisible();
  await expect(page.getByText("Đã đóng")).toBeVisible();
});

test("E-04: chỉ chủ đề mới nhân bản được (khách 401, học sinh 403, id lạ 404)", async () => {
  const anon = await pwRequest.newContext({ baseURL: BASE_URL });
  expect((await anon.post(`/api/exams/${EXAM_ID}/duplicate`)).status(), "khách phải 401").toBe(401);
  await anon.dispose();

  expect((await student.post(`/api/exams/${EXAM_ID}/duplicate`)).status(), "học sinh phải 403").toBe(403);
  expect((await teacher.post("/api/exams/khong-ton-tai/duplicate")).status(), "id lạ phải 404").toBe(404);
});
