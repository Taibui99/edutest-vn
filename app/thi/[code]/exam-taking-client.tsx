"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Question = {
  id: string;
  text: string;
  options: string[];
  order: number;
};

type Exam = {
  id: string;
  title: string;
  subject: string;
  durationMinutes: number;
  joinCode: string;
  questions: Question[];
};

type SubmissionResult = {
  score: number;
  correctCount: number;
  totalQuestions: number;
};

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function ExamTakingClient({ exam }: { exam: Exam }) {
  const router = useRouter();
  const totalSeconds = exam.durationMinutes * 60;
  const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const answeredCount = Object.keys(answers).length;

  const submitExam = useCallback(async (autoSubmit = false) => {
    if (submitting || result) return;

    if (!autoSubmit && answeredCount < exam.questions.length) {
      const confirmed = window.confirm("Bạn chưa trả lời hết câu hỏi. Vẫn nộp bài?");
      if (!confirmed) return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          examId: exam.id,
          answers,
          durationSeconds: totalSeconds - remainingSeconds,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Không thể nộp bài");
      }

      setResult(data.submission);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không thể nộp bài";
      alert(message);
    } finally {
      setSubmitting(false);
    }
  }, [answeredCount, answers, exam.id, exam.questions.length, remainingSeconds, result, submitting, totalSeconds]);

  useEffect(() => {
    if (result) return;

    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          void submitExam(true);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [result, submitExam]);

  if (result) {
    return (
      <div className="rounded-2xl border border-green-100 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-green-600">Đã nộp bài</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{result.score}/10 điểm</h1>
        <p className="mt-2 text-sm text-slate-600">
          Đúng {result.correctCount}/{result.totalQuestions} câu.
        </p>
        <button
          onClick={() => router.push("/bang-dieu-khien")}
          className="mt-6 h-11 rounded-xl bg-green-600 px-6 text-sm font-semibold text-white hover:bg-green-700"
        >
          Về dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        {exam.questions.map((question) => (
          <div key={question.id} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-green-600">Câu {question.order}</p>
            <h2 className="mt-2 font-semibold text-slate-900">{question.text}</h2>
            <div className="mt-4 grid gap-2">
              {question.options.map((option, index) => {
                const letter = String.fromCharCode(65 + index);
                const selected = answers[question.id] === letter;

                return (
                  <button
                    key={`${question.id}-${letter}`}
                    onClick={() => setAnswers((current) => ({ ...current, [question.id]: letter }))}
                    className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                      selected
                        ? "border-green-500 bg-green-50 text-green-800"
                        : "border-slate-200 bg-white text-slate-700 hover:border-green-300"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <aside className="h-fit rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:sticky lg:top-20">
        <p className="text-xs font-semibold uppercase text-slate-500">Thời gian còn lại</p>
        <div className={`mt-2 text-4xl font-bold ${remainingSeconds <= 60 ? "text-red-600" : "text-slate-900"}`}>
          {formatTime(remainingSeconds)}
        </div>
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          Đã làm <span className="font-semibold text-slate-900">{answeredCount}</span>/{exam.questions.length} câu
        </div>
        <button
          onClick={() => submitExam(false)}
          disabled={submitting}
          className="mt-4 h-11 w-full rounded-xl bg-green-600 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
        >
          {submitting ? "Đang nộp..." : "Nộp bài"}
        </button>
      </aside>
    </div>
  );
}
