import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isTeacherAccess } from "@/lib/access";
import { scoreSubmission, type AnswerValue } from "@/lib/grading";

/* SCORE-1 — chấm lại toàn bộ bài nộp của một đề bằng công thức điểm hiện tại.
 * Dùng khi đổi công thức tính điểm hoặc sửa điểm các câu: các bài đã nộp
 * trước đó được tính lại từ `answers` + `manualScores` sẵn có. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  if (!isTeacherAccess(session.user)) return NextResponse.json({ error: "Chỉ giáo viên mới chấm lại được" }, { status: 403 });

  const { id } = await params;
  const exam = await prisma.exam.findFirst({
    where: { id, teacherId: session.user.id! },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });

  const submissions = await prisma.submission.findMany({
    where: { examId: id },
    select: { id: true, answers: true, manualScores: true },
  });

  const questions = exam.questions.map((q) => ({
    id: q.id,
    type: q.type,
    points: q.points,
    answer: q.answer,
    grading: q.grading,
  }));

  const updates = submissions.map((s) => {
    const answers = (s.answers ?? {}) as Record<string, AnswerValue>;
    const prev = (s.manualScores && typeof s.manualScores === "object" ? s.manualScores : {}) as Record<string, unknown>;
    const manual: Record<string, number> = {};
    for (const [k, v] of Object.entries(prev)) {
      if (typeof v === "number" && Number.isFinite(v)) manual[k] = v;
    }
    const { score, correctCount } = scoreSubmission(questions, answers, manual);
    return prisma.submission.update({ where: { id: s.id }, data: { score, correctCount } });
  });

  if (updates.length) await prisma.$transaction(updates);
  return NextResponse.json({ regraded: updates.length });
}
