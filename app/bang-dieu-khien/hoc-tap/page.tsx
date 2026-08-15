import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckSquare, Flame, Layers } from "lucide-react";
import { auth } from "@/auth";
import { Logo } from "@/app/components/logo";
import { ThemeToggle } from "@/components/theme/theme-provider";
import { prisma } from "@/lib/prisma";
import { StudyHubClient } from "./study-hub-client";

export const metadata: Metadata = {
  title: "Góc học tập cá nhân — EduTest",
};

export default async function StudyHubPage() {
  const session = await auth();
  if (!session?.user) redirect("/dang-nhap");
  if (session.user.mode !== "student") redirect("/bang-dieu-khien");

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

  type CardType = typeof allCards[0];
  type TaskType = typeof tasks[0];
  type ProgressType = typeof subjectProgress[0];
  const dueCards = allCards.filter((c: CardType) => c.nextReviewAt <= new Date());
  const pendingTasks = tasks.filter((t) => !t.completed).length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Chào buổi sáng" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";

  return (
    <div className="min-h-screen bg-[var(--surface-bg)]">
      <header className="sticky top-0 z-10 border-b border-[var(--surface-border)] bg-[var(--surface-card)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/bang-dieu-khien"
              className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Bảng điều khiển
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-[var(--gradient-brand)] p-8 text-white shadow-lg mb-8 motion-card">
          <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10" />
          <div className="absolute -bottom-24 right-32 h-64 w-64 rounded-full bg-white/5" />
          <div className="relative">
            <p className="flex items-center gap-2 text-sm font-medium text-white/80">
              <CalendarDays className="h-4 w-4" />
              Góc học tập cá nhân
            </p>
            <h1 className="mt-1 text-3xl font-extrabold">
              {greeting}, {user?.name?.split(" ").slice(-1)[0] || "bạn"}!
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/80">
              Đếm ngược, việc cần làm, flashcard ôn tập và tiến độ từng môn — tất cả trong 1 nơi.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <span className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur">
                <Flame className="h-3.5 w-3.5" />
                {user?.streak ?? 0} ngày streak
              </span>
              <span className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur">
                <Layers className="h-3.5 w-3.5" />
                {dueCards.length} thẻ đến hạn
              </span>
              <span className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur">
                <CheckSquare className="h-3.5 w-3.5" />
                {pendingTasks} việc chưa xong
              </span>
            </div>
          </div>
        </div>

        <StudyHubClient
          initialExamDate={user?.examDate ? user.examDate.toISOString() : null}
          initialTasks={tasks.map((t: TaskType) => ({
            ...t,
            dueDate: t.dueDate ? t.dueDate.toISOString() : null,
            createdAt: t.createdAt.toISOString(),
          }))}
          initialCards={allCards.map((c: CardType) => ({
            ...c,
            nextReviewAt: c.nextReviewAt.toISOString(),
            createdAt: c.createdAt.toISOString(),
          }))}
          initialDueCount={dueCards.length}
          initialProgress={subjectProgress.map((p: ProgressType) => ({ subject: p.subject, progress: p.progress }))}
          initialStreak={user?.streak ?? 0}
        />
      </main>
    </div>
  );
}