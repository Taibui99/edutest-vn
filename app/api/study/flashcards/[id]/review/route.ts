import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateNextReview } from "@/lib/spaced-repetition";
import { bumpStudyStreak } from "@/lib/streak";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const card = await prisma.flashcard.findFirst({ where: { id, studentId: session.user.id } });
  if (!card) return NextResponse.json({ error: "Không tìm thấy thẻ" }, { status: 404 });

  const body = await request.json();
  const quality = Number(body.quality);
  if (![1, 3, 5].includes(quality)) {
    return NextResponse.json({ error: "Giá trị đánh giá không hợp lệ" }, { status: 400 });
  }

  const next = calculateNextReview(
    {
      easinessFactor: card.easinessFactor,
      intervalDays: card.intervalDays,
      repetitions: card.repetitions,
    },
    quality,
  );

  const updated = await prisma.flashcard.update({
    where: { id },
    data: {
      easinessFactor: next.easinessFactor,
      intervalDays: next.intervalDays,
      repetitions: next.repetitions,
      nextReviewAt: next.nextReviewAt,
    },
  });

  try { await bumpStudyStreak(session.user.id!); } catch { /* ignore */ }

  return NextResponse.json({ card: updated });
}
