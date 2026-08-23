"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, FileText, ClipboardList, School, Flag, Sparkles, Flame, ShieldCheck, AlertTriangle, Activity, TrendingUp, TrendingDown, UserPlus, Send, ServerCrash, CheckCircle2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";

interface Stats {
  users: { total: number; students: number; teachers: number; admins: number; deltaPct?: number };
  exams: number;
  submissions: number;
  classrooms: number;
  flashcards: number;
  pendingReports: number;
  aiLogs24h: number;
  aiByStatus: Record<string, number>;
  aiErrors: { model: string | null; error: string; createdAt: string }[];
  streakTop: { name: string; email: string; streak: number }[];
  usersGrowth: { day: string; count: number }[];
  subsGrowth: { day: string; count: number }[];
  topExams: { id: string; title: string; subject: string; _count: { submissions: number } }[];
  reportsByStatus: Record<string, number>;
  recentActivity: {
    users: { name: string; email: string; role: string; createdAt: string }[];
    subs: { score: number; submittedAt: string; student: { name: string }; exam: { title: string } }[];
    pendingReports: { id: string; type: string; description: string; createdAt: string; reporter: { name: string }; exam: { title: string } }[];
  };
}

interface Health {
  checks: Record<string, { ok: boolean; detail?: string }>;
}

function Delta({ pct }: { pct?: number }) {
  if (pct === undefined) return null;
  const up = pct >= 0;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-black",
      up ? "bg-[var(--mint-light)] text-[var(--mint)]" : "bg-[var(--danger-light)] text-[var(--danger)]",
    )}>
      {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {pct}%
    </span>
  );
}

