import Link from "next/link";

export function Footer() {
  return (
    <footer style={{ background: "var(--surface-card)", borderTop: "1px solid var(--surface-border)" }}>
      <div className="mx-auto max-w-5xl px-5 py-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="text-lg font-black">
            <span style={{ color: "var(--primary)" }}>Edu</span>
            <span style={{ color: "var(--text-primary)" }}>Test</span>
            <span style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: "0.85em" }}>.vn</span>
          </span>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm" style={{ color: "var(--text-muted)" }}>
            <Link href="/vao-thi" className="inline-flex items-center py-2.5 font-medium transition-colors hover:text-[var(--primary)]">Vào thi</Link>
            <Link href="/dieu-khoan" className="inline-flex items-center py-2.5 font-medium transition-colors hover:text-[var(--primary)]">Điều khoản</Link>
            <Link href="/bao-mat" className="inline-flex items-center py-2.5 font-medium transition-colors hover:text-[var(--primary)]">Bảo mật</Link>
            <span className="inline-flex items-center py-2.5">© {new Date().getFullYear()} EduTest.vn</span>
          </div>
        </div>
      </div>
    </footer>
  );
}