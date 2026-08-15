import Link from "next/link";
import { auth } from "@/auth";

export async function Hero() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <section className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #F0EFFE 0%, #fff 50%, #FFF8F8 100%)" }}>
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #6C63FF, transparent)" }} />
      <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full opacity-15" style={{ background: "radial-gradient(circle, #FF6B6B, transparent)" }} />

      <div className="relative mx-auto max-w-5xl px-5 py-20 sm:py-28 text-center">
        <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold mb-6" style={{ background: "#EEEFFE", color: "#6C63FF" }}>
          ✨ Học tập và kiểm tra trực tuyến cho học sinh, giáo viên
        </span>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-5" style={{ color: "#1A1523", lineHeight: 1.15 }}>
          Tạo đề, giao bài, <span style={{ color: "#6C63FF" }}>thi trực tuyến</span>
          <br />
          và theo dõi kết quả dễ dàng
        </h1>

        <p className="text-lg sm:text-xl max-w-2xl mx-auto mb-10" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
          EduTest giúp giáo viên tạo và giao đề, học sinh làm bài ngay cả khi chưa có tài khoản, đồng thời hỗ trợ ôn tập và theo dõi tiến độ học tập.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {isLoggedIn ? (
            <Link href="/bang-dieu-khien" className="w-full sm:w-auto inline-flex h-12 items-center justify-center rounded-2xl px-8 text-base font-black text-white shadow-lg transition-transform hover:scale-105" style={{ background: "linear-gradient(135deg, #6C63FF, #a78bfa)" }}>
              Tiếp tục vào EduTest →
            </Link>
          ) : (
            <Link href="/dang-ky" className="w-full sm:w-auto inline-flex h-12 items-center justify-center rounded-2xl px-8 text-base font-black text-white shadow-lg transition-transform hover:scale-105" style={{ background: "linear-gradient(135deg, #6C63FF, #a78bfa)" }}>
              Bắt đầu miễn phí
            </Link>
          )}
          <Link href="/vao-thi" className="w-full sm:w-auto inline-flex h-12 items-center justify-center rounded-2xl px-8 text-base font-bold transition-colors" style={{ border: "2px solid #E0DCFC", color: "#6C63FF", background: "var(--surface-card)" }}>
            Vào thi bằng mã →
          </Link>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mt-10">
          {["📝 Tạo đề thi", "🔗 Giao đề bằng link hoặc mã", "👻 Thi không cần tài khoản", "🤖 AI Study Coach", "🏫 Quản lý lớp học", "📊 Thống kê kết quả"].map((f) => (
            <span key={f} className="text-sm font-semibold px-3 py-1.5 rounded-xl" style={{ background: "var(--surface-card)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}>
              {f}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
