import Link from "next/link";
import {
  BarChart3,
  Database,
  FilePlus2,
  Link2,
  School,
  Check,
} from "lucide-react";
import { auth } from "@/auth";
import { BuilderDemo } from "./builder-demo";

const HERO_CHIPS = [
  { icon: FilePlus2, label: "4 loại câu hỏi" },
  { icon: Database, label: "Ngân hàng câu hỏi" },
  { icon: Link2, label: "Giao đề bằng link hoặc mã" },
  { icon: School, label: "Quản lý lớp học" },
  { icon: BarChart3, label: "Chấm & thống kê tự động" },
];

const TRUST = ["Miễn phí cho giáo viên", "Không cần cài đặt", "Dành cho THCS & THPT"];

export async function Hero() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, var(--primary-light) 0%, var(--surface-bg) 70%)" }}
    >
      <div
        className="absolute -top-32 -right-32 h-96 w-96 rounded-full opacity-[0.12]"
        style={{ background: "radial-gradient(circle, var(--primary), transparent)" }}
      />

      <div className="relative mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold"
              style={{ background: "var(--surface-card)", color: "var(--primary)", border: "1px solid var(--surface-border)" }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--primary)" }} />
              Bàn soạn đề trực tuyến cho giáo viên Việt Nam
            </span>

            <h1
              className="mt-6 text-4xl font-black tracking-tight sm:text-5xl"
              style={{ color: "var(--text-primary)", lineHeight: 1.15 }}
            >
              Tạo đề thi{" "}
              <span style={{ background: "var(--gradient-brand)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                siêu tốc
              </span>
              .<br />
              Chấm bài{" "}
              <span style={{ background: "var(--gradient-brand)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                tự động
              </span>
              .
            </h1>

            <p
              className="mt-5 max-w-xl text-base sm:text-lg"
              style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}
            >
              Soạn câu hỏi, dựng đề từ ngân hàng có sẵn, giao thi trực tuyến — học sinh làm
              bài, hệ thống lo toàn bộ phần chấm và báo cáo.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={isLoggedIn ? "/bang-dieu-khien/tao-de-thi" : "/dang-ky"}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-8 text-base font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 active:scale-[.98]"
                style={{ background: "var(--primary)" }}
              >
                <FilePlus2 className="h-5 w-5" />
                Tạo đề thi ngay
              </Link>
              <Link
                href="/vao-thi"
                className="inline-flex h-12 items-center justify-center rounded-2xl px-8 text-base font-bold transition-colors"
                style={{ border: "1.5px solid var(--surface-border-strong)", color: "var(--primary)", background: "var(--surface-card)" }}
              >
                Vào thi bằng mã →
              </Link>
            </div>

            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
              {TRUST.map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4" style={{ color: "var(--success)" }} />
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Demo soạn đề tương tác */}
          <BuilderDemo />
        </div>

        <div className="mt-14 flex flex-wrap justify-center gap-2">
          {HERO_CHIPS.map((chip) => (
            <span
              key={chip.label}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold"
              style={{
                background: "var(--surface-card)",
                color: "var(--text-secondary)",
                border: "1px solid var(--surface-border)",
              }}
            >
              <chip.icon className="h-4 w-4" style={{ color: "var(--primary)" }} />
              {chip.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
