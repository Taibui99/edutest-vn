import Link from "next/link";
import { auth } from "@/auth";
import { logoutAction } from "@/app/actions/auth";

export async function Header() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50" style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid #E8E4FF" }}>
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
        <Link href={session?.user ? "/bang-dieu-khien" : "/"} className="text-xl font-black tracking-tight">
          <span style={{ color: "#6C63FF" }}>Edu</span>
          <span style={{ color: "#FF6B6B" }}>Test</span>
          <span style={{ color: "#94A3B8", fontWeight: 600, fontSize: "0.8em" }}>.vn</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/#tinh-nang" className="text-sm font-semibold" style={{ color: "#64748B" }}>Tính năng</Link>
          <Link href="/#huong-dan" className="text-sm font-semibold" style={{ color: "#64748B" }}>Hướng dẫn</Link>
        </nav>

        {session?.user ? (
          <div className="flex items-center gap-3">
            <Link href="/bang-dieu-khien" className="inline-flex h-9 items-center px-4 rounded-xl text-sm font-bold" style={{ background: "#EEEFFE", color: "#6C63FF" }}>
              Vào EduTest →
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="h-9 px-4 rounded-xl text-sm font-semibold" style={{ border: "1.5px solid #E0DCFC", color: "#64748B" }}>
                Đăng xuất
              </button>
            </form>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/dang-nhap" className="h-9 px-4 rounded-xl text-sm font-semibold" style={{ color: "#6C63FF" }}>
              Đăng nhập
            </Link>
            <Link href="/dang-ky" className="h-9 px-5 rounded-xl text-sm font-black text-white" style={{ background: "linear-gradient(135deg, #6C63FF, #a78bfa)" }}>
              Đăng ký
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}