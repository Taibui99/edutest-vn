import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
