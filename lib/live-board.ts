import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

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

export function livePath(token: string): string {
  return `/truc-tiep/${encodeURIComponent(token)}`;
}

/** Đề đang ở "đóng" khi GV tắt mở (status != published) hoặc đã qua closeAt. */
export function phaseOf(exam: { status: string; closeAt: Date | null; openAt: Date | null }, now = new Date()): "waiting" | "live" | "closed" {
  if (exam.status !== "published") return "closed";
  if (exam.closeAt && now > exam.closeAt) return "closed";
  if (exam.openAt && now < exam.openAt) return "waiting";
  return "live";
}

/**
 * Thứ tự xếp hạng: score ↓ → correctCount ↓ → durationSeconds ↑ (nhanh hơn
 * đứng trên) → submittedAt ↑ (nộp sớm hơn đứng trên).
 */
function compareRows(a: LiveRow, b: LiveRow): number {
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
  rows.sort(compareRows);
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
