import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const classroom = await prisma.classroom.findUnique({
    where: { id },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      members: {
        include: { student: { select: { id: true, name: true, email: true } } },
        orderBy: { joinedAt: "asc" },
      },
      assignments: {
        include: {
          exam: {
            select: {
              id: true, title: true, subject: true, durationMinutes: true, joinCode: true,
              _count: { select: { questions: true, submissions: true } },
            },
          },
        },
        orderBy: { assignedAt: "desc" },
      },
    },
  });

  if (!classroom) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userId = session.user.id!;
  const isTeacher = classroom.teacherId === userId;
  const isMember = classroom.members.some((m: { studentId: string }) => m.studentId === userId);
  if (!isTeacher && !isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(classroom);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const classroom = await prisma.classroom.findUnique({ where: { id } });
  if (!classroom || classroom.teacherId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const updated = await prisma.classroom.update({
    where: { id },
    data: {
      name: body.name?.trim() || classroom.name,
      description: body.description?.trim() ?? classroom.description,
      subject: body.subject?.trim() ?? classroom.subject,
      grade: body.grade?.trim() ?? classroom.grade,
      archived: body.archived ?? classroom.archived,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const classroom = await prisma.classroom.findUnique({ where: { id } });
  if (!classroom || classroom.teacherId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.classroom.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
