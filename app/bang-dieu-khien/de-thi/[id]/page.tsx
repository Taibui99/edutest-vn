import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  ArrowLeft, Users, Clock, FileText,
  CheckCircle2, XCircle, BarChart3, Share2, QrCode,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { ExamActions } from "./exam-actions";
import { CopyJoinCode } from "./copy-join-code";
import { getSubjectColor } from "@/lib/subject";
import { isQuestionCorrect, isAutoGraded, type AnswerValue } from "@/lib/grading";
import { SubmissionsPanel, type SubRow, type SubQuestion } from "./submissions-panel";

export const metadata: Metadata = { title: "Chi tiết đề thi — EduTest" };

export default async function ExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/dang-nhap");
  if (session.user.role !== "teacher") redirect("/bang-dieu-khien");

  const { id } = await params;
  const exam = await prisma.exam.findFirst({
    where: { id, teacherId: session.user.id! },
    include: {
      questions: { orderBy: { order: "asc" } },
      submissions: {
        include: {
          student: { select: { id: true, name: true, email: true, grade: true } },
          guestParticipant: { select: { name: true, className: true } },
        },
        orderBy: { submittedAt: "desc" },
      },
    },
  });

  if (!exam) notFound();

  type Sub = typeof exam.submissions[0];
  const subs = exam.submissions;
  const avgScore = subs.length > 0
    ? subs.reduce((s: number, x: Sub) => s + x.score, 0) / subs.length
    : null;
  const highest = subs.length > 0 ? Math.max(...subs.map((s: Sub) => s.score)) : null;
  const passCount = subs.filter((s: Sub) => s.score >= 5).length;
  const c = getSubjectColor(exam.subject);

  const dist = [0, 0, 0, 0, 0];
  for (const s of subs as Sub[]) {
    if (s.score < 4) dist[0]++;
    else if (s.score < 6) dist[1]++;
    else if (s.score < 7) dist[2]++;
    else if (s.score < 8.5) dist[3]++;
    else dist[4]++;
  }
  const maxDist = Math.max(...dist, 1);

  const serializedSubs: SubRow[] = subs.map((s) => ({
    id: s.id,
    studentName: s.student?.name || s.guestParticipant?.name || "Khách",
    studentClass: s.guestParticipant?.className || s.student?.grade || "",
    score: s.score,
    correctCount: s.correctCount,
    totalQuestions: s.totalQuestions,
    durationSeconds: s.durationSeconds,
    submittedAt: s.submittedAt.toISOString(),
    answers: (s.answers as Record<string, AnswerValue>) || {},
  }));

  const serializedQuestions: SubQuestion[] = exam.questions.map((q) => ({
    id: q.id,
    type: q.type,
    text: q.text,
    options: q.options,
    answer: q.answer,
    grading: q.grading ?? undefined,
    order: q.order,
  }));

  const qStats = exam.questions.map((q) => {
    let attempted = 0;
    let correct = 0;
    for (const s of subs) {
      const sel = (s.answers as Record<string, AnswerValue>)[q.id];
      if (sel === undefined || sel === null) continue;
      attempted++;
      if (isQuestionCorrect({ type: q.type, answer: q.answer, grading: q.grading }, sel)) correct++;
    }
    return { question: q, attempted, correct, auto: isAutoGraded(q) };
  });
  const answeredAny = qStats.some((s) => s.attempted > 0);

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      <Link
        href="/bang-dieu-khien/de-thi"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--primary)] mb-5 transition-colors"
      >
        <ArrowLeft size={15} /> Danh sách đề thi
      </Link>

      <div className="rounded-2xl p-5 mb-4 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${c.text}CC, ${c.text}99)` }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="text-white/70 text-sm font-medium">{exam.subject}</span>
              <h1 className="text-2xl font-black text-white mt-0.5">{exam.title}</h1>
              {exam.description && (
                <p className="text-white/70 text-sm mt-1">{exam.description}</p>
              )}
            </div>
            <div className="shrink-0 flex flex-col items-end gap-2">
              <CopyJoinCode code={exam.joinCode} />
              <span className={`text-xs px-2 py-0.5 rounded-lg font-bold ${
                exam.status === "published" ? "bg-white/20 text-white" : "bg-black/20 text-white/70"
              }`}>
                {exam.status === "published" ? "Đang mở" : "Đã đóng"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-4 text-white/70 text-sm">
            <span className="flex items-center gap-1.5"><FileText size={13} /> {exam.questions.length} câu hỏi</span>
            <span className="flex items-center gap-1.5"><Clock size={13} /> {exam.durationMinutes} phút</span>
            <span className="flex items-center gap-1.5"><Users size={13} /> {subs.length} bài nộp</span>
          </div>
        </div>
      </div>

      <Card className="mb-6 overflow-hidden border-[var(--primary)]/15">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--primary-light)] text-[var(--primary)]">
              <QrCode size={22} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-[var(--text-primary)]">Chia sẻ đề cho học sinh</h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Gửi link hoặc QR để học sinh vào làm bài. Không cần nhớ mã truy cập.</p>
            </div>
          </div>
          <Link
            href={`/bang-dieu-khien/chia-se-de/${exam.joinCode}`}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 active:scale-[0.98]"
          >
            <Share2 size={17} />
            Chia sẻ đề
          </Link>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Bài nộp", value: subs.length, color: "bg-[#F1EDFD] dark:bg-[#2B2358] text-[#6C4CF1]" },
          { label: "Điểm TB", value: avgScore !== null ? avgScore.toFixed(1) : "—", color: "bg-[#FFF8E1] dark:bg-[#2B2410] text-[#D4A017]" },
          { label: "Điểm cao nhất", value: highest !== null ? highest.toFixed(1) : "—", color: "bg-[#E8F7F1] dark:bg-[#0A2A20] text-[#189A6C]" },
          { label: "Tỉ lệ đậu", value: subs.length > 0 ? `${Math.round((passCount / subs.length) * 100)}%` : "—", color: "bg-[#EAF3FC] dark:bg-[#0D2A3E] text-[#2F80D8]" },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-2xl p-4 ${color.split(" ").slice(0, 2).join(" ")}`}>
            <p className={`text-xs font-bold mb-1 ${color.split(" ").slice(-1)[0]}`}>{label}</p>
            <p className="text-2xl font-black text-[var(--text-primary)]">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 min-w-0">
          <SubmissionsPanel subs={serializedSubs} questions={serializedQuestions} />
        </div>

        <div className="flex flex-col gap-5 min-w-0">
          <Card>
            <h2 className="text-sm font-black text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <BarChart3 size={14} className="text-[var(--primary)]" /> Phân bố điểm
            </h2>
            {subs.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] text-center py-4">Chưa có dữ liệu</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {["< 4", "4–5.9", "6–6.9", "7–8.4", "≥ 8.5"].map((label, i) => (
                  <div key={label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-[var(--text-secondary)]">{label}</span>
                      <span className="text-xs font-black text-[var(--text-primary)]">{dist[i]}</span>
                    </div>
                    <div className="h-1.5 bg-[var(--gray-200)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(dist[i] / maxDist) * 100}%`,
                          background: ["#E14D4D","#FFD166","#189A6C","#2F80D8","#6C4CF1"][i]
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card padding="none">
            <div className="px-4 py-3.5 border-b border-[var(--surface-border)]">
              <h2 className="text-sm font-black text-[var(--text-primary)]">
                <BarChart3 size={13} className="inline mr-1.5 text-[var(--primary)]" />
                Phân tích câu hỏi
              </h2>
            </div>
            {!answeredAny ? (
              <p className="text-xs text-[var(--text-muted)] text-center py-8">Chưa có dữ liệu trả lời</p>
            ) : (
              <div className="divide-y divide-[var(--surface-border)] max-h-80 overflow-y-auto">
                {qStats.map(({ question, attempted, correct, auto }) => {
                  const pct = attempted > 0 ? Math.round((correct / attempted) * 100) : null;
                  return (
                    <div key={question.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                          <span className="font-black text-[var(--text-muted)] mr-1">Câu {question.order + 1}.</span>
                          {question.text}
                        </p>
                        {pct !== null && (
                          <span className={`shrink-0 text-xs font-black ${pct >= 70 ? "text-[#189A6C]" : pct >= 40 ? "text-[#D4A017]" : "text-[#E14D4D]"}`}>
                            {pct}%
                          </span>
                        )}
                      </div>
                      <div className="h-1.5 bg-[var(--gray-200)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct ?? 0}%`,
                            background: pct === null ? "#CBD5E1" : pct >= 70 ? "#189A6C" : pct >= 40 ? "#D4A017" : "#E14D4D",
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                        {attempted > 0 ? `${correct}/${attempted} đúng` : auto ? "Chưa ai trả lời" : "Tự luận"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {subs.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-[#E8F7F1] p-3 text-center dark:bg-[#0A2A20]">
                <CheckCircle2 size={16} className="text-[#189A6C] mx-auto mb-1" />
                <p className="text-lg font-black text-[var(--text-primary)]">{passCount}</p>
                <p className="text-xs text-[#189A6C] font-bold">Đậu (≥ 5)</p>
              </div>
              <div className="rounded-xl bg-[#FFECEC] p-3 text-center dark:bg-[#2B1616]">
                <XCircle size={16} className="text-[#E14D4D] mx-auto mb-1" />
                <p className="text-lg font-black text-[var(--text-primary)]">{subs.length - passCount}</p>
                <p className="text-xs text-[#E14D4D] font-bold">Rớt (&lt; 5)</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Card className="mt-2">
        <ExamActions examId={exam.id} currentStatus={exam.status} />
      </Card>
    </div>
  );
}
