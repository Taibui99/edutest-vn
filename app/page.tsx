import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Header } from "./components/header";
import { Hero } from "./components/hero";
import { Features } from "./components/features";
import { Footer } from "./components/footer";

export default async function Home() {
  try {
    const session = await auth();
    if (session?.user) redirect("/bang-dieu-khien");
  } catch {}

  return (
    <>
      <Header />
      <main>
        <Hero />
        <Features />

        {/* How it works */}
        <section id="huong-dan" className="py-20 sm:py-24" style={{ background: "white" }}>
          <div className="mx-auto max-w-4xl px-5 text-center">
            <span className="inline-block text-sm font-bold px-3 py-1 rounded-full mb-3"
              style={{ background: "#FFF8E1", color: "#C49A00" }}>
              Hướng dẫn
            </span>
            <h2 className="text-2xl sm:text-3xl font-black mb-12" style={{ color: "#1A1523" }}>
              Bắt đầu dễ dàng, theo cách phù hợp với bạn
            </h2>

            <div className="grid gap-6 sm:grid-cols-3">
              {[
                { step: "1", emoji: "✍️", title: "Tạo tài khoản hoặc mở đề", desc: "Giáo viên đăng ký để tạo đề và quản lý lớp. Học sinh có thể đăng ký tài khoản hoặc mở link/mã đề để tham gia khi đề cho phép guest." },
                { step: "2", emoji: "🔗", title: "Tham gia bài thi", desc: "Học sinh mở link hoặc nhập mã đề, sau đó bắt đầu làm bài. Với guest, chỉ cần nhập họ tên và lớp." },
                { step: "3", emoji: "🚀", title: "Làm bài và xem kết quả", desc: "Làm bài trong thời gian quy định, hệ thống chấm và ghi nhận kết quả. Tài khoản EduTest còn hỗ trợ ôn tập và theo dõi tiến độ." },
              ].map((item) => (
                <div key={item.step} className="relative rounded-2xl p-6 text-left"
                  style={{ background: "#F8F7FF", border: "1px solid #E8E4FF" }}>
                  <span className="absolute -top-3 -left-3 w-7 h-7 rounded-full text-xs font-black text-white flex items-center justify-center"
                    style={{ background: "#6C63FF" }}>
                    {item.step}
                  </span>
                  <div className="text-3xl mb-3">{item.emoji}</div>
                  <h3 className="font-black mb-1.5" style={{ color: "#1A1523" }}>{item.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#64748B" }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16" style={{ background: "linear-gradient(135deg, #6C63FF 0%, #a78bfa 100%)" }}>
          <div className="mx-auto max-w-2xl px-5 text-center">
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
              Sẵn sàng bắt đầu? 🎯
            </h2>
            <p className="text-white/80 mb-8">
              Tạo tài khoản miễn phí để học và quản lý bài thi, hoặc vào bài bằng mã nếu giáo viên đã gửi đề cho bạn.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/dang-ky"
                className="w-full sm:w-auto inline-flex h-12 items-center justify-center rounded-2xl px-8 text-base font-black transition-transform hover:scale-105"
                style={{ background: "white", color: "#6C63FF" }}>
                Đăng ký miễn phí
              </Link>
              <Link href="/vao-thi"
                className="w-full sm:w-auto inline-flex h-12 items-center justify-center rounded-2xl px-8 text-base font-bold text-white/90 transition-colors"
                style={{ border: "2px solid rgba(255,255,255,0.4)" }}>
                Vào thi bằng mã →
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
