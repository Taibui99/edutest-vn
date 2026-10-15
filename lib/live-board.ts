import { randomBytes } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminAccess, isTeacherAccess } from "@/lib/access";
import { earnedPointsOf, isAutoGraded, pointsOf, type AnswerValue } from "@/lib/grading";

export { livePath, liveSubmissionPath } from "@/lib/live-paths";

/* LIVE-1 — bảng điểm trực tiếp dùng chung cho API poll + trang server render.
 * nguồn sự thật vẫn là Submission (điểm đã chấm lưu khi nộp), chỉ ĐỌC. */

export interface LiveRow {
  rank: number;
  id: string;
  name: string;
  className: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  durationSeconds: number;
  submittedAt: string;
  isGuest: boolean;
}

export interface LiveBoard {
  found: boolean;
  exam: {
    id: string;
    title: string;
    subject: string;
    joinCode: string;
    durationMinutes: number;
    questionCount: number;
    totalPoints: number;
  } | null;
  phase: "waiting" | "live" | "closed";
  submittedCount: number;
  startedCount: number;
  activeCount: number;
  rows: LiveRow[];
  stats: { avg: number | null; highest: number | null; passCount: number; total: number };
  serverTime: string;
}

export const LIVE_ROW_LIMIT = 100;

/** Token bí mật cho link bảng điểm — 32 hex (128 bit) không đoán được. */
export function createLiveToken(): string {
  return randomBytes(16).toString("hex");
}

/** Đề đang ở "đóng" khi GV tắt mở (status != published) hoặc đã qua closeAt. */
export function phaseOf(exam: { status: string; closeAt: Date | null; openAt: Date | null }, now = new Date()): "waiting" | "live" | "closed" {
  if (exam.status !== "published") return "closed";
  if (exam.closeAt && now > exam.closeAt) return "closed";
  if (exam.openAt && now < exam.openAt) return "waiting";
  return "live";
}

/* Thứ tự xếp hạng: score ↓ → correctCount ↓ → durationSeconds ↑ (nhanh hơn
 * đứng trên) → submittedAt ↑ (nộp sớm hơn đứng trên).
 * Dùng chung cho bảng điểm (LiveRow, submittedAt là chuỗi ISO) và bài chi
 * tiết (Date từ Prisma) — mỗi lần sort chỉ trộn 1 kiểu nên so sánh an toàn. */
type Rankable = { score: number; correctCount: number; durationSeconds: number; submittedAt: Date | string };

function compareRankable(a: Rankable, b: Rankable): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
  if (a.durationSeconds !== b.durationSeconds) return a.durationSeconds - b.durationSeconds;
  return a.submittedAt < b.submittedAt ? -1 : a.submittedAt > b.submittedAt ? 1 : 0;
}

export async function getLiveBoardByToken(token: string): Promise<LiveBoard> {
  const empty: LiveBoard = {
    found: false,
    exam: null,
    phase: "closed",
    submittedCount: 0,
    startedCount: 0,
    activeCount: 0,
    rows: [],
    stats: { avg: null, highest: null, passCount: 0, total: 0 },
    serverTime: new Date().toISOString(),
  };

  if (!token) return empty;
  const exam = await prisma.exam.findFirst({
    where: { liveToken: token, deletedAt: null, hidden: false },
    select: {
      id: true,
      title: true,
      subject: true,
      joinCode: true,
      durationMinutes: true,
      status: true,
      openAt: true,
      closeAt: true,
      questions: { select: { points: true } },
      _count: { select: { attempts: true } },
      submissions: {
        orderBy: { submittedAt: "asc" },
        select: {
          id: true,
          score: true,
          correctCount: true,
          totalQuestions: true,
          durationSeconds: true,
          submittedAt: true,
          studentId: true,
          student: { select: { name: true, grade: true } },
          guestParticipant: { select: { name: true, className: true } },
        },
      },
    },
  });

  if (!exam) return empty;

  const now = new Date();
  const subs = exam.submissions;
  const rows: LiveRow[] = subs.map((s) => ({
    rank: 0,
    id: s.id,
    name: s.student?.name || s.guestParticipant?.name || "Khách",
    className: s.guestParticipant?.className || s.student?.grade || "",
    score: s.score,
    correctCount: s.correctCount,
    totalQuestions: s.totalQuestions,
    durationSeconds: s.durationSeconds,
    submittedAt: s.submittedAt.toISOString(),
    isGuest: !s.studentId,
  }));
  rows.sort(compareRankable);
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });

  const scores = subs.map((s) => s.score);
  const submittedCount = subs.length;
  const startedCount = Math.max(exam._count.attempts, submittedCount);

  return {
    found: true,
    exam: {
      id: exam.id,
      title: exam.title,
      subject: exam.subject,
      joinCode: exam.joinCode,
      durationMinutes: exam.durationMinutes,
      questionCount: exam.questions.length,
      totalPoints: Number(exam.questions.reduce((sum, q) => sum + (typeof q.points === "number" ? q.points : 0), 0).toFixed(2)),
    },
    phase: phaseOf(exam, now),
    submittedCount,
    startedCount,
    activeCount: Math.max(0, startedCount - submittedCount),
    rows: rows.slice(0, LIVE_ROW_LIMIT),
    stats: {
      avg: scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : null,
      highest: scores.length ? Math.max(...scores) : null,
      passCount: scores.filter((s) => s >= 5).length,
      total: submittedCount,
    },
    serverTime: now.toISOString(),
  };
}

