import Link from "next/link";

export function Footer() {
  return (
    <footer style={{ background: "var(--surface-card)", borderTop: "1px solid var(--surface-border)" }}>
      <div className="mx-auto max-w-5xl px-5 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-lg font-black">
              <span style={{ color: "var(--primary)" }}>Edu</span>
              <span style={{ color: "var(--text-primary)" }}>Test</span>
              <span style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: "0.85em" }}>.vn</span>
            </span>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Dự án cá nhân — xây dựng để học tốt hơn
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
            <Link href="/dang-ky" className="font-medium transition-colors hover:text-[var(--primary)]">Đăng ký</Link>
            <Link href="/dang-nhap" className="font-medium transition-colors hover:text-[var(--primary)]">Đăng nhập</Link>
            <Link href="/vao-thi" className="font-medium transition-colors hover:text-[var(--primary)]">Vào thi</Link>
            <Link href="/dieu-khoan" className="font-medium transition-colors hover:text-[var(--primary)]">Điều khoản</Link>
            <Link href="/bao-mat" className="font-medium transition-colors hover:text-[var(--primary)]">Bảo mật</Link>
          </div>
        </div>
        <div className="mt-6 pt-6 text-center text-xs" style={{ borderTop: "1px solid var(--surface-border-strong)", color: "var(--text-muted)" }}>
          © {new Date().getFullYear()} EduTest.vn — for học sinh Việt Nam
        </div>
      </div>
    </footer>
  );
}