import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * GĐ1 — Toàn bộ "lần làm bài" do SERVER quyết định.
 *
 * Client không còn được phép: tự sinh thứ tự (`Math.random()`), tự tính thời
 * gian (`durationMinutes * 60 - remaining` gửi lên khi nộp). server là nguồn
 * sự thật duy nhất: `startedAt`/`deadlineAt` sinh lúc bắt đầu, `seed` +
 * `questionOrder`/`optionOrder` sinh một lần và lưu trong DB.
 */

/** Số giây server nới thêm sau `deadlineAt` — bù lệch đồng hồ client/server và
 *  gói tin cuối đi chậm. Client không được cộng giờ này vào hiển thị. */
export const ATTEMPT_GRACE_SECONDS = 30;

export type AttemptSnapshot = {
  id: string;
  examId: string;
  /** Thứ tự hiển thị câu — index vào danh sách câu đã `orderBy: { order: "asc" }`. */
  questionOrder: number[];
  /** `{ [questionId]: [thứ tự hiển thị đáp án] }` — chỉ có khi đề bật xáo trộn. */
  optionOrder: Record<string, number[]>;
  startedAt: Date;
  deadlineAt: Date;
  /** Số giây còn lại TẠI THỜI ĐIỂM ĐỌC — client dùng làm mốc khởi động đồng hồ. */
  remainingSeconds: number;
  submittedAt: Date | null;
};

/** mulberry32 — PRNG 32-bit rất nhỏ, không cần thư viện ngoài.
 *  Đủ để hoán vị câu/đáp án: cùng seed ⇒ cùng hoán vị trên mọi máy. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates có seed trên dãy `0..n-1`. */
export function shuffledIndices(n: number, seed: number): number[] {
  const rnd = mulberry32(seed);
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Khóa UNIQUE chặn thi song song: mỗi người chỉ được MỘT attempt đang mở. */
export function studentActiveKey(userId: string): string {
  return `student:${userId}`;
}

export function guestActiveKey(token: string): string {
  return `guest:${createHash("sha256").update(token).digest("hex")}`;
}

export function remainingSecondsOf(deadlineAt: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((deadlineAt.getTime() - now.getTime()) / 1000));
}

type QuestionForShuffle = { id: string; type: string; options: string[] };

function toSnapshot(a: {
  id: string;
  examId: string;
  questionOrder: unknown;
  optionOrder: unknown;
  startedAt: Date;
  deadlineAt: Date;
  submittedAt: Date | null;
}): AttemptSnapshot {
  const questionOrder = Array.isArray(a.questionOrder)
    ? (a.questionOrder as unknown[]).filter((v): v is number => Number.isInteger(v))
    : [];
  const optionOrder: Record<string, number[]> = {};
  if (a.optionOrder && typeof a.optionOrder === "object" && !Array.isArray(a.optionOrder)) {
    for (const [qid, perm] of Object.entries(a.optionOrder as Record<string, unknown>)) {
      if (Array.isArray(perm)) optionOrder[qid] = (perm as unknown[]).filter((v): v is number => Number.isInteger(v));
    }
  }
  return {
    id: a.id,
    examId: a.examId,
    questionOrder,
    optionOrder,
    startedAt: a.startedAt,
    deadlineAt: a.deadlineAt,
    remainingSeconds: remainingSecondsOf(a.deadlineAt),
    submittedAt: a.submittedAt,
  };
}

/**
 * Bắt đầu (hoặc nối lại) lần làm bài cho một người dựa trên kết quả đã kiểm tra.
 *
 * Trả về `active_elsewhere` khi người này đang giữ attempt của MỘT BÀI KHÁC —
 * không được thi song song hai đề. Trả về `max_attempts` khi học sinh đã dùng
 * hết lượt và CHƯA có attempt mở (attempt đang mở chưa nộp nên chưa tính lượt).
 *
 * Đây là hàm duy nhất chứa quy tắc trên — `page.tsx` và `POST /api/attempts`
 * đều đi qua đây nên không thể lệch nhau.
 */
