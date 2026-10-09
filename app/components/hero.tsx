import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { auth } from "@/auth";

const MICRO = [
  "Miễn phí cho giáo viên",
  "Học sinh không cần tài khoản",
  "Chấm điểm tự động",
];

export async function Hero() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <section className="relative overflow-hidden" style={{ background: "linear-gradient(180deg, var(--primary-light) 0%, var(--surface-bg) 62%)" }}>
      {/* glow + texture: chi tiết thị giác, khong them noi dung */}
      <div
        className="pointer-events-none absolute -top-40 -right-32 h-[26rem] w-[26rem] rounded-full opacity-[0.16] blur-2xl"
        style={{ background: "radial-gradient(circle, var(--primary), transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-52 -left-40 h-[22rem] w-[22rem] rounded-full opacity-[0.10] blur-2xl"
        style={{ background: "radial-gradient(circle, var(--coral), transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(var(--primary) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage: "linear-gradient(180deg, black, transparent 72%)",
          WebkitMaskImage: "linear-gradient(180deg, black, transparent 72%)",
        }}
      />

      <div className="relative mx-auto flex min-h-[72vh] max-w-3xl flex-col items-center justify-center px-5 py-14 text-center sm:min-h-[calc(100vh-4rem-1px)] sm:py-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--surface-card)] px-3.5 py-2 text-[13px] font-bold text-[var(--primary)] shadow-[0_2px_12px_-4px_rgba(15,76,129,0.25)] sm:py-1.5 sm:text-sm">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
          </span>
          Nền tảng thi trực tuyến cho giáo viên
        </span>

        <h1
          className="mt-6 text-balance text-4xl font-black tracking-tight text-[var(--text-primary)] sm:text-5xl md:text-[3.4rem]"
          style={{ lineHeight: 1.12, letterSpacing: "-0.02em" }}
        >
          Soạn đề thi{" "}
          <span className="text-gradient-brand">siêu nhanh</span>
          .<br />
          Chấm bài tự động.
        </h1>

        <p className="mt-6 max-w-xl text-base sm:text-lg" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
          Tạo đề trong vài phút rồi gửi mã cho lớp. Học sinh làm bài ngay trên điện thoại, bạn có điểm và thống kê tức thì.
        </p>

        <div className="mt-8 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
          <Link
            href={isLoggedIn ? "/bang-dieu-khien/tao-de-thi" : "/dang-ky"}
            className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-8 text-base font-bold text-white shadow-[0_12px_28px_-10px_rgba(15,76,129,0.55)] transition-all hover:-translate-y-0.5 hover:bg-[var(--primary-hover)] active:translate-y-0 active:scale-[0.98] sm:w-auto"
          >
            {isLoggedIn ? "Tạo đề thi" : "Tạo tài khoản giáo viên"}
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/vao-thi"
            className="inline-flex h-12 w-full items-center justify-center rounded-2xl border-[1.5px] border-[var(--surface-border-strong)] bg-[var(--surface-card)] px-8 text-base font-semibold text-[var(--primary)] transition-all hover:border-[var(--primary)] hover:bg-[var(--primary-light)] active:scale-[0.98] sm:w-auto"
          >
            Vào thi bằng mã
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
          {MICRO.map((item) => (
            <span key={item} className="inline-flex items-center gap-1.5">
              <Check size={15} style={{ color: "var(--success)" }} />
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}