function MiniBar({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1.5 h-24">
      {data.map((d) => (
        <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[10px] font-bold text-[var(--text-secondary)]">{d.count > 0 ? d.count : ""}</span>
          <div className="w-full rounded-t-md bg-[#6C4CF1] opacity-80" style={{ height: `${Math.max((d.count / max) * 100, 4)}%` }} />
          <span className="text-[9px] text-[var(--text-muted)] font-semibold">{d.day}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<Stats | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats").then((r) => (r.ok ? r.json() : Promise.reject(new Error("Forbidden")))),
      fetch("/api/admin/system").then((r) => (r.ok ? r.json() : Promise.reject(new Error("Forbidden")))),
    ])
      .then(([s, h]) => {
        setData(s);
        setHealth(h);
      })
      .catch(() => setError("Không tải được dữ liệu"));
  }, []);

  if (error) return <div className="p-10 text-center text-sm text-[var(--danger)]">{error}</div>;
  if (!data) return <div className="flex items-center justify-center py-32"><Spinner /></div>;

  const cards = [
    { label: "Người dùng", value: data.users.total, delta: data.users.deltaPct, sub: `${data.users.students} HS · ${data.users.teachers} GV · ${data.users.admins} admin`, icon: <Users size={15} />, color: "#6C4CF1", bgClass: "bg-[#F1EDFD] dark:bg-[#46309F]", href: "/admin/users" },
    { label: "Đề thi", value: data.exams, sub: `${data.submissions} bài nộp`, icon: <FileText size={15} />, color: "#2F80D8", bgClass: "bg-[#EAF3FC] dark:bg-[#0D2A3E]", href: "/admin/exams" },
    { label: "Lớp học", value: data.classrooms, sub: `${data.flashcards} flashcard`, icon: <School size={15} />, color: "#189A6C", bgClass: "bg-[#E8F7F1] dark:bg-[#0A2A20]", href: "/admin" },
    { label: "Báo cáo chờ", value: data.pendingReports, sub: `${data.aiLogs24h} lượt AI / 24h`, icon: <Flag size={15} />, color: "#E14D4D", bgClass: "bg-[#FFF0F0] dark:bg-[#2B1616]", href: "/admin/reports" },
  ];

  const checks = health?.checks ?? {};
  const healthEntries = ["db", "gemini", "api", "storage", "auth"] as const;
  const healthLabels: Record<string, string> = { db: "DB", gemini: "Gemini AI", api: "API", storage: "Storage", auth: "Auth" };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <h1 className="text-xl font-black text-[var(--text-primary)] mb-6 flex items-center gap-2">
        <ShieldCheck size={20} className="text-[#6C4CF1]" /> Tổng quan hệ thống
      </h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className={`rounded-2xl p-4 transition-transform hover:-translate-y-0.5 ${c.bgClass}`}>
            <div className="flex items-center gap-2 mb-1" style={{ color: c.color }}>
              {c.icon}
              <span className="text-xs font-bold">{c.label}</span>
              {c.delta !== undefined && <Delta pct={c.delta} />}
            </div>
            <p className="text-2xl font-black text-[var(--text-primary)]">{c.value}</p>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{c.sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)] p-5">
          <h2 className="text-sm font-black text-[var(--text-primary)] mb-4">Người dùng mới 7 ngày</h2>
          <MiniBar data={data.usersGrowth} />
        </div>
        <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)] p-5">
          <h2 className="text-sm font-black text-[var(--text-primary)] mb-4">Bài nộp 7 ngày</h2>
          <MiniBar data={data.subsGrowth} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        {/* Sức khỏe hệ thống */}
        <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)] p-5">
          <h2 className="text-sm font-black text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <Activity size={15} className="text-[#189A6C]" /> Sức khỏe hệ thống
          </h2>
          <div className="flex flex-col gap-2">
            {healthEntries.map((k) => {
              const h = checks[k];
              const ok = h?.ok;
              return (
                <div key={k} className="flex items-center gap-2 rounded-lg bg-[var(--gray-100)] px-3 py-2">
                  {ok === undefined ? (
                    <Spinner className="h-4 w-4" />
                  ) : ok ? (
                    <CheckCircle2 size={14} className="text-[var(--mint)] shrink-0" />
                  ) : (
                    <ServerCrash size={14} className="text-[var(--danger)] shrink-0" />
                  )}
                  <span className="text-xs font-bold text-[var(--text-primary)]">{healthLabels[k] ?? k}</span>
                  <span className="ml-auto text-[10px] font-semibold text-[var(--text-muted)] truncate">
                    {ok === undefined ? "…" : ok ? "OK" : "Lỗi"}
                  </span>
                </div>
              );
            })}
          </div>
          <Link href="/admin/system" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#6C4CF1] hover:underline">
            Chi tiết <TrendingUp size={11} />
          </Link>
        </div>

        {/* Báo cáo chờ */}
        <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)] p-5">
          <h2 className="text-sm font-black text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <Flag size={15} className="text-[#E14D4D]" /> Báo cáo chờ ({data.pendingReports})
          </h2>
          {data.recentActivity.pendingReports.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-6">Không có báo cáo chờ</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-44 overflow-y-auto">
              {data.recentActivity.pendingReports.map((r) => (
                <Link key={r.id} href="/admin/reports" className="rounded-lg bg-[var(--gray-100)] px-3 py-2 hover:bg-[var(--gray-200)] transition-colors">
                  <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                    {r.type} · {r.exam?.title ?? "—"}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] truncate">
                    {r.reporter?.name ?? "?"} · {new Date(r.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Hoạt động gần đây */}
        <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)] p-5">
          <h2 className="text-sm font-black text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <Activity size={15} className="text-[#2F80D8]" /> Hoạt động gần đây
          </h2>
          <div className="flex flex-col gap-2 max-h-44 overflow-y-auto">
            {data.recentActivity.users.slice(0, 3).map((u) => (
              <div key={u.email} className="flex items-center gap-2 rounded-lg bg-[var(--gray-100)] px-3 py-2">
                <UserPlus size={13} className="text-[#6C4CF1] shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--text-primary)] truncate">{u.name} đăng ký</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{u.role} · {new Date(u.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</p>
                </div>
              </div>
            ))}
            {data.recentActivity.subs.slice(0, 3).map((s, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-[var(--gray-100)] px-3 py-2">
                <Send size={13} className="text-[#189A6C] shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--text-primary)] truncate">{s.student?.name ?? "?"} nộp bài</p>
                  <p className="text-[10px] text-[var(--text-muted)] truncate">{s.exam?.title} · {s.score}/10</p>
                </div>
              </div>
            ))}
            {data.recentActivity.users.length === 0 && data.recentActivity.subs.length === 0 && (
              <p className="text-sm text-[var(--text-muted)] text-center py-6">Chưa có hoạt động</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)] p-5">
          <h2 className="text-sm font-black text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <Sparkles size={15} className="text-[#2F80D8]" /> AI Import ({data.aiLogs24h} lượt / 24h)
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.aiByStatus).map(([k, v]) => (
              <span key={k} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${k === "success" ? "bg-emerald-50 text-emerald-700" : k === "failed" || k === "timeout" ? "bg-red-50 text-red-600" : "bg-[var(--gray-100)] text-[var(--text-secondary)]"}`}>
                {k === "success" ? "Thành công" : k === "failed" ? "Thất bại" : k === "timeout" ? "Timeout" : k === "running" ? "Đang chạy" : k}: {v}
              </span>
            ))}
          </div>
          {data.topExams.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-bold text-[var(--text-muted)] mb-2">Đề nhiều bài nộp nhất</p>
              <div className="flex flex-col gap-1.5">
                {data.topExams.slice(0, 3).map((e) => (
                  <Link key={e.id} href={`/admin/exams`} className="flex items-center gap-2 rounded-lg bg-[var(--gray-100)] px-3 py-1.5">
                    <FileText size={12} className="text-[#6C4CF1] shrink-0" />
                    <span className="text-xs font-semibold text-[var(--text-primary)] truncate">{e.title}</span>
                    <span className="ml-auto text-[10px] font-bold text-[var(--text-muted)]">{e._count.submissions} nộp</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)] p-5">
          <h2 className="text-sm font-black text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <AlertTriangle size={15} className="text-[#E14D4D]" /> Lỗi AI gần đây
          </h2>
          {data.aiErrors.length === 0 ? (
            <p className="text-sm text-emerald-600 text-center py-6">Không có lỗi nào gần đây</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-44 overflow-y-auto">
              {data.aiErrors.map((e, i) => (
                <div key={i} className="rounded-lg bg-red-50 px-3 py-2 text-xs">
                  <p className="text-red-700 font-semibold truncate">{e.error}</p>
                  <p className="text-red-400 text-[10px]">{e.model ?? "gemini"} · {new Date(e.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)] p-5">
        <h2 className="text-sm font-black text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <Flame size={15} className="text-[#D4A017]" /> Học sinh có chuỗi ngày học cao nhất
        </h2>
        {data.streakTop.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] text-center py-6">Chưa có dữ liệu</p>
        ) : (
          <div className="divide-y divide-[var(--surface-border)]">
            {data.streakTop.map((s, i) => (
              <div key={s.email} className="flex items-center gap-3 py-2.5">
                <span className="w-6 text-center text-sm font-black text-[var(--text-muted)]">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{s.name}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{s.email}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-black text-[#D4A017]">
                  <Flame size={13} /> {s.streak} ngày
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 grid sm:grid-cols-2 gap-3">
        {[
          { label: "Quản lý người dùng", desc: "Khóa / mở khóa, đổi vai trò, xóa tài khoản", href: "/admin/users", icon: <Users size={16} /> },
          { label: "Đề thi toàn hệ thống", desc: "Xem & xóa đề vi phạm", href: "/admin/exams", icon: <FileText size={16} /> },
          { label: "Nhật ký AI import", desc: "Theo dõi lượt dùng Gemini", href: "/admin/ai", icon: <Sparkles size={16} /> },
          { label: "Kiểm tra hệ thống", desc: "DB, Gemini, cấu hình env", href: "/admin/system", icon: <ClipboardList size={16} /> },
        ].map((c) => (
          <Link key={c.href} href={c.href} className="flex items-center gap-3 rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)] p-4 hover:border-[#6C4CF1]/40 transition-colors">
            <span className="w-9 h-9 rounded-xl bg-[#F1EDFD] text-[#6C4CF1] flex items-center justify-center shrink-0">{c.icon}</span>
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">{c.label}</p>
              <p className="text-xs text-[var(--text-muted)]">{c.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}