/* ─────────────── LIVE-1b — màn hình chi tiết 1 bài làm ───────────────────
 * Bấm tên học sinh trên bảng điểm → màn riêng xem TOÀN BỘ bài làm, chữ to
 * để giáo viên chữa đề miệng. CHỈ ĐỌC — không sửa điểm ở trang này.
 *
 * Quy tắc lộ đáp án chuẩn: giáo viên CỦA đề (hoặc admin) luôn thấy; người
 * cầm link (kể cả tivi chưa đăng nhập) chỉ thấy khi đề ĐÃ ĐÓNG — tránh lộ
 * đáp án cho lớp trong lúc đề vẫn đang mở. */

export interface LiveQuestionView {
  id: string;
  order: number;
  type: string;
  text: string;
  options: string[];
  points: number;
  /** Điểm câu này đã đạt (0 → points; tự luận = điểm GV chấm tay). */
  earned: number;
  answered: boolean;
  status: "correct" | "partial" | "wrong" | "blank" | "pending";
  /** Bài làm của học sinh (MCQ dạng chữ cái A/B/C/D). */
  studentAnswer: AnswerValue | null;
  image: string | null;
  /** Điểm GV chấm tay câu tự luận (null = chưa chấm). */
  manualScore: number | null;
  /**
   * Đáp án chuẩn. Phần BÍ MẬT (`answer`, `acceptedAnswers`, `explanation`,
   * `answer` từng mệnh đề Đúng/Sai) chỉ điền khi `showAnswerKey`. Câu Đúng/Sai
   * luôn có danh sách mệnh đề (text là nội dung câu hỏi, không bí mật).
   */
  key: {
    answer?: string;
    statements?: { text: string; points?: number; answer?: boolean }[];
    acceptedAnswers?: string[];
    explanation?: string;
  } | null;
}

export interface LiveSubmissionDetail {
  found: boolean;
  phase: "waiting" | "live" | "closed";
  /** Người xem này được thấy đáp án chuẩn không (GV/admin hoặc đề đã đóng). */
  showAnswerKey: boolean;
  exam: {
    id: string;
    title: string;
    subject: string;
    joinCode: string;
    durationMinutes: number;
    questionCount: number;
    totalPoints: number;
  } | null;
  submission: {
    id: string;
    name: string;
    className: string;
    isGuest: boolean;
    rank: number;
    submittedTotal: number;
    score: number;
    correctCount: number;
    totalQuestions: number;
    durationSeconds: number;
    submittedAt: string;
    autoSubmitted: boolean;
    violationCount: number;
    riskScore: number;
    riskLevel: string;
    answers: Record<string, AnswerValue>;
  } | null;
  questions: LiveQuestionView[];
  serverTime: string;
}

/** Người xem màn chi tiết có phải giáo viên CỦA đề này (hoặc admin) không? */
async function viewerIsStaff(teacherId: string): Promise<boolean> {
  try {
    const session = await auth();
    const user = session?.user;
    if (!user) return false;
    if (isAdminAccess(user)) return true;
    if (!isTeacherAccess(user)) return false;
    return Boolean(user.id) && user.id === teacherId;
  } catch {
    return false;
  }
}

