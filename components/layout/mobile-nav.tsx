"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, Sparkles, User,
  Users, MoreHorizontal, TrendingUp, GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { NotificationBell } from "@/components/ui/notification-bell";
import { ThemeToggle } from "@/components/theme/theme-provider";
import { Logo } from "@/components/brand/logo";

const studentMobileNav = [
  { href: "/bang-dieu-khien",         label: "Home",   icon: <LayoutDashboard size={20} />, exact: true },
  { href: "/bang-dieu-khien/lop-hoc", label: "Lớp",    icon: <GraduationCap size={20} /> },
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

export function MobileTopbar({ user }: { user: { name: string; role: string; mode: string } }) {
  const mode = user.mode === "student" ? "student" : "teacher";
  return (
    <header
      className="lg:hidden flex items-center justify-between px-4 h-14 bg-[var(--surface-sidebar)] border-b border-[var(--surface-border)] sticky top-0 z-40"
      style={{ viewTransitionName: "a6-topbar" }}
    >
      <Logo size="sm" />
      <div className="flex items-center gap-2">
        <span className={cn(
          "text-[11px] font-bold px-2 py-1 rounded-full",
          mode === "teacher" ? "bg-[var(--blue-light)] text-[var(--blue)]" : "bg-[var(--success-light)] text-[var(--success)]"
        )}>
          {mode === "teacher" ? "Giáo viên" : "Học sinh"}
        </span>
        <ThemeToggle />
        <NotificationBell />
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-muted)] flex items-center justify-center text-white text-xs font-bold">
          {user.name.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}

export function MobileBottomNav({ user }: { user: { name: string; role: string; mode: string } }) {
  const pathname = usePathname();
  const nav = user.mode === "student" ? studentMobileNav : teacherMobileNav;

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface-sidebar)] border-t border-[var(--surface-border)] flex items-stretch min-h-[60px] pb-[env(safe-area-inset-bottom)]"
      style={{ viewTransitionName: "a6-bottomnav" }}
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
              "relative flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors",
              active ? "text-[var(--primary)]" : "text-[var(--text-muted)]"
            )}
            aria-current={active ? "page" : undefined}
          >
            <span className={cn("transition-transform", active && "scale-110")}>{item.icon}</span>
            <span className="text-[11px]">{item.label}</span>
            {active && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[var(--primary)]" />}
          </Link>
        );
      })}
    </nav>
  );
}
