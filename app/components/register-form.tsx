"use client";

import { useActionState, useEffect, useState } from "react";
import { registerAction, type AuthFormState } from "@/app/actions/auth";
import { Spinner } from "@/app/components/spinner";

const initialState: AuthFormState = {};

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(
    registerAction,
    initialState,
  );
  const [canAdmin, setCanAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/admin/status")
      .then((r) => r.json())
      .then((d: { hasAdmin: boolean }) => setCanAdmin(!d.hasAdmin))
      .catch(() => {});
  }, []);

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <div className="rounded-lg border border-[var(--danger-light)] bg-[var(--danger-light)] px-4 py-3 text-sm text-[var(--danger)]">
          {state.error}
        </div>
      )}

      <div>
        <label
          htmlFor="fullName"
          className="block text-sm font-medium text-[var(--text-secondary)]"
        >
          Họ và tên
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          required
          placeholder="Nguyễn Văn A"
          className="mt-1.5 block w-full rounded-lg border border-[var(--surface-border)] px-4 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
        />
      </div>

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-[var(--text-secondary)]"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="ten@email.com"
          className="mt-1.5 block w-full rounded-lg border border-[var(--surface-border)] px-4 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
        />
      </div>

      <div>
        <label
          htmlFor="role"
          className="block text-sm font-medium text-[var(--text-secondary)]"
        >
          Vai trò
        </label>
        <select
          id="role"
          name="role"
          required
          defaultValue=""
          className="mt-1.5 block w-full rounded-lg border border-[var(--surface-border)] px-4 py-2.5 text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
        >
          <option value="" disabled>
            Chọn vai trò
          </option>
          <option value="teacher">Giáo viên</option>
          <option value="student">Học sinh</option>
          {canAdmin && <option value="admin">Quản trị viên (admin đầu tiên)</option>}
        </select>
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-[var(--text-secondary)]"
        >
          Mật khẩu
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          placeholder="Tối thiểu 6 ký tự"
          className="mt-1.5 block w-full rounded-lg border border-[var(--surface-border)] px-4 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
        />
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium text-[var(--text-secondary)]"
        >
          Xác nhận mật khẩu
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          placeholder="Nhập lại mật khẩu"
          className="mt-1.5 block w-full rounded-lg border border-[var(--surface-border)] px-4 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
        />
      </div>

      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          name="terms"
          required
          className="mt-0.5 h-4 w-4 rounded border-[var(--surface-border-strong)] text-[var(--primary)] focus:ring-blue-500"
        />
        <span className="text-sm text-[var(--text-secondary)]">
          Tôi đồng ý với{" "}
          <a href="#" className="font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]">
            Điều khoản sử dụng
          </a>{" "}
          và{" "}
          <a href="#" className="font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]">
            Chính sách bảo mật
          </a>
        </span>
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="flex h-11 w-full items-center justify-center rounded-lg bg-[var(--primary)] text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? (
          <span className="flex items-center gap-2">
            <Spinner className="h-4 w-4" />
            Đang đăng ký...
          </span>
        ) : (
          "Đăng ký tài khoản"
        )}
      </button>
    </form>
  );
}
