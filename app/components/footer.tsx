import Link from "next/link";
import { Logo } from "@/components/brand/logo";

/* Z1 — footer gọn: hairline + logo + link pill hover. Copy giữ nguyên. */
export function Footer() {
  return (
    <footer className="border-t border-[var(--surface-border)] bg-[var(--surface-card)]">
      <div className="mx-auto max-w-5xl px-5 py-8">
        <div className="flex flex-col items-center justify-between gap-5 sm:flex-row">
          <Logo size="md" href="/" />
          <nav className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1 text-sm text-[var(--text-muted)]" aria-label="Liên kết phụ">
            <Link href="/vao-thi" className="inline-flex items-center rounded-lg px-3 py-2.5 font-medium transition-colors hover:bg-[var(--primary-light)] hover:text-[var(--primary)]">Vào thi</Link>
            <Link href="/dieu-khoan" className="inline-flex items-center rounded-lg px-3 py-2.5 font-medium transition-colors hover:bg-[var(--primary-light)] hover:text-[var(--primary)]">Điều khoản</Link>
            <Link href="/bao-mat" className="inline-flex items-center rounded-lg px-3 py-2.5 font-medium transition-colors hover:bg-[var(--primary-light)] hover:text-[var(--primary)]">Bảo mật</Link>
            <span className="inline-flex items-center px-3 py-2.5">© {new Date().getFullYear()} A6Class Edu</span>
          </nav>
        </div>
      </div>
    </footer>
  );
}