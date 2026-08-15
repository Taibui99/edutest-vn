"use client";

import { useActionState } from "react";
import { loginAction, type AuthFormState } from "@/app/actions/auth";
import { Spinner } from "@/app/components/spinner";

const initialState: AuthFormState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <div className="rounded-lg border border-[var(--danger-light)] bg-[var(--danger-light)] px-4 py-3 text-sm text-[var(--danger)]">
          {state.error}
        </div>
      )}

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
          htmlFor="password"
          className="block text-sm font-medium text-[var(--text-secondary)]"
        >
          Mật khẩu
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={6}
          placeholder="••••••••"
          className="mt-1.5 block w-full rounded-lg border border-[var(--surface-border)] px-4 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="flex h-11 w-full items-center justify-center rounded-lg bg-[var(--primary)] text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? (
          <span className="flex items-center gap-2">
            <Spinner className="h-4 w-4" />
            Đang đăng nhập...
          </span>
        ) : (
          "Đăng nhập"
        )}
      </button>
    </form>
  );
}
