"use client";

import { useMemo } from "react";
import { Flame, TrendingUp, FileText, Layers, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getSubjectColor } from "@/lib/subject";

interface Sub {
  id: string;
  title: string;
  subject: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  durationSeconds: number;
  submittedAt: string;
}

function LineChart({ data }: { data: { label: string; score: number }[] }) {
  const W = 520;
  const H = 180;
  const PAD = 28;

  if (data.length < 2) {
    return (
      <div className="py-8 text-center text-sm text-[var(--text-muted)]">
        Nộp từ 2 bài trở lên để xem biểu đồ điểm theo thời gian
      </div>
    );
  }

  const min = 0;
  const max = 10;
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / (data.length - 1);
  const y = (v: number) => H - PAD - ((v - min) / (max - min)) * (H - PAD * 2);
  const path = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.score)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0, 2.5, 5, 7.5, 10].map((g) => (
        <g key={g}>
          <line x1={PAD} x2={W - PAD} y1={y(g)} y2={y(g)} stroke="var(--gray-200)" strokeDasharray="4 4" />
          <text x={0} y={y(g) + 3} fontSize="9" fill="var(--text-muted)">{g}</text>
        </g>
      ))}
      <path d={path} fill="none" stroke="#6C63FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={d.label + i}>
          <circle cx={x(i)} cy={y(d.score)} r="4" fill="#6C63FF" stroke="white" strokeWidth="2" />
          <text x={x(i)} y={H - 8} fontSize="9" fill="var(--text-muted)" textAnchor="middle">{d.label}</text>
          <text x={x(i)} y={y(d.score) - 9} fontSize="9" fontWeight="bold" fill="#6C63FF" textAnchor="middle">{d.score.toFixed(1)}</text>
        </g>
      ))}
    </svg>
  );
}

export function ProgressClient({ streak, lastStudyDate, flashcardCount, submissions }: {
  streak: number;
  lastStudyDate: string | null;
  flashcardCount: number;
  submissions: Sub[];
}) {
  const chartData = useMemo(
    () => submissions
      .slice()
      .reverse()
      .map((s, i) => ({ label: `${i + 1}`, score: s.score })),
    [submissions],
  );

  const bySubject = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const s of submissions) {
      const arr = map.get(s.subject) ?? [];
      arr.push(s.score);
      map.set(s.subject, arr);
    }
    return Array.from(map.entries()).map(([subject, scores]) => ({
      subject,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      count: scores.length,
      best: Math.max(...scores),
    }));
  }, [submissions]);

  const avgScore = submissions.length ? submissions.reduce((a, s) => a + s.score, 0) / submissions.length : 0;
  const lastStreakDay = lastStudyDate ? new Date(lastStudyDate) : null;
  const isStudiedToday = lastStreakDay && new Date(lastStreakDay).toDateString() === new Date().toDateString();

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      <h1 className="text-xl font-black text-[var(--text-primary)] mb-6 flex items-center gap-2">
        <TrendingUp size={20} className="text-[#6C63FF]" /> Tiến độ học tập
      </h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Chuỗi ngày học", value: `${streak} ngày`, icon: <Flame size={14} />, color: "c1", dim: !isStudiedToday },
          { label: "Bài đã nộp", value: submissions.length, icon: <FileText size={14} />, color: "c2" },
          { label: "Điểm TB", value: submissions.length ? avgScore.toFixed(1) : "—", icon: <TrendingUp size={14} />, color: "c3" },
          { label: "Flashcard", value: flashcardCount, icon: <Layers size={14} />, color: "c4" },
        ].map(({ label, value, icon, color, dim }) => (
          <div key={label} className={`rounded-2xl p-4 ${dim ? "opacity-50" : ""} ${
            color === "c1" ? "bg-[#FFF8E1]" : color === "c2" ? "bg-[#EEEFFE]" : color === "c3" ? "bg-[#E8F4FD]" : "bg-[#E1F5EE]"
          }`}>
            <div className={`flex items-center gap-2 mb-1 ${
              color === "c1" ? "text-[#D4A017]" : color === "c2" ? "text-[#6C63FF]" : color === "c3" ? "text-[#4EA8DE]" : "text-[#06D6A0]"
            }`}>
              {icon}
              <span className="text-xs font-bold">{label}</span>
            </div>
            <p className="text-2xl font-black text-[var(--text-primary)]">{value}</p>
          </div>
        ))}
      </div>

      <Card className="mb-5">
        <h2 className="text-sm font-black text-[var(--text-primary)] mb-2">Điểm theo thời gian</h2>
        <LineChart data={chartData} />
      </Card>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <Card>
          <h2 className="text-sm font-black text-[var(--text-primary)] mb-4">Trung bình theo môn</h2>
          {bySubject.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-6">Chưa có dữ liệu</p>
          ) : (
            <div className="flex flex-col gap-3">
              {bySubject.map(({ subject, avg, count, best }) => {
                const c = getSubjectColor(subject);
                return (
                  <div key={subject} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: c.bg }}>
                      <FileText size={13} style={{ color: c.text }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{subject}</p>
                      <p className="text-xs text-[var(--text-muted)]">{count} bài · cao nhất {best.toFixed(1)}</p>
                    </div>
                    <span className="text-sm font-black" style={{ color: avg >= 8 ? "#06D6A0" : avg >= 6.5 ? "#D4A017" : "#FF6B6B" }}>
                      {avg.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card padding="none">
          <div className="px-5 py-4 border-b border-[var(--surface-border)]">
            <h2 className="text-sm font-black text-[var(--text-primary)] flex items-center gap-2">
              <Clock size={14} className="text-[var(--primary)]" /> Bài gần đây
            </h2>
          </div>
          {submissions.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-10">Chưa nộp bài nào</p>
          ) : (
            <div className="divide-y divide-[var(--surface-border)]">
              {submissions.slice(0, 8).map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{s.title}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {s.subject} · {new Date(s.submittedAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                  <span className={`text-sm font-black ${s.score >= 8 ? "text-[#06D6A0]" : s.score >= 6.5 ? "text-[#D4A017]" : "text-[#FF6B6B]"}`}>
                    {s.score.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}