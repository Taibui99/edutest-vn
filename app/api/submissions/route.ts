import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type AnswerMap = Record<string, string>;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const body = await request.json() as { examId?: unknown; answers?: unknown; durationSeconds?: unknown };
  const examId = typeof body.examId === "string" ? body.examId : "";
  const answers = (body.answers && typeof body.answers === "object" ? body.answers : {}) as AnswerMap;
  const durationSeconds = Math.max(0, Number(body.durationSeconds || 0));

  if (!examId) {
    return NextResponse.json({ error: "Thiếu mã đề thi" }, { status: 400 });
  }

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { questions: { orderBy: { order: "asc" } } },
  });

  if (!exam || exam.status !== "published") {
    return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
  }

  let studentId: string | null = null;
  let guestParticipantId: string | null = null;
  let participantName = "Học sinh";

  if (session?.user) {
    if (session.user.role !== "student") {
      return NextResponse.json({ error: "Chỉ học sinh mới nộp bài thi" }, { status: 403 });
    }
    studentId = session.user.id;
    participantName = session.user.name || "Học sinh";

    const existingSubmission = await prisma.submission.findUnique({
      where: { examId_studentId: { examId, studentId: session.user.id } },
    });
    if (existingSubmission) {
      return NextResponse.json({ error: "Bạn đã nộp bài này rồi", submission: existingSubmission }, { status: 409 });
    }
  } else {
    if (!exam.allowGuestAttempts) {
      return NextResponse.json({ error: "Đề thi này yêu cầu đăng nhập tài khoản EduTest" }, { status: 401 });
    }
    const cookieStore = await cookies();
    const token = cookieStore.get(`edutest_guest_${exam.id}`)?.value;
    if (!token) {
      return NextResponse.json({ error: "Phiên khách không hợp lệ hoặc đã hết hạn" }, { status: 401 });
    }

    const guest = await prisma.guestParticipant.findFirst({
      where: { examId, tokenHash: hashToken(token) },
      select: { id: true, name: true, submittedAt: true },
    });
    if (!guest) {
      return NextResponse.json({ error: "Phiên khách không hợp lệ hoặc đã hết hạn" }, { status: 401 });
    }
    if (guest.submittedAt) {
      return NextResponse.json({ error: "Bạn đã nộp bài này rồi" }, { status: 409 });
    }

    guestParticipantId = guest.id;
    participantName = guest.name;
  }

  const correctCount = exam.questions.reduce((count, question) => {
    const selected = answers[question.id]?.toUpperCase();
    return selected === question.answer.toUpperCase() ? count + 1 : count;
  }, 0);
  const totalQuestions = exam.questions.length;
  const score = totalQuestions > 0 ? Number(((correctCount / totalQuestions) * 10).toFixed(2)) : 0;

  const submission = await prisma.$transaction(async (tx) => {
    const created = await tx.submission.create({
      data: {
        examId,
        studentId,
        guestParticipantId,
        answers,
        correctCount,
        totalQuestions,
        score,
        durationSeconds,
      },
    });

    if (guestParticipantId) {
      await tx.guestParticipant.update({
        where: { id: guestParticipantId },
        data: { submittedAt: new Date() },
      });
    }

    return created;
  });

  try {
    await prisma.notification.create({
      data: {
        userId: exam.teacherId,
        type: "exam_result",
        title: "Có người vừa nộp bài",
        message: `${participantName} vừa nộp bài "${exam.title}" — Điểm: ${score}/10`,
        link: `/bang-dieu-khien/de-thi/${exam.id}`,
      },
    });
  } catch {
    // Notification failure must not fail a valid submission.
  }

  return NextResponse.json({
    submission,
    isGuest: Boolean(guestParticipantId),
    resultLink: guestParticipantId ? null : `/bang-dieu-khien/ket-qua/${submission.id}`,
  });
}
