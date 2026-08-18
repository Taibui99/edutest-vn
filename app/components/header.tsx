import Link from "next/link";
import { auth } from "@/auth";
import { logoutAction } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/theme/theme-provider";

export async function Header() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50" style={{ background: "var(--surface-card)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--surface-border)" }}>
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
        <Link href={session?.user ? "/bang-dieu-khien" : "/"} className="text-xl font-black tracking-tight">
          <span style={{ color: "var(--primary)" }}>Edu</span>
          <span style={{ color: "var(--coral)" }}>Test</span>
          <span style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: "0.8em" }}>.vn</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/#tinh-nang" className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>Tính năng</Link>
          <Link href="/#huong-dan" className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>Hướng dẫn</Link>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {session?.user ? (
            <div className="flex items-center gap-3">
              <Link href="/bang-dieu-khien" className="inline-flex h-9 items-center px-4 rounded-xl text-sm font-bold" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                Vào EduTest →
              </Link>
              <form action={logoutAction}>
                <button type="submit" className="h-9 px-4 rounded-xl text-sm font-semibold" style={{ border: "1.5px solid var(--surface-border-strong)", color: "var(--text-secondary)" }}>
                  Đăng xuất
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/dang-nhap" className="inline-flex h-9 items-center px-4 rounded-xl text-sm font-semibold" style={{ color: "var(--primary)" }}>
                Đăng nhập
              </Link>
              <Link href="/dang-ky" className="inline-flex h-9 items-center px-5 rounded-xl text-sm font-black text-white" style={{ background: "var(--primary)" }}>
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}