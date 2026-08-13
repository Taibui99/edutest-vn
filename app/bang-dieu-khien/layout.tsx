import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileTopbar, MobileBottomNav } from "@/components/layout/mobile-nav";
import { BackNavigation } from "@/components/layout/back-navigation";
import { logoutAction } from "@/app/actions/auth";

export const metadata: Metadata = {
  title: "Dashboard — EduTest",
  description: "Bảng điều khiển EduTest — quản lý đề thi, lớp học và kết quả học tập.",
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/dang-nhap");

  const user = {
    name: session.user.name ?? "User",
    email: session.user.email ?? "",
    role: session.user.role ?? "student",
  };

  return (
    <div className="min-h-screen bg-[var(--surface-bg)]">
      <MobileTopbar user={user} />

      <div className="flex">
        <Sidebar user={user} logoutAction={logoutAction} />

        <main className="flex-1 min-w-0 pb-[72px] lg:pb-0">
          <BackNavigation />
          {children}
        </main>
      </div>

      <MobileBottomNav user={user} />
    </div>
  );
}
