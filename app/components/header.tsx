import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { logoutAction } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/theme/theme-provider";
import { Logo } from "@/components/brand/logo";

/* Z1 — header kính mờ thật (nền 85% + blur), nút có hover/press. Copy giữ nguyên. */
export async function Header() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--surface-border)] bg-[var(--surface-card)]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
        <Logo size="sm" href={session?.user ? "/bang-dieu-khien" : "/"} />

        <nav className="hidden items-center gap-6 md:flex" aria-label="Điều hướng chính">
          <Link
            href="/vao-thi"
            className="inline-flex h-10 items-center rounded-lg px-2 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--primary-light)] hover:text-[var(--primary)]"
          >
            Vào thi
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {session?.user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/bang-dieu-khien"
                className="group inline-flex h-10 items-center gap-1.5 rounded-xl bg-[var(--primary-light)] px-4 text-sm font-bold text-[var(--primary)] transition-all hover:bg-[var(--primary)] hover:text-white active:scale-[0.98] sm:h-9"
              >
                Vào A6Class Edu
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="h-10 rounded-xl border-[1.5px] border-[var(--surface-border-strong)] px-4 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--danger)] hover:text-[var(--danger)] active:scale-[0.98] sm:h-9"
                >
                  Đăng xuất
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link
                href="/dang-nhap"
                className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary-light)] sm:h-9"
              >
                Đăng nhập
              </Link>
              <Link
                href="/dang-ky"
                className="inline-flex h-10 items-center rounded-xl bg-[var(--gradient-brand)] px-5 text-sm font-black text-white shadow-[0_8px_20px_-8px_rgba(15,76,129,0.6)] transition-all hover:-translate-y-px hover:brightness-[1.06] active:translate-y-0 active:scale-[0.98] sm:h-9"
              >
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}