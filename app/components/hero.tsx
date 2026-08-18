import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { auth } from "@/auth";

const EXAM_ROW = [
  { code: "YN5GQZ", title: "Ôn tập cuối HK2 — Toán 11", sub: "Toán · THPT · 45 phút", state: "Đang mở", ok: true },
  { code: "7KP2XM", title: "Kiểm tra 15 phút — Tiếng Anh", sub: "Tiếng Anh · 15 phút", state: "Đã nộp", ok: true },
  { code: "C3W8TZ", title: "Đề ôn — Vật Lý 12", sub: "Vật Lý · 20 câu", state: "Chưa làm", ok: false },
];

export async function Hero() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <section className="border-b" style={{ background: "var(--surface-bg)", borderColor: "var(--surface-border)" }}>
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl" style={{ color: "var(--text-primary)", lineHeight: 1.15 }}>
              Tạo đề, giao bài, thi trực tuyến
              <br />
              và theo dõi kết quả
            </h1>

            <p className="mt-5 max-w-xl text-base sm:text-lg" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
              EduTest dành cho giáo viên tạo và giao đề, học sinh làm bài — kể cả khi
              chưa có tài khoản. Chấm điểm tự động, theo dõi tiến độ và kết quả từng
              bài nộp.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={isLoggedIn ? "/bang-dieu-khien" : "/dang-ky"}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-8 text-base font-bold text-white transition-opacity hover:opacity-90"
                style={{ background: "var(--primary)" }}
              >
                {isLoggedIn ? "Tiếp tục vào EduTest" : "Tạo tài khoản miễn phí"}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/vao-thi"
                className="inline-flex h-12 items-center justify-center rounded-xl px-8 text-base font-semibold transition-colors"
                style={{ border: "1.5px solid var(--surface-border-strong)", color: "var(--primary)", background: "var(--surface-card)" }}
              >
                Vào thi bằng mã
              </Link>
            </div>
          </div>

          {/* Bảng đề thật — không phải mockup trình duyệt */}
          <div className="w-full rounded-xl border" style={{ background: "var(--surface-card)", borderColor: "var(--surface-border)" }}>
            <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: "var(--surface-border)" }}>
              <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Đề thi của bạn</p>
              <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>3 đề · 2 chưa nộp</span>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--surface-border)" }}>
              {EXAM_ROW.map((row) => (
                <div key={row.code} className="flex items-center gap-3 px-5 py-3.5">
                  <span
                    className="hidden h-9 w-14 shrink-0 items-center justify-center rounded-md text-xs font-black sm:flex"
                    style={{ background: "var(--gray-100)", color: "var(--text-secondary)" }}
                  >
                    {row.code}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold" style={{ color: "var(--text-primary)" }}>{row.title}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{row.sub}</p>
                  </div>
                  <span
                    className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-bold"
                    style={{
                      background: row.ok ? "var(--success-light)" : "var(--warning-light)",
                      color: row.ok ? "var(--success)" : "var(--warning)",
                    }}
                  >
                    {row.ok && <CheckCircle2 className="h-3 w-3" />}
                    {row.state}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t px-5 py-3" style={{ borderColor: "var(--surface-border)" }}>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Bạn cũng có thể tham gia ngay bằng <span className="font-bold" style={{ color: "var(--primary)" }}>mã đề</span> mà giáo viên gửi — không cần tài khoản.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}