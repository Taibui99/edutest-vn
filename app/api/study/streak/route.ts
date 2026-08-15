import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Không tìm thấy người dùng" }, { status: 404 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const last = user.lastStudyDate ? new Date(user.lastStudyDate) : null;
  last?.setHours(0, 0, 0, 0);

  let streak = user.streak;
  if (!last || last.getTime() < yesterday.getTime()) {
    streak = 1;
  } else if (last.getTime() === yesterday.getTime()) {
    streak = user.streak + 1;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { streak, lastStudyDate: new Date() },
  });

  return NextResponse.json({ streak });
}