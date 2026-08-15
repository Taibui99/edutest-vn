"use client";

import { useActionState, useEffect, useState } from "react";
import { registerAction, type AuthFormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

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
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="rounded-lg border border-[var(--danger-light)] bg-[var(--danger-light)] px-4 py-3 text-sm text-[var(--danger)]">
          {state.error}
        </div>
      )}

      <Input
        label="Họ và tên"
        id="fullName"
        name="fullName"
        type="text"
        autoComplete="name"
        required
        placeholder="Nguyễn Văn A"
      />

      <Input
        label="Email"
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="ten@email.com"
      />

      <Select
        label="Vai trò"
        id="role"
        name="role"
        required
        defaultValue="student"
        options={[
          { value: "student", label: "Học sinh" },
          { value: "teacher", label: "Giáo viên" },
          ...(canAdmin ? [{ value: "admin" as string, label: "Quản trị viên (admin đầu tiên)" }] : []),
        ]}
      />

      <Input
        label="Mật khẩu"
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={6}
        placeholder="Tối thiểu 6 ký tự"
      />

      <Input
        label="Xác nhận mật khẩu"
        id="confirmPassword"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        minLength={6}
        placeholder="Nhập lại mật khẩu"
      />

      <label className="flex items-start gap-2.5 pt-1">
        <input
          type="checkbox"
          name="terms"
          required
          className="mt-0.5 h-4 w-4 rounded border-[var(--surface-border-strong)] text-[var(--primary)]"
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

      <Button type="submit" className="h-11 w-full" loading={isPending}>
        {isPending ? "Đang đăng ký..." : "Đăng ký tài khoản"}
      </Button>
    </form>
  );
}