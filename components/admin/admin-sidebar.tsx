"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, FileText, Flag, Sparkles, Activity,
  Settings, ScrollText, ArrowLeft, ShieldCheck, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/cn";

const items = [
  { href: "/admin", label: "Tổng quan", icon: <LayoutDashboard size={17} />, exact: true },
  { href: "/admin/users", label: "Người dùng", icon: <Users size={17} /> },
  { href: "/admin/exams", label: "Đề thi", icon: <FileText size={17} /> },
  { href: "/admin/reports", label: "Báo cáo", icon: <Flag size={17} /> },
  { href: "/admin/analytics", label: "Phân tích", icon: <BarChart3 size={17} /> },
  { href: "/admin/ai", label: "AI & Import", icon: <Sparkles size={17} /> },
  { href: "/admin/system", label: "Hệ thống", icon: <Activity size={17} /> },
  { href: "/admin/settings", label: "Cài đặt", icon: <Settings size={17} /> },
  { href: "/admin/audit", label: "Nhật ký", icon: <ScrollText size={17} /> },
];

export function AdminSidebar({ user }: { user: { name: string; email: string; role: string } }) {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden lg:flex flex-col w-[230px] shrink-0 border-r border-slate-200 bg-white h-screen sticky top-0 overflow-y-auto">
        <div className="flex items-center justify-between px-5 h-[60px] border-b border-slate-200 shrink-0">
          <span className="text-xl font-black tracking-tight">
            <span className="text-[#6C63FF]">Edu</span>
            <span className="text-[#FF6B6B]">Test</span>
            <span className="text-slate-400 font-semibold text-sm">.vn</span>
          </span>
          <ShieldCheck size={16} className="text-[#6C63FF]" />
        </div>

        <div className="px-4 pt-4 pb-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-[#EEEFFE] text-[#6C63FF]">
            <ShieldCheck size={11} /> Quản trị viên
          </span>
        </div>

        <nav className="flex-1 px-3 py-2 flex flex-col gap-0.5">
          {items.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all",
                  active
                    ? "bg-[#EEEFFE] text-[#6C63FF] shadow-sm"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
                )}
              >
                <span className={cn("shrink-0", active ? "text-[#6C63FF]" : "text-slate-400")}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200">
          <Link
            href="/bang-dieu-khien"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={14} /> Về bảng điều khiển
          </Link>
          <div className="flex items-center gap-3 px-2 py-2 mt-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#FF6B6B] flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">{user.name}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
          </div>
        </div>
      </aside>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex items-stretch h-[60px]">
        {items.slice(0, 6).map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold",
                active ? "text-[#6C63FF]" : "text-slate-400",
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}