import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// POST: assign an exam to this classroom
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const classroom = await prisma.classroom.findUnique({ where: { id } });
  if (!classroom || classroom.teacherId !== session.user.id!)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { examId, dueDate } = await req.json();
  if (!examId) return NextResponse.json({ error: "Thiếu examId" }, { status: 400 });

  // Verify teacher owns this exam
  const exam = await prisma.exam.findFirst({
    where: { id: examId, teacherId: session.user.id! },
    select: { id: true, title: true, subject: true, joinCode: true, durationMinutes: true,
      _count: { select: { questions: true, submissions: true } } },
  });
  if (!exam) return NextResponse.json({ error: "Đề không tồn tại" }, { status: 404 });

  const assignment = await prisma.examAssignment.upsert({
    where: { classroomId_examId: { classroomId: id, examId } },
    create: {
      classroomId: id,
      examId,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
    update: {
      dueDate: dueDate ? new Date(dueDate) : null,
    },
  });

  // Notify all students in the class
  const members = await prisma.classMember.findMany({
    where: { classroomId: id },
    select: { studentId: true },
  });
  if (members.length > 0) {
    await prisma.notification.createMany({
      data: members.map((m) => ({
        userId: m.studentId,
        type: "new_exam",
        title: "Giáo viên vừa giao đề thi mới",
        message: `Đề "${exam.title}" đã được giao trong lớp ${classroom.name}`,
        link: `/vao-thi`,
      })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json({ assignment, exam });
}

// DELETE: remove exam assignment from classroom
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const classroom = await prisma.classroom.findUnique({ where: { id } });
  if (!classroom || classroom.teacherId !== session.user.id!)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { examId } = await req.json();
  await prisma.examAssignment.deleteMany({
    where: { classroomId: id, examId },
  });

  return NextResponse.json({ ok: true });
}
