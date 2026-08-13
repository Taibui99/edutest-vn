import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { normalizeQuestions, validateQuestion } from "./exam-helpers";

function makeJoinCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

async function createUniqueJoinCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const joinCode = makeJoinCode();
    const existing = await prisma.exam.findUnique({ where: { joinCode } });
    if (!existing) return joinCode;
  }
  throw new Error("Không thể tạo mã tham gia");
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  if (session.user.role !== "teacher") return NextResponse.json({ error: "Chỉ giáo viên mới xem danh sách đề" }, { status: 403 });

  const exams = await prisma.exam.findMany({
    where: { teacherId: session.user.id },
    include: { _count: { select: { questions: true, submissions: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ exams });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  if (session.user.role !== "teacher") return NextResponse.json({ error: "Chỉ giáo viên mới được tạo đề" }, { status: 403 });

  const body = await request.json();
  const title = String(body.title || "").trim();
  const subject = String(body.subject || "").trim();
  const description = String(body.description || "").trim() || undefined;
  const durationMinutes = Number(body.durationMinutes || body.duration || 0);
  const shuffleQuestions = Boolean(body.shuffleQuestions);
  const shuffleAnswers = Boolean(body.shuffleAnswers);
  const allowGuestAttempts = body.allowGuestAttempts === undefined ? true : Boolean(body.allowGuestAttempts);
  const maxAttempts = Math.max(1, Number(body.maxAttempts || 1));
  const showAnswers = body.showAnswers === undefined ? true : Boolean(body.showAnswers);
  const status = body.status === "draft" ? "draft" : "published";
  const questions = normalizeQuestions(Array.isArray(body.questions) ? body.questions : []);

  if (!title) return NextResponse.json({ error: "Vui lòng nhập tên đề thi" }, { status: 400 });
  if (!subject) return NextResponse.json({ error: "Vui lòng chọn môn học" }, { status: 400 });
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1) return NextResponse.json({ error: "Thời gian làm bài không hợp lệ" }, { status: 400 });
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) return NextResponse.json({ error: "Số lần làm tối đa không hợp lệ" }, { status: 400 });
  if (questions.length === 0) return NextResponse.json({ error: "Đề thi cần có ít nhất 1 câu hỏi" }, { status: 400 });

  const invalid = questions.map(validateQuestion).find(Boolean);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const joinCode = await createUniqueJoinCode();
  const exam = await prisma.exam.create({
    data: {
      title,
      subject,
      description,
      durationMinutes,
      joinCode,
      shuffleQuestions,
      shuffleAnswers,
      allowGuestAttempts,
      maxAttempts,
      showAnswers,
      status,
      teacherId: session.user.id,
      questions: { create: questions },
    },
    include: { _count: { select: { questions: true, submissions: true } } },
  });

  return NextResponse.json({ exam }, { status: 201 });
}
