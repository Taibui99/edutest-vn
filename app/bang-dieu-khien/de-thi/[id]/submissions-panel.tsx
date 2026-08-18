"use client";

import { useMemo, useState } from "react";
import { Download, ChevronDown, ChevronRight, Trophy, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";
import { isQuestionCorrect, isAutoGraded, type AnswerValue } from "@/lib/grading";

export type SubRow = {
  id: string;
  studentName: string;
  studentClass: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  durationSeconds: number;
  submittedAt: string;
  answers: Record<string, AnswerValue>;
};

export type SubQuestion = {
  id: string;
  type: string;
  text: string;
  options: string[];
  answer: string;
  grading?: unknown;
  order: number;
};

type SortKey = "latest" | "scoreDesc" | "scoreAsc" | "fastest";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "latest", label: "Mới nhất" },
  { key: "scoreDesc", label: "Điểm cao → thấp" },
  { key: "scoreAsc", label: "Điểm thấp → cao" },
  { key: "fastest", label: "Nộp nhanh nhất" },
];

function scoreColor(score: number) {
  if (score >= 8) return { text: "#06D6A0", bg: "#E1F5EE" };
  if (score >= 6.5) return { text: "#D4A017", bg: "#FFF8E1" };
  return { text: "#F97316", bg: "#FFECEC" };
}

function renderAnswer(q: SubQuestion, selected: AnswerValue | undefined) {
  if (selected === undefined || selected === null) return null;
  if (q.type === "mcq" && typeof selected === "string") {
    const idx = selected.charCodeAt(0) - 65;
    return (
      <span>
        <strong>{selected}.</strong> {q.options[idx] ?? "—"}
      </span>
    );
  }
  if (q.type === "true_false") {
    const map = selected as Record<string, boolean>;
    return (
      <div className="flex flex-wrap gap-1.5">
        {Object.keys(map).sort((a, b) => Number(a) - Number(b)).map((k) => (
          <span key={k} className="rounded-md bg-[var(--gray-100)] px-2 py-0.5 text-xs">
            {String.fromCharCode(97 + Number(k))}) {map[k] ? "Đúng" : "Sai"}
          </span>
        ))}
      </div>
    );
  }
  if (q.type === "short_answer" && typeof selected === "string") return <span>“{selected}”</span>;
  if (q.type === "essay" && typeof selected === "string") {
    return selected.trim() ? <span className="whitespace-pre-wrap line-clamp-3">“{selected}”</span> : null;
  }
  return <span className="text-[var(--text-muted)]">(dữ liệu không khớp)</span>;
}

function renderCorrect(q: SubQuestion) {
  if (q.type === "mcq") {
    const idx = (q.answer || "A").charCodeAt(0) - 65;
    return (
      <span>
        <strong>{q.answer}.</strong> {q.options[idx] ?? "—"}
      </span>
    );
  }
  if (q.type === "true_false") {
    const statements = ((q.grading as { statements?: Array<{ answer?: boolean }> } | null)?.statements || []).map((s) => Boolean(s.answer));
    return (
      <div className="flex flex-wrap gap-1.5">
        {statements.map((val, i) => (
          <span key={i} className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
            {String.fromCharCode(97 + i)}) {val ? "Đúng" : "Sai"}
          </span>
        ))}
      </div>
    );
  }
  if (q.type === "short_answer") {
    const accepted = (q.grading as { acceptedAnswers?: string[] } | null)?.acceptedAnswers || [];
    return <span>{accepted.join(", ") || "—"}</span>;
  }
  return null;
}

