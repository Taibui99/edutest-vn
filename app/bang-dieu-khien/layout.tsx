import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileTopbar, MobileBottomNav } from "@/components/layout/mobile-nav";
import { logoutAction } from "@/app/actions/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/dang-nhap");

  const user = {
    name:  session.user.name  ?? "User",
    email: session.user.email ?? "",
    role:  session.user.role  ?? "student",
  };

  return (
    <div className="min-h-screen bg-[var(--surface-bg)]">
      <MobileTopbar user={user} />

      <div className="flex">
        <Sidebar user={user} logoutAction={logoutAction} />

        <main className="flex-1 min-w-0 pb-[72px] lg:pb-0">
          {children}
        </main>
      </div>

      <MobileBottomNav user={user} />
    </div>
  );
}
