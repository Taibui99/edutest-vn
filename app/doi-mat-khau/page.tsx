import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AuthCard } from "@/app/components/auth-card";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = {
  title: "Đặt lại mật khẩu — EduTest",
};

export default async function DoiMatKhauPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  let valid = false;

  if (token) {
    const user = await prisma.user.findUnique({
      where: { resetToken: token },
      select: { resetTokenExpiry: true, name: true },
    });
    valid = Boolean(user && user.resetTokenExpiry && user.resetTokenExpiry > new Date());
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-b from-blue-50 to-white p-4">
      <AuthCard
        title="Đặt lại mật khẩu"
        subtitle={valid ? "Tạo mật khẩu mới cho tài khoản của bạn" : "Liên kết không hợp lệ"}
        footer={
          <Link href="/dang-nhap" className="font-semibold text-blue-600 hover:text-blue-700">
            ← Quay lại đăng nhập
          </Link>
        }
      >
        {valid ? (
          <ResetPasswordForm token={token!} />
        ) : (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.
          </div>
        )}
      </AuthCard>
    </div>
  );
}