import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ joinCode: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  }

  if (session.user.role !== "teacher") {
    return NextResponse.json({ error: "Chỉ giáo viên mới có quyền chia sẻ đề" }, { status: 403 });
  }

  const { joinCode } = await params;
  const exam = await prisma.exam.findUnique({
    where: { joinCode: joinCode.toUpperCase() },
    select: {
      id: true,
      title: true,
      subject: true,
      durationMinutes: true,
      joinCode: true,
      status: true,
      teacherId: true,
      _count: { select: { questions: true } },
    },
  });

  if (!exam || exam.teacherId !== session.user.id) {
    return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
  }

  const origin = new URL(_request.url).origin;
  const shareUrl = `${origin}/thi/${encodeURIComponent(exam.joinCode)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=16&data=${encodeURIComponent(shareUrl)}`;

  return NextResponse.json({
    exam: {
      id: exam.id,
      title: exam.title,
      subject: exam.subject,
      durationMinutes: exam.durationMinutes,
      questionCount: exam._count.questions,
      status: exam.status,
    },
    shareUrl,
    qrUrl,
  });
}
