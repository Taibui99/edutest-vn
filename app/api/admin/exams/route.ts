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
  const status = req.nextUrl.searchParams.get("status") ?? "";
  const hidden = req.nextUrl.searchParams.get("hidden") ?? "";
  const deleted = req.nextUrl.searchParams.get("deleted") === "true";
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? 1) || 1);

  const where: Record<string, unknown> = { deletedAt: deleted ? { not: null } : null };
  if (status) where.status = status;
  if (hidden === "true") where.hidden = true;
  if (hidden === "false") where.hidden = false;
  if (q) where.title = { contains: q, mode: "insensitive" };

  const [total, exams] = await Promise.all([
    prisma.exam.count({ where }),
    prisma.exam.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        teacher: { select: { name: true, email: true } },
        _count: { select: { questions: true, submissions: true, reports: true } },
      },
    }),
  ]);

  return NextResponse.json({ exams, total, page, pageSize: PAGE_SIZE, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!isAdminAccess(sessionUser(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, hidden, restore } = await req.json();
  const exam = await prisma.exam.findUnique({ where: { id } });
  if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });

  const data: { hidden?: boolean; deletedAt?: Date | null } = {};
  if (typeof hidden === "boolean") data.hidden = hidden;
  if (restore) {
    data.deletedAt = null;
    data.hidden = false;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Không có gì để cập nhật" }, { status: 400 });
  }

  const updated = await prisma.exam.update({ where: { id }, data });
  await logAudit({
    actorId: session.user.id,
    type: restore ? "admin.exam_restore" : hidden === true ? "admin.exam_hide" : hidden === false ? "admin.exam_unhide" : "admin.exam_update",
    message: restore
      ? `Admin ${session.user.email} khôi phục đề "${exam.title}"`
      : hidden === true
        ? `Admin ${session.user.email} ẩn đề "${exam.title}"`
        : hidden === false
          ? `Admin ${session.user.email} hiện đề "${exam.title}"`
          : `Admin ${session.user.email} cập nhật đề "${exam.title}"`,
    meta: data,
  });

  return NextResponse.json({ exam: updated });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!isAdminAccess(sessionUser(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await req.json();
  const exam = await prisma.exam.findUnique({ where: { id } });
  if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
  if (exam.deletedAt) return NextResponse.json({ error: "Đề đã bị xóa" }, { status: 400 });

  await prisma.exam.update({ where: { id }, data: { deletedAt: new Date(), hidden: true } });
  await logAudit({
    actorId: session.user.id,
    type: "admin.exam_delete",
    message: `Admin ${session.user.email} xóa đề "${exam.title}" (${exam.id}) — soft delete`,
  });

  return NextResponse.json({ ok: true });
}