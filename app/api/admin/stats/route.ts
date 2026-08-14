import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [
    userCounts,
    totalExams,
    totalSubmissions,
    totalClassrooms,
    totalFlashcards,
    pendingReports,
    aiLogs24h,
    streakTop,
    users7d,
    subs7d,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.exam.count(),
    prisma.submission.count(),
    prisma.classroom.count(),
    prisma.flashcard.count(),
    prisma.report.count({ where: { status: "pending" } }),
    prisma.aiImportLog.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } }),
    prisma.user.findMany({
      where: { streak: { gt: 0 } },
      orderBy: { streak: "desc" },
      take: 5,
      select: { name: true, email: true, streak: true },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
      select: { createdAt: true },
    }),
    prisma.submission.findMany({
      where: { submittedAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
      select: { submittedAt: true },
    }),
  ]);

  const byRole: Record<string, number> = {};
  for (const r of userCounts) byRole[r.role] = r._count._all;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 24 * 3600 * 1000);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const usersGrowth = days.map((d) => ({
    day: `${d.getDate()}/${d.getMonth() + 1}`,
    count: users7d.filter((u) => u.createdAt >= d && u.createdAt < new Date(d.getTime() + 86400000)).length,
  }));
  const subsGrowth = days.map((d) => ({
    day: `${d.getDate()}/${d.getMonth() + 1}`,
    count: subs7d.filter((s) => s.submittedAt >= d && s.submittedAt < new Date(d.getTime() + 86400000)).length,
  }));

  return NextResponse.json({
    users: {
      total: byRole.student + byRole.teacher + byRole.admin || 0,
      students: byRole.student ?? 0,
      teachers: byRole.teacher ?? 0,
      admins: byRole.admin ?? 0,
    },
    exams: totalExams,
    submissions: totalSubmissions,
    classrooms: totalClassrooms,
    flashcards: totalFlashcards,
    pendingReports,
    aiLogs24h,
    streakTop,
    usersGrowth,
    subsGrowth,
  });
}