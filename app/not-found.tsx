import Link from "next/link";
import { Compass, House, KeyRound } from "lucide-react";

/* Z7 — trang 404 có thương hiệu (trước dùng trang mặc định của Next).
   Không đổi hành vi route nào: chỉ là diện mạo khi URL không tồn tại. */
export default function NotFound() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--surface-bg)] p-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(var(--primary) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage: "linear-gradient(180deg, black, transparent 72%)",
          WebkitMaskImage: "linear-gradient(180deg, black, transparent 72%)",
        }}
      />

      <div className="relative w-full max-w-md rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-card)] p-8 text-center shadow-[0_24px_60px_-24px_rgba(15,76,129,0.28)]">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--primary-light)] text-[var(--primary)]">
          <Compass size={30} />
        </div>
        <p className="text-[13px] font-black uppercase tracking-[0.12em] text-[var(--primary)]">Không tìm thấy trang</p>
        <h1 className="mt-2 text-5xl font-black tabular-nums tracking-tight text-[var(--text-primary)]">404</h1>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-[var(--text-secondary)]">
          Liên kết có thể đã cũ hoặc bạn gõ nhầm địa chỉ. Chọn một lối đi bên dưới.
        </p>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <Link
            href="/"
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-5 text-sm font-bold text-white shadow-[0_12px_28px_-10px_rgba(15,76,129,0.55)] transition-all hover:bg-[var(--primary-hover)] active:scale-[0.98]"
          >
            <House size={16} /> Về trang chủ
          </Link>
          <Link
            href="/vao-thi"
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border-[1.5px] border-[var(--surface-border-strong)] bg-[var(--surface-card)] px-5 text-sm font-bold text-[var(--primary)] transition-all hover:border-[var(--primary)] hover:bg-[var(--primary-light)] active:scale-[0.98]"
          >
            <KeyRound size={16} /> Vào thi bằng mã
          </Link>
        </div>
      </div>
    </div>
  );
}
