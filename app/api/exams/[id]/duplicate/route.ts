import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isTeacherAccess } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { createUniqueJoinCode } from "../../exam-helpers";

/* EXAM-2 — Nhân bản đề thi (chỉ chủ đề). Bản sao:
 *  · copy câu hỏi (kèm điểm/đáp án/lời giải/ảnh) + mọi cài đặt của đề gốc;
 *  · ĐẶT LẠI mã vào thi + trạng thái NHÁP + bỏ lịch mở/đóng;
 *  · KHÔNG copy bài nộp, KHÔNG copy token bảng điểm trực tiếp.
 * Nhờ vậy GV tạo nhanh đề tương tự mà không vô tình mở trùng giờ hay lộ dữ liệu. */

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  }
  if (!isTeacherAccess(session.user)) {
    return NextResponse.json({ error: "Chỉ giáo viên mới được tạo đề" }, { status: 403 });
  }

  const { id } = await params;
  const exam = await prisma.exam.findFirst({
    where: { id, teacherId: session.user.id, deletedAt: null },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!exam) {
    return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
  }

  const copy = await prisma.exam.create({
    data: {
      title: `${exam.title} (bản sao)`,
      subject: exam.subject,
      description: exam.description,
      durationMinutes: exam.durationMinutes,
      shuffleQuestions: exam.shuffleQuestions,
      shuffleAnswers: exam.shuffleAnswers,
      allowGuestAttempts: exam.allowGuestAttempts,
      maxAttempts: exam.maxAttempts,
      showAnswers: exam.showAnswers,
      showScoreImmediately: exam.showScoreImmediately,
      proctorMode: exam.proctorMode,
      joinCode: await createUniqueJoinCode(),
      status: "draft",
      openAt: null,
      closeAt: null,
      teacherId: session.user.id,
      questions: {
        create: exam.questions.map((q) => ({
          type: q.type,
          text: q.text,
          options: q.options,
          answer: q.answer,
          grading: (q.grading ?? undefined) as Prisma.InputJsonValue | undefined,
          explanation: q.explanation,
          points: q.points,
          order: q.order,
        })),
      },
    },
    include: { _count: { select: { questions: true, submissions: true } } },
  });

  await logAudit({
    actorId: session.user.id,
    type: "exam.duplicate",
    message: `GV nhân bản đề "${exam.title}" (${exam.joinCode}) → "${copy.title}" (${copy.joinCode})`,
  });

  return NextResponse.json({ exam: copy }, { status: 201 });
}
