import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

async function getOwnedTask(taskId: string, studentId: string) {
  return prisma.studyTask.findFirst({ where: { id: taskId, studentId } });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const task = await getOwnedTask(id, session.user.id);
  if (!task) return NextResponse.json({ error: "Không tìm thấy công việc" }, { status: 404 });

  const body = await request.json();
  const updated = await prisma.studyTask.update({
    where: { id },
    data: { completed: Boolean(body.completed) },
  });

  return NextResponse.json({ task: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const task = await getOwnedTask(id, session.user.id);
  if (!task) return NextResponse.json({ error: "Không tìm thấy công việc" }, { status: 404 });

  await prisma.studyTask.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
