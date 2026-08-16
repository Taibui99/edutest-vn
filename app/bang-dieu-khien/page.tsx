import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  BookOpen, FileText, Trophy, Plus, Zap, ArrowRight,
  CheckCircle2, AlertCircle, Target, Flame, Clock,
  BarChart3, Sparkles, CheckSquare, GraduationCap, ShieldCheck, Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getSubjectColor } from "@/lib/subject";
import { cn } from "@/lib/cn";
import { ModeSwitchButton } from "@/components/mode-switch";
import { ContinueDraftCard } from "./continue-draft";

export const metadata: Metadata = { title: "Tổng quan — EduTest" };

function getDaysUntil(target: Date) {
  const diff = target.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Chào buổi sáng";
  if (h < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

function scoreColor(score: number) {
  if (score >= 8)   return "text-[#06D6A0]";
  if (score >= 6.5) return "text-[#FFD166]";
  return "text-[#FF6B6B]";
}

function scoreBg(score: number) {
  if (score >= 8)   return { bg: "#E1F5EE", text: "#06D6A0" };
  if (score >= 6.5) return { bg: "#FFF8E1", text: "#D4A017" };
  return { bg: "#FFECEC", text: "#FF6B6B" };
}

/* ─────────────────────────────────────────── Student ─── */
async function StudentDashboard({ userId, name }: { userId: string; name: string }) {
  const [submissions, allSubs, tasks, dueCards, allCards, subjectProgress, userRecord] = await Promise.all([
    prisma.submission.findMany({
      where: { studentId: userId },
      include: { exam: { select: { title: true, subject: true } } },
      orderBy: { submittedAt: "desc" },
      take: 5,
    }),
    prisma.submission.aggregate({
      where: { studentId: userId },
      _count: { _all: true },
      _avg: { score: true },
    }),
    prisma.studyTask.findMany({
      where: { studentId: userId, completed: false },
      orderBy: { dueDate: "asc" },
      take: 4,
    }),
    prisma.flashcard.count({
      where: { studentId: userId, nextReviewAt: { lte: new Date() } },
    }),
    prisma.flashcard.count({ where: { studentId: userId } }),
    prisma.subjectProgress.findMany({ where: { studentId: userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { examDate: true, streak: true } }),
  ]);

  type SubType = typeof submissions[0];
  type TaskType = typeof tasks[0];
  type ProgressType = typeof subjectProgress[0];

  const totalSubmissions = allSubs._count._all;
  const avgScore = allSubs._avg.score ?? 0;
  const streak = userRecord?.streak ?? 0;
  const daysLeft = userRecord?.examDate ? getDaysUntil(userRecord.examDate) : null;
  const progressPct = daysLeft != null
    ? Math.max(5, Math.min(95, 100 - (daysLeft / 365) * 100))
    : 0;

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto animate-fade-in">

      {/* ── Greeting banner */}
      <div className="rounded-3xl bg-gradient-to-r from-[#6C63FF] via-[#8B83FF] to-[#FF6B6B] p-6 mb-6 relative overflow-hidden">
        {/* decorative circles */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 right-20 w-28 h-28 rounded-full bg-white/5" />

        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-white/70 text-sm font-medium">{getGreeting()},</p>
            <h1 className="text-2xl font-black text-white mt-0.5">{name} 👋</h1>
            {daysLeft !== null ? (
              <div className="mt-3">
                <p className="text-white/80 text-sm">
                  Còn <strong className="text-white font-black text-lg">{daysLeft}</strong> ngày đến kỳ thi THPT
                </p>
                <div className="mt-2 h-2 bg-white/20 rounded-full w-48 max-w-full">
                  <div
                    className="h-full bg-white rounded-full transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            ) : (
              <Link href="/bang-dieu-khien/hoc-tap" className="mt-3 inline-flex items-center gap-1 text-sm text-white/80 hover:text-white">
                Đặt ngày thi THPT <ArrowRight size={14} />
              </Link>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-2xl bg-white/15 px-4 py-2 backdrop-blur-sm">
              <Flame size={18} className="text-[#FFD166]" fill="currentColor" />
              <span className="text-lg font-black text-white">{streak}</span>
              <span className="text-xs font-semibold text-white/80">ngày liên tiếp</span>
            </div>
            <div className="shrink-0 text-4xl select-none hidden sm:block">🎯</div>
          </div>
        </div>
      </div>

      {/* ── Continue drafts */}
      <ContinueDraftCard />

      {/* ── 4 stat pills */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-[#EEEFFE] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText size={14} className="text-[#6C63FF]" />
            <span className="text-xs font-bold text-[#6C63FF]">Bài đã làm</span>
          </div>
          <p className="text-2xl font-black text-[#1A1740]">{totalSubmissions}</p>
        </div>
        <div className="bg-[#FFF8E1] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={14} className="text-[#D4A017]" />
            <span className="text-xs font-bold text-[#D4A017]">Điểm TB</span>
          </div>
          <p className={`text-2xl font-black ${scoreColor(avgScore)}`}>
            {avgScore > 0 ? avgScore.toFixed(1) : "—"}
          </p>
        </div>
        <div className="bg-[#E1F5EE] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen size={14} className="text-[#06D6A0]" />
            <span className="text-xs font-bold text-[#06D6A0]">Flashcard</span>
          </div>
          <p className="text-2xl font-black text-[#1A1740]">{allCards}</p>
        </div>
        <div className="bg-[#FFECEC] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Flame size={14} className="text-[#FF6B6B]" />
            <span className="text-xs font-bold text-[#FF6B6B]">Cần ôn</span>
          </div>
          <p className="text-2xl font-black text-[#1A1740]">{dueCards}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* ── Left column (2/3) */}
        <div className="lg:col-span-2 min-w-0 flex flex-col gap-5">

          {/* AI Study Coach */}
          <div className="bg-[#EEEFFE] border border-[#C7C4FC] rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#6C63FF] flex items-center justify-center shrink-0 shadow-sm">
                <Zap size={17} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-[#1A1740] mb-1">✨ AI Study Coach</p>
                {dueCards > 0 ? (
                  <p className="text-sm text-[#4A4870]">
                    Bạn có <strong className="text-[#6C63FF]">{dueCards} flashcard</strong> cần ôn hôm nay.
                    Chỉ mất khoảng {Math.round(dueCards * 0.5)} phút!
                  </p>
                ) : allCards === 0 ? (
                  <p className="text-sm text-[#4A4870]">
                    Chưa có flashcard nào. Hãy tạo flashcard để bắt đầu học hiệu quả hơn!
                  </p>
                ) : (
                  <p className="text-sm text-[#4A4870]">
                    🎉 Hôm nay bạn đã ôn xong tất cả flashcard! Thử làm một đề thi nhé.
                  </p>
                )}
                <div className="flex gap-2 mt-3 flex-wrap">
                  <Link href="/bang-dieu-khien/hoc-tap">
                    <Button size="sm" className="bg-[#6C63FF] text-white hover:bg-[#5A52E0]">
                      Ôn flashcard ngay
                    </Button>
                  </Link>
                  <Link href="/bang-dieu-khien/ai">
                    <Button size="sm" variant="ghost" className="text-[#6C63FF]">
                      Hỏi AI <Sparkles size={12} />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Recent exams */}
          <Card padding="none">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--surface-border)]">
              <h2 className="text-sm font-black text-[var(--text-primary)]">📋 Bài thi gần đây</h2>
              <Link href="/bang-dieu-khien/de-thi" className="text-xs text-[#6C63FF] font-bold flex items-center gap-1 hover:underline">
                Xem tất cả <ArrowRight size={12} />
              </Link>
            </div>
            {submissions.length === 0 ? (
              <EmptyState
                icon={<FileText />}
                title="Chưa có bài thi nào"
                description="Nhập mã join để tham gia đề thi"
                action={
                  <Link href="/vao-thi">
                    <Button size="sm">Vào thi bằng mã</Button>
                  </Link>
                }
              />
            ) : (
              <div className="divide-y divide-[var(--surface-border)]">
                {submissions.map((sub: SubType) => {
                  const c = getSubjectColor(sub.exam.subject);
                  const col = scoreBg(sub.score);
                  return (
                    <div key={sub.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[var(--gray-100)] transition-colors">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: c.bg }}
                      >
                        <FileText size={15} style={{ color: c.text }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{sub.exam.title}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {sub.exam.subject} · {new Date(sub.submittedAt).toLocaleDateString("vi-VN")}
                        </p>
                      </div>
                      <div
                        className="shrink-0 px-3 py-1 rounded-xl text-sm font-black"
                        style={{ background: col.bg, color: col.text }}
                      >
                        {sub.score}/10
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-3">
            <Link href="/vao-thi">
              <div className="bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-2xl p-4 flex items-center gap-3 hover:border-[#6C63FF]/40 hover:shadow-sm transition-all cursor-pointer h-full">
                <div className="w-10 h-10 rounded-xl bg-[#EEEFFE] flex items-center justify-center shrink-0">
                  <FileText size={18} className="text-[#6C63FF]" />
                </div>
                <div>
                  <p className="text-sm font-black text-[var(--text-primary)]">Vào thi</p>
                  <p className="text-xs text-[var(--text-muted)]">Nhập mã tham gia</p>
                </div>
              </div>
            </Link>
            <Link href="/bang-dieu-khien/hoc-tap">
              <div className="bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-2xl p-4 flex items-center gap-3 hover:border-[#06D6A0]/40 hover:shadow-sm transition-all cursor-pointer h-full">
                <div className="w-10 h-10 rounded-xl bg-[#E1F5EE] flex items-center justify-center shrink-0">
                  <BookOpen size={18} className="text-[#06D6A0]" />
                </div>
                <div>
                  <p className="text-sm font-black text-[var(--text-primary)]">Học tập</p>
                  <p className="text-xs text-[var(--text-muted)]">Flashcard & nhiệm vụ</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* ── Right column (1/3) */}
        <div className="flex flex-col gap-5 min-w-0">

          {/* Today's tasks */}
          <Card padding="none">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--surface-border)]">
              <h2 className="text-sm font-black text-[var(--text-primary)]">
                <CheckSquare size={14} className="inline mr-1.5 text-[#FFD166]" />
                Nhiệm vụ hôm nay
              </h2>
              <Link href="/bang-dieu-khien/hoc-tap">
                <Plus size={15} className="text-[#6C63FF]" />
              </Link>
            </div>
            {tasks.length === 0 ? (
              <EmptyState title="Không có việc chờ 🎉" className="py-8" />
            ) : (
              <div className="p-3 flex flex-col gap-1">
                {tasks.map((task: TaskType) => (
                  <div key={task.id} className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-[var(--gray-100)] transition-colors">
                    <div className="w-4 h-4 rounded-full border-2 border-[#C7C4FC] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{task.title}</p>
                      {task.dueDate && (
                        <p className="text-xs text-[var(--text-muted)]">
                          <Clock size={9} className="inline mr-0.5" />
                          {new Date(task.dueDate).toLocaleDateString("vi-VN")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Subject progress */}
          <Card padding="none">
            <div className="px-4 py-3.5 border-b border-[var(--surface-border)]">
              <h2 className="text-sm font-black text-[var(--text-primary)]">
                <Target size={14} className="inline mr-1.5 text-[#FF6B6B]" />
                Tiến độ môn học
              </h2>
            </div>
            {subjectProgress.length === 0 ? (
              <EmptyState
                title="Chưa có tiến độ"
                description="Cập nhật ở Góc học tập"
                className="py-8"
              />
            ) : (
              <div className="p-4 flex flex-col gap-3.5">
                {subjectProgress.map((p: ProgressType) => {
                  const c = getSubjectColor(p.subject);
                  return (
                    <div key={p.subject}>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-xs font-semibold text-[var(--text-secondary)]">{p.subject}</span>
                        <span className="text-xs font-black" style={{ color: c.text }}>{p.progress}%</span>
                      </div>
                      <div className="h-2 bg-[var(--gray-200)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${p.progress}%`, background: c.text }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── Teacher ─── */
async function TeacherDashboard({ userId, name }: { userId: string; name: string }) {
  const [exams, allSubmissions] = await Promise.all([
    prisma.exam.findMany({
      where: { teacherId: userId },
      include: {
        _count: { select: { questions: true, submissions: true } },
        submissions: { select: { score: true, submittedAt: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.submission.findMany({
      where: { exam: { teacherId: userId } },
      select: { score: true, submittedAt: true },
    }),
  ]);

  type SubType = typeof allSubmissions[0];
  type ExamType = typeof exams[0];

  const totalSubmissions = allSubmissions.length;
  const avgScore =
    totalSubmissions > 0
      ? allSubmissions.reduce((s: number, sub: SubType) => s + sub.score, 0) / totalSubmissions
      : 0;
  const activeExams = exams.filter((e: ExamType) => e.status === "published");
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const recentSubs = allSubmissions.filter(
    (s: SubType) => now - new Date(s.submittedAt).getTime() < 86400000,
  ).length;
  const noSubmissionExams = exams.filter((e: ExamType) => e._count.submissions === 0);

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto animate-fade-in">

      {/* ── Greeting banner */}
      <div className="rounded-3xl bg-gradient-to-r from-[#4EA8DE] via-[#6C63FF] to-[#8B83FF] p-6 mb-6 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 right-20 w-28 h-28 rounded-full bg-white/5" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-white/70 text-sm font-medium">{getGreeting()},</p>
            <h1 className="text-2xl font-black text-white mt-0.5">{name} 👨‍🏫</h1>
            <p className="text-white/80 text-sm mt-2">
              {recentSubs > 0
                ? `🔥 ${recentSubs} bài nộp hôm nay — lớp đang học tích cực!`
                : "Hôm nay lớp chưa có bài nộp mới."}
            </p>
          </div>
          <div className="shrink-0 text-5xl select-none hidden sm:block">📊</div>
        </div>
      </div>

      {/* ── Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-[#EEEFFE] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText size={14} className="text-[#6C63FF]" />
            <span className="text-xs font-bold text-[#6C63FF]">Đề thi</span>
          </div>
          <p className="text-2xl font-black text-[#1A1740]">{exams.length}</p>
        </div>
        <div className="bg-[#E8F4FD] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 size={14} className="text-[#4EA8DE]" />
            <span className="text-xs font-bold text-[#4EA8DE]">Bài nộp</span>
          </div>
          <p className="text-2xl font-black text-[#1A1740]">{totalSubmissions}</p>
          {recentSubs > 0 && <p className="text-xs text-[#06D6A0] font-bold">+{recentSubs} hôm nay</p>}
        </div>
        <div className="bg-[#FFF8E1] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={14} className="text-[#D4A017]" />
            <span className="text-xs font-bold text-[#D4A017]">Điểm TB</span>
          </div>
          <p className={`text-2xl font-black ${scoreColor(avgScore)}`}>
            {avgScore > 0 ? avgScore.toFixed(1) : "—"}
          </p>
        </div>
        <div className="bg-[#E1F5EE] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={14} className="text-[#06D6A0]" />
            <span className="text-xs font-bold text-[#06D6A0]">Đang mở</span>
          </div>
          <p className="text-2xl font-black text-[#1A1740]">{activeExams.length}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 min-w-0 flex flex-col gap-5">
          {/* Quick actions */}
          <div className="flex flex-wrap gap-3">
            <Link href="/bang-dieu-khien/tao-de-thi" className="flex-1 min-w-0">
              <Button className="w-full" icon={<Plus size={16} />}>Tạo đề thi mới</Button>
            </Link>
            <Link href="/bang-dieu-khien/thong-ke">
              <Button variant="outline" icon={<BarChart3 size={16} />}>Thống kê</Button>
            </Link>
          </div>

          {/* Exam list */}
          <Card padding="none">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--surface-border)]">
              <h2 className="text-sm font-black text-[var(--text-primary)]">📋 Đề thi đã tạo</h2>
              <Link href="/bang-dieu-khien/de-thi" className="text-xs text-[#6C63FF] font-bold flex items-center gap-1 hover:underline">
                Quản lý <ArrowRight size={12} />
              </Link>
            </div>
            {exams.length === 0 ? (
              <EmptyState
                icon={<FileText />}
                title="Chưa có đề thi nào"
                action={
                  <Link href="/bang-dieu-khien/tao-de-thi">
                    <Button size="sm" icon={<Plus size={14} />}>Tạo đề</Button>
                  </Link>
                }
              />
            ) : (
              <div className="divide-y divide-[var(--surface-border)]">
                {exams.slice(0, 6).map((exam: ExamType) => {
                  const c = getSubjectColor(exam.subject);
                  const examAvg =
                    exam.submissions.length > 0
                      ? exam.submissions.reduce((s: number, sub: { score: number }) => s + sub.score, 0) / exam.submissions.length
                      : null;
                  return (
                    <Link
                      key={exam.id}
                      href={`/bang-dieu-khien/de-thi/${exam.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-[var(--gray-100)] transition-colors"
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: c.bg }}
                      >
                        <FileText size={15} style={{ color: c.text }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{exam.title}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {exam.subject} · {exam._count.questions} câu · {exam._count.submissions} bài nộp
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {examAvg !== null && (
                          <span className={`text-xs font-black ${scoreColor(examAvg)}`}>
                            TB {examAvg.toFixed(1)}
                          </span>
                        )}
                        <span
                          className="px-2 py-0.5 rounded-lg text-xs font-mono font-black"
                          style={{ background: c.bg, color: c.text }}
                        >
                          {exam.joinCode}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right: Needs attention */}
        <div className="flex flex-col gap-5 min-w-0">
          <Card padding="none">
            <div className="px-4 py-3.5 border-b border-[var(--surface-border)]">
              <h2 className="text-sm font-black text-[var(--text-primary)]">
                <AlertCircle size={14} className="inline mr-1.5 text-[#FF6B6B]" />
                Cần chú ý
              </h2>
            </div>
            <div className="p-3 flex flex-col gap-2">
              {activeExams.length === 0 && noSubmissionExams.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-6">
                  ✅ Không có gì cần chú ý
                </p>
              ) : (
                <>
                  {activeExams.slice(0, 3).map((exam: ExamType) => (
                    <Link
                      key={exam.id}
                      href={`/bang-dieu-khien/de-thi/${exam.id}`}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#E1F5EE] hover:bg-[#C8EEE1] transition-colors"
                    >
                      <CheckCircle2 size={14} className="text-[#06D6A0] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#064E3B] truncate">{exam.title}</p>
                        <p className="text-xs text-[#06D6A0]">{exam._count.submissions} bài nộp</p>
                      </div>
                    </Link>
                  ))}
                  {noSubmissionExams.slice(0, 2).map((exam: ExamType) => (
                    <Link
                      key={exam.id}
                      href={`/bang-dieu-khien/de-thi/${exam.id}`}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#FFF8E1] hover:bg-[#FFE8A0] transition-colors"
                    >
                      <AlertCircle size={14} className="text-[#D4A017] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#78350F] truncate">{exam.title}</p>
                        <p className="text-xs text-[#D4A017]">Chưa có bài nộp</p>
                      </div>
                    </Link>
                  ))}
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── Mode switcher ─── */
function ModeSwitcher({ mode, role }: { mode: string; role: string }) {
  const cards = [
    {
      value: "student",
      label: "Học sinh",
      desc: "Học tập, ôn thi, theo dõi tiến độ",
      icon: <BookOpen size={20} />,
    },
    {
      value: "teacher",
      label: "Giáo viên",
      desc: "Tạo đề, quản lý lớp học, chấm điểm",
      icon: <GraduationCap size={20} />,
    },
    ...(role === "admin"
      ? [{
          value: "admin",
          label: "Quản trị",
          desc: "Quản trị hệ thống EduTest",
          icon: <ShieldCheck size={20} />,
        }]
      : []),
  ];

  return (
    <div className="mb-6">
      <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2.5">
        Chế độ làm việc
      </h2>
      <div className={cn("grid gap-3", cards.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2")}>
        {cards.map((card) => {
          const active = mode === card.value;
          return (
            <ModeSwitchButton
              key={card.value}
              mode={card.value as "student" | "teacher" | "admin"}
              redirectTo="/bang-dieu-khien"
              label={card.label}
              active={active}
              confirmMessage={`Bạn đang ở chế độ ${mode === "student" ? "Học sinh" : mode === "teacher" ? "Giáo viên" : "Quản trị"}. Chuyển sang chế độ ${card.label} ngay bây giờ?`}
              className={cn(
                "w-full text-left rounded-2xl border p-4 transition-all cursor-pointer",
                active
                  ? "border-[#6C63FF] bg-[#EEEFFE] shadow-sm ring-2 ring-[#6C63FF]/20"
                  : "border-[var(--surface-border)] bg-[var(--surface-card)] hover:border-[#6C63FF]/50 hover:shadow-sm",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                  active ? "bg-[#6C63FF] text-white" : "bg-[#EEEFFE] text-[#6C63FF]",
                )}>
                  {card.icon}
                </span>
                {active && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6C63FF] bg-white/70 dark:bg-white/10 rounded-full px-2 py-0.5">
                    <Check size={12} /> Đang dùng
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm font-black text-[var(--text-primary)]">{card.label}</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)] leading-relaxed">{card.desc}</p>
            </ModeSwitchButton>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── Page ─── */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/dang-nhap");

  const params = await searchParams;
  const mode = session.user.mode ?? (session.user.role === "admin" ? "admin" : session.user.role);
  if (mode === "admin") redirect("/admin");
  const isTeacher = mode === "teacher";
  const userId = session.user.id!;
  const name = session.user.name ?? "Bạn";

  return (
    <>
      {params.created && (
        <div className="mx-4 mt-4 lg:mx-8 lg:mt-6 rounded-2xl bg-[#E1F5EE] border border-[#A8E6D6] p-4 flex items-center gap-3 animate-bounce-in">
          <CheckCircle2 size={18} className="text-[#06D6A0] shrink-0" />
          <div>
            <p className="text-sm font-black text-[#064E3B]">🎉 Đã xuất bản đề thi!</p>
            <p className="text-xs text-[#06D6A0]">
              Mã tham gia:{" "}
              <span className="font-mono font-black tracking-widest">{params.created}</span>
            </p>
          </div>
        </div>
      )}
      <div className="p-4 lg:p-8 max-w-5xl mx-auto">
        <ModeSwitcher mode={mode} role={session.user.role} />
      </div>
      {isTeacher ? (
        <TeacherDashboard userId={userId} name={name} />
      ) : (
        <StudentDashboard userId={userId} name={name} />
      )}
    </>
  );
}
