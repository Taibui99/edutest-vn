import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { scoreSubmission, type AnswerValue } from "@/lib/grading";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      exam: {
        include: {
          questions: { orderBy: { order: "asc" } },
          teacher: { select: { name: true } },
        },
      },
      student: { select: { id: true, name: true } },
    },
  });

  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only student who submitted or teacher who owns can view
  const userId = session.user.id!;
  const isOwner = submission.studentId === userId;
  const isTeacher = submission.exam.teacherId === userId;
  if (!isOwner && !isTeacher) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // EXAM-2: cho học sinh thấy mình còn mấy lượt (khỏi đoán mò vì sao không thi
  // lại được: hết lượt / còn lượt).
  let attemptsUsed: number | null = null;
  if (isOwner && !isTeacher && submission.studentId) {
    attemptsUsed = await prisma.submission.count({
      where: { examId: submission.examId, studentId: submission.studentId },
    });
  }

  return NextResponse.json({ ...submission, attemptsUsed });
}

/* GRADE-1 — giáo viên chấm điểm từng câu tự luận rồi lưu.
 * Chỉ chủ đề (teacherId) được chấm; body: { manualScores: { questionId: điểm } }.
 * Điểm kẹp trong [0, points của câu]; chấm xong tính lại điểm bằng đúng hàm
 * chấm của đường nộp bài nên hai bên không bao giờ lệch. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: { exam: { include: { questions: true } } },
  });
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (submission.exam.teacherId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { manualScores?: unknown };
  const incoming = (body.manualScores && typeof body.manualScores === "object" ? body.manualScores : {}) as Record<string, unknown>;
  const prev = (submission.manualScores && typeof submission.manualScores === "object" ? submission.manualScores : {}) as Record<string, unknown>;
  const merged: Record<string, number> = {};
  for (const [k, v] of Object.entries(prev)) {
    if (typeof v === "number" && Number.isFinite(v)) merged[k] = v;
  }

  const byId = new Map(submission.exam.questions.map((q) => [q.id, q]));
  for (const [qid, v] of Object.entries(incoming)) {
    const q = byId.get(qid);
    if (!q || q.type !== "essay" || typeof v !== "number" || !Number.isFinite(v)) continue;
    const pts = typeof q.points === "number" && q.points > 0 ? q.points : 1;
    merged[qid] = Math.min(pts, Math.max(0, Math.round(v * 100) / 100));
  }

  const answers = (submission.answers ?? {}) as Record<string, AnswerValue>;
  const { score } = scoreSubmission(
    submission.exam.questions.map((q) => ({ id: q.id, type: q.type, points: q.points, answer: q.answer, grading: q.grading })),
    answers,
    merged,
  );

  const updated = await prisma.submission.update({
    where: { id },
    data: { manualScores: merged, score },
  });
  return NextResponse.json({ submission: updated });
}
