import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const body = await request.json();
  const examDate = body.examDate ? new Date(body.examDate) : null;

  if (body.examDate && Number.isNaN(examDate?.getTime())) {
    return NextResponse.json({ error: "Ngày thi không hợp lệ" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { examDate },
  });

  return NextResponse.json({ examDate });
}
