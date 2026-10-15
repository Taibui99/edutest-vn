"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  CheckCircle2, XCircle, Clock, Trophy, ArrowLeft,
  ChevronDown, ChevronUp, BookOpen, BarChart3, PenLine, Hourglass,
  MinusCircle, EyeOff
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getSubjectColor } from "@/lib/subject";
import { isQuestionCorrect, type AnswerValue } from "@/lib/grading";

interface Question {
  id: string;
  type: string;
  text: string;
  options: string[];
  answer: string;
  grading?: {
    statements?: { text: string; answer: boolean }[];
    acceptedAnswers?: string[];
  } | null;
  explanation?: string;
  order: number;
}

/* Đúng/sai từng câu theo đúng luật chấm của server (lib/grading).
 * Trả null khi không thể tự kết luận (tự luận GV chấm tay, thiếu đáp án chuẩn). */
function correctness(q: Question, ua: AnswerValue | undefined): boolean | null {
  if (q.type === "essay") return null;
  if (q.type === "true_false" && !(q.grading?.statements ?? []).length) return null;
  if (q.type === "short_answer" && !(q.grading?.acceptedAnswers ?? []).length) return null;
  return isQuestionCorrect({ type: q.type, answer: q.answer, grading: q.grading }, ua);
}

interface Submission {
  id: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  durationSeconds: number;
  submittedAt: string;
  answers: Record<string, AnswerValue>;
  attemptsUsed?: number | null;
  exam: {
    id: string;
    title: string;
    subject: string;
    showAnswers: boolean;
    showScoreImmediately: boolean;
    maxAttempts: number;
    teacher: { name: string };
    questions: Question[];
  };
  student: { id: string; name: string };
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 8 ? "var(--success)" : score >= 6.5 ? "var(--warning)" : "var(--danger)";
  const grade = score >= 8.5 ? "Xuất sắc" : score >= 7 ? "Khá" : score >= 5 ? "Trung bình" : "Yếu";
  const C = 2 * Math.PI * 50;

