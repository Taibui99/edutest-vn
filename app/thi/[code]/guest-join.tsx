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
    <div className="min-h-screen bg-[#F6F5FB] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 sm:p-8 max-w-md w-full shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-[#EFF6FF] text-[#6C4CF1] flex items-center justify-center mb-4">
          <UserRound size={22} />
        </div>
        <p className="text-sm font-semibold text-[#6C4CF1] mb-1">Tham gia không cần tài khoản</p>
        <h1 className="text-2xl font-bold text-[#0F172A] mb-2">{title}</h1>
        <p className="text-sm text-[#6B7280] mb-6">
          Nhập họ tên và lớp để hệ thống ghi nhận bạn là người tham gia chính thức của bài thi.
        </p>

        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-[#334155]">Họ và tên</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 focus-within:border-[#6C4CF1]">
              <UserRound size={16} className="text-[#94A3B8] shrink-0" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
                autoComplete="name"
                placeholder="Nguyễn Văn A"
                className="h-12 w-full bg-transparent text-sm text-[#0F172A] outline-none"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-[#334155]">Lớp</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 focus-within:border-[#6C4CF1]">
              <School size={16} className="text-[#94A3B8] shrink-0" />
              <input
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                required
                maxLength={50}
                placeholder="12A6"
                className="h-12 w-full bg-transparent text-sm text-[#0F172A] outline-none"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={loading || !name.trim() || !className.trim()}
            className="h-12 w-full rounded-xl bg-[#6C4CF1] text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Đang vào bài thi..." : "Bắt đầu làm bài"}
          </button>
        </form>
      </div>
    </div>
  );
}
