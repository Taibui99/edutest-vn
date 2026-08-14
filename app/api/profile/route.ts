import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id! },
    select: { id: true, name: true, email: true, role: true, school: true, grade: true, bio: true, avatarUrl: true, createdAt: true },
  });
  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, school, grade, bio, currentPassword, newPassword } = await req.json();

  const updates: Record<string, unknown> = {};
  if (name?.trim()) updates.name = name.trim();
  if (school !== undefined) updates.school = school?.trim() || null;
  if (grade !== undefined) updates.grade = grade?.trim() || null;
  if (bio !== undefined) updates.bio = bio?.trim() || null;

  // Password change
  if (newPassword) {
    if (!currentPassword) return NextResponse.json({ error: "Nhập mật khẩu hiện tại" }, { status: 400 });
    const user = await prisma.user.findUnique({ where: { id: session.user.id! } });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return NextResponse.json({ error: "Mật khẩu hiện tại không đúng" }, { status: 400 });
    if (newPassword.length < 6) return NextResponse.json({ error: "Mật khẩu mới phải từ 6 ký tự" }, { status: 400 });
    updates.password = await bcrypt.hash(newPassword, 12);
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id! },
    data: updates,
    select: { id: true, name: true, email: true, role: true, school: true, grade: true, bio: true },
  });

  return NextResponse.json(updated);
}
