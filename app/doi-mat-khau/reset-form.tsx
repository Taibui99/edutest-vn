"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Spinner } from "@/app/components/spinner";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    if (password !== confirm) {
      setError("Xác nhận mật khẩu không khớp.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Đã xảy ra lỗi");
        setLoading(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Đã xảy ra lỗi. Vui lòng thử lại.");
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success-light)]">
          <CheckCircle2 size={24} className="text-[var(--success)]" />
        </div>
        <p className="text-sm text-[var(--text-secondary)]">Mật khẩu đã được đặt lại thành công.</p>
        <Link
          href="/dang-nhap"
          className="mt-6 inline-flex w-full justify-center rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--primary-hover)]"
        >
          Đăng nhập với mật khẩu mới
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && (
        <div className="rounded-lg border border-[var(--danger-light)] bg-[var(--danger-light)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-[var(--text-secondary)]">
          Mật khẩu mới
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Tối thiểu 6 ký tự"
          className="mt-1.5 block w-full rounded-lg border border-[var(--surface-border)] px-4 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
        />
      </div>
      <div>
        <label htmlFor="confirm" className="block text-sm font-medium text-[var(--text-secondary)]">
          Xác nhận mật khẩu mới
        </label>
        <input
          id="confirm"
          type="password"
          required
          minLength={6}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Nhập lại mật khẩu"
          className="mt-1.5 block w-full rounded-lg border border-[var(--surface-border)] px-4 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="flex h-11 w-full items-center justify-center rounded-lg bg-[var(--primary)] text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? <Spinner className="h-4 w-4" /> : "Đặt lại mật khẩu"}
      </button>
    </form>
  );
}