import Link from "next/link";
import { auth } from "@/auth";
import { logoutAction } from "@/app/actions/auth";
import { Logo } from "./logo";

export async function Header() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50 border-b border-blue-100 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />

        <nav className="hidden items-center gap-8 md:flex">
          <Link
            href="/#tinh-nang"
            className="text-sm font-medium text-slate-600 transition-colors hover:text-blue-600"
          >
            Tính năng
          </Link>
          <Link
            href="/#huong-dan"
            className="text-sm font-medium text-slate-600 transition-colors hover:text-blue-600"
          >
            Hướng dẫn
          </Link>
          <Link
            href="/#lien-he"
            className="text-sm font-medium text-slate-600 transition-colors hover:text-blue-600"
          >
            Liên hệ
          </Link>
        </nav>

        {session?.user ? (
          <div className="flex items-center gap-3">
            <Link
              href="/bang-dieu-khien"
              className="hidden text-sm font-medium text-slate-600 transition-colors hover:text-blue-600 sm:inline"
            >
              {session.user.name}
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-blue-200 px-5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50"
              >
                Đăng xuất
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/dang-nhap"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Đăng nhập
          </Link>
        )}
      </div>
    </header>
  );
}
