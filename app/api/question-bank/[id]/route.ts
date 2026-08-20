import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isTeacherAccess } from "@/lib/access";
import { normalizeQuestions, validateQuestion } from "../../exams/exam-helpers";

async function getOwnedItem(itemId: string, teacherId: string) {
  return prisma.questionBankItem.findFirst({ where: { id: itemId, teacherId } });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || !isTeacherAccess(session.user))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await getOwnedItem(id, session.user.id!);
  if (!existing) return NextResponse.json({ error: "Không tìm thấy câu hỏi" }, { status: 404 });

  const body = await request.json() as {
    subject?: unknown;
    explanation?: unknown;
    questions?: unknown;
  };
  const subject = String(body.subject ?? existing.subject).trim() || existing.subject;
  const explanation = body.explanation !== undefined
    ? (String(body.explanation).trim() || undefined)
    : existing.explanation;

  let type = existing.type;
  let text = existing.text;
  let options = existing.options;
  let answer = existing.answer;
  let grading: Prisma.InputJsonValue | null | undefined = existing.grading as Prisma.InputJsonValue | null;
  let points = existing.points;

  if (body.questions !== undefined) {
    const normalized = normalizeQuestions(Array.isArray(body.questions) ? body.questions : []);
    const invalid = normalized.map(validateQuestion).find(Boolean);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    if (normalized.length !== 1) return NextResponse.json({ error: "Chỉ cập nhật một câu hỏi mỗi lần" }, { status: 400 });
    const q = normalized[0];
    type = q.type;
    text = q.text;
    options = q.options;
    answer = q.answer;
    grading = q.grading;
    points = q.points;
  }

  const item = await prisma.questionBankItem.update({
    where: { id },
    data: { subject, explanation, type, text, options, answer, grading, points },
  });

  return NextResponse.json({ item });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || !isTeacherAccess(session.user))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await getOwnedItem(id, session.user.id!);
  if (!existing) return NextResponse.json({ error: "Không tìm thấy câu hỏi" }, { status: 404 });

  await prisma.questionBankItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}