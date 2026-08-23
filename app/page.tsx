import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck, PenLine, Rocket, Target } from "lucide-react";
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
    title: "Soạn hoặc chọn câu hỏi",
    desc: "Tự tay soạn trắc nghiệm, đúng–sai, điền khuyết, tự luận trên một màn hình — hoặc kéo thẳng từ ngân hàng câu hỏi có sẵn.",
  },
  {
    icon: Rocket,
    step: "2",
    title: "Xuất bản & gửi mã phòng",
    desc: "Hệ thống sinh mã phòng thi và link đề. Học sinh nhập mã là làm bài ngay, không cần cài đặt gì.",
  },
  {
    icon: ClipboardCheck,
    step: "3",
    title: "Nhận báo cáo tức thì",
    desc: "Chấm tự động 100% với trắc nghiệm. Bài nộp tới đâu, điểm số và thống kê hiện tới đó.",
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
              Từ ý tưởng đến đề thi hoàn chỉnh trong vài cú bấm
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
              Tạo tài khoản miễn phí để soạn đề, quản lý lớp và nhận báo cáo tự động — hoặc vào bài bằng mã nếu giáo viên đã gửi đề cho bạn.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/dang-ky"
                className="inline-flex h-12 w-full items-center justify-center rounded-2xl px-8 text-base font-black transition-transform hover:scale-[1.03] sm:w-auto"
                style={{ background: "var(--surface-card)", color: "var(--primary)" }}
              >
                Bắt đầu soạn đề miễn phí
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