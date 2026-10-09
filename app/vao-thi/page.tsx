"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KeyRound, PencilLine, Rocket } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-provider";

const STEPS = [
  { icon: KeyRound, text: "Nhận mã 6 ký tự từ giáo viên" },
  { icon: PencilLine, text: "Nhập mã vào ô bên trên" },
  { icon: Rocket, text: "Bắt đầu làm bài ngay" },
];

export default function VaoThiPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedCode = code.trim().toUpperCase();

    if (!normalizedCode) {
      return;
    }

    router.push(`/thi/${normalizedCode}`);
  };

  return (
    <div className="min-h-screen bg-[var(--surface-bg)]">
      <header className="border-b border-[var(--surface-border)] bg-[var(--surface-card)]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo size="sm" href="/" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/bang-dieu-khien" className="inline-flex h-10 items-center rounded-lg px-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--primary-light)] hover:text-[var(--primary)]">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="relative mx-auto flex max-w-xl flex-col overflow-hidden px-4 py-14 sm:px-6">
        {/* texture đồng bộ hero landing */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(var(--primary) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            maskImage: "linear-gradient(180deg, black, transparent 72%)",
            WebkitMaskImage: "linear-gradient(180deg, black, transparent 72%)",
          }}
        />

        <div className="relative rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-card)] p-6 shadow-[0_24px_60px_-24px_rgba(15,76,129,0.28)] sm:p-8">
          <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--primary)]">Vào phòng thi</p>
          <h1 className="mt-2 text-balance text-2xl font-black tracking-tight text-[var(--text-primary)]">Nhập mã tham gia</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            Giáo viên sẽ cung cấp mã gồm 6 ký tự sau khi xuất bản đề thi.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="VD: ABC123"
              maxLength={8}
              aria-label="Mã tham gia phòng thi"
              className="h-14 w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-input)] px-4 text-center text-2xl font-bold uppercase tracking-[0.25em] text-[var(--text-primary)] outline-none transition-shadow focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--focus-ring)]"
            />
            <button
              type="submit"
              className="h-12 w-full rounded-2xl bg-[var(--primary)] text-sm font-bold text-white shadow-[0_12px_28px_-10px_rgba(15,76,129,0.55)] transition-all hover:bg-[var(--primary-hover)] active:scale-[0.98]"
            >
              Bắt đầu làm bài
            </button>
          </form>
        </div>

        <ol className="relative mt-6 grid gap-2.5 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.text} className="flex items-center gap-2.5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-card)] px-3.5 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
                <s.icon size={16} />
              </span>
              <span className="text-[13px] font-semibold leading-snug text-[var(--text-secondary)]">
                <span className="mr-1 font-black text-[var(--text-muted)]">{i + 1}.</span>
                {s.text}
              </span>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}