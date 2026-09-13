import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "../../components/auth-card";
import { RegisterForm } from "../../components/register-form";
import { GoogleButton } from "../../components/google-button";

export const metadata: Metadata = {
  title: "Đăng ký — EduTest",
  description:
    "Tạo tài khoản EduTest miễn phí để tạo đề thi, làm bài và chấm điểm tự động.",
};

const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export default function RegisterPage() {
  return (
    <AuthCard
      title="Đăng ký tài khoản"
      subtitle="Tạo tài khoản miễn phí để bắt đầu sử dụng"
      footer={
        <>
          Đã có tài khoản?{" "}
          <Link
            href="/dang-nhap"
            className="font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)]"
          >
            Đăng nhập
          </Link>
        </>
      }
    >
      <RegisterForm />
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
