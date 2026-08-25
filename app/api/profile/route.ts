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
  if (name?.trim()) {
    const n = name.trim();
    if (n.length > 100) return NextResponse.json({ error: "Tên tối đa 100 ký tự" }, { status: 400 });
    updates.name = n;
  }
  if (school !== undefined) {
    const s = school?.trim() || null;
    if (s && s.length > 200) return NextResponse.json({ error: "Trường tối đa 200 ký tự" }, { status: 400 });
    updates.school = s;
  }
  if (grade !== undefined) {
    const g = grade?.trim() || null;
    if (g && g.length > 20) return NextResponse.json({ error: "Khối tối đa 20 ký tự" }, { status: 400 });
    updates.grade = g;
  }
  if (bio !== undefined) {
    const b = bio?.trim() || null;
    if (b && b.length > 500) return NextResponse.json({ error: "Giới thiệu tối đa 500 ký tự" }, { status: 400 });
    updates.bio = b;
  }

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
