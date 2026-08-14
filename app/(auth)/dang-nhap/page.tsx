import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "../../components/auth-card";
import { LoginForm } from "../../components/login-form";

export const metadata: Metadata = {
  title: "Đăng nhập — EduTest",
  description: "Đăng nhập vào tài khoản EduTest để tạo đề thi và làm bài trực tuyến.",
};

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
            className="font-semibold text-blue-600 hover:text-blue-700"
          >
            Đăng ký ngay
          </Link>
          {" · "}
          <Link
            href="/quen-mat-khau"
            className="font-semibold text-blue-600 hover:text-blue-700"
          >
            Quên mật khẩu?
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}
