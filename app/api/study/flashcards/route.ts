import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const [allCards, dueCards] = await Promise.all([
    prisma.flashcard.findMany({
      where: { studentId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.flashcard.findMany({
      where: { studentId: session.user.id, nextReviewAt: { lte: new Date() } },
      orderBy: { nextReviewAt: "asc" },
    }),
  ]);

  return NextResponse.json({ allCards, dueCards });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const body = await request.json();
  const subject = String(body.subject || "").trim();
  const deck = String(body.deck || "Mặc định").trim() || "Mặc định";
  const front = String(body.front || "").trim();
  const back = String(body.back || "").trim();

  if (!subject || !front || !back) {
    return NextResponse.json({ error: "Thiếu thông tin thẻ (môn học / mặt trước / mặt sau)" }, { status: 400 });
  }

  const card = await prisma.flashcard.create({
    data: { studentId: session.user.id, subject, deck, front, back },
  });

  return NextResponse.json({ card });
}
