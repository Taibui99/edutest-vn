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
    aiByStatus,
    aiErrors,
    reportsByStatus,
    topExams,
    subjects,
    usersBefore7d,
    recentUsers,
    recentSubs,
    pendingReportsList,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.exam.count({ where: { deletedAt: null } }),
    prisma.submission.count(),
    prisma.classroom.count(),
    prisma.flashcard.count(),
    prisma.report.count({ where: { status: "pending", deletedAt: null } }),
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
    prisma.aiImportLog.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.aiImportLog.findMany({
      where: { status: { not: "success" }, error: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { model: true, error: true, createdAt: true },
    }),
    prisma.report.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.exam.findMany({
      where: { deletedAt: null },
      orderBy: { submissions: { _count: "desc" } },
      take: 5,
      select: { id: true, title: true, subject: true, _count: { select: { submissions: true } } },
    }),
    prisma.exam.findMany({
      where: { deletedAt: null },
      select: { subject: true },
    }),
    prisma.user.count({ where: { createdAt: { lt: new Date(Date.now() - 7 * 24 * 3600 * 1000) }, deletedAt: null } }),
    prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { name: true, email: true, role: true, createdAt: true },
    }),
    prisma.submission.findMany({
      orderBy: { submittedAt: "desc" },
      take: 6,
      select: { score: true, submittedAt: true, student: { select: { name: true } }, exam: { select: { title: true } } },
    }),
    prisma.report.findMany({
      where: { status: "pending", deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, type: true, description: true, createdAt: true, reporter: { select: { name: true } }, exam: { select: { title: true } } },
    }),
  ]);

  const byRole: Record<string, number> = {};
  for (const r of userCounts) byRole[r.role] = r._count._all;

  const aiStatus: Record<string, number> = {};
  for (const g of aiByStatus) aiStatus[g.status] = g._count._all;

  const reportStatus: Record<string, number> = {};
  for (const g of reportsByStatus) reportStatus[g.status] = g._count._all;

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

  const pct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0);

  return NextResponse.json({
    users: {
      total: byRole.student + byRole.teacher + byRole.admin || 0,
      students: byRole.student ?? 0,
      teachers: byRole.teacher ?? 0,
      admins: byRole.admin ?? 0,
      deltaPct: pct(usersGrowth.reduce((s, d) => s + d.count, 0), usersBefore7d),
    },
    exams: totalExams,
    submissions: totalSubmissions,
    classrooms: totalClassrooms,
    flashcards: totalFlashcards,
    pendingReports,
    aiLogs24h,
    aiByStatus: aiStatus,
    aiErrors,
    reportsByStatus: reportStatus,
    topExams,
    subjects: Array.from(
      subjects.reduce((map, s) => map.set(s.subject, (map.get(s.subject) ?? 0) + 1), new Map<string, number>()),
      ([subject, count]) => ({ subject, count }),
    ).sort((a, b) => b.count - a.count).slice(0, 6),
    streakTop,
    usersGrowth,
    subsGrowth,
    recentActivity: {
      users: recentUsers,
      subs: recentSubs,
      pendingReports: pendingReportsList,
    },
  });
}