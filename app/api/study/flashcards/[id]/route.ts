import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const card = await prisma.flashcard.findFirst({ where: { id, studentId: session.user.id } });
  if (!card) return NextResponse.json({ error: "Không tìm thấy thẻ" }, { status: 404 });

  const body = await request.json();
  const subject = String(body.subject || "").trim();
  const deck = String(body.deck || "Mặc định").trim() || "Mặc định";
  const front = String(body.front || "").trim();
  const back = String(body.back || "").trim();

  if (!subject || !front || !back) {
    return NextResponse.json({ error: "Thiếu thông tin thẻ (môn học / mặt trước / mặt sau)" }, { status: 400 });
  }

  const updated = await prisma.flashcard.update({
    where: { id },
    data: { subject, deck, front, back },
  });

  return NextResponse.json({ card: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const card = await prisma.flashcard.findFirst({ where: { id, studentId: session.user.id } });
  if (!card) return NextResponse.json({ error: "Không tìm thấy thẻ" }, { status: 404 });

  await prisma.flashcard.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
