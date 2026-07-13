import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

async function getOwnedExam(examId: string, teacherId: string) {
  return prisma.exam.findFirst({
    where: { id: examId, teacherId },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  }

  if (session.user.role !== "teacher") {
    return NextResponse.json({ error: "Chỉ giáo viên mới được thao tác" }, { status: 403 });
  }

  const { id } = await params;
  const exam = await getOwnedExam(id, session.user.id);

  if (!exam) {
    return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
  }

  const body = await request.json();
  const status = String(body.status || "");

  if (!["published", "draft"].includes(status)) {
    return NextResponse.json({ error: "Trạng thái không hợp lệ" }, { status: 400 });
  }

  const updated = await prisma.exam.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json({ exam: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  }

  if (session.user.role !== "teacher") {
    return NextResponse.json({ error: "Chỉ giáo viên mới được thao tác" }, { status: 403 });
  }

  const { id } = await params;
  const exam = await getOwnedExam(id, session.user.id);

  if (!exam) {
    return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
  }

  await prisma.exam.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
