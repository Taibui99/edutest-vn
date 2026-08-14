"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  CheckCircle2, XCircle, Clock, Trophy, ArrowLeft,
  ChevronDown, ChevronUp, BookOpen, BarChart3
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getSubjectColor } from "@/lib/subject";

interface Question {
  id: string;
  text: string;
  options: string[];
  answer: string;
  explanation?: string;
  order: number;
}

interface Submission {
  id: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  durationSeconds: number;
  submittedAt: string;
  answers: Record<string, string>;
  exam: {
    id: string;
    title: string;
    subject: string;
    showAnswers: boolean;
    showScoreImmediately: boolean;
    teacher: { name: string };
    questions: Question[];
  };
  student: { id: string; name: string };
}

function ScoreGauge({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color = score >= 8 ? "#06D6A0" : score >= 6.5 ? "#FFD166" : "#FF6B6B";
  const grade = score >= 8.5 ? "Xuất sắc" : score >= 7 ? "Khá" : score >= 5 ? "Trung bình" : "Yếu";

  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--gray-200)" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="50" fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={`${2 * Math.PI * 50}`}
            strokeDashoffset={`${2 * Math.PI * 50 * (1 - pct / 100)}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black" style={{ color }}>{score}</span>
          <span className="text-xs text-[var(--text-muted)] font-semibold">/10</span>
        </div>
      </div>
      <span className="text-sm font-black px-3 py-1 rounded-full" style={{ background: `${color}22`, color }}>
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
  const wrongQuestions = exam.questions.filter((q) => answers[q.id] !== q.answer);

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
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5">
            <div className="text-3xl mb-2">⏳</div>
            <p className="font-black text-[var(--text-primary)] mb-1">Đã nộp bài thành công</p>
            <p className="text-sm text-[var(--text-muted)]">Giáo viên sẽ công bố điểm sau khi chấm bài.</p>
          </div>
        ) : (
          <ScoreGauge score={sub.score} />
        )}

        <div className="grid grid-cols-3 gap-3 mt-2">
          <div className="rounded-xl bg-[#E1F5EE] p-3">
            <CheckCircle2 size={16} className="text-[#06D6A0] mx-auto mb-1" />
            <p className="text-lg font-black text-[var(--text-primary)]">{sub.correctCount}</p>
            <p className="text-xs text-[#06D6A0] font-bold">Đúng</p>
          </div>
          <div className="rounded-xl bg-[#FFECEC] p-3">
            <XCircle size={16} className="text-[#FF6B6B] mx-auto mb-1" />
            <p className="text-lg font-black text-[var(--text-primary)]">{sub.totalQuestions - sub.correctCount}</p>
            <p className="text-xs text-[#FF6B6B] font-bold">Sai</p>
          </div>
          <div className="rounded-xl bg-[var(--gray-100)] p-3">
            <Clock size={16} className="text-[var(--text-muted)] mx-auto mb-1" />
            <p className="text-lg font-black text-[var(--text-primary)]">{mins}:{String(secs).padStart(2, "0")}</p>
            <p className="text-xs text-[var(--text-muted)] font-bold">Phút</p>
          </div>
        </div>

        <p className="text-xs text-[var(--text-muted)] mt-4">
          Nộp lúc {new Date(sub.submittedAt).toLocaleString("vi-VN")}
        </p>
      </Card>

      {/* Strengths/weaknesses */}
      {wrongQuestions.length === 0 ? (
        <div className="rounded-2xl bg-[#E1F5EE] border border-[#A8E6D6] p-4 mb-5 flex items-center gap-3">
          <Trophy size={20} className="text-[#06D6A0] shrink-0" />
          <div>
            <p className="font-black text-[#064E3B]">🎉 Hoàn hảo! Bạn trả lời đúng tất cả câu!</p>
            <p className="text-sm text-[#06D6A0] mt-0.5">Tiếp tục duy trì phong độ nhé.</p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-[#FFF8E1] border border-[#FFD16680] p-4 mb-5">
          <p className="font-black text-[#78350F] mb-2">
            📝 Bạn sai {wrongQuestions.length} câu — cần ôn lại:
          </p>
          <div className="flex flex-wrap gap-2">
            {wrongQuestions.slice(0, 6).map((q) => (
              <span key={q.id} className="text-xs bg-white border border-[#FFD166] text-[#92400E] px-2 py-1 rounded-lg font-semibold">
                Câu {q.order}
              </span>
            ))}
            {wrongQuestions.length > 6 && (
              <span className="text-xs text-[#92400E]">+{wrongQuestions.length - 6} câu nữa</span>
            )}
          </div>
        </div>
      )}

      {/* Review answers */}
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
                const isCorrect = userAnswer === q.answer;
                return (
                  <div key={q.id} className="p-5">
                    <div className="flex items-start gap-2 mb-3">
                      <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                        isCorrect ? "bg-[#E1F5EE]" : "bg-[#FFECEC]"
                      }`}>
                        {isCorrect
                          ? <CheckCircle2 size={13} className="text-[#06D6A0]" />
                          : <XCircle size={13} className="text-[#FF6B6B]" />
                        }
                      </span>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        <span className="text-[var(--text-muted)] font-normal mr-1">Câu {q.order}.</span>
                        {q.text}
                      </p>
                    </div>

                    <div className="flex flex-col gap-1.5 pl-7">
                      {q.options.map((opt, i) => {
                        const letter = String.fromCharCode(65 + i);
                        const isUserPick = userAnswer === letter;
                        const isCorrectAnswer = q.answer === letter;
                        return (
                          <div
                            key={letter}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                              isCorrectAnswer ? "bg-[#E1F5EE] text-[#064E3B] font-semibold" :
                              isUserPick && !isCorrect ? "bg-[#FFECEC] text-[#7F1D1D]" :
                              "text-[var(--text-secondary)]"
                            }`}
                          >
                            <span className={`w-5 h-5 rounded-full text-xs font-black flex items-center justify-center shrink-0 ${
                              isCorrectAnswer ? "bg-[#06D6A0] text-white" :
                              isUserPick && !isCorrect ? "bg-[#FF6B6B] text-white" :
                              "bg-[var(--gray-200)] text-[var(--text-muted)]"
                            }`}>
                              {letter}
                            </span>
                            {opt}
                            {isCorrectAnswer && <CheckCircle2 size={13} className="ml-auto text-[#06D6A0]" />}
                          </div>
                        );
                      })}
                    </div>

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
