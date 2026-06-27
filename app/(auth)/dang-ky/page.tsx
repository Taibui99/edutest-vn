import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "../../components/auth-card";
import { RegisterForm } from "../../components/register-form";

export const metadata: Metadata = {
  title: "Đăng ký — EduTest",
  description:
    "Tạo tài khoản EduTest miễn phí để tạo đề thi, làm bài và chấm điểm tự động.",
};

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
            className="font-semibold text-blue-600 hover:text-blue-700"
          >
            Đăng nhập
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
