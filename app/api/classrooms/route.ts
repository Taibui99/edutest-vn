import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { nanoid } from "@/lib/nanoid";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id!;
  const isTeacher = session.user.role === "teacher";

  if (isTeacher) {
    const classrooms = await prisma.classroom.findMany({
      where: { teacherId: userId, archived: false },
      include: { _count: { select: { members: true, assignments: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(classrooms);
  }

  const memberships = await prisma.classMember.findMany({
    where: { studentId: userId },
    include: {
      classroom: {
        include: {
          teacher: { select: { name: true } },
          _count: { select: { members: true, assignments: true } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });
  return NextResponse.json(memberships.map((m: { classroom: unknown }) => m.classroom));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, subject, grade } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Tên lớp không được trống" }, { status: 400 });

  const joinCode = nanoid(6).toUpperCase();
  const classroom = await prisma.classroom.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      subject: subject?.trim() || null,
      grade: grade?.trim() || null,
      joinCode,
      teacherId: session.user.id!,
    },
  });

  return NextResponse.json(classroom, { status: 201 });
}
