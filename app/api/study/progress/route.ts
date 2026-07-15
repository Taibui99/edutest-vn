import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const progress = await prisma.subjectProgress.findMany({
    where: { studentId: session.user.id },
  });

  return NextResponse.json({ progress });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const body = await request.json();
  const subject = String(body.subject || "").trim();
  const progressValue = Math.min(100, Math.max(0, Number(body.progress)));

  if (!subject || Number.isNaN(progressValue)) {
    return NextResponse.json({ error: "Thiếu môn học hoặc giá trị tiến độ không hợp lệ" }, { status: 400 });
  }

  const updated = await prisma.subjectProgress.upsert({
    where: { studentId_subject: { studentId: session.user.id, subject } },
    update: { progress: progressValue },
    create: { studentId: session.user.id, subject, progress: progressValue },
  });

  return NextResponse.json({ progress: updated });
}
