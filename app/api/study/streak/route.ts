import { auth } from "@/auth";
import { bumpStudyStreak } from "@/lib/streak";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const streak = await bumpStudyStreak(session.user.id!);
  return NextResponse.json({ streak });
}