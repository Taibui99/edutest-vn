"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, BookOpen, FileText, Sparkles, User,
  Users, MoreHorizontal, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { NotificationBell } from "@/components/ui/notification-bell";

const studentMobileNav = [
  { href: "/bang-dieu-khien",         label: "Home",   icon: <LayoutDashboard size={20} />, exact: true },
  { href: "/bang-dieu-khien/hoc-tap", label: "Học",    icon: <BookOpen size={20} /> },
  { href: "/bang-dieu-khien/tien-do", label: "Tiến độ", icon: <TrendingUp size={20} /> },
  { href: "/bang-dieu-khien/de-thi",  label: "Đề",     icon: <FileText size={20} /> },
  { href: "/bang-dieu-khien/ho-so",  label: "Profile", icon: <User size={20} /> },
];

const teacherMobileNav = [
  { href: "/bang-dieu-khien",             label: "Dashboard", icon: <LayoutDashboard size={20} />, exact: true },
  { href: "/bang-dieu-khien/de-thi",      label: "Đề",        icon: <FileText size={20} /> },
  { href: "/bang-dieu-khien/lop-hoc",    label: "Lớp",       icon: <Users size={20} /> },
  { href: "/bang-dieu-khien/ai",          label: "AI",        icon: <Sparkles size={20} /> },
  { href: "/bang-dieu-khien/thong-ke",   label: "More",      icon: <MoreHorizontal size={20} /> },
];

export function MobileTopbar({ user }: { user: { name: string; role: string } }) {
  return (
    <header className="lg:hidden flex items-center justify-between px-4 h-14 bg-[var(--surface-sidebar)] border-b border-[var(--surface-border)] sticky top-0 z-40">
      <span className="text-lg font-black tracking-tight">
        <span className="text-[#6C63FF]">Edu</span><span className="text-[#FF6B6B]">Test</span>
      </span>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#FF6B6B] flex items-center justify-center text-white text-xs font-bold">
          {user.name.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}

export function MobileBottomNav({ user }: { user: { name: string; role: string } }) {
  const pathname = usePathname();
  const nav = user.role === "teacher" || user.role === "admin" ? teacherMobileNav : studentMobileNav;

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface-sidebar)] border-t border-[var(--surface-border)] flex items-stretch h-[60px]"
      aria-label="Mobile navigation"
    >
      {nav.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors",
              active ? "text-[#6C63FF]" : "text-[var(--text-muted)]"
            )}
            aria-current={active ? "page" : undefined}
          >
            <span className={cn("transition-transform", active && "scale-110")}>{item.icon}</span>
            <span className="text-[10px]">{item.label}</span>
            {active && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#6C63FF]" />}
          </Link>
        );
      })}
    </nav>
  );
}
