import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const role = req.nextUrl.searchParams.get("role") ?? "";

  const users = await prisma.user.findMany({
    where: {
      ...(role ? { role } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true, name: true, email: true, role: true, isBlocked: true,
      school: true, grade: true, streak: true, lastLoginAt: true, createdAt: true,
      _count: { select: { submissions: true, exams: true } },
    },
  });

  return NextResponse.json({ users });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, isBlocked, role } = await req.json();
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Không tìm thấy người dùng" }, { status: 404 });

  if (id === session.user.id && isBlocked) {
    return NextResponse.json({ error: "Không thể khóa chính mình" }, { status: 400 });
  }

  const data: { isBlocked?: boolean; role?: string } = {};
  if (typeof isBlocked === "boolean") data.isBlocked = isBlocked;
  if (role) {
    if (!["student", "teacher", "admin"].includes(role)) {
      return NextResponse.json({ error: "Vai trò không hợp lệ" }, { status: 400 });
    }
    data.role = role;
  }

  const updated = await prisma.user.update({ where: { id }, data });
  await logAudit({
    actorId: session.user.id,
    type: "admin.user_update",
    message: `Admin ${session.user.email} cập nhật tài khoản ${target.email}`,
    meta: data,
  });

  return NextResponse.json({ user: updated });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await req.json();
  if (id === session.user.id) {
    return NextResponse.json({ error: "Không thể xóa chính mình" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Không tìm thấy người dùng" }, { status: 404 });

  await prisma.user.delete({ where: { id } });
  await logAudit({
    actorId: session.user.id,
    type: "admin.user_delete",
    message: `Admin ${session.user.email} xóa tài khoản ${target.email}`,
  });

  return NextResponse.json({ ok: true });
}