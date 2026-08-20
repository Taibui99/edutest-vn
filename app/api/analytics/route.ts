import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isTeacherAccess } from "@/lib/access";

export async function GET() {
  const session = await auth();
  if (!session?.user || !isTeacherAccess(session.user))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const teacherId = session.user.id!;

  const [exams, allSubmissions] = await Promise.all([
    prisma.exam.findMany({
      where: { teacherId },
      include: {
        submissions: { select: { score: true, correctCount: true, totalQuestions: true, durationSeconds: true, submittedAt: true } },
        _count: { select: { questions: true, submissions: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.submission.findMany({
      where: { exam: { teacherId } },
      select: { score: true, submittedAt: true, durationSeconds: true },
    }),
  ]);

  type SubRecord = { score: number; durationSeconds: number; submittedAt: Date };

  const totalSubs = allSubmissions.length;
  const avgScore = totalSubs > 0
    ? allSubmissions.reduce((s: number, x: SubRecord) => s + x.score, 0) / totalSubs
    : 0;
  const avgDuration = totalSubs > 0
    ? allSubmissions.reduce((s: number, x: SubRecord) => s + x.durationSeconds, 0) / totalSubs
    : 0;

  // Score distribution buckets
  const distribution = [0, 0, 0, 0, 0]; // <4, 4-5.9, 6-6.9, 7-8.4, 8.5-10
  for (const s of allSubmissions as SubRecord[]) {
    if (s.score < 4) distribution[0]++;
    else if (s.score < 6) distribution[1]++;
    else if (s.score < 7) distribution[2]++;
    else if (s.score < 8.5) distribution[3]++;
    else distribution[4]++;
  }

  // Last 7 days activity
  const now = Date.now();
  const weeklyActivity = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now - (6 - i) * 86400000);
    const dayStr = day.toLocaleDateString("vi-VN", { weekday: "short" });
    const count = (allSubmissions as SubRecord[]).filter((s) => {
      const d = new Date(s.submittedAt);
      return d.toDateString() === day.toDateString();
    }).length;
    return { day: dayStr, count };
  });

  type ExamWithSubs = typeof exams[0];

  // Per-exam stats
  const examStats = exams.map((e: ExamWithSubs) => {
    const subs = e.submissions;
    const avg = subs.length > 0 ? subs.reduce((s: number, x: { score: number }) => s + x.score, 0) / subs.length : null;
    return {
      id: e.id,
      title: e.title,
      subject: e.subject,
      questionCount: e._count.questions,
      submissionCount: e._count.submissions,
      avgScore: avg,
    };
  });

  return NextResponse.json({
    summary: {
      totalExams: exams.length,
      totalSubmissions: totalSubs,
      avgScore,
      avgDuration,
      activeExams: exams.filter((e: ExamWithSubs) => e.status === "published").length,
    },
    distribution,
    weeklyActivity,
    examStats,
  });
}
