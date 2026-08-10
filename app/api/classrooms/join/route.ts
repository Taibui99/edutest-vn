import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "student")
    return NextResponse.json({ error: "Chỉ học sinh mới có thể tham gia lớp" }, { status: 403 });

  const { code } = await req.json();
  if (!code?.trim()) return NextResponse.json({ error: "Nhập mã lớp" }, { status: 400 });

  const classroom = await prisma.classroom.findUnique({
    where: { joinCode: code.trim().toUpperCase() },
    include: { teacher: { select: { name: true } } },
  });

  if (!classroom || classroom.archived)
    return NextResponse.json({ error: "Mã lớp không hợp lệ hoặc lớp đã đóng" }, { status: 404 });

  const existing = await prisma.classMember.findUnique({
    where: { classroomId_studentId: { classroomId: classroom.id, studentId: session.user.id! } },
  });
  if (existing) return NextResponse.json({ error: "Bạn đã tham gia lớp này rồi" }, { status: 400 });

  await prisma.classMember.create({
    data: { classroomId: classroom.id, studentId: session.user.id! },
  });

  // Create notification for teacher
  await prisma.notification.create({
    data: {
      userId: classroom.teacherId,
      type: "class_join",
      title: "Học sinh mới tham gia lớp",
      message: `${session.user.name} vừa tham gia lớp ${classroom.name}`,
      link: `/bang-dieu-khien/lop-hoc/${classroom.id}`,
    },
  });

  return NextResponse.json({ classroom });
}
