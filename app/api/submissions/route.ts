import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type AnswerMap = Record<string, string>;

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Bạn cần đăng nhập để nộp bài" }, { status: 401 });
  }

  if (session.user.role !== "student") {
    return NextResponse.json({ error: "Chỉ học sinh mới nộp bài thi" }, { status: 403 });
  }

  const body = await request.json();
  const examId = String(body.examId || "");
  const answers = (body.answers || {}) as AnswerMap;
  const durationSeconds = Math.max(0, Number(body.durationSeconds || 0));

  if (!examId) {
    return NextResponse.json({ error: "Thiếu mã đề thi" }, { status: 400 });
  }

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      questions: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!exam || exam.status !== "published") {
    return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
  }

  const existingSubmission = await prisma.submission.findUnique({
    where: {
      examId_studentId: {
        examId,
        studentId: session.user.id,
      },
    },
  });

  if (existingSubmission) {
    return NextResponse.json(
      { error: "Bạn đã nộp bài này rồi", submission: existingSubmission },
      { status: 409 },
    );
  }

  const correctCount = exam.questions.reduce((count, question) => {
    const selected = answers[question.id]?.toUpperCase();
    return selected === question.answer.toUpperCase() ? count + 1 : count;
  }, 0);
  const totalQuestions = exam.questions.length;
  const score = totalQuestions > 0 ? Number(((correctCount / totalQuestions) * 10).toFixed(2)) : 0;

  const submission = await prisma.submission.create({
    data: {
      examId,
      studentId: session.user.id,
      answers,
      correctCount,
      totalQuestions,
      score,
      durationSeconds,
    },
  });

  return NextResponse.json({ submission });
}
