import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const VALID_STATUSES = ["pending", "reviewing", "resolved", "rejected"];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get("status") ?? "";
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? 1) || 1);
  const pageSize = 20;

  const where: Record<string, unknown> = { deletedAt: null };
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { type: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { reporter: { name: { contains: q, mode: "insensitive" } } },
      { exam: { title: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [total, reports] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        reporter: { select: { name: true, email: true } },
        handledBy: { select: { name: true, email: true } },
        exam: { select: { title: true, subject: true } },
      },
    }),
  ]);

  return NextResponse.json({ reports, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, status, resolution } = await req.json();
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Trạng thái không hợp lệ" }, { status: 400 });
  }

  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return NextResponse.json({ error: "Không tìm thấy báo cáo" }, { status: 404 });

  const isTerminal = status === "resolved" || status === "rejected";
  const updated = await prisma.report.update({
    where: { id },
    data: {
      status,
      resolution: resolution ? String(resolution).trim() : report.resolution,
      handledById: isTerminal ? session.user.id : null,
      handledAt: isTerminal ? new Date() : null,
      resolvedAt: isTerminal ? new Date() : null,
    },
  });

  await logAudit({
    actorId: session.user.id,
    type: "admin.report_update",
    message: `Admin ${session.user.email} đổi trạng thái báo cáo ${id} → ${status}`,
    meta: resolution ? { resolution } : undefined,
  });

  return NextResponse.json({ report: updated });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await req.json();
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return NextResponse.json({ error: "Không tìm thấy báo cáo" }, { status: 404 });

  await prisma.report.update({ where: { id }, data: { deletedAt: new Date() } });
  await logAudit({
    actorId: session.user.id,
    type: "admin.report_delete",
    message: `Admin ${session.user.email} xóa báo cáo ${id} — soft delete`,
  });

  return NextResponse.json({ ok: true });
}