export async function startAttempt(opts: {
  exam: { id: string; durationMinutes: number; shuffleQuestions: boolean; shuffleAnswers: boolean; maxAttempts: number };
  studentId: string | null;
  guestParticipantId: string | null;
  activeKey: string;
  questions: QuestionForShuffle[];
}): Promise<{ status: "ok"; attempt: AttemptSnapshot } | { status: "active_elsewhere" } | { status: "max_attempts" }> {
  const existing = await prisma.attempt.findUnique({ where: { activeKey: opts.activeKey }, select: { id: true, examId: true } });
  if (existing && existing.examId !== opts.exam.id) return { status: "active_elsewhere" };

  if (!existing && opts.studentId) {
    const used = await prisma.submission.count({ where: { examId: opts.exam.id, studentId: opts.studentId } });
    if (used >= opts.exam.maxAttempts) return { status: "max_attempts" };
  }

  const attempt = await createOrResumeAttempt({
    examId: opts.exam.id,
    studentId: opts.studentId,
    guestParticipantId: opts.guestParticipantId,
    activeKey: opts.activeKey,
    durationMinutes: opts.exam.durationMinutes,
    shuffleQuestions: opts.exam.shuffleQuestions,
    shuffleAnswers: opts.exam.shuffleAnswers,
    questions: opts.questions,
  });
  return attempt ? { status: "ok", attempt } : { status: "active_elsewhere" };
}

/**
 * Tìm attempt ĐANG MỞ của một người cho một đề, hoặc tạo mới.
 *
 * - Trả về `null` khi người này đang giữ attempt mở cho MỘT BÀI KHÁC
 *   (không được phép thi song song hai đề) — caller tự hiện lỗi.
 * - Đụng khoá UNIQUE do hai request song song → bắt lỗi P2002 rồi đọc lại,
 *   cả hai request cùng nhận attempt của nhau.
 */
export async function createOrResumeAttempt(opts: {
  examId: string;
  studentId: string | null;
  guestParticipantId: string | null;
  activeKey: string;
  durationMinutes: number;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  questions: QuestionForShuffle[];
}): Promise<AttemptSnapshot | null> {
  const { activeKey, examId, durationMinutes, questions } = opts;

  const existing = await prisma.attempt.findUnique({ where: { activeKey } });
  if (existing) return existing.examId === examId ? toSnapshot(existing) : null;

  const seed = Math.floor(Math.random() * 0x7fffffff);
  const questionOrder = opts.shuffleQuestions ? shuffledIndices(questions.length, seed) : questions.map((_, i) => i);

  let optionOrder: Record<string, number[]> | null = null;
  if (opts.shuffleAnswers) {
    optionOrder = {};
    questions.forEach((q, i) => {
      if (q.type === "mcq" && q.options.length > 1) {
        // Seed riêng cho từng câu để các câu không cùng một hoán vị.
        optionOrder![q.id] = shuffledIndices(q.options.length, (seed + (i + 1) * 7919) >>> 0);
      }
    });
  }

  const startedAt = new Date();
  const deadlineAt = new Date(startedAt.getTime() + durationMinutes * 60_000);

  try {
    const created = await prisma.attempt.create({
      data: {
        examId,
        studentId: opts.studentId,
        guestParticipantId: opts.guestParticipantId,
        activeKey,
        seed,
        questionOrder,
        optionOrder,
        startedAt,
        deadlineAt,
      },
    });
    return toSnapshot(created);
  } catch (err) {
    // P2002 = có request khác vừa tạo attempt cho cùng activeKey.
    const code = (err as { code?: string } | null)?.code;
    if (code === "P2002") {
      const again = await prisma.attempt.findUnique({ where: { activeKey } });
      if (again && again.examId === examId) return toSnapshot(again);
    }
    throw err;
  }
}
