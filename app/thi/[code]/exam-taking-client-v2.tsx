"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Eye, Send, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Question = {
  id: string;
  type: "mcq" | "true_false" | "short_answer" | "essay" | string;
  text: string;
  options: string[];
  answer: string;
  grading?: { statements?: Array<{ text: string; answer: boolean }>; acceptedAnswers?: string[] } | null;
  order: number;
};

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

type AnswerValue = string | Record<string, boolean>;

function formatTime(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

function scoreColor(score: number) {
  if (score >= 8) return "#16A34A";
  if (score >= 5) return "#D97706";
  return "#DC2626";
}

export function ExamTakingClientV2({ exam, preview = false, backHref }: { exam: Exam; preview?: boolean; backHref: string }) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(exam.durationMinutes * 60);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [current, setCurrent] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const question = exam.questions[current];
  const answeredCount = Object.keys(answers).length;
  const totalQuestions = exam.questions.length;

  const submitExam = useCallback(async (auto = false) => {
    if (preview || submitting || result) return;
    if (!auto && answeredCount < totalQuestions && !showConfirm) {
      setShowConfirm(true);
      return;
    }
    setSubmitting(true);
    setShowConfirm(false);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId: exam.id, answers, durationSeconds: exam.durationMinutes * 60 - remaining }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể nộp bài");
      if (data.resultLink) {
        router.push(data.resultLink);
        return;
      }
      setResult({ ...data.submission, durationSeconds: exam.durationMinutes * 60 - remaining });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Không thể nộp bài");
      setSubmitting(false);
    }
  }, [answers, answeredCount, exam.durationMinutes, exam.id, preview, remaining, result, router, showConfirm, submitting, totalQuestions]);

  useEffect(() => {
    if (preview || result) return;
    const timer = window.setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) {
          window.clearInterval(timer);
          void submitExam(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [preview, result, submitExam]);

  const leaveExam = () => router.push(backHref);

  const setMcqAnswer = (letter: string) => setAnswers((prev) => ({ ...prev, [question.id]: letter }));
  const setTrueFalse = (index: number, value: boolean) => {
    const currentValue = typeof answers[question.id] === "object" ? answers[question.id] as Record<string, boolean> : {};
    setAnswers((prev) => ({ ...prev, [question.id]: { ...currentValue, [String(index)]: value } }));
  };
  const setShortAnswer = (value: string) => setAnswers((prev) => ({ ...prev, [question.id]: value }));
  const setEssay = (value: string) => setAnswers((prev) => ({ ...prev, [question.id]: value }));

  if (result) {
    const col = scoreColor(result.score);
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center" style={{ background: `${col}15` }}><Trophy size={36} style={{ color: col }} /></div>
          {exam.isGuest && <p className="text-xs font-semibold text-[#64748B] mb-2">{exam.participantName} · {exam.participantClass}</p>}
          <h1 className="text-3xl font-bold mb-1" style={{ color: col }}>{result.score}/10</h1>
          <p className="text-[#64748B] text-sm mb-5">{result.correctCount}/{result.totalQuestions} câu được chấm · {formatTime(result.durationSeconds)}</p>
          {exam.isGuest ? <p className="text-xs text-[#94A3B8]">Kết quả đã được ghi nhận cho bài thi này.</p> : <Button className="w-full" onClick={() => router.push("/bang-dieu-khien")}>Về trang chủ</Button>}
        </div>
      </div>
    );
  }

  const progress = totalQuestions ? (answeredCount / totalQuestions) * 100 : 0;
  const isLow = remaining <= 60;
  const currentAnswer = answers[question?.id];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <header className="sticky top-0 z-50 bg-white border-b border-[#E2E8F0] px-3 sm:px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <button type="button" onClick={() => (preview || answeredCount === 0 ? leaveExam() : setShowExitConfirm(true))} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E2E8F0] px-2.5 text-xs font-bold text-[#64748B] hover:bg-[#F8FAFC]"><ArrowLeft size={15}/><span className="hidden sm:inline">{preview ? "Quay lại" : "Thoát"}</span></button>
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-[#0F172A]">{exam.title}</p>{preview && <p className="text-[11px] font-semibold text-violet-600 flex items-center gap-1"><Eye size={11}/> Chế độ xem trước</p>}</div>
        </div>
        <div className={cn("flex items-center gap-1.5 text-sm font-bold", isLow && !preview ? "text-red-600" : "text-slate-800")}><Clock size={15}/>{preview ? "XEM TRƯỚC" : formatTime(remaining)}</div>
      </header>

      {preview && <div className="bg-violet-50 border-b border-violet-100 px-4 py-2 text-center text-xs font-semibold text-violet-700">Đây là chế độ xem trước. Lựa chọn của bạn sẽ không được nộp.</div>}
      <div className="h-1 bg-slate-100"><div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }}/></div>

      <div className="flex-1 w-full max-w-5xl mx-auto flex flex-col lg:flex-row gap-5 p-4 pt-6">
        <main className="flex-1 min-w-0">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-4"><span className="text-xs font-bold text-white bg-blue-600 rounded-md px-2.5 py-1">Câu {current + 1}/{totalQuestions}</span><span className="text-xs font-semibold text-slate-500">{question?.type === "mcq" ? "Trắc nghiệm" : question?.type === "true_false" ? "Đúng / Sai" : question?.type === "short_answer" ? "Trả lời ngắn" : "Tự luận"}</span></div>
            <p className="text-base font-medium leading-relaxed text-slate-900 mb-5">{question?.text}</p>

            {question?.type === "mcq" && <div className="flex flex-col gap-2">{question.options.map((option, index) => { const letter = String.fromCharCode(65 + index); const selected = currentAnswer === letter; return <button key={letter} onClick={() => setMcqAnswer(letter)} className={cn("flex items-center gap-3 rounded-xl border p-4 text-left text-sm transition", selected ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold" : "border-slate-200 hover:bg-slate-50")}><span className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0", selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500")}>{letter}</span>{option}</button>;})}</div>}

            {question?.type === "true_false" && <div className="flex flex-col gap-3">{(question.grading?.statements || []).map((statement, index) => { const values = (typeof currentAnswer === "object" ? currentAnswer : {}) as Record<string, boolean>; const selected = values[String(index)]; return <div key={index} className="rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-800 mb-3"><span className="font-bold mr-2">{String.fromCharCode(97 + index)}.</span>{statement.text}</p><div className="flex gap-2"><button onClick={() => setTrueFalse(index, true)} className={cn("flex-1 rounded-lg border py-2 text-sm font-semibold", selected === true ? "border-green-500 bg-green-50 text-green-700" : "border-slate-200")}>Đúng</button><button onClick={() => setTrueFalse(index, false)} className={cn("flex-1 rounded-lg border py-2 text-sm font-semibold", selected === false ? "border-red-500 bg-red-50 text-red-700" : "border-slate-200")}>Sai</button></div></div>;})}</div>}

            {question?.type === "short_answer" && <div><input value={typeof currentAnswer === "string" ? currentAnswer : ""} onChange={(e) => setShortAnswer(e.target.value)} placeholder="Nhập câu trả lời..." className="w-full rounded-xl border border-slate-200 p-4 text-sm outline-none focus:border-blue-500"/><p className="mt-2 text-xs text-slate-400">Hãy nhập câu trả lời ngắn gọn.</p></div>}

            {question?.type === "essay" && <div><textarea value={typeof currentAnswer === "string" ? currentAnswer : ""} onChange={(e) => setEssay(e.target.value)} rows={8} placeholder="Nhập câu trả lời của bạn..." className="w-full rounded-xl border border-slate-200 p-4 text-sm outline-none resize-y focus:border-blue-500"/><p className="mt-2 text-xs text-amber-600">Câu tự luận sẽ được giáo viên chấm thủ công.</p></div>}
          </div>

          <div className="flex items-center justify-between gap-3"><Button variant="outline" onClick={() => setCurrent((v) => Math.max(0, v - 1))} disabled={current === 0}><ArrowLeft size={16}/> Trước</Button>{current < totalQuestions - 1 ? <Button onClick={() => setCurrent((v) => v + 1)}>Tiếp <ArrowRight size={16}/></Button> : <Button onClick={() => submitExam(false)} loading={submitting} disabled={preview || totalQuestions === 0}><Send size={16}/> {preview ? "Không nộp trong xem trước" : "Nộp bài"}</Button>}</div>
        </main>

        <aside className="lg:w-56 lg:shrink-0"><div className="bg-white rounded-2xl border border-slate-200 p-4 lg:sticky lg:top-24"><p className="text-xs font-bold text-slate-400 mb-3">CÂU HỎI</p><div className="grid grid-cols-5 gap-1.5 mb-4">{exam.questions.map((q, i) => <button key={q.id} onClick={() => setCurrent(i)} className={cn("aspect-square rounded-lg text-xs font-bold", current === i ? "bg-blue-600 text-white" : answers[q.id] ? "bg-green-50 text-green-700 border border-green-200" : "bg-slate-50 text-slate-400 border border-slate-200")}>{i + 1}</button>)}</div><Button className="w-full" onClick={() => submitExam(false)} disabled={preview || totalQuestions === 0} loading={submitting}>{preview ? "Xem trước" : "Nộp bài"}</Button></div></aside>
      </div>

      {showConfirm && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"><div className="bg-white rounded-2xl p-6 max-w-sm w-full"><h3 className="font-bold mb-2">Xác nhận nộp bài?</h3><p className="text-sm text-slate-500 mb-5">Bạn còn {totalQuestions - answeredCount} câu chưa trả lời. Vẫn nộp bài?</p><div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)}>Làm tiếp</Button><Button className="flex-1" onClick={() => submitExam(true)} loading={submitting}>Nộp bài</Button></div></div></div>}
      {showExitConfirm && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"><div className="bg-white rounded-2xl p-6 max-w-sm w-full"><h3 className="font-bold mb-2">Thoát bài thi?</h3><p className="text-sm text-slate-500 mb-5">Bài làm hiện tại sẽ không được nộp.</p><div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={() => setShowExitConfirm(false)}>Ở lại</Button><Button className="flex-1" onClick={leaveExam}>Thoát</Button></div></div></div>}
    </div>
  );
}
