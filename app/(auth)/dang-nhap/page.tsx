import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "../../components/auth-card";
import { LoginForm } from "../../components/login-form";
import { GoogleButton } from "../../components/google-button";

export const metadata: Metadata = {
  title: "Đăng nhập — EduTest",
  description: "Đăng nhập vào tài khoản EduTest để tạo đề thi và làm bài trực tuyến.",
};

const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export default function LoginPage() {
  return (
    <AuthCard
      title="Đăng nhập"
      subtitle="Chào mừng bạn quay trở lại EduTest"
      footer={
        <>
          Chưa có tài khoản?{" "}
          <Link
            href="/dang-ky"
            className="font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)]"
          >
            Đăng ký ngay
          </Link>
          {" · "}
          <Link
            href="/quen-mat-khau"
            className="font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)]"
          >
            Quên mật khẩu?
          </Link>
        </>
      }
    >
      <LoginForm />
      {googleEnabled && (
        <>
          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--surface-border)]" />
            <span className="text-xs font-medium text-[var(--text-muted)]">hoặc</span>
            <div className="h-px flex-1 bg-[var(--surface-border)]" />
          </div>
          <GoogleButton />
        </>
      )}
    </AuthCard>
  );
}
