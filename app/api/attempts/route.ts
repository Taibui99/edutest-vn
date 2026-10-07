import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { startAttempt, studentActiveKey, guestActiveKey, remainingSecondsOf, ATTEMPT_GRACE_SECONDS } from "@/lib/attempt";

/**
 * GĐ1 — Bắt đầu (hoặc nối lại) một lần làm bài.
 *
 * Trang `/thi/[code]` gọi thẳng `startAttempt` trong Server Component, endpoint
 * này là bản sao cùng logic dành cho client thuần API và cho test E2E (trước
 * khi gọi `POST /api/submissions` thì PHẢI có `attemptId`).
 *
 * Luôn trả về attempt đang mở nếu có — gọi bao nhiêu lần cũng không tạo thêm
 * lần làm bài mới.
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(`attempt-start:${clientIp(request)}`, 30, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Quá nhiều yêu cầu" }, { status: 429 });

  const body = await request.json() as { examId?: unknown };
  const examId = typeof body.examId === "string" ? body.examId : "";
  if (!examId) return NextResponse.json({ error: "Thiếu mã đề thi" }, { status: 400 });

  const exam = await prisma.exam.findUnique({ where: { id: examId }, include: { questions: { orderBy: { order: "asc" } } } });
  if (!exam || exam.status !== "published" || exam.hidden || exam.deletedAt) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });

  const now = new Date();
  if (exam.openAt && now < exam.openAt) return NextResponse.json({ error: "Đề thi chưa mở" }, { status: 403 });
  if (exam.closeAt && now > exam.closeAt) return NextResponse.json({ error: "Đề thi đã đóng" }, { status: 403 });

  const session = await auth();
  let studentId: string | null = null;
  let guestParticipantId: string | null = null;
  let activeKey: string;

  if (session?.user) {
    if (session.user.role !== "student") return NextResponse.json({ error: "Chỉ học sinh mới làm bài thi" }, { status: 403 });
    studentId = session.user.id;
    activeKey = studentActiveKey(session.user.id);
  } else {
    if (!exam.allowGuestAttempts) return NextResponse.json({ error: "Đề thi này yêu cầu đăng nhập tài khoản EduTest" }, { status: 401 });
    const token = (await cookies()).get(`edutest_guest_${exam.id}`)?.value;
    if (!token) return NextResponse.json({ error: "Phiên khách không hợp lệ hoặc đã hết hạn" }, { status: 401 });
    const guest = await prisma.guestParticipant.findFirst({ where: { examId: exam.id, tokenHash: createHash("sha256").update(token).digest("hex") }, select: { id: true, submittedAt: true } });
    if (!guest) return NextResponse.json({ error: "Phiên khách không hợp lệ hoặc đã hết hạn" }, { status: 401 });
    if (guest.submittedAt) return NextResponse.json({ error: "Bạn đã nộp bài này rồi" }, { status: 409 });
    guestParticipantId = guest.id;
    activeKey = guestActiveKey(token);
  }

  const started = await startAttempt({ exam, studentId, guestParticipantId, activeKey, questions: exam.questions });
  if (started.status === "active_elsewhere") return NextResponse.json({ error: "Bạn đang làm bài thi khác" }, { status: 409 });
  if (started.status === "max_attempts") return NextResponse.json({ error: `Bạn đã hết số lần làm bài (${exam.maxAttempts} lần)` }, { status: 409 });

  const a = started.attempt;
  return NextResponse.json(
    {
      id: a.id,
      examId: a.examId,
      questionOrder: a.questionOrder,
      optionOrder: a.optionOrder,
      startedAt: a.startedAt.toISOString(),
      deadlineAt: a.deadlineAt.toISOString(),
      serverNow: now.toISOString(),
      remainingSeconds: remainingSecondsOf(a.deadlineAt, now),
      graceSeconds: ATTEMPT_GRACE_SECONDS,
      submittedAt: a.submittedAt?.toISOString() ?? null,
    },
    { status: 201 },
  );
}
