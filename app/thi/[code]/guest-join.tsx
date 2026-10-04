"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { UserRound, School } from "lucide-react";

export function GuestJoin({ code, title }: { code: string; title: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/guest-attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examCode: code, name, className }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể vào bài thi");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể vào bài thi");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--surface-bg)] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[var(--gray-200)] p-6 sm:p-8 max-w-md w-full shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center mb-4">
          <UserRound size={22} />
        </div>
        <p className="text-sm font-semibold text-[var(--primary)] mb-1">Tham gia không cần tài khoản</p>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">{title}</h1>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          Nhập họ tên và lớp để hệ thống ghi nhận bạn là người tham gia chính thức của bài thi.
        </p>

        {error && <div className="mb-4 rounded-xl border border-[var(--danger-light)] bg-[var(--danger-light)] px-4 py-3 text-sm text-[var(--danger)]">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-[var(--gray-700)]">Họ và tên</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-[var(--gray-200)] bg-white px-3 focus-within:border-[var(--primary)]">
              <UserRound size={16} className="text-[var(--gray-400)] shrink-0" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
                autoComplete="name"
                placeholder="Nguyễn Văn A"
                className="h-12 w-full bg-transparent text-sm text-[var(--text-primary)] outline-none"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-[var(--gray-700)]">Lớp</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-[var(--gray-200)] bg-white px-3 focus-within:border-[var(--primary)]">
              <School size={16} className="text-[var(--gray-400)] shrink-0" />
              <input
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                required
                maxLength={50}
                placeholder="12A6"
                className="h-12 w-full bg-transparent text-sm text-[var(--text-primary)] outline-none"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={loading || !name.trim() || !className.trim()}
            className="h-12 w-full rounded-xl bg-[var(--primary)] text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Đang vào bài thi..." : "Bắt đầu làm bài"}
          </button>
        </form>
      </div>
    </div>
  );
}
