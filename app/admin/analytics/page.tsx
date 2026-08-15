"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Flag, Sparkles, TrendingUp } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface Stats {
  users: { total: number; students: number; teachers: number; admins: number };
  exams: number;
  submissions: number;
  pendingReports: number;
  aiByStatus: Record<string, number>;
  reportsByStatus: Record<string, number>;
  topExams: { id: string; title: string; subject: string; _count: { submissions: number } }[];
  subjects: { subject: string; count: number }[];
  usersGrowth: { day: string; count: number }[];
  subsGrowth: { day: string; count: number }[];
}

function MiniBar({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1.5 h-24">
      {data.map((d) => (
        <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[10px] font-bold text-[var(--text-secondary)]">{d.count > 0 ? d.count : ""}</span>
          <div className="w-full rounded-t-md bg-[#6C63FF] opacity-80" style={{ height: `${Math.max((d.count / max) * 100, 4)}%` }} />
          <span className="text-[9px] text-[var(--text-muted)] font-semibold">{d.day}</span>
        </div>
      ))}
    </div>
  );
}

const REPORT_LABEL: Record<string, string> = {
  pending: "Chờ xử lý",
  reviewing: "Đang xem xét",
  resolved: "Đã xử lý",
  rejected: "Từ chối",
};

const AI_LABEL: Record<string, string> = {
  running: "Đang chạy",
  success: "Thành công",
  failed: "Thất bại",
  timeout: "Hết thời gian",
};

export default function AdminAnalytics() {
  const [data, setData] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Forbidden"))))
      .then(setData)
      .catch(() => setError("Không tải được dữ liệu"));
  }, []);

  if (error) return <div className="p-10 text-center text-sm text-red-500">{error}</div>;
  if (!data) return <div className="flex items-center justify-center py-32"><Spinner /></div>;

  const maxSubject = Math.max(...data.subjects.map((s) => s.count), 1);

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <h1 className="text-xl font-black text-[var(--text-primary)] mb-6 flex items-center gap-2">
        <BarChart3 size={20} className="text-[#6C63FF]" /> Phân tích & thống kê
      </h1>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)] p-5">
          <h2 className="text-sm font-black text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-[#6C63FF]" /> Bài nộp 7 ngày
          </h2>
          <MiniBar data={data.subsGrowth} />
        </div>
        <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)] p-5">
          <h2 className="text-sm font-black text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-[#6C63FF]" /> Người dùng mới 7 ngày
          </h2>
          <MiniBar data={data.usersGrowth} />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)] p-5">
          <h2 className="text-sm font-black text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <Flag size={14} className="text-[#FF6B6B]" /> Báo cáo theo trạng thái
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(REPORT_LABEL).map(([k, label]) => (
              <span key={k} className="rounded-lg bg-[var(--gray-100)] px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)]">
                {label}: <span className="text-[var(--text-primary)]">{data.reportsByStatus[k] ?? 0}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)] p-5">
          <h2 className="text-sm font-black text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <Sparkles size={14} className="text-[#4EA8DE]" /> AI Import theo trạng thái
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(AI_LABEL).map(([k, label]) => (
              <span key={k} className="rounded-lg bg-[var(--gray-100)] px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)]">
                {label}: <span className="text-[var(--text-primary)]">{data.aiByStatus[k] ?? 0}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)] p-5">
          <h2 className="text-sm font-black text-[var(--text-primary)] mb-4">Đề thi có nhiều bài nộp nhất</h2>
          {data.topExams.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-6">Chưa có dữ liệu</p>
          ) : (
            <div className="divide-y divide-[var(--surface-border)]">
              {data.topExams.map((e, i) => (
                <div key={e.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-6 text-center text-sm font-black text-[var(--text-muted)]">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{e.title}</p>
                    <p className="text-xs text-[var(--text-muted)]">{e.subject}</p>
                  </div>
                  <span className="text-xs font-black text-[var(--text-secondary)]">{e._count.submissions} bài</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)] p-5">
          <h2 className="text-sm font-black text-[var(--text-primary)] mb-4">Đề thi theo môn</h2>
          {data.subjects.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-6">Chưa có dữ liệu</p>
          ) : (
            <div className="flex flex-col gap-3">
              {data.subjects.map((s) => (
                <div key={s.subject} className="flex items-center gap-3">
                  <span className="w-24 text-xs font-semibold text-[var(--text-secondary)] truncate">{s.subject}</span>
                  <div className="flex-1 h-2 rounded-full bg-[var(--gray-100)] overflow-hidden">
                    <div className="h-full rounded-full bg-[#6C63FF]" style={{ width: `${(s.count / maxSubject) * 100}%` }} />
                  </div>
                  <span className="text-xs font-black text-[var(--text-secondary)] w-6 text-right">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-[11px] text-[var(--text-muted)]">
        <Link href="/admin" className="text-[#6C63FF] font-semibold hover:underline">← Về tổng quan</Link> · Dữ liệu lấy trực tiếp từ database.
      </p>
    </div>
  );
}