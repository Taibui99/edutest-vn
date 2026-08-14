"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthCard } from "@/app/components/auth-card";
import { Spinner } from "@/app/components/spinner";

export default function QuenMatKhauPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "sent">("idle");
  const [error, setError] = useState("");
  const [resetLink, setResetLink] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setState("loading");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Đã xảy ra lỗi");
        setState("idle");
        return;
      }
      setResetLink(data.resetLink ?? null);
      setState("sent");
    } catch {
      setError("Đã xảy ra lỗi. Vui lòng thử lại.");
      setState("idle");
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-b from-blue-50 to-white p-4">
      <AuthCard
        title="Quên mật khẩu"
        subtitle="Nhập email đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu"
        footer={
          <Link href="/dang-nhap" className="font-semibold text-blue-600 hover:text-blue-700">
            ← Quay lại đăng nhập
          </Link>
        }
      >
        {state === "sent" ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl">✅</div>
            <p className="text-sm text-slate-600">
              Nếu email tồn tại, chúng tôi đã gửi liên kết đặt lại mật khẩu. Vui lòng kiểm tra hộp thư.
            </p>
            {resetLink && (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-left">
                <p className="text-xs font-semibold text-blue-700 mb-2">Liên kết demo (admin đã bật hiển thị):</p>
                <Link href={resetLink} className="text-xs font-bold text-blue-600 underline break-all">
                  {resetLink}
                </Link>
              </div>
            )}
            <Link
              href="/dang-nhap"
              className="mt-6 inline-flex w-full justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Về trang đăng nhập
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ten@email.com"
                className="mt-1.5 block w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <button
              type="submit"
              disabled={state === "loading"}
              className="flex h-11 w-full items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {state === "loading" ? <Spinner className="h-4 w-4" /> : "Gửi liên kết đặt lại"}
            </button>
          </form>
        )}
      </AuthCard>
    </div>
  );
}