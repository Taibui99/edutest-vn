import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProgressClient } from "./progress-client";

export const metadata: Metadata = {
  title: "Tiến độ học tập — EduTest",
};

export default async function TienDoPage() {
  const session = await auth();
  if (!session?.user) redirect("/dang-nhap");
  if (session.user.role !== "student") redirect("/bang-dieu-khien");

  const [user, submissions, flashcardCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { streak: true, lastStudyDate: true },
    }),
    prisma.submission.findMany({
      where: { studentId: session.user.id },
      orderBy: { submittedAt: "desc" },
      take: 200,
      include: { exam: { select: { title: true, subject: true } } },
    }),
    prisma.flashcard.count({ where: { studentId: session.user.id } }),
  ]);

  return (
    <ProgressClient
      streak={user?.streak ?? 0}
      lastStudyDate={user?.lastStudyDate ? user.lastStudyDate.toISOString() : null}
      flashcardCount={flashcardCount}
      submissions={submissions.map((s) => ({
        id: s.id,
        title: s.exam.title,
        subject: s.exam.subject,
        score: s.score,
        totalQuestions: s.totalQuestions,
        correctCount: s.correctCount,
        durationSeconds: s.durationSeconds,
        submittedAt: s.submittedAt.toISOString(),
      }))}
    />
  );
}