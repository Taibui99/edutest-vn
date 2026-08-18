"use client";

import { useState, useEffect } from "react";
import { BarChart3, FileText, Users, Trophy, Clock, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { getSubjectColor } from "@/lib/subject";

interface Analytics {
  summary: {
    totalExams: number;
    totalSubmissions: number;
    avgScore: number;
    avgDuration: number;
    activeExams: number;
  };
  distribution: number[];
  weeklyActivity: { day: string; count: number }[];
  examStats: {
    id: string; title: string; subject: string;
    questionCount: number; submissionCount: number; avgScore: number | null;
  }[];
}

const DIST_LABELS = ["< 4", "4 – 5.9", "6 – 6.9", "7 – 8.4", "8.5 – 10"];
const DIST_COLORS = ["#F97316", "#FFD166", "#06D6A0", "#0284C7", "#0F766E"];

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-2 bg-[var(--gray-200)] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function scoreColor(score: number) {
  if (score >= 8) return "#06D6A0";
  if (score >= 6.5) return "#FFD166";
  return "#F97316";
}

export default function StatisticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-32"><Spinner /></div>
  );
  if (!data) return (
    <div className="p-8 text-center text-[var(--text-muted)]">Không tải được dữ liệu.</div>
  );

  const { summary, distribution, weeklyActivity, examStats } = data;
  const maxDist = Math.max(...distribution, 1);
  const maxWeekly = Math.max(...weeklyActivity.map((w) => w.count), 1);
  const avgMins = Math.round(summary.avgDuration / 60);

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      <h1 className="text-xl font-black text-[var(--text-primary)] mb-6 flex items-center gap-2">
        <BarChart3 size={20} className="text-[var(--primary)]" /> Thống kê
      </h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Đề thi", value: summary.totalExams, icon: <FileText size={14} />, color: "c1" },
          { label: "Bài nộp", value: summary.totalSubmissions, icon: <Users size={14} />, color: "c2" },
          { label: "Điểm TB", value: summary.avgScore > 0 ? summary.avgScore.toFixed(1) : "—", icon: <Trophy size={14} />, color: "c3" },
          { label: "TG làm TB", value: avgMins > 0 ? `${avgMins} phút` : "—", icon: <Clock size={14} />, color: "c4" },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className={`rounded-2xl p-4 ${
            color === "c1" ? "bg-[#CCFBF1]" :
            color === "c2" ? "bg-[#E8F4FD]" :
            color === "c3" ? "bg-[#FFF8E1]" : "bg-[#E1F5EE]"
          }`}>
            <div className={`flex items-center gap-2 mb-1 ${
              color === "c1" ? "text-[#0F766E]" :
              color === "c2" ? "text-[#0284C7]" :
              color === "c3" ? "text-[#D4A017]" : "text-[#06D6A0]"
            }`}>
              {icon}
              <span className="text-xs font-bold">{label}</span>
            </div>
            <p className="text-2xl font-black text-[var(--text-primary)]">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        {/* Score distribution */}
        <Card>
          <h2 className="text-sm font-black text-[var(--text-primary)] mb-4">Phân bố điểm số</h2>
          {summary.totalSubmissions === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-6">Chưa có dữ liệu</p>
          ) : (
            <div className="flex flex-col gap-3">
              {DIST_LABELS.map((label, i) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">{label}</span>
                    <span className="text-xs font-black" style={{ color: DIST_COLORS[i] }}>
                      {distribution[i]} bài
                    </span>
                  </div>
                  <MiniBar value={distribution[i]} max={maxDist} color={DIST_COLORS[i]} />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Weekly activity */}
        <Card>
          <h2 className="text-sm font-black text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-[var(--primary)]" /> Hoạt động 7 ngày qua
          </h2>
          {summary.totalSubmissions === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-6">Chưa có dữ liệu</p>
          ) : (
            <div className="flex items-end gap-2 h-32">
              {weeklyActivity.map(({ day, count }) => {
                const pct = maxWeekly > 0 ? (count / maxWeekly) * 100 : 0;
                return (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-black text-[var(--text-muted)]">{count > 0 ? count : ""}</span>
                    <div className="w-full relative" style={{ height: "80px" }}>
                      <div
                        className="absolute bottom-0 w-full rounded-t-lg bg-[var(--primary)] opacity-80 transition-all duration-500"
                        style={{ height: `${Math.max(pct, count > 0 ? 8 : 2)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)] font-semibold">{day}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Per-exam table */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--surface-border)]">
          <h2 className="text-sm font-black text-[var(--text-primary)]">Chi tiết từng đề thi</h2>
        </div>
        {examStats.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] text-center py-10">Chưa có đề thi nào</p>
        ) : (
          <div className="divide-y divide-[var(--surface-border)]">
            {examStats.map((e) => {
              const c = getSubjectColor(e.subject);
              return (
                <div key={e.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: c.bg }}>
                    <FileText size={13} style={{ color: c.text }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{e.title}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {e.subject} · {e.questionCount} câu · {e.submissionCount} bài nộp
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {e.avgScore !== null ? (
                      <p className="text-sm font-black" style={{ color: scoreColor(e.avgScore) }}>
                        TB {e.avgScore.toFixed(1)}
                      </p>
                    ) : (
                      <p className="text-xs text-[var(--text-muted)]">Chưa có bài</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
