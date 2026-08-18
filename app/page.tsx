import Link from "next/link";
import { redirect } from "next/navigation";
import { Link2, PenLine, Rocket } from "lucide-react";
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
        <section className="py-16" style={{ background: "var(--surface-card)", borderTop: "1px solid var(--surface-border)" }}>
          <div className="mx-auto max-w-2xl px-5 text-center">
            <h2 className="mb-3 text-2xl font-black sm:text-3xl" style={{ color: "var(--text-primary)" }}>
              Sẵn sàng bắt đầu?
            </h2>
            <p className="mb-8 text-base" style={{ color: "var(--text-secondary)" }}>
              Tạo tài khoản miễn phí để học và quản lý bài thi, hoặc vào bài bằng mã nếu giáo viên đã gửi đề cho bạn.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/dang-ky"
                className="inline-flex h-12 w-full items-center justify-center rounded-xl px-8 text-base font-bold text-white transition-opacity hover:opacity-90 sm:w-auto"
                style={{ background: "var(--primary)" }}
              >
                Đăng ký miễn phí
              </Link>
              <Link
                href="/vao-thi"
                className="inline-flex h-12 w-full items-center justify-center rounded-xl px-8 text-base font-semibold transition-colors sm:w-auto"
                style={{ border: "1.5px solid var(--surface-border-strong)", color: "var(--primary)", background: "var(--surface-bg)" }}
              >
                Vào thi bằng mã
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}