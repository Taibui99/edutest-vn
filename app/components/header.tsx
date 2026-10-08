import Link from "next/link";
import { auth } from "@/auth";
import { logoutAction } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/theme/theme-provider";
import { Logo } from "@/components/brand/logo";

export async function Header() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50" style={{ background: "var(--surface-card)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--surface-border)" }}>
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
        <Logo size="sm" href={session?.user ? "/bang-dieu-khien" : "/"} />

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/vao-thi" className="inline-flex h-10 items-center text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>Vào thi</Link>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {session?.user ? (
            <div className="flex items-center gap-3">
              <Link href="/bang-dieu-khien" className="inline-flex h-10 sm:h-9 items-center px-4 rounded-xl text-sm font-bold" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                Vào A6Class Edu →
              </Link>
              <form action={logoutAction}>
                <button type="submit" className="h-10 sm:h-9 px-4 rounded-xl text-sm font-semibold" style={{ border: "1.5px solid var(--surface-border-strong)", color: "var(--text-secondary)" }}>
                  Đăng xuất
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/dang-nhap" className="inline-flex h-10 sm:h-9 items-center px-4 rounded-xl text-sm font-semibold" style={{ color: "var(--primary)" }}>
                Đăng nhập
              </Link>
              <Link href="/dang-ky" className="inline-flex h-10 sm:h-9 items-center px-5 rounded-xl text-sm font-black text-white" style={{ background: "var(--gradient-brand)" }}>
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}