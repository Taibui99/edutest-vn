import Link from "next/link";

export function Hero() {
  return (
    <section className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #F0EFFE 0%, #fff 50%, #FFF8F8 100%)" }}>
      {/* Decorative blobs */}
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #6C63FF, transparent)" }} />
      <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full opacity-15" style={{ background: "radial-gradient(circle, #FF6B6B, transparent)" }} />

      <div className="relative mx-auto max-w-5xl px-5 py-20 sm:py-28 text-center">
        {/* Badge */}
        <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold mb-6"
          style={{ background: "#EEEFFE", color: "#6C63FF" }}>
          ✨ Dự án cá nhân — xây để học và thi cùng bạn bè
        </span>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-5"
          style={{ color: "#1A1523", lineHeight: 1.15 }}>
          Ôn thi cùng nhau,{" "}
          <span style={{ color: "#6C63FF" }}>dễ hơn bao giờ hết</span>
        </h1>

        <p className="text-lg sm:text-xl max-w-2xl mx-auto mb-10" style={{ color: "#64748B", lineHeight: 1.7 }}>
          EduTest là nền tảng tạo đề thi, ôn flashcard và theo dõi tiến độ học tập — được xây dựng cho học sinh lớp 12 và giáo viên của mình.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/dang-ky"
            className="w-full sm:w-auto inline-flex h-12 items-center justify-center rounded-2xl px-8 text-base font-black text-white shadow-lg transition-transform hover:scale-105"
            style={{ background: "linear-gradient(135deg, #6C63FF, #a78bfa)" }}
          >
            Bắt đầu miễn phí
          </Link>
          <Link
            href="/dang-nhap"
            className="w-full sm:w-auto inline-flex h-12 items-center justify-center rounded-2xl px-8 text-base font-bold transition-colors"
            style={{ border: "2px solid #E0DCFC", color: "#6C63FF", background: "white" }}
          >
            Đã có tài khoản →
          </Link>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 mt-10">
          {["📝 Tạo đề thi", "⏱️ Timer tự động", "🃏 Flashcard SM-2", "🤖 AI Study Coach", "👥 Lớp học", "📊 Thống kê"].map((f) => (
            <span key={f} className="text-sm font-semibold px-3 py-1.5 rounded-xl"
              style={{ background: "white", color: "#64748B", border: "1px solid #E8E4FF" }}>
              {f}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
