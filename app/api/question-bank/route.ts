import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizeQuestions, validateQuestion } from "../exams/exam-helpers";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const subject = searchParams.get("subject") || undefined;
  const search = searchParams.get("q") || undefined;

  const items = await prisma.questionBankItem.findMany({
    where: {
      teacherId: session.user.id!,
      ...(subject ? { subject } : {}),
      ...(search ? { text: { contains: search, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    subject?: unknown;
    explanation?: unknown;
    questions?: unknown;
  };
  const subject = String(body.subject || "").trim();
  const explanation = body.explanation ? String(body.explanation).trim() || undefined : undefined;
  const normalized = normalizeQuestions(Array.isArray(body.questions) ? body.questions : []);

  if (!subject) return NextResponse.json({ error: "Vui lòng chọn môn học" }, { status: 400 });
  if (normalized.length === 0) return NextResponse.json({ error: "Cần có ít nhất một câu hỏi" }, { status: 400 });
  const invalid = normalized.map(validateQuestion).find(Boolean);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const items = await prisma.$transaction(
    normalized.map((q) => prisma.questionBankItem.create({
      data: {
        teacherId: session.user.id!,
        subject,
        type: q.type,
        text: q.text,
        options: q.options,
        answer: q.answer,
        grading: q.grading,
        explanation,
        points: q.points,
      },
    })),
  );

  return NextResponse.json({ items }, { status: 201 });
}