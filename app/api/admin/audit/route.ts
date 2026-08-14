import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const type = req.nextUrl.searchParams.get("type") ?? "";
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? 1) || 1);
  const pageSize = 50;

  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (q) where.message = { contains: q, mode: "insensitive" };

  const [total, logs] = await Promise.all([
    prisma.appLog.count({ where }),
    prisma.appLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { name: true, email: true } } },
    }),
  ]);

  const types = await prisma.appLog.groupBy({ by: ["type"], _count: { _all: true } });

  return NextResponse.json({ logs, types, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}