  /* Đếm số chạy lên + vòng quét theo (ease-out ~1.2s). Người bật
   * prefers-reduced-motion thấy số cuối ngay (CSS toàn cục cũng tắt animation).
   *
   * SSR an toàn: KHÔNG đọc `matchMedia` lúc render (server luôn 0, client lại là
   * `score` khi bật reduced-motion → lệch hydration). Khởi tạo 0, quyết định trong
   * effect. Effect chạy đúng 1 lần/instance: ScoreGauge được key theo submission
   * nên score không đổi giữa chừng (deps [] là đúng). */
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      if (reduce || score === 0) {
        setShown(score);
        return;
      }
      const p = Math.min(1, (t - t0) / 1200);
      setShown(score * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const done = shown >= score;

  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--gray-200)" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="50" fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={`${C}`}
            strokeDashoffset={`${C * (1 - shown / 10)}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black tabular-nums tracking-tight" style={{ color }}>
            {done ? score : shown.toFixed(1)}
          </span>
          <span className="text-xs text-[var(--text-muted)] font-semibold">/10</span>
        </div>
      </div>
      <span className="text-sm font-black px-3 py-1 rounded-full" style={{ background: `color-mix(in srgb, ${color} 13%, transparent)`, color }}>
        {grade}
      </span>
    </div>
  );
}

export default function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [sub, setSub] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    fetch(`/api/submissions/${id}`)
      .then((r) => r.json())
      .then(setSub)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center py-32"><Spinner /></div>
  );
  if (!sub) return (
    <div className="p-8 text-center text-[var(--text-muted)]">Không tìm thấy kết quả.</div>
  );

  const { exam, answers } = sub;
  const c = getSubjectColor(exam.subject);
  const mins = Math.floor(sub.durationSeconds / 60);
  const secs = sub.durationSeconds % 60;
  const wrongQuestions = exam.questions.filter((q) => correctness(q, answers[q.id]) === false);

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto animate-fade-in">
      <Link
        href="/bang-dieu-khien/de-thi"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--primary)] mb-5 transition-colors"
      >
        <ArrowLeft size={15} /> Quay lại
      </Link>

      {/* Result card */}
      <Card className="mb-5 text-center">
        <div className="px-4 py-2 rounded-xl inline-block mb-4" style={{ background: c.bg }}>
          <span className="text-sm font-bold" style={{ color: c.text }}>{exam.subject}</span>
        </div>
        <h1 className="text-lg font-black text-[var(--text-primary)] mb-1">{exam.title}</h1>
        <p className="text-sm text-[var(--text-muted)] mb-4">GV: {exam.teacher.name}</p>

        {exam.showScoreImmediately === false ? (
          <div className="rounded-2xl bg-[var(--warning-light)] border border-[var(--warning-light)] p-5">
            <Hourglass size={32} className="mx-auto mb-2 text-[var(--warning)]" />
            <p className="font-black tracking-tight text-[var(--text-primary)] mb-1">Đã nộp bài thành công</p>
            <p className="text-sm text-[var(--text-muted)]">Giáo viên sẽ công bố điểm sau khi chấm bài.</p>
          </div>
        ) : (
          <ScoreGauge key={sub.id} score={sub.score} />
        )}

        <div className="grid grid-cols-3 gap-3 mt-2">
          <div className="rounded-xl bg-[var(--success-light)] p-3 dark:bg-[var(--gray-900)]">
            <CheckCircle2 size={16} className="text-[var(--success)] mx-auto mb-1" />
            <p className="text-lg font-black text-[var(--text-primary)]">{sub.correctCount}</p>
            <p className="text-xs text-[var(--success)] font-bold">Đúng</p>
          </div>
          <div className="rounded-xl bg-[var(--danger-light)] p-3 dark:bg-[var(--gray-900)]">
            <XCircle size={16} className="text-[var(--danger)] mx-auto mb-1" />
            <p className="text-lg font-black text-[var(--text-primary)]">{sub.totalQuestions - sub.correctCount}</p>
            <p className="text-xs text-[var(--danger)] font-bold">Sai</p>
          </div>
          <div className="rounded-xl bg-[var(--gray-100)] p-3">
            <Clock size={16} className="text-[var(--text-muted)] mx-auto mb-1" />
            <p className="text-lg font-black text-[var(--text-primary)]">{mins}:{String(secs).padStart(2, "0")}</p>
            <p className="text-xs text-[var(--text-muted)] font-bold">Phút</p>
          </div>
        </div>

        {typeof sub.attemptsUsed === "number" && (
          <p className={`text-xs font-bold mt-4 px-3 py-2 rounded-xl ${sub.exam.maxAttempts > 0 && sub.attemptsUsed >= sub.exam.maxAttempts ? "bg-[var(--warning-light)] text-[var(--warning)]" : "bg-[var(--primary-light)] text-[var(--primary)]"}`}>
            {sub.exam.maxAttempts <= 0
              ? `Đề này cho làm lại không giới hạn (đã dùng ${sub.attemptsUsed} lượt) — bấm Thi tiếp để làm lại`
              : sub.attemptsUsed >= sub.exam.maxAttempts
                ? `Đã hết ${sub.exam.maxAttempts} lượt làm bài của đề này`
                : `Còn ${sub.exam.maxAttempts - sub.attemptsUsed} lượt làm bài (đã dùng ${sub.attemptsUsed}/${sub.exam.maxAttempts}) — bấm Thi tiếp để làm lại`}
          </p>
        )}
        <p className="text-xs text-[var(--text-muted)] mt-4">
          Nộp lúc {new Date(sub.submittedAt).toLocaleString("vi-VN")}
        </p>
      </Card>

      {/* Strengths/weaknesses */}
      {wrongQuestions.length === 0 ? (
        <div className="rounded-2xl bg-[var(--success-light)] border border-[var(--success-border)] p-4 mb-5 flex items-center gap-3">
          <Trophy size={20} className="text-[var(--success)] shrink-0" />
          <div>
            <p className="font-black text-[var(--success-dark)]">Hoàn hảo! Bạn trả lời đúng tất cả câu!</p>
            <p className="text-sm text-[var(--success)] mt-0.5">Tiếp tục duy trì phong độ nhé.</p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-[var(--warning-light)] border border-[var(--warning)]/50 p-4 mb-5">
          <p className="font-black text-[var(--warning-dark)] mb-2 flex items-center gap-1.5">
            <PenLine size={14} /> Bạn sai {wrongQuestions.length} câu — cần ôn lại:
          </p>
          <div className="flex flex-wrap gap-2">
            {wrongQuestions.slice(0, 6).map((q) => (
              <span key={q.id} className="text-xs bg-[var(--surface-card)] border border-[var(--warning)] text-[var(--warning)] px-2 py-1 rounded-lg font-semibold">
                Câu {q.order}
              </span>
            ))}
            {wrongQuestions.length > 6 && (
              <span className="text-xs text-[var(--warning)]">+{wrongQuestions.length - 6} câu nữa</span>
            )}
          </div>
        </div>
      )}

      {/* Review đáp án theo từng loại câu (trước chỉ vẽ được trắc nghiệm).
          Quyền của giáo viên vẫn giữ: tắt showAnswers thì chỉ hiện lời nhắn. */}
      {!exam.showAnswers && (
        <Card>
          <div className="flex items-center gap-3 p-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--primary-light)] text-[var(--primary)]">
              <EyeOff size={18} />
            </span>
            <div>
              <p className="text-sm font-black text-[var(--text-primary)]">Chưa mở xem đáp án</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">Giáo viên chưa bật xem đáp án cho đề này — điểm và thống kê ở trên vẫn đầy đủ.</p>
            </div>
          </div>
        </Card>
      )}
      {exam.showAnswers && (
        <Card padding="none">
          <button
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--gray-100)] transition-colors"
            onClick={() => setShowReview((s) => !s)}
          >
            <span className="text-sm font-black text-[var(--text-primary)] flex items-center gap-2">
              <BookOpen size={15} className="text-[var(--primary)]" />
              Xem lại đáp án
            </span>
            {showReview ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {showReview && (
            <div className="divide-y divide-[var(--surface-border)]">
              {exam.questions.map((q) => {
                const userAnswer = answers[q.id];
                const mark = correctness(q, userAnswer);
                const isCorrect = mark === true;
                return (
                  <div key={q.id} className="p-5">
                    <div className="flex items-start gap-2 mb-3">
                      <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                        mark === null ? "bg-[var(--gray-200)]" :
                        isCorrect ? "bg-[var(--success-light)]" : "bg-[var(--danger-light)]"
                      }`}>
                        {mark === null
                          ? <MinusCircle size={13} className="text-[var(--text-muted)]" />
                          : isCorrect
                            ? <CheckCircle2 size={13} className="text-[var(--success)]" />
                            : <XCircle size={13} className="text-[var(--danger)]" />
                        }
                      </span>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        <span className="text-[var(--text-muted)] font-normal mr-1">Câu {q.order}.</span>
                        {q.text}
                      </p>
                    </div>

