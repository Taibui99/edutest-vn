import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get("status") ?? "";
  const reports = await prisma.report.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      reporter: { select: { name: true, email: true } },
      exam: { select: { title: true, subject: true } },
    },
  });

  return NextResponse.json({ reports });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, status } = await req.json();
  if (!["pending", "investigating", "resolved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Trạng thái không hợp lệ" }, { status: 400 });
  }

  const updated = await prisma.report.update({
    where: { id },
    data: { status, resolvedAt: status === "resolved" || status === "rejected" ? new Date() : null },
  });

  await logAudit({
    actorId: session.user.id,
    type: "admin.report_update",
    message: `Admin ${session.user.email} đổi trạng thái báo cáo ${id} → ${status}`,
  });

  return NextResponse.json({ report: updated });
}