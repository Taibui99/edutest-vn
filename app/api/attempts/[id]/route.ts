import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { ATTEMPT_GRACE_SECONDS, remainingSecondsOf } from "@/lib/attempt";

/**
 * GĐ1 — Client chỉ ĐỌC thời gian từ đây, không bao giờ tự tính.
 *
 * Gọi định kỳ (và khi quay lại tab) để:
 *  1. sửa lệch đồng hồ của máy khách,
 *  2. phát hiện server đã chốt bài (nộp ở tab khác / hết giờ) — khi đó client
 *     ngừng đếm và chuyển sang màn kết quả.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = rateLimit(`attempt:${clientIp(request)}`, 120, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Quá nhiều yêu cầu" }, { status: 429 });

  const { id } = await params;
  const session = await auth();

  const attempt = await prisma.attempt.findUnique({
    where: { id },
    include: {
      submission: { select: { id: true, score: true, correctCount: true, totalQuestions: true, durationSeconds: true } },
      guestParticipant: { select: { id: true, tokenHash: true, submittedAt: true } },
    },
  });
  if (!attempt) return NextResponse.json({ error: "Không tìm thấy lần làm bài" }, { status: 404 });

  // Quyền sở hữu: học sinh tự đọc, hoặc khách giữ đúng cookie phiên đã tạo attempt.
  if (session?.user) {
    if (attempt.studentId !== session.user.id) return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  } else {
    if (!attempt.guestParticipantId || !attempt.guestParticipant) return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
    const token = (await cookies()).get(`edutest_guest_${attempt.examId}`)?.value;
    const hash = token ? createHash("sha256").update(token).digest("hex") : null;
    if (!hash || hash !== attempt.guestParticipant.tokenHash) return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const now = new Date();
  const remainingSeconds = remainingSecondsOf(attempt.deadlineAt, now);

  return NextResponse.json({
    id: attempt.id,
    examId: attempt.examId,
    startedAt: attempt.startedAt.toISOString(),
    deadlineAt: attempt.deadlineAt.toISOString(),
    serverNow: now.toISOString(),
    remainingSeconds,
    graceSeconds: ATTEMPT_GRACE_SECONDS,
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    submission: attempt.submission,
  });
}
