"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Trophy, ArrowLeft, ArrowRight, Send, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Question = { id: string; text: string; options: string[]; order: number };
type Exam = {
  id: string;
  title: string;
  subject: string;
  durationMinutes: number;
  joinCode: string;
  isGuest: boolean;
  participantName?: string;
  participantClass?: string;
  questions: Question[];
};
type SubmissionResult = { score: number; correctCount: number; totalQuestions: number; durationSeconds: number };

function formatTime(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

function scoreColor(score: number) {
  if (score >= 8) return "#16A34A";
  if (score >= 5) return "#D97706";
  return "#DC2626";
}

export function ExamTakingClient({ exam, preview = false }: { exam: Exam; preview?: boolean }) {
  const router = useRouter();
  const isPreview = preview;
  const totalSeconds = exam.durationMinutes * 60;
  const [remaining, setRemaining] = useState(totalSeconds);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const answeredCount = Object.keys(answers).length;
  const question = exam.questions[current];

  const submitExam = useCallback(async (auto = false) => {
    if (isPreview || submitting || result) return;
    if (!auto && answeredCount < exam.questions.length && !showConfirm) {
      setShowConfirm(true);
      return;
    }
    setSubmitting(true);
    setShowConfirm(false);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId: exam.id, answers, durationSeconds: totalSeconds - remaining }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể nộp bài");
      if (data.resultLink) {
        router.push(data.resultLink);
        return;
      }
      setResult({ ...data.submission, durationSeconds: totalSeconds - remaining });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Không thể nộp bài");
      setSubmitting(false);
    }
  }, [answers, answeredCount, exam.id, exam.questions.length, isPreview, remaining, result, router, showConfirm, submitting, totalSeconds]);

  useEffect(() => {
    if (result || isPreview) return;
    const t = setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) { clearInterval(t); void submitExam(true); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [isPreview, result, submitExam]);

  if (result) {
    const pct = (result.score / 10) * 100;
    const col = scoreColor(result.score);
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 max-w-md w-full text-center animate-fade-in">
          <div className="w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center" style={{ background: `${col}15` }}>
            <Trophy size={36} style={{ color: col }} />
          </div>
          {exam.isGuest && <p className="text-xs font-semibold text-[#64748B] mb-2">{exam.participantName} · {exam.participantClass}</p>}
          <h1 className="text-3xl font-bold mb-1" style={{ color: col }}>{result.score}/10</h1>
          <p className="text-[#64748B] text-sm mb-5">Đúng {result.correctCount}/{result.totalQuestions} câu · Thời gian {formatTime(result.durationSeconds)}</p>
          <div className="h-3 bg-[#F1F5F9] rounded-full mb-6 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: col }} /></div>
          <p className="text-sm text-[#64748B] mb-6">{result.score >= 8 ? "Xuất sắc! Bạn đã làm rất tốt 🎉" : result.score >= 5 ? "Khá tốt! Tiếp tục cố gắng nhé 💪" : "Đừng nản! Ôn lại và thử lần sau 📚"}</p>
          {exam.isGuest ? <p className="text-xs text-[#94A3B8]">Kết quả đã được ghi nhận cho bài thi này. Bạn có thể đóng trang.</p> : <Button className="w-full" onClick={() => router.push("/bang-dieu-khien")}>Về trang chủ</Button>}
        </div>
      </div>
    );
  }

  const isLow = remaining <= 60;
  const progress = exam.questions.length ? (answeredCount / exam.questions.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <header className="bg-white border-b border-[#E2E8F0] px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3 min-w-0">
          <div className="font-bold text-[#2563EB] text-base shrink-0">EduTest</div>
          <div className="h-4 w-px bg-[#E2E8F0] shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#0F172A] truncate">{exam.title}</p>
            {exam.isGuest && <p className="text-[11px] text-[#64748B] truncate">{exam.participantName} · {exam.participantClass}</p>}
            {isPreview && <p className="text-[11px] font-semibold text-[#7C3AED] flex items-center gap-1"><Eye size={11} /> Chế độ xem trước</p>}
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className={cn("flex items-center gap-1.5 font-mono font-bold text-sm", isLow && !isPreview ? "text-[#DC2626]" : "text-[#0F172A]")}>
            <Clock size={15} className={isLow && !isPreview ? "text-[#DC2626] animate-pulse" : "text-[#94A3B8]"} />
            {isPreview ? "XEM TRƯỚC" : formatTime(remaining)}
          </div>
          <div className="text-xs text-[#64748B] hidden sm:block">{answeredCount}/{exam.questions.length} câu</div>
        </div>
      </header>

      {isPreview && (
        <div className="bg-[#F3E8FF] border-b border-[#E9D5FF] px-4 py-2.5 text-center text-xs font-semibold text-[#7E22CE]">
          Bạn đang xem giao diện học sinh. Mọi lựa chọn chỉ để thử nghiệm và sẽ không được nộp.
        </div>
      )}

      <div className="h-1 bg-[#F1F5F9]"><div className="h-full bg-[#2563EB] transition-all" style={{ width: `${progress}%` }} /></div>

      <div className="flex-1 flex flex-col lg:flex-row max-w-5xl mx-auto w-full p-4 gap-5 pt-6">
        <div className="flex-1">
          {question ? (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 mb-4 animate-fade-in" key={question.id}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-semibold text-white bg-[#2563EB] px-2.5 py-1 rounded-md">Câu {question.order}/{exam.questions.length}</span>
                {answers[question.id] && <span className="text-xs font-semibold text-[#16A34A] bg-[#F0FDF4] px-2 py-1 rounded-md flex items-center gap-1"><CheckCircle2 size={11} /> Đã chọn</span>}
              </div>
              <p className="text-base font-medium text-[#0F172A] leading-relaxed mb-5">{question.text}</p>
              <div className="flex flex-col gap-2">
                {question.options.map((option, idx) => {
                  const letter = String.fromCharCode(65 + idx);
                  const selected = answers[question.id] === letter;
                  return <button key={`${question.id}-${letter}`} onClick={() => setAnswers((a) => ({ ...a, [question.id]: letter }))} className={cn("flex items-center gap-3 rounded-xl border p-4 text-left text-sm transition-all", selected ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8] font-medium" : "border-[#E2E8F0] bg-white text-[#334155] hover:border-[#2563EB]/40 hover:bg-[#F8FAFC]")}><span className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all", selected ? "bg-[#2563EB] text-white" : "bg-[#F1F5F9] text-[#64748B]")}>{letter}</span>{option}</button>;
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-8 text-center text-sm text-[#64748B]">Đề thi chưa có câu hỏi.</div>
          )}

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0} icon={<ArrowLeft size={16} />}>Trước</Button>
            {current < exam.questions.length - 1 ? <Button onClick={() => setCurrent((c) => c + 1)}>Tiếp <ArrowRight size={16} /></Button> : <Button onClick={() => submitExam(false)} loading={submitting} disabled={isPreview || exam.questions.length === 0} icon={isPreview ? <Eye size={16} /> : <Send size={16} />}>{isPreview ? "Xem trước · không nộp" : "Nộp bài"}</Button>}
          </div>
        </div>

        <aside className="lg:w-56 lg:shrink-0">
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 lg:sticky lg:top-24">
            <p className="text-xs font-semibold text-[#94A3B8] mb-3">ĐIỀU HƯỚNG CÂU HỎI</p>
            <div className="grid grid-cols-5 lg:grid-cols-4 gap-1.5 mb-4">
              {exam.questions.map((q, i) => { const answered = !!answers[q.id]; const isCurrent = current === i; return <button key={q.id} onClick={() => setCurrent(i)} className={cn("w-full aspect-square rounded-lg text-xs font-semibold transition-all", isCurrent ? "bg-[#2563EB] text-white ring-2 ring-[#2563EB]/30" : answered ? "bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]" : "bg-[#F8FAFC] text-[#94A3B8] border border-[#E2E8F0] hover:border-[#2563EB]/40")}>{i + 1}</button>; })}
            </div>
            <div className="flex flex-col gap-1 text-xs mb-4">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-[#2563EB]" /><span className="text-[#64748B]">Đang làm</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-[#F0FDF4] border border-[#BBF7D0]" /><span className="text-[#64748B]">Đã trả lời</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-[#F8FAFC] border border-[#E2E8F0]" /><span className="text-[#64748B]">Chưa trả lời</span></div>
            </div>
            <Button onClick={() => submitExam(false)} loading={submitting} disabled={isPreview || exam.questions.length === 0} className="w-full" size="sm">{isPreview ? "Chế độ xem trước" : "Nộp bài"}</Button>
          </div>
        </aside>
      </div>

      {showConfirm && !isPreview && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full animate-fade-in">
            <h3 className="text-base font-bold text-[#0F172A] mb-2">Xác nhận nộp bài?</h3>
            <p className="text-sm text-[#64748B] mb-5">Bạn còn <strong>{exam.questions.length - answeredCount} câu</strong> chưa trả lời. Vẫn nộp bài?</p>
            <div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)}>Làm tiếp</Button><Button className="flex-1" onClick={() => submitExam(true)} loading={submitting}>Nộp bài</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