export async function getLiveSubmissionByToken(token: string, submissionId: string): Promise<LiveSubmissionDetail> {
  const empty: LiveSubmissionDetail = {
    found: false,
    phase: "closed",
    showAnswerKey: false,
    exam: null,
    submission: null,
    questions: [],
    serverTime: new Date().toISOString(),
  };
  if (!token || !submissionId) return empty;

  const exam = await prisma.exam.findFirst({
    where: { liveToken: token, deletedAt: null, hidden: false },
    select: {
      id: true,
      title: true,
      subject: true,
      joinCode: true,
      durationMinutes: true,
      status: true,
      openAt: true,
      closeAt: true,
      teacherId: true,
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true, order: true, type: true, text: true,
          options: true, answer: true, points: true, grading: true, explanation: true,
        },
      },
      submissions: { select: { id: true, score: true, correctCount: true, durationSeconds: true, submittedAt: true } },
    },
  });
  if (!exam) return empty;

  const phase = phaseOf(exam);
  const showAnswerKey = (await viewerIsStaff(exam.teacherId)) || phase === "closed";

  const sub = await prisma.submission.findFirst({
    where: { id: submissionId, examId: exam.id },
    select: {
      id: true,
      score: true,
      correctCount: true,
      totalQuestions: true,
      durationSeconds: true,
      submittedAt: true,
      answers: true,
      manualScores: true,
      autoSubmitted: true,
      violationCount: true,
      riskScore: true,
      riskLevel: true,
      studentId: true,
      student: { select: { name: true, grade: true } },
      guestParticipant: { select: { name: true, className: true } },
    },
  });
  if (!sub) return empty;

  // Hạng của bài này trong toàn bộ bài nộp (cùng luật xếp với bảng điểm).
  const ordered = [...exam.submissions].sort(compareRankable);
  const rank = ordered.findIndex((s) => s.id === sub.id) + 1;

  const answers = (sub.answers ?? {}) as Record<string, AnswerValue>;
  const manual = (sub.manualScores && typeof sub.manualScores === "object" && !Array.isArray(sub.manualScores)
    ? sub.manualScores
    : {}) as Record<string, unknown>;

  const questions: LiveQuestionView[] = exam.questions.map((q) => {
    const pts = pointsOf(q);
    const studentAnswer = answers[q.id] ?? null;
    const answered = studentAnswer !== null
      && studentAnswer !== undefined
      && !(typeof studentAnswer === "string" && studentAnswer.trim() === "");
    const g = (q.grading ?? {}) as {
      statements?: { text: string; answer: boolean; points?: number }[];
      acceptedAnswers?: string[];
      image?: string;
    };
    const image = typeof g.image === "string" && g.image ? g.image : null;

    let earned = 0;
    let manualScore: number | null = null;
    let status: LiveQuestionView["status"] = "blank";

    if (!isAutoGraded(q)) {
      const raw = manual[q.id];
      manualScore = typeof raw === "number" && Number.isFinite(raw) ? Math.min(pts, Math.max(0, raw)) : null;
      earned = manualScore ?? 0;
      if (answered) status = manualScore === null ? "pending" : "correct";
    } else if (answered) {
      earned = earnedPointsOf(q, studentAnswer ?? undefined);
      status = "correct";
    }
    if (answered && status !== "pending") {
      status = earned >= pts - 1e-9 ? "correct" : earned > 0 ? "partial" : "wrong";
    }

    const key: NonNullable<LiveQuestionView["key"]> = {};
    if (q.type === "mcq" && showAnswerKey) key.answer = q.answer || "";
    if (q.type === "true_false") {
      key.statements = (g.statements ?? []).map((s) => ({
        text: s.text,
        points: s.points,
        answer: showAnswerKey ? Boolean(s.answer) : undefined,
      }));
    }
    if (q.type === "short_answer" && showAnswerKey) key.acceptedAnswers = g.acceptedAnswers ?? [];
    if (showAnswerKey && q.explanation) key.explanation = q.explanation;
    const hasKey = key.answer !== undefined
      || Boolean(key.statements?.length)
      || Boolean(key.acceptedAnswers?.length)
      || Boolean(key.explanation);

    return {
      id: q.id,
      order: q.order,
      type: q.type,
      text: q.text,
      options: Array.isArray(q.options) ? q.options : [],
      points: pts,
      earned: Number(earned.toFixed(2)),
      answered,
      status,
      studentAnswer,
      image,
      manualScore,
      key: hasKey ? key : null,
    };
  });

  const totalPoints = Number(questions.reduce((sum, q) => sum + q.points, 0).toFixed(2));

  return {
    found: true,
    phase,
    showAnswerKey,
    exam: {
      id: exam.id,
      title: exam.title,
      subject: exam.subject,
      joinCode: exam.joinCode,
      durationMinutes: exam.durationMinutes,
      questionCount: questions.length,
      totalPoints,
    },
    submission: {
      id: sub.id,
      name: sub.student?.name || sub.guestParticipant?.name || "Khách",
      className: sub.guestParticipant?.className || sub.student?.grade || "",
      isGuest: !sub.studentId,
      rank,
      submittedTotal: ordered.length,
      score: sub.score,
      correctCount: sub.correctCount,
      totalQuestions: sub.totalQuestions,
      durationSeconds: sub.durationSeconds,
      submittedAt: sub.submittedAt.toISOString(),
      autoSubmitted: sub.autoSubmitted,
      violationCount: sub.violationCount,
      riskScore: sub.riskScore,
      riskLevel: sub.riskLevel,
      answers,
    },
    questions,
    serverTime: new Date().toISOString(),
  };
}