function formatDur(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function SubmissionsPanel({ subs, questions }: { subs: SubRow[]; questions: SubQuestion[] }) {
  const [sort, setSort] = useState<SortKey>("latest");
  const [expanded, setExpanded] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const arr = [...subs];
    if (sort === "scoreDesc") arr.sort((a, b) => b.score - a.score);
    else if (sort === "scoreAsc") arr.sort((a, b) => a.score - b.score);
    else if (sort === "fastest") arr.sort((a, b) => a.durationSeconds - b.durationSeconds);
    else arr.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    return arr;
  }, [subs, sort]);

  const exportCsv = () => {
    const header = ["STT", "Tên", "Lớp", "Điểm", "Đúng", "Tổng câu", "Thời gian", "Ngày nộp"];
    const rows = sorted.map((s, i) => [
      i + 1,
      s.studentName,
      s.studentClass,
      s.score,
      s.correctCount,
      s.totalQuestions,
      formatDur(s.durationSeconds),
      new Date(s.submittedAt).toLocaleString("vi-VN"),
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ket-qua-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (subs.length === 0) {
    return (
      <Card padding="none">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--surface-border)]">
          <h2 className="text-sm font-black text-[var(--text-primary)]">Danh sách bài nộp</h2>
          <span className="text-xs text-[var(--text-muted)]">0 học sinh</span>
        </div>
        <EmptyState icon={<Users />} title="Chưa có bài nộp" description="Chia sẻ đề để học sinh tham gia" className="py-12" />
      </Card>
    );
  }

  return (
    <Card padding="none">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b border-[var(--surface-border)]">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-black text-[var(--text-primary)]">Danh sách bài nộp</h2>
          <span className="text-xs text-[var(--text-muted)]">{subs.length} học sinh</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-card)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] focus:outline-none focus:border-[var(--primary)]"
          >
            {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <button
            onClick={exportCsv}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--primary)]/20 bg-[var(--primary-light)] px-3 text-xs font-bold text-[var(--primary)] transition hover:opacity-80"
          >
            <Download size={13} /> Xuất CSV
          </button>
        </div>
      </div>

      <div className="divide-y divide-[var(--surface-border)]">
        {sorted.map((sub, i) => {
          const sc = scoreColor(sub.score);
          const open = expanded === sub.id;
          const badge = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
          return (
            <div key={sub.id}>
              <button
                type="button"
                onClick={() => setExpanded(open ? null : sub.id)}
                className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[var(--gray-100)] transition-colors text-left"
              >
                <span className="w-5 shrink-0 text-center text-xs font-black text-[var(--text-muted)]">
                  {badge ?? i + 1}
                </span>
                <div className="w-8 h-8 rounded-full bg-[var(--primary-light)] flex items-center justify-center shrink-0">
                  <span className="text-xs font-black text-[var(--primary)]">{sub.studentName.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate flex items-center gap-1.5">
                    {sub.studentName}
                    {sub.studentClass && <span className="text-[11px] font-medium text-[var(--text-muted)]">· {sub.studentClass}</span>}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {sub.correctCount}/{sub.totalQuestions} đúng · {formatDur(sub.durationSeconds)} phút
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-sm font-black px-3 py-1 rounded-xl" style={{ background: sc.bg, color: sc.text }}>
                    {sub.score}/10
                  </span>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {new Date(sub.submittedAt).toLocaleDateString("vi-VN")}
                  </p>
                </div>
                {open ? <ChevronDown size={16} className="shrink-0 text-[var(--text-muted)]" /> : <ChevronRight size={16} className="shrink-0 text-[var(--text-muted)]" />}
              </button>

              {open && (
                <div className="bg-[var(--gray-50)]/60 px-5 py-4 border-t border-[var(--surface-border)]">
                  <p className="mb-3 flex items-center gap-1.5 text-xs font-black text-[var(--text-primary)]">
                    <Trophy size={13} className="text-[#D4A017]" /> Chi tiết đáp án
                  </p>
                  <div className="flex flex-col gap-2.5">
                    {questions.map((q) => {
                      const selected = sub.answers[q.id];
                      const correct = isQuestionCorrect(q, selected);
                      const auto = isAutoGraded(q);
                      const answered = selected !== undefined && selected !== null;
                      const Icon = !answered ? MinusCircle : correct ? CheckCircle2 : XCircle;
                      const iconColor = !answered ? "#94A3B8" : correct ? "#06D6A0" : "#F97316";
                      return (
                        <div key={q.id} className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)] p-3">
                          <div className="flex items-start gap-2.5">
                            <Icon size={15} style={{ color: iconColor }} className="shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-[var(--text-primary)] leading-relaxed">
                                Câu {q.order + 1}. {q.text}
                              </p>
                              <div className="mt-1.5 text-xs text-[var(--text-secondary)]">
                                {answered ? (
                                  <>
                                    <span className="font-bold text-[var(--text-muted)]">Trả lời: </span>
                                    {renderAnswer(q, selected)}
                                  </>
                                ) : (
                                  <span className="text-[var(--text-muted)]">Chưa trả lời</span>
                                )}
                              </div>
                              {answered && !auto && (
                                <div className="mt-1 text-[11px] font-semibold text-amber-600">Tự luận — chờ chấm thủ công</div>
                              )}
                              {answered && auto && !correct && (
                                <div className="mt-1.5 text-xs">
                                  <span className="font-bold text-[var(--text-muted)]">Đáp án đúng: </span>
                                  {renderCorrect(q)}
                                </div>
                              )}
                            </div>
                            <span
                              className="shrink-0 text-[11px] font-black px-2 py-0.5 rounded-md"
                              style={{
                                background: !answered ? "#F1F5F9" : correct ? "#E1F5EE" : "#FFECEC",
                                color: !answered ? "#64748B" : correct ? "#06D6A0" : "#F97316",
                              }}
                            >
                              {!answered ? "Bỏ trống" : correct ? "Đúng" : "Sai"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}