                    {q.type === "mcq" && (
                    <div className="flex flex-col gap-1.5 pl-7">
                      {q.options.map((opt, i) => {
                        const letter = String.fromCharCode(65 + i);
                        const isUserPick = userAnswer === letter;
                        const isCorrectAnswer = q.answer === letter;
                        return (
                          <div
                            key={letter}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                              isCorrectAnswer ? "bg-[var(--success-light)] text-[var(--success-dark)] font-semibold" :
                              isUserPick && !isCorrect ? "bg-[var(--danger-light)] text-[var(--danger-dark)]" :
                              "text-[var(--text-secondary)]"
                            }`}
                          >
                            <span className={`w-5 h-5 rounded-full text-xs font-black flex items-center justify-center shrink-0 ${
                              isCorrectAnswer ? "bg-[var(--success)] text-white" :
                              isUserPick && !isCorrect ? "bg-[var(--danger)] text-white" :
                              "bg-[var(--gray-200)] text-[var(--text-muted)]"
                            }`}>
                              {letter}
                            </span>
                            {opt}
                            {isCorrectAnswer && <CheckCircle2 size={13} className="ml-auto text-[var(--success)]" />}
                          </div>
                        );
                      })}
                    </div>
                    )}

                    {q.type === "true_false" && (
                    <div className="flex flex-col gap-1.5 pl-7">
                      {(q.grading?.statements ?? []).map((s, si) => {
                        const pick = typeof userAnswer === "object" && userAnswer !== null
                          ? (userAnswer as Record<string, unknown>)[String(si)]
                          : undefined;
                        const ok = pick === s.answer;
                        return (
                          <div
                            key={si}
                            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm ${
                              ok ? "bg-[var(--success-light)] text-[var(--success-dark)]" :
                              pick === undefined ? "text-[var(--text-secondary)]" :
                              "bg-[var(--danger-light)] text-[var(--danger-dark)]"
                            }`}
                          >
                            <span className="font-medium">{String.fromCharCode(97 + si)}. {s.text}</span>
                            <span className="shrink-0 text-xs font-black">
                              Bạn: {pick === true ? "Đúng" : pick === false ? "Sai" : "—"} · Chuẩn: {s.answer ? "Đúng" : "Sai"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    )}

                    {(q.type === "short_answer" || q.type === "essay") && (
                    <div className="flex flex-col gap-1.5 pl-7">
                      <div className="px-3 py-2 rounded-lg text-sm bg-[var(--surface-bg)] border border-[var(--surface-border)] text-[var(--text-primary)]">
                        <span className="text-xs font-bold text-[var(--text-muted)]">Bạn trả lời: </span>
                        {String(userAnswer ?? "").trim() || <span className="text-[var(--text-muted)]">— bỏ trống —</span>}
                      </div>
                      {q.type === "short_answer" && (q.grading?.acceptedAnswers ?? []).length > 0 && (
                        <div className="px-3 py-2 rounded-lg text-sm bg-[var(--success-light)] text-[var(--success-dark)]">
                          <span className="text-xs font-bold">Đáp án chấp nhận: </span>
                          {(q.grading?.acceptedAnswers ?? []).join(" · ")}
                        </div>
                      )}
                      {q.type === "essay" && (
                        <p className="text-xs text-[var(--warning)]">Câu tự luận do giáo viên chấm thủ công.</p>
                      )}
                    </div>
                    )}

                    {q.explanation && (
                      <div className="mt-3 pl-7 flex gap-2 p-3 bg-[var(--primary-light)] rounded-xl">
                        <BarChart3 size={13} className="text-[var(--primary)] shrink-0 mt-0.5" />
                        <p className="text-xs text-[var(--text-secondary)]">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      <div className="flex gap-3 mt-6">
        <Link href="/bang-dieu-khien" className="flex-1">
          <Button variant="outline" className="w-full">Về Dashboard</Button>
        </Link>
        <Link href="/vao-thi" className="flex-1">
          <Button className="w-full">Thi tiếp</Button>
        </Link>
      </div>
    </div>
  );
}
