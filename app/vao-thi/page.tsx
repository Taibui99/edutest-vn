"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/app/components/logo";
import { ThemeToggle } from "@/components/theme/theme-provider";

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
      <header className="border-b border-[var(--surface-border)] bg-[var(--surface-card)]">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/bang-dieu-khien" className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-xl flex-col px-4 py-14 sm:px-6">
        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-card)] p-8 shadow-sm">
          <p className="text-sm font-semibold text-[var(--primary)]">Vào phòng thi</p>
          <h1 className="mt-2 text-2xl font-bold text-[var(--text-primary)]">Nhập mã tham gia</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Giáo viên sẽ cung cấp mã gồm 6 ký tự sau khi xuất bản đề thi.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="VD: ABC123"
              maxLength={8}
              className="h-14 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-input)] px-4 text-center text-2xl font-bold uppercase tracking-[0.25em] text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--focus-ring)]"
            />
            <button
              type="submit"
              className="h-12 w-full rounded-xl bg-[var(--primary)] text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-hover)]"
            >
              Bắt đầu làm bài
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}