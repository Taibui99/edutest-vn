import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { Logo } from "@/app/components/logo";
import { prisma } from "@/lib/prisma";
import { ExamDetailClient } from "./exam-detail-client";

export const metadata: Metadata = {
  title: "Chi tiết đề thi — EduTest",
};

export default async function ExamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/dang-nhap");
  if (session.user.role !== "teacher") redirect("/bang-dieu-khien");

  const { id } = await params;
  const exam = await prisma.exam.findFirst({
    where: { id, teacherId: session.user.id },
    include: {
      questions: { orderBy: { order: "asc" } },
      submissions: {
        include: { student: true },
        orderBy: { submittedAt: "desc" },
      },
    },
  });

  if (!exam) notFound();

  const averageScore =
    exam.submissions.length > 0
      ? (
          exam.submissions.reduce((sum, s) => sum + s.score, 0) / exam.submissions.length
        ).toFixed(1)
      : "0";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-blue-100 bg-white sticky top-0 z-10">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo />
          <Link href="/bang-dieu-khien" className="text-sm font-medium text-slate-500 hover:text-slate-800">
            ← Bảng điều khiển
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 p-8 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium opacity-80">
                {exam.subject} · {exam.durationMinutes} phút
              </p>
              <h1 className="mt-1 text-3xl font-bold">{exam.title}</h1>
              <p className="mt-2 text-sm opacity-80">
                {exam.questions.length} câu hỏi · {exam.submissions.length} bài nộp
              </p>
            </div>
            <div className="rounded-xl bg-white/15 px-5 py-3 text-center">
              <p className="text-xs opacity-80">Mã tham gia</p>
              <p className="text-2xl font-bold tracking-[0.2em]">{exam.joinCode}</p>
            </div>
          </div>
        </div>

        <ExamDetailClient examId={exam.id} status={exam.status} />

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800">Danh sách câu hỏi</h2>
            {exam.questions.map((question) => (
              <div key={question.id} className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-blue-600">Câu {question.order}</p>
                <h3 className="mt-1 font-semibold text-slate-900">{question.text}</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {question.options.map((option, index) => {
                    const letter = String.fromCharCode(65 + index);
                    const isCorrect = letter === question.answer.toUpperCase();
                    return (
                      <div
                        key={`${question.id}-${letter}`}
                        className={`rounded-lg border px-3 py-2 text-sm ${
                          isCorrect
                            ? "border-green-300 bg-green-50 text-green-800 font-semibold"
                            : "border-slate-200 bg-slate-50 text-slate-600"
                        }`}
                      >
                        {letter}. {option} {isCorrect && "✓"}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {exam.questions.length === 0 && (
              <div className="rounded-xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-500">
                Đề thi chưa có câu hỏi nào.
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-3">📊 Thống kê</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">{exam.submissions.length}</div>
                  <div className="text-xs text-slate-500 mt-1">Bài nộp</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">{averageScore}</div>
                  <div className="text-xs text-slate-500 mt-1">Điểm TB</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-3">🧑‍🎓 Bài nộp</h3>
              <div className="space-y-3">
                {exam.submissions.map((submission) => (
                  <div key={submission.id} className="rounded-lg bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-800">{submission.student.name}</p>
                      <span className="text-sm font-bold text-green-600">{submission.score}/10</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Đúng {submission.correctCount}/{submission.totalQuestions} câu ·{" "}
                      {submission.submittedAt.toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                ))}
                {exam.submissions.length === 0 && (
                  <div className="text-sm text-slate-500 text-center py-6">Chưa có học sinh nộp bài.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
