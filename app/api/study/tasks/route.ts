import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const tasks = await prisma.studyTask.findMany({
    where: { studentId: session.user.id },
    orderBy: [{ completed: "asc" }, { dueDate: "asc" }],
  });

  return NextResponse.json({ tasks });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const body = await request.json();
  const title = String(body.title || "").trim();
  const subject = body.subject ? String(body.subject) : null;
  const dueDate = body.dueDate ? new Date(body.dueDate) : null;

  if (!title) {
    return NextResponse.json({ error: "Thiếu tiêu đề công việc" }, { status: 400 });
  }

  const task = await prisma.studyTask.create({
    data: { studentId: session.user.id, title, subject, dueDate },
  });

  return NextResponse.json({ task });
}
