import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type IncomingQuestion = {
  question?: string;
  text?: string;
  options?: string[];
  answer?: string;
};

function makeJoinCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

async function createUniqueJoinCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const joinCode = makeJoinCode();
    const existing = await prisma.exam.findUnique({ where: { joinCode } });

    if (!existing) {
      return joinCode;
    }
  }

  throw new Error("Không thể tạo mã tham gia");
}

function normalizeQuestions(questions: IncomingQuestion[]) {
  return questions.map((item, index) => {
    const text = (item.question || item.text || "").trim();
    const options = Array.isArray(item.options)
      ? item.options.map((option) => option.trim()).filter(Boolean)
      : [];
    const answer = (item.answer || "").trim().charAt(0).toUpperCase();

    return {
      text,
      options,
      answer,
      order: index + 1,
    };
  });
}

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  }

  if (session.user.role !== "teacher") {
    return NextResponse.json({ error: "Chỉ giáo viên mới xem danh sách đề" }, { status: 403 });
  }

  const exams = await prisma.exam.findMany({
    where: { teacherId: session.user.id },
    include: {
      _count: {
        select: {
          questions: true,
          submissions: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ exams });
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  }

  if (session.user.role !== "teacher") {
    return NextResponse.json({ error: "Chỉ giáo viên mới được tạo đề" }, { status: 403 });
  }

  const body = await request.json();
  const title = String(body.title || "").trim();
  const subject = String(body.subject || "").trim();
  const durationMinutes = Number(body.durationMinutes || body.duration || 0);
  const questions = normalizeQuestions(Array.isArray(body.questions) ? body.questions : []);

  if (!title) {
    return NextResponse.json({ error: "Vui lòng nhập tên đề thi" }, { status: 400 });
  }

  if (!subject) {
    return NextResponse.json({ error: "Vui lòng chọn môn học" }, { status: 400 });
  }

  if (!Number.isInteger(durationMinutes) || durationMinutes < 1) {
    return NextResponse.json({ error: "Thời gian làm bài không hợp lệ" }, { status: 400 });
  }

  if (questions.length === 0) {
    return NextResponse.json({ error: "Đề thi cần có ít nhất 1 câu hỏi" }, { status: 400 });
  }

  const invalidQuestion = questions.find(
    (question) =>
      !question.text ||
      question.options.length < 2 ||
      !["A", "B", "C", "D"].includes(question.answer),
  );

  if (invalidQuestion) {
    return NextResponse.json(
      { error: "Mỗi câu hỏi cần có nội dung, ít nhất 2 đáp án và đáp án đúng A-D" },
      { status: 400 },
    );
  }

  const joinCode = await createUniqueJoinCode();
  const exam = await prisma.exam.create({
    data: {
      title,
      subject,
      durationMinutes,
      joinCode,
      teacherId: session.user.id,
      questions: {
        create: questions,
      },
    },
    include: {
      _count: {
        select: {
          questions: true,
          submissions: true,
        },
      },
    },
  });

  return NextResponse.json({ exam }, { status: 201 });
}
