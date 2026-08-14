"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, FileText, ClipboardList, School, Layers, Flag, Sparkles, Flame, ShieldCheck } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface Stats {
  users: { total: number; students: number; teachers: number; admins: number };
  exams: number;
  submissions: number;
  classrooms: number;
  flashcards: number;
  pendingReports: number;
  aiLogs24h: number;
  streakTop: { name: string; email: string; streak: number }[];
  usersGrowth: { day: string; count: number }[];
  subsGrowth: { day: string; count: number }[];
}

function MiniBar({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1.5 h-24">
      {data.map((d) => (
        <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[10px] font-bold text-slate-500">{d.count > 0 ? d.count : ""}</span>
          <div className="w-full rounded-t-md bg-[#6C63FF] opacity-80" style={{ height: `${Math.max((d.count / max) * 100, 4)}%` }} />
          <span className="text-[9px] text-slate-400 font-semibold">{d.day}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Forbidden"))))
      .then(setData)
      .catch(() => setError("Không tải được dữ liệu"))
      .finally(() => {});
  }, []);

  if (error) return <div className="p-10 text-center text-sm text-red-500">{error}</div>;
  if (!data) return <div className="flex items-center justify-center py-32"><Spinner /></div>;

  const cards = [
    { label: "Người dùng", value: data.users.total, sub: `${data.users.students} HS · ${data.users.teachers} GV · ${data.users.admins} admin`, icon: <Users size={15} />, color: "#6C63FF", bg: "#EEEFFE", href: "/admin/users" },
    { label: "Đề thi", value: data.exams, sub: `${data.submissions} bài nộp`, icon: <FileText size={15} />, color: "#4EA8DE", bg: "#E8F4FD", href: "/admin/exams" },
    { label: "Lớp học", value: data.classrooms, sub: `${data.flashcards} flashcard`, icon: <School size={15} />, color: "#06D6A0", bg: "#E1F5EE", href: "/admin" },
    { label: "Báo cáo chờ", value: data.pendingReports, sub: `${data.aiLogs24h} lượt AI / 24h`, icon: <Flag size={15} />, color: "#FF6B6B", bg: "#FFF0F0", href: "/admin/reports" },
  ];

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <h1 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
        <ShieldCheck size={20} className="text-[#6C63FF]" /> Tổng quan hệ thống
      </h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="rounded-2xl p-4 transition-transform hover:-translate-y-0.5" style={{ background: c.bg }}>
            <div className="flex items-center gap-2 mb-1" style={{ color: c.color }}>
              {c.icon}
              <span className="text-xs font-bold">{c.label}</span>
            </div>
            <p className="text-2xl font-black text-slate-800">{c.value}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{c.sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <div className="rounded-2xl bg-white border border-slate-200 p-5">
          <h2 className="text-sm font-black text-slate-800 mb-4">Người dùng mới 7 ngày</h2>
          <MiniBar data={data.usersGrowth} />
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-5">
          <h2 className="text-sm font-black text-slate-800 mb-4">Bài nộp 7 ngày</h2>
          <MiniBar data={data.subsGrowth} />
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 p-5">
        <h2 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
          <Flame size={15} className="text-[#D4A017]" /> Học sinh có chuỗi ngày học cao nhất
        </h2>
        {data.streakTop.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Chưa có dữ liệu</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.streakTop.map((s, i) => (
              <div key={s.email} className="flex items-center gap-3 py-2.5">
                <span className="w-6 text-center text-sm font-black text-slate-400">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{s.name}</p>
                  <p className="text-xs text-slate-400 truncate">{s.email}</p>
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
          <Link key={c.href} href={c.href} className="flex items-center gap-3 rounded-2xl bg-white border border-slate-200 p-4 hover:border-[#6C63FF]/40 transition-colors">
            <span className="w-9 h-9 rounded-xl bg-[#EEEFFE] text-[#6C63FF] flex items-center justify-center shrink-0">{c.icon}</span>
            <div>
              <p className="text-sm font-bold text-slate-800">{c.label}</p>
              <p className="text-xs text-slate-400">{c.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}