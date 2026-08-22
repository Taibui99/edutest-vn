import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminAccess, sessionUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!isAdminAccess(sessionUser(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [logs, grouped] = await Promise.all([
    prisma.aiImportLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.aiImportLog.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const g of grouped) byStatus[g.status] = g._count._all;

  return NextResponse.json({ logs, byStatus });
}