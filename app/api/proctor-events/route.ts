import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { isProctorEventType, severityOf } from "@/lib/integrity";

/**
 * GĐ2 — Ghi MỘT sự kiện vi phạm vào nhật ký của lần làm bài.
 *
 * Chỉ ghi log cho giáo viên xem timeline — **không** trừ điểm, **không** chặn
 * nộp bài (ROADMAP — "Chống gian lận khi thi"). Điểm rủi ro được tính LÚC NỘP
 * bài trong `POST /api/submissions` / `finalizeTimedOutAttempt`, không ở đây.
 *
 * Server KHÔNG tin client: `type` phải nằm trong whitelist, `severity` do server
 * quy cho từng loại sự kiện, quyền sở hữu kiểm tra lại từ session/cookie.
 */

/** Mỗi lần làm bài chỉ ghi được chừng này sự kiện — chặn ghi rác làm phình DB. */
const MAX_EVENTS_PER_ATTEMPT = 50;

export async function POST(request: NextRequest) {
  const rl = rateLimit(`proctor:${clientIp(request)}`, 180, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Quá nhiều yêu cầu" }, { status: 429 });

  let body: { attemptId?: unknown; type?: unknown; detail?: unknown } | null = null;
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = null; // body rác / không phải JSON
  }
  const attemptId = typeof body?.attemptId === "string" ? body.attemptId : "";
  const type = typeof body?.type === "string" ? body.type : "";
  const rawDetail = typeof body?.detail === "string" ? body.detail : "";
  const detail = rawDetail ? rawDetail.slice(0, 200) : null;

  if (!attemptId) return NextResponse.json({ error: "Thiếu mã lần làm bài" }, { status: 400 });
  // Tên sự kiện lạ bị từ chối ngay — không cho client tự đặt mức nghiêm trọng.
  if (!isProctorEventType(type)) return NextResponse.json({ error: "Loại sự kiện không hợp lệ" }, { status: 400 });

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { guestParticipant: { select: { id: true, tokenHash: true } } },
  });
  if (!attempt) return NextResponse.json({ error: "Không tìm thấy lần làm bài" }, { status: 404 });

  // Quyền sở hữu: cùng kiểm tra với `GET /api/attempts/[id]`.
  const session = await auth();
  if (session?.user) {
    if (attempt.studentId !== session.user.id) return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  } else {
    if (!attempt.guestParticipant) return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
    const token = (await cookies()).get(`edutest_guest_${attempt.examId}`)?.value;
    const hash = token ? createHash("sha256").update(token).digest("hex") : null;
    if (!hash || hash !== attempt.guestParticipant.tokenHash) return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  // Bài đã chốt thì timeline dừng lại đúng lúc giáo viên đọc.
  if (attempt.submittedAt) return NextResponse.json({ error: "Bài thi đã được nộp" }, { status: 409 });

  const existing = await prisma.proctorEvent.count({ where: { attemptId } });
  if (existing >= MAX_EVENTS_PER_ATTEMPT) {
    return NextResponse.json({ error: "Đã ghi nhận quá nhiều sự kiện" }, { status: 429 });
  }

  await prisma.proctorEvent.create({
    data: { attemptId, type, severity: severityOf(type) ?? "medium", detail },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
