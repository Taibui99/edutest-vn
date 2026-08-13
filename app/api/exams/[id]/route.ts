import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { normalizeQuestions, validateQuestion } from "../exam-helpers";

async function getOwnedExam(examId: string, teacherId: string) {
  return prisma.exam.findFirst({
    where: { id: examId, teacherId },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  }

  if (session.user.role !== "teacher") {
    return NextResponse.json({ error: "Chỉ giáo viên mới được thao tác" }, { status: 403 });
  }

  const { id } = await params;
  const exam = await prisma.exam.findFirst({
    where: { id, teacherId: session.user.id },
    include: { questions: { orderBy: { order: "asc" } } },
  });

  if (!exam) {
    return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
  }

  return NextResponse.json({ exam });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  }

  if (session.user.role !== "teacher") {
    return NextResponse.json({ error: "Chỉ giáo viên mới được thao tác" }, { status: 403 });
  }

  const { id } = await params;
  const exam = await getOwnedExam(id, session.user.id);

  if (!exam) {
    return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
  }

  const body = await request.json();
  const title = String(body.title || "").trim();
  const subject = String(body.subject || "").trim();
  const description = String(body.description || "").trim() || undefined;
  const durationMinutes = Number(body.durationMinutes || body.duration || 0);
  const shuffleQuestions = Boolean(body.shuffleQuestions);
  const shuffleAnswers = Boolean(body.shuffleAnswers);
  const allowGuestAttempts = body.allowGuestAttempts === undefined ? exam.allowGuestAttempts : Boolean(body.allowGuestAttempts);
  const maxAttempts = Math.max(1, Number(body.maxAttempts || 1));
  const showAnswers = body.showAnswers === undefined ? exam.showAnswers : Boolean(body.showAnswers);
  const status = body.status === "draft" ? "draft" : "published";
  const questions = normalizeQuestions(Array.isArray(body.questions) ? body.questions : []);

  if (!title) return NextResponse.json({ error: "Vui lòng nhập tên đề thi" }, { status: 400 });
  if (!subject) return NextResponse.json({ error: "Vui lòng chọn môn học" }, { status: 400 });
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1) return NextResponse.json({ error: "Thời gian làm bài không hợp lệ" }, { status: 400 });
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) return NextResponse.json({ error: "Số lần làm tối đa không hợp lệ" }, { status: 400 });
  if (questions.length === 0) return NextResponse.json({ error: "Đề thi cần có ít nhất 1 câu hỏi" }, { status: 400 });

  const invalid = questions.map(validateQuestion).find(Boolean);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const updated = await prisma.$transaction(async (tx) => {
    await tx.question.deleteMany({ where: { examId: id } });
    return tx.exam.update({
      where: { id },
      data: {
        title,
        subject,
        description,
        durationMinutes,
        shuffleQuestions,
        shuffleAnswers,
        allowGuestAttempts,
        maxAttempts,
        showAnswers,
        status,
        questions: { create: questions },
      },
      include: { _count: { select: { questions: true, submissions: true } } },
    });
  });

  return NextResponse.json({ exam: updated });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  }

  if (session.user.role !== "teacher") {
    return NextResponse.json({ error: "Chỉ giáo viên mới được thao tác" }, { status: 403 });
  }

  const { id } = await params;
  const exam = await getOwnedExam(id, session.user.id);

  if (!exam) {
    return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
  }

  const body = await request.json();
  const status = String(body.status || "");

  if (!["published", "draft"].includes(status)) {
    return NextResponse.json({ error: "Trạng thái không hợp lệ" }, { status: 400 });
  }

  const updated = await prisma.exam.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json({ exam: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  }

  if (session.user.role !== "teacher") {
    return NextResponse.json({ error: "Chỉ giáo viên mới được thao tác" }, { status: 403 });
  }

  const { id } = await params;
  const exam = await getOwnedExam(id, session.user.id);

  if (!exam) {
    return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
  }

  await prisma.exam.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
