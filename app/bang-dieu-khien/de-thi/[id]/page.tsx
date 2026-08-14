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
import { EmptyState } from "@/components/ui/empty-state";
import { getSubjectColor } from "@/lib/subject";

export const metadata: Metadata = { title: "Chi tiết đề thi — EduTest" };

function scoreColor(score: number) {
  if (score >= 8) return { text: "#06D6A0", bg: "#E1F5EE" };
  if (score >= 6.5) return { text: "#D4A017", bg: "#FFF8E1" };
  return { text: "#FF6B6B", bg: "#FFECEC" };
}

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
        include: { student: { select: { id: true, name: true, email: true } } },
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
          { label: "Bài nộp", value: subs.length, color: "bg-[#EEEFFE] text-[#6C63FF]" },
          { label: "Điểm TB", value: avgScore !== null ? avgScore.toFixed(1) : "—", color: "bg-[#FFF8E1] text-[#D4A017]" },
          { label: "Điểm cao nhất", value: highest !== null ? highest.toFixed(1) : "—", color: "bg-[#E1F5EE] text-[#06D6A0]" },
          { label: "Tỉ lệ đậu", value: subs.length > 0 ? `${Math.round((passCount / subs.length) * 100)}%` : "—", color: "bg-[#E8F4FD] text-[#4EA8DE]" },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-2xl p-4 ${color.split(" ")[0]}`}>
            <p className={`text-xs font-bold mb-1 ${color.split(" ")[1]}`}>{label}</p>
            <p className="text-2xl font-black text-[var(--text-primary)]">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 min-w-0">
          <Card padding="none">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--surface-border)]">
              <h2 className="text-sm font-black text-[var(--text-primary)]">Danh sách bài nộp</h2>
              <span className="text-xs text-[var(--text-muted)]">{subs.length} học sinh</span>
            </div>
            {subs.length === 0 ? (
              <EmptyState
                icon={<Users />}
                title="Chưa có bài nộp"
                description="Chia sẻ đề để học sinh tham gia"
                className="py-12"
              />
            ) : (
              <div className="divide-y divide-[var(--surface-border)]">
                {subs.map((sub: Sub, i: number) => {
                  const sc = scoreColor(sub.score);
                  const mins = Math.floor(sub.durationSeconds / 60);
                  const secs = sub.durationSeconds % 60;
                  return (
                    <div key={sub.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[var(--gray-100)] transition-colors">
                      <span className="text-xs font-bold text-[var(--text-muted)] w-5 shrink-0">{i + 1}</span>
                      <div className="w-8 h-8 rounded-full bg-[var(--primary-light)] flex items-center justify-center shrink-0">
                        <span className="text-xs font-black text-[var(--primary)]">
                          {sub.student.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{sub.student.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {sub.correctCount}/{sub.totalQuestions} đúng · {mins}:{String(secs).padStart(2, "0")} phút
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className="text-sm font-black px-3 py-1 rounded-xl"
                          style={{ background: sc.bg, color: sc.text }}
                        >
                          {sub.score}/10
                        </span>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          {new Date(sub.submittedAt).toLocaleDateString("vi-VN")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
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
                          background: ["#FF6B6B","#FFD166","#06D6A0","#4EA8DE","#6C63FF"][i]
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
                <FileText size={13} className="inline mr-1.5 text-[var(--primary)]" />
                Câu hỏi ({exam.questions.length})
              </h2>
            </div>
            <div className="divide-y divide-[var(--surface-border)] max-h-64 overflow-y-auto">
              {exam.questions.map((q: { id: string; text: string; order: number }, i: number) => (
                <div key={q.id} className="flex items-start gap-2.5 px-4 py-2.5">
                  <span className="text-xs font-black text-[var(--text-muted)] mt-0.5 shrink-0">{i + 1}</span>
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{q.text}</p>
                </div>
              ))}
            </div>
          </Card>

          {subs.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-[#E1F5EE] p-3 text-center">
                <CheckCircle2 size={16} className="text-[#06D6A0] mx-auto mb-1" />
                <p className="text-lg font-black text-[var(--text-primary)]">{passCount}</p>
                <p className="text-xs text-[#06D6A0] font-bold">Đậu (≥ 5)</p>
              </div>
              <div className="rounded-xl bg-[#FFECEC] p-3 text-center">
                <XCircle size={16} className="text-[#FF6B6B] mx-auto mb-1" />
                <p className="text-lg font-black text-[var(--text-primary)]">{subs.length - passCount}</p>
                <p className="text-xs text-[#FF6B6B] font-bold">Rớt (&lt; 5)</p>
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
