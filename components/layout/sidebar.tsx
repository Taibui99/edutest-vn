"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, BookOpen, FileText, Sparkles, Users,
  User, Plus, Library, BarChart3, GraduationCap, LogOut, TrendingUp, ShieldCheck, Repeat,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { NotificationBell } from "@/components/ui/notification-bell";
import { ThemeToggle } from "@/components/theme/theme-provider";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
}

const studentNav: NavItem[] = [
  { href: "/bang-dieu-khien",            label: "Tổng quan",  icon: <LayoutDashboard size={18} />, exact: true },
  { href: "/bang-dieu-khien/hoc-tap",    label: "Học tập",    icon: <BookOpen size={18} /> },
  { href: "/bang-dieu-khien/tien-do",    label: "Tiến độ",    icon: <TrendingUp size={18} /> },
  { href: "/bang-dieu-khien/de-thi",     label: "Đề thi",     icon: <FileText size={18} /> },
  { href: "/bang-dieu-khien/ai",         label: "AI Coach",   icon: <Sparkles size={18} /> },
  { href: "/bang-dieu-khien/lop-hoc",   label: "Lớp học",    icon: <GraduationCap size={18} /> },
  { href: "/bang-dieu-khien/ho-so",     label: "Hồ sơ",      icon: <User size={18} /> },
];

const teacherNav: NavItem[] = [
  { href: "/bang-dieu-khien",             label: "Tổng quan",      icon: <LayoutDashboard size={18} />, exact: true },
  { href: "/bang-dieu-khien/de-thi",      label: "Đề thi",         icon: <FileText size={18} /> },
  { href: "/bang-dieu-khien/tao-de-thi",  label: "Tạo đề",         icon: <Plus size={18} /> },
  { href: "/bang-dieu-khien/lop-hoc",    label: "Lớp học",         icon: <Users size={18} /> },
  { href: "/bang-dieu-khien/hoc-sinh",   label: "Học sinh",        icon: <GraduationCap size={18} /> },
  { href: "/bang-dieu-khien/ngan-hang",  label: "Ngân hàng câu",   icon: <Library size={18} /> },
  { href: "/bang-dieu-khien/ai",         label: "AI tạo đề",       icon: <Sparkles size={18} /> },
  { href: "/bang-dieu-khien/thong-ke",   label: "Thống kê",        icon: <BarChart3 size={18} /> },
];

interface SidebarProps {
  user: { name: string; email: string; role: string; mode: string };
  logoutAction: () => Promise<void>;
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = item.exact
    ? pathname === item.href
    : pathname.startsWith(item.href) && item.href !== "/bang-dieu-khien";

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-700 font-semibold transition-all",
        active
          ? "bg-[#EEEFFE] text-[#6C63FF] shadow-sm"
          : "text-[var(--text-secondary)] hover:bg-[var(--gray-100)] hover:text-[var(--text-primary)]",
      )}
      aria-current={active ? "page" : undefined}
    >
      <span className={cn("shrink-0 transition-colors", active ? "text-[#6C63FF]" : "text-[var(--text-muted)]")}>
        {item.icon}
      </span>
      {item.label}
      {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#6C63FF]" />}
    </Link>
  );
}

export function Sidebar({ user, logoutAction }: SidebarProps) {
  const pathname = usePathname();
  const mode = user.mode === "student" ? "student" : "teacher";
  const nav = mode === "student" ? studentNav : teacherNav;
  const isAdmin = user.role === "admin";

  return (
    <aside className="hidden lg:flex flex-col w-[220px] shrink-0 border-r border-[var(--surface-border)] bg-[var(--surface-sidebar)] h-screen sticky top-0 overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 h-[60px] border-b border-[var(--surface-border)] shrink-0">
        <span className="text-xl font-black tracking-tight">
          <span className="text-[#6C63FF]">Edu</span><span className="text-[#FF6B6B]">Test</span>
          <span className="text-[var(--text-muted)] font-semibold text-sm">.vn</span>
        </span>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <NotificationBell />
        </div>
      </div>

      {/* Role badge + switch */}
      <div className="px-4 pt-4 pb-1">
        <div className="flex items-center gap-1.5">
          <div className={cn(
            "text-xs font-bold px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5",
            mode === "teacher" ? "bg-[#E8F4FD] text-[#4EA8DE]" : "bg-[#E1F5EE] text-[#06D6A0]"
          )}>
            {mode === "teacher" ? <GraduationCap size={11} /> : <BookOpen size={11} />}
            {mode === "teacher" ? "Giáo viên" : "Học sinh"}
          </div>
          <Link
            href="/bang-dieu-khien"
            className="text-[10px] font-bold text-[var(--text-muted)] hover:text-[#6C63FF] transition-colors inline-flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-[var(--gray-100)]"
            aria-label="Đổi chế độ"
          >
            <Repeat size={11} /> Đổi chế độ
          </Link>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 flex flex-col gap-0.5" aria-label="Navigation chính">
        {nav.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
        {isAdmin && (
          <NavLink
            item={{ href: "/admin", label: "Quản trị", icon: <ShieldCheck size={18} />, exact: true }}
            pathname={pathname}
          />
        )}
      </nav>

      {/* User + logout */}
      <div className="p-3 border-t border-[var(--surface-border)]">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[var(--gray-100)] transition-colors">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#FF6B6B] flex items-center justify-center text-white text-xs font-bold shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{user.name}</p>
            <p className="text-xs text-[var(--text-muted)] truncate">{user.email}</p>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="text-[var(--text-muted)] hover:text-[#FF6B6B] transition-colors" aria-label="Đăng xuất">
              <LogOut size={15} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
