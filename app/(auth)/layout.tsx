import {
  BarChart3,
  Bot,
  FileCheck2,
  Layers,
  Sparkles,
  Timer,
} from "lucide-react";
import { Logo } from "../components/logo";
import { ThemeToggle } from "@/components/theme/theme-provider";

const BENEFITS = [
  { icon: FileCheck2, title: "Thi trực tuyến mượt mà", desc: "Timer, chấm điểm tự động, kết quả ngay sau khi nộp." },
  { icon: Bot, title: "AI Study Coach", desc: "Giải đáp, phân tích kết quả và đề xuất ôn tập phù hợp." },
  { icon: Layers, title: "Flashcard thông minh", desc: "Ôn lại đúng lúc theo thuật toán SM-2 để nhớ lâu hơn." },
  { icon: BarChart3, title: "Thống kê chi tiết", desc: "Giáo viên theo dõi điểm và phân bố kết quả từng đề." },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden p-12 lg:flex lg:flex-col lg:justify-between" style={{ background: "var(--gradient-brand)" }}>
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/5" />

        <div className="relative">
          <div className="flex items-center gap-2 text-white">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-bold text-white/80">EduTest.vn</span>
          </div>
          <h2 className="mt-8 text-4xl font-black leading-tight text-white">
            Học tập, kiểm tra
            <br />
            và ôn luyện hiệu quả
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/80">
            Nền tảng thi trực tuyến dành cho học sinh và giáo viên — tạo đề, giao bài,
            chấm điểm tự động và theo dõi tiến độ học tập.
          </p>
          <ul className="mt-10 space-y-5">
            {BENEFITS.map((b) => (
              <li key={b.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
                  <b.icon className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-white">{b.title}</p>
                  <p className="mt-0.5 text-xs text-white/70">{b.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-10 flex items-center gap-2 text-xs font-semibold text-white/70">
          <Timer className="h-4 w-4" />
          Bảo mật và tin cậy — bài thi được ghi nhận chính xác
        </div>
      </aside>

      {/* Form side */}
      <div className="relative flex flex-col">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 right-0 h-96 w-96 rounded-full bg-[var(--primary)]/10 blur-3xl" />
          <div className="absolute -bottom-24 left-0 h-80 w-80 rounded-full bg-[var(--coral)]/10 blur-3xl" />
        </div>

        <header className="relative z-10 flex items-center justify-between px-4 py-6 sm:px-8">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="hidden lg:block" />
          <ThemeToggle />
        </header>

        <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-12 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}