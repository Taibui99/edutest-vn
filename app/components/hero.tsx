import Link from "next/link";
import {
  BarChart3,
  Bot,
  FileText,
  Ghost,
  Link2,
  School,
  Timer,
  CheckCircle2,
} from "lucide-react";
import { auth } from "@/auth";

const HERO_CHIPS = [
  { icon: FileText, label: "Tạo đề thi" },
  { icon: Link2, label: "Giao đề bằng link hoặc mã" },
  { icon: Ghost, label: "Thi không cần tài khoản" },
  { icon: Bot, label: "AI Study Coach" },
  { icon: School, label: "Quản lý lớp học" },
  { icon: BarChart3, label: "Thống kê kết quả" },
];

export async function Hero() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, var(--primary-light) 0%, var(--surface-bg) 55%, var(--coral-light) 130%)" }}
    >
      <div
        className="absolute -top-32 -right-32 h-96 w-96 rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, var(--primary), transparent)" }}
      />
      <div
        className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full opacity-15"
        style={{ background: "radial-gradient(circle, var(--coral), transparent)" }}
      />

      <div className="relative mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold"
              style={{ background: "var(--surface-card)", color: "var(--primary)", border: "1px solid var(--surface-border)" }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--mint)" }} />
              Học tập và kiểm tra trực tuyến cho học sinh, giáo viên
            </span>

            <h1
              className="mt-6 text-4xl font-black tracking-tight sm:text-5xl"
              style={{ color: "var(--text-primary)", lineHeight: 1.15 }}
            >
              Tạo đề, giao bài,{" "}
              <span style={{ background: "var(--gradient-brand)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                thi trực tuyến
              </span>
              <br />
              và theo dõi kết quả dễ dàng
            </h1>

            <p
              className="mt-5 max-w-xl text-base sm:text-lg"
              style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}
            >
              EduTest giúp giáo viên tạo và giao đề, học sinh làm bài ngay cả khi chưa có tài
              khoản, đồng thời hỗ trợ ôn tập và theo dõi tiến độ học tập.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={isLoggedIn ? "/bang-dieu-khien" : "/dang-ky"}
                className="inline-flex h-12 items-center justify-center rounded-2xl px-8 text-base font-black text-white shadow-lg transition-transform hover:scale-105"
                style={{ background: "var(--gradient-brand)" }}
              >
                {isLoggedIn ? "Tiếp tục vào EduTest →" : "Bắt đầu miễn phí"}
              </Link>
              <Link
                href="/vao-thi"
                className="inline-flex h-12 items-center justify-center rounded-2xl px-8 text-base font-bold transition-colors"
                style={{ border: "2px solid var(--surface-border-strong)", color: "var(--primary)", background: "var(--surface-card)" }}
              >
                Vào thi bằng mã →
              </Link>
            </div>
          </div>

          {/* Mockup: màn hình làm bài */}
          <div className="relative mx-auto w-full max-w-md">
            <div
              className="absolute -inset-4 rounded-3xl opacity-30 blur-2xl"
              style={{ background: "var(--gradient-brand)" }}
            />
            <div
              className="relative rounded-3xl border p-5 shadow-2xl"
              style={{ background: "var(--surface-card)", borderColor: "var(--surface-border)", transform: "rotate(1.5deg)" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--coral)" }} />
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--warning)" }} />
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--mint)" }} />
                </div>
                <span
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold"
                  style={{ background: "var(--danger-light)", color: "var(--danger)" }}
                >
                  <Timer className="h-3.5 w-3.5" />
                  23:45
                </span>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                  <span style={{ color: "var(--text-secondary)" }}>Câu 3 / 20</span>
                  <span style={{ color: "var(--primary)" }}>Toán · THPT</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: "var(--gray-100)" }}>
                  <div
                    className="h-1.5 rounded-full"
                    style={{ width: "15%", background: "var(--gradient-brand)" }}
                  />
                </div>
              </div>

              <div className="mt-4 rounded-xl border p-4" style={{ borderColor: "var(--surface-border)", background: "var(--surface-hover)" }}>
                <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  Tìm x để biểu thức (x² − 5x + 6) / (x − 2) xác định:
                </p>
                <div className="mt-3 space-y-2">
                  {[
                    { t: "x ≠ 2", sel: true },
                    { t: "x = 2", sel: false },
                    { t: "x ≠ 3", sel: false },
                    { t: "x ≠ 0", sel: false },
                  ].map((opt) => (
                    <div
                      key={opt.t}
                      className="flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm font-medium"
                      style={{
                        borderColor: opt.sel ? "var(--primary)" : "var(--surface-border)",
                        background: opt.sel ? "var(--primary-light)" : "var(--surface-card)",
                        color: opt.sel ? "var(--primary)" : "var(--text-secondary)",
                      }}
                    >
                      {opt.sel ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      ) : (
                        <span className="h-4 w-4 shrink-0 rounded-full border-2" style={{ borderColor: "var(--surface-border-strong)" }} />
                      )}
                      {opt.t}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span
                  className="inline-flex h-9 items-center rounded-xl px-4 text-sm font-bold"
                  style={{ background: "var(--gray-100)", color: "var(--text-muted)" }}
                >
                  ← Câu trước
                </span>
                <span
                  className="inline-flex h-9 items-center rounded-xl px-5 text-sm font-black text-white"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  Câu tiếp →
                </span>
              </div>
            </div>

            <div
              className="absolute -right-3 -top-5 rounded-2xl border px-3 py-2 shadow-lg"
              style={{ background: "var(--surface-card)", borderColor: "var(--surface-border)" }}
            >
              <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Điểm</p>
              <p className="text-lg font-black" style={{ color: "var(--mint)" }}>8.5 / 10</p>
            </div>
            <div
              className="absolute -bottom-4 -left-4 rounded-2xl border px-3 py-2 shadow-lg"
              style={{ background: "var(--surface-card)", borderColor: "var(--surface-border)" }}
            >
              <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Nộp bài</p>
              <p className="text-sm font-black" style={{ color: "var(--primary)" }}>✔ Đã nộp tự động</p>
            </div>
          </div>
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