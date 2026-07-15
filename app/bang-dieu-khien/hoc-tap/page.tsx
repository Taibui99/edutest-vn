import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Logo } from "@/app/components/logo";
import { prisma } from "@/lib/prisma";
import { StudyHubClient } from "./study-hub-client";

export const metadata: Metadata = {
  title: "Góc học tập cá nhân — EduTest",
};

export default async function StudyHubPage() {
  const session = await auth();
  if (!session?.user) redirect("/dang-nhap");
  if (session.user.role !== "student") redirect("/bang-dieu-khien");

  const [user, tasks, allCards, subjectProgress] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.studyTask.findMany({
      where: { studentId: session.user.id },
      orderBy: [{ completed: "asc" }, { dueDate: "asc" }],
    }),
    prisma.flashcard.findMany({
      where: { studentId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.subjectProgress.findMany({ where: { studentId: session.user.id } }),
  ]);

  const dueCards = allCards.filter((c) => c.nextReviewAt <= new Date());

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-green-100 bg-white sticky top-0 z-10">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo />
          <Link href="/bang-dieu-khien" className="text-sm font-medium text-slate-500 hover:text-slate-800">
            ← Bảng điều khiển
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-gradient-to-r from-green-500 to-green-600 p-8 text-white mb-8">
          <p className="text-sm font-medium opacity-80 mb-1">🎯 Góc học tập cá nhân</p>
          <h1 className="text-3xl font-bold">Chuẩn bị cho kỳ thi THPT</h1>
          <p className="mt-2 opacity-80 text-sm">
            Đếm ngược, việc cần làm, flashcard ôn tập và tiến độ từng môn — tất cả trong 1 nơi.
          </p>
        </div>

        <StudyHubClient
          initialExamDate={user?.examDate ? user.examDate.toISOString() : null}
          initialTasks={tasks.map((t) => ({
            ...t,
            dueDate: t.dueDate ? t.dueDate.toISOString() : null,
            createdAt: t.createdAt.toISOString(),
          }))}
          initialCards={allCards.map((c) => ({
            ...c,
            nextReviewAt: c.nextReviewAt.toISOString(),
            createdAt: c.createdAt.toISOString(),
          }))}
          initialDueCount={dueCards.length}
          initialProgress={subjectProgress.map((p) => ({ subject: p.subject, progress: p.progress }))}
        />
      </main>
    </div>
  );
}
