"use client";

import { useActionState } from "react";
import { loginAction, type AuthFormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: AuthFormState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="rounded-lg border border-[var(--danger-light)] bg-[var(--danger-light)] px-4 py-3 text-sm text-[var(--danger)]">
          {state.error}
        </div>
      )}

      <Input
        label="Email"
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="ten@email.com"
      />

      <Input
        label="Mật khẩu"
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        minLength={6}
        placeholder="••••••••"
      />

      <Button type="submit" className="h-11 w-full" loading={isPending}>
        {isPending ? "Đang đăng nhập..." : "Đăng nhập"}
      </Button>
    </form>
  );
}