"use client";

import { useState } from "react";
import { UserRound, School } from "lucide-react";
import { TransitionOverlay } from "@/app/components/transition-overlay";

/* GUEST-3b — Hybrid: server-renderable form (action/method) + JS enhancement.
 * - Có `action="/api/guest-attempts" method="post"` → chạy được khi JS tắt/iOS cũ.
 * - Có `onSubmit` preventDefault → dùng fetch JSON + `router.refresh()` khi JS có.
 * → Mọi thiết bị đều chạy, UX mượt trên thiết bị hiện đại. */

const ERRORS: Record<string, string> = {
  invalid: "Vui lòng nhập đầy đủ họ tên và lớp.",
  notfound: "Đề thi không tồn tại hoặc chưa được công bố.",
  forbidden: "Đề thi này yêu cầu đăng nhập tài khoản A6Class Edu.",
  server: "Không thể bắt đầu bài thi. Vui lòng thử lại.",
};

export function GuestJoin({
  code,
  title,
  error,
  defaultName = "",
  defaultClass = "",
}: {
  code: string;
  title: string;
  error?: string;
  defaultName?: string;
  defaultClass?: string;
}) {
  const [name, setName] = useState(defaultName);
  const [className, setClassName] = useState(defaultClass);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(error || "");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedClass = className.trim();
    if (!trimmedName || !trimmedClass) {
      setErr("invalid");
      return;
    }
    try {
      setLoading(true);
      setErr("");
      const res = await fetch("/api/guest-attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examCode: code, name: trimmedName, className: trimmedClass }),
      });
      if (!res.ok) {
        let msgKey = "server";
        try {
          const j = (await res.json()) as { error?: unknown };
          const m = typeof j?.error === "string" ? j.error : "";
          if (m.includes("đầy đủ")) msgKey = "invalid";
          else if (m.includes("không tồn tại") || m.includes("chưa được")) msgKey = "notfound";
          else if (m.includes("yêu cầu đăng nhập")) msgKey = "forbidden";
        } catch {}
        setErr(msgKey);
        return;
      }
      // Hard navigation: `router.push` cùng pathname hiện tại là no-op của App
      // Router (trang không được render lại) → phải tải lại web mới vào bài.
      // Điều hướng cứng đảm bảo server chạy lại với cookie khách vừa set.
      window.location.assign(`/thi/${code}`);
    } catch {
      setErr("server");
    } finally {
      setLoading(false);
    }
  }

  const message = err ? (ERRORS[err] ?? ERRORS.server) : "";

  return (
    <div className="min-h-screen bg-[var(--surface-bg)] flex items-center justify-center p-4">
      <TransitionOverlay show={loading} label="Đang vào phòng thi…" />
      <div className="animate-fade-in bg-white rounded-2xl border border-[var(--gray-200)] p-6 sm:p-8 max-w-md w-full shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center mb-4">
          <UserRound size={22} />
        </div>
        <p className="text-sm font-semibold text-[var(--primary)] mb-1">Tham gia không cần tài khoản</p>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">{title}</h1>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          Nhập họ tên và lớp để hệ thống ghi nhận bạn là người tham gia chính thức của bài thi.
        </p>

        {message && (
          <div className="mb-4 rounded-xl border border-[var(--danger-light)] bg-[var(--danger-light)] px-4 py-3 text-sm text-[var(--danger)]">
            {message}
          </div>
        )}

        <form action="/api/guest-attempts" method="post" onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="examCode" value={code} />
          <label className="block">
            <span className="text-sm font-semibold text-[var(--gray-700)]">Họ và tên</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-[var(--gray-200)] bg-white px-3 focus-within:border-[var(--primary)]">
              <UserRound size={16} className="text-[var(--gray-400)] shrink-0" />
              <input
                required
                maxLength={100}
                autoComplete="name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                required
                maxLength={50}
                name="class"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="12A6"
                className="h-12 w-full bg-transparent text-sm text-[var(--text-primary)] outline-none"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-xl bg-[var(--primary)] text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-60"
          >
            {loading ? "Đang vào..." : "Bắt đầu làm bài"}
          </button>
        </form>
      </div>
    </div>
  );
}
