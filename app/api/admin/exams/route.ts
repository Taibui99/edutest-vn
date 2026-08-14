import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const exams = await prisma.exam.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      teacher: { select: { name: true, email: true } },
      _count: { select: { questions: true, submissions: true } },
    },
  });

  return NextResponse.json({ exams });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await req.json();
  const exam = await prisma.exam.findUnique({ where: { id } });
  if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });

  await prisma.exam.delete({ where: { id } });
  await logAudit({
    actorId: session.user.id,
    type: "admin.exam_delete",
    message: `Admin ${session.user.email} xóa đề "${exam.title}" (${exam.id})`,
  });

  return NextResponse.json({ ok: true });
}