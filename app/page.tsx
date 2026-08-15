import Link from "next/link";
import { redirect } from "next/navigation";
import { Link2, PenLine, Rocket, Target } from "lucide-react";
import { auth } from "@/auth";
import { Header } from "./components/header";
import { Hero } from "./components/hero";
import { Stats } from "./components/stats";
import { Features } from "./components/features";
import { Footer } from "./components/footer";

const STEPS = [
  {
    icon: PenLine,
    step: "1",
    title: "Tạo tài khoản hoặc mở đề",
    desc: "Giáo viên đăng ký để tạo đề và quản lý lớp. Học sinh có thể đăng ký tài khoản hoặc mở link/mã đề để tham gia khi đề cho phép guest.",
  },
  {
    icon: Link2,
    step: "2",
    title: "Tham gia bài thi",
    desc: "Học sinh mở link hoặc nhập mã đề, sau đó bắt đầu làm bài. Với guest, chỉ cần nhập họ tên và lớp.",
  },
  {
    icon: Rocket,
    step: "3",
    title: "Làm bài và xem kết quả",
    desc: "Làm bài trong thời gian quy định, hệ thống chấm và ghi nhận kết quả. Tài khoản EduTest còn hỗ trợ ôn tập và theo dõi tiến độ.",
  },
];

export default async function Home() {
  try {
    const session = await auth();
    if (session?.user) redirect("/bang-dieu-khien");
  } catch {}

  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <Stats />
        <Features />

        {/* How it works */}
        <section id="huong-dan" className="py-20 sm:py-24" style={{ background: "var(--surface-card)" }}>
          <div className="mx-auto max-w-4xl px-5 text-center">
            <span
              className="mb-3 inline-block rounded-full px-3 py-1 text-sm font-bold"
              style={{ background: "var(--warning-light)", color: "#C49A00" }}
            >
              Hướng dẫn
            </span>
            <h2 className="mb-12 text-2xl font-black sm:text-3xl" style={{ color: "var(--text-primary)" }}>
              Bắt đầu dễ dàng, theo cách phù hợp với bạn
            </h2>

            <div className="grid gap-6 sm:grid-cols-3">
              {STEPS.map((item) => (
                <div
                  key={item.step}
                  className="relative rounded-2xl p-6 text-left"
                  style={{ background: "var(--surface-bg)", border: "1px solid var(--surface-border)" }}
                >
                  <span
                    className="absolute -left-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full text-xs font-black text-white"
                    style={{ background: "var(--primary)" }}
                  >
                    {item.step}
                  </span>
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-1.5 font-black" style={{ color: "var(--text-primary)" }}>{item.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden py-16" style={{ background: "var(--gradient-brand)" }}>
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10" />
          <div className="absolute -bottom-24 left-1/4 h-72 w-72 rounded-full bg-white/5" />
          <div className="relative mx-auto max-w-2xl px-5 text-center">
            <h2 className="mb-3 flex items-center justify-center gap-2 text-2xl font-black text-white sm:text-3xl">
              <Target className="h-7 w-7" />
              Sẵn sàng bắt đầu?
            </h2>
            <p className="mb-8 text-white/80">
              Tạo tài khoản miễn phí để học và quản lý bài thi, hoặc vào bài bằng mã nếu giáo viên đã gửi đề cho bạn.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/dang-ky"
                className="inline-flex h-12 w-full items-center justify-center rounded-2xl px-8 text-base font-black transition-transform hover:scale-105 sm:w-auto"
                style={{ background: "var(--surface-card)", color: "var(--primary)" }}
              >
                Đăng ký miễn phí
              </Link>
              <Link
                href="/vao-thi"
                className="inline-flex h-12 w-full items-center justify-center rounded-2xl px-8 text-base font-bold text-white/90 transition-colors sm:w-auto"
                style={{ border: "2px solid rgba(255,255,255,0.4)" }}
              >
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