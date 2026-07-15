import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

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
