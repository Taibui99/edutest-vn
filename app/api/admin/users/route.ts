import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminAccess, sessionUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!isAdminAccess(sessionUser(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const role = req.nextUrl.searchParams.get("role") ?? "";
  const status = req.nextUrl.searchParams.get("status") ?? "";
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? 1) || 1);

  const where: Record<string, unknown> = {};
  if (role) where.role = role;
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }];
  if (status === "blocked") where.isBlocked = true;
  if (status === "active") {
    where.isBlocked = false;
    where.deletedAt = null;
  }
  if (status === "deleted") where.deletedAt = { not: null };
  if (status !== "deleted") where.deletedAt = null;

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, name: true, email: true, role: true, isBlocked: true,
        school: true, grade: true, streak: true, lastLoginAt: true, createdAt: true,
        deletedAt: true,
        _count: { select: { submissions: true, exams: true } },
      },
    }),
  ]);

  return NextResponse.json({ users, total, page, pageSize: PAGE_SIZE, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!isAdminAccess(sessionUser(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, isBlocked, role, restore } = await req.json();
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Không tìm thấy người dùng" }, { status: 404 });

  if (id === session.user.id && (isBlocked || role)) {
    return NextResponse.json({ error: "Không thể thay đổi vai trò hoặc khóa chính mình" }, { status: 400 });
  }

  const data: { isBlocked?: boolean; role?: string; deletedAt?: Date | null } = {};
  if (typeof isBlocked === "boolean") data.isBlocked = isBlocked;
  if (role) {
    if (!["student", "teacher", "admin"].includes(role)) {
      return NextResponse.json({ error: "Vai trò không hợp lệ" }, { status: 400 });
    }
    data.role = role;
  }
  if (restore) {
    data.deletedAt = null;
    data.isBlocked = false;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Không có gì để cập nhật" }, { status: 400 });
  }

  const updated = await prisma.user.update({ where: { id }, data });
  await logAudit({
    actorId: session.user.id,
    type: restore ? "admin.user_restore" : "admin.user_update",
    message: restore
      ? `Admin ${session.user.email} khôi phục tài khoản ${target.email}`
      : `Admin ${session.user.email} cập nhật tài khoản ${target.email}`,
    meta: data,
  });

  return NextResponse.json({ user: updated });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!isAdminAccess(sessionUser(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await req.json();
  if (id === session.user.id) {
    return NextResponse.json({ error: "Không thể xóa chính mình" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Không tìm thấy người dùng" }, { status: 404 });
  if (target.deletedAt) return NextResponse.json({ error: "Tài khoản đã bị xóa" }, { status: 400 });

  if (target.role === "admin") {
    const adminCount = await prisma.user.count({ where: { role: "admin", deletedAt: null } });
    if (adminCount <= 1) {
      return NextResponse.json({ error: "Không thể xóa admin cuối cùng" }, { status: 400 });
    }
  }

  await prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
  await logAudit({
    actorId: session.user.id,
    type: "admin.user_delete",
    message: `Admin ${session.user.email} xóa tài khoản ${target.email} (soft delete)`,
  });

  return NextResponse.json({ ok: true });
}
