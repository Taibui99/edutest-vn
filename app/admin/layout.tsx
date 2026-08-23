import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export const metadata: Metadata = {
  title: "Quản trị hệ thống — EduTest",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/dang-nhap");
  if (session.user.role !== "admin") redirect("/bang-dieu-khien");

  return (
    <div className="min-h-screen bg-[var(--surface-bg)] flex">
      <AdminSidebar
        user={{
          name: session.user.name ?? "Admin",
          email: session.user.email ?? "",
          role: session.user.role ?? "admin",
        }}
      />
      <main id="main-content" className="flex-1 min-w-0 lg:pl-0 pb-[72px] lg:pb-0" tabIndex={-1}>
        <div className="lg:sticky lg:top-0 z-30 lg:hidden bg-[var(--surface-card)] border-b border-[var(--surface-border)] px-4 h-14 flex items-center justify-between">
          <span className="text-lg font-black tracking-tight">
            <span className="text-[#6C4CF1]">Edu</span>
            <span className="text-[#E14D4D]">Test</span>
            <span className="text-[var(--text-muted)] font-semibold text-sm">.vn</span>
          </span>
          <span className="text-xs font-bold text-[var(--text-secondary)]">Admin</span>
        </div>
        {children}
      </main>
    </div>
  );
}